/* De Ontsmetter in Rust: de platform-malware-scanner als hete motor-pijler.

   Zelfde eerlijke scope als de Node-kant (kern/antivirus.js): dit scant GEEN
   computer van een bezoeker, maar elk BESTAND dat RTG binnenkomt, met de
   technieken van een echte antivirus -- handtekeningen, heuristiek (magie vs
   opgegeven type, gevaarlijke/dubbele extensie) en Shannon-entropie. Byte-
   scannen op miljoenen uploads is precies de allocatie-arme, security-kritische
   taak waar Rust in uitblinkt: zero-dependency, geheugenveilig, en in een enkele
   pass over de bytes.

   De verdicten komen 1-op-1 overeen met de JS-scanner, zodat de motor een
   geverifieerde vervanger is (pariteit, net als het grootboek). */
use std::sync::OnceLock;

#[derive(Clone, Copy, PartialEq)]
enum Kind { Tekst, BytesStart }

struct Sig {
    naam: &'static str,
    besmet: bool,         // true = 'besmet' (hard), false = 'verdacht' (zacht)
    kind: Kind,
    patroon: &'static [u8],
    mime: Option<&'static str>, // alleen tellen bij dit opgegeven mime (bijv. pdf)
}

pub struct Verdict {
    pub verdict: &'static str, // "schoon" | "verdacht" | "besmet"
    pub redenen: Vec<String>,
    pub entropie: f64,
    pub bytes: usize,
}

// De definitielijst. Byte-patronen staan hier als echte bytes (b"..."); voor de
// uitvoerbare-magie gebruiken we de rauwe bytes.
fn definities() -> &'static Vec<Sig> {
    static D: OnceLock<Vec<Sig>> = OnceLock::new();
    D.get_or_init(|| {
        let t = |naam, besmet, patroon: &'static [u8]| Sig { naam, besmet, kind: Kind::Tekst, patroon, mime: None };
        let tm = |naam, besmet, patroon: &'static [u8], mime| Sig { naam, besmet, kind: Kind::Tekst, patroon, mime: Some(mime) };
        let bs = |naam, besmet, patroon: &'static [u8]| Sig { naam, besmet, kind: Kind::BytesStart, patroon, mime: None };
        vec![
            // testhandtekening
            t("EICAR-testbestand", true, b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"),
            // uitvoerbare bestanden (magie aan het begin)
            bs("Windows-uitvoerbaar (PE/MZ)", true, b"MZ"),
            bs("Linux-uitvoerbaar (ELF)", true, b"\x7fELF"),
            bs("macOS-uitvoerbaar (Mach-O)", true, b"\xfe\xed\xfa\xce"),
            bs("macOS-uitvoerbaar (Mach-O 64)", true, b"\xfe\xed\xfa\xcf"),
            bs("Java/uitvoerbaar (CAFEBABE)", true, b"\xca\xfe\xba\xbe"),
            bs("Android-uitvoerbaar (DEX)", true, b"dex\n"),
            bs("Shell-script (#!)", false, b"#!"),
            // archieven / containers
            bs("ZIP/JAR/Office-container", false, b"PK\x03\x04"),
            bs("RAR-archief", false, b"Rar!\x1a\x07"),
            bs("7-Zip-archief", false, b"7z\xbc\xaf\x27\x1c"),
            bs("GZIP-archief", false, b"\x1f\x8b\x08"),
            bs("OLE/Legacy-Office (kan macro dragen)", false, b"\xd0\xcf\x11\xe0"),
            // scripts verstopt in een bestand (polyglot)
            t("PHP-code in bestand", true, b"<?php"),
            t("Script-tag in bestand (polyglot)", true, b"<script"),
            t("SVG/HTML met event-handler (XSS)", true, b"onerror="),
            t("SVG/HTML met onload (XSS)", true, b"onload="),
            t("javascript:-URI", false, b"javascript:"),
            t("Verborgen iframe", false, b"<iframe"),
            // PHP-webshells
            t("Webshell (eval base64)", true, b"eval(base64_decode"),
            t("Webshell (shell_exec)", true, b"shell_exec("),
            t("Webshell (system $_)", true, b"system($_"),
            t("Webshell (passthru)", true, b"passthru("),
            t("Webshell (proc_open)", true, b"proc_open("),
            t("Webshell (popen)", true, b"popen("),
            t("Webshell (assert $_REQUEST)", true, b"assert($_REQUEST"),
            t("Webshell (create_function)", true, b"create_function("),
            // Windows/PowerShell/JS-uitvoering
            t("PowerShell -EncodedCommand", true, b"powershell -enc"),
            t("PowerShell Invoke-Expression", true, b"IEX("),
            t("PowerShell FromBase64String", false, b"FromBase64String("),
            t("WScript.Shell", true, b"WScript.Shell"),
            t("cmd.exe /c", false, b"cmd.exe /c"),
            t("JS eval(atob(", true, b"eval(atob("),
            t("JS eval(unescape(", true, b"eval(unescape("),
            t("Log4Shell (jndi)", false, b"${jndi:"),
            // Office-macro's / auto-uitvoering
            t("Office-macro (vbaProject)", false, b"vbaProject.bin"),
            t("Macro Auto_Open", false, b"Auto_Open"),
            t("Macro Document_Open", false, b"Document_Open"),
            t("Macro Workbook_Open", false, b"Workbook_Open"),
            // PDF-gevaar
            tm("PDF met JavaScript", false, b"/JavaScript", "application/pdf"),
            tm("PDF met /OpenAction", false, b"/OpenAction", "application/pdf"),
            tm("PDF met /Launch-actie", true, b"/Launch", "application/pdf"),
            tm("PDF met ingesloten bestand", false, b"/EmbeddedFile", "application/pdf"),
            // ransomware-losgeldbriefjes
            t("Ransomware-notitie (files encrypted)", false, b"YOUR FILES HAVE BEEN ENCRYPTED"),
            t("Ransomware-notitie (recover files)", false, b"RECOVER YOUR FILES"),
            t("Ransomware-notitie (decrypt readme)", false, b"README_FOR_DECRYPT"),
        ]
    })
}

