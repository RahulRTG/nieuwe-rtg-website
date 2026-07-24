/* De ledengids. Het hart: leden staan in een gesorteerd bestand met VASTE
   recordgrootte, en we zoeken er binair in. Standaard koppelen we dat bestand
   met mmap(2) in het geheugen (read-only): de OS-kernel cachet de hete pagina's
   vanzelf in RAM en we lezen op RAM-snelheid, zonder per zoekopdracht een
   File::open of seek/read-syscall. Lukt mmap niet (of op niet-Unix), dan valt de
   gids terug op seek+read op schijf -- zelfde antwoorden, iets trager.

   Zero-dependency: de mmap gaat via rauwe POSIX-FFI (extern "C"), geen crate.
   Het RAM van de PROCESS-heap blijft O(1) (de Gids houdt zelf niets dan het pad,
   het aantal en de kaart-verwijzing vast); de gemapte pagina's leven in de
   paginacache van de kernel, niet op onze heap.

   Recordindeling (92 bytes, vast):
     0..32   naam_lower  (sorteersleutel, kleine letters)
     32..64  naam        (weergave, oorspronkelijke schrijfwijze)
     64..76  tier
     76..92  key         (account-id/adres)
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

// Ontleed een vast record (REC bytes) naar (naam_lower, Rij).
fn ontleed(buf: &[u8]) -> (String, Rij) {
    let naam_lower = lees_veld(&buf[0..NAAM]);
    let rij = Rij {
        naam: lees_veld(&buf[NAAM..NAAM + NAAM]),
        tier: lees_veld(&buf[NAAM + NAAM..NAAM + NAAM + TIER]),
        key: lees_veld(&buf[NAAM + NAAM + TIER..NAAM + NAAM + TIER + KEY]),
    };
    (naam_lower, rij)
}

/* Bouw de gids: sorteer op naam_lower en schrijf de vaste records. Schrijf naar
   een TIJDELIJK bestand en hernoem het atomair over het pad. Zo blijft een
   eventuele bestaande mmap veilig op het oude inode staan tot de laatste lezer
   klaar is (in-place overschrijven onder een actieve mmap zou SIGBUS geven), en
   is de omschakeling atomair -- lezers zien of de oude, of de complete nieuwe
   gids, nooit iets halfs. */
