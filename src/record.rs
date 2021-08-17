extern crate file_utils;
use file_utils::read::Read;

use std::io;
use std::fs::File;
use std::str;
use std::io::SeekFrom;

pub struct Record {
    pub filepath: String,
    pub sample_rate: u64,
    pub eoh: u64,
    pub header: String,
    pub adczero: u64,
    pub el: f64,
    pub streams: u64,
    pub electrodes: Vec<Vec<f64>>,
    pub felectrodes: Vec<Vec<f64>>
}

impl Record {
    pub fn new(filepath: String) -> Record {
        let electrodes: Vec<Vec<f64>> = Vec::new();
        let felectrodes: Vec<Vec<f64>> = Vec::new();
        return Record{ filepath , sample_rate: 0, eoh: 0, header:"".to_string(), adczero: 0, el: 0.0, streams: 0, electrodes, felectrodes };
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
        //println!("{}", self.header);
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
        let mut eof = false;
        while !eof {
            for n in 0..self.streams {
                match file.read_i16(){
                    Ok(v) => self.electrodes[n as usize].push(v as f64 * self.el),
                    Err(_) => eof = true
                };
            }
        }
    }

    fn efilter(&mut self,fc: u64, n: usize){
        println!("High Pass Filtering at {}Hz on electrode #{}",fc,n);

        let pi = std::f64::consts::PI;
        let rc = 1.0/(2.0 * pi * fc as f64);
        let dt = 1.0 / self.sample_rate as f64;
        let alpha = rc / (rc + dt);

        let mut fe = self.electrodes[n].to_vec();

        for k in 1..fe.len() {
            let x = self.electrodes[n][k-1];
            let ykm1 = fe[k-1];
            let xkm1 = self.electrodes[n][k-1];
            let yk = alpha * (ykm1 + x - xkm1);
            fe[k] = yk;
        }

        self.felectrodes.push(fe);
    }

    pub fn filter(&mut self,fc: u64){
        for n in 0..self.streams{
            self.efilter(fc,n as usize);
        }
    }
}