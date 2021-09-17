extern crate file_utils;
extern crate serde;

use std::io;
use std::fs::File;
use std::str;
use std::io::Read;
use std::io::Seek;
use std::io::SeekFrom;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub fc: u64,
    pub threshold: f64,
    pub timewidth: u64,
    pub stimduration: u64
}

impl Config {
    pub const fn new() -> Config{
        return Config{fc: 0, threshold: 0.0, timewidth: 0, stimduration: 0};
    }

    pub fn get() -> Config{
        let mut file = File::open("config.json").expect("Unable to open the file");
        let mut contents = String::new();
        io::Read::read_to_string(&mut file, &mut contents).expect("Unable to read the file");
        let c:Config = serde_json::from_str(&contents).expect("JSON was not well-formatted");
        return c;
    }
}

static mut CONFIG: Config = Config::new();

#[derive(Clone)]
pub struct Fileparam {
    pub filepath: String,
    pub sample_rate: u64,
    pub eoh: u64,
    pub datastart: u64,
    pub header: String,
    pub adczero: u64,
    pub el: f64,
    pub streams: u64
}

impl Fileparam {
    pub const fn empty() -> Fileparam{
        let filepath: String = String::new();
        let header: String = String::new();
        return Fileparam{filepath, sample_rate: 0, eoh: 0, datastart: 0, header, adczero: 0, el: 0.0, streams: 0};
    }

    pub fn load(&mut self, filepath: String){
        self.filepath = filepath;
        self.findeoh();
        self.loadheader();
    }

    pub fn findeoh(&mut self)
    {
        let mut file = File::open(&self.filepath).expect("Introuvable");
        let mut buffer = [0; 3];
        let mut n = 0;
        loop {
            io::Seek::seek(&mut file, SeekFrom::Start(n)).expect("No");
            io::Read::read(&mut file, &mut buffer).expect("Introuvable");
            let s = match str::from_utf8(&buffer){
                Ok(v) => v,
                Err(_) => ""
            };
            n+=1;
            if s == "EOH" {
                n+=2;
                break;
            }
        }
        self.eoh = n;
        self.datastart = n + 5;
    }

    pub fn loadheader(&mut self){
        let mut file = File::open(&self.filepath).expect("Introuvable");
        let mut buffer = [0];
        let mut h = "".to_string();
        for _n in 0..self.eoh {
            io::Read::read(&mut file, &mut buffer).expect("Introuvable");
            let s = match str::from_utf8(&buffer){
                Ok(v) => v,
                Err(_) => ""
            };
            h.push_str(s);
        }
        self.header = h;
        self.parseheader();
    }

    pub fn parseheader(&mut self){
        self.sample_rate = self.headerfieldvalue(3).parse().unwrap();
        self.adczero = self.headerfieldvalue(4).parse().unwrap();
        let els = self.headerfieldvalue(5);
        let els = els[0..6].to_string();
        self.el = els.parse().unwrap();
        let streamss = self.headerfieldvalue(6);
        let s: Vec<&str> = streamss.split(";").collect();
        let streams = s.len();
        self.streams = streams as u64;
    }

    fn headerfieldvalue(& self,line: usize) -> String{
        let h = &self.header;
        let c: Vec<&str> = h.split("\n").collect();
        let l = c[line];
        let pos = match l.find("="){
            Some(v) => v + 2,
            None => 0
        };
        let val = l[pos..l.len()-1].to_string();
        return val;
    }
}

#[derive(Clone)]
pub struct Electrode {
    pub sample_rate: u64,
    pub raw: Vec<f64>,
    pub filtered: Vec<f64>,
    pub spikesorted: Vec<f64>,
    pub heatmapped: Vec<f64>,
    pub status: ElectrodeStatus
}

impl Electrode {
    pub fn new(sample_rate: u64) -> Electrode {
        let raw: Vec<f64> = Vec::new();
        let filtered: Vec<f64> = Vec::new();
        let spikesorted: Vec<f64> = Vec::new();
        let heatmapped: Vec<f64> = Vec::new();
        let status: ElectrodeStatus = ElectrodeStatus::new();
        return Electrode{sample_rate, raw,filtered,spikesorted,heatmapped, status};
    }

