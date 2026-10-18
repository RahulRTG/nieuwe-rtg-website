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

/* Zelfde statische vorm als API_RE in magnaat-capabilities-routes.js.
Dynamisch gebouwde routes horen bewust niet in deze scanner: de algemene
routekeuring bewaakt afzonderlijk dat routes voluit in de bron staan. */
const METHODEN: [(&[u8], &str); 5] = [
    (b"get", "GET"),
    (b"post", "POST"),
    (b"put", "PUT"),
    (b"patch", "PATCH"),
    (b"delete", "DELETE"),
];

fn sla_wit_over(bron: &[u8], mut p: usize) -> usize {
    while p < bron.len() && wit(bron[p]) {
        p += 1;
    }
    p
}

/* Een letterlijke string gevolgd door `+` is het BEGIN van een adres, geen
adres (de spellenlus plakt er een naam achter). Zelfde regel als
wordtAangevuld() in de JS-tweeling. */
fn wordt_aangevuld(bron: &[u8], na: usize) -> bool {
    bron.get(sla_wit_over(bron, na)) == Some(&b'+')
}

/* Een aanroep `<ontvanger><methode>\s*(\s*<quote><pad><quote>` vanaf i:
methode, pad en de positie net na de sluitende quote. */
fn route_aanroep<'a>(
    bron: &'a [u8],
    i: usize,
    ontvangers: &[&[u8]],
) -> Option<(&'static str, &'a [u8], usize)> {
    let ontvanger = ontvangers.iter().find(|x| bron[i..].starts_with(x))?;
    if i > 0 && woord(bron[i - 1]) {
        return None;
    }
    let mut p = i + ontvanger.len();
    let (methode_bytes, methode) = METHODEN.iter().find(|(m, _)| bron[p..].starts_with(m))?;
    p = sla_wit_over(bron, p + methode_bytes.len());
    if bron.get(p) != Some(&b'(') {
        return None;
    }
    p = sla_wit_over(bron, p + 1);
    let quote = match bron.get(p) {
        Some(b @ (b'\'' | b'"' | b'`')) => *b,
        _ => return None,
    };
    p += 1;
    let route_begin = p;
    while p < bron.len() && !matches!(bron[p], b'\'' | b'"' | b'`') {
        p += 1;
    }
    if p == route_begin || bron.get(p) != Some(&quote) {
        return None;
    }
    Some((methode, &bron[route_begin..p], p + 1))
}

fn punt(sleutel: String, methode: &str, route: String, bestand: &str, toegang: &str) -> Json {
    let mut punt = Json::obj();
    punt.set("sleutel", Json::Str(sleutel))
        .set("methode", Json::Str(methode.to_string()))
        .set("route", Json::Str(route))
        .set("bestand", Json::Str(bestand.to_string()))
        .set("toegang", Json::Str(toegang.to_string()));
    punt
}

fn endpoints_in(bron: &[u8], bestand: &str, uniek: &mut BTreeMap<String, Json>) {
    let ontvangers: [&[u8]; 2] = [b"app.", b"router."];
    let mut i = 0usize;
    while i < bron.len() {
        let Some((methode, route, einde)) = route_aanroep(bron, i, &ontvangers) else {
            i += 1;
            continue;
        };
        i = einde;
        let route = String::from_utf8_lossy(route).into_owned();
        if !route.starts_with("/api/") || wordt_aangevuld(bron, einde) {
            continue;
        }
        let sleutel = format!("{} {}", methode, route);
        let p = punt(sleutel.clone(), methode, route, bestand, toegang(bron, einde));
        uniek.insert(sleutel, p);
    }
}

/* DE MOUNTS -- zie gemounteEndpoints() in magnaat-capabilities-routes.js voor het waarom.
Een router die relatief registreert en met app.use op /api/x wordt opgehangen
(naam.router als tweede argument): het voorvoegsel komt van de mount, de routes uit de module
die `naam` via require bindt en uit alles wat die (relatief, transitief)
laadt. Lexicaal, zonder code uit te voeren. */
fn ident_begin(c: u8) -> bool {
    c.is_ascii_alphabetic() || c == b'_' || c == b'$'
}

fn ident_deel(c: u8) -> bool {
    woord(c) || c == b'$'
}

