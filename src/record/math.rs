pub fn avg(signal: &Vec<f64>) -> f64{
    let sum:f64 = signal.iter().sum();
    let avg = sum / (signal.len() as f64);
    return avg;
}

pub fn stddev(signal: &Vec<f64>) -> f64 {
    let avg = avg(&signal);
    let mut sum = 0.0;
    let n = signal.len();
    for i in 0..n {
        let v = signal[i];
        let diff = v - avg;
        sum = sum + diff * diff;
    }
    let stddev = (sum/(n as f64)).sqrt();
    return stddev;
}

pub fn median(signal: &Vec<f64>) -> f64 {
    let mut sdata = signal.to_vec();
    sdata.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mid = sdata.len() / 2;
    return sdata[mid];
}

pub fn mad(signal: &Vec<f64>) -> f64 {
    let mut ad: Vec<f64> = Vec::new();
    let med = median(&signal);
    for i in 0..signal.len() {
        //deviation from median
        let dev = signal[i] - med;
        ad.push(dev.abs());
    }
    return median(&ad);
}