    fn threshold(&self) -> f64{
        let mut factor = 0.0;
        let mut threshold = 0.0;
        unsafe{
            factor = CONFIG.threshold;
        }
        if factor == 0.0 {
            threshold = 500.0 * self.median() / 0.6745;
        }
        else{
            threshold = factor * self.stddev();
        }
        return threshold.abs();
    }

    fn stddev(&self) -> f64 {
        let avg = self.avg();
        let mut sum = 0.0;
        let n = self.filtered.len();
        for i in 0..n {
            let v = self.filtered[i];
            let diff = v - avg;
            sum = sum + diff * diff;
        }
        let stddev = (sum/(n as f64)).sqrt();
        return stddev;
    }

    fn avg(&self) -> f64{
        let sum:f64 = self.filtered.iter().sum();
        let avg = sum / (self.filtered.len() as f64);
        return avg;
    }

    fn median(&self) -> f64 {
        let mut sdata = self.filtered.to_vec();
        sdata.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mid = sdata.len() / 2;
        return sdata[mid];
    }

    pub fn filter(&mut self) {
        let mut fc = 0;
        unsafe{
            fc = CONFIG.fc;
        }
        let pi = std::f64::consts::PI;
        let rc = 1.0/(2.0 * pi * fc as f64);
        let dt = 1.0 / self.sample_rate as f64;
        let alpha = rc / (rc + dt);

        let mut fe = self.raw.to_vec();

        for k in 1..fe.len() {
            let x = self.raw[k];
            let ykm1 = fe[k-1];
            let xkm1 = self.raw[k-1];
            let yk = alpha * (ykm1 + x - xkm1);
            fe[k] = yk;
        }

        self.filtered = fe;
        self.status.filtered = true;
    }

    pub fn spikesort(&mut self){
        if !self.status.filtered {
            self.filter();
        }
        let threshold = self.threshold();
        let fe = self.filtered.to_vec();
        let mut se = fe.to_vec();
        let avg = self.avg();

        se[0] = 0.0;

        for k in 1..se.len() {
            // Y m-1
            let ym1 = fe[k-1];
            let y = fe[k];
            let tup = avg + threshold;
            let tdown = avg - threshold;

            // Asc front
            if (ym1 <= tup) && (y > tup){
                se[k] = 1.0;
            }
            // Desc front
            else if (ym1 >= tdown) && (y < tdown){
                se[k] = -1.0;
            }
            else{
                se[k] = 0.0;
            }
        }

        self.spikesorted = se;
        self.status.spikesorted = true;
    }

    pub fn heatmap(&mut self){
        if !self.status.filtered {
            self.filter()
        }
        let avg = self.avg();
        let stddev = self.stddev();

        let mut hme = vec![0.0;self.filtered.len()];

        for k in 0..hme.len() {
            let v = (self.filtered[k] - avg) / stddev;
            hme[k] = v.round();
        }

        self.heatmapped = hme;
        self.status.heatmapped = true;
    }
}

#[derive(Clone, Copy)]
pub struct ElectrodeStatus {
    pub filtered: bool,
    pub spikesorted: bool,
    pub heatmapped: bool
}

impl ElectrodeStatus {
    pub const fn new() -> ElectrodeStatus{
        ElectrodeStatus{ filtered: false, spikesorted: false, heatmapped: false}
    }
}

#[derive(Clone)]
pub struct Record {
    pub filepath: String,
    pub fileparam: Fileparam,
    pub duration: f64,
    pub electrodes: Vec<Electrode>
}

impl Record {
    pub fn new(filepath: String) -> Record {
        unsafe {
            CONFIG = Config::get();
        }
        let electrodes: Vec<Electrode> = Vec::new();
        let fileparam: Fileparam = Fileparam::empty();
        return Record{ filepath, fileparam, duration: 0.0, electrodes };
    }

    pub const fn empty() -> Record {
        let filepath: String = String::new();
        let fileparam: Fileparam = Fileparam::empty();
        let electrodes: Vec<Electrode> = Vec::new();
        return Record{ filepath, fileparam, duration: 0.0, electrodes };
    }

    

    pub fn load(&mut self){
        self.loadfileparam();
        self.loaddata();
    }
    
    fn loadfileparam(&mut self){
        self.fileparam.load(self.filepath.to_string());
    }

