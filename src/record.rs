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
    pub header: String
}

impl Record {
    pub fn new(filepath: String) -> Record {
        return Record{ filepath , sample_rate: 0, eoh: 0, header:"".to_string() };
    }

    pub fn load(&mut self){
        self.findeoh();
        self.loadheader();
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
    }

    pub fn _readnext(& self){
        let mut file = File::open(&self.filepath).expect("Introuvable");
        io::Seek::seek(&mut file, SeekFrom::Start(self.eoh+5)).expect("No");
        
        let x: i16 = file.read_i16().expect("Introuvable");
        print!("x = {}\n", x.to_string());
        let x: i16 = file.read_i16().expect("Introuvable");
        print!("x = {}\n", x.to_string());
    }
}