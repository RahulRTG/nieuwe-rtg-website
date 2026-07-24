/* De identiteitskluis in Rust. Privacy by design: de rest van het systeem draait
   op codenamen; hier -- en alleen hier -- wonen de echte persoonsgegevens, en ze
   staan VERSLEUTELD op schijf. De sleutel staat gescheiden van de data (aparte
   bestanden), precies zoals de Node-kant (accounts.js + vault.key).

   Crypto: onze eigen XChaCha20-Poly1305 (AEAD) uit `aead.rs` -- ChaCha20-Poly1305
   uit RFC 8439 + HChaCha20 (24-byte nonce), byte-voor-byte geverifieerd tegen de
   officiele testvectoren. GEEN externe crate: de hele motor is zero-dependency.
   Per record een verse willekeurige nonce (uit de OS-CSPRNG, /dev/urandom). Een
   gewijzigd of afgeknipt blob faalt de authenticatie en levert niets op. De
   sleutel wordt nooit gelogd of teruggegeven; de status toont alleen een
   niet-omkeerbare vingerafdruk.

   Twee harde garanties bovenop de encryptie zelf:

   1. CONTEXT-BINDING (AAD). Elk record wordt verzegeld met zijn eigen sleutel/
      codenaam als "additional authenticated data". Een blob dat onder codenaam
      NEVEL is opgeslagen kan daardoor NIET naar het slot van SPOOK worden
      verplaatst: de AEAD-authenticatie faalt zodra de codenaam niet meer klopt.
      Zo is record-verwisseling binnen de kluis onmogelijk, ook voor wie het
      versleutelde bestand op schijf kan bewerken.

   2. CRASH-VEILIGE SLEUTELROTATIE (keyring). De sleutel is niet één waarde maar
      een keyring: een geordende lijst sleutels. Elk blob draagt in zijn eerste
      byte de VERSIE (index in de keyring) waarmee het is verzegeld. Bij rotatie
      schrijven we EERST de nieuwe keyring naar schijf (fsync) en pas daarna
      hersleutelen we de records. Crasht de motor halverwege, dan wijst elk blob
      nog steeds naar een sleutel die op schijf staat -- niets wordt onleesbaar.
      De actieve (nieuwste) sleutel is altijd de laatste in de keyring. */
use crate::aead;
use crate::json::Json;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const NONCE_LEN: usize = 24; // XChaCha20: 24-byte nonce -> geen collision-zorg
const SLEUTEL_LEN: usize = 32;
const MAX_SLEUTELS: usize = 255; // versie past in 1 byte (0..=254)

