/* HET REISCONCEPT ALS WERKSTUK -- een reiswens die het lid op het scherm kan
   aanpassen, terwijl Rahul en de Edge naar dezelfde waarden kijken (EDGE.md par.
   14.6, live samenwerking).

   GEEN TWEEDE CONCEPTMODEL. De waarden zijn die van ./reiswens.js (leesReiswens),
   en wat het lid ziet komt uit conceptVan op die waarden. Dit bestand voegt er
   precies drie dingen aan toe: een id, een versie en een eigenaar. Bewaard wordt
   in het geheugen van Rahul zelf (kern/fluister.js, `van(key)`), dus "vergeet
   alles" neemt het concept mee en er komt geen collectie bij.

   EEN WIJZIGING IS DETERMINISTISCH. Geen model: elk veld heeft een vaste
   controle (BEWERKBAAR), een onbekend veld wordt geweigerd met zijn naam, en een
   wijziging die niets verandert is geen wijziging (twee keer dezelfde klik geeft
   twee keer hetzelfde antwoord, zonder nieuwe versie).

   GELIJKTIJDIG IS EEN VERSIE. Twee schermen die allebei op versie 3 werken: de
   eerste wint, de tweede krijgt 409 met het concept zoals het NU is -- nooit een
   stille samenvoeging, want dan ziet een van beide schermen een reis die het lid
   daar niet heeft gemaakt.

   EEN CONCEPT DOET NIETS. Er is hier geen pad naar een aanvraag, een boeking,
   een betaling of een bericht; het concept bestaat alleen in het antwoord en in
   het geheugen van het lid zelf. Indienen is een eigen handeling met een eigen
   gewicht, en die woont niet hier. */
'use strict';
const crypto = require('crypto');
const { conceptVan, geld } = require('./reiswens');

const MAX_CONCEPTEN = 5;
const BEWAARTERMIJN_MS = 24 * 60 * 60 * 1000;

/* Wat het scherm mag aanpassen, en hoe het wordt gecontroleerd. Dit is de enige
   lijst; de client tekent zijn invoer hieruit (het antwoord draagt hem mee). */
const BEWERKBAAR = Object.freeze([
  Object.freeze({ naam: 'bestemming', label: 'Bestemming', soort: 'tekst', max: 60, verplicht: true }),
  Object.freeze({ naam: 'reizigers', label: 'Reizigers', soort: 'getal', min: 1, max: 30 }),
  Object.freeze({ naam: 'dagen', label: 'Dagen', soort: 'getal', min: 1, max: 60 }),
  Object.freeze({ naam: 'budgetPP', label: '€ p.p.', soort: 'getal', min: 1, max: 100000 })
]);
const PLAATS = /^[A-Za-zÀ-ſ][A-Za-zÀ-ſ' -]*$/;

/* Een waarde op een veld; geeft { waarde } of { fout }. Leeg mag bij een getal
   (dan komt het bij "nog nodig"), niet bij de bestemming. */
function veldControle(veld, ruw) {
  if (veld.soort === 'tekst') {
    if (typeof ruw !== 'string') return { fout: veld.label + ' moet een tekst zijn.' };
    const t = ruw.replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > veld.max || !PLAATS.test(t)) return { fout: veld.label + ' is geen plaatsnaam.' };
    return { waarde: t.replace(/(^|[\s-])([a-zà-ſ])/g, (m, a, b) => a + b.toUpperCase()) };
  }
  if (ruw === null || ruw === '') return veld.verplicht ? { fout: veld.label + ' is nodig.' } : { waarde: null };
  const n = typeof ruw === 'number' ? ruw : (typeof ruw === 'string' && /^\d{1,7}$/.test(ruw.trim()) ? Number(ruw) : NaN);
  if (!Number.isInteger(n) || n < veld.min || n > veld.max)
    return { fout: veld.label + ' moet een heel getal zijn van ' + veld.min + ' tot en met ' + veld.max + '.' };
  return { waarde: n };
}


/* Wat Rahul zegt na een wijziging: uit de waarden, zonder model. */
function zinNaWijziging(w) {
  const delen = [];
  if (w.reizigers) delen.push('voor ' + w.reizigers + (w.reizigers === 1 ? ' persoon' : ' personen'));
  if (w.dagen) delen.push(w.dagen + ' ' + (w.nachten ? 'nachten' : 'dagen'));
  let zin = 'U plant een reis naar ' + w.bestemming + (delen.length ? ' ' + delen.join(', ') : '');
  if (w.budgetPP && w.reizigers) zin += ', met een maximaal groepsbudget van ' + geld(w.budgetPP * w.reizigers);
  else if (w.budgetPP) zin += ', met maximaal ' + geld(w.budgetPP) + ' per persoon';
  return zin + '. Er is niets ingediend of geboekt.';
}

