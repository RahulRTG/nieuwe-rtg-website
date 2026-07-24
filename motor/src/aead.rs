/* Eigen AEAD: ChaCha20-Poly1305 volgens RFC 8439, in pure Rust (alleen std).
   GEEN zelfverzonnen algoritme -- dit is de standaard, byte-voor-byte
   geverifieerd tegen de officiele RFC 8439-testvectoren (zie de tests onderaan).
   Zo blijft de hele motor zero-dependency terwijl de kluis echte authenticated
   encryption houdt.

   - ChaCha20 (RFC 8439 sec. 2.3/2.4): 20 rondes, 96-bit nonce, 32-bit teller.
   - Poly1305 (RFC 8439 sec. 2.5): 130-bit MAC met 26-bit limben (donna-stijl).
   - AEAD-constructie (RFC 8439 sec. 2.8): poly-sleutel uit ChaCha-blok 0, data
     versleuteld vanaf teller 1, MAC over aad||pad||ct||pad||len(aad)||len(ct).
   - Tag-vergelijking is constant-time. Willekeur uit de OS-CSPRNG. */
use std::io::Read;

// ---------- ChaCha20 ----------
#[inline]
fn kwart(s: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize) {
    s[a] = s[a].wrapping_add(s[b]); s[d] ^= s[a]; s[d] = s[d].rotate_left(16);
    s[c] = s[c].wrapping_add(s[d]); s[b] ^= s[c]; s[b] = s[b].rotate_left(12);
    s[a] = s[a].wrapping_add(s[b]); s[d] ^= s[a]; s[d] = s[d].rotate_left(8);
    s[c] = s[c].wrapping_add(s[d]); s[b] ^= s[c]; s[b] = s[b].rotate_left(7);
}

fn le32(b: &[u8]) -> u32 {
    u32::from_le_bytes([b[0], b[1], b[2], b[3]])
}

fn chacha20_blok(sleutel: &[u8; 32], teller: u32, nonce: &[u8; 12], uit: &mut [u8; 64]) {
    let mut st = [0u32; 16];
    st[0] = 0x6170_7865; st[1] = 0x3320_646e; st[2] = 0x7962_2d32; st[3] = 0x6b20_6574;
    for i in 0..8 { st[4 + i] = le32(&sleutel[4 * i..]); }
    st[12] = teller;
    for i in 0..3 { st[13 + i] = le32(&nonce[4 * i..]); }
    let mut w = st;
    for _ in 0..10 {
        kwart(&mut w, 0, 4, 8, 12); kwart(&mut w, 1, 5, 9, 13); kwart(&mut w, 2, 6, 10, 14); kwart(&mut w, 3, 7, 11, 15);
        kwart(&mut w, 0, 5, 10, 15); kwart(&mut w, 1, 6, 11, 12); kwart(&mut w, 2, 7, 8, 13); kwart(&mut w, 3, 4, 9, 14);
    }
    for i in 0..16 {
        let v = w[i].wrapping_add(st[i]);
        uit[4 * i..4 * i + 4].copy_from_slice(&v.to_le_bytes());
    }
}

fn chacha20_xor(sleutel: &[u8; 32], teller_start: u32, nonce: &[u8; 12], data: &mut [u8]) {
    let mut blok = [0u8; 64];
    let mut teller = teller_start;
    let mut off = 0;
    while off < data.len() {
        chacha20_blok(sleutel, teller, nonce, &mut blok);
        let n = (data.len() - off).min(64);
        for i in 0..n { data[off + i] ^= blok[i]; }
        off += 64;
        teller = teller.wrapping_add(1);
    }
}