fn ident_vanaf(bron: &[u8], p: usize) -> Option<usize> {
    if !bron.get(p).is_some_and(|c| ident_begin(*c)) {
        return None;
    }
    let mut q = p + 1;
    while q < bron.len() && ident_deel(bron[q]) {
        q += 1;
    }
    Some(q)
}

/* `<quote>(<eis><[^'"]*>)<zelfde quote>` vanaf p; geeft (inhoud, positie na). */
fn quote_tekst(bron: &[u8], p: usize, eis: &[u8]) -> Option<(usize, usize, usize)> {
    let quote = match bron.get(p) {
        Some(b @ (b'\'' | b'"')) => *b,
        _ => return None,
    };
    let begin = p + 1;
    if !bron[begin.min(bron.len())..].starts_with(eis) {
        return None;
    }
    let mut q = begin;
    while q < bron.len() && !matches!(bron[q], b'\'' | b'"') {
        q += 1;
    }
    if bron.get(q) != Some(&quote) {
        return None;
    }
    Some((begin, q, q + 1))
}

/* `require(\s*<quote>.<pad><quote>\s*)` vanaf p, met een woordgrens ervoor. */
fn require_vanaf(bron: &[u8], p: usize) -> Option<(String, usize)> {
    if !bron[p..].starts_with(b"require(") || (p > 0 && woord(bron[p - 1])) {
        return None;
    }
    let q = sla_wit_over(bron, p + 8);
    let (begin, eind, na) = quote_tekst(bron, q, b".")?;
    let r = sla_wit_over(bron, na);
    if bron.get(r) != Some(&b')') {
        return None;
    }
    Some((String::from_utf8_lossy(&bron[begin..eind]).into_owned(), r + 1))
}

fn requires_in(bron: &[u8]) -> Vec<String> {
    let mut uit = Vec::new();
    let mut i = 0usize;
    while i < bron.len() {
        match require_vanaf(bron, i) {
            Some((rel, na)) => {
                uit.push(rel);
                i = na;
            }
            None => i += 1,
        }
    }
    uit
}

/* `(const|let|var)\s+<naam>\s*=\s*require(...)`: het eerste relatieve pad
dat aan `naam` gebonden wordt. */
fn gebonden_require(bron: &[u8], naam: &[u8]) -> Option<String> {
    let mut i = 0usize;
    while i < bron.len() {
        let poging = (|| {
            if i > 0 && woord(bron[i - 1]) {
                return None;
            }
            let kw = [&b"const"[..], &b"let"[..], &b"var"[..]]
                .into_iter()
                .find(|k| bron[i..].starts_with(k))?;
            let p = i + kw.len();
            let q = sla_wit_over(bron, p);
            if q == p {
                return None;
            }
            let eind = ident_vanaf(bron, q)?;
            let gevonden = &bron[q..eind];
            let r = sla_wit_over(bron, eind);
            if bron.get(r) != Some(&b'=') {
                return None;
            }
            let s = sla_wit_over(bron, r + 1);
            let (rel, na) = require_vanaf(bron, s)?;
            Some((gevonden == naam, rel, na))
        })();
        match poging {
            Some((true, rel, _)) => return Some(rel),
            Some((false, _, na)) => i = na,
            None => i += 1,
        }
    }
    None
}

/* `app.use(\s*<quote>/api/...<quote>\s*,\s*<naam>(.router)?\s*[,)]` vanaf i. */
fn mount_vanaf(bron: &[u8], i: usize) -> Option<(String, Vec<u8>, usize)> {
    if !bron[i..].starts_with(b"app.use(") || (i > 0 && woord(bron[i - 1])) {
        return None;
    }
    let p = sla_wit_over(bron, i + 8);
    let (begin, eind, na) = quote_tekst(bron, p, b"/api/")?;
    let q = sla_wit_over(bron, na);
    if bron.get(q) != Some(&b',') {
        return None;
    }
    let r = sla_wit_over(bron, q + 1);
    let naam_eind = ident_vanaf(bron, r)?;
    let mut s = naam_eind;
    if bron[s..].starts_with(b".router") {
        s += 7;
    }
    s = sla_wit_over(bron, s);
    if !matches!(bron.get(s), Some(b',' | b')')) {
        return None;
    }
    let voorvoegsel = String::from_utf8_lossy(&bron[begin..eind]).into_owned();
    Some((voorvoegsel, bron[r..naam_eind].to_vec(), s + 1))
}

