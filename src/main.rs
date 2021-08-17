use std::io;
use std::time::Instant;

mod record;
use record::Record;

fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut r = Record::new("data/40014.raw".to_string());
    let now = Instant::now();
    r.load();
    println!("Loading Data - Time elapsed : {}", now.elapsed().as_secs());
    println!("{}",r.sample_rate);
    println!("{}",r.adczero);
    println!("{}",r.el);
    println!("{}",r.streams);
    r.filter(200);
    println!("Filtering - Time elapsed : {}", now.elapsed().as_secs());


    Ok(())
}