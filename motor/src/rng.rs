/* Kleine, snelle id-generator zonder externe crate. Niet cryptografisch — id's
   hoeven alleen uniek te zijn (net als crypto.randomBytes(5).hex in de Node-kern
   voor boeking-id's). Gezaaid uit de klok + een teller, xorshift eroverheen. */
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TELLER: AtomicU64 = AtomicU64::new(0);

fn nu_nanos() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0)
}

fn xorshift(mut x: u64) -> u64 {
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    x
}

/// Een id met voorvoegsel, bijv. `PB1A2B3C4D`.
pub fn id(prefix: &str) -> String {
    let n = TELLER.fetch_add(1, Ordering::Relaxed);
    let mut x = xorshift(nu_nanos() ^ (n.wrapping_mul(0x9E37_79B9_7F4A_7C15)));
    x = xorshift(x);
    format!("{}{:010X}", prefix, x & 0xFF_FFFF_FFFF)
}

/// Korte hex-code (kassacode/tikcode), standaard 6 tekens hoofdletters.
pub fn code(len: usize) -> String {
    let mut x = xorshift(nu_nanos() ^ TELLER.fetch_add(1, Ordering::Relaxed).wrapping_mul(0x2545_F491_4F6C_DD1D));
    let mut s = String::with_capacity(len);
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    for _ in 0..len {
        x = xorshift(x);
        s.push(HEX[(x & 0xF) as usize] as char);
    }
    s
}

pub fn nu_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}