// ---------- Poly1305 (26-bit limben) ----------
fn poly1305(sleutel: &[u8; 32], bericht: &[u8]) -> [u8; 16] {
    let t0 = le32(&sleutel[0..]); let t1 = le32(&sleutel[4..]); let t2 = le32(&sleutel[8..]); let t3 = le32(&sleutel[12..]);
    let r0 = t0 & 0x3ff_ffff;
    let r1 = ((t0 >> 26) | (t1 << 6)) & 0x3ff_ff03;
    let r2 = ((t1 >> 20) | (t2 << 12)) & 0x3ff_c0ff;
    let r3 = ((t2 >> 14) | (t3 << 18)) & 0x3f0_3fff;
    let r4 = (t3 >> 8) & 0x00f_ffff;
    let (s1, s2, s3, s4) = (r1 * 5, r2 * 5, r3 * 5, r4 * 5);
    let (mut h0, mut h1, mut h2, mut h3, mut h4) = (0u32, 0u32, 0u32, 0u32, 0u32);

    let verwerk = |blk: &[u8; 16], hibit: u32,
                       h0: &mut u32, h1: &mut u32, h2: &mut u32, h3: &mut u32, h4: &mut u32| {
        let m0 = le32(&blk[0..]); let m1 = le32(&blk[4..]); let m2 = le32(&blk[8..]); let m3 = le32(&blk[12..]);
        *h0 = h0.wrapping_add(m0 & 0x3ff_ffff);
        *h1 = h1.wrapping_add(((m0 >> 26) | (m1 << 6)) & 0x3ff_ffff);
        *h2 = h2.wrapping_add(((m1 >> 20) | (m2 << 12)) & 0x3ff_ffff);
        *h3 = h3.wrapping_add(((m2 >> 14) | (m3 << 18)) & 0x3ff_ffff);
        *h4 = h4.wrapping_add((m3 >> 8) | hibit);
        let m = |a: u32, b: u32| (a as u64) * (b as u64);
        let d0 = m(*h0, r0) + m(*h1, s4) + m(*h2, s3) + m(*h3, s2) + m(*h4, s1);
        let d1 = m(*h0, r1) + m(*h1, r0) + m(*h2, s4) + m(*h3, s3) + m(*h4, s2);
        let d2 = m(*h0, r2) + m(*h1, r1) + m(*h2, r0) + m(*h3, s4) + m(*h4, s3);
        let d3 = m(*h0, r3) + m(*h1, r2) + m(*h2, r1) + m(*h3, r0) + m(*h4, s4);
        let d4 = m(*h0, r4) + m(*h1, r3) + m(*h2, r2) + m(*h3, r1) + m(*h4, r0);
        let mut c = (d0 >> 26) as u32; *h0 = (d0 as u32) & 0x3ff_ffff;
        let d1 = d1 + c as u64; c = (d1 >> 26) as u32; *h1 = (d1 as u32) & 0x3ff_ffff;
        let d2 = d2 + c as u64; c = (d2 >> 26) as u32; *h2 = (d2 as u32) & 0x3ff_ffff;
        let d3 = d3 + c as u64; c = (d3 >> 26) as u32; *h3 = (d3 as u32) & 0x3ff_ffff;
        let d4 = d4 + c as u64; c = (d4 >> 26) as u32; *h4 = (d4 as u32) & 0x3ff_ffff;
        *h0 = h0.wrapping_add(c * 5); c = *h0 >> 26; *h0 &= 0x3ff_ffff; *h1 = h1.wrapping_add(c);
    };

    let mut i = 0;
    while i + 16 <= bericht.len() {
        let mut blk = [0u8; 16];
        blk.copy_from_slice(&bericht[i..i + 16]);
        verwerk(&blk, 1 << 24, &mut h0, &mut h1, &mut h2, &mut h3, &mut h4);
        i += 16;
    }
    if i < bericht.len() {
        let mut blk = [0u8; 16];
        let rem = bericht.len() - i;
        blk[..rem].copy_from_slice(&bericht[i..]);
        blk[rem] = 1;
        verwerk(&blk, 0, &mut h0, &mut h1, &mut h2, &mut h3, &mut h4);
    }

    // volledig doorrekenen
    let mut c;
    c = h1 >> 26; h1 &= 0x3ff_ffff; h2 += c;
    c = h2 >> 26; h2 &= 0x3ff_ffff; h3 += c;
    c = h3 >> 26; h3 &= 0x3ff_ffff; h4 += c;
    c = h4 >> 26; h4 &= 0x3ff_ffff; h0 += c * 5;
    c = h0 >> 26; h0 &= 0x3ff_ffff; h1 += c;

    // h - p (constant-time keuze)
    let mut g0 = h0.wrapping_add(5); c = g0 >> 26; g0 &= 0x3ff_ffff;
    let mut g1 = h1.wrapping_add(c); c = g1 >> 26; g1 &= 0x3ff_ffff;
    let mut g2 = h2.wrapping_add(c); c = g2 >> 26; g2 &= 0x3ff_ffff;
    let mut g3 = h3.wrapping_add(c); c = g3 >> 26; g3 &= 0x3ff_ffff;
    let g4 = h4.wrapping_add(c).wrapping_sub(1 << 26);
    // black_box: optimalisatie-barriere zodat de compiler de constant-time
    // maskerkeuze niet terugdraait naar een geheim-afhankelijke branch (punt 3).
    let mask = std::hint::black_box((g4 >> 31).wrapping_sub(1)); // 0xffffffff als g>=p, anders 0
    g0 &= mask; g1 &= mask; g2 &= mask; g3 &= mask; let g4m = g4 & mask;
    let nmask = !mask;
    h0 = (h0 & nmask) | g0; h1 = (h1 & nmask) | g1; h2 = (h2 & nmask) | g2; h3 = (h3 & nmask) | g3; h4 = (h4 & nmask) | g4m;

    // naar 128-bit + pad (s) optellen
    let f0 = (h0 as u64) | ((h1 as u64) << 26);
    let f1 = ((h1 as u64) >> 6) | ((h2 as u64) << 20);
    let f2 = ((h2 as u64) >> 12) | ((h3 as u64) << 14);
    let f3 = ((h3 as u64) >> 18) | ((h4 as u64) << 8);
    let p0 = le32(&sleutel[16..]) as u64; let p1 = le32(&sleutel[20..]) as u64;
    let p2 = le32(&sleutel[24..]) as u64; let p3 = le32(&sleutel[28..]) as u64;
    let mut f = (f0 & 0xffff_ffff) + p0; let o0 = f as u32;
    f = (f1 & 0xffff_ffff) + p1 + (f >> 32); let o1 = f as u32;
    f = (f2 & 0xffff_ffff) + p2 + (f >> 32); let o2 = f as u32;
    f = (f3 & 0xffff_ffff) + p3 + (f >> 32); let o3 = f as u32;

    let mut tag = [0u8; 16];
    tag[0..4].copy_from_slice(&o0.to_le_bytes());
    tag[4..8].copy_from_slice(&o1.to_le_bytes());
    tag[8..12].copy_from_slice(&o2.to_le_bytes());
    tag[12..16].copy_from_slice(&o3.to_le_bytes());
    tag
}