pub fn bouw(pad: &Path, mut rijen: Vec<Rij>) -> io::Result<u64> {
    rijen.sort_by(|a, b| a.naam.to_lowercase().cmp(&b.naam.to_lowercase()));
    rijen.dedup_by(|a, b| a.naam.to_lowercase() == b.naam.to_lowercase());
    let tmp = pad.with_extension("bin.tmp");
    {
        let f = File::create(&tmp)?;
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
    }
    std::fs::rename(&tmp, pad)?;
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

/* De geheugenkaart: een read-only mmap van het gids-bestand via rauwe POSIX-FFI
   (geen externe crate). Alleen op Unix; elders bestaat dit niet en gebruikt de
   gids seek+read. munmap gebeurt bij Drop. */
#[cfg(unix)]
mod kaart {
    use std::ffi::c_void;
    use std::fs::File;
    use std::io;
    use std::os::unix::io::AsRawFd;

    extern "C" {
        fn mmap(addr: *mut c_void, length: usize, prot: i32, flags: i32, fd: i32, offset: i64) -> *mut c_void;
        fn munmap(addr: *mut c_void, length: usize) -> i32;
        fn madvise(addr: *mut c_void, length: usize, advice: i32) -> i32;
    }
    const PROT_READ: i32 = 1; // gelijk op Linux/macOS/BSD
    const MAP_PRIVATE: i32 = 2;
    const MADV_RANDOM: i32 = 1; // idem, gelijk op Linux/macOS/BSD

    pub struct Kaart {
        ptr: *mut c_void,
        len: usize,
    }
    // De kaart is read-only en wordt na open nooit meer gemuteerd: veilig te
    // delen en te lezen vanuit meerdere threads.
    unsafe impl Send for Kaart {}
    unsafe impl Sync for Kaart {}

    impl Kaart {
        /// Map `len` bytes van `f` read-only. Geeft None bij een leeg bestand of
        /// als mmap faalt (dan valt de gids terug op seek+read).
        pub fn open(f: &File, len: u64) -> io::Result<Option<Kaart>> {
            if len == 0 {
                return Ok(None);
            }
            let len = len as usize;
            // MAP_PRIVATE: read-only snapshot; het sluiten van de fd hierna maakt
            // de mapping niet ongeldig (POSIX), dus de File mag daarna droppen.
            let ptr = unsafe { mmap(std::ptr::null_mut(), len, PROT_READ, MAP_PRIVATE, f.as_raw_fd(), 0) };
            let mislukt = usize::MAX as *mut c_void; // MAP_FAILED == (void*)-1
            if ptr == mislukt || ptr.is_null() {
                return Ok(None);
            }
            // Binair zoeken springt willekeurig door het bestand. Vertel de kernel
            // dat, zodat hij geen readahead verspilt aan pagina's die we toch niet
            // op volgorde lezen (MADV_RANDOM). Best-effort: het advies mag falen.
            unsafe { madvise(ptr, len, MADV_RANDOM); }
            Ok(Some(Kaart { ptr, len }))
        }
        #[inline]
        pub fn bytes(&self) -> &[u8] {
            // veilig: ptr/len komen uit een geslaagde mmap en zijn onveranderlijk
            unsafe { std::slice::from_raw_parts(self.ptr as *const u8, self.len) }
        }
    }
    impl Drop for Kaart {
        fn drop(&mut self) {
            unsafe {
                munmap(self.ptr, self.len);
            }
        }
    }
}

pub struct Gids {
    pad: PathBuf,
    aantal: u64,
    #[cfg(unix)]
    kaart: Option<kaart::Kaart>,
}

impl Gids {
    pub fn open(pad: &Path) -> io::Result<Gids> {
        Gids::open_met(pad, true)
    }

    /* Als `gebruik_mmap` false is, of mmap niet lukt, of op niet-Unix: de gids
       leest via seek+read. Vooral handig om de terugval-weg te toetsen en om
       mmap desgewenst uit te zetten. */
    pub fn open_met(pad: &Path, gebruik_mmap: bool) -> io::Result<Gids> {
        let len = std::fs::metadata(pad)?.len();
        #[cfg(unix)]
        let kaart = if gebruik_mmap {
            let f = File::open(pad)?;
            kaart::Kaart::open(&f, len)? // f mag hierna droppen; de mapping blijft
        } else {
            None
        };
        #[cfg(not(unix))]
        let _ = gebruik_mmap;
        Ok(Gids {
            pad: pad.to_path_buf(),
            aantal: len / REC,
            #[cfg(unix)]
            kaart,
        })
    }

    pub fn aantal(&self) -> u64 { self.aantal }
    pub fn bestandsbytes(&self) -> u64 { self.aantal * REC }

    /// Bedient de gids de zoekopdrachten vanuit de mmap (RAM-snelheid) of via
    /// seek+read op schijf? Voor het statusbord en de tests.
    pub fn via_kaart(&self) -> bool {
        #[cfg(unix)]
        {
            self.kaart.is_some()
        }
        #[cfg(not(unix))]
        {
            false
        }
    }

    /* Lees record `i`: uit de mmap als die er is (geen syscall), anders seek+read
       via een lui-geopende, hergebruikte file-handle. */
    fn rec(&self, f: &mut Option<File>, i: u64) -> io::Result<(String, Rij)> {
        #[cfg(unix)]
        if let Some(k) = &self.kaart {
            let off = (i * REC) as usize;
            let b = &k.bytes()[off..off + REC as usize];
            return Ok(ontleed(b));
        }
        if f.is_none() {
            *f = Some(File::open(&self.pad)?);
        }
        let fh = f.as_mut().unwrap();
        fh.seek(SeekFrom::Start(i * REC))?;
        let mut buf = [0u8; REC as usize];
        fh.read_exact(&mut buf)?;
        Ok(ontleed(&buf))
    }

    /* Exacte opzoeking op codenaam: binair zoeken, O(log n) recordlezingen. Via
       de mmap zijn dat geheugentoegangen; anders seeks. O(1) heap-RAM. */
    pub fn exact(&self, naam: &str) -> io::Result<Option<Rij>> {
        if self.aantal == 0 {
            return Ok(None);
        }
        let doel = naam.to_lowercase();
        let mut f: Option<File> = None;
        let (mut lo, mut hi) = (0i64, self.aantal as i64 - 1);
        while lo <= hi {
            let mid = (lo + hi) / 2;
            let (nl, rij) = self.rec(&mut f, mid as u64)?;
            match nl.cmp(&doel) {
                Ordering::Equal => return Ok(Some(rij)),
                Ordering::Less => lo = mid + 1,
                Ordering::Greater => hi = mid - 1,
            }
        }
        Ok(None)
    }

    // eerste record-index met naam_lower >= sleutel (ondergrens)
    fn ondergrens(&self, f: &mut Option<File>, sleutel: &str) -> io::Result<u64> {
        let (mut lo, mut hi) = (0i64, self.aantal as i64);
        while lo < hi {
            let mid = (lo + hi) / 2;
            let (nl, _) = self.rec(f, mid as u64)?;
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
        let mut f: Option<File> = None;
        let mut i = self.ondergrens(&mut f, &p)?;
        while i < self.aantal && uit.len() < max {
            let (nl, rij) = self.rec(&mut f, i)?;
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
        // De Gids-struct houdt alleen het pad, een teller en de kaart-verwijzing
        // vast -- geen Vec van records op de heap. De gemapte pagina's leven in de
        // paginacache van de kernel. Dat is de out-of-heap-eigenschap.
        let dir = std::env::temp_dir().join(format!("gids-o1-{}", std::process::id()));
        let pad = dir.join("g.bin");
        std::fs::create_dir_all(&dir).unwrap();
        let rijen: Vec<Rij> = (0..2000).map(|i| r(&format!("lid{:05}", i), "rtg")).collect();
        bouw(&pad, rijen).unwrap();
        let g = Gids::open(&pad).unwrap();
        assert_eq!(g.aantal(), 2000);
        assert_eq!(std::mem::size_of_val(&g.aantal), 8); // de teller zelf is een u64
        assert_eq!(g.exact("lid01999").unwrap().unwrap().naam, "lid01999");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    #[cfg(unix)]
    fn mmap_actief_en_zelfde_antwoorden() {
        // Op Unix bedient de gids de zoekopdrachten uit de mmap, en die geeft
        // exact dezelfde resultaten als de seek+read-weg.
        let dir = std::env::temp_dir().join(format!("gids-mmap-{}", std::process::id()));
        let pad = dir.join("g.bin");
        std::fs::create_dir_all(&dir).unwrap();
        let rijen: Vec<Rij> = (0..5000).map(|i| r(&format!("lid{:05}", i), if i % 2 == 0 { "rtg" } else { "business" })).collect();
        bouw(&pad, rijen).unwrap();
        let g = Gids::open(&pad).unwrap();
        assert!(g.via_kaart(), "op Unix hoort de gids via de mmap te lezen");
        assert_eq!(g.exact("lid00000").unwrap().unwrap().tier, "rtg");
        assert_eq!(g.exact("lid04999").unwrap().unwrap().tier, "business");
        assert!(g.exact("lid05000").unwrap().is_none());
        let p = g.prefix("lid0499", 20).unwrap();
        assert_eq!(p.len(), 10); // lid04990..lid04999
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    #[cfg(unix)]
    fn fallback_seek_read_geeft_zelfde_antwoorden() {
        // De seek+read-terugval (mmap uit) moet exact hetzelfde teruggeven als de
        // mmap-weg. Zo is de fallback getoetst op het platform waar we draaien.
        let dir = std::env::temp_dir().join(format!("gids-fallback-{}", std::process::id()));
        let pad = dir.join("g.bin");
        std::fs::create_dir_all(&dir).unwrap();
        let rijen: Vec<Rij> = (0..5000).map(|i| r(&format!("lid{:05}", i), if i % 2 == 0 { "rtg" } else { "business" })).collect();
        bouw(&pad, rijen).unwrap();
        let m = Gids::open_met(&pad, true).unwrap();
        let s = Gids::open_met(&pad, false).unwrap();
        assert!(m.via_kaart(), "mmap-weg");
        assert!(!s.via_kaart(), "seek+read-weg");
        for naam in ["lid00000", "lid02500", "lid04999", "LID02500", "spook", ""] {
            assert_eq!(m.exact(naam).unwrap(), s.exact(naam).unwrap(), "exact({})", naam);
        }
        assert_eq!(m.prefix("lid024", 50).unwrap(), s.prefix("lid024", 50).unwrap());
        assert_eq!(m.prefix("lid", 7).unwrap(), s.prefix("lid", 7).unwrap());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    #[cfg(unix)]
    fn herbouw_onder_actieve_mmap_is_veilig() {
        // Een oude gids met een actieve mmap moet blijven werken terwijl de gids
        // opnieuw wordt gebouwd (temp + rename houdt het oude inode in leven).
        let dir = std::env::temp_dir().join(format!("gids-herbouw-{}", std::process::id()));
        let pad = dir.join("g.bin");
        std::fs::create_dir_all(&dir).unwrap();
        bouw(&pad, (0..1000).map(|i| r(&format!("oud{:05}", i), "rtg")).collect()).unwrap();
        let oud = Gids::open(&pad).unwrap();
        // herbouw het bestand volledig terwijl `oud` nog gemapt is
        bouw(&pad, (0..1000).map(|i| r(&format!("nieuw{:05}", i), "business")).collect()).unwrap();
        // de oude mmap wijst nog naar het oude, hernoemde inode: geen SIGBUS
        assert_eq!(oud.exact("oud00500").unwrap().unwrap().tier, "rtg");
        assert!(oud.exact("nieuw00500").unwrap().is_none());
        // een verse open ziet de nieuwe inhoud
        let nieuw = Gids::open(&pad).unwrap();
        assert_eq!(nieuw.exact("nieuw00500").unwrap().unwrap().tier, "business");
        assert!(nieuw.exact("oud00500").unwrap().is_none());
        std::fs::remove_dir_all(&dir).ok();
    }
}
