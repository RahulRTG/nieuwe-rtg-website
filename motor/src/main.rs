/* RTG Motor — binaire. Zet de HTTP/1.1-motor om de money-engine en spreekt
   exact dezelfde routes als server/routes/pay.js, zodat De Beproeving (die
   HTTP bestookt) er niets van merkt. Zero-dependency: alleen std.

   Omgeving:
     RTG_MOTOR_ADDR     luisteradres (standaard 127.0.0.1:3100)
     RTG_MOTOR_MAXCONN  plafond gelijktijdige verbindingen (standaard 1024)
     RTG_MOTOR_DATA     snapshot-bestand (standaard ./motor-data/state.json)

   Let op: authenticatie/rol-scheiding zit in de Node-poort ervoor; de motor is
   het grootboek. Codenaam/supplier komen als velden mee in de body. */
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
            k.vuil = false;
            (k.pad().to_path_buf(), k.snapshot().dump())
        };
        let tmp = pad.with_extension("tmp");
        if fs::write(&tmp, tekst.as_bytes()).is_ok() {
            let _ = fs::rename(&tmp, &pad);
        }
    });
}

fn kluis_route(kluis: &std::sync::Mutex<rtg_motor::kluis::Kluis>, req: &Request) -> Response {
    if req.path == "/api/kluis/status" {
        let k = kluis.lock().unwrap();
        let mut b = Json::obj();
        b.set("ok", Json::Bool(true))
            .set("records", Json::Num(k.aantal() as f64))
            .set("crypto", Json::Str("ChaCha20-Poly1305 (AEAD), versleuteld op schijf".into()))
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

fn main() {
    let addr = env("RTG_MOTOR_ADDR", "127.0.0.1:3100");
    let maxconn: usize = env("RTG_MOTOR_MAXCONN", "1024").parse().unwrap_or(1024);

    let state = Arc::new(RwLock::new(State::new()));
    laad_snapshot(&state);
    start_flusher(Arc::clone(&state));

    // ledengids: open een bestaande gids als die er is (out-of-RAM, O(1) geheugen)
    let gids: Arc<RwLock<Option<Gids>>> = Arc::new(RwLock::new(None));
    {
        let pad = gids_pad();
        if pad.exists() {
            if let Ok(g) = Gids::open(&pad) {
                eprintln!("[motor] ledengids geopend: {} leden ({:.1} MB op schijf)", g.aantal(), g.bestandsbytes() as f64 / 1e6);
                *gids.write().unwrap() = Some(g);
            }
        }
    }

    // kluis: identiteitskluis met onze eigen ChaCha20-Poly1305 (zero-dep)
    let router_kluis = {
        let k = Arc::new(std::sync::Mutex::new(open_kluis()));
        eprintln!("[motor] kluis actief: ChaCha20-Poly1305, sleutel-vingerafdruk {}", k.lock().unwrap().vingerafdruk());
        start_kluis_flusher(Arc::clone(&k));
        k
    };

    eprintln!("[motor] RTG-motor luistert op {} (max {} verbindingen)", addr, maxconn);

    let router_state = Arc::clone(&state);
    let router_gids = Arc::clone(&gids);
    let resultaat = http::serve(&addr, maxconn, move |req: &Request| {
        if req.path.starts_with("/api/gids/") {
            return gids_route(&router_gids, req);
        }
        if req.path.starts_with("/api/kluis/") {
            return kluis_route(&router_kluis, req);
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
                    .set("ramModel", Json::Str("O(1) — binair zoeken op schijf".into()));
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

fn route(state: &RwLock<State>, req: &Request) -> Response {
    // ---- lees-paden: read-lock, lezers blokkeren elkaar niet ----
    if req.path == "/api/pay/gezond" {
        let (klopt, _som) = state.read().unwrap().gezond();
        let mut b = Json::obj();
        b.set("klopt", Json::Bool(klopt));
        return Response { status: if klopt { 200 } else { 500 }, body: b.dump() };
    }
    if req.path == "/api/motor/saldi" {
        // alleen achter de debug-vlag: het is de hele geldstand
        if std::env::var("RTG_MOTOR_DEBUG").as_deref() != Ok("1") {
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
            .set("leden", Json::Num(s.ledental() as f64));
        return Response { status: 200, body: b.dump() };
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
        "/api/pay/oplaad" => json_resp(s.laad_op(codenaam, body.i64_at("centen"), idem)),
        "/api/pay/stuur" => json_resp(s.stuur(codenaam, body.str_at("aan").unwrap_or(""), body.i64_at("centen"), body.str_at("oms"), idem, "p2p")),
        "/api/pay/tikcode" => json_resp(s.tik_code(codenaam)),
        "/api/pay/tik" => json_resp(s.tik_betaal(codenaam, body.str_at("code").unwrap_or(""), body.i64_at("centen"), body.str_at("oms"), idem)),
        "/api/pay/kascode" => json_resp(s.kas_code(codenaam, body.i64_at("maxCenten"))),
        "/api/supplier/pay/in" => json_resp(s.kas_int(supplier, body.str_at("code").unwrap_or(""), body.i64_at("centen"), body.str_at("oms"), idem)),
        "/api/supplier/pay/uitbetaal" => json_resp(s.partner_uitbetaal(supplier, idem)),
        _ => fout(404, "Onbekende route."),
    }
}
