/* RTG Pay-operaties bovenop het grootboek: opladen (demo-betaalnaad), geld
   sturen met autolaad (EEN knop), de tik, de kassacode en de partnerkant.
   Idempotentie die een herstart overleeft (dezelfde knop twee keer = exact
   hetzelfde antwoord, nooit dubbel geboekt). Alle state zit in State; de
   HTTP-laag houdt er een Mutex omheen, zodat elke boeking atomair is onder de
   volle storm. */
use crate::grootboek::{schoon, BoekArgs, Ledger, MAX_CENTEN, MIN_CENTEN};
use crate::json::Json;
use crate::rng;
use std::collections::{HashMap, HashSet};

const OPLAAD_MIN: i64 = 100;
const AUTOLAAD_STAP: i64 = 1000;
const KASCODE_MS: u64 = 5 * 60 * 1000;
const KASCODE_MAX: i64 = 50_000;

pub struct Resp {
    pub status: u16,
    pub body: Json,
}
fn ok(mut body: Json) -> Resp {
    body.set("ok", Json::Bool(true));
    Resp { status: 200, body }
}
fn err(status: u16, msg: &str) -> Resp {
    let mut b = Json::obj();
    b.set("error", Json::Str(msg.into()));
    Resp { status, body: b }
}

struct Kascode { code: String, codenaam: String, max_centen: i64, geldig_tot: u64, gebruikt: bool }
struct Tikcode { code: String, codenaam: String, geldig_tot: u64 }

/* Constant-time vergelijk voor betaalcodes: geen vroeg-stoppen per teken, zodat
   de tijd niet verraadt hoeveel tekens al klopten (timing-lek op geldcodes). */
fn ct_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for i in 0..a.len() {
        diff |= a[i] ^ b[i];
    }
    diff == 0
}

pub struct State {
    pub grb: Ledger,
    leden: HashSet<String>,
    idem: HashMap<String, Json>,
    idem_volgorde: Vec<String>,
    kascodes: Vec<Kascode>,
    tikcodes: Vec<Tikcode>,
    betaaldienst_promille: i64, // kosten per mille op kassa-ontvangst; 0 in demo
    pub vuil: bool,             // write-behind vlag
}

impl State {
    pub fn new() -> State {
        State {
            grb: Ledger::new(),
            leden: HashSet::new(),
            idem: HashMap::new(),
            idem_volgorde: Vec::new(),
            kascodes: Vec::new(),
            tikcodes: Vec::new(),
            betaaldienst_promille: 0,
            vuil: false,
        }
    }

    fn markeer(&mut self) { self.vuil = true; }

    // ---------- ledenregister (motor's eigen bestaatLid; kiem voor stap 2) ----------
    pub fn registreer_lid(&mut self, codenaam: &str) -> Resp {
        let c = schoon(codenaam, 40);
        if c.is_empty() {
            return err(400, "Geen codenaam.");
        }
        self.leden.insert(c.clone());
        self.markeer();
        let mut b = Json::obj();
        b.set("codenaam", Json::Str(c));
        ok(b)
    }
    fn bestaat_lid(&self, codenaam: &str) -> bool { self.leden.contains(codenaam) }
    pub fn ledental(&self) -> usize { self.leden.len() }

    // ---------- idempotentie ----------
    fn met_idem<F: FnOnce(&mut State) -> Resp>(&mut self, sleutel: Option<String>, werk: F) -> Resp {
        let key = match sleutel {
            None => return werk(self),
            Some(k) => k,
        };
        if let Some(bewaard) = self.idem.get(&key) {
            let mut body = bewaard.clone();
            body.set("herhaald", Json::Bool(true));
            return Resp { status: 200, body };
        }
        let r = werk(self);
        if r.status < 300 {
            self.idem.insert(key.clone(), r.body.clone());
            self.idem_volgorde.push(key);
            if self.idem_volgorde.len() > 20_000 {
                let weg: Vec<String> = self.idem_volgorde.drain(0..self.idem_volgorde.len() - 20_000).collect();
                for k in weg { self.idem.remove(&k); }
            }
            self.markeer();
        }
        r
    }

