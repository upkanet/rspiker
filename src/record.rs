extern crate file_utils;
extern crate serde;
use file_utils::read::Read;
use draw::*;

use std::io;
use std::fs::File;
use std::str;
use std::io::SeekFrom;

use serde::Deserialize;

#[derive(Clone)]
pub struct Record {
    pub filepath: String,
    pub sample_rate: u64,
    pub eoh: u64,
    pub header: String,
    pub adczero: u64,
    pub el: f64,
    pub streams: u64,
    pub ebin: String,
    pub electrodes: Vec<Vec<f64>>,
    pub felectrodes: Vec<Vec<f64>>,
    pub selectrodes: Vec<Vec<f64>>
}

#[derive(Deserialize)]
pub struct Config {
    fc: u64,
    threshold: f64,
    timewidth: u64
}

impl Record {
    pub fn new(filepath: String) -> Record {
        let electrodes: Vec<Vec<f64>> = Vec::new();
        let felectrodes: Vec<Vec<f64>> = Vec::new();
        let selectrodes: Vec<Vec<f64>> = Vec::new();
        return Record{ filepath , sample_rate: 0, eoh: 0, header:"".to_string(), adczero: 0, el: 0.0, streams: 0,ebin: "".to_string(), electrodes, felectrodes, selectrodes };
    }

    pub fn config(&self) -> Config{
        let mut file = File::open("config.json").expect("Unable to open the file");
        let mut contents = String::new();
        io::Read::read_to_string(&mut file, &mut contents).expect("Unable to read the file");
        let c:Config = serde_json::from_str(&contents).expect("JSON was not well-formatted");
        return c;
    }

    pub fn load(&mut self){
        self.findeoh();
        self.loadheader();
        self.felectrodes = vec![vec![0.0];self.streams as usize];
        self.selectrodes = vec![vec![0.0];self.streams as usize];
        self.loaddata();
    }

    pub fn findeoh(&mut self)
    {
        let mut file = File::open(&self.filepath).expect("Introuvable");
        let mut buffer = [0; 3];
        let mut n = 0;
        loop {
            io::Seek::seek(&mut file, SeekFrom::Start(n)).expect("No");
            io::Read::read(&mut file, &mut buffer).expect("Introuvable");
            let s = match str::from_utf8(&buffer){
                Ok(v) => v,
                Err(_) => ""
            };
            n+=1;
            if s == "EOH" {
                n+=2;
                break;
            }
        }
        self.eoh = n;
    }

    pub fn loadheader(&mut self){
        let mut file = File::open(&self.filepath).expect("Introuvable");
        let mut buffer = [0];
        let mut h = "".to_string();
        for _n in 0..self.eoh {
            io::Read::read(&mut file, &mut buffer).expect("Introuvable");
            let s = match str::from_utf8(&buffer){
                Ok(v) => v,
                Err(_) => ""
            };
            h.push_str(s);
        }
        self.header = h;
        self.parseheader();
    }

    pub fn parseheader(&mut self){
        self.sample_rate = self.headerfieldvalue(3).parse().unwrap();
        self.adczero = self.headerfieldvalue(4).parse().unwrap();
        let els = self.headerfieldvalue(5);
        let els = els[0..6].to_string();
        self.el = els.parse().unwrap();
        let streamss = self.headerfieldvalue(6);
        let s: Vec<&str> = streamss.split(";").collect();
        let streams = s.len();
        self.streams = streams as u64;
    }

    fn headerfieldvalue(& self,line: usize) -> String{
        let h = &self.header;
        let c: Vec<&str> = h.split("\n").collect();
        let l = c[line];
        let pos = match l.find("="){
            Some(v) => v + 2,
            None => 0
        };
        let val = l[pos..l.len()-1].to_string();
        return val;
    }

    pub fn loaddata(&mut self){
        for _n in 0..self.streams {
            self.electrodes.push(Vec::new());
        }

        let mut file = File::open(&self.filepath).expect("Introuvable");
        io::Seek::seek(&mut file, SeekFrom::Start(self.eoh+5)).expect("No");
        let metadata = file.metadata().expect("No");
        let rows = metadata.len() / 2 / self.streams;
        let mut eof = false;
        let mut row = 0;
        progress(true, row, rows);
        while !eof {
            for n in 0..self.streams {
                match file.read_i16(){
                    Ok(v) => self.electrodes[n as usize].push(v as f64),
                    Err(_) => eof = true
                };
            }
            row += 1;
            progress(false, row, rows);
        }
    }

