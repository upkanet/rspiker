use std::io;
use std::fs::File;
use std::str;
use std::io::SeekFrom;

pub struct Record {
    pub filepath: &'static str,
    pub sample_rate: u64
}

impl Record {
    pub fn new(filepath: &'static str) -> Record {
        let sample_rate = 42;
        return Record{ filepath, sample_rate };
    }

    pub fn findeoh(& self) -> u64
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
        return n;
    }
}