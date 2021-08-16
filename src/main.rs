use std::io;

mod record;
use record::Record;

fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut r = Record::new("data/40014.raw");
    r.load();
    print!("{}\n", r.eoh);
    print!("{}\n", r.sample_rate);
    r.readnext();


    Ok(())
}