fn normaliseer(pad: &Path) -> PathBuf {
    use std::path::Component;
    let mut uit = PathBuf::new();
    for deel in pad.components() {
        match deel {
            Component::CurDir => {}
            Component::ParentDir => {
                uit.pop();
            }
            ander => uit.push(ander.as_os_str()),
        }
    }
    uit
}

fn los_op(bronnen: &BTreeMap<PathBuf, Vec<u8>>, van: &Path, relatief: &str) -> Option<PathBuf> {
    let basis = normaliseer(&van.parent().unwrap_or(Path::new("")).join(relatief));
    let met_js = PathBuf::from(format!("{}.js", basis.to_string_lossy()));
    let index = basis.join("index.js");
    [basis, met_js, index].into_iter().find(|k| bronnen.contains_key(k))
}

fn geladen(bronnen: &BTreeMap<PathBuf, Vec<u8>>, start: &Path) -> Vec<PathBuf> {
    let mut gezien = vec![start.to_path_buf()];
    let mut rij = vec![start.to_path_buf()];
    while let Some(bestand) = rij.pop() {
        for rel in requires_in(&bronnen[&bestand]) {
            if let Some(doel) = los_op(bronnen, &bestand, &rel) {
                if !gezien.contains(&doel) {
                    gezien.push(doel.clone());
                    rij.push(doel);
                }
            }
        }
    }
    gezien.sort_by_key(|p| p.to_string_lossy().into_owned());
    gezien
}

fn gemounte_endpoints(root: &Path, bronnen: &BTreeMap<PathBuf, Vec<u8>>, uniek: &mut BTreeMap<String, Json>) {
    let mut volgorde: Vec<&PathBuf> = bronnen.keys().collect();
    volgorde.sort_by_key(|p| p.to_string_lossy().into_owned());
    for bestand in volgorde {
        let bron = &bronnen[bestand];
        let mut i = 0usize;
        while i < bron.len() {
            let Some((voorvoegsel, naam, na)) = mount_vanaf(bron, i) else {
                i += 1;
                continue;
            };
            i = na;
            let voorvoegsel = voorvoegsel.trim_end_matches('/').to_string();
            let Some(module) = gebonden_require(bron, &naam).and_then(|rel| los_op(bronnen, bestand, &rel)) else {
                continue;
            };
            for kind in geladen(bronnen, &module) {
                let kind_bron = &bronnen[&kind];
                let rel_kind = relatief(root, &kind);
                let ontvangers: [&[u8]; 1] = [b"router."];
                let mut j = 0usize;
                while j < kind_bron.len() {
                    let Some((methode, route, einde)) = route_aanroep(kind_bron, j, &ontvangers) else {
                        j += 1;
                        continue;
                    };
                    if !route.starts_with(b"/") {
                        j += 1; // zoals de regex: geen treffer, een teken verder
                        continue;
                    }
                    j = einde;
                    if route.starts_with(b"/api/") || wordt_aangevuld(kind_bron, einde) {
                        continue;
                    }
                    let samen = format!("{}{}", voorvoegsel, String::from_utf8_lossy(route));
                    let mut volledig = samen.trim_end_matches('/').to_string();
                    if volledig.is_empty() {
                        volledig = voorvoegsel.clone();
                    }
                    let sleutel = format!("{} {}", methode, volledig);
                    if uniek.contains_key(&sleutel) {
                        continue;
                    }
                    let p = punt(sleutel.clone(), methode, volledig, &rel_kind, toegang(kind_bron, einde));
                    uniek.insert(sleutel, p);
                }
            }
        }
    }
}

/* SAMENGESTELDE ADRESSEN -- zie samengesteldeEndpoints() in magnaat-capabilities-routes.js.
`<voorvoegsel> + '/rest'` als eerste argument: het voorvoegsel is de eerste
`const <naam> = '/api/...'` in hetzelfde bestand (een kale naam), of elke
`<eigenschap>: '/api/...'` in hetzelfde bestand (een naam met een punt erin).
Lexicaal, zonder code uit te voeren; dezelfde twee vormen als de JS-tweeling. */

