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

#[get("/electrode/f/<n>")]
fn felectrode(r: State<Record>, n: usize) -> String {
    let el = r.felectrodes[n].to_vec();
    let j = json!(el);
    return j.to_string();
}

#[get("/electrode/s/<n>")]
fn selectrode(r: State<Record>, n: usize) -> String {
    let mut r2 = r.clone();
    r2.filter();
    let el = r2.espiker(n);
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
    println!("Filtering...");
    r.filter();
    println!("Filtering - Time elapsed : {}", now.elapsed().as_secs());
    rocket::ignite()
        .manage(r)
        .mount("/", routes![index,js,felectrode,selectrode])
        .launch();
}