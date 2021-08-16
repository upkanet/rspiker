extern crate file_utils;

use std::io;
use std::fs::File;

use file_utils::read::Read;

fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut file = File::open("data/40014.raw")?;
    let x: i16 = file.read_i16()?;
    print!("{}\n", x.to_string());

    Ok(())
}

pub fn bytes_to_i16(x: &[u8; 2]) -> i16
{
    ((x[1] as i16) <<  8) +
    ((x[0] as i16) <<  0)
}
