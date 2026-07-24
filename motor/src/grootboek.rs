/* Het grootboek: dubbel boekhouden op de cent, exact zoals server/kern/pay.
   Bedragen zijn i64 CENTEN — geen float, dus geen afrondingsdrift. Elke
   beweging is VAN een rekening NAAR een rekening; geld ontstaat nooit uit het
   niets (opladen komt van extern:oplaad, uitbetalen gaat naar
   extern:uitbetaald). De som van alle saldi is altijd exact nul, en niemand
   behalve de extern-rekeningen mag rood staan. */
use crate::json::Json;
use crate::rng;
use std::collections::HashMap;
use std::collections::VecDeque;

pub const MIN_CENTEN: i64 = 1;
pub const MAX_CENTEN: i64 = 500_000;
pub const WEERGAVE_CAP: usize = 50_000;

#[derive(Clone)]
pub struct Boeking {
    pub id: String,
    pub van: String,
    pub naar: String,
    pub centen: i64,
    pub soort: String,
    pub oms: String,
    pub ref_: Option<String>,
    pub at: u64,
}

impl Boeking {
    pub fn to_json(&self) -> Json {
        let mut o = Json::obj();
        o.set("id", Json::Str(self.id.clone()))
            .set("van", Json::Str(self.van.clone()))
            .set("naar", Json::Str(self.naar.clone()))
            .set("centen", Json::Num(self.centen as f64))
            .set("soort", Json::Str(self.soort.clone()))
            .set("oms", Json::Str(self.oms.clone()))
            .set("ref", self.ref_.clone().map(Json::Str).unwrap_or(Json::Null))
            .set("at", Json::Num(self.at as f64));
        o
    }
}

pub struct BoekArgs<'a> {
    pub van: &'a str,
    pub naar: &'a str,
    pub centen: i64,
    pub soort: &'a str,
    pub oms: &'a str,
    pub ref_: Option<String>,
}

pub struct Ledger {
    pub saldi: HashMap<String, i64>,
    pub boekingen: VecDeque<Boeking>, // front = nieuwste (unshift-semantiek)
}

impl Ledger {
    pub fn new() -> Ledger {
        Ledger { saldi: HashMap::new(), boekingen: VecDeque::new() }
    }

    pub fn saldo_van(&self, rek: &str) -> i64 {
        *self.saldi.get(rek).unwrap_or(&0)
    }

    /* De kern: een boeking. Weigert onzin (bedrag buiten bereik, van==naar) en
       laat niemand behalve de extern-rekeningen onder nul zakken. */
    pub fn boek(&mut self, a: BoekArgs) -> Result<Boeking, (u16, String)> {
        let c = a.centen;
        if c < MIN_CENTEN || c > MAX_CENTEN {
            return Err((400, "Dat bedrag kan niet.".into()));
        }
        if a.van.is_empty() || a.naar.is_empty() || a.van == a.naar {
            return Err((400, "Van en naar kloppen niet.".into()));
        }
        if !a.van.starts_with("extern:") && self.saldo_van(a.van) < c {
            return Err((402, "Onvoldoende saldo.".into()));
        }
        *self.saldi.entry(a.van.to_string()).or_insert(0) -= c;
        *self.saldi.entry(a.naar.to_string()).or_insert(0) += c;
        let rij = Boeking {
            id: rng::id("PB"),
            van: a.van.to_string(),
            naar: a.naar.to_string(),
            centen: c,
            soort: a.soort.to_string(),
            oms: schoon(a.oms, 120),
            ref_: a.ref_,
            at: rng::nu_ms(),
        };
        self.boekingen.push_front(rij.clone());
        if self.boekingen.len() > WEERGAVE_CAP {
            self.boekingen.pop_back();
        }
        Ok(rij)
    }

    /* Rauw toepassen (schaduw-modus): herspeelt een boeking van de autoritaire
       JS-engine ZONDER saldo-guard — het herspeelt een al-genomen beslissing,
       het neemt hem niet opnieuw. Zo blijft de mirror in lockstep, ook als
       spiegelingen door de storm net anders geordend binnenkomen. */
    pub fn apply_raw(&mut self, a: BoekArgs) -> Boeking {
        *self.saldi.entry(a.van.to_string()).or_insert(0) -= a.centen;
        *self.saldi.entry(a.naar.to_string()).or_insert(0) += a.centen;
        let rij = Boeking {
            id: rng::id("PB"),
            van: a.van.to_string(),
            naar: a.naar.to_string(),
            centen: a.centen,
            soort: a.soort.to_string(),
            oms: schoon(a.oms, 120),
            ref_: a.ref_,
            at: rng::nu_ms(),
        };
        self.boekingen.push_front(rij.clone());
        if self.boekingen.len() > WEERGAVE_CAP {
            self.boekingen.pop_back();
        }
        rij
    }

    /* De sluitcontrole: som van alle saldi is nul, en niemand staat rood. Dit
       is de waarheid waar /api/pay/gezond op afgaat. */
    pub fn sluitcontrole(&self) -> (bool, i64, Vec<String>) {
        let mut som: i64 = 0;
        let mut rood = Vec::new();
        for (rek, &c) in &self.saldi {
            som += c;
            if !rek.starts_with("extern:") && c < 0 {
                rood.push(rek.clone());
            }
        }
        (som == 0 && rood.is_empty(), som, rood)
    }
}

/* Kort schoonmaken van vrije tekst (zoals `schoon` in de Node-kern): knip af,
   gooi controltekens weg. */
pub fn schoon(s: &str, max: usize) -> String {
    s.chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dubbel_boekhouden_blijft_op_nul() {
        let mut g = Ledger::new();
        // opladen: extern:oplaad -> lid:NEVEL
        g.boek(BoekArgs { van: "extern:oplaad", naar: "lid:NEVEL", centen: 50000, soort: "oplaad", oms: "", ref_: None }).unwrap();
        // sturen: lid:NEVEL -> lid:MIST
        g.boek(BoekArgs { van: "lid:NEVEL", naar: "lid:MIST", centen: 25000, soort: "p2p", oms: "", ref_: None }).unwrap();
        let (klopt, som, rood) = g.sluitcontrole();
        assert!(klopt, "grootboek moet sluiten");
        assert_eq!(som, 0);
        assert!(rood.is_empty());
        assert_eq!(g.saldo_van("lid:NEVEL"), 25000);
        assert_eq!(g.saldo_van("lid:MIST"), 25000);
        assert_eq!(g.saldo_van("extern:oplaad"), -50000);
    }

    #[test]
    fn lid_kan_niet_onder_nul() {
        let mut g = Ledger::new();
        let r = g.boek(BoekArgs { van: "lid:LEEG", naar: "lid:X", centen: 100, soort: "p2p", oms: "", ref_: None });
        assert!(matches!(r, Err((402, _))));
        // saldi ongemoeid, sluit nog
        assert!(g.sluitcontrole().0);
    }

    #[test]
    fn onzin_bedrag_geweigerd() {
        let mut g = Ledger::new();
        assert!(matches!(g.boek(BoekArgs { van: "extern:oplaad", naar: "lid:X", centen: 0, soort: "x", oms: "", ref_: None }), Err((400, _))));
        assert!(matches!(g.boek(BoekArgs { van: "extern:oplaad", naar: "lid:X", centen: 600_000, soort: "x", oms: "", ref_: None }), Err((400, _))));
        assert!(matches!(g.boek(BoekArgs { van: "lid:X", naar: "lid:X", centen: 100, soort: "x", oms: "", ref_: None }), Err((400, _))));
    }
}