    // ---------- opladen (demo-betaalnaad: altijd meteen betaald) ----------
    pub fn laad_op(&mut self, codenaam: &str, centen: Option<i64>, idem: Option<&str>) -> Resp {
        let c = match centen { Some(c) => c, None => return err(400, "Opladen kan van 1 tot 5000 euro.") };
        if c < OPLAAD_MIN || c > MAX_CENTEN {
            return err(400, "Opladen kan van 1 tot 5000 euro.");
        }
        let sleutel = idem.map(|i| format!("oplaad:{}:{}", codenaam, i));
        let cn = codenaam.to_string();
        self.met_idem(sleutel, move |s| {
            let rek = format!("lid:{}", cn);
            match s.grb.boek(BoekArgs { van: "extern:oplaad", naar: &rek, centen: c, soort: "oplaad", oms: "Opladen", ref_: None }) {
                Ok(_) => {
                    s.markeer();
                    let mut b = Json::obj();
                    b.set("saldo", Json::Num(s.grb.saldo_van(&rek) as f64));
                    b.set("geladen", Json::Num(c as f64));
                    ok(b)
                }
                Err((st, m)) => err(st, &m),
            }
        })
    }

    // autolaad: is er te weinig, laad zelf bij in stappen van tien euro
    fn zorg_saldo(&mut self, codenaam: &str, centen: i64, idem: Option<&str>) -> Result<i64, Resp> {
        let rek = format!("lid:{}", codenaam);
        let tekort = centen - self.grb.saldo_van(&rek);
        if tekort <= 0 {
            return Ok(0);
        }
        let stap = ((tekort + AUTOLAAD_STAP - 1) / AUTOLAAD_STAP) * AUTOLAAD_STAP;
        let auto = idem.map(|i| format!("{}:autolaad", i));
        let r = self.laad_op(codenaam, Some(stap), auto.as_deref());
        if r.status >= 300 {
            return Err(r);
        }
        Ok(stap)
    }

    // ---------- geld sturen: EEN knop ----------
    pub fn stuur(&mut self, van: &str, aan: &str, centen: Option<i64>, oms: Option<&str>, idem: Option<&str>, soort: &str) -> Resp {
        let aan = schoon(aan, 40);
        if aan.is_empty() || aan == van {
            return err(400, "Kies aan wie je het stuurt.");
        }
        if !self.bestaat_lid(&aan) {
            return err(404, "Die codenaam kennen we niet.");
        }
        let c = match centen { Some(c) => c, None => return err(400, "Vul een bedrag in.") };
        if c < MIN_CENTEN || c > MAX_CENTEN {
            return err(400, "Dat bedrag kan niet.");
        }
        let sleutel = idem.map(|i| format!("stuur:{}:{}", van, i));
        let van_s = van.to_string();
        let oms_s = oms.unwrap_or("Zomaar").to_string();
        let soort_s = soort.to_string();
        let idem_s = idem.map(|s| s.to_string());
        self.met_idem(sleutel, move |s| {
            let bijgeladen = match s.zorg_saldo(&van_s, c, idem_s.as_deref()) {
                Ok(b) => b,
                Err(e) => return e,
            };
            let rvan = format!("lid:{}", van_s);
            let rnaar = format!("lid:{}", aan);
            match s.grb.boek(BoekArgs { van: &rvan, naar: &rnaar, centen: c, soort: &soort_s, oms: &oms_s, ref_: None }) {
                Ok(b) => {
                    s.markeer();
                    let mut out = Json::obj();
                    out.set("saldo", Json::Num(s.grb.saldo_van(&rvan) as f64));
                    out.set("bijgeladen", Json::Num(bijgeladen as f64));
                    out.set("boeking", Json::Str(b.id));
                    ok(out)
                }
                Err((st, m)) => err(st, &m),
            }
        })
    }

