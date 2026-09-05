/* Duurzame, revisiegeordende snapshotpoort van de geldmotor. */
use crate::json::{self, Json};
use crate::pay::State;
use crate::snapshotkluis::Ring;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Clone, Debug)]
pub struct Stand {
    pub snapshot_geladen: bool,
    pub snapshot_geldig: bool,
    pub laatste_schrijf_fout: Option<String>,
    pub laatste_duurzame_revisie: u64,
    pub genesis_id: Option<String>,
    pub sleutel_id: Option<String>,
    pub versleuteld: bool,
}

impl Stand {
    pub fn vers() -> Stand {
        Stand { snapshot_geladen: false, snapshot_geldig: false,
            laatste_schrijf_fout: None, laatste_duurzame_revisie: 0,
            genesis_id: None, sleutel_id: None, versleuteld: false }
    }

    pub fn gereed(&self, huidige_revisie: u64, vuil: bool) -> bool {
        self.snapshot_geladen && self.snapshot_geldig && self.versleuteld &&
            self.genesis_id.is_some() && self.sleutel_id.is_some() && self.laatste_schrijf_fout.is_none() &&
            !vuil && self.laatste_duurzame_revisie == huidige_revisie
    }

    pub fn json(&self, huidige_revisie: u64, vuil: bool) -> Json {
        let mut j = Json::obj();
        j.set("gereed", Json::Bool(self.gereed(huidige_revisie, vuil)))
            .set("snapshotGeladen", Json::Bool(self.snapshot_geladen))
            .set("snapshotGeldig", Json::Bool(self.snapshot_geldig))
            .set("versleuteld", Json::Bool(self.versleuteld))
            .set("algoritme", Json::Str("XChaCha20-Poly1305".into()))
            .set("genesisId", self.genesis_id.clone().map(Json::Str).unwrap_or(Json::Null))
            .set("keyId", self.sleutel_id.clone().map(Json::Str).unwrap_or(Json::Null))
            .set("laatsteSchrijfFout", self.laatste_schrijf_fout.clone().map(Json::Str).unwrap_or(Json::Null))
            .set("huidigeRevisie", Json::Num(huidige_revisie as f64))
            .set("laatsteDuurzameRevisie", Json::Num(self.laatste_duurzame_revisie as f64));
        j
    }
}

fn marker_pad(pad: &Path) -> PathBuf {
    let mut naam = pad.as_os_str().to_os_string();
    naam.push(".init");
    PathBuf::from(naam)
}

fn sync_dir(pad: &Path) -> std::io::Result<()> {
    if let Some(dir) = pad.parent() { fs::File::open(dir)?.sync_all()?; }
    Ok(())
}

fn zorg_marker(pad: &Path) -> std::io::Result<()> {
    let marker = marker_pad(pad);
    if marker.exists() { return Ok(()); }
    let mut f = match OpenOptions::new().create_new(true).write(true).open(&marker) {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => return Ok(()),
        Err(e) => return Err(e),
    };
    f.write_all(b"rtg-motor-state-v1\n")?;
    f.sync_all()?;
    drop(f);
    sync_dir(&marker)
}

fn schrijf_bestand(pad: &Path, tekst: &str) -> std::io::Result<()> {
    if let Some(dir) = pad.parent() { fs::create_dir_all(dir)?; }
    zorg_marker(pad)?;
    let tmp = pad.with_extension("tmp");
    let mut bestand = OpenOptions::new().create(true).truncate(true).write(true).open(&tmp)?;
    bestand.write_all(tekst.as_bytes())?;
    bestand.sync_all()?;
    drop(bestand);
    fs::rename(&tmp, pad)?;
    sync_dir(pad)
}

