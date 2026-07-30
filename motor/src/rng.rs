/* Twee soorten willekeur, streng gescheiden:

   - `id()`: boeking-id's. Die hoeven alleen UNIEK te zijn, niet onvoorspelbaar
     (net als crypto.randomBytes(5).hex in de Node-kern). Klok + teller met
     xorshift eroverheen is daarvoor genoeg.
   - `code()`: kassacodes en tikcodes. Die AUTORISEREN GELD -- wie de code heeft
     mag van de wallet van het lid afschrijven tot het maximum van de code.
     Zulke codes moeten onvoorspelbaar zijn, dus komen ze uit de OS-CSPRNG,
     precies zoals de JS-kant het doet (crypto.randomBytes(3) in
     server/kern/pay/kassa.js en verzoeken.js). Een klok-gezaaide xorshift is
     hier NIET goed genoeg: wie ongeveer weet wanneer een code is aangemaakt kan
     de kandidaten uitrekenen.

   `code()` geeft daarom een io::Result terug: als /dev/urandom niet te lezen is
   vallen we NIET stil terug op zwakke willekeur, maar geven we een fout terug
   die de HTTP-laag als 500 doorgeeft. Liever geen code dan een raadbare code. */
use crate::aead;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TELLER: AtomicU64 = AtomicU64::new(0);

fn nu_nanos() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0)
}

fn xorshift(mut x: u64) -> u64 {
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    x
}

/// Een id met voorvoegsel, bijv. `PB1A2B3C4D`.
pub fn id(prefix: &str) -> String {
    let n = TELLER.fetch_add(1, Ordering::Relaxed);
    let mut x = xorshift(nu_nanos() ^ (n.wrapping_mul(0x9E37_79B9_7F4A_7C15)));
    x = xorshift(x);
    format!("{}{:010X}", prefix, x & 0xFF_FFFF_FFFF)
}

/* Korte hex-code (kassacode/tikcode), standaard 6 tekens hoofdletters, uit de
   OS-CSPRNG. Elke hex-teken komt uit de lage nibble van een verse random byte;
   16 deelt 256, dus dat is een uniforme keuze zonder modulo-scheefheid. */
pub fn code(len: usize) -> std::io::Result<String> {
    let mut ruw = vec![0u8; len];
    aead::os_random(&mut ruw)?;
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    Ok(ruw.iter().map(|b| HEX[(b & 0xF) as usize] as char).collect())
}

pub fn nu_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    /* Wat deze test WEL vastlegt: vorm (lengte, alleen hex-hoofdletters),
       uniformiteit over de 16 hex-tekens, en geen herhaling over veel trekkingen.
       Wat hij NIET kan aantonen is de cryptografische kwaliteit zelf -- die komt
       uit de bron (aead::os_random -> /dev/urandom) en is met een unittest niet
       te bewijzen. Het type is daarom de echte bewaker: `code()` geeft een
       io::Result, dus er is geen pad meer dat stil op een klok-gezaaide xorshift
       terugvalt zonder dat de compiler erover klaagt. */
    #[test]
    fn code_vorm_en_uniformiteit() {
        const HEX: &str = "0123456789ABCDEF";
        let mut tellingen = [0usize; 16];
        let mut totaal = 0usize;
        for _ in 0..2000 {
            let c = code(6).unwrap();
            assert_eq!(c.chars().count(), 6, "lengte moet kloppen");
            for ch in c.chars() {
                let idx = HEX.find(ch).expect("alleen hex-hoofdletters");
                tellingen[idx] += 1;
                totaal += 1;
            }
        }
        // 12000 nibbles over 16 emmers -> 750 verwacht; een ruime band die een
        // kapotte of vastgelopen bron (alles hetzelfde teken) hard afkeurt.
        let verwacht = totaal / 16;
        for (i, &n) in tellingen.iter().enumerate() {
            assert!(n > verwacht / 2 && n < verwacht * 2,
                "hex-teken {} komt {} keer voor, verwacht rond {}", &HEX[i..i + 1], n, verwacht);
        }
    }

    /* Geen herhaling: op lengte 16 (64 bits) is een botsing over 5000 trekkingen
       astronomisch onwaarschijnlijk, dus elke dubbele wijst op een kapotte bron
       (bijvoorbeeld een teller die niet opschuift). */
    #[test]
    fn codes_herhalen_niet() {
        let mut gezien = HashSet::new();
        for _ in 0..5000 {
            assert!(gezien.insert(code(16).unwrap()), "code mag niet herhalen");
        }
    }

    /* Twee codes die in dezelfde klok-tik worden aangemaakt moeten verschillen.
       Precies dit ging mis toen de code uit nu_nanos() werd gezaaid. */
    #[test]
    fn codes_in_dezelfde_tik_verschillen() {
        let a = code(6).unwrap();
        let b = code(6).unwrap();
        let c = code(6).unwrap();
        assert!(a != b || b != c, "codes uit dezelfde tik mogen niet gelijk zijn");
    }
}
