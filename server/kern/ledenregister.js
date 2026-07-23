/* Kern-module "ledenregister": het complete ledenoverzicht voor het kantoor,
   gesplitst per stad, per land, op alfabet, per geslacht (m/v/x) en per pas
   (gratis, RTG, Lifestyle, Business). Alles op CODENAAM -- de echte naam blijft
   in de kluis (privacy by design); de codenaam-gids is de enige plek waar leden
   herkenbaar zijn.

   Bij elke pas hoort een maandbijdrage: de gratis app is 0, de RTG Pass en de
   Lifestyle Pass staan in de geld-regie (standaard 65 en 20.000 ex btw), de
   Business Pass is prijs op maat. Van elke bijdrage gaat 30% naar de
   RTFoundation: 20% blijft LOKAAL (de omgeving van het lid) en 10% gaat naar de
   RTFoundation zelf. Dit is een RAPPORTAGE, berekend uit ledental x prijs; er
   wordt nooit geclaimd dat een echte betaling is verwerkt.

   Schaalvast: de rijen komen begrensd uit de accountlaag (een venster, geen
   miljoenen); bij een echt grootboek zou dit aggregatie-per-facet worden. */

const PAS_VOLGORDE = ['gratis', 'rtg', 'lifestyle', 'business'];
const PAS_NAAM = { gratis: 'Gratis app', rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };
const GESLACHT_NAAM = { v: 'Vrouw', m: 'Man', x: 'X' };

module.exports = ({ accounts, onboarding, geldPasprijzen, ledenAantal }) => {
  const eur = c => Math.round(c) / 100;

  // de pas van een lid: een gast/gratis lid heeft tier 'guest'; wij tonen 'gratis'.
  const pasVan = tier => (tier === 'guest' ? 'gratis' : (PAS_VOLGORDE.includes(tier) ? tier : 'rtg'));
  // de stad komt uit het onboardingprofiel (woonplaats), op sleutel.
  function stadVan(key, profielen) {
    const p = profielen[key];
    const w = p && p.velden && p.velden.woonplaats;
    return w ? String(w).trim() : null;
  }

  function telOp(map, sleutel) {
    const k = sleutel || 'Onbekend'; // leden zonder ingevuld facet apart tellen
    map[k] = (map[k] || 0) + 1;
  }
  function sorteerTelling(map) {
    return Object.entries(map).map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal || a.naam.localeCompare(b.naam, 'nl'));
  }

  /* Het register. filter = { pas, land, stad, geslacht } versmalt de
     alfabetische lijst; de facet-tellingen gaan altijd over alle leden. */
  function register(filter) {
    filter = filter || {};
    const rijen = accounts.ledenRegisterRijen ? accounts.ledenRegisterRijen(20000) : [];
    const profielen = (onboarding && onboarding.store && onboarding.store().profielen) || {};

    const perPas = {}, perLand = {}, perStad = {}, perGeslacht = {};
    const passen = {};
    let metCodenaam = 0;
    const genormaliseerd = rijen.map(r => {
      const pas = pasVan(r.tier);
      const stad = stadVan(r.key, profielen);
      const g = r.geslacht; // v/m/x of null
      telOp(perPas, pas);
      telOp(perLand, r.land);
      telOp(perStad, stad);
      telOp(perGeslacht, g ? GESLACHT_NAAM[g] : null);
      passen[pas] = (passen[pas] || 0) + 1;
      if (r.codename) metCodenaam++;
      return { codenaam: r.codename, pas, pasNaam: PAS_NAAM[pas], land: r.land, stad,
        geslacht: g, geslachtNaam: g ? GESLACHT_NAAM[g] : null };
    });

    // de alfabetische, gefilterde ledenlijst (op codenaam, al gesorteerd door de bron)
    const lijst = genormaliseerd.filter(m =>
      (!filter.pas || m.pas === filter.pas) &&
      (!filter.land || (m.land || '') === filter.land) &&
      (!filter.stad || (m.stad || '') === filter.stad) &&
      (!filter.geslacht || m.geslacht === filter.geslacht)
    ).filter(m => m.codenaam).slice(0, 500);

    // de omzet per pas en de 30%-foundationsplit (20% lokaal, 10% RTF)
    const prijzen = (geldPasprijzen && geldPasprijzen().passen) || {};
    const maandCenten = { gratis: 0, rtg: (prijzen.rtg || {}).maandCenten || 0, lifestyle: (prijzen.lifestyle || {}).maandCenten || 0 };
    const omzet = PAS_VOLGORDE.map(pas => {
      const aantal = passen[pas] || 0;
      const opMaat = pas === 'business';
      const centenPP = maandCenten[pas] || 0;
      const maandCentenTot = opMaat ? null : centenPP * aantal;
      return { pas, pasNaam: PAS_NAAM[pas], aantal, opMaat,
        prijsPP: opMaat ? null : eur(centenPP), maandOmzet: opMaat ? null : eur(maandCentenTot) };
    });
    // totaal alleen over de passen met een bekende prijs (Business is op maat)
    const totaalCenten = omzet.reduce((s, o) => s + (o.maandOmzet != null ? Math.round(o.maandOmzet * 100) : 0), 0);
    const split = {
      totaalOmzet: eur(totaalCenten),
      foundation30: eur(Math.round(totaalCenten * 0.30)),
      lokaal20: eur(Math.round(totaalCenten * 0.20)),
      rtf10: eur(Math.round(totaalCenten * 0.10)),
      businessOpMaat: (passen.business || 0)
    };

    return { ok: true,
      totaalGeteld: rijen.length,
      totaalLeden: typeof ledenAantal === 'function' ? ledenAantal() : rijen.length,
      metCodenaam,
      perPas: PAS_VOLGORDE.map(p => ({ naam: PAS_NAAM[p], pas: p, aantal: perPas[p] || 0 })),
      perGeslacht: sorteerTelling(perGeslacht),
      perLand: sorteerTelling(perLand).slice(0, 60),
      perStad: sorteerTelling(perStad).slice(0, 60),
      omzet, split,
      filter: { pas: filter.pas || null, land: filter.land || null, stad: filter.stad || null, geslacht: filter.geslacht || null },
      lijst };
  }

  return { ledenregister: { register, PAS_VOLGORDE, PAS_NAAM } };
};