pub fn aantal_definities() -> usize { definities().len() }

/* Eerste-byte-emmers voor de tekst-handtekeningen: byte -> indices van patronen
   die met die byte beginnen. Zo scannen we het bestand in ÉÉN pass in plaats van
   een keer per patroon: op elke positie kijken we alleen naar de handvol patronen
   met de juiste beginbyte (meestal nul). Dat is de snelheidswinst van de motor. */
fn emmers() -> &'static [Vec<usize>; 256] {
    static B: OnceLock<[Vec<usize>; 256]> = OnceLock::new();
    B.get_or_init(|| {
        let defs = definities();
        let mut b: [Vec<usize>; 256] = std::array::from_fn(|_| Vec::new());
        for (i, s) in defs.iter().enumerate() {
            if s.kind == Kind::Tekst && !s.patroon.is_empty() {
                b[s.patroon[0] as usize].push(i);
            }
        }
        b
    })
}

const GEVAARLIJK: &[&str] = &[
    "exe", "dll", "scr", "bat", "cmd", "com", "js", "jar", "vbs", "ps1", "sh",
    "php", "phtml", "msi", "apk",
];

fn begint_met(buf: &[u8], p: &[u8]) -> bool {
    buf.len() >= p.len() && &buf[..p.len()] == p
}

// Shannon-entropie (bits/byte) over maximaal 64 KiB.
pub fn entropie(buf: &[u8]) -> f64 {
    let n = buf.len().min(65536);
    if n == 0 { return 0.0; }
    let mut tel = [0u32; 256];
    for &b in &buf[..n] { tel[b as usize] += 1; }
    let mut h = 0.0f64;
    let nf = n as f64;
    for &c in tel.iter() {
        if c == 0 { continue; }
        let p = c as f64 / nf;
        h -= p * p.log2();
    }
    h
}

