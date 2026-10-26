//! Local demonstration-data kernels. No network, I/O, clocks or benchmark claims.
use std::ptr::{addr_of, addr_of_mut};
const CAP: usize = 32768;
static mut INPUT: [f64; CAP] = [0.0; CAP];
static mut OUTPUT: [f64; CAP] = [0.0; CAP];
#[no_mangle]
pub extern "C" fn input_ptr() -> *mut f64 {
    addr_of_mut!(INPUT).cast()
}
#[no_mangle]
pub extern "C" fn output_ptr() -> *const f64 {
    addr_of!(OUTPUT).cast()
}
#[no_mangle]
pub extern "C" fn capacity() -> usize {
    CAP
}
fn random(state: &mut u32) -> f64 {
    *state = state.wrapping_mul(1664525).wrapping_add(1013904223);
    (*state as f64) / (u32::MAX as f64)
}

/// Six columns: x, value, comparison, group, angle, weight. Stable by seed/frame.
#[no_mangle]
pub extern "C" fn generate(seed: u32, n: usize, phase: f64) -> usize {
    let n = n.min(CAP / 6);
    let mut rng = seed.max(1);
    let phase = if phase.is_finite() { phase } else { 0.0 };
    for i in 0..n {
        let x = i as f64 / n.max(1) as f64;
        let a = random(&mut rng);
        let b = random(&mut rng);
        let y = 40.0 + 22.0 * (x * 13.0 + phase).sin() + 15.0 * a + x * 30.0;
        unsafe {
            OUTPUT[i * 6] = x;
            OUTPUT[i * 6 + 1] = y;
            OUTPUT[i * 6 + 2] = 42.0 + 18.0 * (x * 10.0 - phase * 0.7).cos() + b * 18.0;
            OUTPUT[i * 6 + 3] = (i % 6) as f64;
            OUTPUT[i * 6 + 4] = a * std::f64::consts::TAU;
            OUTPUT[i * 6 + 5] = 2.0 + b * 18.0;
        }
    }
    n
}
#[no_mangle]
pub extern "C" fn moving_average(n: usize, window: usize) -> usize {
    let n = n.min(CAP);
    let window = window.clamp(1, CAP);
    let mut sum = 0.0;
    for i in 0..n {
        unsafe {
            sum += INPUT[i];
            if i >= window {
                sum -= INPUT[i - window];
            }
            OUTPUT[i] = sum / (i + 1).min(window) as f64;
        }
    }
    n
}
/// Rolling population mean and standard deviation, interleaved.
#[no_mangle]
pub extern "C" fn rolling_bands(n: usize, window: usize) -> usize {
    let n = n.min(CAP / 2);
    let window = window.clamp(1, CAP);
    let (mut sum, mut squares) = (0.0, 0.0);
    for i in 0..n {
        unsafe {
            sum += INPUT[i];
            squares += INPUT[i] * INPUT[i];
            if i >= window {
                sum -= INPUT[i - window];
                squares -= INPUT[i - window] * INPUT[i - window];
            }
            let count = (i + 1).min(window) as f64;
            let mean = sum / count;
            OUTPUT[i * 2] = mean;
            OUTPUT[i * 2 + 1] = (squares / count - mean * mean).max(0.0).sqrt();
        }
    }
    n
}
#[no_mangle]
pub extern "C" fn histogram(n: usize, bins: usize, min: f64, max: f64) -> usize {
    let bins = bins.clamp(1, 512);
    unsafe {
        for i in 0..bins {
            OUTPUT[i] = 0.0;
        }
    }
    if !min.is_finite() || !max.is_finite() || max <= min {
        return 0;
    }
    for i in 0..n.min(CAP) {
        let v = unsafe { INPUT[i] };
        if v.is_finite() && v >= min && v <= max {
            let b = (((v - min) / (max - min) * bins as f64) as usize).min(bins - 1);
            unsafe {
                OUTPUT[b] += 1.0;
            }
        }
    }
    bins
}
#[no_mangle]
pub extern "C" fn kde(n: usize, bandwidth: f64, min: f64, max: f64) -> usize {
    let n = n.min(CAP);
    if n == 0
        || bandwidth <= 0.0
        || !bandwidth.is_finite()
        || !min.is_finite()
        || !max.is_finite()
        || max <= min
    {
        return 0;
    }
    for i in 0..128 {
        let x = min + (max - min) * i as f64 / 127.0;
        let mut density = 0.0;
        for j in 0..n {
            let v = unsafe { INPUT[j] };
            if v.is_finite() {
                let u = (x - v) / bandwidth;
                density += (-0.5 * u * u).exp();
            }
        }
        unsafe {
            OUTPUT[i * 2] = x;
            OUTPUT[i * 2 + 1] =
                density / (n as f64 * bandwidth * (2.0 * std::f64::consts::PI).sqrt());
        }
    }
    128
}
#[no_mangle]
pub extern "C" fn quantiles(n: usize) -> usize {
    let mut values: Vec<f64> = (0..n.min(CAP))
        .map(|i| unsafe { INPUT[i] })
        .filter(|v| v.is_finite())
        .collect();
    if values.is_empty() {
        return 0;
    }
    values.sort_by(f64::total_cmp);
    for (i, q) in [0.0, 0.25, 0.5, 0.75, 1.0].iter().enumerate() {
        let p = q * (values.len() - 1) as f64;
        let lo = p.floor() as usize;
        let hi = p.ceil() as usize;
        unsafe {
            OUTPUT[i] = values[lo] + (values[hi] - values[lo]) * (p - lo as f64);
        }
    }
    5
}
/// Positions followed by edge index pairs. One bounded repulsion/spring step.
#[no_mangle]
pub extern "C" fn force_step(n: usize, links: usize, step: f64) -> usize {
    let n = n.min(256);
    let links = links.min((CAP - n * 2) / 2);
    let step = if step.is_finite() {
        step.clamp(0.0, 0.1)
    } else {
        0.0
    };
    for i in 0..n {
        let x = unsafe { INPUT[2 * i] };
        let y = unsafe { INPUT[2 * i + 1] };
        let mut fx = (0.5 - x) * 0.12;
        let mut fy = (0.5 - y) * 0.12;
        for j in 0..n {
            if i != j {
                let dx = x - unsafe { INPUT[2 * j] };
                let dy = y - unsafe { INPUT[2 * j + 1] };
                let d = (dx * dx + dy * dy).max(0.0005);
                fx += dx * 0.0003 / d;
                fy += dy * 0.0003 / d;
            }
        }
        for e in 0..links {
            let a = unsafe { INPUT[2 * n + e * 2] } as usize;
            let b = unsafe { INPUT[2 * n + e * 2 + 1] } as usize;
            if a >= n || b >= n {
                continue;
            }
            let j = if a == i {
                b
            } else if b == i {
                a
            } else {
                continue;
            };
            let dx = unsafe { INPUT[2 * j] } - x;
            let dy = unsafe { INPUT[2 * j + 1] } - y;
            let d = (dx * dx + dy * dy).sqrt().max(0.001);
            let f = (d - 0.13) * 1.1;
            fx += dx / d * f;
            fy += dy / d * f;
        }
        unsafe {
            OUTPUT[2 * i] = (x + fx * step).clamp(0.02, 0.98);
            OUTPUT[2 * i + 1] = (y + fy * step).clamp(0.02, 0.98);
        }
    }
    n
}
#[no_mangle]
pub extern "C" fn nearest(n: usize, x: f64, y: f64) -> i32 {
    if !x.is_finite() || !y.is_finite() {
        return -1;
    }
    let mut best = -1;
    let mut dist = f64::INFINITY;
    for i in 0..n.min(CAP / 2) {
        let dx = unsafe { INPUT[i * 2] } - x;
        let dy = unsafe { INPUT[i * 2 + 1] } - y;
        let d = dx * dx + dy * dy;
        if d < dist {
            dist = d;
            best = i as i32;
        }
    }
    best
}
#[no_mangle]
pub extern "C" fn predator_prey(n: usize, dt: f64) -> usize {
    let n = n.min(CAP / 3);
    let dt = if dt.is_finite() {
        dt.clamp(0.001, 0.05)
    } else {
        0.01
    };
    let (mut prey, mut predator) = (1.2, 0.8);
    for i in 0..n {
        unsafe {
            OUTPUT[3 * i] = i as f64 * dt;
            OUTPUT[3 * i + 1] = prey;
            OUTPUT[3 * i + 2] = predator;
        }
        let dx = prey * (1.2 - predator);
        let dy = predator * (prey - 1.0);
        prey = (prey + dt * dx).max(0.0);
        predator = (predator + dt * dy).max(0.0);
    }
    n
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deterministic_and_bounded() {
        assert_eq!(generate(42, 100, 0.0), 100);
        let a = unsafe { OUTPUT[43] };
        generate(42, 100, 0.0);
        assert_eq!(unsafe { OUTPUT[43] }, a);
        assert_eq!(generate(1, usize::MAX, f64::NAN), CAP / 6);
    }
    #[test]
    fn statistics_and_controls() {
        unsafe {
            INPUT[..5].copy_from_slice(&[1.0, 2.0, 3.0, 4.0, 5.0]);
        }
        moving_average(5, 2);
        assert_eq!(unsafe { OUTPUT[4] }, 4.5);
        quantiles(5);
        assert_eq!(unsafe { OUTPUT[2] }, 3.0);
        histogram(5, 2, 1.0, 5.0);
        assert_eq!(unsafe { OUTPUT[0] + OUTPUT[1] }, 5.0);
        assert_eq!(histogram(5, 2, 5.0, 1.0), 0);
        assert_eq!(kde(5, 0.0, 0.0, 1.0), 0);
        assert_eq!(quantiles(0), 0);
        assert_eq!(nearest(0, 0.0, 0.0), -1);
    }
    #[test]
    fn simulation_is_finite() {
        predator_prey(4096, 0.02);
        for i in 0..4096 * 3 {
            assert!(unsafe { OUTPUT[i] }.is_finite());
        }
        unsafe {
            INPUT[..8].copy_from_slice(&[0.3, 0.4, 0.5, 0.7, 0.0, 1.0, 99.0, 0.0]);
        }
        force_step(2, 2, 0.02);
        for i in 0..4 {
            assert!((0.0..=1.0).contains(&unsafe { OUTPUT[i] }));
        }
    }
}
