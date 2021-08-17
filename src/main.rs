use std::io;

mod record;
use record::Record;

fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut r = Record::new("data/40014.raw".to_string());
    r.load();
    println!("{}",r.sample_rate);
    println!("{}",r.adczero);
    println!("{}",r.el);
    println!("{}",r.streams);


    Ok(())
}