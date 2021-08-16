extern crate file_utils;
use file_utils::read::Read;

use std::io;
use std::fs::File;
use std::str;
use std::io::SeekFrom;

pub struct Record {
    pub filepath: &'static str,
    pub sample_rate: u64,
    pub eoh: u64
}

impl Record {
    pub fn new(filepath: &'static str) -> Record {
        let sample_rate = 42;
        let eoh = 0;
        return Record{ filepath, sample_rate, eoh };
    }

    pub fn load(&mut self){
        self.findeoh();
    }

    pub fn findeoh(&mut self)
    {
        let mut file = File::open(self.filepath).expect("Introuvable");
        let mut buffer = [0; 3];
        let mut n = 169;
        loop {
            io::Seek::seek(&mut file, SeekFrom::Start(n)).expect("No");
            io::Read::read(&mut file, &mut buffer).expect("Introuvable");
            let s = str::from_utf8(&buffer).expect("erreur");
            n+=1;
            if s == "EOH" {
                n+=2;
                break;
            }
        }
        self.eoh = n;
    }

    pub fn readnext(& self){
        let mut file = File::open(self.filepath).expect("Introuvable");
        io::Seek::seek(&mut file, SeekFrom::Start(self.eoh+5)).expect("No");
        
        let x: i16 = file.read_i16().expect("Introuvable");
        print!("x = {}\n", x.to_string());
        let x: i16 = file.read_i16().expect("Introuvable");
        print!("x = {}\n", x.to_string());
    }
}