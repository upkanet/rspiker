extern crate libloading;
extern crate libc;
use std::ffi::{c_void,CString};
use std::os::raw::{c_char,c_double};
use libc::{size_t,time_t,c_ushort};

fn main() {
    let filename = "data/10011.mcd";
    let filename_c_str = CString::new(filename).unwrap();
    let c_filename: *const c_char = filename_c_str.as_ptr() as *const c_char;
    let lib = unsafe{
        let path = "mcstream_wrapper.dll";
        libloading::Library::new(path).expect("Failed to load library")
    };
    let create_file: libloading::Symbol<unsafe extern "C" fn() -> *mut c_void > = unsafe {
        lib.get(b"mcstream_create_file").expect("Failed to load function")
    };
    let load_file: libloading::Symbol<unsafe extern "C" fn(*mut c_void, *const c_char) -> u32> = unsafe {
        lib.get(b"mcstream_load_file").expect("Failed to load function")
    };
    let sampling_rate: libloading::Symbol<unsafe extern "C" fn(*mut c_void) -> c_double> = unsafe {
        lib.get(b"mcstream_sampling_rate").expect("Failed to load function")
    };
    let start_time: libloading::Symbol<unsafe extern "C" fn(*mut c_void) -> time_t> = unsafe {
        lib.get(b"mcstream_start_time").expect("Failed to load function")
    };
    let stop_time: libloading::Symbol<unsafe extern "C" fn(*mut c_void) -> time_t> = unsafe {
        lib.get(b"mcstream_stop_time").expect("Failed to load function")
    };
    let stream_count: libloading::Symbol<unsafe extern "C" fn(*mut c_void) -> size_t> = unsafe {
        lib.get(b"mcstream_stream_count").expect("Failed to load function")
    };
    let stream: libloading::Symbol<unsafe extern "C" fn(*mut c_void, size_t) -> *mut c_void> = unsafe {
        lib.get(b"mcstream_stream").expect("Failed to load function")
    };
    let channel_count: libloading::Symbol<unsafe extern "C" fn(*mut c_void) -> size_t> = unsafe {
        lib.get(b"mcstream_channel_count").expect("Failed to load function")
    };
    let time_span: libloading::Symbol<unsafe extern "C" fn(*mut c_void) -> u64> = unsafe {
        lib.get(b"mcstream_timespan_ns").expect("Failed to load function")
    };

    //file pointer, stream number, start position, end position, output pointer, buffer size
    let raw_read: libloading::Symbol<unsafe extern "C" fn(*mut c_void, size_t, size_t, size_t, *const u16, size_t) -> u64> = unsafe {
        lib.get(b"mcstream_raw_read").expect("Failed to load function")
    };

    unsafe{
        let f = create_file();
        load_file(f,c_filename);
        let sr = sampling_rate(f);
        println!("Sampling Rate {:?}",sr);
        let stime = start_time(f);
        println!("Start Time {:?}",stime);
        let sttime = stop_time(f);
        println!("Stop Time {:?}",sttime);
        let ts = time_span(f);
        println!("Time Span {:?}",ts);
        let sc = stream_count(f);
        println!("Stream Count {:?}",sc);
        let st = stream(f,1);
        let cc = channel_count(st);
        println!("Channels Count {:?}",cc);
        let mut buffer = [1 as u16;256];
        let mut pbuffer = buffer.as_mut_ptr();
        raw_read(f,1,150,1000,pbuffer,256);
        println!("{:?}",buffer);
    }
}