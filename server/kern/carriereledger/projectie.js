/* ============================================================================
   DE LEESKANT VAN HET CARRIERE LEDGER -- een projectie, geen tweede opslag.

   ./index.js schrijft de reeks; dit bestand leest hem. Er wordt hier NIETS
   bewaard en niets bijgewerkt: elke afgeleide (is dit feit ingetrokken, welke
   bevestigingen horen erbij, wat zit er in een kapitaal) wordt bij het lezen
   uitgerekend. Zou een intrekking een vlag op de oorspronkelijke regel zetten,
   dan was die regel herschreven -- en een ledger die zijn eigen verleden
   bijwerkt, is een verslag.

   DE BEVESTIGINGEN WORDEN MET OPZET NIET SAMENGEVAT tot een sterkste herkomst.
   "gezien door RTG" en "bevestigd door bond X" zijn twee verschillende dingen,
   en wie ze tot EEN waarde platslaat, gooit juist weg wat een carrierefeit
   bewijsbaar maakt. De lezer krijgt ze allebei, elk met wat zij wel en niet
   zegt.

   DE ENIGE ORDE IS DE TIJD. Er wordt nergens gesorteerd op gewicht, op het
   aantal bevestigingen of op kapitaal; dat zou een ranglijst zijn met een andere
   naam (CAR-05, scripts/lib/cijferopmens.js).
   ========================================================================== */
'use strict';

const R = require('./regels');

const feitVan = (rs, fid) => rs.find(r => r.id === fid && r.soort === 'feit') || null;
const weggehaald = (rs) => new Set(rs.filter(r => r.soort === 'intrekking').map(r => r.doel));

module.exports = function maakProjectie({ reeksKijk, naam }) {
  /* De projectie. Feiten op tijd, elk met zijn bevestigingen eronder en met
     `ingetrokken` AFGELEID -- niet opgeslagen, want dan zou een intrekking de
     oorspronkelijke regel herschrijven. */
  function bouw(rs) {
    const weg = weggehaald(rs);
    const uit = rs.filter(r => r.soort === 'feit').map(f => ({
      id: f.id, kapitaal: f.kapitaal, wat: f.wat, op: f.op, at: f.at,
      toelichting: f.toelichting || null,
      ingetrokken: weg.has(f.id),
      bevestigingen: rs.filter(b => b.soort === 'bevestiging' && b.feit === f.id).map(b => ({
        id: b.id, herkomst: b.herkomst, door: b.door, wat: b.wat, at: b.at,
        ingetrokken: weg.has(b.id),
        stelt: R.HERKOMST[b.herkomst].stelt, nietZegt: R.HERKOMST[b.herkomst].nietZegt
      }))
    }));
    uit.sort((a, b) => String(a.op).localeCompare(String(b.op)) || String(a.at).localeCompare(String(b.at)));
    return uit;
  }

  /* De zeven kapitalen als zeven APARTE voorraden met hun opbouw. Er staat met
     opzet geen totaal en geen percentage onder: dat getal is precies wat
     CARRIERE.md par. 4.1 afwijst, en het is ook het enige wat een lezer zou
     verleiden twee mensen naast elkaar te leggen. */
  function voorraden(feiten) {
    return R.KAPITAALNAMEN.map(k => ({ kapitaal: k, wat: R.KAPITALEN[k],
      regels: feiten.filter(f => f.kapitaal === k && !f.ingetrokken).map(f => f.id) }));
  }

  function mijn(key) {
    const rs = reeksKijk(key);
    const feiten = bouw(rs);
    return { status: 200, mens: naam(key), feiten, voorraden: voorraden(feiten),
      herkomst: R.HERKOMST, kapitalen: R.KAPITALEN, nooit: R.NOOIT };
  }

  /* Voor de deel-laag: een feit met zijn bevestigingen, zonder de rest van het
     ledger. Zie ./deel.js voor waarom dat de hele functie van deze laag is. */
  function feit(key, fid) {
    const f = bouw(reeksKijk(key)).find(x => x.id === fid);
    return f || null;
  }

  return { mijn, feit };
};

module.exports.feitVan = feitVan;
module.exports.weggehaald = weggehaald;
