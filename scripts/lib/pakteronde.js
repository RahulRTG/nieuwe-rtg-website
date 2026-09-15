/* DE RONDE VAN DE PAKTE-METING -- een stand opzetten, het corpus erdoor sturen,
   per zin waarnemen. Apart van scripts/paktebetekenis.js om dezelfde reden als
   ketenwereld naast ketenbereik: het UITVOEREN van een ronde en het BEOORDELEN
   van wat eruit komt veranderen om verschillende redenen.

   DE VOLGORDE VAN HET CORPUS IS GEDRAG EN GEEN LIJST. `ja` bevestigt wat
   `bestel` heeft klaargezet, en `vergeet alles` wist de weetjes die `onthoud`
   heeft neergezet. Door elkaar husselen meet iets anders. */
'use strict';

const fs = require('fs');
const path = require('path');
const W = require('./ketenwereld');

function leesSpoorVanaf(pad, offset) {
  let tekst = '';
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { return { regels: [], eind: offset }; }
  const regels = tekst.slice(offset).split('\n').filter(Boolean)
    .map(r => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);
  return { regels, eind: tekst.length };
}

/* Een ronde. `extra` draagt het enige verschil tussen de standen (wel of geen
   model); al het andere is gelijk, anders meet je twee werelden. */
async function ronde({ standId, corpus, spoorPad, dataDir, extra }) {
  fs.writeFileSync(spoorPad, '');
  const srv = await W.startServer({
    spoorPad, dataDir,
    /* RTG_STAATLOG zet de koppen van server/effectmeter.js aan. Zonder die vlag
       staat er geen X-RTG-Effect op het antwoord en is EFFECT_BEREIKT niet waar
       te nemen -- dan meldt deze meter `null` en niet `false`. */
    /* STAND 2 EN NIET 1: stand 1 geeft alleen de LENGTE per collectie, en een
       wijziging BINNEN een rij (een weetje dat erbij komt in een bestaand
       object) verandert geen lengte. Stand 2 hangt er een hash per collectie
       aan, en dat is precies het verschil tussen "de lijst groeide" en "er is
       iets veranderd". */
    extra: Object.assign({ RTG_STAATLOG: '2' }, extra || {})
  });
  const uit = { stand: standId, waarnemingen: [] };
  let vorigeStaat = null;
  try {
    const token = await W.logIn(srv.basis);
    const ingang = W.INGANGEN.find(i => i.id === 'fluister');
    let offset = 0;
    ({ eind: offset } = leesSpoorVanaf(spoorPad, 0));   // het opstarten overslaan

    for (const geval of corpus) {
      const a = await W.stuurZin(srv.basis, token, ingang, geval.zin);
      const { regels, eind } = leesSpoorVanaf(spoorPad, offset);
      offset = eind;
      /* WELKE COLLECTIES VERANDERDEN DOOR DEZE ZIN. X-RTG-Staat staat op het
         ANTWOORD, dus hij beschrijft de stand NA afloop; het verschil met de
         vorige zin is wat deze zin deed. Daarom draait de ijkzin twee keer:
         de eerste zet de basislijn neer, de tweede meet wat een kaal antwoord
         werkelijk aanraakt. */
      const staat = ontleedStaat(a.kop('x-rtg-staat'));
      uit.waarnemingen.push({
        id: geval.id, zin: geval.zin, plek: geval.plek, stand: standId,
        status: a.status, lijf: a.lijf || {},
        effectKop: a.kop('x-rtg-effect'),
        effectNietGemeten: a.kop('x-rtg-effect-niet-gemeten'),
        staatKop: a.kop('x-rtg-staat'),
        veranderd: staat && vorigeStaat ? verschil(vorigeStaat, staat) : null,
        schakels: [...new Set(regels.map(r => r.s))]
      });
      if (staat) vorigeStaat = staat;
    }
  } finally {
    await srv.stop();
  }
  return uit;
}

/* `naam=lengte:hash,...` uit elkaar. Een ontbrekende kop geeft null en nooit
   een leeg object: "niet waargenomen" is iets anders dan "niets veranderd". */
function ontleedStaat(kop) {
  if (kop == null || kop === '') return null;
  const uit = {};
  for (const stuk of String(kop).split(',')) {
    const i = stuk.indexOf('=');
    if (i > 0) uit[stuk.slice(0, i)] = stuk.slice(i + 1);
  }
  return uit;
}

/* De collecties die tussen twee standen zijn veranderd, bij NAAM. Een naam is
   na te trekken; een getal niet. */
function verschil(oud, nieuw) {
  const namen = new Set([...Object.keys(oud), ...Object.keys(nieuw)]);
  return [...namen].filter(n => oud[n] !== nieuw[n]).sort();
}

module.exports = { ronde, leesSpoorVanaf, ontleedStaat, verschil };