/* `<' of "><eis>...<zelfde quote>` vanaf p; stopt op elk aanhalingsteken, ook
een backtick, precies zoals de tekenklasse [^'"`] in de JS-tweeling. */
fn quote_pad(bron: &[u8], p: usize, eis: &[u8]) -> Option<(usize, usize, usize)> {
    let quote = match bron.get(p) {
        Some(b @ (b'\'' | b'"')) => *b,
        _ => return None,
    };
    let begin = p + 1;
    if !bron[begin.min(bron.len())..].starts_with(eis) {
        return None;
    }
    let mut q = begin;
    while q < bron.len() && !matches!(bron[q], b'\'' | b'"' | b'`') {
        q += 1;
    }
    if bron.get(q) != Some(&quote) {
        return None;
    }
    Some((begin, q, q + 1))
}

/* `<ontvanger><methode>\s*(\s*<naam(.naam)*>\s*+\s*<quote>/<rest><quote>` vanaf i:
methode, de uitdrukking voor de +, de rest en de positie na de sluitende quote. */
fn samengestelde_aanroep<'a>(
    bron: &'a [u8],
    i: usize,
    ontvangers: &[&[u8]],
) -> Option<(&'static str, &'a [u8], &'a [u8], usize)> {
    let ontvanger = ontvangers.iter().find(|x| bron[i..].starts_with(x))?;
    if i > 0 && woord(bron[i - 1]) {
        return None;
    }
    let mut p = i + ontvanger.len();
    let (methode_bytes, methode) = METHODEN.iter().find(|(m, _)| bron[p..].starts_with(m))?;
    p = sla_wit_over(bron, p + methode_bytes.len());
    if bron.get(p) != Some(&b'(') {
        return None;
    }
    p = sla_wit_over(bron, p + 1);
    let begin = p;
    let mut eind = ident_vanaf(bron, p)?;
    while bron.get(eind) == Some(&b'.') {
        eind = ident_vanaf(bron, eind + 1)?;
    }
    p = sla_wit_over(bron, eind);
    if bron.get(p) != Some(&b'+') {
        return None;
    }
    p = sla_wit_over(bron, p + 1);
    let (rb, re, na) = quote_pad(bron, p, b"/")?;
    Some((methode, &bron[begin..eind], &bron[rb..re], na))
}

/* De eerste `const <naam> = '/api/...'` in het bestand, met een woordgrens voor const. */
fn const_voorvoegsel(bron: &[u8], naam: &[u8]) -> Option<String> {
    let mut i = 0usize;
    while i < bron.len() {
        if bron[i..].starts_with(b"const") && (i == 0 || !ident_deel(bron[i - 1])) {
            let p = i + 5;
            let q = sla_wit_over(bron, p);
            if q > p {
                if let Some(eind) = ident_vanaf(bron, q) {
                    if &bron[q..eind] == naam {
                        let r = sla_wit_over(bron, eind);
                        if bron.get(r) == Some(&b'=') {
                            let s = sla_wit_over(bron, r + 1);
                            if let Some((b, e, _)) = quote_pad(bron, s, b"/api/") {
                                return Some(String::from_utf8_lossy(&bron[b..e]).into_owned());
                            }
                        }
                    }
                }
            }
        }
        i += 1;
    }
    None
}

/* Elke `<eigenschap>: '/api/...'` in het bestand, ontdubbeld en gesorteerd. */
fn eigenschap_voorvoegsels(bron: &[u8], eigenschap: &[u8]) -> Vec<String> {
    let mut uit: Vec<String> = Vec::new();
    let mut i = 0usize;
    while i < bron.len() {
        if bron[i..].starts_with(eigenschap) && (i == 0 || !ident_deel(bron[i - 1])) {
            let p = sla_wit_over(bron, i + eigenschap.len());
            if bron.get(p) == Some(&b':') {
                let s = sla_wit_over(bron, p + 1);
                if let Some((b, e, _)) = quote_pad(bron, s, b"/api/") {
                    let v = String::from_utf8_lossy(&bron[b..e]).into_owned();
                    if !uit.contains(&v) {
                        uit.push(v);
                    }
                }
            }
        }
        i += 1;
    }
    uit.sort();
    uit
}

