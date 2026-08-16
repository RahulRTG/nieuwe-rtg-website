/* SHA-256 en HMAC-SHA-256 voor het releasebewijs en het Sentinel-auditspoor.

   Geen nieuwe crypto wordt bedacht: dit is FIPS 180-4 SHA-256, getest tegen
   de bekende lege/abc/miljoen-a vectoren. De streamingvorm voorkomt dat een
   groot releasebestand volledig in het geheugen hoeft. XChaCha blijft in
   aead.rs en wordt hier niet aangeraakt. */
use std::io::{self, Read};

const K: [u32; 64] = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];

#[derive(Clone)]
pub struct Sha256 {
    h: [u32; 8],
    blok: [u8; 64],
    blok_len: usize,
    totaal: u64,
}

impl Sha256 {
    pub fn new() -> Self {
        Self { h: [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
                   0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],
               blok: [0; 64], blok_len: 0, totaal: 0 }
    }

    pub fn update(&mut self, mut data: &[u8]) {
        self.totaal = self.totaal.wrapping_add(data.len() as u64);
        if self.blok_len > 0 {
            let n = (64 - self.blok_len).min(data.len());
            self.blok[self.blok_len..self.blok_len + n].copy_from_slice(&data[..n]);
            self.blok_len += n;
            data = &data[n..];
            if self.blok_len == 64 {
                let b = self.blok;
                self.compress(&b);
                self.blok_len = 0;
            }
        }
        while data.len() >= 64 {
            let mut b = [0u8; 64];
            b.copy_from_slice(&data[..64]);
            self.compress(&b);
            data = &data[64..];
        }
        if !data.is_empty() {
            self.blok[..data.len()].copy_from_slice(data);
            self.blok_len = data.len();
        }
    }

    fn compress(&mut self, blok: &[u8; 64]) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes(blok[i*4..i*4+4].try_into().unwrap());
        }
        for i in 16..64 {
            let s0 = w[i-15].rotate_right(7) ^ w[i-15].rotate_right(18) ^ (w[i-15] >> 3);
            let s1 = w[i-2].rotate_right(17) ^ w[i-2].rotate_right(19) ^ (w[i-2] >> 10);
            w[i] = w[i-16].wrapping_add(s0).wrapping_add(w[i-7]).wrapping_add(s1);
        }
        let [mut a,mut b,mut c,mut d,mut e,mut f,mut g,mut h] = self.h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = h.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            h=g; g=f; f=e; e=d.wrapping_add(t1); d=c; c=b; b=a; a=t1.wrapping_add(t2);
        }
        for (x, v) in self.h.iter_mut().zip([a,b,c,d,e,f,g,h]) { *x = x.wrapping_add(v); }
    }

    pub fn finish(mut self) -> [u8; 32] {
        let bits = self.totaal.wrapping_mul(8);
        let mut staart = [0u8; 128];
        staart[..self.blok_len].copy_from_slice(&self.blok[..self.blok_len]);
        staart[self.blok_len] = 0x80;
        let n = if self.blok_len + 1 + 8 <= 64 { 64 } else { 128 };
        staart[n-8..n].copy_from_slice(&bits.to_be_bytes());
        for stuk in staart[..n].chunks_exact(64) {
            let mut b = [0u8; 64]; b.copy_from_slice(stuk); self.compress(&b);
        }
        let mut uit = [0u8; 32];
        for (i, v) in self.h.iter().enumerate() { uit[i*4..i*4+4].copy_from_slice(&v.to_be_bytes()); }
        uit
    }
}

pub fn digest(data: &[u8]) -> [u8; 32] { let mut h=Sha256::new(); h.update(data); h.finish() }
pub fn hex_bytes(bytes: &[u8]) -> String { bytes.iter().map(|b| format!("{:02x}", b)).collect() }
pub fn hex(data: &[u8]) -> String { hex_bytes(&digest(data)) }

pub fn reader<R: Read>(mut r: R) -> io::Result<([u8; 32], u64)> {
    let mut h = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    let mut n_totaal = 0u64;
    loop {
        let n = r.read(&mut buf)?;
        if n == 0 { break; }
        h.update(&buf[..n]); n_totaal += n as u64;
    }
    Ok((h.finish(), n_totaal))
}

pub fn hmac(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if key.len() > 64 { k[..32].copy_from_slice(&digest(key)); }
    else { k[..key.len()].copy_from_slice(key); }
    let mut ipad = [0x36u8; 64]; let mut opad = [0x5cu8; 64];
    for i in 0..64 { ipad[i] ^= k[i]; opad[i] ^= k[i]; }
    let mut binnen = Sha256::new(); binnen.update(&ipad); binnen.update(data);
    let mut buiten = Sha256::new(); buiten.update(&opad); buiten.update(&binnen.finish());
    buiten.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bekende_sha256_vectoren() {
        assert_eq!(hex(b""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assert_eq!(hex(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(hex(&vec![b'a'; 1_000_000]), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
    }
    #[test]
    fn bekende_hmac_vector() {
        assert_eq!(hex_bytes(&hmac(b"key", b"The quick brown fox jumps over the lazy dog")),
          "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
    }
}