    pub fn efilter(&self,n: usize) -> Vec<f64>{
        let fc = self.config().fc;
        //println!("High Pass Filtering at {}Hz on electrode #{}",fc,n);

        let pi = std::f64::consts::PI;
        let rc = 1.0/(2.0 * pi * fc as f64);
        let dt = 1.0 / self.sample_rate as f64;
        let alpha = rc / (rc + dt);

        let mut fe = self.electrodes[n].to_vec();

        for k in 1..fe.len() {
            let x = self.electrodes[n][k];
            let ykm1 = fe[k-1];
            let xkm1 = self.electrodes[n][k-1];
            let yk = alpha * (ykm1 + x - xkm1);
            fe[k] = yk;
        }

        return fe;
    }

    pub fn filter(&mut self){
        progress(true,0,self.streams);
        for n in 0..self.streams{
            self.felectrodes[n as usize] = self.efilter(n as usize);
            progress(false,n,self.streams);
        }
    }

    pub fn espiker(&self, n: usize) -> Vec<f64>{
        let threshold = self.config().threshold;
        //println!("Spiker Sorting at {} std-dev on electrode #{}",threshold,n);
        let avg = match mean(&self.felectrodes[n].to_vec()){
            Some(v) => v,
            None => 0.0
        };
        let stddev = match std_deviation(&self.felectrodes[n].to_vec()){
            Some(v) => v,
            None => 0.0
        };

        let mut se = self.felectrodes[n].to_vec();

        se[0] = 0.0;

        for k in 1..se.len() {
            // Y m-1
            let ym1 = self.felectrodes[n][k-1];
            let y = self.felectrodes[n][k];
            let tup = avg + threshold * stddev;
            let tdown = avg - threshold * stddev;

            // Asc front
            if (ym1 <= tup) && (y > tup){
                se[k] = 1.0;
            }
            // Desc front
            else if (ym1 >= tdown) && (y < tdown){
                se[k] = 1.0;
            }
            else{
                se[k] = 0.0;
            }
        }

        return se;

    }

    pub fn spiker(&mut self){
        for n in 0..self.streams{
            self.selectrodes[n as usize] = self.espiker(n as usize);
        }
    }

    fn eraster(&self, n: usize){
        let timewidth = self.config().timewidth;
        println!("Saving RasterPlot at {} s timewidth on electrode #{}",timewidth,n);
        let data = &self.selectrodes[n];
        println!("selectrodes[{}] data length{}",n,data.len());
        let tw = timewidth as f64;
        let th = data.len() as f64 / self.sample_rate as f64 / tw;
        let w = 1000 as f64;
        let h = 1000 as f64;
        let mut canvas = Canvas::new(w as u32, h as u32);
        for k in 0..data.len(){
            if data[k] > 0.0 {
                let t = k as f64 / self.sample_rate as f64;
                let x = t%tw / tw;
                let y = t/tw / th;
                let rect = Drawing::new()
                    .with_shape(Shape::Rectangle {
                        width: 2,
                        height: 20
                    })
                    .with_xy((x * w) as f32, (y * h) as f32);
                canvas.display_list.add(rect);
            }
        }
        render::save(&canvas, "test.svg", SvgRenderer::new()).expect("Failed to save");
    }

    pub fn raster(&self){
        //ToDo
        self.eraster(174);
    }
}

fn mean(data: &[f64]) -> Option<f64> {
    let sum = data.iter().sum::<f64>() as f64;
    let count = data.len();

    match count {
        positive if positive > 0 => Some(sum / count as f64),
        _ => None,
    }
}

fn std_deviation(data: &[f64]) -> Option<f64> {
    match (mean(data), data.len()) {
        (Some(data_mean), count) if count > 0 => {
            let variance = data.iter().map(|value| {
                let diff = data_mean - (*value as f64);

                diff * diff
            }).sum::<f64>() / count as f64;

            Some(variance.sqrt())
        },
        _ => None
    }
}

pub fn progress(first: bool, n:u64,t:u64){
    if first{
        print!("{}",(1..100).map(|_| "-").collect::<String>());
    }
    else {
        print!("\x1B[F");
        let p = 100 * n / t;
        for _k in 0..p{
            print!("■");
        }
    }
    print!("\n");
}