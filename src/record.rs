extern crate file_utils;
extern crate serde;

use std::io;
use std::fs::File;
use std::str;
use std::io::Read;
use std::io::Seek;
use std::io::SeekFrom;

use serde::{Serialize,Deserialize};

use realfft::RealFftPlanner;

mod mcd;
use mcd::{MCDFile};
mod math;
use math::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub fc: u64,
    pub threshold: f64,
    pub timewidth: u64,
    pub stimduration: u64,
    pub map_mea: Vec<u64>
}

impl Config {
    pub const fn new() -> Config{
        let m = Vec::new();
        return Config{fc: 0, threshold: 0.0, timewidth: 0, stimduration: 0, map_mea: m};
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
    pub adczero: u64,
    pub el: f64,
    pub streams: u64
}

impl Fileparam {
    pub const fn empty() -> Fileparam{
        let filepath: String = String::new();
        return Fileparam{filepath, sample_rate: 0, adczero: 0, el: 0.0, streams: 0};
    }

    /*pub fn load(&mut self, filepath: String){
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
    }*/
}

#[derive(Clone)]
pub struct Electrode {
    pub sample_rate: u64,
    pub start: f64,
    pub stimstart: f64,
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
        return Electrode{sample_rate, start: 0.0, stimstart: 0.0, raw,filtered,spikesorted,heatmapped, status};
    }

    pub fn set_start(&mut self, s: f64){
        self.start = s;
        self.status.reset();
    }

    fn subraw(&self) -> Vec<f64>{
        if self.start != 0.0 {
            let s = (self.start * (self.sample_rate as f64)).floor() as usize;
            return self.raw[s..].to_vec();
        }
        else {
            return self.raw.to_vec();
        }
    }

    fn threshold(&self) -> f64{
        let mut factor = 0.0;
        //let mut threshold = 0.0;
        unsafe{
            factor = CONFIG.threshold;
        }
        /*if factor == 0.0 {
            threshold = 500.0 * self.median() / 0.6745;
        }
        else{
            threshold = factor * self.stddev();
        }
        return threshold.abs();*/
        return factor;
    }

    fn stddev(&self) -> f64 {
        return stddev(&self.filtered);
    }

    fn avg(&self) -> f64{
        return avg(&self.filtered);
    }

