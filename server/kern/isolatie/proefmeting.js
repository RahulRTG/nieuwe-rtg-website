/* DE ENIGE LEZER VAN IDEMPROEF.json in deze laag.

   Twee modules hebben hem nodig en om verschillende redenen: ./leesset.js wil
   weten WELKE paden werk deden zonder iets te veranderen, en ./effecten.js wil
   weten WELKE COLLECTIES een pad aanraakte. Allebei uit hetzelfde bestand, en
   allebei met dezelfde valkuil -- een oproep die met 404 eindigde bewijst niets
   over de route, alleen dat de proef er niet bij kwam.

   Die valkuil twee keer uitschrijven is precies waar LAT.md regel 4 over gaat:
   twee plekken die hetzelfde moeten beslissen, beslissen na een jaar iets
   anders. Hij staat hier een keer.

   HET BESTAND IS EEN BOUWARTEFACT, en dat mag hier omdat de verouderingsrichting
   klopt: wat er niet in staat, is niet gemeten, en niet-gemeten leidt in beide
   aanroepers tot de STRENGSTE uitkomst (geen bewezen lezerschap, geen afgeleid
   effect). Loopt het register achter, dan wordt de laag strenger en nooit
   losser. Zie de langere uitleg in ./leesset.js. */
'use strict';

const path = require('path');
const fs = require('fs');

const BRON = path.join(__dirname, '..', '..', '..', 'IDEMPROEF.json');

/* De sleutels waaronder de proef zijn opslagbeelden bewaart. Ze staan hier als
   lijst omdat het er in de loop van de tijd meer zijn geworden (de kale ronde
   kreeg er twee bij); een vaste greep op 'a' en 'd' zou stil de helft missen. */
const BEELDEN = ['a', 'b', 'c', 'd', 'e'];

let ingelezen = null;

function lees() {
  if (ingelezen) return ingelezen;
  let ruw = null;
  try { ruw = JSON.parse(fs.readFileSync(BRON, 'utf8')); } catch (e) { ruw = null; }
  if (!ruw || !ruw.perRoute) {
    ingelezen = { lezers: new Set(), collectiesVan: new Map(), gevonden: 0, geslaagd: 0,
      ontbreekt: 'IDEMPROEF.json is niet gelezen; er is dus geen enkele meting om op te steunen' };
    return ingelezen;
  }
  const lezers = new Set();
  const collectiesVan = new Map();
  let geslaagd = 0, totaal = 0;

  for (const rij of Object.values(ruw.perRoute)) {
    totaal++;
    const z = rij.zonderSleutel || {};

    /* De COLLECTIES komen uit beide rondes: de proef met een sleutel en de kale
       ronde eronder. Alleen de kale nemen zou de helft van de waarnemingen
       weggooien, en dit register wordt strenger naarmate het meer ziet. */
    const raakte = collectiesVan.get(rij.pad) || new Set();
    for (const s of BEELDEN) {
      for (const bron of [(rij.opslag || {})[s], (z.opslag || {})[s]]) {
        if (bron) for (const naam of Object.keys(bron)) raakte.add(naam);
      }
    }
    if (raakte.size) collectiesVan.set(rij.pad, raakte);

    /* HET LEZERSCHAP vraagt wel de kale ronde EN een geslaagde oproep. Een 404
       die niets bewoog, bewijst niets over de route. */
    const eerste = (z.statussen || [])[0];
    if (!(eerste >= 200 && eerste < 300)) continue;
    geslaagd++;
    const e = z.effect || {};
    const bewoog = Object.keys(e).filter(k => k !== 'nietGemeten').some(k => e[k] !== 'geen');
    if (!bewoog) lezers.add(rij.pad);
  }

  ingelezen = { lezers, collectiesVan, gevonden: totaal, geslaagd, ontbreekt: null };
  return ingelezen;
}

function isBewezenLezer(pad) { return lees().lezers.has(String(pad)); }
function collectiesVan(pad) { return lees().collectiesVan.get(String(pad)) || null; }
function stand() {
  const m = lees();
  return { routesInDeProef: m.gevonden, metSuccesGemeten: m.geslaagd,
    bewezenLezers: m.lezers.size, padenMetCollectie: m.collectiesVan.size,
    nooitMetSuccesGemeten: m.gevonden - m.geslaagd, ontbreekt: m.ontbreekt };
}
function vergeet() { ingelezen = null; }

module.exports = { isBewezenLezer, collectiesVan, stand, vergeet, BRON };