    // ---------- de tik ----------
    pub fn tik_code(&mut self, codenaam: &str) -> Resp {
        let nu = rng::nu_ms();
        for k in self.tikcodes.iter_mut() {
            if k.codenaam == codenaam { k.geldig_tot = 0; }
        }
        let code = rng::code(6);
        let geldig = nu + KASCODE_MS;
        self.tikcodes.insert(0, Tikcode { code: code.clone(), codenaam: codenaam.to_string(), geldig_tot: geldig });
        if self.tikcodes.len() > 2000 { self.tikcodes.truncate(2000); }
        self.markeer();
        let mut b = Json::obj();
        b.set("code", Json::Str(code));
        b.set("geldigTot", Json::Num(geldig as f64));
        ok(b)
    }

    pub fn tik_betaal(&mut self, van: &str, code: &str, centen: Option<i64>, oms: Option<&str>, idem: Option<&str>) -> Resp {
        let nu = rng::nu_ms();
        let code = code.to_uppercase();
        let doel = self.tikcodes.iter().find(|k| ct_eq(&k.code, &code) && k.geldig_tot >= nu).map(|k| k.codenaam.clone());
        let doel = match doel {
            Some(d) => d,
            None => return err(404, "Deze tik is niet (meer) geldig; laat je vriend opnieuw op ontvangen zetten."),
        };
        if doel == van {
            return err(400, "Dit is je eigen tik.");
        }
        let tik_idem = idem.map(|i| format!("tik:{}", i));
        let mut r = self.stuur(van, &doel, centen, Some(oms.unwrap_or("Tik")), tik_idem.as_deref(), "tik");
        if r.status < 300 {
            r.body.set("aan", Json::Str(doel));
        }
        r
    }

    // ---------- de kassacode + partnerkant ----------
    pub fn kas_code(&mut self, codenaam: &str, max_centen: Option<i64>) -> Resp {
        let nu = rng::nu_ms();
        let max = KASCODE_MAX.min(100.max(max_centen.unwrap_or(15000)));
        for k in self.kascodes.iter_mut() {
            if k.codenaam == codenaam && !k.gebruikt { k.gebruikt = true; }
        }
        let code = rng::code(6);
        let geldig = nu + KASCODE_MS;
        self.kascodes.insert(0, Kascode { code: code.clone(), codenaam: codenaam.to_string(), max_centen: max, geldig_tot: geldig, gebruikt: false });
        if self.kascodes.len() > 1000 { self.kascodes.truncate(1000); }
        self.markeer();
        let mut b = Json::obj();
        b.set("code", Json::Str(code));
        b.set("maxCenten", Json::Num(max as f64));
        b.set("geldigTot", Json::Num(geldig as f64));
        ok(b)
    }

    pub fn kas_int(&mut self, supplier: &str, code: &str, centen: Option<i64>, oms: Option<&str>, idem: Option<&str>) -> Resp {
        let nu = rng::nu_ms();
        let code = code.to_uppercase();
        let vondst = self.kascodes.iter().position(|k| ct_eq(&k.code, &code));
        let pos = match vondst {
            Some(p) if !self.kascodes[p].gebruikt && self.kascodes[p].geldig_tot >= nu => p,
            _ => return err(404, "Deze betaalcode is niet (meer) geldig."),
        };
        let c = match centen { Some(c) => c, None => return err(400, "Vul het bedrag in.") };
        if c < MIN_CENTEN {
            return err(400, "Vul het bedrag in.");
        }
        if c > self.kascodes[pos].max_centen {
            return err(402, "Boven het maximum van deze code.");
        }
        let codenaam = self.kascodes[pos].codenaam.clone();
        let refcode = self.kascodes[pos].code.clone();
        let sleutel = idem.map(|i| format!("kas:{}:{}", supplier, i));
        let sup = supplier.to_string();
        let oms_s = oms.unwrap_or("Kassa").to_string();
        let idem_s = idem.map(|s| s.to_string());
        let promille = self.betaaldienst_promille;
        let r = self.met_idem(sleutel, move |s| {
            if let Err(e) = s.zorg_saldo(&codenaam, c, idem_s.as_deref()) {
                return e;
            }
            let rlid = format!("lid:{}", codenaam);
            let rpartner = format!("partner:{}", sup);
            if let Err((st, m)) = s.grb.boek(BoekArgs { van: &rlid, naar: &rpartner, centen: c, soort: "kassa", oms: &oms_s, ref_: Some(refcode.clone()) }) {
                return err(st, &m);
            }
            // betaaldienstkosten direct verrekend op de partnerrekening
            let mut kosten = 0i64;
            if promille > 0 {
                kosten = (c * promille) / 1000;
                if kosten > 0 {
                    if s.grb.boek(BoekArgs { van: &rpartner, naar: "rtg:betaaldienst", centen: kosten, soort: "betaaldienstkosten", oms: "Betaaldienstkosten, direct verrekend", ref_: Some(refcode.clone()) }).is_err() {
                        kosten = 0;
                    }
                }
            }
            s.markeer();
            let mut b = Json::obj();
            b.set("centen", Json::Num(c as f64));
            b.set("van", Json::Str(codenaam.clone()));
            b.set("kosten", Json::Num(kosten as f64));
            ok(b)
        });
        if r.status < 300 {
            self.kascodes[pos].gebruikt = true;
            self.markeer();
        }
        r
    }

