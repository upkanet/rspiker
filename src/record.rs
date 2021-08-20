extern crate file_utils;
extern crate serde;

use std::io;
use std::fs::File;
use std::str;
use std::io::Read;
use std::io::Seek;
use std::io::SeekFrom;

use serde::Deserialize;

#[derive(Clone)]
pub struct Record {
    pub filepath: String,
    pub sample_rate: u64,
    pub eoh: u64,
    pub datastart: u64,
    pub header: String,
    pub adczero: u64,
    pub el: f64,
    pub streams: u64,
    pub duration: f64,
    pub electrodes: Vec<Vec<f64>>
}

#[derive(Deserialize)]
pub struct Config {
    pub fc: u64,
    pub threshold: f64,
    pub timewidth: u64
}

impl Record {
    pub fn new(filepath: String) -> Record {
        let electrodes: Vec<Vec<f64>> = Vec::new();
        return Record{ filepath , sample_rate: 0, eoh: 0, datastart: 0, header:"".to_string(), adczero: 0, el: 0.0, streams: 0, duration: 0.0, electrodes };
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
        self.datastart = n + 5;
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
        let mut file = File::open(&self.filepath).expect("Introuvable");
        file.seek(SeekFrom::Start(self.datastart)).expect("No");
        let metadata = file.metadata().expect("No");
        let bytes = metadata.len() - self.datastart; //File length minus header
        self.duration = bytes as f64 / 2.0 / self.sample_rate as f64 / self.streams as f64; // divided by 2 because 2 x u8 = 1 x i16
        let mut buffer = vec!(0;bytes as usize);
        file.read(&mut buffer).expect("Pb");
        self.bin2electrode(buffer);
    }
    
    fn bin2electrode(&mut self, bin: Vec<u8>){
        self.electrodes = vec![vec![0.0];self.streams as usize];
        let mut k = 0;
        while k+1+2*256 < bin.len() {
            for n in 0..self.streams {
                self.electrodes[n as usize].push((((bin[k] as i16) << 8) | bin[k+1] as i16) as f64);
                k += 2;
            }
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

    pub fn espiker(&self, n: usize) -> Vec<f64>{
        let threshold = self.config().threshold;
        //println!("Spiker Sorting at {} std-dev on electrode #{}",threshold,n);
        let fe = self.efilter(n).to_vec();
        let avg = match mean(&fe){
            Some(v) => v,
            None => 0.0
        };
        let stddev = match std_deviation(&fe){
            Some(v) => v,
            None => 0.0
        };

        let mut se = fe.to_vec();

        se[0] = 0.0;

        for k in 1..se.len() {
            // Y m-1
            let ym1 = fe[k-1];
            let y = fe[k];
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

    pub fn timeslice(&self,m: &str, s: u64, n: usize) -> Vec<f64>{
        let k = (s * self.config().timewidth * self.sample_rate) as usize;
        let mut k2 = ((s + 1) * self.config().timewidth * self.sample_rate) as usize;
        let mut el:Vec<f64> = Vec::new();
        if m == "e"{
            el = self.electrodes[n].to_vec();
        }
        else if m == "f" {
            el = self.efilter(n);
        }
        if k2 > el.len(){
            k2 = el.len();
        }
        return el[k..k2].to_vec();
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