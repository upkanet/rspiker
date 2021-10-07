extern crate libloading;
extern crate libc;
use std::ffi::{c_void,CString};
use std::os::raw::{c_char,c_double};
use libc::{size_t,time_t,c_ushort};
use libloading::{Library,Symbol};

struct MCDFile {
    filename: String,
    lib: Library,
    file: *mut c_void,
    stream: *mut c_void
}

impl MCDFile {
    pub fn new(filename: String) -> MCDFile {
        let path = "mcstream_wrapper.dll";
        unsafe{
            let lib = Library::new(path).expect("Failed to load library");
            let create_file: Symbol<unsafe extern "C" fn() -> *mut c_void > = lib.get(b"mcstream_create_file").expect("Failed to load function");
            let file = create_file();
            let mut stream = std::ptr::null_mut();
            return MCDFile {filename, lib, file, stream}
        }
    }

    pub fn load_file(&mut self){
        let filename = self.filename.as_str();
        let filename_c_str = CString::new(filename).unwrap();
        let c_filename: *const c_char = filename_c_str.as_ptr() as *const c_char;
        unsafe{
            let load_file: Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> u32> = self.lib.get(b"mcstream_load_file").expect("Failed to load function");
            load_file(self.file,c_filename);
            self.load_stream();
        }
    }

    pub fn sampling_rate(&self) -> f64{
        unsafe {
            let sampling_rate: Symbol<unsafe extern "C" fn(*mut c_void) -> c_double> = self.lib.get(b"mcstream_sampling_rate").expect("Failed to load function");
            return sampling_rate(self.file);
        }
    }

    pub fn start_time(&self) -> i64{
        unsafe{
            let start_time: Symbol<unsafe extern "C" fn(*mut c_void) -> time_t> = self.lib.get(b"mcstream_start_time").expect("Failed to load function");
            return start_time(self.file);
        }
    }

    pub fn stop_time(&self) -> i64{
        unsafe{
            let stop_time: Symbol<unsafe extern "C" fn(*mut c_void) -> time_t> = self.lib.get(b"mcstream_stop_time").expect("Failed to load function");
            return stop_time(self.file);
        }
    }

    pub fn stream_count(&self) -> usize{
        unsafe{
            let stream_count: Symbol<unsafe extern "C" fn(*mut c_void) -> size_t> = self.lib.get(b"mcstream_stream_count").expect("Failed to load function");
            return stream_count(self.file);
        }
    }

    fn load_stream(&mut self){
        unsafe{
            let stream: Symbol<unsafe extern "C" fn(*mut c_void, size_t) -> *mut c_void> = self.lib.get(b"mcstream_stream").expect("Failed to load function");
            self.stream = stream(self.file,1);
        }
    }

    pub fn channel_count(&self) -> usize{
        unsafe{
            let channel_count: Symbol<unsafe extern "C" fn(*mut c_void) -> size_t> = self.lib.get(b"mcstream_channel_count").expect("Failed to load function");
            return channel_count(self.stream);
        }
    }

    pub fn time_span(&self) -> f64{
        unsafe{
            let time_span: Symbol<unsafe extern "C" fn(*mut c_void) -> u64> = self.lib.get(b"mcstream_timespan_ns").expect("Failed to load function");
            return time_span(self.file) as f64 / 1000000000.0;
        }
    }

    pub fn read(&self) -> Vec<u16>{
        unsafe{
            //file pointer, stream number, start position, end position, output pointer, buffer size
            let raw_read: libloading::Symbol<unsafe extern "C" fn(*mut c_void, size_t, size_t, size_t, *const u16, size_t) -> u64> = self.lib.get(b"mcstream_raw_read").expect("Failed to load function");
            let samples = (self.time_span() * self.sampling_rate()) as usize;
            let bsize = samples * 256;
            let mut buffer = vec!(0;bsize);
            let mut pbuffer = buffer.as_mut_ptr();
            println!("Samples {:?}",samples);
            raw_read(self.file,1,0,samples,pbuffer,bsize);
            return buffer;
        }
    }

    pub fn readf64(&self) -> Vec<f64>{
        let buffer = self.read();
        let mut bf64: Vec<f64> = Vec::new();
        for i in 0..buffer.len() {
            bf64.push(buffer[i] as f64);
        }
        return bf64;
    }

}


fn main() {
    let mut mcd = MCDFile::new("data/10011.mcd".to_string());
    mcd.load_file();
    println!("Sample Rate {:?}",mcd.sampling_rate());
    println!("Start Time {:?}",mcd.start_time());
    println!("Stop  Time {:?}",mcd.stop_time());
    println!("Stream Count {:?}",mcd.stream_count());
    println!("Channel Count {:?}",mcd.channel_count());
    println!("Time Span {:?}",mcd.time_span());
    println!("{:?}",mcd.readf64());
}