    pub fn partner_overzicht(&self, supplier: &str) -> Resp {
        let rek = format!("partner:{}", supplier);
        let mut b = Json::obj();
        b.set("saldo", Json::Num(self.grb.saldo_van(&rek) as f64));
        let boekingen: Vec<Json> = self.grb.boekingen.iter()
            .filter(|r| r.van == rek || r.naar == rek)
            .take(30).map(|r| r.to_json()).collect();
        b.set("boekingen", Json::Arr(boekingen));
        ok(b)
    }

    pub fn partner_uitbetaal(&mut self, supplier: &str, idem: Option<&str>) -> Resp {
        let rek = format!("partner:{}", supplier);
        let c = self.grb.saldo_van(&rek);
        if c <= 0 {
            return err(400, "Er staat niets om uit te betalen.");
        }
        let sleutel = idem.map(|i| format!("uit:{}:{}", supplier, i));
        self.met_idem(sleutel, move |s| {
            match s.grb.boek(BoekArgs { van: &rek, naar: "extern:uitbetaald", centen: c, soort: "uitbetaling", oms: "Uitbetaald naar de bank", ref_: None }) {
                Ok(_) => {
                    s.markeer();
                    let mut b = Json::obj();
                    b.set("uitbetaald", Json::Num(c as f64));
                    ok(b)
                }
                Err((st, m)) => err(st, &m),
            }
        })
    }

    // ---------- het overzicht voor het lid ----------
    pub fn overzicht(&self, codenaam: &str) -> Resp {
        let rek = format!("lid:{}", codenaam);
        let rijen: Vec<Json> = self.grb.boekingen.iter()
            .filter(|r| r.van == rek || r.naar == rek)
            .take(30)
            .map(|r| {
                let tegen_ruw = if r.naar == rek { &r.van } else { &r.naar };
                let tegen = tegen_ruw
                    .strip_prefix("lid:").map(|x| x.to_string())
                    .or_else(|| tegen_ruw.strip_prefix("partner:").map(|x| format!("zaak {}", x)))
                    .unwrap_or_else(|| match tegen_ruw.as_str() {
                        "extern:oplaad" => "opgeladen".to_string(),
                        "extern:uitbetaald" => "bank".to_string(),
                        other => other.to_string(),
                    });
                let mut o = Json::obj();
                o.set("id", Json::Str(r.id.clone()))
                    .set("at", Json::Num(r.at as f64))
                    .set("oms", Json::Str(r.oms.clone()))
                    .set("soort", Json::Str(r.soort.clone()))
                    .set("centen", Json::Num((if r.naar == rek { r.centen } else { -r.centen }) as f64))
                    .set("tegen", Json::Str(tegen));
                o
            })
            .collect();
        let mut b = Json::obj();
        b.set("codenaam", Json::Str(codenaam.to_string()));
        b.set("saldo", Json::Num(self.grb.saldo_van(&rek) as f64));
        b.set("geschiedenis", Json::Arr(rijen));
        ok(b)
    }

