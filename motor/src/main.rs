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

    eprintln!("[motor] RTG money-engine (Rust, zero-dep) luistert op {} (max {} verbindingen)", addr, maxconn);

    let router_state = Arc::clone(&state);
    let resultaat = http::serve(&addr, maxconn, move |req: &Request| {
        route(&router_state, req)
    });
    if let Err(e) = resultaat {
        eprintln!("[motor] kon niet starten: {}", e);
        std::process::exit(1);
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

    // schrijf-paden: write-lock
    let mut s = state.write().unwrap();
    match req.path.as_str() {
        "/api/pay/registreer" => json_resp(s.registreer_lid(codenaam)),
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