/* `slot` omvat revisiecheck en rename: een oude schrijver kan niet inhalen. */
pub fn schrijf_indien_nieuwer(pad: &Path, tekst: &str, revisie: u64, ring: &Ring,
    slot: &Mutex<()>, stand: &Mutex<Stand>) -> Result<bool, String> {
    let _bestand = slot.lock().map_err(|_| "snapshotslot is vergiftigd".to_string())?;
    {
        let s = stand.lock().map_err(|_| "duurzaamheidsstatus is vergiftigd".to_string())?;
        if revisie < s.laatste_duurzame_revisie { return Ok(false); }
    }
    let genesis = stand.lock().map_err(|_| "duurzaamheidsstatus is vergiftigd".to_string())?
        .genesis_id.clone().ok_or("geldvolume heeft geen geïnitialiseerd genesis-id")?;
    let envelop = match ring.verzegel(&genesis, tekst.as_bytes()) {
        Ok(v) => v,
        Err(e) => { if let Ok(mut s) = stand.lock() { s.laatste_schrijf_fout = Some(e.clone()); } return Err(e); }
    };
    match schrijf_bestand(pad, &envelop) {
        Ok(()) => {
            let mut s = stand.lock().map_err(|_| "duurzaamheidsstatus is vergiftigd".to_string())?;
            s.snapshot_geldig = true;
            s.versleuteld = true;
            s.sleutel_id = Some(ring.actief_id().into());
            s.laatste_schrijf_fout = None;
            s.laatste_duurzame_revisie = revisie;
            Ok(true)
        }
        Err(e) => {
            let melding = e.to_string();
            if let Ok(mut s) = stand.lock() { s.laatste_schrijf_fout = Some(melding.clone()); }
            Err(melding)
        }
    }
}

/* Ontbrekend is altijd fataal; alleen `init-state` mag een genesis maken. */
pub fn laad(pad: &Path, ring: &Ring, state: &mut State) -> Result<Stand, String> {
    if !pad.exists() {
        return Err(if marker_pad(pad).exists() {
            "snapshot ontbreekt terwijl de genesis-marker bestaat"
        } else { "geldvolume is niet geïnitialiseerd; voer expliciet init-state uit" }.into());
    }
    let tekst = fs::read_to_string(pad)
        .map_err(|e| format!("bestaande snapshot is niet leesbaar: {}", e))?;
    let (genesis, klaar, sleutel_id) = ring.open(&tekst)
        .map_err(|e| format!("bestaande snapshot kan niet authenticated worden geopend: {}", e))?;
    let klaar = std::str::from_utf8(&klaar).map_err(|_| "snapshot-klaartekst is geen UTF-8")?;
    let snap = json::parse(klaar)
        .map_err(|e| format!("bestaande snapshot bevat ongeldige JSON: {}", e))?;
    state.laad_gevalideerd(&snap)
        .map_err(|e| format!("bestaande snapshot is ongeldig: {}", e))?;
    Ok(Stand { snapshot_geladen: true, snapshot_geldig: true,
        laatste_schrijf_fout: None, laatste_duurzame_revisie: state.revisie,
        genesis_id: Some(genesis), sleutel_id: Some(sleutel_id), versleuteld: true })
}

/* Alleen deze expliciete operatorhandeling mag een leeg geldvolume maken.
   Normale startup maakt nooit zelf een genesis of sleutel aan. */
