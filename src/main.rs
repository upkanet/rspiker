#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use] extern crate rocket;

use rocket::fs::NamedFile;
use rocket::serde::json::{json,Json};
use rocket::fairing::AdHoc;
use std::path::Path;

use std::time::Instant;

use wfd::{DialogParams};

mod record;
use record::{Record,Config};

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

#[get("/spectrum/<n>/slice/<k>/<k1>")]
fn spectrum(n: usize, k: usize, k1: usize) -> String{
    unsafe{
        let s = R.electrodes[n].spectrum(k,k1);
        let j = json!(s);
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

#[get("/start")]
fn getstart() -> String{
    unsafe{
        let j = json!(R.electrodes[0].start);
        return j.to_string();
    }
}

#[post("/start/<s>")]
fn setstart(s: f64) -> String{
    unsafe{
        R.set_start(s);
        let j = json!(format!("{}",s));
        return j.to_string();
    }
}

#[post("/saveconfig", format = "json", data = "<user_config>")]
fn saveconfig(user_config: Json<Config>) -> String {
    unsafe{
        R.saveconfig(user_config.into_inner());
    }
    return json!("").to_string();
}

#[get("/config")]
fn config() -> String {
    unsafe {
        let c = R.getconfig();
        let j = json!(c);
        return j.to_string();
    }
}


#[get("/samplerate")]
fn samplerate() -> String {
    unsafe{
        return R.fileparam.sample_rate.to_string();
    }
}

#[get("/filename")]
fn filename() -> String {
    unsafe{
        return R.fileparam.filepath.to_string();
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
async fn js(f: String) -> Option<NamedFile> {
    let path = Path::new("js/").join(f);
    println!("{:?}",path);
    NamedFile::open(&path).await.ok()
}

#[get("/favicon.ico")]
async fn favicon() -> Option<NamedFile> {
    let path = Path::new("public/favicon.ico");
    NamedFile::open(&path).await.ok()
}

#[get("/")]
async fn index() -> Option<NamedFile> {
    let path = Path::new("public/index.htm");
    NamedFile::open(&path).await.ok()
}

fn prepare() {
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
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>{
    rocket::build()
        .attach(AdHoc::on_ignite("Pepare data", |rocket| async move {
            prepare();
            rocket
        }))
        .attach(AdHoc::on_liftoff("Open Webbrowser", |_| Box::pin(async move {
            webbrowser::open("http://localhost:8000/").unwrap();
        })))
        .mount("/", routes![index,favicon,js,config,electrode,samplerate,filename,duration,timeslice,spectrum,clearcache,setstart,getstart,stimstart,saveconfig])
        .launch()
        .await
}