/* Het Privekantoor, deelbestand "collectie": wat een verzameling tot een
   verzameling maakt.

   Cellier en Garde-robe wisten WAT u heeft. Het Bezittingenregister wist wat het
   waard is. Wat geen van drieen wist, is het enige dat bij kunst, horloges en
   sieraden echt telt:

     herkomst    van wie naar wie, en wanneer. Provenance is bij een doek geen
                 aardigheid maar het halve bewijs van echtheid, en het is precies
                 wat er ontbreekt als het jaren later verkocht moet worden.
     taxaties    niet EEN bedrag maar een REEKS, met wie hem deed. Een waarde
                 zonder datum en zonder taxateur is een gok met twee decimalen.
     conditie    de staat, en wanneer iemand daar voor het laatst naar keek.
     standplaats waar het nu is. Klinkt overbodig tot er dertig stukken zijn en
                 er een op bruikleen staat.
     bruikleen   aan wie, van wanneer tot wanneer, en of het terug is.

   HET HANGT AAN HET REGISTER EN VERVANGT HET NIET. Net als de woningtweeling:
   het object zelf staat in het Bezittingenregister, dit is het dossier eronder.
   Een dossier voor een object dat daar niet staat, kan hier niet bestaan.

   DRIE DATUMS GAAN NAAR DE CONTROL TOWER, en dat is waarom dit meer is dan een
   invulformulier: de volgende taxatie, het einde van een bruikleen, en de
   volgende conditiecontrole. Een stuk dat drie jaar bij iemand anders staat
   zonder dat er ooit iets over terugkomt, is hoe verzamelingen krimpen.

   Gemount via ./index.js. */
'use strict';

