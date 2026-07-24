/* Een kleine, snelle HTTP/1.1-motor op alleen std — een vaste thread-pool en
   keep-alive, zoals de eigen HTTP-motor aan de Node-kant. Genoeg voor de
   money-endpoints; geen framework, alles te auditen. */
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

pub struct Request {
    pub method: String,
    pub path: String,
    pub body: String,
}

// Harde grenzen tegen geheugen-DoS: een kwaadwillende client mag ons niet laten
// alloceren op basis van wat hij zegt te sturen.
const MAX_BODY: usize = 256 * 1024;   // 256 KB body is ruim voor elke pay-call
const MAX_LIJN: usize = 8 * 1024;      // start-lijn / header-lijn
const MAX_HEADERS: usize = 100;

enum Lees {
    Klaar(Request),
    Dicht,
    TeGroot,
}

pub struct Response {
    pub status: u16,
    pub body: String,
}

fn status_tekst(code: u16) -> &'static str {
    match code {
        200 => "OK",
        400 => "Bad Request",
        402 => "Payment Required",
        403 => "Forbidden",
        404 => "Not Found",
        409 => "Conflict",
        500 => "Internal Server Error",
        502 => "Bad Gateway",
        _ => "OK",
    }
}

/// Start de server op `addr`; `handler` beantwoordt elk verzoek. Thread-per-
/// verbinding (verwerkt keep-alive natuurlijk, geen pool-verhongering), met
/// `max_verbindingen` als plafond zodat een storm de machine niet opblaast.
/// Blokkeert.
pub fn serve<F>(addr: &str, max_verbindingen: usize, handler: F) -> std::io::Result<()>
where
    F: Fn(&Request) -> Response + Send + Sync + 'static,
{
    let listener = TcpListener::bind(addr)?;
    let handler = Arc::new(handler);
    let plafond = max_verbindingen.max(64);
    let actief = Arc::new(AtomicUsize::new(0));

    for stream in listener.incoming() {
        let s = match stream { Ok(s) => s, Err(_) => continue };
        // boven het plafond: sluit de verbinding netjes af (backpressure) i.p.v.
        // eindeloos threads spawnen
        if actief.load(Ordering::Relaxed) >= plafond {
            let _ = weiger_druk(s);
            continue;
        }
        actief.fetch_add(1, Ordering::Relaxed);
        let handler = Arc::clone(&handler);
        let actief_t = Arc::clone(&actief);
        thread::spawn(move || {
            let _ = behandel_verbinding(s, &*handler);
            actief_t.fetch_sub(1, Ordering::Relaxed);
        });
    }
    Ok(())
}

fn weiger_druk(mut s: TcpStream) -> std::io::Result<()> {
    let body = "{\"error\":\"Motor druk, probeer zo weer.\"}";
    let tekst = format!(
        "HTTP/1.1 503 Service Unavailable\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(), body
    );
    s.write_all(tekst.as_bytes())
}

fn behandel_verbinding<F>(stream: TcpStream, handler: &F) -> std::io::Result<()>
where
    F: Fn(&Request) -> Response,
{
    stream.set_nodelay(true).ok();
    // idle keep-alive mag een thread niet eeuwig vasthouden
    stream.set_read_timeout(Some(std::time::Duration::from_secs(30))).ok();
    let mut writer = stream.try_clone()?;
    let mut reader = BufReader::new(stream);

    loop {
        let req = match lees_verzoek(&mut reader) {
            Ok(Lees::Klaar(r)) => r,
            Ok(Lees::Dicht) => break, // verbinding netjes dicht
            Ok(Lees::TeGroot) => {
                // te grote body/regel: 413 en verbinding sluiten
                let body = "{\"error\":\"Verzoek te groot.\"}";
                let tekst = format!(
                    "HTTP/1.1 413 Payload Too Large\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(), body
                );
                let _ = writer.write_all(tekst.as_bytes());
                break;
            }
            Err(_) => break, // timeout of leesfout: sluit af, thread vrij
        };
        let resp = handler(&req);
        let tekst = format!(
            "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: keep-alive\r\n\r\n{}",
            resp.status,
            status_tekst(resp.status),
            resp.body.as_bytes().len(),
            resp.body
        );
        writer.write_all(tekst.as_bytes())?;
        writer.flush()?;
    }
    Ok(())
}

/* Lees een enkele regel met een harde bovengrens; een oneindige regel mag ons
   niet laten groeien. Geeft None bij EOF, TeGroot bij overschrijding. */
fn lees_lijn_begrensd<R: BufRead>(reader: &mut R, max: usize) -> std::io::Result<Option<Result<String, ()>>> {
    let mut buf = Vec::new();
    loop {
        let mut byte = [0u8; 1];
        let n = reader.read(&mut byte)?;
        if n == 0 {
            if buf.is_empty() { return Ok(None); } // EOF
            break;
        }
        if byte[0] == b'\n' {
            break;
        }
        if byte[0] != b'\r' {
            buf.push(byte[0]);
        }
        if buf.len() > max {
            return Ok(Some(Err(())));
        }
    }
    Ok(Some(Ok(String::from_utf8_lossy(&buf).into_owned())))
}

fn lees_verzoek<R: BufRead>(reader: &mut R) -> std::io::Result<Lees> {
    let startlijn = match lees_lijn_begrensd(reader, MAX_LIJN)? {
        None => return Ok(Lees::Dicht),
        Some(Err(())) => return Ok(Lees::TeGroot),
        Some(Ok(s)) => s,
    };
    let mut delen = startlijn.split_whitespace();
    let method = delen.next().unwrap_or("").to_string();
    let path = delen.next().unwrap_or("/").to_string();
    if method.is_empty() {
        return Ok(Lees::Dicht);
    }

    let mut content_length = 0usize;
    let mut header_teller = 0usize;
    loop {
        let lijn = match lees_lijn_begrensd(reader, MAX_LIJN)? {
            None => break,
            Some(Err(())) => return Ok(Lees::TeGroot),
            Some(Ok(s)) => s,
        };
        if lijn.is_empty() {
            break; // einde headers
        }
        header_teller += 1;
        if header_teller > MAX_HEADERS {
            return Ok(Lees::TeGroot);
        }
        if let Some(v) = lijn.split_once(':') {
            if v.0.eq_ignore_ascii_case("content-length") {
                content_length = v.1.trim().parse().unwrap_or(0);
            }
        }
    }

    // body-cap VOOR de allocatie: nooit alloceren op wat de client beweert
    if content_length > MAX_BODY {
        return Ok(Lees::TeGroot);
    }

    let mut body = String::new();
    if content_length > 0 {
        let mut buf = vec![0u8; content_length];
        reader.read_exact(&mut buf)?;
        body = String::from_utf8_lossy(&buf).into_owned();
    }

    Ok(Lees::Klaar(Request { method, path, body }))
}
