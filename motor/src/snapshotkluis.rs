/* Authenticated-encrypted opslag voor de geldsnapshot.

   De sleutelring staat bewust los van de identiteitskluis. Het state-bestand
   bevat uitsluitend een versie-envelop; saldi, boekingen, refs en economische
   afdrukken zitten allemaal in de XChaCha20-Poly1305 ciphertext. */
use crate::aead;
use crate::json::{self, Json};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

const FORMAAT: &str = "rtg-motor-money-snapshot-v1";

#[derive(Clone)]
struct Sleutel { id: String, bytes: [u8; 32] }

#[derive(Clone)]
pub struct Ring { sleutels: Vec<Sleutel> }

fn hex(bytes: &[u8]) -> String {
    const H: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes { s.push(H[(b >> 4) as usize] as char); s.push(H[(b & 15) as usize] as char); }
    s
}

fn onhex(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 || !s.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("ongeldige hex".into()); }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16)
        .map_err(|_| "ongeldige hex".into())).collect()
}

fn geldig_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 40 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}

fn aad(id: &str, genesis: &str) -> Vec<u8> {
    format!("{}\0{}\0{}", FORMAAT, id, genesis).into_bytes()
}

fn schrijf_sync(pad: &Path, tekst: &str, nieuw: bool) -> Result<(), String> {
    if let Some(dir) = pad.parent() { fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
    let mut opties = OpenOptions::new();
    opties.write(true);
    if nieuw { opties.create_new(true); } else { opties.create(true).truncate(true); }
    #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; opties.mode(0o600); }
    let mut f = opties.open(pad).map_err(|e| e.to_string())?;
    f.write_all(tekst.as_bytes()).map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())?;
    if let Some(dir) = pad.parent() { fs::File::open(dir).and_then(|d| d.sync_all()).map_err(|e| e.to_string())?; }
    Ok(())
}

impl Ring {
    pub fn laad(pad: &Path) -> Result<Ring, String> {
        let tekst = fs::read_to_string(pad).map_err(|e| format!("snapshot-sleutelring niet leesbaar: {}", e))?;
        let mut sleutels = Vec::new();
        for (n, regel) in tekst.lines().enumerate() {
            let (id, h) = regel.split_once(':').ok_or_else(|| format!("sleutelregel {} mist ':'", n + 1))?;
            if !geldig_id(id) || h.len() != 64 { return Err(format!("ongeldige snapshot-sleutelregel {}", n + 1)); }
            if sleutels.iter().any(|k: &Sleutel| k.id == id) { return Err(format!("dubbel sleutel-id {}", id)); }
            let v = onhex(h)?; let mut bytes = [0u8; 32]; bytes.copy_from_slice(&v);
            sleutels.push(Sleutel { id: id.into(), bytes });
        }
        if sleutels.is_empty() { return Err("snapshot-sleutelring is leeg".into()); }
        Ok(Ring { sleutels })
    }

    pub fn maak(pad: &Path) -> Result<Ring, String> {
        if pad.exists() { return Err("snapshot-sleutelring bestaat al".into()); }
        let mut bytes = [0u8; 32]; aead::os_random(&mut bytes).map_err(|e| e.to_string())?;
        let mut willekeurig = [0u8; 8]; aead::os_random(&mut willekeurig).map_err(|e| e.to_string())?;
        let id = format!("k-{}", hex(&willekeurig));
        schrijf_sync(pad, &format!("{}:{}\n", id, hex(&bytes)), true)?;
        Ok(Ring { sleutels: vec![Sleutel { id, bytes }] })
    }

    pub fn roteer(pad: &Path) -> Result<Ring, String> {
        let mut ring = Ring::laad(pad)?;
        let mut bytes = [0u8; 32]; aead::os_random(&mut bytes).map_err(|e| e.to_string())?;
        let mut willekeurig = [0u8; 8]; aead::os_random(&mut willekeurig).map_err(|e| e.to_string())?;
        let id = format!("k-{}", hex(&willekeurig));
        ring.sleutels.push(Sleutel { id, bytes });
        let tekst = ring.sleutels.iter().map(|k| format!("{}:{}\n", k.id, hex(&k.bytes))).collect::<String>();
        let tmp = pad.with_extension("key.tmp");
        schrijf_sync(&tmp, &tekst, false)?;
        fs::rename(&tmp, pad).map_err(|e| e.to_string())?;
        if let Some(dir) = pad.parent() { fs::File::open(dir).and_then(|d| d.sync_all()).map_err(|e| e.to_string())?; }
        Ok(ring)
    }

