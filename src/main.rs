extern crate file_utils;

use std::io;
use std::fs::File;
use std::str;
use std::io::SeekFrom;

use file_utils::read::Read;

fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut file = File::open("data/40014.raw")?;

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

    Ok(())
}
