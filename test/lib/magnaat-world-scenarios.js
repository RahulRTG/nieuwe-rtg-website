/* DE WORLD-SCENARIO'S VAN RONDE A2 -- en hun vingerafdruk.

   Waarom ze bestaan: A2.1 is de enige toegestane geldgedragswijziging van
   Magnaat World (MAGNAAT.md). Om te kunnen zeggen WAT er veranderde, wordt
   World eerst vastgelegd zoals hij is, per stap, en daarna nog eens na de
   wijziging. Daarna worden dezelfde scenario's de WORLD ECONOMIC GOLDEN
   BASELINE waar A2.2 t/m A2.9 exact aan gelijk moeten blijven.

   Samen raken de scenario's alle 27 gebeurtenissen van de geldkaart
   (scripts/lib/magnaatgeldkaart.js); test/magnaat-world-geld.test.js meet dat
   met ./magnaat-geldkaart-dekking.js in plaats van het te beweren.

   Een stap is een spelactie (met het antwoord dat de speler kreeg) of een
   maand. De vingerafdruk dekt alles wat geld draagt: de kassen, de
   Foundation-pot, leningen, contracten, belangen, polissen, veilingen en wat
   een maand aan rente, premie en schade liet verdwijnen. */
'use strict';
const { canoniek, hash } = require('./magnaat-economie-scenarios');

const MAP = '../../server/kern/spellen/magnaat/';

