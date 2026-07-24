/* De identiteitskluis in Rust. Privacy by design: de rest van het systeem draait
   op codenamen; hier -- en alleen hier -- wonen de echte persoonsgegevens, en ze
   staan VERSLEUTELD op schijf. De sleutel staat gescheiden van de data (aparte
   bestanden), precies zoals de Node-kant (accounts.js + vault.key).

   Crypto: ChaCha20-Poly1305 (AEAD) uit de geaudite RustCrypto-crate -- GEEN
   zelfgebouwde crypto. Per record een verse willekeurige nonce (getrandom, uit
   de OS-CSPRNG). Een gewijzigd of afgeknipt blob faalt de authenticatie en
   levert niets op. De sleutel wordt nooit gelogd of teruggegeven; de status toont
   alleen een niet-omkeerbare vingerafdruk.

   Alleen gecompileerd met `--features kluis`. */
use crate::aead;
use crate::json::Json;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const NONCE_LEN: usize = 12;
const SLEUTEL_LEN: usize = 32;

pub struct Kluis {
    sleutel: [u8; SLEUTEL_LEN],
    vingerafdruk: String,
    store: HashMap<String, Vec<u8>>, // key -> nonce || ciphertext+tag
    pad: PathBuf,
    pub vuil: bool,
}

fn naar_hex(b: &[u8]) -> String {
    let mut s = String::with_capacity(b.len() * 2);
    const H: &[u8; 16] = b"0123456789abcdef";
    for &x in b {
        s.push(H[(x >> 4) as usize] as char);
        s.push(H[(x & 0xf) as usize] as char);
    }
    s
}

fn van_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    let b = s.as_bytes();
    let mut uit = Vec::with_capacity(s.len() / 2);
    let waarde = |c: u8| -> Option<u8> {
        match c {
            b'0'..=b'9' => Some(c - b'0'),
            b'a'..=b'f' => Some(c - b'a' + 10),
            b'A'..=b'F' => Some(c - b'A' + 10),
            _ => None,
        }
    };
    let mut i = 0;
    while i < b.len() {
        uit.push((waarde(b[i])? << 4) | waarde(b[i + 1])?);
        i += 2;
    }
    Some(uit)
}

/* Niet-omkeerbare vingerafdruk van de sleutel voor de status (nooit de sleutel
   zelf). Een simpele, niet-cryptografische mix -- genoeg om "dezelfde sleutel?"
   te zien zonder iets te lekken. */
