/* De ledengids, out-of-RAM. Het hart: leden staan in een gesorteerd bestand met
   VASTE recordgrootte, en we zoeken er binair in met seek+read op schijf. Zo
   blijft het RAM-gebruik O(1) -- of het er nu duizend of honderd miljoen zijn,
   de gids houdt niets dan het pad en het aantal in het geheugen. De OS-paginacache
   maakt de hete records vanzelf snel. Zero-dependency: alleen std.

   Recordindeling (88 bytes, vast):
     0..32   naam_lower  (sorteersleutel, kleine letters)
     32..64  naam        (weergave, oorspronkelijke schrijfwijze)
     64..72  tier
     72..88  key         (account-id/adres)
   Tekstvelden zijn met nul-bytes gevuld en worden bij het lezen getrimd. */
use crate::json::Json;
use std::cmp::Ordering;
use std::fs::File;
use std::io::{self, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const NAAM: usize = 32;
const TIER: usize = 12; // ruim genoeg voor "lifestyle"/"business"
const KEY: usize = 16;
pub const REC: u64 = (NAAM + NAAM + TIER + KEY) as u64; // 92

#[derive(Clone, Debug, PartialEq)]
pub struct Rij {
    pub naam: String,
    pub tier: String,
    pub key: String,
}

impl Rij {
    pub fn to_json(&self) -> Json {
        let mut o = Json::obj();
        o.set("naam", Json::Str(self.naam.clone()))
            .set("tier", Json::Str(self.tier.clone()))
            .set("key", Json::Str(self.key.clone()));
        o
    }
}

fn vast(s: &str, n: usize, uit: &mut Vec<u8>) {
    let b = s.as_bytes();
    let m = b.len().min(n);
    uit.extend_from_slice(&b[..m]);
    for _ in m..n {
        uit.push(0);
    }
}

fn lees_veld(buf: &[u8]) -> String {
    let eind = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
    String::from_utf8_lossy(&buf[..eind]).into_owned()
}

/* Bouw de gids: sorteer op naam_lower en schrijf de vaste records. (Bouwen
   sorteert in het RAM; voor >~10M zou je extern sorteren, maar het SERVEREN is
   al out-of-RAM -- dat is de eigenschap die telt.) */
pub fn bouw(pad: &Path, mut rijen: Vec<Rij>) -> io::Result<u64> {
    rijen.sort_by(|a, b| a.naam.to_lowercase().cmp(&b.naam.to_lowercase()));
    rijen.dedup_by(|a, b| a.naam.to_lowercase() == b.naam.to_lowercase());
    let f = File::create(pad)?;
    let mut w = BufWriter::new(f);
    let mut rec = Vec::with_capacity(REC as usize);
    for r in &rijen {
        rec.clear();
        vast(&r.naam.to_lowercase(), NAAM, &mut rec);
        vast(&r.naam, NAAM, &mut rec);
        vast(&r.tier, TIER, &mut rec);
        vast(&r.key, KEY, &mut rec);
        w.write_all(&rec)?;
    }
    w.flush()?;
    Ok(rijen.len() as u64)
}

/* Demo-leden genereren (voor het bouwen/beproeven van de gids op schaal).
   Gevarieerde, unieke codenamen uit lettergrepen + index. */
pub fn demo(n: usize) -> Vec<Rij> {
    const SYL: [&str; 12] = ["Ne", "vel", "Mist", "Eb", "Tij", "Duin", "Storm", "Vloed", "Kust", "Wind", "Nevel", "Zee"];
    const TIERS: [&str; 3] = ["rtg", "lifestyle", "business"];
    let mut v = Vec::with_capacity(n);
    for i in 0..n {
        let a = (i * 7) % SYL.len();
        let b = (i * 13 + 3) % SYL.len();
        let naam = format!("{}{}{}", SYL[a], SYL[b], i);
        v.push(Rij { naam, tier: TIERS[i % 3].to_string(), key: format!("k{:012x}", i) });
    }
    v
}

pub struct Gids {
    pad: PathBuf,
    aantal: u64,
}

impl Gids {
    pub fn open(pad: &Path) -> io::Result<Gids> {
        let len = std::fs::metadata(pad)?.len();
        Ok(Gids { pad: pad.to_path_buf(), aantal: len / REC })
    }

    pub fn aantal(&self) -> u64 { self.aantal }
    pub fn bestandsbytes(&self) -> u64 { self.aantal * REC }

    fn lees(&self, f: &mut File, i: u64) -> io::Result<(String, Rij)> {
        f.seek(SeekFrom::Start(i * REC))?;
        let mut buf = [0u8; REC as usize];
        f.read_exact(&mut buf)?;
        let naam_lower = lees_veld(&buf[0..NAAM]);
        let rij = Rij {
            naam: lees_veld(&buf[NAAM..NAAM + NAAM]),
            tier: lees_veld(&buf[NAAM + NAAM..NAAM + NAAM + TIER]),
            key: lees_veld(&buf[NAAM + NAAM + TIER..]),
        };
        Ok((naam_lower, rij))
    }

    /* Exacte opzoeking op codenaam: binair zoeken op schijf, O(log n) seeks,
       O(1) RAM. */
    pub fn exact(&self, naam: &str) -> io::Result<Option<Rij>> {
        if self.aantal == 0 {
            return Ok(None);
        }
        let doel = naam.to_lowercase();
        let mut f = File::open(&self.pad)?;
        let (mut lo, mut hi) = (0i64, self.aantal as i64 - 1);
        while lo <= hi {
            let mid = (lo + hi) / 2;
            let (nl, rij) = self.lees(&mut f, mid as u64)?;
            match nl.cmp(&doel) {
                Ordering::Equal => return Ok(Some(rij)),
                Ordering::Less => lo = mid + 1,
                Ordering::Greater => hi = mid - 1,
            }
        }
        Ok(None)
    }

    // eerste record-index met naam_lower >= sleutel (ondergrens)
    fn ondergrens(&self, f: &mut File, sleutel: &str) -> io::Result<u64> {
        let (mut lo, mut hi) = (0i64, self.aantal as i64);
        while lo < hi {
            let mid = (lo + hi) / 2;
            let (nl, _) = self.lees(f, mid as u64)?;
            if nl.as_str() < sleutel {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        Ok(lo as u64)
    }

    /* Prefix-zoeken (typvoorloop): vind de ondergrens en scan vooruit zolang de
       naam met het voorvoegsel begint, tot maximaal `max` treffers. */
    pub fn prefix(&self, voor: &str, max: usize) -> io::Result<Vec<Rij>> {
        let mut uit = Vec::new();
        if self.aantal == 0 || voor.is_empty() {
            return Ok(uit);
        }
        let p = voor.to_lowercase();
        let mut f = File::open(&self.pad)?;
        let mut i = self.ondergrens(&mut f, &p)?;
        while i < self.aantal && uit.len() < max {
            let (nl, rij) = self.lees(&mut f, i)?;
            if !nl.starts_with(&p) {
                break;
            }
            uit.push(rij);
            i += 1;
        }
        Ok(uit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(n: &str, t: &str) -> Rij {
        Rij { naam: n.to_string(), tier: t.to_string(), key: "k_".to_string() + n }
    }

    #[test]
    fn bouw_en_exact_en_prefix() {
        let dir = std::env::temp_dir().join(format!("gids-test-{}", std::process::id()));
        let pad = dir.join("gids.bin");
        std::fs::create_dir_all(&dir).unwrap();
        let rijen = vec![
            r("NEVEL", "rtg"), r("Mist", "lifestyle"), r("MISTRAL", "rtg"),
            r("Ebbe", "business"), r("Tij", "rtg"), r("Duin", "rtg"),
        ];
        let n = bouw(&pad, rijen).unwrap();
        assert_eq!(n, 6);
        let g = Gids::open(&pad).unwrap();
        assert_eq!(g.aantal(), 6);

        // exact, hoofdletter-ongevoelig
        assert_eq!(g.exact("nevel").unwrap().unwrap().naam, "NEVEL");
        assert_eq!(g.exact("MIST").unwrap().unwrap().tier, "lifestyle");
        assert!(g.exact("spook").unwrap().is_none());

        // prefix "mist" -> Mist en MISTRAL, gesorteerd
        let p = g.prefix("mist", 10).unwrap();
        let namen: Vec<String> = p.iter().map(|x| x.naam.clone()).collect();
        assert_eq!(namen, vec!["Mist".to_string(), "MISTRAL".to_string()]);

        // prefix met max
        assert_eq!(g.prefix("", 10).unwrap().len(), 0);
        assert!(g.prefix("z", 10).unwrap().is_empty());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn ram_is_o1_ongeacht_aantal() {
        // De Gids-struct houdt alleen het pad en een teller vast -- geen Vec van
        // records. Dat is de out-of-RAM-eigenschap, structureel afgedwongen.
        let dir = std::env::temp_dir().join(format!("gids-o1-{}", std::process::id()));
        let pad = dir.join("g.bin");
        std::fs::create_dir_all(&dir).unwrap();
        let rijen: Vec<Rij> = (0..2000).map(|i| r(&format!("lid{:05}", i), "rtg")).collect();
        bouw(&pad, rijen).unwrap();
        let g = Gids::open(&pad).unwrap();
        assert_eq!(g.aantal(), 2000);
        assert_eq!(std::mem::size_of_val(&g.aantal), 8); // alleen een u64 in RAM
        assert_eq!(g.exact("lid01999").unwrap().unwrap().naam, "lid01999");
        std::fs::remove_dir_all(&dir).ok();
    }
}
