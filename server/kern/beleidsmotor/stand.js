/* DE STAND VAN DE BELEIDSMOTOR -- hoe de tellers gelezen worden.

   Deel van ./index.js. Een zuivere functie over het beeld (de opgeslagen tellers
   met de nog niet gespoelde buffer eroverheen): zij schrijft niets, en een lezing
   is dus nooit een verborgen schrijfactie. */
'use strict';

const { DEUREN, FEITEN, STAPOP_DEUREN } = require('./regels');
const { RIJP } = require('../commercie/schaduw');
const { WERKWOORDEN, KAMERSOORT, EXPORTEN } = require('./werkwoorden');
const uitvoeren = require('./uitvoeren');

/* KLEINE AANTALLEN BLIJVEN BINNEN in de werklijst (11 oktober 2026). Per route
   is "opNaam 1x" met drie mensen op kantoor een aanwijsbaar persoon. Onder de
   GRENS geen getal en geen nul, maar de stand TE_KLEINE_GROEP -- de vorm van
   ../bedrijfsmaat/poort.js. De totalen per klasse blijven staan: die gaan over
   het hele kantoor en niet over een zeldzame route. De route
   (routes/office/beleidsmotor.js) past dit toe voor iedereen behalve de
   eigenaar, die over afdwingen beslist en de exacte werklijst daarvoor nodig
   heeft. */
const TE_KLEINE_GROEP = 'TE_KLEINE_GROEP';   // dezelfde betekenis als in ../bedrijfsmaat/poort.js (geen require: andere domeingrens)
const KLEIN = 5;
function kleineAantallen(u) {
  const DELEN = ['opNaam', 'eigenaarToken', 'gedeeld'];   // zouZakken is hun som
  const weg = (r, v) => { r[v] = null; r.klein = TE_KLEINE_GROEP; };
  u.werklijst = (u.werklijst || []).map(r => {
    const uit = Object.assign({}, r);
    for (const v of uitvoeren.SOORTEN.concat(['zouZakken'])) if (uit[v] > 0 && uit[v] < KLEIN) weg(uit, v);
    /* TERUGREKENEN (B4): zouZakken = opNaam + eigenaarToken + gedeeld. Is een
       deel weg, dan gaat de som ook weg -- anders is het deel som min de rest. */
    if (DELEN.some(v => uit[v] === null)) weg(uit, 'zouZakken');
    return uit;
  });
  /* COMPLEMENTAIRE ONDERDRUKKING: per klasse staan totalen. Is er in een klasse
     iets weg, dan is het terug te rekenen uit totaal min de zichtbare cellen --
     ook via een rij-som. Dus gaan in die klasse ALLE totalen weg, en daarmee de
     totalen bovenaan. Wat dan nog zichtbaar is, zijn losse cellen die nergens
     samen een vergelijking vormen met een verborgen cel. */
  const pk = u.perKlasse || {};
  let totaalWeg = false;
  for (const k of Object.keys(pk)) {
    if (!u.werklijst.some(r => r.klasse === k && r.klein)) continue;
    const t = Object.assign({}, pk[k], { klein: TE_KLEINE_GROEP });
    for (const v of uitvoeren.SOORTEN.concat(['zouZakken', 'waarnemingen'])) t[v] = null;
    pk[k] = t; totaalWeg = true;
  }
  if (totaalWeg) { u.zouZakken = null; u.waarnemingen = null; }
  u.kleineAantallen = { grens: KLEIN, stand: TE_KLEINE_GROEP,
    uitleg: 'In de werklijst staat een aantal onder de ' + KLEIN + ' niet als getal: per route kan dat over een mens gaan. ' +
      'Ook wat er uit de rest terug te rekenen is (een som, een klassetotaal) blijft binnen.' };
  return u;
}

/* Drie bakken en geen percentage, en de rijpheid per deur apart: een deur die
   rijp is en nul keer oneens, kan verhuizen; de rest niet. */
