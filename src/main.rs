extern crate file_utils;

use std::io;
use std::fs::File;
use std::str;
use std::io::SeekFrom;

//use file_utils::read::Read;

fn main() -> io::Result<()>
{
    //println!("RSpiker launch");
    let i = findeof();
    print!("{}\n", i);
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

    Ok(())
}

fn findeof() -> u64
{
    let mut file = File::open("data/40014.raw").expect("Introuvable");
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