    fn median(&self) -> f64 {
        return median(&self.filtered);
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

        let e = self.subraw();
        let mut fe = self.subraw();

        for k in 1..fe.len() {
            let x = e[k];
            let ykm1 = fe[k-1];
            let xkm1 = e[k-1];
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

        let kstart = (self.stimstart * self.sample_rate as f64) as usize;
        let med = median(&fe[0..kstart].to_vec());
        let mad = mad(&fe[0..kstart].to_vec());

        se[0] = 0.0;

        for k in 1..se.len() {
            // Y m-1
            let ym1 = fe[k-1];
            let y = fe[k];
            let tup = med + threshold * mad;
            let tdown = med - threshold * mad;

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

    /*pub fn heatmap(&mut self){
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
    }*/

    pub fn heatmap(&mut self){
        if !self.status.filtered {
            self.filter()
        }
        let fe = self.filtered.to_vec();
        let mut hme = fe.to_vec();

        let kstart = (self.stimstart * self.sample_rate as f64) as usize;
        let med = median(&fe[0..kstart].to_vec());
        let mad = mad(&fe[0..kstart].to_vec());

        for k in 0..hme.len() {
            let v = (self.filtered[k] - med) / mad;
            hme[k] = v.round();
        }

        self.heatmapped = hme;
        self.status.heatmapped = true;
    }

    pub fn slice(&mut self, m: &str, k: usize, k1: usize) -> Vec<f64> {
        let mut e: Vec<f64> = Vec::new();
        let mut k2: usize = 0;
        let re = self.subraw();
        if k1 > re.len() {
            k2 = re.len();
        }
        else{
            k2 = k1;
        }
        if m == "e"{
            e = re[k..k2].to_vec();
        }
        else if m == "f" {
            if !self.status.filtered {
                self.filter()
            }
            e = self.filtered[k..k2].to_vec();
        }
        else if m == "s" {
            if !self.status.spikesorted {
                self.spikesort();
            }
            e = self.spikesorted[k..k2].to_vec();
        }
        else if m == "hm" {
            if !self.status.heatmapped {
                self.heatmap();
            }
            e = self.heatmapped[k..k2].to_vec();
        }
        else if m == "sp" {
            e = self.spectrum(k, k1);
        }
        return e;
    }

    pub fn spectrum(&mut self, k: usize, k1: usize) -> Vec<f64>{
        let mut e = self.slice("e",k,k1);

        let mut rp = RealFftPlanner::<f64>::new();
        let fft = rp.plan_fft_forward(e.len());

        let mut spectrum = fft.make_output_vec();
        fft.process(&mut e, &mut spectrum).unwrap();

        let mut r: Vec<f64> = Vec::new();

        for i in 0..spectrum.len() {
            r.push(spectrum[i].norm());
        }

        return r;
    }

    pub fn stimstart(&self) -> f64 {
        let e = &self.subraw();
        let mut stimstart = 0;
        for k in 0..e.len(){
            if e[k] > 60000.0{
                stimstart = k;
                break;
            }
        }
        return stimstart as f64 / self.sample_rate as f64;
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

    pub fn reset(&mut self){
        self.filtered = false;
        self.spikesorted = false;
        self.heatmapped = false;
    }
}

#[derive(Clone)]
pub struct Record {
    pub filepath: String,
    pub mcd: MCDFile,
    pub fileparam: Fileparam,
    pub duration: f64,
    pub electrodes: Vec<Electrode>
}

impl Record {
    pub fn new(filepath: String) -> Record {
        unsafe {
            CONFIG = Config::get();
        }
        let mut mcd = MCDFile::new(filepath.to_string());
        let electrodes: Vec<Electrode> = Vec::new();
        let fileparam: Fileparam = Fileparam::empty();
        return Record{ filepath, mcd, fileparam, duration: 0.0, electrodes };
    }

    pub const fn empty() -> Record {
        let filepath: String = String::new();
        let mcd = MCDFile::empty();
        let fileparam: Fileparam = Fileparam::empty();
        let electrodes: Vec<Electrode> = Vec::new();
        return Record{ filepath, mcd, fileparam, duration: 0.0, electrodes };
    }

    pub fn load(&mut self){
        self.mcd.load_file();
        self.loadfileparam();
        self.loaddata();
    }

    fn loadfileparam(&mut self){
        self.fileparam.filepath = self.filepath.to_string();
        self.fileparam.sample_rate = self.mcd.sampling_rate() as u64;
        //Fileparam ADC zero
        //Fileparam El
        self.fileparam.streams = self.mcd.channel_count() as u64;
    }

    fn loaddata(&mut self){
        let bin = self.mcd.read();
        self.electrodes = vec![Electrode::new(self.fileparam.sample_rate);self.fileparam.streams as usize];
        /*let mut k = 0;
        while k+1+2*256 < bin.len() {
            for n in 0..self.fileparam.streams {
                self.electrodes[n as usize].raw.push((((bin[k] as i16) << 8) | bin[k+1] as i16) as f64);
                k += 2;
            }
        }*/
        let mut k = 0;
        while k < bin.len() {
            for n in 0..self.fileparam.streams {
                self.electrodes[n as usize].raw.push(bin[k] as f64);
                k += 1;
            }
        }
        self.duration = self.mcd.time_span();
        self.stimstart();
    }

    /*pub fn load(&mut self){
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
    }*/

    pub fn set_start(&mut self, s: f64){
        for k in 0..self.electrodes.len() {
            self.electrodes[k].set_start(s);
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

    pub fn timeslice(&mut self,m: &str, s: u64, n: usize) -> Vec<f64>{
        let (k,k1) = self.stok(s);
        return self.electrodes[n].slice(m,k,k1);
    }

    pub fn stimstart(&mut self) -> f64 {
        let sstart = self.electrodes[126].stimstart();
        for i in 0..self.electrodes.len() {
            self.electrodes[i].stimstart = sstart;
        }
        return sstart;
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
        println!("input {:?}",c);
        unsafe{
            CONFIG = c;
            println!("new {:?}",CONFIG);
        }
    }

    pub fn getconfig(&self) -> Config {
        unsafe{
            return CONFIG.clone();
        }
    }
    
    pub fn stok(&self, s: u64) -> (usize,usize){
        let mut timewidth = 0;
        unsafe {
            timewidth = CONFIG.timewidth;
        }
        let k = (s * timewidth * self.fileparam.sample_rate) as usize;
        let k1 = ((s + 1) * timewidth * self.fileparam.sample_rate) as usize;
        return (k,k1);
    }
}

/*pub fn progress(first: bool, n:u64,t:u64){
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
}*/