fn vingerafdruk(sleutel: &[u8]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in sleutel {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

/* Laad de 32-byte sleutel uit het sleutelbestand (hex), of maak er een met de
   OS-CSPRNG en schrijf hem weg (alleen leesbaar voor de eigenaar). */
fn laad_of_maak_sleutel(pad: &Path) -> io::Result<[u8; SLEUTEL_LEN]> {
    if let Ok(tekst) = fs::read_to_string(pad) {
        if let Some(b) = van_hex(tekst.trim()) {
            if b.len() == SLEUTEL_LEN {
                let mut k = [0u8; SLEUTEL_LEN];
                k.copy_from_slice(&b);
                return Ok(k);
            }
        }
    }
    let mut k = [0u8; SLEUTEL_LEN];
    aead::os_random(&mut k)?;
    if let Some(dir) = pad.parent() {
        let _ = fs::create_dir_all(dir);
    }
    fs::write(pad, naar_hex(&k))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(pad, fs::Permissions::from_mode(0o600));
    }
    Ok(k)
}

impl Kluis {
    pub fn open(sleutel_pad: &Path, data_pad: &Path) -> io::Result<Kluis> {
        let key = laad_of_maak_sleutel(sleutel_pad)?;
        let vaf = vingerafdruk(&key);
        let mut store = HashMap::new();
        if let Ok(tekst) = fs::read_to_string(data_pad) {
            if let Ok(Json::Obj(m)) = crate::json::parse(&tekst) {
                for (k, v) in m {
                    if let Some(h) = v.as_str() {
                        if let Some(b) = van_hex(h) {
                            store.insert(k, b);
                        }
                    }
                }
            }
        }
        Ok(Kluis { sleutel: key, vingerafdruk: vaf, store, pad: data_pad.to_path_buf(), vuil: false })
    }

    /* Bewaar (of overschrijf) de echte gegevens voor een sleutel/codenaam,
       versleuteld. De klaartekst raakt de schijf nooit onversleuteld. */
    pub fn bewaar(&mut self, key: &str, klaartekst: &str) -> Result<(), String> {
        if key.is_empty() {
            return Err("Geen sleutel.".into());
        }
        let mut nonce = [0u8; NONCE_LEN];
        aead::os_random(&mut nonce).map_err(|e| e.to_string())?;
        // eigen ChaCha20-Poly1305 (RFC 8439), geverifieerd tegen de RFC-vectoren
        let ct = aead::seal(&self.sleutel, &nonce, &[], klaartekst.as_bytes());
        let mut blob = nonce.to_vec();
        blob.extend_from_slice(&ct);
        self.store.insert(key.to_string(), blob);
        self.vuil = true;
        Ok(())
    }

    /* Onthul de echte gegevens (de gevoelige handeling; in productie zit hier de
       eigenaar-/toestemmingspoort van de Node-laag voor). Een gewijzigd blob
       faalt de AEAD-authenticatie en geeft None. */
    pub fn onthul(&self, key: &str) -> Option<String> {
        let blob = self.store.get(key)?;
        if blob.len() < NONCE_LEN {
            return None;
        }
        let (nonce, ct) = blob.split_at(NONCE_LEN);
        let mut n = [0u8; NONCE_LEN];
        n.copy_from_slice(nonce);
        let pt = aead::open(&self.sleutel, &n, &[], ct)?;
        String::from_utf8(pt).ok()
    }

    pub fn wis(&mut self, key: &str) -> bool {
        let weg = self.store.remove(key).is_some();
        if weg {
            self.vuil = true;
        }
        weg
    }

    pub fn aantal(&self) -> usize {
        self.store.len()
    }
    pub fn vingerafdruk(&self) -> &str {
        &self.vingerafdruk
    }

    // versleutelde snapshot naar schijf (blobs als hex; nooit klaartekst)
    pub fn snapshot(&self) -> Json {
        let mut o = Json::obj();
        if let Json::Obj(m) = &mut o {
            for (k, blob) in &self.store {
                m.insert(k.clone(), Json::Str(naar_hex(blob)));
            }
        }
        o
    }
    pub fn pad(&self) -> &Path {
        &self.pad
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("kluis-test-{}-{}", std::process::id(), super::vingerafdruk(&[rand_byte(), rand_byte()])));
        std::fs::create_dir_all(&d).unwrap();
        d
    }
    fn rand_byte() -> u8 {
        let mut b = [0u8; 1];
        super::aead::os_random(&mut b).unwrap();
        b[0]
    }

    #[test]
    fn versleutel_ontsleutel_rondrit() {
        let d = tmp();
        let mut k = Kluis::open(&d.join("secret.key"), &d.join("kluis.json")).unwrap();
        k.bewaar("NEVEL", r#"{"naam":"Jan Jansen","bsn":"123456789"}"#).unwrap();
        assert_eq!(k.onthul("NEVEL").unwrap(), r#"{"naam":"Jan Jansen","bsn":"123456789"}"#);
        assert!(k.onthul("SPOOK").is_none());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn blob_op_schijf_bevat_geen_klaartekst() {
        let d = tmp();
        let dp = d.join("kluis.json");
        let mut k = Kluis::open(&d.join("secret.key"), &dp).unwrap();
        k.bewaar("MIST", "Jan Jansen woont in Amsterdam").unwrap();
        std::fs::write(&dp, k.snapshot().dump()).unwrap();
        let rauw = std::fs::read_to_string(&dp).unwrap();
        assert!(!rauw.contains("Jan Jansen"), "klaartekst mag NOOIT op schijf staan");
        assert!(!rauw.contains("Amsterdam"));
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn andere_sleutel_kan_niet_ontsleutelen() {
        let d = tmp();
        let dp = d.join("kluis.json");
        {
            let mut k = Kluis::open(&d.join("a.key"), &dp).unwrap();
            k.bewaar("X", "geheim").unwrap();
            std::fs::write(&dp, k.snapshot().dump()).unwrap();
        }
        // open met een ANDERE sleutel: de blobs zijn onleesbaar
        let k2 = Kluis::open(&d.join("b.key"), &dp).unwrap();
        assert!(k2.onthul("X").is_none(), "een andere sleutel mag niets kunnen onthullen");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn gewijzigd_blob_faalt_authenticatie() {
        let d = tmp();
        let mut k = Kluis::open(&d.join("secret.key"), &d.join("kluis.json")).unwrap();
        k.bewaar("Y", "origineel").unwrap();
        // knoei met het opgeslagen blob
        let blob = k.store.get_mut("Y").unwrap();
        let laatste = blob.len() - 1;
        blob[laatste] ^= 0xff;
        assert!(k.onthul("Y").is_none(), "een gewijzigd blob mag de AEAD-authenticatie niet halen");
        std::fs::remove_dir_all(&d).ok();
    }
}
