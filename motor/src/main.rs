/* RTG Motor — binaire. Zet de HTTP/1.1-motor om de money-engine en spreekt
   exact dezelfde routes als server/routes/pay.js, zodat De Beproeving (die
   HTTP bestookt) er niets van merkt. Zero-dependency: alleen std.

   Omgeving:
     RTG_MOTOR_ADDR     luisteradres (standaard 127.0.0.1:3100)
     RTG_MOTOR_MAXCONN  plafond gelijktijdige verbindingen (standaard 1024)
     RTG_MOTOR_DATA     snapshot-bestand (standaard ./motor-data/state.json)
     RTG_MOTOR_SALDI    =1 opent /api/motor/saldi zodat de gepaarde server zijn
                        spiegel uit de motor-snapshot kan reconcilen (cutover)
     RTG_MOTOR_TOKEN    gedeeld geheim; is het gezet, dan moet ELK verzoek het
                        meesturen (X-RTG-Motor-Token of Authorization: Bearer).
                        Zonder token luistert de motor alleen op loopback.

   Rol-scheiding (welk lid mag wat) zit in de Node-poort ervoor; de motor is het
   grootboek en krijgt codenaam/supplier als velden in de body. Maar dat maakt de
   motor zelf geen open deur: wie hem rechtstreeks bereikt, kan zonder token
   /api/kluis/onthul lezen en met /api/pay/boek rauw boeken. Vandaar de
   poortwacht hieronder -- een tweede slot naast de Node-poort, zodat een SSRF of
   een willekeurig lokaal proces niet meteen bij het geld en de identiteiten kan.
   /api/leeft blijft altijd open, maar geeft niets anders dan {"ok":true}. */
use rtg_motor::http::{self, Request, Response};
use rtg_motor::json::{self, Json};
use rtg_motor::ledengids::{self, Gids};
use rtg_motor::pay::{Resp, State};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;

fn env(key: &str, standaard: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| standaard.to_string())
}

fn data_pad() -> PathBuf {
    PathBuf::from(env("RTG_MOTOR_DATA", "motor-data/state.json"))
}

/* Luistert dit adres alleen op de eigen machine? Zonder token is dat de enige
   plek waar de motor mag staan.

   Eerst het hele adres als SocketAddr proberen -- dat dekt "127.0.0.1:3100" en
   "[::1]:3100" in een keer -- dan als los IP, en pas daarna met de hand de host
   afsplitsen (voor "localhost:3100"). Onbekende namen gelden NIET als loopback:
   bij twijfel dicht. */
fn is_loopback(addr: &str) -> bool {
    use std::net::{IpAddr, SocketAddr};
    if let Ok(sa) = addr.parse::<SocketAddr>() {
        return sa.ip().is_loopback();
    }
    if let Ok(ip) = addr.parse::<IpAddr>() {
        return ip.is_loopback();
    }
    let host = match addr.rfind(':') {
        Some(i) => &addr[..i],
        None => addr,
    };
    if host.eq_ignore_ascii_case("localhost") {
        return true;
    }
    match host.parse::<IpAddr>() {
        Ok(ip) => ip.is_loopback(),
        Err(_) => false,
    }
}

/* De poortwacht: is er een token geconfigureerd, dan moet elk verzoek het
   meesturen. Constant-time vergeleken, zodat de tijd niet verraadt hoeveel
   tekens al klopten. /api/leeft is de enige uitzondering (kale liveness). */
fn mag_erdoor(token_verwacht: &str, req: &Request) -> bool {
    if token_verwacht.is_empty() {
        return true; // geen token geconfigureerd: alleen loopback, zie main()
    }
    if req.path == "/api/leeft" {
        return true;
    }
    rtg_motor::aead::ct_eq(req.token.as_bytes(), token_verwacht.as_bytes())
}

fn gids_pad() -> PathBuf {
    PathBuf::from(env("RTG_MOTOR_GIDS", "motor-data/gids.bin"))
}