    pub fn actief_id(&self) -> &str { &self.sleutels.last().unwrap().id }

    pub fn verzegel(&self, genesis: &str, klaartekst: &[u8]) -> Result<String, String> {
        if !geldig_id(genesis) { return Err("ongeldig genesis-id".into()); }
        let k = self.sleutels.last().ok_or("sleutelring is leeg")?;
        let mut nonce = [0u8; 24]; aead::os_random(&mut nonce).map_err(|e| e.to_string())?;
        let ct = aead::xseal(&k.bytes, &nonce, &aad(&k.id, genesis), klaartekst);
        let mut j = Json::obj();
        j.set("formaat", Json::Str(FORMAAT.into())).set("keyId", Json::Str(k.id.clone()))
            .set("genesisId", Json::Str(genesis.into())).set("nonce", Json::Str(hex(&nonce)))
            .set("ciphertext", Json::Str(hex(&ct)));
        Ok(j.dump())
    }

    pub fn open(&self, tekst: &str) -> Result<(String, Vec<u8>, String), String> {
        let j = json::parse(tekst).map_err(|e| format!("snapshot-envelop is geen geldige JSON: {}", e))?;
        match &j { Json::Obj(m) if m.len() == 5 => {}, _ => return Err("snapshot-envelop heeft onverwachte velden".into()) }
        if j.str_at("formaat") != Some(FORMAAT) { return Err("onbekend snapshotformaat".into()); }
        let id = j.str_at("keyId").ok_or("snapshot mist keyId")?;
        let genesis = j.str_at("genesisId").ok_or("snapshot mist genesisId")?;
        if !geldig_id(id) || !geldig_id(genesis) { return Err("snapshot heeft ongeldige metadata".into()); }
        let nv = onhex(j.str_at("nonce").ok_or("snapshot mist nonce")?)?;
        if nv.len() != 24 { return Err("snapshotnonce moet 24 bytes zijn".into()); }
        let mut nonce = [0u8; 24]; nonce.copy_from_slice(&nv);
        let ct = onhex(j.str_at("ciphertext").ok_or("snapshot mist ciphertext")?)?;
        let k = self.sleutels.iter().find(|k| k.id == id).ok_or("snapshot-keyId ontbreekt in sleutelring")?;
        let pt = aead::xopen(&k.bytes, &nonce, &aad(id, genesis), &ct)
            .ok_or("snapshotauthenticatie faalde: verkeerde sleutel of geknoeid bestand")?;
        Ok((genesis.into(), pt, id.into()))
    }
}

pub fn nieuw_genesis() -> Result<String, String> {
    let mut b = [0u8; 16]; aead::os_random(&mut b).map_err(|e| e.to_string())?;
    Ok(format!("g-{}", hex(&b)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng;
    fn pad(n: &str) -> std::path::PathBuf { std::env::temp_dir().join(format!("rtg-snapkey-{}-{}-{}", n, std::process::id(), rng::nu_ms())) }
    #[test]
    fn tamper_verkeerde_sleutel_en_rotatie_zijn_fail_closed() {
        let a = pad("a"); let b = pad("b");
        let r1 = Ring::maak(&a).unwrap(); let env = r1.verzegel("g-test", b"zeer geheim").unwrap();
        assert_eq!(r1.open(&env).unwrap().1, b"zeer geheim");
        let r2 = Ring::maak(&b).unwrap(); assert!(r2.open(&env).is_err());
        let mut geknoeid = env.clone().into_bytes(); let i = geknoeid.len() - 3; geknoeid[i] = if geknoeid[i] == b'a' { b'b' } else { b'a' };
        assert!(r1.open(std::str::from_utf8(&geknoeid).unwrap()).is_err());
        let r3 = Ring::roteer(&a).unwrap(); assert_eq!(r3.open(&env).unwrap().1, b"zeer geheim");
        let nieuw = r3.verzegel("g-test", b"na rotatie").unwrap();
        assert_ne!(r1.actief_id(), r3.actief_id()); assert!(r1.open(&nieuw).is_err());
        assert_eq!(Ring::laad(&a).unwrap().open(&nieuw).unwrap().1, b"na rotatie");
        let _ = fs::remove_file(a); let _ = fs::remove_file(b);
    }
}