module.exports = function reisconcept({ van, alle, save, nu, catalogus }) {
  const tijd = () => Date.parse(nu());
  function levendeConcepten(p) {
    const grens = tijd() - BEWAARTERMIJN_MS;
    p.concepten = (Array.isArray(p.concepten) ? p.concepten : []).filter((c) => Date.parse(c.gewijzigd) >= grens);
    return p.concepten;
  }
  function conceptBeeld(rij) {
    return Object.assign(conceptVan(rij.waarden, catalogus()), { id: rij.id, versie: rij.versie, stand: 'concept', kop: 'TravelOS \u00b7 Reisconcept',
      bewerkbaar: BEWERKBAAR, waarden: Object.fromEntries(BEWERKBAAR.map((v) => [v.naam, rij.waarden[v.naam] == null ? null : rij.waarden[v.naam]])) });
  }
  /* Een nieuw concept uit een gelezen reiswens. De aanroeper (rahulExtra) slaat op. */
  function conceptNieuw(p, key, waarden) {
    const rij = { id: 'RW-' + crypto.randomBytes(5).toString('hex').toUpperCase(), versie: 1, eigenaar: key,
      gemaakt: nu(), gewijzigd: nu(), waarden: Object.assign({}, waarden) };
    const l = levendeConcepten(p);
    l.push(rij);
    p.concepten = l.slice(-MAX_CONCEPTEN);
    return conceptBeeld(rij);
  }
  function conceptAanpassen(key, invoer) {
    const { id, versie, velden } = invoer || {};
    const rij = levendeConcepten(van(key)).find((c) => c.id === String(id || ''));
    // van een ander, verlopen of verzonnen: hetzelfde antwoord, want ook "bestaat" is een gegeven
    if (!rij) return { status: 404, error: 'Dit concept ken ik niet (meer).' };
    if (!velden || typeof velden !== 'object' || Array.isArray(velden)) return { status: 400, error: 'Geef aan wat u wilt aanpassen.' };
    const nieuw = Object.assign({}, rij.waarden), wat = [];
    for (const [naam, ruw] of Object.entries(velden)) {
      const veld = BEWERKBAAR.find((v) => v.naam === naam);
      if (!veld) return { status: 400, error: 'Dit veld is niet aan te passen: ' + String(naam).slice(0, 40) + '.', veld: String(naam).slice(0, 40) };
      const c = veldControle(veld, ruw);
      if (c.fout) return { status: 400, error: c.fout, veld: naam, concept: conceptBeeld(rij) };
      if (c.waarde !== (rij.waarden[naam] == null ? null : rij.waarden[naam])) { nieuw[naam] = c.waarde; wat.push(naam); }
    }
    if (!wat.length) return { ok: true, gewijzigd: false, concept: conceptBeeld(rij), zin: zinNaWijziging(rij.waarden) };
    if (Number(versie) !== rij.versie)
      return { status: 409, error: 'Het concept is intussen op een ander scherm aangepast. Dit is de stand van nu.', concept: conceptBeeld(rij) };
    // het lid heeft het aantal zelf gezet: "u en zes vrienden" is geen aanname meer
    if (wat.includes('reizigers')) nieuw.aanname = null;
    rij.waarden = nieuw;
    rij.versie += 1;
    rij.gewijzigd = nu();
    save();
    return { ok: true, gewijzigd: true, wat, concept: conceptBeeld(rij), zin: zinNaWijziging(nieuw) };
  }
  /* Het contextdomein (kern/stuur/menscontext-opzoek.js): Rahul krijgt de
     waarden van NU, door de server opgezocht, en alleen van de eigenaar. */
  const contextDomein = {
    soort: 'reiswens',
    velden: ['titel', 'bestemming', 'reizigers', 'dagen', 'budgetPerPersoon', 'versie', 'stand'],
    zoek(id) {
      const grens = tijd() - BEWAARTERMIJN_MS;
      for (const p of Object.values(alle() || {}))
        for (const c of (p && Array.isArray(p.concepten) ? p.concepten : []))
          if (c.id === id && Date.parse(c.gewijzigd) >= grens) return c;
      return null;
    },
    eigenaar: (c) => c.eigenaar,
    mag: () => true,
    beeld: (c) => ({ titel: 'Nieuwe reis naar ' + c.waarden.bestemming, bestemming: c.waarden.bestemming, reizigers: c.waarden.reizigers, dagen: c.waarden.dagen,
      budgetPerPersoon: c.waarden.budgetPP, versie: c.versie, stand: 'concept' })
  };
  return { conceptNieuw, conceptAanpassen, conceptBeeld, contextDomein, BEWERKBAAR };
};
module.exports.BEWERKBAAR = BEWERKBAAR;
module.exports.zinNaWijziging = zinNaWijziging;