// ---------- constant-time vergelijk ----------
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for i in 0..a.len() {
        diff |= a[i] ^ b[i];
    }
    // black_box zodat de compiler de accumulatie niet vroegtijdig kan
    // kortsluiten tot een branch (constant-time tag-vergelijk, punt 3).
    std::hint::black_box(diff) == 0
}

// ---------- AEAD (RFC 8439 sec. 2.8) ----------
fn tag_van(polysleutel: &[u8; 32], aad: &[u8], ct: &[u8]) -> [u8; 16] {
    let mut m = Vec::with_capacity(aad.len() + ct.len() + 32);
    m.extend_from_slice(aad);
    while m.len() % 16 != 0 { m.push(0); }
    m.extend_from_slice(ct);
    while m.len() % 16 != 0 { m.push(0); }
    m.extend_from_slice(&(aad.len() as u64).to_le_bytes());
    m.extend_from_slice(&(ct.len() as u64).to_le_bytes());
    poly1305(polysleutel, &m)
}

fn poly_sleutel(sleutel: &[u8; 32], nonce: &[u8; 12]) -> [u8; 32] {
    let mut blok0 = [0u8; 64];
    chacha20_blok(sleutel, 0, nonce, &mut blok0);
    let mut pk = [0u8; 32];
    pk.copy_from_slice(&blok0[..32]);
    pk
}

/// Versleutel + authenticeer. Geeft ciphertext || tag(16) terug.
pub fn seal(sleutel: &[u8; 32], nonce: &[u8; 12], aad: &[u8], klaartekst: &[u8]) -> Vec<u8> {
    let pk = poly_sleutel(sleutel, nonce);
    let mut ct = klaartekst.to_vec();
    chacha20_xor(sleutel, 1, nonce, &mut ct);
    let tag = tag_van(&pk, aad, &ct);
    ct.extend_from_slice(&tag);
    ct
}

/// Verifieer + ontsleutel. None als de authenticatie faalt (gewijzigd/kapot).
pub fn open(sleutel: &[u8; 32], nonce: &[u8; 12], aad: &[u8], ct_en_tag: &[u8]) -> Option<Vec<u8>> {
    if ct_en_tag.len() < 16 {
        return None;
    }
    let (ct, tag_in) = ct_en_tag.split_at(ct_en_tag.len() - 16);
    let pk = poly_sleutel(sleutel, nonce);
    let tag_calc = tag_van(&pk, aad, ct);
    if !ct_eq(&tag_calc, tag_in) {
        return None;
    }
    let mut pt = ct.to_vec();
    chacha20_xor(sleutel, 1, nonce, &mut pt);
    Some(pt)
}

