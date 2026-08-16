/* De zware, zuivere rekenstap van Magnaat Economie. De Node-laag blijft de
autoritatieve spelstaat en boekt de geldstromen; Rust verdeelt vraag,
capaciteit, voorraad en macro-indices in een enkele, begrensde passage.

De functie heeft geen globale staat en geen dependencies. Daardoor is een
aanvraag deterministisch, eenvoudig naast de oude JS-uitkomst te toetsen en
veilig opnieuw te proberen. */
use crate::json::Json;

const MAX_BEDRIJVEN: usize = 10_000;

#[derive(Clone)]
struct Bedrijf {
    id: String,
    personeel: i64,
    basis_productiviteit: f64,
    training_dag: f64,
    prijs: f64,
    kwaliteit: f64,
    reputatie: f64,
    vaste_capaciteit: i64,
    bestelling: i64,
    voorraad: i64,
}

fn begrens(n: f64, min: f64, max: f64) -> f64 {
    n.max(min).min(max)
}

/* JavaScript Math.round rondt een negatieve halve waarde richting +oneindig;
f64::round doet dat van nul af. Deze vorm houdt de Rust- en JS-motor gelijk. */
fn js_rond(n: f64) -> i64 {
    (n + 0.5).floor() as i64
}
fn decimalen(n: f64, aantal: i32) -> f64 {
    let factor = 10_f64.powi(aantal);
    js_rond(n * factor) as f64 / factor
}

fn object<'a>(j: &'a Json, naam: &str) -> Result<&'a Json, String> {
    match j.get(naam) {
        Some(v @ Json::Obj(_)) => Ok(v),
        _ => Err(format!("{} moet een object zijn", naam)),
    }
}
fn getal(j: &Json, naam: &str) -> Result<f64, String> {
    j.f64_at(naam)
        .ok_or_else(|| format!("{} moet een eindig getal zijn", naam))
}
fn geheel(j: &Json, naam: &str) -> Result<i64, String> {
    j.i64_at(naam)
        .ok_or_else(|| format!("{} moet een geheel getal zijn", naam))
}
fn tekst(j: &Json, naam: &str) -> Result<String, String> {
    let s = j
        .str_at(naam)
        .ok_or_else(|| format!("{} moet tekst zijn", naam))?;
    if s.is_empty() || s.len() > 120 {
        return Err(format!("{} heeft een ongeldige lengte", naam));
    }
    Ok(s.to_string())
}

fn bedrijf(j: &Json) -> Result<Bedrijf, String> {
    let b = Bedrijf {
        id: tekst(j, "id")?,
        personeel: geheel(j, "personeel")?,
        basis_productiviteit: getal(j, "basisProductiviteit")?,
        training_dag: getal(j, "trainingDag")?,
        prijs: getal(j, "prijs")?,
        kwaliteit: getal(j, "kwaliteit")?,
        reputatie: getal(j, "reputatie")?,
        vaste_capaciteit: geheel(j, "vasteCapaciteit")?,
        bestelling: geheel(j, "bestelling")?,
        voorraad: geheel(j, "voorraad")?,
    };
    if b.personeel < 0
        || b.personeel > 10_000_000
        || b.prijs < 0.0
        || b.bestelling < 0
        || b.voorraad < 0
        || b.vaste_capaciteit < 0
    {
        return Err(format!("bedrijf {} bevat een getal buiten bereik", b.id));
    }
    Ok(b)
}

fn aantrekkelijkheid(prijs_elasticiteit: f64, b: &Bedrijf) -> f64 {
    let prijs_factor = (11_900.0 / b.prijs.max(5_000.0)).powf(prijs_elasticiteit);
    let kwaliteit_factor = begrens(b.kwaliteit / 72.0, 0.55, 1.5);
    let reputatie_factor = begrens(b.reputatie / 70.0, 0.6, 1.45);
    prijs_factor * kwaliteit_factor * reputatie_factor
}

