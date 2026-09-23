/* DE STAND VAN DE BELEIDSMOTOR -- hoe de tellers gelezen worden.

   Deel van ./index.js. Een zuivere functie over het beeld (de opgeslagen tellers
   met de nog niet gespoelde buffer eroverheen): zij schrijft niets, en een lezing
   is dus nooit een verborgen schrijfactie. */
'use strict';

const { DEUREN, FEITEN, STAPOP_DEUREN } = require('./regels');
const { RIJP } = require('../commercie/schaduw');

/* Drie bakken en geen percentage, en de rijpheid per deur apart: een deur die
   rijp is en nul keer oneens, kan verhuizen; de rest niet. */
module.exports = function stand({ beeld, dagen, sinds, oneens, verklaardOpen }) {
  const perDeur = {};
  const zonderPoort = [];
  const stapop = [];
  for (const r of Object.values(beeld)) {
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
    feiten: FEITEN,
    oneens: oneens.slice(),
    zonderPoort: zonderPoort.sort((a, b) => b.keer - a.keer).slice(0, 100),
    zonderPoortTotaal: zonderPoort.length,
    /* Besluit A2 in de schaduw: waar de eigenaar door een gevoelige deur ging
       zonder stap-op. Zodra dit afdwingt, vraagt elk van deze een passkey en een
       reden -- ook van hem. */
    eigenaarZonderStapop: stapop.sort((a, b) => b.keer - a.keer).slice(0, 100),
    stapopDeuren: STAPOP_DEUREN,
    verklaardOpen
  };
};