function nieuweWereld(id, { regelversie } = {}) {
  const m = require(MAP + 'index')({ save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {} });
  const { kaart } = require(MAP + 'kaart');
  const potje = { id, soort: 'magnaat', spelers: ['a', 'b', 'c'], teams: [0, 1, 2], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' } };
  m.spel.init(potje);
  const st = potje.staat;
  // een partij op een eerdere regelversie, zoals een lopende partij die houdt
  if (regelversie) st.regelversie = regelversie;
  const k = kaart(st.stad);
  const kavel = (zone, n) => k.kavels.filter(x => x.zone === zone && !st.kavelBezet[x.id])[n || 0].id;
  return { m, potje, st, kavel };
}

/* Wat er na een stap aan geld in de wereld staat. Alleen gegevens die geld
   dragen, zodat een wijziging in iets anders (een tekst, een teller) de
   vergelijking niet vertroebelt. */
function afdruk(st) {
  const kies = (lijst, velden) => (lijst || []).map(x => Object.fromEntries(velden.map(v => [v, x[v] === undefined ? null : x[v]])));
  return {
    maand: st.maand,
    geld: st.geld,
    foundation: { lokaal: st.foundation.lokaal, centraal: st.foundation.centraal, gedaan: st.foundation.gedaan.map(g => g.id) },
    vestigingen: Object.fromEntries(Object.entries(st.vestigingen).map(([h, rij]) => [h, kies(rij, ['id', 'omvang', 'personeel', 'gebouwdVoor', 'omzetTotaal', 'resultaatTotaal'])])),
    leningen: kies(st.leningen, ['id', 'speler', 'status', 'hoofdsom', 'restant', 'betaaldRente', 'betaaldAflossing', 'opbrengst']),
    contracten: kies(st.contracten, ['id', 'status', 'betaald', 'ontvangen', 'boetes', 'afkoop']),
    deelnemingen: kies(st.deelnemingen, ['id', 'status', 'houder', 'prijs', 'ontvangen']),
    polissen: kies(st.polissen, ['id', 'status', 'betaald', 'uitgekeerd']),
    veilingen: kies(st.veilingen, ['id', 'status', 'winnaar', 'prijs'])
  };
}

function voerUit(w, stap) {
  if (stap[0] === 'maand') {
    const verslagen = [];
    for (let i = 0; i < stap[1]; i++) {
      w.st.gerekendTot -= w.st.maandMs;
      for (const v of w.m.eco.bijrekenen(w.potje)) verslagen.push({ afdracht: v.afdracht, rentelast: v.rentelast, premielast: v.premielast, schadelast: v.schadelast });
    }
    return { verslagen };
  }
  const [, speler, zet] = stap;
  const z = typeof zet === 'function' ? zet(w) : zet;
  if (!z) return { overgeslagen: true };
  const r = w.m.spel.zet(w.potje, speler, z);
  return { status: r.status || 200, error: r.error || null, id: r.id || null };
}

/* Hulpjes die een id uit de wereld halen op het moment dat de stap loopt. */
const ves = (h, n = 0) => (w) => w.st.vestigingen[h][n] && w.st.vestigingen[h][n].id;
const laatste = (lijst) => (w) => { const l = w.st[lijst] || []; return l.length ? l[l.length - 1].id : null; };
const contract = (van, mijn, hun, soort, x) => ['zet', van, (w) => Object.assign({ actie: 'contract-voorstel', mijn: mijn(w), hun: hun(w), soort,
  looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false }, x)];
const ja = (speler, lijst, actie) => ['zet', speler, (w) => ({ actie, id: laatste(lijst)(w), antwoord: 'ja' })];

const SCENARIOS = {
  /* Het gewone leven van drie ondernemers: bouwen, contracten, een belang, krediet,
     een verzekering, opzeggen en twee veilingen. */
  gewoon: {
    potje: 'wereld-a2-gewoon',
    stappen: [
      ['zet', 'a', (w) => ({ actie: 'open', kavel: w.kavel('terrein'), sector: 'logistiek', omvang: 10, naam: 'Atlas' })],
      ['zet', 'b', (w) => ({ actie: 'open', kavel: w.kavel('boulevard'), sector: 'horeca', omvang: 10, naam: 'Zeezicht' })],
      ['zet', 'c', (w) => ({ actie: 'open', kavel: w.kavel('centrum'), sector: 'retail', omvang: 10, naam: 'Winkel' })],
      ['zet', 'a', (w) => ({ actie: 'uitbreiden', id: ves('a')(w), erbij: 2 })],
      ['zet', 'b', (w) => ({ actie: 'beleid', id: ves('b')(w), personeel: 6, marketing: 500 })],
      contract('b', ves('b'), ves('a'), 'vervoer', { eenheden: 40, bedrag: 3000, vooraf: 500, boete: 700, eis: 95 }),
      ja('a', 'contracten', 'contract-antwoord'),
      contract('c', ves('c'), ves('a'), 'vervoer', { eenheden: 600, bedrag: 50000, boete: 300 }),
      ja('a', 'contracten', 'contract-antwoord'),
      ['zet', 'c', (w) => ({ actie: 'belang-voorstel', vestiging: ves('b')(w), deel: 20, prijs: 15000 })],
      ja('b', 'deelnemingen', 'belang-antwoord'),
      ['zet', 'a', { actie: 'krediet-opnemen', soort: 'werkkapitaal', bedrag: 20000, looptijd: 12 }],
      ['zet', 'a', (w) => ({ actie: 'krediet-aflossen', id: laatste('leningen')(w), bedrag: 5000 })],
      ['zet', 'c', { actie: 'krediet-opnemen', soort: 'investering', bedrag: 30000, looptijd: 36 }],
      ['zet', 'c', (w) => ({ actie: 'krediet-herzien', id: laatste('leningen')(w), maanden: 12 })],
      ['zet', 'b', (w) => ({ actie: 'polis-sluiten', vestiging: ves('b')(w), risico: 'brand', dekking: 1, eigenRisico: 0, maximum: 500000 })],
      ...['brand', 'storm', 'machinebreuk', 'transport', 'cyber'].map(risico => ['zet', 'a', (w) => ({ actie: 'polis-sluiten', vestiging: ves('a')(w), risico, dekking: 1, eigenRisico: 0, maximum: 500000 })]),
      ['maand', 4],
      ['zet', 'c', (w) => ({ actie: 'contract-opzeggen', id: w.st.contracten[1] && w.st.contracten[1].id })],
      ['zet', 'a', (w) => ({ actie: 'veiling-start', soort: 'kavel', kavel: w.kavel('centrum'), duur: 'kort' })],
      ['zet', 'b', (w) => ({ actie: 'veiling-bod', id: laatste('veilingen')(w), bedrag: 40000 })],
      ['zet', 'c', (w) => ({ actie: 'veiling-start', soort: 'vestiging', vestiging: ves('c')(w), duur: 'kort' })],
      ['zet', 'a', (w) => ({ actie: 'veiling-bod', id: laatste('veilingen')(w), bedrag: 15000 })],
      ['maand', 8]
    ]
  },
  /* Wat er gebeurt als het misgaat: sluiten met een contract erop, rood staan,
     een vastgoedlening die wordt opgeeist en uitgewonnen, en een risico dat
     toeslaat bij een verzekerde zaak. */
  crisis: {
    potje: 'wereld-a2-crisis',
    stappen: [
      ['zet', 'a', (w) => ({ actie: 'open', kavel: w.kavel('terrein'), sector: 'logistiek', omvang: 10 })],
      ['zet', 'b', (w) => ({ actie: 'open', kavel: w.kavel('boulevard'), sector: 'horeca', omvang: 10 })],
      ['zet', 'b', (w) => ({ actie: 'open', kavel: w.kavel('boulevard'), sector: 'horeca', omvang: 8 })],
      contract('b', ves('b', 1), ves('a'), 'vervoer', { looptijd: 24, eenheden: 60, bedrag: 4000, boete: 900, eis: 95 }),
      ja('a', 'contracten', 'contract-antwoord'),
      contract('b', ves('b'), ves('a'), 'vervoer', { looptijd: 36, eenheden: 20, bedrag: 2000, boete: 100 }),
      ja('a', 'contracten', 'contract-antwoord'),
      ['zet', 'b', (w) => ({ actie: 'krediet-opnemen', soort: 'vastgoed', bedrag: 20000, looptijd: 120, vestiging: ves('b')(w) })],
      ['zet', 'b', (w) => ({ actie: 'polis-sluiten', vestiging: ves('b')(w), risico: 'brand', dekking: 1, eigenRisico: 0, maximum: 500000 })],
      ['maand', 1],
      ['zet', 'b', (w) => ({ actie: 'sluiten', id: ves('b', 1)(w) })],
      ['zet', 'b', (w) => ({ actie: 'beleid', id: ves('b')(w), personeel: 60 })],
      ['maand', 14]
    ]
  }
};

/* Draai een scenario op een verse wereld en geef per stap een vingerafdruk.
   `naElkeStap(wereld, stap)` mag na elke stap naar de wereld kijken, en
   `regelversie` draait hem als een partij op die versie. */
function draai(naam, { naElkeStap, regelversie } = {}) {
  const sc = SCENARIOS[naam];
  const w = nieuweWereld(sc.potje, { regelversie });
  const uit = [{ stap: 'start', hash: hash(afdruk(w.st)) }];
  sc.stappen.forEach((stap, i) => {
    const antwoord = voerUit(w, stap);
    if (naElkeStap) naElkeStap(w, stap);
    const a = afdruk(w.st);
    uit.push({ stap: i + 1, soort: stap[0] === 'maand' ? 'maand' : (typeof stap[2] === 'function' ? stap[2](w).actie : stap[2].actie), status: antwoord.status || null,
      hash: hash({ antwoord, afdruk: a }),
      delen: { antwoord: hash(antwoord), geld: hash(a.geld), rest: hash(Object.assign({}, a, { geld: null })) } });
  });
  return { stappen: uit, eind: afdruk(w.st), wereld: w };
}

module.exports = { SCENARIOS, draai, afdruk, canoniek, nieuweWereld, voerUit };