// klopt de magie met het opgegeven beeldtype? (alleen voor image/*)
fn magie_klopt(buf: &[u8], mime: &str) -> bool {
    let soort = match mime {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => return true, // geen (herkend) beeld: hier niets over zeggen
    };
    match soort {
        "png" => begint_met(buf, b"\x89PNG"),
        "jpg" => begint_met(buf, b"\xff\xd8\xff"),
        "gif" => begint_met(buf, b"GIF8"),
        "webp" => buf.len() >= 12 && &buf[0..4] == b"RIFF" && &buf[8..12] == b"WEBP",
        _ => true,
    }
}

/* De scan: geef een verdict terug. verdict: schoon | verdacht | besmet. */
pub fn scan(buf: &[u8], naam: &str, mime: &str) -> Verdict {
    let mut ernst: u8 = 0; // 0 schoon, 1 verdacht, 2 besmet
    let mut redenen: Vec<String> = Vec::new();
    let mut hef = |besmet: bool, r: String, ernst: &mut u8| {
        let e = if besmet { 2 } else { 1 };
        if e > *ernst { *ernst = e; }
        redenen.push(r);
    };

    // 1. handtekeningen. Byte-magie aan het begin apart; de tekst-patronen in
    //    ÉÉN pass over de bytes via de eerste-byte-emmers.
    let defs = definities();
    let bk = emmers();
    let mut geraakt = vec![false; defs.len()];
    for (i, s) in defs.iter().enumerate() {
        if s.kind == Kind::BytesStart && begint_met(buf, s.patroon) {
            geraakt[i] = true;
        }
    }
    for pos in 0..buf.len() {
        let cands = &bk[buf[pos] as usize];
        for &idx in cands.iter() {
            if geraakt[idx] { continue; }
            let s = &defs[idx];
            if let Some(m) = s.mime { if m != mime { continue; } }
            let p = s.patroon;
            if pos + p.len() <= buf.len() && &buf[pos..pos + p.len()] == p {
                geraakt[idx] = true;
            }
        }
    }
    for (i, s) in defs.iter().enumerate() {
        if geraakt[i] {
            hef(s.besmet, format!("handtekening: {}", s.naam), &mut ernst);
        }
    }

    // 2. heuristiek: magie vs opgegeven type (alleen 'verdacht' -- een echt
    //    uitvoerbaar bestand wordt al door zijn eigen handtekening 'besmet').
    if !magie_klopt(buf, mime) {
        hef(false, format!("type-vervalsing: de inhoud komt niet overeen met het opgegeven {}", mime), &mut ernst);
    }

    // 3. heuristiek: gevaarlijke / dubbele extensie in de bestandsnaam
    let lower = naam.to_ascii_lowercase();
    let delen: Vec<&str> = lower.split('.').filter(|d| !d.is_empty()).collect();
    if delen.len() >= 2 {
        let ext = delen[delen.len() - 1];
        if GEVAARLIJK.contains(&ext) {
            hef(true, format!("gevaarlijke extensie: .{}", ext), &mut ernst);
            if delen.len() >= 3 {
                hef(true, format!("dubbele extensie: {}", lower), &mut ernst);
            }
        }
    }

    // 4. heuristiek: entropie (niet op beeld -- dat is van nature hoog-entropisch)
    let is_beeld = mime.starts_with("image/");
    let h = entropie(buf);
    if !is_beeld && buf.len() > 256 && h > 7.5 {
        hef(false, format!("hoge entropie ({:.2}): mogelijk verpakt/versleuteld", h), &mut ernst);
    }

    let verdict = match ernst { 2 => "besmet", 1 => "verdacht", _ => "schoon" };
    Verdict { verdict, redenen, entropie: (h * 100.0).round() / 100.0, bytes: buf.len() }
}

/* Kleine base64-decoder (standaard-alfabet) zodat de HTTP-laag data-URL-payloads
   kan aanleveren zonder externe crate. Ongeldige tekens worden overgeslagen. */
pub fn base64_decode(s: &str) -> Vec<u8> {
    fn waarde(c: u8) -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let mut uit = Vec::with_capacity(s.len() / 4 * 3);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for &c in s.as_bytes() {
        if c == b'=' { break; }
        if let Some(v) = waarde(c) {
            acc = (acc << 6) | v as u32;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                uit.push((acc >> bits) as u8);
            }
        }
    }
    uit
}