fn open_kluis() -> rtg_motor::kluis::Kluis {
    let sleutel = PathBuf::from(env("RTG_KLUIS_KEY_FILE", "motor-data/secret.key"));
    let data = PathBuf::from(env("RTG_KLUIS_DATA", "motor-data/kluis.json"));
    if let Some(dir) = data.parent() {
        let _ = fs::create_dir_all(dir);
    }
    rtg_motor::kluis::Kluis::open(&sleutel, &data).unwrap_or_else(|e| {
        eprintln!("[motor] kluis kon niet openen: {}", e);
        std::process::exit(1);
    })
}

/* Write-behind voor de kluis: elke ~500 ms een versleutelde snapshot als er iets
   veranderde. De klaartekst raakt de schijf nooit. */
fn start_kluis_flusher(kluis: Arc<std::sync::Mutex<rtg_motor::kluis::Kluis>>) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(500));
        let (pad, tekst) = {
            let mut k = kluis.lock().unwrap();
            if !k.vuil {
                continue;
            }
            /* Staat de kluis op geknoeid, dan NIET zegelen: een verse
               momentopname zou een geldig manifest over de gemanipuleerde stand
               schrijven en zo het bewijs uitwissen. */
            if !k.mag_schrijven() {
                k.vuil = false;
                eprintln!("[motor] kluis GEKNOEID: flush overgeslagen, datafile blijft ongemoeid voor onderzoek.");
                continue;
            }
            k.vuil = false;
            // momentopname bumpt de generatie en zegelt een vers manifest mee
            (k.pad().to_path_buf(), k.momentopname().dump())
        };
        let tmp = pad.with_extension("tmp");
        if fs::write(&tmp, tekst.as_bytes()).is_ok() && fs::rename(&tmp, &pad).is_ok() {
            // datafile staat -> anker nu de generatie in de keyring (hoogste
            // waarmerk). Volgorde datafile-eerst voorkomt een valse terugrol-
            // melding na een crash tussen beide schrijfacties.
            let _ = kluis.lock().unwrap().anker();
        }
    });
}

fn kluis_route(kluis: &std::sync::Mutex<rtg_motor::kluis::Kluis>, req: &Request) -> Response {
    if req.path == "/api/kluis/status" {
        let k = kluis.lock().unwrap();
        let mut b = Json::obj();
        b.set("ok", Json::Bool(true))
            .set("records", Json::Num(k.aantal() as f64))
            .set("crypto", Json::Str("XChaCha20-Poly1305 (24-byte nonce), codenaam-gebonden (AAD), lengte-verhuld, versleuteld op schijf".into()))
            .set("sleutelversies", Json::Num(k.sleutelversies() as f64))
            .set("integriteit", Json::Str(if k.geknoeid { "GEKNOEID: manifest klopt niet (record gewist of teruggerold)".into() } else { "ok: manifest sluit (anti-wis + anti-terugrol)".to_string() }))
            .set("geknoeid", Json::Bool(k.geknoeid))
            .set("sleutelVingerafdruk", Json::Str(k.vingerafdruk().to_string()));
        return Response { status: 200, body: b.dump() };
    }
    if req.method != "POST" {
        return fout(404, "Onbekende route.");
    }
    let body = match json::parse(if req.body.is_empty() { "{}" } else { &req.body }) {
        Ok(v) => v,
        Err(_) => return fout(400, "Kapotte JSON."),
    };
    let key = body.str_at("key").unwrap_or("");
    match req.path.as_str() {
        // bewaar de echte gegevens (versleuteld). `data` mag JSON-tekst zijn.
        "/api/kluis/bewaar" => {
            let data = body.str_at("data").unwrap_or("");
            let mut k = kluis.lock().unwrap();
            match k.bewaar(key, data) {
                Ok(()) => {
                    let mut b = Json::obj();
                    b.set("ok", Json::Bool(true));
                    Response { status: 200, body: b.dump() }
                }
                Err(e) => fout(400, &e),
            }
        }
        // onthul (de gevoelige handeling; in productie zit hier de eigenaar-poort voor)
        "/api/kluis/onthul" => {
            let k = kluis.lock().unwrap();
            match k.onthul(key) {
                Some(d) => {
                    let mut b = Json::obj();
                    b.set("ok", Json::Bool(true)).set("data", Json::Str(d));
                    Response { status: 200, body: b.dump() }
                }
                None => fout(404, "Niets gevonden of niet te ontsleutelen."),
            }
        }
        "/api/kluis/wis" => {
            let mut k = kluis.lock().unwrap();
            let mut b = Json::obj();
            b.set("ok", Json::Bool(true)).set("gewist", Json::Bool(k.wis(key)));
            Response { status: 200, body: b.dump() }
        }
        // roteer de kluissleutel: verse sleutel, alle records hersleuteld.
        // Crash-veilig via de keyring (nieuwe sleutel eerst duurzaam op schijf).
        "/api/kluis/roteer" => {
            let mut k = kluis.lock().unwrap();
            match k.roteer_sleutel() {
                Ok(n) => {
                    let mut b = Json::obj();
                    b.set("ok", Json::Bool(true))
                        .set("hersleuteld", Json::Num(n as f64))
                        .set("sleutelversies", Json::Num(k.sleutelversies() as f64))
                        .set("sleutelVingerafdruk", Json::Str(k.vingerafdruk().to_string()));
                    Response { status: 200, body: b.dump() }
                }
                Err(e) => fout(400, &e),
            }
        }
        _ => fout(404, "Onbekende route."),
    }
}

