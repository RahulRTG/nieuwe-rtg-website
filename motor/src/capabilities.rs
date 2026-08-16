/* Native broncodescan voor de Magnaat Capability Graph. Deze laag doet alleen
begrensde, read-only inventarisatie: app-titels en statisch uitgeschreven
/api-routes. Classificatie, rechten en spelgedrag blijven in de Node-kern.
Geen regex-crate of directory-walker: uitsluitend std. */
use crate::json::Json;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_BESTANDEN: usize = 100_000;
const MAX_BRON_BYTES: u64 = 16 * 1024 * 1024;

fn bestanden(map: &Path, extensie: &str, uit: &mut Vec<PathBuf>) -> Result<(), String> {
    /* Iteratief: een absurd diepe lokale mapstructuur mag de stack niet laten
    overlopen. Symlinks worden niet gevolgd en ook het aantal kandidaten is
    hard begrensd. */
    let mut mappen = vec![map.to_path_buf()];
    let mut gezien = 0usize;
    while let Some(huidig) = mappen.pop() {
        let items = match fs::read_dir(huidig) {
            Ok(i) => i,
            Err(_) => continue,
        };
        for item in items.flatten() {
            gezien += 1;
            if gezien > MAX_BESTANDEN {
                return Err(format!("meer dan {} bronitems", MAX_BESTANDEN));
            }
            let soort = match item.file_type() {
                Ok(s) => s,
                Err(_) => continue,
            };
            let pad = item.path();
            if soort.is_dir() {
                mappen.push(pad);
            } else if soort.is_file() && pad.to_string_lossy().ends_with(extensie) {
                uit.push(pad);
            }
        }
    }
    Ok(())
}

fn lees_begrensd(pad: &Path) -> Result<Vec<u8>, String> {
    let lengte = match fs::metadata(pad) {
        Ok(m) => m.len(),
        Err(_) => return Ok(Vec::new()),
    };
    if lengte > MAX_BRON_BYTES {
        return Err(format!("bronbestand groter dan {} bytes", MAX_BRON_BYTES));
    }
    Ok(fs::read(pad).unwrap_or_default())
}

