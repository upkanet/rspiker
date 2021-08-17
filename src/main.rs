use std::io;

mod record;
use record::Record;

fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut r = Record::new("data/40014.raw".to_string());
    r.load();
    println!("{}\n", r.eoh);
    println!("{}\n", r.sample_rate);
    println!("{}\n", r.header);


    Ok(())
}