pub struct Kluis {
    sleutels: Vec<[u8; SLEUTEL_LEN]>, // keyring; actief = laatste
    sleutel_pad: PathBuf,
    vingerafdruk: String,
    store: HashMap<String, Vec<u8>>, // key -> [versie:1] || nonce:24 || ciphertext+tag
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

/* Niet-omkeerbare vingerafdruk van de ACTIEVE sleutel voor de status (nooit de
   sleutel zelf). Een simpele, niet-cryptografische mix -- genoeg om "dezelfde
   sleutel?" te zien zonder iets te lekken. */
fn vingerafdruk(sleutel: &[u8]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in sleutel {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

/* Schrijf de keyring atomair naar schijf: alle sleutels als hex, één per regel,
   oudste eerst. Temp-bestand + fsync + rename, zodat de keyring nooit half op
   schijf staat. Rechten 600 (alleen de eigenaar). Dit MOET slagen vóór we
   records hersleutelen, anders zou een crash een blob naar een sleutel laten
   wijzen die de schijf niet kent. */
fn schrijf_keyring(pad: &Path, sleutels: &[[u8; SLEUTEL_LEN]]) -> io::Result<()> {
    if let Some(dir) = pad.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let mut tekst = String::with_capacity(sleutels.len() * (SLEUTEL_LEN * 2 + 1));
    for k in sleutels {
        tekst.push_str(&naar_hex(k));
        tekst.push('\n');
    }
    let tmp = pad.with_extension("tmp");
    {
        use std::io::Write;
        let mut f = fs::File::create(&tmp)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = f.set_permissions(fs::Permissions::from_mode(0o600));
        }
        f.write_all(tekst.as_bytes())?;
        f.sync_all()?; // op schijf vóór de rename -> crash-veilig
    }
    fs::rename(&tmp, pad)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(pad, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/* Laad de keyring uit het sleutelbestand (hex, één sleutel per regel), of maak
   er een met de OS-CSPRNG en schrijf hem weg. Backwards-compatibel: een oud
   bestand met één sleutel (geen newline) leest gewoon als keyring met lengte 1.
   Onherkenbare regels worden overgeslagen; als er geen enkele geldige sleutel is
   maken we een verse keyring. */
fn laad_of_maak_keyring(pad: &Path) -> io::Result<Vec<[u8; SLEUTEL_LEN]>> {
    if let Ok(tekst) = fs::read_to_string(pad) {
        let mut ring = Vec::new();
        for regel in tekst.lines() {
            let regel = regel.trim();
            if regel.is_empty() {
                continue;
            }
            if let Some(b) = van_hex(regel) {
                if b.len() == SLEUTEL_LEN {
                    let mut k = [0u8; SLEUTEL_LEN];
                    k.copy_from_slice(&b);
                    ring.push(k);
                }
            }
        }
        if !ring.is_empty() {
            return Ok(ring);
        }
    }
    let mut k = [0u8; SLEUTEL_LEN];
    aead::os_random(&mut k)?;
    let ring = vec![k];
    schrijf_keyring(pad, &ring)?;
    Ok(ring)
}

impl Kluis {
    pub fn open(sleutel_pad: &Path, data_pad: &Path) -> io::Result<Kluis> {
        let sleutels = laad_of_maak_keyring(sleutel_pad)?;
        let vaf = vingerafdruk(&sleutels[sleutels.len() - 1]);
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
        Ok(Kluis {
            sleutels,
            sleutel_pad: sleutel_pad.to_path_buf(),
            vingerafdruk: vaf,
            store,
            pad: data_pad.to_path_buf(),
            vuil: false,
        })
    }

    fn actieve_versie(&self) -> usize {
        self.sleutels.len() - 1
    }

    /* Bewaar (of overschrijf) de echte gegevens voor een sleutel/codenaam,
       versleuteld met de ACTIEVE sleutel en gebonden aan de codenaam (AAD). De
       klaartekst raakt de schijf nooit onversleuteld. */
    pub fn bewaar(&mut self, key: &str, klaartekst: &str) -> Result<(), String> {
        if key.is_empty() {
            return Err("Geen sleutel.".into());
        }
        let versie = self.actieve_versie();
        let mut nonce = [0u8; NONCE_LEN];
        aead::os_random(&mut nonce).map_err(|e| e.to_string())?;
        // eigen XChaCha20-Poly1305 (24-byte nonce -> nonce-hergebruik praktisch
        // onmogelijk bij willekeurige nonces). De codenaam gaat als AAD mee, zodat
        // het blob niet naar een ander slot te verplaatsen is.
        let ct = aead::xseal(&self.sleutels[versie], &nonce, key.as_bytes(), klaartekst.as_bytes());
        let mut blob = Vec::with_capacity(1 + NONCE_LEN + ct.len());
        blob.push(versie as u8);
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&ct);
        self.store.insert(key.to_string(), blob);
        self.vuil = true;
        Ok(())
    }

    /* Ontsleutel één blob met de keyring en de codenaam als AAD. Los gehouden van
       `onthul` zodat de rotatie hem kan hergebruiken zonder de String-omweg. */
    fn ontcijfer(&self, key: &str, blob: &[u8]) -> Option<Vec<u8>> {
        if blob.len() < 1 + NONCE_LEN {
            return None;
        }
        let versie = blob[0] as usize;
        let sleutel = self.sleutels.get(versie)?;
        let nonce = &blob[1..1 + NONCE_LEN];
        let ct = &blob[1 + NONCE_LEN..];
        let mut n = [0u8; NONCE_LEN];
        n.copy_from_slice(nonce);
        aead::xopen(sleutel, &n, key.as_bytes(), ct)
    }

    /* Onthul de echte gegevens (de gevoelige handeling; in productie zit hier de
       eigenaar-/toestemmingspoort van de Node-laag voor). Een gewijzigd blob, of
       een blob dat onder een andere codenaam is verzegeld, faalt de
       AEAD-authenticatie en geeft None. */
    pub fn onthul(&self, key: &str) -> Option<String> {
        let blob = self.store.get(key)?;
        let pt = self.ontcijfer(key, blob)?;
        String::from_utf8(pt).ok()
    }

    /* Roteer de sleutel: genereer een verse sleutel, zet hem als nieuwe actieve
       sleutel, en hersleutel ALLE records ernaartoe. Crash-veilig: de nieuwe
       keyring gaat EERST naar schijf (fsync) voordat we ook maar één record
       aanraken. Elke tussenstand is leesbaar, want elk blob draagt zijn eigen
       versie-byte en alle versies staan op schijf.

       Records die -- om welke reden dan ook -- niet meer ontsleutelen (corrupt,
       of onder een verdwenen versie) laten we ongemoeid op hun oude blob staan:
       rotatie mag nooit data vernietigen. */
    pub fn roteer_sleutel(&mut self) -> Result<usize, String> {
        if self.sleutels.len() >= MAX_SLEUTELS {
            return Err(format!(
                "Keyring vol ({} sleutels); versie past in 1 byte. Comprimeer eerst.",
                MAX_SLEUTELS
            ));
        }
        let mut nieuw = [0u8; SLEUTEL_LEN];
        aead::os_random(&mut nieuw).map_err(|e| e.to_string())?;
        self.sleutels.push(nieuw);
        let versie = self.actieve_versie();

        // 1) keyring EERST duurzaam op schijf -- vóór enig record hersleuteld is.
        schrijf_keyring(&self.sleutel_pad, &self.sleutels).map_err(|e| e.to_string())?;

        // 2) hersleutel elk record naar de nieuwe versie, gebonden aan zijn codenaam.
        let keys: Vec<String> = self.store.keys().cloned().collect();
        let mut hersleuteld = 0usize;
        for key in keys {
            let oud = match self.store.get(&key) {
                Some(b) => b.clone(),
                None => continue,
            };
            let klaar = match self.ontcijfer(&key, &oud) {
                Some(pt) => pt,
                None => continue, // onleesbaar record: niet aanraken (nooit data verliezen)
            };
            let mut nonce = [0u8; NONCE_LEN];
            aead::os_random(&mut nonce).map_err(|e| e.to_string())?;
            let ct = aead::xseal(&self.sleutels[versie], &nonce, key.as_bytes(), &klaar);
            let mut blob = Vec::with_capacity(1 + NONCE_LEN + ct.len());
            blob.push(versie as u8);
            blob.extend_from_slice(&nonce);
            blob.extend_from_slice(&ct);
            self.store.insert(key, blob);
            hersleuteld += 1;
        }

        self.vingerafdruk = vingerafdruk(&self.sleutels[versie]);
        self.vuil = true;
        Ok(hersleuteld)
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
    /* Aantal sleutels in de keyring (= hoogste versie + 1). Voor de status. */
    pub fn sleutelversies(&self) -> usize {
        self.sleutels.len()
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

impl Drop for Kluis {
    /* Wis ALLE sleutels uit het geheugen bij afsluiten, zodat ze niet in een
       core-dump of vrijgegeven geheugen blijven staan. black_box zorgt dat de
       compiler het wissen niet wegoptimaliseert (de bytes worden immers daarna
       niet meer gelezen). */
    fn drop(&mut self) {
        for sleutel in self.sleutels.iter_mut() {
            for b in sleutel.iter_mut() {
                *b = 0;
            }
            std::hint::black_box(&*sleutel);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("kluis-test-{}-{}", std::process::id(), super::vingerafdruk(&[rand_byte(), rand_byte(), rand_byte(), rand_byte()])));
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

    /* Context-binding: een blob dat onder codenaam A is verzegeld mag NIET onder
       codenaam B te lezen zijn, ook niet als een aanvaller het versleutelde blob
       letterlijk naar het andere slot kopieert. De codenaam zit als AAD in de
       authenticatie. */
    #[test]
    fn blob_verplaatsen_naar_ander_slot_faalt() {
        let d = tmp();
        let mut k = Kluis::open(&d.join("secret.key"), &d.join("kluis.json")).unwrap();
        k.bewaar("NEVEL", "dossier van nevel").unwrap();
        k.bewaar("SPOOK", "dossier van spook").unwrap();
        // kopieer het blob van NEVEL letterlijk naar het slot van SPOOK
        let nevel_blob = k.store.get("NEVEL").unwrap().clone();
        k.store.insert("SPOOK".to_string(), nevel_blob);
        // NEVEL leest nog gewoon...
        assert_eq!(k.onthul("NEVEL").unwrap(), "dossier van nevel");
        // ...maar onder SPOOK faalt de AAD-authenticatie: geen record-verwisseling.
        assert!(k.onthul("SPOOK").is_none(), "een verplaatst blob mag onder een andere codenaam niet te lezen zijn");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Rotatie: na roteren stijgt de versie, blijven alle records leesbaar, en
       overleeft alles een dicht/open-cyclus met de op schijf bewaarde keyring. */
    #[test]
    fn rotatie_behoudt_data_en_verhoogt_versie() {
        let d = tmp();
        let kp = d.join("secret.key");
        let dp = d.join("kluis.json");
        {
            let mut k = Kluis::open(&kp, &dp).unwrap();
            k.bewaar("NEVEL", "geheim een").unwrap();
            k.bewaar("SPOOK", "geheim twee").unwrap();
            assert_eq!(k.sleutelversies(), 1);
            let vaf_voor = k.vingerafdruk().to_string();

            let n = k.roteer_sleutel().unwrap();
            assert_eq!(n, 2, "beide records hersleuteld");
            assert_eq!(k.sleutelversies(), 2, "keyring is gegroeid");
            assert_ne!(k.vingerafdruk(), vaf_voor, "actieve sleutel is veranderd");
            // meteen na rotatie nog steeds leesbaar (nu onder de nieuwe versie)
            assert_eq!(k.onthul("NEVEL").unwrap(), "geheim een");
            assert_eq!(k.onthul("SPOOK").unwrap(), "geheim twee");
            // de nieuwe blobs dragen versie 1
            assert_eq!(k.store.get("NEVEL").unwrap()[0], 1);
            std::fs::write(&dp, k.snapshot().dump()).unwrap();
        }
        // heropen puur van schijf: de keyring (2 sleutels) is bewaard, alles leest.
        let k2 = Kluis::open(&kp, &dp).unwrap();
        assert_eq!(k2.sleutelversies(), 2, "keyring van schijf herladen");
        assert_eq!(k2.onthul("NEVEL").unwrap(), "geheim een");
        assert_eq!(k2.onthul("SPOOK").unwrap(), "geheim twee");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Crash-veiligheid: een record dat onder een OUDE versie is opgeslagen (voor
       de rotatie) blijft leesbaar zolang die oude sleutel in de keyring staat.
       Zo overleeft een crash midden in een rotatie: de keyring staat al op schijf
       en oude blobs wijzen naar sleutels die er nog zijn. */
    #[test]
    fn oude_versie_blijft_leesbaar_na_rotatie() {
        let d = tmp();
        let kp = d.join("secret.key");
        let dp = d.join("kluis.json");
        let mut k = Kluis::open(&kp, &dp).unwrap();
        k.bewaar("NEVEL", "onder versie nul").unwrap();
        assert_eq!(k.store.get("NEVEL").unwrap()[0], 0);
        // simuleer "crash na keyring-schrijven, voor hersleutelen": voeg met de hand
        // een nieuwe sleutel toe en schrijf de keyring, maar laat het blob op v0.
        let mut nieuw = [0u8; SLEUTEL_LEN];
        aead::os_random(&mut nieuw).unwrap();
        k.sleutels.push(nieuw);
        super::schrijf_keyring(&kp, &k.sleutels).unwrap();
        std::fs::write(&dp, k.snapshot().dump()).unwrap();
        drop(k);
        // heropen: v0-blob wijst nog naar keyring[0], dus leesbaar.
        let k2 = Kluis::open(&kp, &dp).unwrap();
        assert_eq!(k2.sleutelversies(), 2);
        assert_eq!(k2.onthul("NEVEL").unwrap(), "onder versie nul", "een oud blob moet leesbaar blijven zolang de sleutel in de keyring staat");
        std::fs::remove_dir_all(&d).ok();
    }
}