fn laad_snapshot(state: &RwLock<State>) {
    let pad = data_pad();
    if let Ok(tekst) = fs::read_to_string(&pad) {
        if let Ok(snap) = json::parse(&tekst) {
            state.write().unwrap().laad(&snap);
            eprintln!("[motor] snapshot geladen uit {}", pad.display());
        }
    }
}

/* Write-behind: elke ~200 ms een atomische snapshot als er iets veranderd is
   (temp-bestand + rename). Coalesced, buiten de aanvraag om — net als de
   write-behind flush aan de Node-kant. */
fn start_flusher(state: Arc<RwLock<State>>) {
    thread::spawn(move || {
        let pad = data_pad();
        if let Some(dir) = pad.parent() {
            let _ = fs::create_dir_all(dir);
        }
        loop {
            thread::sleep(Duration::from_millis(200));
            // Bouw de snapshot onder een KORTE lock en serialiseer daarna BUITEN
            // de lock — de dure string-opbouw blokkeert dan geen enkele boeking.
            let snap = {
                let mut s = state.write().unwrap();
                if !s.vuil {
                    continue;
                }
                s.vuil = false;
                s.snapshot()
            };
            let tekst = snap.dump();
            let tmp = pad.with_extension("tmp");
            if fs::write(&tmp, tekst.as_bytes()).is_ok() {
                let _ = fs::rename(&tmp, &pad);
            }
        }
    });
}

fn json_resp(r: Resp) -> Response {
    Response { status: r.status, body: r.body.dump() }
}
fn fout(status: u16, msg: &str) -> Response {
    let mut b = Json::obj();
    b.set("error", Json::Str(msg.into()));
    Response { status, body: b.dump() }
}

/* De Ontsmetter-routes (malware-scanner). /api/av/scan haalt een payload
   (base64 in `data`, of rauwe `tekst`) door de scanner en telt het verdict mee;
   /api/av/status geeft de tellingen + het aantal definities. Zelfde verdicten
   als de Node-scanner (pariteit). */
#[derive(Default)]
struct AvStand {
    totaal: u64,
    besmet: u64,
    verdacht: u64,
    schoon: u64,
}

