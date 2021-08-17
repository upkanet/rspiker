#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use] extern crate rocket;
use rocket::State;

use std::time::Instant;

mod record;
use record::Record;

#[get("/electrode/len/<e>")]
fn hello(r: State<Record>, e: String) -> String {
    let ne:usize = e.parse().unwrap();
    return r.electrodes[ne].len().to_string();
}

#[get("/")]
fn index() -> &'static str {
    "Hello, world!"
}

fn main() {
    println!("RSpiker launch");
    let mut r = Record::new("data/0.raw".to_string());
    let now = Instant::now();
    println!("Loading data...");
    r.load();
    println!("Loading Data - Time elapsed : {}", now.elapsed().as_secs());
    rocket::ignite()
        .manage(r)
        .mount("/", routes![index,hello])
        .launch();
}


/*fn main() -> io::Result<()>
{
    println!("RSpiker launch");
    let mut r = Record::new("data/90003.raw".to_string());
    let now = Instant::now();
    r.load();
    println!("Loading Data - Time elapsed : {}", now.elapsed().as_secs());
    println!("{}",r.sample_rate);
    println!("{}",r.adczero);
    println!("{}",r.el);
    println!("{}",r.streams);
    r.filter(200);
    println!("Filtering - Time elapsed : {}", now.elapsed().as_secs());
    r.spiker(-4.2);
    println!("Spikering - Time elapsed : {}", now.elapsed().as_secs());
    r.raster(2);

    Ok(())
}*/