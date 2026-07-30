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
const PAD_BUCKET: usize = 64; // klaartekst wordt naar een veelvoud hiervan gepad
const MANIFEST_KEY: &str = "__manifest__"; // gereserveerde sleutel: geen record
const MANIFEST_AAD: &[u8] = b"rtg-kluis-manifest-v1";

pub struct Kluis {
    sleutels: Vec<[u8; SLEUTEL_LEN]>, // keyring; actief = laatste
    sleutel_pad: PathBuf,
    vingerafdruk: String,
    store: HashMap<String, Vec<u8>>, // key -> [versie:1] || nonce:24 || ciphertext+tag
    pad: PathBuf,
    generatie: u64,      // monotone teller; leeft ook in het sleutelbestand
    pub geknoeid: bool,  // true = manifest klopt niet (record gewist of teruggerold)
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

/* Lengte-verhulling: pad de klaartekst tot een veelvoud van PAD_BUCKET met een
   4-byte lengteprefix, zodat de ciphertext-lengte alleen de emmer verraadt en
   niet de exacte recordgrootte (een BSN, een naam en een heel dossier zien er op
   schijf even groot uit binnen dezelfde emmer). */
fn pad_klaar(data: &[u8]) -> Vec<u8> {
    let netto = 4 + data.len();
    let vol = ((netto + PAD_BUCKET - 1) / PAD_BUCKET) * PAD_BUCKET;
    let mut uit = Vec::with_capacity(vol);
    uit.extend_from_slice(&(data.len() as u32).to_le_bytes());
    uit.extend_from_slice(data);
    uit.resize(vol, 0);
    uit
}
fn unpad_klaar(padded: &[u8]) -> Option<Vec<u8>> {
    if padded.len() < 4 {
        return None;
    }
    let len = u32::from_le_bytes([padded[0], padded[1], padded[2], padded[3]]) as usize;
    if 4 + len > padded.len() {
        return None;
    }
    Some(padded[4..4 + len].to_vec())
}

/* Niet-omkeerbare vingerafdruk van de ACTIEVE sleutel voor de status (nooit de
   sleutel zelf). Dit gaat via aead::sleutel_afdruk (een ChaCha20-blok onder een
   vaste nonce), niet via een FNV-mix: de afdruk staat in /api/kluis/status en in
   het opstartlog, dus hij moet echt niets over de sleutel prijsgeven. Genoeg om
   "draaien we nog op dezelfde sleutel?" te zien. */
fn vingerafdruk(sleutel: &[u8; SLEUTEL_LEN]) -> String {
    naar_hex(&aead::sleutel_afdruk(sleutel))
}

/* Schrijf de keyring atomair naar schijf: alle sleutels als hex, één per regel,
   oudste eerst. Temp-bestand + fsync + rename, zodat de keyring nooit half op
   schijf staat. Rechten 600 (alleen de eigenaar). Dit MOET slagen vóór we
   records hersleutelen, anders zou een crash een blob naar een sleutel laten
   wijzen die de schijf niet kent. */
fn schrijf_keyring(pad: &Path, sleutels: &[[u8; SLEUTEL_LEN]], generatie: u64) -> io::Result<()> {
    if let Some(dir) = pad.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let mut tekst = String::with_capacity(sleutels.len() * (SLEUTEL_LEN * 2 + 1) + 16);
    for k in sleutels {
        tekst.push_str(&naar_hex(k));
        tekst.push('\n');
    }
    // de generatie is het anti-terugrol-anker: hij leeft NAAST de datafile, zodat
    // een teruggerolde datafile (met een oudere manifest-generatie) opvalt.
    tekst.push_str(&format!("gen {}\n", generatie));
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
fn laad_of_maak_keyring(pad: &Path) -> io::Result<(Vec<[u8; SLEUTEL_LEN]>, u64)> {
    /* De keyring krijgt direct zijn maximale capaciteit. Dat is geen
       micro-optimalisatie maar hygiene: zou de Vec later hergroeien (bij
       `roteer_sleutel`), dan kopieert hij zijn inhoud naar een nieuwe buffer en
       geeft de OUDE ongewist vrij -- met alle sleutels er nog in. Drop wist
       alleen de buffer die de Vec op dat moment vasthoudt. Met de capaciteit
       vooraf gebeurt die hergroei nooit. 255 x 32 byte is 8 KB, verwaarloosbaar. */
    if let Ok(tekst) = fs::read_to_string(pad) {
        let mut ring = Vec::with_capacity(MAX_SLEUTELS);
        let mut generatie: u64 = 0;
        for regel in tekst.lines() {
            let regel = regel.trim();
            if regel.is_empty() {
                continue;
            }
            if let Some(g) = regel.strip_prefix("gen ") {
                generatie = g.trim().parse().unwrap_or(0);
                continue;
            }
            if let Some(b) = van_hex(regel) {
                if b.len() == SLEUTEL_LEN && ring.len() < MAX_SLEUTELS {
                    let mut k = [0u8; SLEUTEL_LEN];
                    k.copy_from_slice(&b);
                    ring.push(k);
                }
            }
        }
        if !ring.is_empty() {
            return Ok((ring, generatie));
        }
    }
    let mut k = [0u8; SLEUTEL_LEN];
    aead::os_random(&mut k)?;
    let mut ring = Vec::with_capacity(MAX_SLEUTELS);
    ring.push(k);
    schrijf_keyring(pad, &ring, 0)?;
    Ok((ring, 0))
}

impl Kluis {
    pub fn open(sleutel_pad: &Path, data_pad: &Path) -> io::Result<Kluis> {
        let (sleutels, keyring_gen) = laad_of_maak_keyring(sleutel_pad)?;
        let vaf = vingerafdruk(&sleutels[sleutels.len() - 1]);
        let mut store = HashMap::new();
        let mut manifest_blob: Option<Vec<u8>> = None;
        if let Ok(tekst) = fs::read_to_string(data_pad) {
            if let Ok(Json::Obj(m)) = crate::json::parse(&tekst) {
                for (k, v) in m {
                    if let Some(h) = v.as_str() {
                        if let Some(b) = van_hex(h) {
                            if k == MANIFEST_KEY {
                                manifest_blob = Some(b);
                            } else {
                                store.insert(k, b);
                            }
                        }
                    }
                }
            }
        }
        let mut k = Kluis {
            sleutels,
            sleutel_pad: sleutel_pad.to_path_buf(),
            vingerafdruk: vaf,
            store,
            pad: data_pad.to_path_buf(),
            generatie: keyring_gen,
            geknoeid: false,
            vuil: false,
        };
        // Integriteit van de HELE kluis (niet alleen per record): controleer het
        // gezegelde manifest. Zo valt op als iemand met schijftoegang een record
        // WIST, een record TOEVOEGT, of de datafile TERUGROLT naar een oudere
        // snapshot. Geen manifest (verse/oude kluis) = niets te controleren.
        if let Some(blob) = manifest_blob {
            match k.verifieer_manifest(&blob, keyring_gen) {
                Some(gen) => { k.geknoeid = false; k.generatie = gen.max(keyring_gen); }
                None => { k.geknoeid = true; }
            }
        }
        /* Bewuste ontsnapping voor de operator: na onderzoek (of bij een bekende,
           verklaarde afwijking) kan de kluis weer schrijfbaar worden gezet. Dit
           is expliciet en luid, niet stil -- en het is de enige weg terug. */
        if k.geknoeid && std::env::var("RTG_KLUIS_NEGEER_GEKNOEID").as_deref() == Ok("1") {
            eprintln!("[kluis] LET OP: manifest klopt niet, maar RTG_KLUIS_NEGEER_GEKNOEID=1 -- schrijven blijft toegestaan.");
            k.geknoeid = false;
        }
        Ok(k)
    }

    fn actieve_versie(&self) -> usize {
        self.sleutels.len() - 1
    }

    /* Het schrijfslot. Zodra het manifest niet klopt (record gewist, toegevoegd,
       of de datafile teruggerold) gaat de kluis op read-only.

       Waarom dat moet: `momentopname` bumpt de generatie en zegelt een VERS
       manifest over de huidige recordset. Zonder dit slot zou de eerste flush na
       een manipulatie dus een geldig manifest over de gemanipuleerde stand
       schrijven -- de detectie wist dan haar eigen bewijs uit en de kluis meldt
       weer "ok". Lezen blijft wel gewoon werken: een valse melding mag het
       platform niet stilleggen, en `onthul` verandert niets op schijf.

       Vrijgeven doet een operator bewust, met RTG_KLUIS_NEGEER_GEKNOEID=1 (dat
       zet `geknoeid` bij het openen niet). */
    fn schrijfslot(&self) -> Result<(), String> {
        if self.geknoeid {
            return Err("Kluis staat op GEKNOEID (manifest klopt niet): schrijven geweigerd om het bewijs te bewaren. Onderzoek de datafile; zet RTG_KLUIS_NEGEER_GEKNOEID=1 om bewust door te gaan.".into());
        }
        Ok(())
    }

    /// Mag er naar schijf geschreven worden? De flusher vraagt dit voor hij zegelt.
    pub fn mag_schrijven(&self) -> bool {
        !self.geknoeid
    }

    // Canonieke manifest-bytes: generatie (8 LE) || gesorteerde recordsleutels
    // met \n ertussen. Dit is wat we verzegelen en bij open weer natellen.
    fn manifest_bytes(&self, generatie: u64) -> Vec<u8> {
        let mut keys: Vec<&String> = self.store.keys().collect();
        keys.sort();
        let mut uit = Vec::new();
        uit.extend_from_slice(&generatie.to_le_bytes());
        for (i, key) in keys.iter().enumerate() {
            if i > 0 {
                uit.push(b'\n');
            }
            uit.extend_from_slice(key.as_bytes());
        }
        uit
    }

    // Verzegel het manifest met de actieve sleutel (AAD = vaste domeinscheider).
    fn verzegel_manifest(&self, generatie: u64) -> Vec<u8> {
        let versie = self.actieve_versie();
        let mut nonce = [0u8; NONCE_LEN];
        let _ = aead::os_random(&mut nonce);
        let ct = aead::xseal(&self.sleutels[versie], &nonce, MANIFEST_AAD, &self.manifest_bytes(generatie));
        let mut blob = Vec::with_capacity(1 + NONCE_LEN + ct.len());
        blob.push(versie as u8);
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&ct);
        blob
    }

    /* Verifieer het manifest tegen de huidige recordset en de keyring-generatie.
       Geeft de manifest-generatie terug als alles klopt, anders None (geknoeid).

       Anti-terugrol: `manifest.gen >= keyring.gen`. De keyring bewaart de hoogste
       generatie die ooit duurzaam bedoeld was; we schrijven eerst de datafile en
       daarna pas de keyring, dus na een crash kan de datafile één generatie VOOR
       lopen (dat is OK), maar nooit ACHTER (dat = terugrol). Een oudere datafile
       terugzetten valt zo op. (Restrisico: wie ook de keyring-sidecar terugrolt
       naar exact dezelfde oude generatie krijgt een oude-maar-consistente stand;
       forgen of records mengen lukt daarmee nog steeds niet.) */
    fn verifieer_manifest(&self, blob: &[u8], keyring_gen: u64) -> Option<u64> {
        if blob.len() < 1 + NONCE_LEN {
            return None;
        }
        let versie = blob[0] as usize;
        let sleutel = self.sleutels.get(versie)?;
        let mut n = [0u8; NONCE_LEN];
        n.copy_from_slice(&blob[1..1 + NONCE_LEN]);
        let klaar = aead::xopen(sleutel, &n, MANIFEST_AAD, &blob[1 + NONCE_LEN..])?; // vervalst -> None
        if klaar.len() < 8 {
            return None;
        }
        let gen = u64::from_le_bytes([klaar[0], klaar[1], klaar[2], klaar[3], klaar[4], klaar[5], klaar[6], klaar[7]]);
        if gen < keyring_gen {
            return None; // terugrol
        }
        if klaar != self.manifest_bytes(gen) {
            return None; // record gewist/toegevoegd/verwisseld
        }
        Some(gen)
    }

    /* Bewaar (of overschrijf) de echte gegevens voor een sleutel/codenaam,
       versleuteld met de ACTIEVE sleutel en gebonden aan de codenaam (AAD). De
       klaartekst raakt de schijf nooit onversleuteld. */
    pub fn bewaar(&mut self, key: &str, klaartekst: &str) -> Result<(), String> {
        if let Err(e) = self.schrijfslot() {
            return Err(e);
        }
        if key.is_empty() {
            return Err("Geen sleutel.".into());
        }
        if key == MANIFEST_KEY {
            return Err("Gereserveerde sleutel.".into());
        }
        let versie = self.actieve_versie();
        let blob = self.verzegel_record(versie, key, klaartekst.as_bytes())?;
        self.store.insert(key.to_string(), blob);
        self.vuil = true;
        Ok(())
    }

    /* Verzegel één record: pad de klaartekst (lengte-verhulling), versleutel met
       de opgegeven sleutelversie en bind hem aan de codenaam (AAD). Gedeeld door
       `bewaar` en de rotatie, zodat de padding overal consistent is. */
    fn verzegel_record(&self, versie: usize, key: &str, data: &[u8]) -> Result<Vec<u8>, String> {
        let mut nonce = [0u8; NONCE_LEN];
        aead::os_random(&mut nonce).map_err(|e| e.to_string())?;
        // eigen XChaCha20-Poly1305 (24-byte nonce -> nonce-hergebruik praktisch
        // onmogelijk bij willekeurige nonces). De codenaam gaat als AAD mee, zodat
        // het blob niet naar een ander slot te verplaatsen is. De klaartekst is
        // eerst gepad naar een emmer zodat de lengte niets verraadt.
        let ct = aead::xseal(&self.sleutels[versie], &nonce, key.as_bytes(), &pad_klaar(data));
        let mut blob = Vec::with_capacity(1 + NONCE_LEN + ct.len());
        blob.push(versie as u8);
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&ct);
        Ok(blob)
    }