fn relatief(root: &Path, pad: &Path) -> String {
    pad.strip_prefix(root)
        .unwrap_or(pad)
        .components()
        .map(|c| c.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn tekst(s: &str) -> String {
    let mut zonder_tags = String::new();
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => {
                in_tag = true;
                zonder_tags.push(' ');
            }
            '>' if in_tag => in_tag = false,
            _ if !in_tag => zonder_tags.push(c),
            _ => {}
        }
    }
    let vervangen = zonder_tags.replace("&amp;", "&");
    vervangen.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn titel(html: &str, terugval: &str) -> String {
    let klein = html.to_ascii_lowercase();
    let begin = match klein.find("<title") {
        Some(i) => i,
        None => return terugval.to_string(),
    };
    let inhoud = match klein[begin..].find('>') {
        Some(i) => begin + i + 1,
        None => return terugval.to_string(),
    };
    let eind = match klein[inhoud..].find("</title>") {
        Some(i) => inhoud + i,
        None => return terugval.to_string(),
    };
    let eerste = html[inhoud..eind]
        .split(['·', '|'])
        .next()
        .unwrap_or(terugval);
    let schoon = tekst(eerste);
    if schoon.is_empty() {
        terugval.to_string()
    } else {
        schoon
    }
}

fn scan_apps(root: &Path) -> Result<Vec<Json>, String> {
    let basis = root.join("public/apps");
    let mut paden = Vec::new();
    bestanden(&basis, ".html", &mut paden)?;
    paden.sort();
    let mut uit = Vec::with_capacity(paden.len());
    for pad in paden {
        let rel_public = relatief(&root.join("public"), &pad);
        let bestand = relatief(root, &pad);
        let terugval = pad.file_stem().unwrap_or_default().to_string_lossy();
        let html = String::from_utf8(lees_begrensd(&pad)?).unwrap_or_default();
        let mut app = Json::obj();
        app.set("pad", Json::Str(format!("/{}", rel_public)))
            .set("naam", Json::Str(titel(&html, &terugval)))
            .set("bestand", Json::Str(bestand));
        uit.push(app);
    }
    Ok(uit)
}

fn woord(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

fn wit(c: u8) -> bool {
    matches!(c, b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c)
}

fn toegang(bron: &[u8], einde: usize) -> &'static str {
    let tot = (einde + 240).min(bron.len());
    let mut kop = &bron[einde..tot];
    let pijl = kop.windows(2).position(|w| w == b"=>");
    let blok = kop.iter().position(|b| *b == b'{');
    let stop = match (pijl, blok) {
        (Some(a), Some(b)) => a.min(b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => kop.len(),
    };
    kop = &kop[..stop];
    if bevat(kop, b"boardroomAuth") {
        "boardroom"
    } else if bevat(kop, b"officeAuth") {
        "office"
    } else if bevat(kop, b"staffAuth") {
        "staff"
    } else if bevat(kop, b"supplierAuth") {
        "supplier"
    } else if bevat(kop, b"auth") {
        "member"
    } else {
        "publiek"
    }
}

fn bevat(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty() && haystack.windows(needle.len()).any(|w| w == needle)
}

/* Zelfde statische vorm als API_RE in magnaat-capabilities.js. Dynamisch
gebouwde routes horen bewust niet in deze scanner: de algemene routekeuring
bewaakt afzonderlijk dat routes voluit in de bron staan. */
fn endpoints_in(bron: &[u8], bestand: &str, uniek: &mut BTreeMap<String, Json>) {
    let ontvangers: [&[u8]; 2] = [b"app.", b"router."];
    let methoden: [(&[u8], &str); 5] = [
        (b"get", "GET"),
        (b"post", "POST"),
        (b"put", "PUT"),
        (b"patch", "PATCH"),
        (b"delete", "DELETE"),
    ];
    let mut i = 0usize;
    while i < bron.len() {
        let ontvanger = ontvangers.iter().find(|x| bron[i..].starts_with(x));
        let Some(ontvanger) = ontvanger else {
            i += 1;
            continue;
        };
        if i > 0 && woord(bron[i - 1]) {
            i += 1;
            continue;
        }
        let mut p = i + ontvanger.len();
        let Some((methode_bytes, methode)) =
            methoden.iter().find(|(m, _)| bron[p..].starts_with(m))
        else {
            i += 1;
            continue;
        };
        p += methode_bytes.len();
        while p < bron.len() && wit(bron[p]) {
            p += 1;
        }
        if bron.get(p) != Some(&b'(') {
            i += 1;
            continue;
        }
        p += 1;
        while p < bron.len() && wit(bron[p]) {
            p += 1;
        }
        let quote = match bron.get(p) {
            Some(b @ (b'\'' | b'"' | b'`')) => *b,
            _ => {
                i += 1;
                continue;
            }
        };
        p += 1;
        let route_begin = p;
        while p < bron.len() && !matches!(bron[p], b'\'' | b'"' | b'`') {
            p += 1;
        }
        if p == route_begin || bron.get(p) != Some(&quote) {
            i += 1;
            continue;
        }
        let route = String::from_utf8_lossy(&bron[route_begin..p]).into_owned();
        let einde = p + 1;
        i = einde;
        if !route.starts_with("/api/") {
            continue;
        }
        let sleutel = format!("{} {}", methode, route);
        let mut punt = Json::obj();
        punt.set("sleutel", Json::Str(sleutel.clone()))
            .set("methode", Json::Str((*methode).to_string()))
            .set("route", Json::Str(route))
            .set("bestand", Json::Str(bestand.to_string()))
            .set("toegang", Json::Str(toegang(bron, einde).to_string()));
        uniek.insert(sleutel, punt);
    }
}

fn scan_endpoints(root: &Path) -> Result<Vec<Json>, String> {
    let mut paden = Vec::new();
    bestanden(&root.join("server"), ".js", &mut paden)?;
    paden.sort();
    let mut uniek = BTreeMap::new();
    for pad in paden {
        let bron = lees_begrensd(&pad)?;
        endpoints_in(&bron, &relatief(root, &pad), &mut uniek);
    }
    Ok(uniek.into_values().collect())
}

pub fn scan(root: &Path) -> Result<Json, String> {
    if !root.join("server").is_dir() || !root.join("public/apps").is_dir() {
        return Err("projectroot mist server/ of public/apps/".into());
    }
    let mut uit = Json::obj();
    uit.set("ok", Json::Bool(true))
        .set("apps", Json::Arr(scan_apps(root)?))
        .set("endpoints", Json::Arr(scan_endpoints(root)?));
    Ok(uit)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn vindt_apps_routes_en_toegang_zonder_code_uit_te_voeren() {
        let uniek = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root =
            std::env::temp_dir().join(format!("rtg-cap-scan-{}-{}", std::process::id(), uniek));
        fs::create_dir_all(root.join("server/routes")).unwrap();
        fs::create_dir_all(root.join("public/apps")).unwrap();
        fs::write(
            root.join("public/apps/reis.html"),
            "<title>Reis &amp; Rit · RTG</title>",
        )
        .unwrap();
        fs::write(root.join("server/routes/reis.js"), "router.get('/api/reis/lijst', auth, h);\napp.post( `/api/reis/boek`, officeAuth, h);\nconst x=\"app.get('/api/nep')\";").unwrap();
        let antwoord = scan(&root).unwrap();
        let apps = match antwoord.get("apps") {
            Some(Json::Arr(a)) => a,
            _ => panic!(),
        };
        let endpoints = match antwoord.get("endpoints") {
            Some(Json::Arr(a)) => a,
            _ => panic!(),
        };
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].str_at("naam"), Some("Reis & Rit"));
        assert_eq!(endpoints.len(), 3); // net als de statische JS-regex scant dit ook tekstvormen
        assert!(endpoints
            .iter()
            .any(|e| e.str_at("route") == Some("/api/reis/boek")
                && e.str_at("toegang") == Some("office")));
        fs::remove_dir_all(root).unwrap();
    }
}