    // ---------- de gezondheidsknop ----------
    pub fn gezond(&self) -> (bool, i64) {
        let (klopt, som, _rood) = self.grb.sluitcontrole();
        (klopt, som)
    }

    // Volledige saldi-dump — alleen voor het pariteitsharnas (achter een vlag);
    // in productie nooit blootstellen (het is de hele geldstand).
    pub fn saldi_json(&self) -> Json {
        let mut o = Json::obj();
        if let Json::Obj(m) = &mut o {
            for (k, v) in &self.grb.saldi {
                m.insert(k.clone(), Json::Num(*v as f64));
            }
        }
        o
    }

    // ---------- schaduw-modus: rauwe boeking van de autoritaire JS-engine ----------
    pub fn spiegel_boek(&mut self, van: &str, naar: &str, centen: i64, soort: &str, oms: &str, ref_: Option<String>) -> Resp {
        if centen <= 0 || van.is_empty() || naar.is_empty() || van == naar {
            return err(400, "Ongeldige boeking.");
        }
        self.grb.apply_raw(BoekArgs { van, naar, centen, soort, oms, ref_ });
        self.markeer();
        ok(Json::obj())
    }

    // ---------- snapshot voor durability (write-behind naar schijf) ----------
    /* De geld-kritische waarheid: saldi, leden, idempotentie en de boekingen.
       Genoeg om na een herstart exact verder te gaan (som blijft nul, dubbele
       knoppen blijven herkend). */
    pub fn snapshot(&self) -> Json {
        let mut saldi = Json::obj();
        if let Json::Obj(m) = &mut saldi {
            for (k, v) in &self.grb.saldi {
                m.insert(k.clone(), Json::Num(*v as f64));
            }
        }
        let boekingen: Vec<Json> = self.grb.boekingen.iter().map(|b| b.to_json()).collect();
        let leden: Vec<Json> = self.leden.iter().cloned().map(Json::Str).collect();
        let mut idem = Json::obj();
        if let Json::Obj(m) = &mut idem {
            for (k, v) in &self.idem {
                m.insert(k.clone(), v.clone());
            }
        }
        let idem_volgorde: Vec<Json> = self.idem_volgorde.iter().cloned().map(Json::Str).collect();
        let mut o = Json::obj();
        o.set("saldi", saldi)
            .set("boekingen", Json::Arr(boekingen))
            .set("leden", Json::Arr(leden))
            .set("idem", idem)
            .set("idemVolgorde", Json::Arr(idem_volgorde));
        o
    }

