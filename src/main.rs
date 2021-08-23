#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use] extern crate rocket;
use rocket::State;
use rocket::response::NamedFile;
use rocket::response::status::NotFound;
use std::path::Path;

use serde_json::json;

use std::time::Instant;
use std::env;

mod record;
use record::Record;

#[get("/electrode/e/<n>")]
fn electrode(r: State<Record>, n: usize) -> String {
    let el = r.electrodes[n].to_vec();
    let j = json!(el);
    return j.to_string();
}

#[get("/electrode/e/<n>/timeslice/<s>")]
fn timeslice(r: State<Record>, n: usize, s: u64) -> String {
    let el = r.timeslice("e", s, n);
    let j = json!(el);
    return j.to_string();
}

#[get("/electrode/f/<n>")]
fn felectrode(r: State<Record>, n: usize) -> String {
    let el = r.efilter(n);
    let j = json!(el);
    return j.to_string();
}

#[get("/electrode/f/<n>/timeslice/<s>")]
fn ftimeslice(r: State<Record>, n: usize, s: u64) -> String {
    let el = r.timeslice("f", s, n);
    let j = json!(el);
    return j.to_string();
}

#[get("/electrode/s/<n>")]
fn selectrode(r: State<Record>, n: usize) -> String {
    let el = r.espiker(n);
    let j = json!(el);
    return j.to_string();
}

#[get("/samplerate")]
fn samplerate(r: State<Record>) -> String {
    return r.sample_rate.to_string();
}

#[get("/duration")]
fn duration(r: State<Record>) -> String {
    return r.duration.to_string();
}

#[get("/stimstart/<n>")]
fn stimstart(r: State<Record>, n: usize) -> String {
    return r.stimstart(n).to_string();
}

#[get("/js/<f>")]
fn js(f: String) -> Result<NamedFile, NotFound<String>> {
    let path = Path::new("js/").join(f);
    println!("{:?}",path);
    NamedFile::open(&path).map_err(|e| NotFound(e.to_string()))
}

#[get("/config")]
fn config() -> Result<NamedFile, NotFound<String>> {
    let path = Path::new("config.json");
    NamedFile::open(&path).map_err(|e| NotFound(e.to_string()))
}

#[get("/favicon.ico")]
fn favicon() -> Result<NamedFile, NotFound<String>> {
    let path = Path::new("public/favicon.ico");
    NamedFile::open(&path).map_err(|e| NotFound(e.to_string()))
}

#[get("/")]
fn index() -> Result<NamedFile, NotFound<String>> {
    let path = Path::new("public/index.htm");
    NamedFile::open(&path).map_err(|e| NotFound(e.to_string()))
}

fn main() {
    let args: Vec<String> = env::args().collect();
    println!("RSpiker launch on {}", args[1]);
    let mut r = Record::new(args[1].to_string());
    let now = Instant::now();
    println!("Loading data...");
    r.load();
    println!("Loading Data - Time elapsed : {}", now.elapsed().as_secs());
    rocket::ignite()
        .manage(r)
        .mount("/", routes![index,favicon,js,config,electrode,felectrode,selectrode,samplerate,duration,timeslice,ftimeslice,stimstart])
        .launch();
}