// alleen deze soorten uit het register krijgen een collectiedossier
const SOORTEN = new Set(['kunst', 'horloge', 'sieraad']);
const STATEN = ['uitstekend', 'goed', 'redelijk', 'restauratie nodig'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum, getal } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');

  function stukken(key) {
    /* VREEMDE SECTIE: `bezittingen` is van kern/lifestyle. */
    return levens.leesVeld(key, 'bezittingen').filter(b => SOORTEN.has(b.soort));
  }
  function C(key, bezitId, maak) {
    if (!stukken(key).some(b => b.id === bezitId)) return null;
    const co = levens.veld(key, 'collectie');
    if (!co[bezitId]) {
      if (!maak) return { herkomst: [], taxaties: [], bruikleen: [], conditie: {}, standplaats: {} };
      co[bezitId] = { herkomst: [], taxaties: [], bruikleen: [], conditie: {}, standplaats: {} };
    }
    const d = co[bezitId];
    for (const v of ['herkomst', 'taxaties', 'bruikleen']) if (!Array.isArray(d[v])) d[v] = [];
    for (const v of ['conditie', 'standplaats']) if (!d[v] || typeof d[v] !== 'object') d[v] = {};
    return d;
  }
  const dossierVan = (key, id) => {
    return levens.leesVeld(key, 'collectie')[id] || { herkomst: [], taxaties: [], bruikleen: [], conditie: {}, standplaats: {} };
  };
  const geenStuk = { status: 404, error: 'Dit stuk staat niet als kunst, horloge of sieraad in uw register.' };

  function colHerkomst(key, x) {
    const d = C(key, String(x.bezitId || ''), true);
    if (!d) return geenStuk;
    const naar = schoon(x.naar, 100);
    if (!naar) return { status: 400, error: 'Naar wie ging het?' };
    if (d.herkomst.length >= 100) return { status: 400, error: 'De herkomstketen is vol.' };
    d.herkomst.push({ id: rid(), van: schoon(x.van, 100), naar,
      op: isDatum(x.op) ? x.op : '', hoe: schoon(x.hoe, 60), notitie: schoon(x.notitie, 300) });
    // de keten leest van oud naar nieuw; dat is de volgorde waarin je hem toont
    d.herkomst.sort((a, b) => String(a.op).localeCompare(String(b.op)));
    save();
    return { status: 200, ok: true };
  }
  function colHerkomstWeg(key, x) {
    const d = C(key, String(x.bezitId || ''), false); if (!d) return geenStuk;
    d.herkomst = d.herkomst.filter(y => y.id !== x.id); save(); return { status: 200, ok: true };
  }

  function colTaxatie(key, x) {
    const d = C(key, String(x.bezitId || ''), true);
    if (!d) return geenStuk;
    const door = schoon(x.door, 100);
    if (!door) return { status: 400, error: 'Wie heeft getaxeerd? Een bedrag zonder taxateur leggen wij niet vast.' };
    if (d.taxaties.length >= 100) return { status: 400, error: 'Er staan al veel taxaties.' };
    d.taxaties.unshift({ id: rid(), door, op: isDatum(x.op) ? x.op : new Date().toISOString().slice(0, 10),
      bedrag: getal(x.bedrag, 1e11), volgende: isDatum(x.volgende) ? x.volgende : '',
      notitie: schoon(x.notitie, 300) });
    save();
    return { status: 200, ok: true };
  }
  function colTaxatieWeg(key, x) {
    const d = C(key, String(x.bezitId || ''), false); if (!d) return geenStuk;
    d.taxaties = d.taxaties.filter(y => y.id !== x.id); save(); return { status: 200, ok: true };
  }

  function colConditie(key, x) {
    const d = C(key, String(x.bezitId || ''), true);
    if (!d) return geenStuk;
    d.conditie = { staat: STATEN.includes(x.staat) ? x.staat : 'goed',
      gezienOp: isDatum(x.gezienOp) ? x.gezienOp : new Date().toISOString().slice(0, 10),
      volgende: isDatum(x.volgende) ? x.volgende : '', notitie: schoon(x.notitie, 300) };
    if (x.waar !== undefined) d.standplaats = { waar: schoon(x.waar, 100), sinds: nu() };
    save();
    return { status: 200, ok: true };
  }

  /* Uitlenen en terugkrijgen. `tot` is verplicht: een bruikleen zonder einddatum
     is een schenking waar niemand voor heeft getekend. */
  function colBruikleen(key, x) {
    const d = C(key, String(x.bezitId || ''), true);
    if (!d) return geenStuk;
    const aan = schoon(x.aan, 100);
    if (!aan) return { status: 400, error: 'Aan wie leent u het uit?' };
    if (!isDatum(x.tot)) return { status: 400, error: 'Tot wanneer? Zonder einddatum leggen wij een bruikleen niet vast.' };
    if (d.bruikleen.length >= 100) return { status: 400, error: 'De lijst is vol.' };
    d.bruikleen.unshift({ id: rid(), aan, van: isDatum(x.van) ? x.van : new Date().toISOString().slice(0, 10),
      tot: x.tot, terug: '', notitie: schoon(x.notitie, 300) });
    save();
    return { status: 200, ok: true };
  }
  function colTerug(key, x) {
    const d = C(key, String(x.bezitId || ''), false); if (!d) return geenStuk;
    const b = d.bruikleen.find(y => y.id === x.id);
    if (!b) return { status: 404, error: 'Deze bruikleen staat er niet.' };
    b.terug = isDatum(x.op) ? x.op : new Date().toISOString().slice(0, 10);
    save();
    return { status: 200, ok: true, bruikleen: b };
  }

  function collectie(key, bezitId) {
    const lijst = stukken(key);
    const kop = lijst.map(b => {
      const d = dossierVan(key, b.id);
      const uit = d.bruikleen.filter(x => !x.terug);
      return { id: b.id, naam: b.naam, soort: b.soort, waarde: b.waarde,
        taxaties: d.taxaties.length, herkomst: d.herkomst.length,
        staat: d.conditie.staat || '', waar: uit.length ? 'bij ' + uit[0].aan : (d.standplaats.waar || ''),
        uitgeleend: uit.length > 0 };
    });
    if (!bezitId) return { status: 200, stukken: kop, gekozen: null, staten: STATEN };
    const b = lijst.find(x => x.id === bezitId);
    if (!b) return geenStuk;
    const d = dossierVan(key, bezitId);
    return { status: 200, stukken: kop, staten: STATEN,
      gekozen: { id: b.id, naam: b.naam, soort: b.soort, waarde: b.waarde,
        herkomst: d.herkomst, taxaties: d.taxaties, conditie: d.conditie,
        standplaats: d.standplaats, bruikleen: d.bruikleen,
        // de laatste taxatie naast de registerwaarde: lopen ze uiteen, dan weet
        // u dat het register bijgewerkt moet worden
        laatsteTaxatie: d.taxaties[0] || null } };
  }

  return { collectie, colHerkomst, colHerkomstWeg, colTaxatie, colTaxatieWeg,
    colConditie, colBruikleen, colTerug, COLLECTIE_SOORTEN: [...SOORTEN], COLLECTIE_STATEN: STATEN };
};
