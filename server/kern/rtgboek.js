/* HET BOEK VAN RTG ZELF -- wat RTG als organisatie uitgeeft en verschuldigd is,
   per maand, ingevoerd door het Financiën-kantoor (besluit C8 van de eigenaar,
   27 september 2026).

   WAAROM DIT BESTAAT. De operationele marge, de runway, de liquiditeit en de
   kosten per nieuw lid hadden geen bron (AUTONOMIE.md par. 7): de kostenlaag
   (kern/kosten) kent de kosten van het PLATFORM -- verbruik per gebruiker, en de
   nota's van stroom en serverhuur in de huisrekening -- maar niet wat RTG kost
   als bedrijf. Dit boek houdt precies dat, en niets dat er al staat: stroom en
   serverhuur blijven in de huisrekening en worden daar GELEZEN, anders staat
   dezelfde nota op twee plekken.

   DRIE DELEN, elk met een gesloten lijst posten:
     vast       wat RTG deze maand uitgaf aan mensen, huisvesting, diensten en overig;
     marketing  wat RTG deze maand uitgaf om leden te werven, per aanmeldkanaal
                (kern/aanmeldkanaal.js) -- 'vriend' heeft met opzet geen post, want
                een lid dat een vriend meeneemt kost geen advertentie;
     kort       wat RTG op de laatste dag van de maand verschuldigd was en binnen
                twaalf maanden betaalt: crediteuren, belasting, loon, overig.
                Het tegoed dat leden bij RTG hebben staat hier NIET in (besluit
                C10): dat hoort bij RTG Pay en wordt ernaast getoond, niet
                afgetrokken.

   VIER REGELS.
   1. GEEN BEDRAG ZONDER BRON, en op naam: een mens van Financiën, niet de gedeelde
      kantoorcode. De graad is `vermoed` -- overgetikt -- en nooit `gemeten`.
   2. PERSONEEL IS EEN TOTAAL. Er is geen post per medewerker en die komt er niet:
      een salaris naast een naam is een persoonsgegeven, en de marge heeft het niet
      nodig.
   3. EEN DEEL IS PAS COMPLEET ALS ELKE POST IS INGEVULD, ook met nul. Een half
      ingevuld deel levert geen totaal: te lage kosten zien er uit als een goede
      maand. `ontbreekt` zegt welke posten nog leeg zijn.
   4. OVERSCHRIJVEN LAAT DE VORIGE STAND STAAN, en dezelfde invoer nog eens
      verandert niets (een dubbelklik wist anders de echte vorige stand).

   Wat dit NIET is: een boekhouding of een betaalweg. Er beweegt hier geen geld. */
'use strict';

const { KANALEN } = require('./aanmeldkanaal');

const NAAM = 'rtgBoek';
const DELEN = Object.freeze({
  vast: Object.freeze(['personeel', 'huisvesting', 'diensten', 'overig']),
  marketing: Object.freeze(KANALEN.filter(k => k !== 'vriend')),
  kort: Object.freeze(['crediteuren', 'belasting', 'loon', 'overig'])
});
const MAX_CENTEN = 100000000000;   // een miljard euro per post: een grens op het doel

module.exports = ({ db, save, nu }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/rtgboek', bezit: { [NAAM]: 'kaart' } });
  const klok = typeof nu === 'function' ? nu : () => new Date().toISOString();
  const maandVan = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? String(m) : null);

  function zet({ maand, deel, post, centen, bron, wie }) {
    const m = maandVan(maand);
    if (!m) return { status: 400, error: 'Kies een maand als 2026-09.' };
    if (!DELEN[deel]) return { status: 400, error: 'Kies vast, marketing of kort.' };
    if (!DELEN[deel].includes(post)) return { status: 400, error: 'Onbekende post voor ' + deel + ': kies ' + DELEN[deel].join(', ') + '.' };
    if (!Number.isInteger(centen) || centen < 0 || centen > MAX_CENTEN)
      return { status: 400, error: 'Het bedrag is een heel, niet-negatief aantal centen.' };
    const b = String(bron || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (b.length < 4) return { status: 400, error: 'Zeg waar het bedrag vandaan komt: welke factuur, loonstrook of opgave.' };
    if (!wie) return { status: 403, error: 'Het boek van RTG vult een mens van Financiën op naam, niet de gedeelde kantoorcode.' };
    const kaart = eigen.bak(NAAM);
    const mnd = kaart[m] || (kaart[m] = {});
    const d = mnd[deel] || (mnd[deel] = {});
    const oud = d[post] || null;
    if (oud && oud.centen === centen && oud.bron === b) return { ok: true, ongewijzigd: true, boek: boek(m) };
    d[post] = { centen, bron: b, gezetOp: klok(), gezetDoor: String(wie).slice(0, 80),
      vorige: oud ? { centen: oud.centen, bron: oud.bron, gezetOp: oud.gezetOp, gezetDoor: oud.gezetDoor } : null };
    save();
    return { ok: true, boek: boek(m) };
  }

  /* Een deel van een maand: de posten, en een totaal alleen als elke post er is. */
  function deelVan(mnd, deel) {
    const d = (mnd && mnd[deel]) || {};
    const posten = DELEN[deel].map(p => (d[p] ? Object.assign({ post: p }, d[p]) : { post: p, centen: null }));
    const ontbreekt = posten.filter(p => p.centen == null).map(p => p.post);
    return { posten, ontbreekt, compleet: ontbreekt.length === 0,
      totaalCenten: ontbreekt.length ? null : posten.reduce((s, p) => s + p.centen, 0) };
  }

  /* Het boek van een maand. Lezen maakt niets aan. */
  function boek(maand) {
    const m = maandVan(maand) || klok().slice(0, 7);
    const mnd = eigen.kijk(NAAM)[m] || null;
    return { maand: m, graad: mnd ? 'vermoed' : 'onbekend',
      vast: deelVan(mnd, 'vast'), marketing: deelVan(mnd, 'marketing'), kort: deelVan(mnd, 'kort'),
      reden: mnd ? null : 'Voor deze maand is niets ingevoerd; er staat geen getal waar er geen is.' };
  }

  return { rtgBoek: boek, rtgBoekZet: zet, RTGBOEK_DELEN: DELEN };
};