pub fn bereken_markt(invoer: &Json) -> Result<Json, String> {
    let werk = object(invoer, "werk")?;
    let schok = object(invoer, "schok")?;
    let macro_stand = object(invoer, "macro")?;
    let instellingen = object(invoer, "instellingen")?;
    let bron = match invoer.get("bedrijven") {
        Some(Json::Arr(v)) if !v.is_empty() && v.len() <= MAX_BEDRIJVEN => v,
        Some(Json::Arr(_)) => {
            return Err(format!(
                "bedrijven moet 1..{} regels bevatten",
                MAX_BEDRIJVEN
            ))
        }
        _ => return Err("bedrijven moet een array zijn".into()),
    };
    let bedrijven: Vec<Bedrijf> = bron.iter().map(bedrijf).collect::<Result<_, _>>()?;

    let werk_aantal = geheel(werk, "aantal")?.max(0);
    let werk_totaal = getal(werk, "productiviteit")?
        + getal(werk, "service")?
        + getal(werk, "controle")?
        + getal(werk, "innovatie")?;
    let werk_bonus = if werk_aantal > 0 {
        begrens(werk_totaal / (werk_aantal as f64 * 100.0), 0.0, 0.22)
    } else {
        0.0
    };
    let service_bonus = if werk_aantal > 0 {
        getal(werk, "service")? / (werk_aantal as f64 * 40.0)
    } else {
        0.0
    };
    let controle_bonus = if werk_aantal > 0 {
        getal(werk, "controle")? / (werk_aantal as f64 * 55.0)
    } else {
        0.0
    };

    let schok_id = tekst(schok, "id")?;
    let schok_vraag = getal(schok, "vraag")?;
    let schok_aanbod = getal(schok, "aanbod")?;
    let vertrouwen = getal(macro_stand, "consumentenvertrouwen")?;
    let beroepsbevolking = getal(macro_stand, "beroepsbevolking")?;
    let leverancier_personeel = getal(macro_stand, "leverancierPersoneel")?;
    let oude_prijsindex = getal(macro_stand, "prijsindex")?;
    let basis_vraag = getal(instellingen, "basisVraag")?;
    let prijs_elasticiteit = getal(instellingen, "prijsElasticiteit")?;
    if beroepsbevolking <= 0.0 || basis_vraag <= 0.0 {
        return Err("beroepsbevolking en basisVraag moeten positief zijn".into());
    }

    let totaal_aantrekkelijk = bedrijven
        .iter()
        .map(|b| js_rond(aantrekkelijkheid(prijs_elasticiteit, b) * 100_000.0))
        .sum::<i64>() as f64
        / 100_000.0;
    let totaal_aantrekkelijk = if totaal_aantrekkelijk == 0.0 {
        1.0
    } else {
        totaal_aantrekkelijk
    };
    let macro_vraag = begrens(vertrouwen / 100.0, 0.65, 1.25);
    let totale_vraag = js_rond(basis_vraag * schok_vraag * macro_vraag).max(100);
    let leverancier_capaciteit = js_rond(1_100.0 * schok_aanbod);
    let totaal_besteld: i64 = bedrijven.iter().map(|b| b.bestelling).sum();

    let mut uitvoer_bedrijven = Vec::with_capacity(bedrijven.len());
    let mut bbp_vandaag = 0_i64;
    for b in &bedrijven {
        let trainings_factor = begrens(
            b.training_dag / (b.personeel.max(1) as f64 * 50_000.0),
            0.0,
            0.22,
        );
        let productiviteit = decimalen(
            b.basis_productiviteit * (1.0 + trainings_factor + werk_bonus),
            2,
        );
        let capaciteit =
            js_rond(b.personeel as f64 * productiviteit + b.vaste_capaciteit as f64).max(0);
        let vraag = js_rond(
            totale_vraag as f64 * aantrekkelijkheid(prijs_elasticiteit, b) / totaal_aantrekkelijk,
        )
        .max(0);
        let aandeel = if totaal_besteld > 0 {
            b.bestelling as f64 / totaal_besteld as f64
        } else {
            0.5
        };
        let levering = b
            .bestelling
            .min(js_rond(leverancier_capaciteit as f64 * aandeel));
        let voorraad_met_levering = b.voorraad.saturating_add(levering);
        let verkoop = vraag.min(capaciteit).min(voorraad_met_levering);
        let voorraad = voorraad_met_levering - verkoop;
        let levergraad = if b.bestelling > 0 {
            js_rond(levering as f64 / b.bestelling as f64 * 100.0)
        } else {
            100
        };
        let benutting = if capaciteit > 0 {
            js_rond(verkoop as f64 / capaciteit as f64 * 100.0)
        } else {
            0
        };
        let druk = if benutting > 92 {
            -2.2
        } else if benutting < 62 {
            0.4
        } else {
            0.8
        };
        let kwaliteit = decimalen(
            begrens(
                b.kwaliteit + druk + service_bonus + controle_bonus,
                35.0,
                98.0,
            ),
            1,
        );
        let reputatie = decimalen(
            begrens(b.reputatie + (kwaliteit - 70.0) / 80.0, 25.0, 98.0),
            1,
        );
        let omzet = js_rond(verkoop as f64 * b.prijs);
        bbp_vandaag = bbp_vandaag.saturating_add(omzet);

        let mut j = Json::obj();
        j.set("id", Json::Str(b.id.clone()))
            .set("productiviteit", Json::Num(productiviteit))
            .set("capaciteitVandaag", Json::Num(capaciteit as f64))
            .set("vraagVandaag", Json::Num(vraag as f64))
            .set("levering", Json::Num(levering as f64))
            .set("voorraad", Json::Num(voorraad as f64))
            .set("levergraad", Json::Num(levergraad as f64))
            .set("verkoop", Json::Num(verkoop as f64))
            .set("benutting", Json::Num(benutting as f64))
            .set("kwaliteit", Json::Num(kwaliteit))
            .set("reputatie", Json::Num(reputatie));
        uitvoer_bedrijven.push(j);
    }

    let werkenden: f64 =
        bedrijven.iter().map(|b| b.personeel as f64).sum::<f64>() + leverancier_personeel;
    let werkloosheid = decimalen(
        begrens(
            (beroepsbevolking - werkenden) / beroepsbevolking * 100.0,
            0.0,
            40.0,
        ),
        1,
    );
    let vraag_druk = totale_vraag as f64 / basis_vraag - 1.0;
    let aanbod_druk = 1.0 - schok_aanbod;
    let inflatie = decimalen(
        begrens(
            2.0 + vraag_druk * 5.5 + aanbod_druk * 4.5 - (werkloosheid - 5.0) * 0.06,
            -0.5,
            12.0,
        ),
        2,
    );
    let rente = decimalen(
        begrens(
            1.4 + 0.62 * (inflatie - 2.0) - 0.08 * (werkloosheid - 5.0),
            0.25,
            11.0,
        ),
        2,
    );
    let prijsindex = decimalen(oude_prijsindex * (1.0 + inflatie / 100.0 / 365.0), 3);
    let vraag_index = js_rond(totale_vraag as f64 / basis_vraag * 100.0);
    let aanbod_index = js_rond(schok_aanbod * 100.0);
    let nieuw_vertrouwen = decimalen(
        begrens(
            vertrouwen + if schok_id == "geen" { 0.3 } else { -0.7 },
            70.0,
            115.0,
        ),
        1,
    );

    let mut macro_uitvoer = Json::obj();
    macro_uitvoer
        .set("werkloosheid", Json::Num(werkloosheid))
        .set("inflatie", Json::Num(inflatie))
        .set("rente", Json::Num(rente))
        .set("prijsindex", Json::Num(prijsindex))
        .set("bbpVandaag", Json::Num(bbp_vandaag as f64))
        .set("vraagIndex", Json::Num(vraag_index as f64))
        .set("aanbodIndex", Json::Num(aanbod_index as f64))
        .set("consumentenvertrouwen", Json::Num(nieuw_vertrouwen));

    let mut antwoord = Json::obj();
    antwoord
        .set("ok", Json::Bool(true))
        .set("bedrijven", Json::Arr(uitvoer_bedrijven))
        .set("macro", macro_uitvoer)
        .set("totaleVraag", Json::Num(totale_vraag as f64))
        .set("werkBonus", Json::Num(werk_bonus));
    Ok(antwoord)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::json;

    fn fixture() -> Json {
        json::parse(r#"{
          "werk":{"aantal":0,"productiviteit":0,"service":0,"controle":0,"innovatie":0},
          "schok":{"id":"geen","vraag":1,"aanbod":1},
          "macro":{"consumentenvertrouwen":100,"beroepsbevolking":80,"leverancierPersoneel":14,"prijsindex":100},
          "instellingen":{"basisVraag":1250,"prijsElasticiteit":1.15},
          "bedrijven":[
            {"id":"rtg","personeel":42,"basisProductiviteit":15.5,"trainingDag":450000,"prijs":12900,"kwaliteit":82,"reputatie":79,"vasteCapaciteit":240,"bestelling":620,"voorraad":1200},
            {"id":"praktijk","personeel":18,"basisProductiviteit":14,"trainingDag":125000,"prijs":10900,"kwaliteit":68,"reputatie":61,"vasteCapaciteit":80,"bestelling":280,"voorraad":520}
          ]
        }"#).unwrap()
    }

    #[test]
    fn markt_is_deterministisch_en_begrensd() {
        let a = bereken_markt(&fixture()).unwrap();
        let b = bereken_markt(&fixture()).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.i64_at("totaleVraag"), Some(1250));
        let bedrijven = match a.get("bedrijven").unwrap() {
            Json::Arr(v) => v,
            _ => panic!(),
        };
        for b in bedrijven {
            assert!(b.i64_at("verkoop").unwrap() <= b.i64_at("capaciteitVandaag").unwrap());
            assert!(b.i64_at("voorraad").unwrap() >= 0);
        }
    }

    #[test]
    fn meer_werk_verhoogt_productiviteit() {
        let basis = bereken_markt(&fixture()).unwrap();
        let mut met_werk = fixture();
        let werk = met_werk.get("werk").unwrap().clone();
        let mut werk = werk;
        werk.set("aantal", Json::Num(2.0))
            .set("productiviteit", Json::Num(24.0));
        met_werk.set("werk", werk);
        let hoger = bereken_markt(&met_werk).unwrap();
        let productiviteit = |j: &Json| match j.get("bedrijven").unwrap() {
            Json::Arr(v) => v[0].f64_at("productiviteit").unwrap(),
            _ => 0.0,
        };
        assert!(productiviteit(&hoger) > productiviteit(&basis));
    }

    #[test]
    fn weigert_onbegrensde_bedrijfsgetallen() {
        let mut f = fixture();
        if let Some(Json::Arr(v)) = match &mut f {
            Json::Obj(m) => m.get_mut("bedrijven"),
            _ => None,
        } {
            v[0].set("voorraad", Json::Num(-1.0));
        }
        assert!(bereken_markt(&f).is_err());
    }
}