    /* Ontsleutel één blob met de keyring en de codenaam als AAD, en haal de
       padding eraf. Los gehouden van `onthul` zodat de rotatie hem kan hergebruiken
       zonder de String-omweg. */
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
        let gepad = aead::xopen(sleutel, &n, key.as_bytes(), ct)?;
        unpad_klaar(&gepad)
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
        self.schrijfslot()?;
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

        // 1) keyring EERST duurzaam op schijf (met de huidige generatie) -- vóór
        //    enig record hersleuteld is.
        schrijf_keyring(&self.sleutel_pad, &self.sleutels, self.generatie).map_err(|e| e.to_string())?;

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
            let blob = self.verzegel_record(versie, &key, &klaar)?;
            self.store.insert(key, blob);
            hersleuteld += 1;
        }

        self.vingerafdruk = vingerafdruk(&self.sleutels[versie]);
        self.vuil = true;
        Ok(hersleuteld)
    }

    /// Wis een record. Weigert (false) zolang de kluis op geknoeid staat.
    pub fn wis(&mut self, key: &str) -> bool {
        if self.geknoeid {
            return false;
        }
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

    // Rauwe records-dump zonder manifest (voor tests/inspectie). Nooit klaartekst.
    pub fn snapshot(&self) -> Json {
        let mut o = Json::obj();
        if let Json::Obj(m) = &mut o {
            for (k, blob) in &self.store {
                m.insert(k.clone(), Json::Str(naar_hex(blob)));
            }
        }
        o
    }

    /* De durabele momentopname: bump de generatie en zegel een vers manifest mee.
       Schrijft de keyring NIET (dat doet `anker`, ná de datafile) -- zo loopt de
       datafile na een crash hooguit vóór op de keyring, nooit achter (geen valse
       terugrol-melding). Geeft de JSON die de flusher naar schijf schrijft. */
    pub fn momentopname(&mut self) -> Json {
        self.generatie += 1;
        let manifest = self.verzegel_manifest(self.generatie);
        let mut o = Json::obj();
        if let Json::Obj(m) = &mut o {
            for (k, blob) in &self.store {
                m.insert(k.clone(), Json::Str(naar_hex(blob)));
            }
            m.insert(MANIFEST_KEY.to_string(), Json::Str(naar_hex(&manifest)));
        }
        o
    }

    /* Anker de generatie: schrijf de keyring met de huidige generatie als hoogste
       waarmerk. Roep dit ná het wegschrijven van de datafile aan. */
    pub fn anker(&self) -> io::Result<()> {
        schrijf_keyring(&self.sleutel_pad, &self.sleutels, self.generatie)
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
        let suffix = super::naar_hex(&[rand_byte(), rand_byte(), rand_byte(), rand_byte()]);
        let d = std::env::temp_dir().join(format!("kluis-test-{}-{}", std::process::id(), suffix));
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
        super::schrijf_keyring(&kp, &k.sleutels, 0).unwrap();
        std::fs::write(&dp, k.snapshot().dump()).unwrap();
        drop(k);
        // heropen: v0-blob wijst nog naar keyring[0], dus leesbaar.
        let k2 = Kluis::open(&kp, &dp).unwrap();
        assert_eq!(k2.sleutelversies(), 2);
        assert_eq!(k2.onthul("NEVEL").unwrap(), "onder versie nul", "een oud blob moet leesbaar blijven zolang de sleutel in de keyring staat");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Lengte-verhulling: een kort en een lang record binnen dezelfde emmer zijn
       op schijf even groot. Zo verraadt de blob-lengte niet hoe groot het dossier
       is (een leeg profiel vs een vol dossier). */
    #[test]
    fn padding_verhult_lengte() {
        let d = tmp();
        let mut k = Kluis::open(&d.join("secret.key"), &d.join("kluis.json")).unwrap();
        k.bewaar("A", "x").unwrap();               // 1 byte
        k.bewaar("B", "xxxxxxxxxxxxxxxxxxxx").unwrap(); // 20 bytes, zelfde emmer (<64)
        assert_eq!(k.store.get("A").unwrap().len(), k.store.get("B").unwrap().len(),
            "records in dezelfde emmer moeten even groot zijn op schijf");
        assert_eq!(k.onthul("A").unwrap(), "x");
        assert_eq!(k.onthul("B").unwrap(), "xxxxxxxxxxxxxxxxxxxx");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Manifest: na een momentopname met manifest detecteert open() dat een record
       op schijf is GEWIST (record-set klopt niet meer). */
    #[test]
    fn manifest_betrapt_gewist_record() {
        let d = tmp();
        let kp = d.join("secret.key");
        let dp = d.join("kluis.json");
        {
            let mut k = Kluis::open(&kp, &dp).unwrap();
            k.bewaar("NEVEL", "een").unwrap();
            k.bewaar("SPOOK", "twee").unwrap();
            let json = k.momentopname().dump();
            std::fs::write(&dp, json).unwrap();
            k.anker().unwrap();
        }
        // schone heropen: niet geknoeid
        assert_eq!(Kluis::open(&kp, &dp).unwrap().geknoeid, false);
        // wis met de hand een record uit de datafile (attacker met schijftoegang)
        let tekst = std::fs::read_to_string(&dp).unwrap();
        if let Ok(Json::Obj(mut m)) = crate::json::parse(&tekst) {
            m.remove("SPOOK");
            let mut o = Json::obj();
            if let Json::Obj(nw) = &mut o { *nw = m; }
            std::fs::write(&dp, o.dump()).unwrap();
        }
        let k2 = Kluis::open(&kp, &dp).unwrap();
        assert!(k2.geknoeid, "een gewist record moet als geknoeid opvallen");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Manifest: een TERUGGEROLDE datafile (oude generatie, keyring is verder)
       valt op als geknoeid. */
    #[test]
    fn manifest_betrapt_terugrol() {
        let d = tmp();
        let kp = d.join("secret.key");
        let dp = d.join("kluis.json");
        let oud_bestand;
        {
            let mut k = Kluis::open(&kp, &dp).unwrap();
            k.bewaar("NEVEL", "versie een").unwrap();
            std::fs::write(&dp, k.momentopname().dump()).unwrap();
            k.anker().unwrap();
            oud_bestand = std::fs::read_to_string(&dp).unwrap(); // generatie 1
            // nog een momentopname -> generatie 2, keyring ankert op 2
            k.bewaar("NEVEL", "versie twee").unwrap();
            std::fs::write(&dp, k.momentopname().dump()).unwrap();
            k.anker().unwrap();
        }
        // normaal heropenen: niet geknoeid
        assert_eq!(Kluis::open(&kp, &dp).unwrap().geknoeid, false);
        // rol de datafile terug naar generatie 1 (keyring staat nog op 2)
        std::fs::write(&dp, oud_bestand).unwrap();
        let k2 = Kluis::open(&kp, &dp).unwrap();
        assert!(k2.geknoeid, "een teruggerolde datafile moet als geknoeid opvallen");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Sleutel-hygiene: de keyring mag nooit hergroeien, want dan blijft de oude
       buffer met alle sleutels ongewist in de vrijgegeven heap achter (Drop wist
       alleen de huidige buffer). Na een reeks rotaties moet de capaciteit dus nog
       steeds de oorspronkelijke zijn, en moet elke sleutel nog werken. */
    #[test]
    fn keyring_hergroeit_nooit_bij_rotatie() {
        let d = tmp();
        let mut k = Kluis::open(&d.join("secret.key"), &d.join("kluis.json")).unwrap();
        let cap_begin = k.sleutels.capacity();
        assert!(cap_begin >= MAX_SLEUTELS, "keyring start met volle capaciteit");
        k.bewaar("NEVEL", "geheim").unwrap();
        for _ in 0..12 {
            k.roteer_sleutel().unwrap();
        }
        assert_eq!(k.sleutels.capacity(), cap_begin, "de buffer mag niet zijn verhuisd");
        assert_eq!(k.sleutelversies(), 13);
        assert_eq!(k.onthul("NEVEL").unwrap(), "geheim", "record blijft leesbaar na rotaties");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Een geknoeide kluis gaat op read-only. Zonder dat slot zou de eerstvolgende
       momentopname een GELDIG manifest over de gemanipuleerde recordset zegelen:
       de detectie wist dan haar eigen bewijs uit en na een herstart meldt de
       kluis weer "ok" -- met de wissing van de aanvaller er stilletjes in
       gebakken. Lezen moet wel blijven werken. */
    #[test]
    fn geknoeide_kluis_is_read_only_en_wist_geen_bewijs() {
        let d = tmp();
        let kp = d.join("secret.key");
        let dp = d.join("kluis.json");
        {
            let mut k = Kluis::open(&kp, &dp).unwrap();
            k.bewaar("NEVEL", "een").unwrap();
            k.bewaar("SPOOK", "twee").unwrap();
            std::fs::write(&dp, k.momentopname().dump()).unwrap();
            k.anker().unwrap();
        }
        // aanvaller met schijftoegang wist SPOOK uit de datafile
        let tekst = std::fs::read_to_string(&dp).unwrap();
        if let Ok(Json::Obj(mut m)) = crate::json::parse(&tekst) {
            m.remove("SPOOK");
            let mut o = Json::obj();
            if let Json::Obj(nw) = &mut o { *nw = m; }
            std::fs::write(&dp, o.dump()).unwrap();
        }

        let mut k2 = Kluis::open(&kp, &dp).unwrap();
        assert!(k2.geknoeid, "de wissing moet opvallen");
        assert!(!k2.mag_schrijven(), "een geknoeide kluis mag niet meer schrijven");

        // lezen blijft werken (een valse melding mag het platform niet stilleggen)
        assert_eq!(k2.onthul("NEVEL").unwrap(), "een");

        // en elke schrijfweg is dicht
        assert!(k2.bewaar("NIEUW", "x").is_err(), "bewaar moet geweigerd worden");
        assert!(!k2.wis("NEVEL"), "wissen moet geweigerd worden");
        assert!(k2.roteer_sleutel().is_err(), "roteren moet geweigerd worden");
        assert!(k2.onthul("NEVEL").is_some(), "het record staat er nog");

        // heropenen blijft geknoeid melden: het bewijs is niet weggepoetst
        drop(k2);
        assert!(Kluis::open(&kp, &dp).unwrap().geknoeid, "na heropenen nog steeds geknoeid");
        std::fs::remove_dir_all(&d).ok();
    }

    /* Manifest overleeft een crash TUSSEN datafile en keyring-anker: de datafile
       loopt dan één generatie voor -> dat is geen terugrol en mag niet als
       geknoeid gelden. */
    #[test]
    fn manifest_geen_valse_melding_bij_crash_voor_anker() {
        let d = tmp();
        let kp = d.join("secret.key");
        let dp = d.join("kluis.json");
        {
            let mut k = Kluis::open(&kp, &dp).unwrap();
            k.bewaar("NEVEL", "een").unwrap();
            // schrijf WEL de datafile (generatie 1) maar anker de keyring NIET
            std::fs::write(&dp, k.momentopname().dump()).unwrap();
            // (geen k.anker() -> simuleert crash voor het anker)
        }
        let k2 = Kluis::open(&kp, &dp).unwrap();
        assert_eq!(k2.geknoeid, false, "datafile één generatie voor is normaal na een crash, geen terugrol");
        assert_eq!(k2.onthul("NEVEL").unwrap(), "een");
        std::fs::remove_dir_all(&d).ok();
    }
}