fn av_route(stand: &std::sync::Mutex<AvStand>, req: &Request) -> Response {
    if req.path == "/api/av/status" {
        let s = stand.lock().unwrap();
        let mut b = Json::obj();
        b.set("ok", Json::Bool(true))
            .set("definities", Json::Num(rtg_motor::ontsmetter::aantal_definities() as f64))
            .set("totaal", Json::Num(s.totaal as f64))
            .set("besmet", Json::Num(s.besmet as f64))
            .set("verdacht", Json::Num(s.verdacht as f64))
            .set("schoon", Json::Num(s.schoon as f64))
            .set("scanner", Json::Str("De Ontsmetter (Rust): handtekeningen + heuristiek + entropie".into()));
        return Response { status: 200, body: b.dump() };
    }
    if req.method != "POST" || req.path != "/api/av/scan" {
        return fout(404, "Onbekende route.");
    }
    let body = match json::parse(if req.body.is_empty() { "{}" } else { &req.body }) {
        Ok(v) => v,
        Err(_) => return fout(400, "Kapotte JSON."),
    };
    let mime = body.str_at("mime").unwrap_or("application/octet-stream").to_string();
    let naam = body.str_at("naam").unwrap_or("(upload)").to_string();
    let buf: Vec<u8> = if let Some(d) = body.str_at("data") {
        rtg_motor::ontsmetter::base64_decode(d)
    } else if let Some(t) = body.str_at("tekst") {
        t.as_bytes().to_vec()
    } else {
        return fout(400, "Geef 'data' (base64) of 'tekst'.");
    };
    let v = rtg_motor::ontsmetter::scan(&buf, &naam, &mime);
    {
        let mut s = stand.lock().unwrap();
        s.totaal += 1;
        match v.verdict {
            "besmet" => s.besmet += 1,
            "verdacht" => s.verdacht += 1,
            _ => s.schoon += 1,
        }
    }
    let redenen = Json::Arr(v.redenen.iter().map(|r| Json::Str(r.clone())).collect());
    let mut b = Json::obj();
    b.set("ok", Json::Bool(true))
        .set("verdict", Json::Str(v.verdict.into()))
        .set("bytes", Json::Num(v.bytes as f64))
        .set("entropie", Json::Num(v.entropie))
        .set("redenen", redenen);
    Response { status: 200, body: b.dump() }
}