const stand = function stand({ beeld, dagen, sinds, oneens, verklaardOpen, kleinBinnen }) {
  const perDeur = {};
  const zonderPoort = [];
  const stapop = [];
  const gebruik = {};
  const uitvoerRijen = [];
  /* Wat over een plafond liep (../kantoor/mensdeur-spoel.js): geteld en
     zichtbaar, en nooit als een deur of een route gelezen. */
  const overgelopen = { deuren: 0, uitvoer: 0 };
  for (const r of Object.values(beeld)) {
    if (r.pad === 'overig') { overgelopen.deuren += r.overgelopen || 0; continue; }
    if (r.pad === uitvoeren.VOORVOEGSEL + 'overig') { overgelopen.uitvoer += r.overgelopen || 0; continue; }
    if (r.pad.startsWith(uitvoeren.VOORVOEGSEL)) { uitvoerRijen.push(r); continue; }
    if (r.pad.startsWith('werkwoord ') || r.pad.startsWith('kamer ') || r.pad.startsWith('export ')) { gebruik[r.pad] = r.gebruik || 0; continue; }
    if (r.pad.startsWith('stapop ')) {
      const [, deur, ...rest] = r.pad.split(' ');
      stapop.push({ deur, route: rest.join(' '), keer: r.eigenaarZonderStapop || 0 });
      continue;
    }
    if (r.pad.startsWith('geen-poort ')) {
      zonderPoort.push({ route: r.pad.slice(11), keer: r.zonderPoort || 0 });
      continue;
    }
    const deur = r.pad.split(' ')[0];
    const d = perDeur[deur] || (perDeur[deur] = { eens: 0, oneens: 0, onbekend: 0, routes: 0 });
    d.eens += r.eens || 0; d.oneens += r.oneens || 0; d.onbekend += r.onbekend || 0; d.routes += 1;
  }
  const deuren = Object.keys(DEUREN).map(deur => {
    const d = perDeur[deur] || { eens: 0, oneens: 0, onbekend: 0, routes: 0 };
    const waarnemingen = d.eens + d.oneens;
    const tekort = [];
    if (waarnemingen < RIJP.minWaarnemingen) tekort.push(waarnemingen + ' van ' + RIJP.minWaarnemingen + ' waarnemingen');
    if (dagen < RIJP.minDagen) tekort.push(dagen + ' van ' + RIJP.minDagen + ' dagen in dit proces');
    return Object.assign({ deur, poort: DEUREN[deur].poort, eisen: DEUREN[deur].eisen }, d, {
      kanVerhuizen: !tekort.length && d.oneens === 0,
      waarom: d.oneens ? d.oneens + ' keer oneens; eerst verklaren en repareren'
        : (tekort.length ? 'nog niet rijp: ' + tekort.join(', ') : 'rijp, en nooit oneens') });
  });
  return {
    uitleg: 'De beleidsmotor loopt in de schaduw mee met de vier kantoordeuren (AUTHORITY.md fase 1, besluiten A1 en A3). ' +
      'Hij houdt niets tegen.',
    grens: 'Een teller en geen journaal. De schaduw bewijst dat de SAMENSTELLING van de regels gelijk is aan die van de ' +
      'poorten; de feiten lezen dezelfde bronnen, dus een fout in een bron zit aan beide kanten. ONBEKEND is geen WEIGEREN.',
    rijp: RIJP, meetSinds: new Date(sinds).toISOString(),
    rijpheidNoot: 'De dagen tellen sinds dit proces startte; de getallen zelf blijven over herstarts staan.',
    deuren,
    overgelopen,
    feiten: FEITEN,
    oneens: oneens.slice(),
    zonderPoort: zonderPoort.sort((a, b) => b.keer - a.keer).slice(0, 100),
    zonderPoortTotaal: zonderPoort.length,
    /* Besluit A2 in de schaduw: waar de eigenaar door een gevoelige deur ging
       zonder stap-op. Zodra dit afdwingt, vraagt elk van deze een passkey en een
       reden -- ook van hem. */
    eigenaarZonderStapop: stapop.sort((a, b) => b.keer - a.keer).slice(0, 100),
    stapopDeuren: STAPOP_DEUREN,
    verklaardOpen,
    /* FASE 4 in de schaduw: de boardroom als werkruimte met werkwoorden, en de
       kamers met hun soort. Alleen hoe vaak; wie welk werkwoord krijgt is een
       besluit van de eigenaar, en daar bestaat nog geen zetel voor. */
    werkwoorden: Object.keys(WERKWOORDEN).map(w => ({ werkwoord: w, trede: WERKWOORDEN[w].trede,
      uitleg: WERKWOORDEN[w].uitleg, gebruik: gebruik['werkwoord ' + w] || 0 })),
    zonderWerkwoord: gebruik['werkwoord (geen)'] || 0,
    kamers: Object.keys(KAMERSOORT).map(k => ({ kamer: k, soort: KAMERSOORT[k],
      kanBevoegdheidDragen: KAMERSOORT[k] === 'bestuurlijk', gebruik: gebruik['kamer ' + k] || 0,
      /* stap twee: door wie er zit, niet door wie (werkwoorden.js, kamerTelling) */
      naarToewijzing: Object.fromEntries(['eigen', 'vreemd', 'zonderToewijzing', 'onbekend']
        .map(s => [s, gebruik['kamer ' + k + ' ' + s] || 0])) })),
    /* BESLUIT 3b: ENFORCE_EXECUTE in de schaduw -- welke uitvoerende routes
       bij afdwingen zouden zakken, per klasse. Telt alleen (./uitvoeren.js). */
    uitvoeren: kleinBinnen ? kleineAantallen(uitvoeren.lees(uitvoerRijen)) : uitvoeren.lees(uitvoerRijen),
    /* FASE 6: lezen is niet exporteren. Hoe vaak een bestand het huis verliet. */
    exporten: Object.keys(EXPORTEN).map(r => Object.assign({ route: r }, EXPORTEN[r], { geleverd: gebruik['export ' + r] || 0 }))
  };
};
module.exports = stand;
module.exports.kleineAantallen = kleineAantallen;
module.exports.KLEIN = KLEIN;