/// Willekeurige bytes uit de OS-CSPRNG (/dev/urandom). Zero-dependency.
pub fn os_random(uit: &mut [u8]) -> std::io::Result<()> {
    let mut f = std::fs::File::open("/dev/urandom")?;
    f.read_exact(uit)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(s: &str) -> Vec<u8> {
        let s: String = s.chars().filter(|c| !c.is_whitespace()).collect();
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
    }

    // RFC 8439 sec. 2.1.1: de quarter-round op vier losse woorden
    #[test]
    fn rfc8439_quarter_round() {
        let mut s = [0u32; 16];
        s[0] = 0x1111_1111; s[1] = 0x0102_0304; s[2] = 0x9b8d_6f43; s[3] = 0x0123_4567;
        kwart(&mut s, 0, 1, 2, 3);
        assert_eq!(s[0], 0xea2a_92f4);
        assert_eq!(s[1], 0xcb1c_f8ce);
        assert_eq!(s[2], 0x4581_472e);
        assert_eq!(s[3], 0x5881_c4bb);
    }

    // RFC 8439 sec. 2.2.1: de quarter-round op de volle ChaCha-state (transpositie
    // over de diagonale indices 2,7,8,13)
    #[test]
    fn rfc8439_quarter_round_op_state() {
        let mut s: [u32; 16] = [
            0x8795_31e0, 0xc5ec_f37d, 0x5164_61b1, 0xc9a6_2f8a,
            0x44c2_0ef3, 0x3390_af7f, 0xd9fc_690b, 0x2a5f_714c,
            0x5337_2767, 0xb00a_5631, 0x974c_541a, 0x359e_9963,
            0x5c97_1061, 0x3d63_1689, 0x2098_d9d6, 0x91db_d320,
        ];
        kwart(&mut s, 2, 7, 8, 13);
        assert_eq!(s[2], 0xbdb8_86dc);
        assert_eq!(s[7], 0xcfac_afd2);
        assert_eq!(s[8], 0xe46b_ea80);
        assert_eq!(s[13], 0xccc0_7c79);
    }

    // RFC 8439 sec. 2.6.2: de Poly1305-eenmalige-sleutel uit ChaCha-blok 0
    #[test]
    fn rfc8439_poly1305_key_gen() {
        let mut key = [0u8; 32];
        for i in 0..32 { key[i] = (0x80 + i) as u8; }
        let nonce = hex("000000000001020304050607");
        let mut n = [0u8; 12]; n.copy_from_slice(&nonce);
        let pk = poly_sleutel(&key, &n);
        let verwacht = hex("8ad5a08b905f81cc815040274ab29471
                            a833b637e3fd0da508dbb8e2fdd1a646");
        assert_eq!(&pk[..], &verwacht[..]);
    }

    // RFC 8439 sec. 2.3.2: ChaCha20 blok-testvector
    #[test]
    fn rfc8439_chacha20_blok() {
        let mut key = [0u8; 32];
        for i in 0..32 { key[i] = i as u8; }
        let nonce = hex("000000090000004a00000000");
        let mut n = [0u8; 12]; n.copy_from_slice(&nonce);
        let mut uit = [0u8; 64];
        chacha20_blok(&key, 1, &n, &mut uit);
        let verwacht = hex(
            "10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c0680304
             22aa9ac3d46c4ed2826446079faa0914c2d705d98b02a2b512
             9cd1de164eb9cbd083e8a2503c4e");
        assert_eq!(&uit[..], &verwacht[..]);
    }

    // RFC 8439 sec. 2.5.2: Poly1305-testvector
    #[test]
    fn rfc8439_poly1305() {
        let key = hex("85d6be7857556d337f4452fe42d506a8
                       0103808afb0db2fd4abff6af4149f51b");
        let mut k = [0u8; 32]; k.copy_from_slice(&key);
        let msg = b"Cryptographic Forum Research Group";
        let tag = poly1305(&k, msg);
        assert_eq!(&tag[..], &hex("a8061dc1305136c6c22b8baf0c0127a9")[..]);
    }

    // RFC 8439 sec. 2.8.2: volledige AEAD-testvector
    #[test]
    fn rfc8439_aead() {
        let mut key = [0u8; 32];
        for i in 0..32 { key[i] = (0x80 + i) as u8; }
        let nonce = hex("070000004041424344454647");
        let mut n = [0u8; 12]; n.copy_from_slice(&nonce);
        let aad = hex("50515253c0c1c2c3c4c5c6c7");
        let pt = b"Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.";
        let uit = seal(&key, &n, &aad, pt);
        let verwacht_ct = hex(
            "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d6
             3dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b36
             92ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc
             3ff4def08e4b7a9de576d26586cec64b6116");
        let verwacht_tag = hex("1ae10b594f09e26a7e902ecbd0600691");
        assert_eq!(&uit[..uit.len() - 16], &verwacht_ct[..], "ciphertext moet RFC-vector matchen");
        assert_eq!(&uit[uit.len() - 16..], &verwacht_tag[..], "tag moet RFC-vector matchen");

        // en open() herstelt de klaartekst
        assert_eq!(open(&key, &n, &aad, &uit).unwrap(), pt);
        // gewijzigd blob faalt
        let mut kapot = uit.clone();
        let l = kapot.len() - 1;
        kapot[l] ^= 0x01;
        assert!(open(&key, &n, &aad, &kapot).is_none());
    }
}
