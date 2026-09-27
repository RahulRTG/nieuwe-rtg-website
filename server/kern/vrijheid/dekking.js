/* VRIJHEID: DEKKING -- niet hoeveel mensen er zijn, maar of het werk gedragen
   wordt.

   Vier aanwezigen kunnen te weinig zijn als de enige die PAYMENT_L3 mag doen
   naar huis gaat. Daarom telt deze module per tijdvak twee dingen apart: de
   bezetting en elke vereiste bevoegdheid. Een gat draagt WAT er ontbreekt en
   WANNEER, zodat een weigering een zin wordt ("PAYMENT_L3 ontbreekt tussen
   14:00 en 16:00") en geen nee.

   WAT NIET MEETELT, en waarom:
     - wie op die dag niet in dienst is (nog niet begonnen, of uit dienst);
     - een bevoegdheid die verlopen is OP DE DAG ZELF, niet op de dag van de
       aanvraag -- een certificaat dat verloopt na de goedkeuring maar voor de
       dienst, telt dus niet (NO_COVERAGE_WITH_INVALID_AUTHORITY);
     - een bevoegdheid die niemand heeft afgetekend, of die de houder zelf
       aftekende. De vorm van kern/vakbewijs.js: een ingediend stuk is geen
       bewijs, en de werkgever of de mens zelf tekent niet af.

   EN WAT DEKKING NIET KAN WETEN. Staan er voor een tijdvak geen eisen, dan is
   de uitslag UNKNOWN en niet SAFE: zonder eis is er niets om aan te toetsen,
   en "niemand heeft gezegd wat er nodig is" is iets anders dan "het is veilig". */
'use strict';
const T = require('./tijd');

function inDienst(mens, datum) {
  const d = mens && mens.inDienst;
  if (!d || !T.isDatum(d.van)) return false;
  return d.van <= datum && (!d.tot || d.tot >= datum);
}

function geldigeKwalificaties(team, persoon, datum) {
  const uit = new Set(); const nietGeteld = [];
  for (const k of team.kwalificaties || []) {
    if (k.persoon !== persoon) continue;
    if (!k.geldigTot || k.geldigTot < datum) { nietGeteld.push({ code: k.code, reden: 'verlopen' }); continue; }
    if (!k.afgetekendDoor || k.afgetekendDoor === persoon) { nietGeteld.push({ code: k.code, reden: 'niet-afgetekend' }); continue; }
    uit.add(k.code);
  }
  return { codes: uit, nietGeteld };
}

/* Wie staat er op dit moment ingepland, rekening houdend met afwezigheid.
   afwezig: [{ persoon, van, tot }] in absolute minuten. */
function aanwezigOp(team, moment, afwezig) {
  const uit = [];
  for (const d of team.diensten || []) {
    const iv = T.interval(d);
    if (!iv || !(iv.van <= moment && moment < iv.tot)) continue;
    const mens = (team.mensen || []).find(m => m.id === d.persoon);
    if (!inDienst(mens, d.datum)) continue;
    if ((afwezig || []).some(a => a.persoon === d.persoon && a.van <= moment && moment < a.tot)) continue;
    uit.push({ persoon: d.persoon, datum: d.datum });
  }
  return uit;
}

function eisInterval(e) {
  return T.interval({ datum: e.datum, van: e.van, tot: e.tot });
}

/* venster: { van, tot } in absolute minuten. Draagt het venster een persoon,
   dan IS het de afwezigheid die getoetst wordt, en telt die mens in dat
   venster niet mee. */
function toets(team, venster, reeds) {
  const afwezig = (reeds || []).concat(venster.persoon ? [venster] : []);
  const eisen = (team.eisen || []).map(e => ({ e, iv: eisInterval(e) })).filter(x => x.iv && T.overlapt(x.iv, venster));
  if (!eisen.length) return { stand: 'UNKNOWN', gaten: [], uitleg: 'Voor dit tijdvak zijn geen bezettingseisen vastgelegd; zonder eis is dekking niet aan te tonen.' };

  /* Breekpunten: elk begin en eind van een eis, dienst of afwezigheid binnen het venster. */
  const punten = new Set([venster.van, venster.tot]);
  const voeg = (iv) => { for (const p of [iv.van, iv.tot]) if (p > venster.van && p < venster.tot) punten.add(p); };
  eisen.forEach(x => voeg(x.iv));
  (team.diensten || []).forEach(d => { const iv = T.interval(d); if (iv) voeg(iv); });
  (afwezig || []).forEach(voeg);
  const lijst = [...punten].sort((a, b) => a - b);

  const gaten = []; let minMarge = Infinity;
  for (let i = 0; i < lijst.length - 1; i++) {
    const vak = { van: lijst[i], tot: lijst[i + 1] };
    const actief = eisen.filter(x => x.iv.van <= vak.van && vak.van < x.iv.tot);
    if (!actief.length) continue;
    const hier = aanwezigOp(team, vak.van, afwezig);
    const datum = T.datumVan(Math.floor(vak.van / T.DAG));
    for (const { e } of actief) {
      const min = Number(e.minBezetting) || 0;
      if (hier.length < min) gaten.push({ ...vak, ontbreekt: 'bezetting', nodig: min, aanwezig: hier.length });
      minMarge = Math.min(minMarge, hier.length - min);
      for (const [code, nodig] of Object.entries(e.vereist || {})) {
        const met = hier.filter(h => geldigeKwalificaties(team, h.persoon, datum).codes.has(code)).length;
        if (met < nodig) gaten.push({ ...vak, ontbreekt: code, nodig, aanwezig: met });
        minMarge = Math.min(minMarge, met - nodig);
      }
    }
  }
  /* Aaneengesloten gaten met dezelfde ontbrekende eis worden een gat. */
  const samen = [];
  for (const g of gaten.sort((a, b) => a.ontbreekt.localeCompare(b.ontbreekt) || a.van - b.van)) {
    const vorige = samen[samen.length - 1];
    if (vorige && vorige.ontbreekt === g.ontbreekt && vorige.tot === g.van) vorige.tot = g.tot;
    else samen.push({ ...g });
  }
  if (samen.length) return { stand: 'GAP', gaten: samen, marge: minMarge, uitleg: samen.map(zin).join(' ') };
  return { stand: 'SAFE', gaten: [], marge: minMarge, uitleg: 'Bezetting en vereiste bevoegdheden blijven gedekt.' };
}

function zin(g) {
  const wat = g.ontbreekt === 'bezetting' ? 'De minimale bezetting (' + g.nodig + ')' : g.ontbreekt + '-dekking';
  return wat + ' zou tussen ' + T.klokVan(g.van) + ' en ' + T.klokVan(g.tot) + ' ontbreken.';
}

module.exports = { toets, inDienst, geldigeKwalificaties, aanwezigOp };
