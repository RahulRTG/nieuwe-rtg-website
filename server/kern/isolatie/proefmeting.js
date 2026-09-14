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

/* DE VIJF OPSLAGBEELDEN staan niet meer in een lijst hierboven, en dat is de kern
   van de reparatie van 14 september 2026: elk beeld hoort bij een EIGEN oproep met
   een eigen status, dus horen die twee bij elkaar te staan. Een vlakke lijst maakte
   het onmogelijk om te zien welke oproep een beeld had achtergelaten -- zie de lus
   in lees() en de uitleg daarboven. */

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
       weggooien, en dit register wordt strenger naarmate het meer ziet.

       MAAR ALLEEN UIT EEN OPROEP DIE ER BIJ KWAM, en dat is de regel die in de kop
       van dit bestand al stond en hier niet werd toegepast: "een oproep die met 404
       eindigde bewijst niets over de route, alleen dat de proef er niet bij kwam".
       Het LEZERSCHAP hieronder eist een 2xx; de collecties namen alles mee.

       WAT DAT KOSTTE (gemeten op 14 september 2026). /api/aandacht gaf drie keer 404
       ("Zaak niet gevonden") en droeg 27 collecties, want de proef meet tegen EEN
       server en om die route heen gebeurde ondertussen alles. Daaruit leidde
       ./effecten.js vier effecten af met graad `afgeleid`: IDENTITEIT_WIJZIGEN,
       EXTERN_BEREIKEN, SCHRIJVEN_ANDERMANS en VERTROUWENSRELATIE_AANGAAN -- over een
       handeling die aantoonbaar niet heeft plaatsgevonden. kern/stuur/gevolg.js zei
       over datzelfde pad `onbekend` met de reden erbij; twee lezers van hetzelfde
       register die iets anders zeggen over dezelfde route, en dat is LAT.md regel 4
       op de dag zelf in plaats van over een jaar.

       PER BEELD EN NIET PER RIJ, want de rondes hebben eigen statussen: a/b/c horen
       bij `statussen`, d/e bij die van de kale ronde. Een route die met een sleutel
       slaagt en zonder sleutel strandt, houdt zo wat hij werkelijk aanraakte.

       DE RICHTING VAN DE TWIJFEL. Schrijft een route iets en geeft hij daarna een
       4xx, dan valt die waarneming hier weg. Dat is de strenge kant op -- geen
       afgeleid effect -- en precies wat de kop hieronder over verouderen zegt: deze
       laag hoort strenger te worden als zij minder zeker weet, nooit losser. */
    const OK = (st) => typeof st === 'number' && st >= 200 && st < 300;
    const raakte = collectiesVan.get(rij.pad) || new Set();
    const sleutelStatus = rij.statussen || [];
    const kaleStatus = z.statussen || [];
    for (const [s, bron, status] of [
      ['a', (rij.opslag || {}).a, sleutelStatus[0]],
      ['b', (rij.opslag || {}).b, sleutelStatus[1]],
      ['c', (rij.opslag || {}).c, sleutelStatus[2]],
      ['d', (z.opslag || {}).d, kaleStatus[0]],
      ['e', (z.opslag || {}).e, kaleStatus[1]]
    ]) {
      if (!bron || !OK(status)) continue;
      for (const naam of Object.keys(bron)) raakte.add(naam);
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