pub fn initialiseer(pad: &Path, ring: &Ring, genesis: &str) -> Result<String, String> {
    if pad.exists() || marker_pad(pad).exists() { return Err("geldvolume is al geïnitialiseerd".into()); }
    if genesis.len() != 34 || !genesis.starts_with("g-") ||
        !genesis[2..].bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) {
        return Err("genesis-id moet exact g-<32 lowercase hex> zijn".into());
    }
    let envelop = ring.verzegel(genesis, State::new().snapshot().dump().as_bytes())?;
    schrijf_bestand(pad, &envelop).map_err(|e| e.to_string())?;
    Ok(genesis.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng;

    fn pad(naam: &str) -> PathBuf {
        std::env::temp_dir().join(format!("rtg-duurzaam-{}-{}-{}.json", naam,
            std::process::id(), rng::nu_ms()))
    }
    fn wis(p: &Path) {
        let _ = fs::remove_file(p);
        let _ = fs::remove_file(marker_pad(p));
        let _ = fs::remove_file(p.with_extension("tmp"));
    }
    fn ring(naam: &str) -> (PathBuf, Ring) {
        let p = pad(&format!("{}-key", naam));
        let r = Ring::maak(&p).unwrap(); (p, r)
    }

    #[test]
    fn oudere_capture_kan_nieuwere_sync_write_niet_overschrijven() {
        let p = pad("volgorde");
        let (kp, ring) = ring("volgorde");
        initialiseer(&p, &ring, "g-00000000000000000000000000000001").unwrap();
        let slot = Mutex::new(());
        let mut basis = State::new();
        let status = Mutex::new(laad(&p, &ring, &mut basis).unwrap());
        let mut s = State::new();
        s.boek_guard("extern:oplaad", "lid:A", 100, "oplaad", "", None);
        let oud = s.snapshot().dump();
        let oude_revisie = s.revisie;
        // De flusher is hier conceptueel gepauzeerd na capture A.
        s.boek_guard_eenmaal("extern:uitbetaald", "lid:A", 25, "terug", "", Some("r".into()),
            Some("payout-terug:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"));
        let nieuw = s.snapshot().dump();
        let nieuwe_revisie = s.revisie;
        assert!(schrijf_indien_nieuwer(&p, &nieuw, nieuwe_revisie, &ring, &slot, &status).unwrap());
        assert!(!schrijf_indien_nieuwer(&p, &oud, oude_revisie, &ring, &slot, &status).unwrap());
        let mut herstart = State::new();
        laad(&p, &ring, &mut herstart).unwrap();
        assert_eq!(herstart.grb.saldo_van("lid:A"), 125);
        assert_eq!(herstart.revisie, nieuwe_revisie);
        wis(&p);
        let _ = fs::remove_file(kp);
    }

    #[test]
    fn corrupte_en_verdwenen_bestaande_snapshot_zijn_fataal() {
        let p = pad("corrupt");
        let (kp, ring) = ring("corrupt");
        if let Some(dir) = p.parent() { fs::create_dir_all(dir).unwrap(); }
        fs::write(&p, b"{\"saldi\":").unwrap();
        assert!(laad(&p, &ring, &mut State::new()).unwrap_err().contains("authenticated"));
        let env = ring.verzegel("g-test", b"{\"saldi\":{\"a\":10},\"boekingen\":[]}").unwrap();
        fs::write(&p, env).unwrap();
        assert!(laad(&p, &ring, &mut State::new()).unwrap_err().contains("sluit niet"));
        fs::remove_file(&p).unwrap();
        fs::write(marker_pad(&p), b"rtg-motor-state-v1\n").unwrap();
        assert!(laad(&p, &ring, &mut State::new()).unwrap_err().contains("ontbreekt"));
        wis(&p);
        let _ = fs::remove_file(kp);
    }

    #[test]
    fn eerste_start_is_alleen_explicit_en_snapshot_bevat_geen_geldwaarheid() {
        let p = pad("genesis"); let (kp, ring) = ring("genesis");
        assert!(laad(&p, &ring, &mut State::new()).unwrap_err().contains("init-state"));
        assert!(initialiseer(&p, &ring, "g-niet-vastgelegd").is_err());
        let genesis = "g-00000000000000000000000000000002";
        initialiseer(&p, &ring, genesis).unwrap(); assert!(initialiseer(&p, &ring, genesis).is_err());
        let rauw = fs::read_to_string(&p).unwrap();
        assert!(!rauw.contains("saldi") && !rauw.contains("boekingen") && rauw.contains("ciphertext"));
        let mut state = State::new(); let stand = laad(&p, &ring, &mut state).unwrap();
        assert!(stand.gereed(0, false)); assert!(stand.snapshot_geladen && stand.versleuteld);
        wis(&p); let _ = fs::remove_file(kp);
    }
}