    pub fn laad(&mut self, snap: &Json) {
        if let Some(Json::Obj(m)) = snap.get("saldi") {
            for (k, v) in m {
                if let Some(c) = v.as_i64() {
                    self.grb.saldi.insert(k.clone(), c);
                }
            }
        }
        if let Some(Json::Arr(a)) = snap.get("boekingen") {
            for b in a.iter().rev() {
                let van = b.str_at("van").unwrap_or("").to_string();
                let naar = b.str_at("naar").unwrap_or("").to_string();
                if van.is_empty() || naar.is_empty() { continue; }
                self.grb.boekingen.push_front(crate::grootboek::Boeking {
                    id: b.str_at("id").unwrap_or("").to_string(),
                    van,
                    naar,
                    centen: b.i64_at("centen").unwrap_or(0),
                    soort: b.str_at("soort").unwrap_or("boeking").to_string(),
                    oms: b.str_at("oms").unwrap_or("").to_string(),
                    ref_: b.str_at("ref").map(|s| s.to_string()),
                    at: b.i64_at("at").unwrap_or(0) as u64,
                });
            }
        }
        if let Some(Json::Arr(a)) = snap.get("leden") {
            for n in a {
                if let Some(s) = n.as_str() { self.leden.insert(s.to_string()); }
            }
        }
        if let Some(Json::Obj(m)) = snap.get("idem") {
            for (k, v) in m { self.idem.insert(k.clone(), v.clone()); }
        }
        if let Some(Json::Arr(a)) = snap.get("idemVolgorde") {
            for n in a {
                if let Some(s) = n.as_str() { self.idem_volgorde.push(s.to_string()); }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn i(centen: i64) -> Option<i64> { Some(centen) }

    #[test]
    fn een_knop_autolaad_en_conservatie() {
        let mut s = State::new();
        s.registreer_lid("NEVEL");
        s.registreer_lid("MIST");
        // MIST heeft niets: stuurt 250 euro -> wallet laadt zelf bij (tientjes)
        let r = s.stuur("MIST", "NEVEL", i(25000), Some("test"), Some("k1"), "p2p");
        assert_eq!(r.status, 200, "sturen met autolaad moet lukken");
        assert_eq!(s.grb.saldo_van("lid:NEVEL"), 25000);
        // bijgeladen exact naar boven op een tientje (25000 -> 25000)
        assert_eq!(r.body.i64_at("bijgeladen"), Some(25000));
        let (klopt, som) = s.gezond();
        assert!(klopt && som == 0, "grootboek sluit op de cent");
    }

    #[test]
    fn idempotentie_boekt_nooit_dubbel() {
        let mut s = State::new();
        s.registreer_lid("A");
        s.registreer_lid("B");
        s.laad_op("A", i(100000), Some("op1"));
        let saldo_na_oplaad = s.grb.saldo_van("lid:A");
        // dezelfde stuur-idem twee keer
        let r1 = s.stuur("A", "B", i(30000), Some("x"), Some("dup"), "p2p");
        let r2 = s.stuur("A", "B", i(30000), Some("x"), Some("dup"), "p2p");
        assert_eq!(r1.status, 200);
        assert_eq!(r2.status, 200);
        assert_eq!(r2.body.as_bool().is_none(), true); // body is obj
        assert_eq!(r2.body.bool_at("herhaald"), true, "tweede keer is een herhaling");
        // B kreeg maar EEN keer 30000
        assert_eq!(s.grb.saldo_van("lid:B"), 30000);
        assert_eq!(s.grb.saldo_van("lid:A"), saldo_na_oplaad - 30000);
        assert!(s.gezond().0);
    }

    #[test]
    fn oplaad_idempotent_bij_herhaling() {
        let mut s = State::new();
        s.registreer_lid("A");
        s.laad_op("A", i(50000), Some("z"));
        s.laad_op("A", i(50000), Some("z"));
        assert_eq!(s.grb.saldo_van("lid:A"), 50000, "twee keer dezelfde oplaad-idem = een keer geld");
        assert!(s.gezond().0);
    }

    #[test]
    fn kassa_end_to_end() {
        let mut s = State::new();
        s.registreer_lid("GAST");
        s.laad_op("GAST", i(100000), Some("op"));
        let code = s.kas_code("GAST", i(50000));
        let code_str = code.body.str_at("code").unwrap().to_string();
        let r = s.kas_int("PART1", &code_str, i(12000), Some("Diner"), Some("k"));
        assert_eq!(r.status, 200);
        assert_eq!(s.grb.saldo_van("partner:PART1"), 12000);
        // code is verbruikt: tweede keer weigeren
        let r2 = s.kas_int("PART1", &code_str, i(12000), Some("Diner"), Some("k2"));
        assert_eq!(r2.status, 404);
        assert!(s.gezond().0);
    }

    #[test]
    fn constant_time_vergelijk() {
        assert!(ct_eq("A1B2C3", "A1B2C3"));
        assert!(!ct_eq("A1B2C3", "A1B2C4"));
        assert!(!ct_eq("A1B2C3", "A1B2C"));  // verschillende lengte
        assert!(!ct_eq("", "x"));
        assert!(ct_eq("", ""));
    }

    #[test]
    fn onbekende_ontvanger_geweigerd() {
        let mut s = State::new();
        s.registreer_lid("A");
        s.laad_op("A", i(50000), Some("op"));
        let r = s.stuur("A", "SPOOK", i(1000), None, Some("k"), "p2p");
        assert_eq!(r.status, 404);
    }
}