fn samengestelde_endpoints(root: &Path, bronnen: &BTreeMap<PathBuf, Vec<u8>>, uniek: &mut BTreeMap<String, Json>) {
    let mut volgorde: Vec<&PathBuf> = bronnen.keys().collect();
    volgorde.sort_by_key(|p| p.to_string_lossy().into_owned());
    let ontvangers: [&[u8]; 2] = [b"app.", b"router."];
    for bestand in volgorde {
        let bron = &bronnen[bestand];
        let rel = relatief(root, bestand);
        let mut i = 0usize;
        while i < bron.len() {
            let Some((methode, uitdrukking, rest, einde)) = samengestelde_aanroep(bron, i, &ontvangers) else {
                i += 1;
                continue;
            };
            i = einde;
            if wordt_aangevuld(bron, einde) {
                continue;
            }
            let voorvoegsels = match uitdrukking.iter().rposition(|c| *c == b'.') {
                None => const_voorvoegsel(bron, uitdrukking).into_iter().collect::<Vec<String>>(),
                Some(punt) => eigenschap_voorvoegsels(bron, &uitdrukking[punt + 1..]),
            };
            for voorvoegsel in voorvoegsels {
                let kaal = voorvoegsel.trim_end_matches('/').to_string();
                let samen = format!("{}{}", kaal, String::from_utf8_lossy(rest));
                let mut route = samen.trim_end_matches('/').to_string();
                if route.is_empty() {
                    route = kaal.clone();
                }
                let sleutel = format!("{} {}", methode, route);
                if uniek.contains_key(&sleutel) {
                    continue;
                }
                let p = punt(sleutel.clone(), methode, route, &rel, toegang(bron, einde));
                uniek.insert(sleutel, p);
            }
        }
    }
}

fn scan_endpoints(root: &Path) -> Result<Vec<Json>, String> {
    let mut paden = Vec::new();
    bestanden(&root.join("server"), ".js", &mut paden)?;
    paden.sort();
    let mut uniek = BTreeMap::new();
    let mut bronnen = BTreeMap::new();
    for pad in paden {
        let bron = lees_begrensd(&pad)?;
        endpoints_in(&bron, &relatief(root, &pad), &mut uniek);
        bronnen.insert(pad, bron);
    }
    gemounte_endpoints(root, &bronnen, &mut uniek);
    samengestelde_endpoints(root, &bronnen, &mut uniek);
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
        fs::remove_dir_all(&root).unwrap();
        fs::create_dir_all(root.join("server/stichting")).unwrap();
        fs::create_dir_all(root.join("public/apps")).unwrap();
        fs::write(root.join("server/mount.js"), "const rtf = require('./stichting');\napp.use('/api/stichting', rtf.router);\napp.post('/api/spel/' + naam, h);").unwrap();
        fs::write(root.join("server/stichting.js"), "require('./stichting/gezin')(ctx);").unwrap();
        fs::write(root.join("server/stichting/gezin.js"), "router.post('/gezin/maak', auth, h);").unwrap();
        fs::write(root.join("server/los.js"), "router.post('/los', h);").unwrap();
        let antwoord = scan(&root).unwrap();
        let sleutels: Vec<String> = match antwoord.get("endpoints") {
            Some(Json::Arr(a)) => a.iter().filter_map(|e| e.str_at("sleutel").map(String::from)).collect(),
            _ => panic!(),
        };
        assert_eq!(sleutels, vec!["POST /api/stichting/gezin/maak".to_string()]);
        fs::remove_dir_all(&root).unwrap();
        fs::create_dir_all(root.join("server/routes")).unwrap();
        fs::create_dir_all(root.join("public/apps")).unwrap();
        fs::write(
            root.join("public/apps/reis.html"),
            "<title>Reis &amp; Rit · RTG</title>",
        )
        .unwrap();
        fs::write(root.join("server/routes/reis.js"), "router.get('/api/reis/lijst', auth, h);\napp.post( `/api/reis/boek`, officeAuth, h);\nconst x=\"app.get('/api/nep')\";").unwrap();
        let antwoord = scan(&root).unwrap();
        let endpoints = match antwoord.get("endpoints") {
            Some(Json::Arr(a)) => a,
            _ => panic!(),
        };
        assert!(endpoints
            .iter()
            .any(|e| e.str_at("route") == Some("/api/reis/boek")
                && e.str_at("toegang") == Some("office")));
        fs::remove_dir_all(root).unwrap();
    }
}
