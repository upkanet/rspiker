extern crate file_utils;

use std::io;
/*use std::fs::File;
use std::str;
use std::io::SeekFrom;*/

mod record;
use record::Record;

//use file_utils::read::Read;

/*struct Record {
    filepath: &'static str,
    sample_rate: u64
}

impl Record {
    fn new(filepath: &'static str) -> Record {
        let sample_rate = 0;
        return Record{ filepath, sample_rate };
    }

    fn findeoh(& self) -> u64
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
*/



fn main() -> io::Result<()>
{
    //println!("RSpiker launch");
    /*let i = findeoh();
    print!("{}\n", i);*/
    /*let mut file = File::open("data/40014.raw")?;

    //Header
    let mut buffer = [0; 168];
    io::Read::read(&mut file, &mut buffer)?;
    let s = match str::from_utf8(&buffer) {
        Ok(v) => v,
        Err(e) => panic!("Invalid UTF-8 sequence: {}", e),
    };
    print!("{}\n", s);

    io::Seek::seek(&mut file, SeekFrom::Start(170))?;
    let mut buffer = [0; 1714];
    io::Read::read(&mut file, &mut buffer)?;
    print!("{}\n", "===Seconde===");

    let s = match str::from_utf8(&buffer) {
        Ok(v) => v,
        Err(e) => panic!("Invalid UTF-8 sequence: {}", e),
    };
    print!("{}\n", s);

    let x: i16 = file.read_i16()?;
    print!("x = {}\n", x.to_string());

    let i = findEOF();
    print!("{}\n", i);*/
    let r = Record::new("data/40014.raw");
    let i = r.findeoh();
    print!("{}\n", i);
    print!("{}\n", r.sample_rate);


    Ok(())
}