#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use] extern crate rocket;
use rocket::State;
use rocket::response::NamedFile;
use rocket::response::status::NotFound;
use std::path::Path;

use serde_json::json;

use std::time::Instant;

mod record;
use record::Record;

#[get("/electrode/<e>")]
fn electrode(r: State<Record>, e: String) -> String {
    let ne:usize = e.parse().unwrap();
    let el = r.electrodes[ne].to_vec();
    let j = json!(el);
    return j.to_string();
}

#[get("/js/<f>")]
fn js(f: String) -> Result<NamedFile, NotFound<String>> {
    let path = Path::new("js/").join(f);
    println!("{:?}",path);
    NamedFile::open(&path).map_err(|e| NotFound(e.to_string()))
}

#[get("/")]
fn index() -> Result<NamedFile, NotFound<String>> {
    let path = Path::new("public/index.htm");
    NamedFile::open(&path).map_err(|e| NotFound(e.to_string()))
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
        .mount("/", routes![index,electrode,js])
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