#[cfg(test)]
mod tests {
    use super::*;

    const EICAR: &[u8] = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    const PNG: &[u8] = &[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];

    #[test]
    fn eicar_is_besmet() {
        let v = scan(EICAR, "test.com", "application/octet-stream");
        assert_eq!(v.verdict, "besmet");
        assert!(v.redenen.iter().any(|r| r.contains("EICAR")));
    }

    #[test]
    fn echte_png_is_schoon() {
        let v = scan(PNG, "pasfoto.png", "image/png");
        assert_eq!(v.verdict, "schoon", "{:?}", v.redenen);
    }

    #[test]
    fn pe_uitvoerbaar_is_besmet() {
        let v = scan(&[0x4d, 0x5a, 0x90, 0x00, 0x03], "x.bin", "application/octet-stream");
        assert_eq!(v.verdict, "besmet");
    }

    #[test]
    fn php_in_afbeelding_is_besmet() {
        let mut buf = PNG.to_vec();
        buf.extend_from_slice(b"<?php system($_GET[0]); ?>");
        let v = scan(&buf, "foto.png", "image/png");
        assert_eq!(v.verdict, "besmet");
    }

    #[test]
    fn type_vervalsing_zonder_handtekening_is_verdacht() {
        // bytes zijn geen PNG maar het heet image/png, en geen andere handtekening
        let v = scan(b"xxxxxxxxxxxxxxxxxxxx", "foto.png", "image/png");
        assert_eq!(v.verdict, "verdacht");
    }

    #[test]
    fn dubbele_extensie_is_besmet() {
        let v = scan(PNG, "vakantie.jpg.exe", "application/octet-stream");
        assert_eq!(v.verdict, "besmet");
    }

    #[test]
    fn hoge_entropie_op_niet_beeld_is_verdacht() {
        // 4 KiB pseudo-willekeur -> ~8 bits entropie
        let mut buf = vec![0u8; 4096];
        let mut x: u32 = 0x12345678;
        for b in buf.iter_mut() { x ^= x << 13; x ^= x >> 17; x ^= x << 5; *b = (x & 0xff) as u8; }
        let v = scan(&buf, "data.txt", "text/plain");
        assert_eq!(v.verdict, "verdacht", "{:?}", v.redenen);
        assert!(v.redenen.iter().any(|r| r.contains("entropie")));
    }

    #[test]
    fn uitgebreide_handtekeningen() {
        assert_eq!(scan(b"<?php proc_open(\"id\"); ?>", "x", "text/plain").verdict, "besmet");
        assert_eq!(scan(b"powershell -enc SQBFAFgA", "x", "text/plain").verdict, "besmet");
        assert_eq!(scan(b"<svg onerror=alert(1)>", "x", "text/plain").verdict, "besmet");
        assert_eq!(scan(b"eval(atob(\"...\"))", "x", "text/plain").verdict, "besmet");
        assert_eq!(scan(&[0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4], "a.zip", "application/zip").verdict, "verdacht");
        assert_eq!(scan(b"!!! YOUR FILES HAVE BEEN ENCRYPTED !!!", "x", "text/plain").verdict, "verdacht");
    }

    #[test]
    fn base64_rondrit() {
        let url = super::base64_decode("aGVsbG8gd29ybGQ=");
        assert_eq!(&url, b"hello world");
        // EICAR via base64 -> nog steeds besmet
        let b64 = "WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=";
        let buf = super::base64_decode(b64);
        assert_eq!(scan(&buf, "eicar", "application/octet-stream").verdict, "besmet");
    }

    #[test]
    #[ignore]
    fn bench_doorvoer() {
        // 8 MB schoon blok, meet scan-doorvoer
        let buf = vec![0x42u8; 8 * 1024 * 1024];
        let start = std::time::Instant::now();
        let ronden = 5;
        for _ in 0..ronden { let _ = scan(&buf, "groot.bin", "application/octet-stream"); }
        let mbps = (buf.len() as f64 * ronden as f64) / start.elapsed().as_secs_f64() / 1e6;
        eprintln!("Ontsmetter-doorvoer: {:.0} MB/s", mbps);
    }
}