fn reken_route(req: &Request) -> Response {
    if req.method != "POST" || req.path != "/api/reken/magnaat/markt" {
        return fout(404, "Onbekende rekenroute.");
    }
    let body = match json::parse(if req.body.is_empty() { "{}" } else { &req.body }) {
        Ok(v) => v,
        Err(_) => return fout(400, "Kapotte JSON."),
    };
    match rtg_motor::magnaat::bereken_markt(&body) {
        Ok(v) => Response { status: 200, body: v.dump() },
        Err(e) => fout(400, &e),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("capability-scan") {
        let root = match args.get(2) {
            Some(p) => std::path::Path::new(p),
            None => {
                eprintln!("gebruik: rtg-motor capability-scan <projectroot>");
                std::process::exit(2);
            }
        };
        match rtg_motor::capabilities::scan(root) {
            Ok(uit) => {
                println!("{}", uit.dump());
                return;
            }
            Err(fout) => {
                eprintln!("[capability-scan] {}", fout);
                std::process::exit(1);
            }
        }
    }
    let addr = env("RTG_MOTOR_ADDR", "127.0.0.1:3100");
    let maxconn: usize = env("RTG_MOTOR_MAXCONN", "1024").parse().unwrap_or(1024);

    /* Startguard: naar buiten luisteren mag alleen met een token. Anders staat
       de kluis (onthul/wis) en het rauwe boeken open voor iedereen die het
       adres kan bereiken. Liever niet starten dan stil open staan. */
    let token = env("RTG_MOTOR_TOKEN", "");
    if token.is_empty() && !is_loopback(&addr) {
        eprintln!("[motor] WEIGER TE STARTEN: {} is geen loopback-adres en RTG_MOTOR_TOKEN is niet gezet.", addr);
        eprintln!("[motor] Zonder token staan /api/kluis/onthul en /api/pay/boek open voor elke bereiker.");
        eprintln!("[motor] Zet RTG_MOTOR_TOKEN, of luister op 127.0.0.1.");
        std::process::exit(1);
    }
    if token.is_empty() {
        eprintln!("[motor] let op: geen RTG_MOTOR_TOKEN gezet; alleen loopback, geen tweede slot.");
    } else if token.len() < 16 {
        eprintln!("[motor] WEIGER TE STARTEN: RTG_MOTOR_TOKEN is te kort ({} tekens, minimaal 16).", token.len());
        std::process::exit(1);
    } else {
        eprintln!("[motor] poortwacht actief: elk verzoek behalve /api/leeft heeft een geldig token nodig.");
    }

    let state = Arc::new(RwLock::new(State::new()));
    laad_snapshot(&state);
    start_flusher(Arc::clone(&state));

    // ledengids: open een bestaande gids als die er is (out-of-RAM, O(1) geheugen)
    let gids: Arc<RwLock<Option<Gids>>> = Arc::new(RwLock::new(None));
    {
        let pad = gids_pad();
        if pad.exists() {
            if let Ok(g) = Gids::open(&pad) {
                eprintln!("[motor] ledengids geopend: {} leden ({:.1} MB op schijf), lezen via {}",
                    g.aantal(), g.bestandsbytes() as f64 / 1e6, if g.via_kaart() { "mmap (RAM-snelheid)" } else { "seek+read" });
                *gids.write().unwrap() = Some(g);
            }
        }
    }

    // kluis: identiteitskluis met onze eigen ChaCha20-Poly1305 (zero-dep)
    let router_kluis = {
        let k = Arc::new(std::sync::Mutex::new(open_kluis()));
        eprintln!("[motor] kluis actief: XChaCha20-Poly1305, sleutel-vingerafdruk {}", k.lock().unwrap().vingerafdruk());
        start_kluis_flusher(Arc::clone(&k));
        k
    };

    // De Ontsmetter: malware-scanner (zero-dep, byte-scan in een enkele pass)
    let router_av = Arc::new(std::sync::Mutex::new(AvStand::default()));
    eprintln!("[motor] Ontsmetter actief: {} handtekeningen (Rust)", rtg_motor::ontsmetter::aantal_definities());

    eprintln!("[motor] RTG-motor luistert op {} (max {} verbindingen)", addr, maxconn);

    let router_state = Arc::clone(&state);
    let router_gids = Arc::clone(&gids);
    let resultaat = http::serve(&addr, maxconn, move |req: &Request| {
        // kale liveness: altijd open, verraadt niets over geld of leden
        if req.path == "/api/leeft" {
            let mut b = Json::obj();
            b.set("ok", Json::Bool(true));
            return Response { status: 200, body: b.dump() };
        }
        if !mag_erdoor(&token, req) {
            return fout(403, "Geen geldig motor-token.");
        }
        if req.path.starts_with("/api/gids/") {
            return gids_route(&router_gids, req);
        }
        if req.path.starts_with("/api/kluis/") {
            return kluis_route(&router_kluis, req);
        }
        if req.path.starts_with("/api/av/") {
            return av_route(&router_av, req);
        }
        if req.path.starts_with("/api/reken/") {
            return reken_route(req);
        }
        route(&router_state, req)
    });
    if let Err(e) = resultaat {
        eprintln!("[motor] kon niet starten: {}", e);
        std::process::exit(1);
    }
}

/* De ledengids-routes: bouwen (demo-seed op schaal), zoeken (exact + prefix) en
   status. Out-of-RAM: het zoeken gebeurt met binair zoeken op schijf. */
fn gids_route(gids: &RwLock<Option<Gids>>, req: &Request) -> Response {
    if req.path == "/api/gids/status" {
        let g = gids.read().unwrap();
        let mut b = Json::obj();
        match &*g {
            Some(g) => {
                b.set("ok", Json::Bool(true))
                    .set("leden", Json::Num(g.aantal() as f64))
                    .set("bestandBytes", Json::Num(g.bestandsbytes() as f64))
                    .set("mmap", Json::Bool(g.via_kaart()))
                    .set("ramModel", Json::Str(
                        if g.via_kaart() { "O(1) heap - mmap, binair zoeken in de paginacache".into() }
                        else { "O(1) heap - binair zoeken met seek+read op schijf".into() }));
            }
            None => {
                b.set("ok", Json::Bool(true)).set("leden", Json::Num(0.0)).set("detail", Json::Str("nog niet gebouwd".into()));
            }
        }
        return Response { status: 200, body: b.dump() };
    }

    if req.method != "POST" {
        return fout(404, "Onbekende route.");
    }
    let body = match json::parse(if req.body.is_empty() { "{}" } else { &req.body }) {
        Ok(v) => v,
        Err(_) => return fout(400, "Kapotte JSON."),
    };

    match req.path.as_str() {
        "/api/gids/bouw" => {
            let n = body.i64_at("aantal").unwrap_or(0);
            if n <= 0 || n > 50_000_000 {
                return fout(400, "aantal moet 1..50000000 zijn.");
            }
            let pad = gids_pad();
            if let Some(dir) = pad.parent() {
                let _ = fs::create_dir_all(dir);
            }
            let rijen = ledengids::demo(n as usize);
            match ledengids::bouw(&pad, rijen) {
                Ok(m) => match Gids::open(&pad) {
                    Ok(g) => {
                        let bytes = g.bestandsbytes();
                        *gids.write().unwrap() = Some(g);
                        let mut b = Json::obj();
                        b.set("ok", Json::Bool(true)).set("leden", Json::Num(m as f64)).set("bestandBytes", Json::Num(bytes as f64));
                        Response { status: 200, body: b.dump() }
                    }
                    Err(e) => fout(500, &e.to_string()),
                },
                Err(e) => fout(500, &e.to_string()),
            }
        }
        "/api/gids/zoek" => {
            let naam = body.str_at("naam").unwrap_or("");
            let g = gids.read().unwrap();
            let g = match &*g {
                Some(g) => g,
                None => return fout(404, "De gids is nog niet gebouwd."),
            };
            let exact = g.exact(naam).unwrap_or(None);
            let pref = g.prefix(naam, 10).unwrap_or_default();
            let mut b = Json::obj();
            b.set("ok", Json::Bool(true));
            b.set("exact", exact.map(|r| r.to_json()).unwrap_or(Json::Null));
            b.set("suggesties", Json::Arr(pref.iter().map(|r| r.to_json()).collect()));
            Response { status: 200, body: b.dump() }
        }
        _ => fout(404, "Onbekende route."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(path: &str, token: &str) -> Request {
        Request { method: "POST".into(), path: path.into(), body: "{}".into(), token: token.into() }
    }

    #[test]
    fn loopback_herkenning() {
        for a in ["127.0.0.1:3100", "localhost:3100", "[::1]:3100", "127.5.5.5:80", "::1"] {
            assert!(is_loopback(a), "{} is loopback", a);
        }
        for a in ["0.0.0.0:3100", "10.0.0.5:3100", "[2001:db8::1]:3100", "motor.intern:3100", "192.168.1.9:3100"] {
            assert!(!is_loopback(a), "{} is GEEN loopback", a);
        }
    }

    /* Met een token moet elk verzoek hem meesturen; zonder token laat de
       poortwacht alles door (dan staat de motor per startguard op loopback). */
    #[test]
    fn poortwacht_eist_token() {
        let t = "een-heel-lang-geheim-token";
        assert!(mag_erdoor(t, &req("/api/kluis/onthul", t)), "juist token mag erdoor");
        assert!(!mag_erdoor(t, &req("/api/kluis/onthul", "")), "geen token: weigeren");
        assert!(!mag_erdoor(t, &req("/api/kluis/onthul", "fout")), "fout token: weigeren");
        assert!(!mag_erdoor(t, &req("/api/pay/boek", "een-heel-lang-geheim-toke")), "bijna goed is niet goed");
        // liveness blijft open, de rest niet
        assert!(mag_erdoor(t, &req("/api/leeft", "")), "liveness is altijd open");
        assert!(!mag_erdoor(t, &req("/api/ready", "")), "status hoort achter het token");
        // zonder geconfigureerd token: geen slot (loopback-only, zie startguard)
        assert!(mag_erdoor("", &req("/api/kluis/onthul", "")));
    }

    #[test]
    fn status_noemt_de_native_motoren() {
        let state = RwLock::new(State::new());
        let antwoord = route(&state, &req("/api/motor/status", ""));
        assert_eq!(antwoord.status, 200);
        let body = json::parse(&antwoord.body).unwrap();
        let namen = match body.get("nativeMotoren") {
            Some(Json::Arr(v)) => v,
            _ => panic!("nativeMotoren ontbreekt"),
        };
        assert!(namen.iter().any(|n| n.as_str() == Some("magnaat-markt")));
        assert!(namen.iter().any(|n| n.as_str() == Some("capability-bronscan")));
        assert!(namen.iter().any(|n| n.as_str() == Some("identiteitskluis-xchacha")));
    }
}

fn route(state: &RwLock<State>, req: &Request) -> Response {
    // ---- lees-paden: read-lock, lezers blokkeren elkaar niet ----
    if req.path == "/api/pay/gezond" {
        let (klopt, _som) = state.read().unwrap().gezond();
        let mut b = Json::obj();
        b.set("klopt", Json::Bool(klopt));
        return Response { status: if klopt { 200 } else { 500 }, body: b.dump() };
    }
    if req.path == "/api/motor/saldi" {
        // De hele geldstand: alleen achter een expliciete vlag. RTG_MOTOR_DEBUG
        // voor het pariteitsharnas; RTG_MOTOR_SALDI zodat de gepaarde JS-server
        // zijn spiegel bij een herstart uit de motor-snapshot kan reconcilen
        // (cutover). Zonder een van beide: onvindbaar (404).
        let toe = std::env::var("RTG_MOTOR_DEBUG").as_deref() == Ok("1")
            || std::env::var("RTG_MOTOR_SALDI").as_deref() == Ok("1");
        if !toe {
            return fout(404, "Onbekende route.");
        }
        let s = state.read().unwrap();
        return Response { status: 200, body: s.saldi_json().dump() };
    }
    if req.path == "/api/ready" || req.path == "/api/motor/status" {
        let s = state.read().unwrap();
        let (klopt, som) = s.gezond();
        let mut b = Json::obj();
        b.set("ok", Json::Bool(true))
            .set("klopt", Json::Bool(klopt))
            .set("som", Json::Num(som as f64))
            .set("vingerafdruk", Json::Str(s.vingerafdruk()))
            .set("leden", Json::Num(s.ledental() as f64))
            .set("nativeMotoren", Json::Arr(vec![
                Json::Str("pay-grootboek".into()),
                Json::Str("bank-grootboek".into()),
                Json::Str("magnaat-markt".into()),
                Json::Str("capability-bronscan".into()),
                Json::Str("ledengids".into()),
                Json::Str("identiteitskluis-xchacha".into()),
                Json::Str("ontsmetter".into()),
            ]));
        return Response { status: 200, body: b.dump() };
    }
    // Bank-grootboek (cutover stap 3): eigen som + vingerafdruk voor de drift-detector.
    if req.path == "/api/bank/status" {
        let s = state.read().unwrap();
        let (klopt, som) = s.bank_gezond();
        let mut b = Json::obj();
        b.set("ok", Json::Bool(true))
            .set("klopt", Json::Bool(klopt))
            .set("som", Json::Num(som as f64))
            .set("vingerafdruk", Json::Str(s.bank_vingerafdruk()));
        return Response { status: 200, body: b.dump() };
    }
    // Volledige bank-saldi voor de herstart-reconcile (achter dezelfde vlag als /api/motor/saldi).
    if req.path == "/api/bank/saldi" {
        let toe = std::env::var("RTG_MOTOR_DEBUG").as_deref() == Ok("1")
            || std::env::var("RTG_MOTOR_SALDI").as_deref() == Ok("1");
        if !toe { return fout(404, "Onbekende route."); }
        let s = state.read().unwrap();
        let mut o = Json::obj();
        if let Json::Obj(m) = &mut o {
            for (k, v) in &s.bank.saldi { m.insert(k.clone(), Json::Num(*v as f64)); }
        }
        return Response { status: 200, body: o.dump() };
    }

    if req.method != "POST" {
        return fout(404, "Onbekende route.");
    }
    let body = match json::parse(if req.body.is_empty() { "{}" } else { &req.body }) {
        Ok(v) => v,
        Err(_) => return fout(400, "Kapotte JSON."),
    };

    // codenaam/supplier komen als veld mee (de Node-poort ervoor doet de auth)
    let codenaam = body.str_at("codenaam").unwrap_or("");
    let supplier = body.str_at("supplier").unwrap_or("");
    let idem = body.str_at("idem");

    // read-only endpoints met een body: alleen een read-lock
    match req.path.as_str() {
        "/api/pay/overzicht" => return json_resp(state.read().unwrap().overzicht(codenaam)),
        "/api/supplier/pay/overzicht" => return json_resp(state.read().unwrap().partner_overzicht(supplier)),
        _ => {}
    }

    // schaduw-boekbatch: efficiënt veel spiegelingen tegelijk toepassen
    if req.path == "/api/pay/boekbatch" {
        let mut s = state.write().unwrap();
        let mut n = 0i64;
        if let Some(Json::Arr(rijen)) = body.get("boekingen") {
            for r in rijen {
                let van = r.str_at("van").unwrap_or("");
                let naar = r.str_at("naar").unwrap_or("");
                let centen = r.i64_at("centen").unwrap_or(0);
                if s.spiegel_boek(van, naar, centen, r.str_at("soort").unwrap_or("boeking"), r.str_at("oms").unwrap_or(""), r.str_at("ref").map(|x| x.to_string())).status < 300 {
                    n += 1;
                }
            }
        }
        let mut b = Json::obj();
        b.set("ok", Json::Bool(true)).set("toegepast", Json::Num(n as f64));
        return Response { status: 200, body: b.dump() };
    }

    // schrijf-paden: write-lock
    let mut s = state.write().unwrap();
    match req.path.as_str() {
        "/api/pay/registreer" => json_resp(s.registreer_lid(codenaam)),
        "/api/pay/boek" => json_resp(s.spiegel_boek(body.str_at("van").unwrap_or(""), body.str_at("naar").unwrap_or(""), body.i64_at("centen").unwrap_or(0), body.str_at("soort").unwrap_or("boeking"), body.str_at("oms").unwrap_or(""), body.str_at("ref").map(|x| x.to_string()))),
        "/api/pay/boekguard" => json_resp(s.boek_guard(body.str_at("van").unwrap_or(""), body.str_at("naar").unwrap_or(""), body.i64_at("centen").unwrap_or(0), body.str_at("soort").unwrap_or("boeking"), body.str_at("oms").unwrap_or(""), body.str_at("ref").map(|x| x.to_string()))),
        "/api/pay/oplaad" => json_resp(s.laad_op(codenaam, body.i64_at("centen"), idem)),
        "/api/pay/stuur" => json_resp(s.stuur(codenaam, body.str_at("aan").unwrap_or(""), body.i64_at("centen"), body.str_at("oms"), idem, "p2p")),
        "/api/pay/tikcode" => json_resp(s.tik_code(codenaam)),
        "/api/pay/tik" => json_resp(s.tik_betaal(codenaam, body.str_at("code").unwrap_or(""), body.i64_at("centen"), body.str_at("oms"), idem)),
        "/api/pay/kascode" => json_resp(s.kas_code(codenaam, body.i64_at("maxCenten"))),
        "/api/supplier/pay/in" => json_resp(s.kas_int(supplier, body.str_at("code").unwrap_or(""), body.i64_at("centen"), body.str_at("oms"), idem)),
        "/api/supplier/pay/uitbetaal" => json_resp(s.partner_uitbetaal(supplier, idem)),
        // Bank-grootboek (cutover stap 3): rauwe boeking — de rijke bodem/bevroren-guard blijft in JS.
        "/api/bank/boek" => json_resp(s.bank_boek(body.str_at("van").unwrap_or(""), body.str_at("naar").unwrap_or(""), body.i64_at("centen").unwrap_or(0), body.str_at("soort").unwrap_or("boeking"), body.str_at("oms").unwrap_or(""), body.str_at("ref").map(|x| x.to_string()))),
        _ => fout(404, "Onbekende route."),
    }
}
