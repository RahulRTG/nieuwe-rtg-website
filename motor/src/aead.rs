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
    /* RFC 8439 heeft een 32-bit blokteller: per (sleutel, nonce) is er dus
       hoogstens 2^32 - 1 blokken van 64 byte = ~256 GB keystream. Liet je de
       teller stil doorrollen, dan begon je opnieuw bij hetzelfde keystream-blok
       en dat is fataal voor een stroomcijfer: twee klaartekstenXOR liggen dan
       open. Onbereikbaar met onze recordgroottes, maar `seal` is publiek, dus
       hier hard stoppen in plaats van stil hergebruiken. */
    let blokken = (data.len() as u64 + 63) / 64;
    let ruimte = (u32::MAX as u64) + 1 - (teller_start as u64);
    assert!(
        blokken <= ruimte,
        "ChaCha20: {} blokken gevraagd maar nog {} tot de tellerwrap; keystream-hergebruik geweigerd",
        blokken, ruimte
    );
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

/* ---------- constant-time vergelijk ----------
   Publiek, want dit is DE vergelijking voor alles wat geheim is: AEAD-tags,
   betaalcodes en het motor-token. Eén geauditeerde implementatie is beter dan
   een kopie per module (die kopieën missen dan net de black_box). */
pub fn ct_eq(a: &[u8], b: &[u8]) -> bool {
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

// ---------- XChaCha20-Poly1305 (24-byte nonce, draft-irtf-cfrg-xchacha) ----------
/* HChaCha20: leidt uit sleutel + 16-byte nonce een subsleutel af. Zelfde ronden
   als ChaCha20, maar ZONDER de eind-optelling; uitvoer = woorden 0..4 en 12..16. */
fn hchacha20(sleutel: &[u8; 32], nonce16: &[u8; 16]) -> [u8; 32] {
    let mut w = [0u32; 16];
    w[0] = 0x6170_7865; w[1] = 0x3320_646e; w[2] = 0x7962_2d32; w[3] = 0x6b20_6574;
    for i in 0..8 { w[4 + i] = le32(&sleutel[4 * i..]); }
    for i in 0..4 { w[12 + i] = le32(&nonce16[4 * i..]); }
    for _ in 0..10 {
        kwart(&mut w, 0, 4, 8, 12); kwart(&mut w, 1, 5, 9, 13); kwart(&mut w, 2, 6, 10, 14); kwart(&mut w, 3, 7, 11, 15);
        kwart(&mut w, 0, 5, 10, 15); kwart(&mut w, 1, 6, 11, 12); kwart(&mut w, 2, 7, 8, 13); kwart(&mut w, 3, 4, 9, 14);
    }
    let mut out = [0u8; 32];
    for i in 0..4 { out[4 * i..4 * i + 4].copy_from_slice(&w[i].to_le_bytes()); }
    for i in 0..4 { out[16 + 4 * i..16 + 4 * i + 4].copy_from_slice(&w[12 + i].to_le_bytes()); }
    out
}

fn x_naar_sub(sleutel: &[u8; 32], nonce24: &[u8; 24]) -> ([u8; 32], [u8; 12]) {
    let mut n16 = [0u8; 16];
    n16.copy_from_slice(&nonce24[0..16]);
    let subsleutel = hchacha20(sleutel, &n16);
    let mut cn = [0u8; 12]; // 4 nul-bytes + de laatste 8 nonce-bytes
    cn[4..].copy_from_slice(&nonce24[16..24]);
    (subsleutel, cn)
}

/// XChaCha20-Poly1305 seal: 24-byte nonce (willekeurig veilig, geen collision-zorg).
pub fn xseal(sleutel: &[u8; 32], nonce24: &[u8; 24], aad: &[u8], klaartekst: &[u8]) -> Vec<u8> {
    let (sub, cn) = x_naar_sub(sleutel, nonce24);
    seal(&sub, &cn, aad, klaartekst)
}

/// XChaCha20-Poly1305 open.
pub fn xopen(sleutel: &[u8; 32], nonce24: &[u8; 24], aad: &[u8], ct_en_tag: &[u8]) -> Option<Vec<u8>> {
    let (sub, cn) = x_naar_sub(sleutel, nonce24);
    open(&sub, &cn, aad, ct_en_tag)
}

/* Niet-omkeerbare afdruk van sleutelmateriaal, voor statusweergave ("draaien we
   nog op dezelfde sleutel?"). Dit is het eerste ChaCha20-blok onder een vaste,
   gedomeinscheiden nonce: zonder ChaCha20 te breken valt er niets over de
   sleutel uit af te leiden. Een FNV-mix over de sleutel is daarvoor het
   verkeerde gereedschap -- die is als niet-cryptografische hash nooit ontworpen
   om sleutelmateriaal te verbergen. */
pub fn sleutel_afdruk(sleutel: &[u8; 32]) -> [u8; 8] {
    let nonce: [u8; 12] = *b"rtg-afdr-uk1";
    let mut blok = [0u8; 64];
    chacha20_blok(sleutel, 0, &nonce, &mut blok);
    let mut uit = [0u8; 8];
    uit.copy_from_slice(&blok[..8]);
    uit
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

    // draft-irtf-cfrg-xchacha sec. 2.2.1: HChaCha20-subsleutel
    #[test]
    fn xchacha_hchacha20_kat() {
        let mut key = [0u8; 32];
        for i in 0..32 { key[i] = i as u8; }
        let nonce = hex("000000090000004a0000000031415927");
        let mut n = [0u8; 16]; n.copy_from_slice(&nonce);
        let sk = hchacha20(&key, &n);
        assert_eq!(&sk[..], &hex("82413b4227b27bfed30e42508a877d73
                                  a0f9e4d58a74a853c12ec41326d3ecdc")[..]);
    }

    #[test]
    fn xchacha_rondrit_en_tamper() {
        let mut key = [0u8; 32]; os_random(&mut key).unwrap();
        let mut nonce = [0u8; 24]; os_random(&mut nonce).unwrap();
        let pt = b"echte naam: Jan Jansen, BSN 123456789";
        let ct = xseal(&key, &nonce, b"aad", pt);
        assert_eq!(xopen(&key, &nonce, b"aad", &ct).unwrap(), pt);
        // verkeerde aad faalt
        assert!(xopen(&key, &nonce, b"anders", &ct).is_none());
        // elke omgeknipte bit faalt de authenticatie
        for i in 0..ct.len() {
            let mut kapot = ct.clone();
            kapot[i] ^= 0x01;
            assert!(xopen(&key, &nonce, b"aad", &kapot).is_none(), "bit-flip op {} mag niet openen", i);
        }
    }

    // RFC 8439 A.3 #1: r=0 -> tag is de s-helft (hier nul)
    #[test]
    fn poly1305_nul_kat() {
        let key = [0u8; 32];
        let tag = poly1305(&key, &[0u8; 64]);
        assert_eq!(tag, [0u8; 16]);
    }

    // Property: seal->open klopt voor honderden willekeurige groottes/aad's, en
    // een willekeurige bit-flip faalt altijd de authenticatie.
    #[test]
    fn property_rondrit_en_integriteit() {
        fn stap(r: &mut u64) -> u64 { *r ^= *r << 13; *r ^= *r >> 7; *r ^= *r << 17; *r }
        fn vul(r: &mut u64, n: usize) -> Vec<u8> {
            let mut v = vec![0u8; n];
            for b in v.iter_mut() { *b = stap(r) as u8; }
            v
        }
        let mut zaad = [0u8; 8]; os_random(&mut zaad).unwrap();
        let mut rng = u64::from_le_bytes(zaad) | 1;
        for ronde in 0..300 {
            let mut key = [0u8; 32]; key.copy_from_slice(&vul(&mut rng, 32));
            let mut nonce = [0u8; 24]; nonce.copy_from_slice(&vul(&mut rng, 24));
            let ptlen = (stap(&mut rng) as usize) % 2049; // 0..2048
            let aadlen = (stap(&mut rng) as usize) % 33;
            let pt = vul(&mut rng, ptlen);
            let aad = vul(&mut rng, aadlen);
            let ct = xseal(&key, &nonce, &aad, &pt);
            assert_eq!(xopen(&key, &nonce, &aad, &ct).as_deref(), Some(&pt[..]), "ronde {}", ronde);
            if !ct.is_empty() {
                let pos = (stap(&mut rng) as usize) % ct.len();
                let mut kapot = ct.clone();
                kapot[pos] ^= 0x80;
                assert!(xopen(&key, &nonce, &aad, &kapot).is_none(), "tamper ronde {}", ronde);
            }
        }
    }

    // Handmatige microbenchmark, bewust geen correctness-test en dus geen
    // `#[ignore]` die de release-inventaris als overgeslagen toets vervuilt.
    #[allow(dead_code)]
    fn bench_doorvoer() {
        let key = [1u8; 32];
        let nonce = [2u8; 24];
        let data = vec![7u8; 4096];
        let iters = 100_000usize;
        let mb = (iters as f64 * data.len() as f64) / 1e6;

        let t = std::time::Instant::now();
        let mut som = 0usize;
        for _ in 0..iters { som = som.wrapping_add(xseal(&key, &nonce, b"", &data).len()); }
        let s1 = t.elapsed().as_secs_f64();
        println!("\n  xseal (versleutel+MAC): {:.0} MB/s   ({} x 4096B in {:.2}s)", mb / s1, iters, s1);

        let ct = xseal(&key, &nonce, b"", &data);
        let t2 = std::time::Instant::now();
        for _ in 0..iters { let _ = std::hint::black_box(xopen(&key, &nonce, b"", &ct)); }
        let s2 = t2.elapsed().as_secs_f64();
        println!("  xopen (verifieer+ontsleutel): {:.0} MB/s   (som {})", mb / s2, som);
    }

    // Fuzz: open() mag NOOIT crashen en NOOIT vals-accepteren op willekeurige rommel.
    #[test]
    fn open_faalt_veilig_op_rommel() {
        let mut zaad = [0u8; 8]; os_random(&mut zaad).unwrap();
        let mut rng = u64::from_le_bytes(zaad) | 3;
        let key = [7u8; 32];
        let n12 = [9u8; 12];
        let n24 = [9u8; 24];
        for _ in 0..2000 {
            rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17;
            let len = (rng as usize) % 200;
            let mut blob = vec![0u8; len];
            for b in blob.iter_mut() { rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17; *b = rng as u8; }
            // geen paniek, en (vrijwel zeker) geen geldige tag op willekeurige bytes
            assert!(open(&key, &n12, &[], &blob).is_none());
            assert!(xopen(&key, &n24, &[], &blob).is_none());
        }
    }
}
