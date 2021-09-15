#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use] extern crate rocket;

use rocket::State;
use rocket::response::NamedFile;
use rocket::response::status::NotFound;
use std::path::Path;

use serde_json::json;

use std::time::Instant;

use wfd::{DialogParams};

mod record;
use record::Record;

#[get("/electrode/<m>/<n>")]
fn electrode(r: State<Record>, m: String, n: usize) -> String {
    let mut el:Vec<f64> = Vec::new();
    if m == "e"{
        el = r.electrodes[n].raw.to_vec();
    }
    else if m == "f" {
        el = r.electrodes[n].filtered.to_vec();
    }
    else if m == "s" {
        el = r.electrodes[n].spikesorted.to_vec();
    }
    let j = json!(el);
    return j.to_string();
}

#[get("/electrode/<m>/<n>/timeslice/<s>")]
fn timeslice(r: State<Record>, m: String, n: usize, s: u64) -> String {
    let el = r.timeslice(m.as_str(), s, n);
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
    let params = DialogParams {
        title: "Axorus Rspiker - Select a .raw file",
        file_types: vec![("MCD raw", "*.raw")],
        file_type_index: 1,
        default_extension: "raw",
        ..Default::default()
    };
    let dialog_result = wfd::open_dialog(params).expect("Open Dialog Error");
    let fpath = dialog_result.selected_file_paths[0].to_str().unwrap();
    println!("RSpiker launch on {}", fpath);
    let mut r = Record::new(fpath.to_string());
    let now = Instant::now();
    println!("Loading Data...");
    r.load();
    println!("Loading Data - Time elapsed : {}", now.elapsed().as_secs());
    println!("Filtering Data...");
    r.filter();
    println!("Filtering Data - Time elapsed : {}", now.elapsed().as_secs());
    println!("SpikeSort Data...");
    r.spikersort();
    println!("SpikeSorting Data - Time elapsed : {}", now.elapsed().as_secs());
    println!("HeatMap Data...");
    r.heatmap();
    println!("HeatMapped Data - Time elapsed : {}", now.elapsed().as_secs());
    rocket::ignite()
        .manage(r)
        .attach(rocket::fairing::AdHoc::on_launch("Open Browser", |_x| {
            if webbrowser::open("http://localhost:8000/").is_ok() {
                println!("Open web browser");
            }
            return ();
        }))
        .mount("/", routes![index,favicon,js,config,electrode,samplerate,duration,timeslice,stimstart])
        .launch();
}