#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use] extern crate rocket;

use rocket::response::NamedFile;
use rocket::response::status::NotFound;
use std::path::Path;

use serde_json::json;

use std::time::Instant;

use wfd::{DialogParams};

mod record;
use record::Record;

static mut R: Record = Record::empty();

#[get("/electrode/<m>/<n>")]
fn electrode(m: String, n: usize) -> String {
    unsafe{
        let el = R.full(m.as_str(), n);
        let j = json!(el);
        return j.to_string();
    }
}

#[get("/electrode/<m>/<n>/timeslice/<s>")]
fn timeslice(m: String, n: usize, s: u64) -> String {
    unsafe{
        let el = R.timeslice(m.as_str(), s, n);
        let j = json!(el);
        return j.to_string();
    }
}

#[get("/clearcache/<m>")]
fn clearcache(m: String) -> String {
    unsafe{
        R.clearcache(m.as_str());
        let j = json!(m+":false");
        return j.to_string();
    }
}

#[get("/samplerate")]
fn samplerate() -> String {
    unsafe{
        return R.fileparam.sample_rate.to_string();
    }
}

#[get("/duration")]
fn duration() -> String {
    unsafe {
        return R.duration.to_string();
    }
}

#[get("/stimstart/<n>")]
fn stimstart(n: usize) -> String {
    unsafe{
        return R.stimstart(n).to_string();
    }
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
    let now = Instant::now();
    unsafe {
        R = Record::new(fpath.to_string());
        println!("Loading Data...");
        R.load();
        println!("Loading Data - Time elapsed : {}", now.elapsed().as_secs());
    }
    rocket::ignite()
        .attach(rocket::fairing::AdHoc::on_launch("Open Browser", |_x| {
            if webbrowser::open("http://localhost:8000/").is_ok() {
                println!("Open web browser");
            }
            return ();
        }))
        .mount("/", routes![index,favicon,js,config,electrode,samplerate,duration,timeslice,clearcache,stimstart])
        .launch();
}