    pub fn loaddata(&mut self){
        let mut file = File::open(&self.filepath).expect("Introuvable");
        file.seek(SeekFrom::Start(self.fileparam.datastart)).expect("No");
        let metadata = file.metadata().expect("No");
        let bytes = metadata.len() - self.fileparam.datastart; //File length minus header
        self.duration = bytes as f64 / 2.0 / self.fileparam.sample_rate as f64 / self.fileparam.streams as f64; // divided by 2 because 2 x u8 = 1 x i16
        let mut buffer = vec!(0;bytes as usize);
        file.read(&mut buffer).expect("Pb");
        self.bin2electrode(buffer);
    }
    
    fn bin2electrode(&mut self, bin: Vec<u8>){
        self.electrodes = vec![Electrode::new(self.fileparam.sample_rate);self.fileparam.streams as usize];
        let mut k = 0;
        while k+1+2*256 < bin.len() {
            for n in 0..self.fileparam.streams {
                self.electrodes[n as usize].raw.push((((bin[k] as i16) << 8) | bin[k+1] as i16) as f64);
                k += 2;
            }
        }
    }

    pub fn full(&mut self, m: &str,n: usize) -> Vec<f64>{
        let mut el: Vec<f64> = Vec::new();
        if m == "e"{
            el = self.electrodes[n].raw.to_vec();
        }
        else if m == "f" {
            if !self.electrodes[n].status.filtered {
                self.electrodes[n].filter()
            }
            el = self.electrodes[n].filtered.to_vec();
        }
        else if m == "s" {
            if !self.electrodes[n].status.spikesorted {
                self.electrodes[n].spikesort();
            }
            el = self.electrodes[n].spikesorted.to_vec();
        }
        else if m == "hm" {
            if !self.electrodes[n].status.heatmapped {
                self.electrodes[n].heatmap();
            }
            el = self.electrodes[n].heatmapped.to_vec();
        }
        return el;
    }

    pub fn timeslice(&self,m: &str, s: u64, n: usize) -> Vec<f64>{
        let mut timewidth = 0;
        unsafe {
            timewidth = CONFIG.timewidth;
        }
        let k = (s * timewidth * self.fileparam.sample_rate) as usize;
        let mut k2 = ((s + 1) * timewidth * self.fileparam.sample_rate) as usize;
        let mut el:Electrode = self.electrodes[n].clone();
        let mut el2: Vec<f64> = Vec::new();
        if m == "e"{
            el2 = el.raw.to_vec();
        }
        else if m == "f" {
            if !el.status.filtered {
                el.filter()
            }
            el2 = el.filtered.to_vec();
        }
        else if m == "s" {
            if !el.status.spikesorted {
                el.spikesort();
            }
            el2 = el.spikesorted.to_vec();
        }
        else if m == "hm" {
            if !el.status.heatmapped {
                el.heatmap();
            }
            el2 = el.heatmapped.to_vec();
        }
        if k2 > el2.len(){
            k2 = el2.len();
        }
        return el2[k..k2].to_vec();
    }

    pub fn stimstart(&self, n:usize) -> f64 {
        let e = &self.electrodes[n].raw;
        let mut stimstart = 0;
        for k in 0..e.len(){
            if e[k] < -250.0{
                stimstart = k;
                break;
            }
        }
        return stimstart as f64 / self.fileparam.sample_rate as f64;
    }

    pub fn clearcache(&mut self,m: &str){
        unsafe {
            CONFIG = Config::get();
        }
        if m == "f" {
            self.electrodes.iter_mut().for_each(|e| e.status.filtered = false);
        }
        else if m == "s" {
            self.electrodes.iter_mut().for_each(|e| e.status.spikesorted = false);
        }
        else if m == "hm" {
            self.electrodes.iter_mut().for_each(|e| e.status.heatmapped = false);
        }
    }

    pub fn saveconfig(&self, c: Config){
        unsafe{
            CONFIG = c;
        }
    }
}

pub fn progress(first: bool, n:u64,t:u64){
    if first{
        print!("{}",(1..100).map(|_| "-").collect::<String>());
    }
    else {
        print!("\x1B[F");
        let p = 100 * n / t;
        for _k in 0..p{
            print!("■");
        }
    }
    print!("\n");
}