/* Het Privekantoor, deelbestand "dieren": de Pet Office.

   De derde en laatste kamer die als "in aanbouw" op de plattegrond stond, en
   degene die het meest opviel: bij "wij gaan zes weken naar Ibiza" noemde de
   orkestratie het huis, de wagens, de paspoorten en de verjaardagen -- en zweeg
   over de hond. Dat is precies het soort gat waar dit product op wordt
   afgerekend, want niemand vergeet zijn eigen hond maar iedereen vergeet hem in
   een checklist.

   Per dier: wie het is, wie de dierenarts is, de documenten met hun geldigheid
   (dierenpaspoort, vaccinaties, stamboom), de zorgrondes met hun volgende
   datum, en de verzekering. Alle datums lopen langs dezelfde Control Tower als
   een polis of een keuring -- een vaccinatie die verloopt terwijl u weg bent, is
   dezelfde soort fout als een visum dat verloopt.

   EN DE VERBINDING DIE HET AF MAAKT: 'dieren' staat vanaf nu in de keten van
   orkestratie.js voor reizen en huishouden. Wie een periode opgeeft, krijgt zijn
   dieren erbij -- met de vaccinatie die er middenin valt, en met de vraag wie er
   voor ze zorgt.

   Gemount via ./index.js. */
'use strict';

const SOORTEN = ['hond', 'kat', 'paard', 'vogel', 'vis', 'overig'];
const DOCUMENTEN = ['dierenpaspoort', 'vaccinatie', 'stamboom', 'chipregistratie', 'overig'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');


  function D(key) {
    return levens.veld(key, 'dieren');
  }
  const lees = key => {
    return levens.leesVeld(key, 'dieren');
  };
  const vind = (key, id) => lees(key).find(d => d.id === id);

  function drDier(key, x) {
    const naam = schoon(x.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet hij of zij?' };
    const lijst = D(key);
    const rec = { naam, soort: SOORTEN.includes(x.soort) ? x.soort : 'overig',
      ras: schoon(x.ras, 60), geboren: isDatum(x.geboren) ? x.geboren : '',
      chip: schoon(x.chip, 40), dierenarts: schoon(x.dierenarts, 100),
      verzekerdTot: isDatum(x.verzekerdTot) ? x.verzekerdTot : '',
      /* Wie er voor het dier zorgt als u er niet bent. Dit veld is de reden dat
         de orkestratie iets zinnigs kan zeggen in plaats van alleen "u heeft een
         hond": staat er niemand, dan is dat de melding. */
      oppas: schoon(x.oppas, 100), notitie: schoon(x.notitie, 300) };
    if (x.id) {
      const d = lijst.find(y => y.id === x.id);
      if (!d) return { status: 404, error: 'Dit dier staat er niet.' };
      Object.assign(d, rec); save(); return { status: 200, ok: true };
    }
    if (lijst.length >= 100) return { status: 400, error: 'De lijst is vol.' };
    lijst.unshift(Object.assign({ id: rid(), at: nu(), documenten: [], zorg: [] }, rec)); save();
    return { status: 200, ok: true };
  }
  function drDierWeg(key, id) {
    levens.zetVeld(key, 'dieren', D(key).filter(x => x.id !== id)); save();
    return { status: 200, ok: true };
  }

  function drDocument(key, x) {
    const d = vind(key, String(x.id || ''));
    if (!d) return { status: 404, error: 'Dit dier staat niet in uw kantoor.' };
    if (!isDatum(x.tot)) return { status: 400, error: 'Tot welke datum is het geldig?' };
    if (!Array.isArray(d.documenten)) d.documenten = [];
    const rec = { soort: DOCUMENTEN.includes(x.soort) ? x.soort : 'overig', tot: x.tot,
      nummer: schoon(x.nummer, 40), notitie: schoon(x.notitie, 200) };
    if (x.docId) {
      const doc = d.documenten.find(y => y.id === x.docId);
      if (!doc) return { status: 404, error: 'Dit document staat er niet bij.' };
      Object.assign(doc, rec); save(); return { status: 200, ok: true };
    }
    if (d.documenten.length >= 30) return { status: 400, error: 'Dit dier heeft al dertig documenten.' };
    d.documenten.unshift(Object.assign({ id: rid() }, rec)); save();
    return { status: 200, ok: true };
  }
  function drDocumentWeg(key, x) {
    const d = vind(key, String(x.id || ''));
    if (!d) return { status: 404, error: 'Niet gevonden.' };
    d.documenten = (d.documenten || []).filter(y => y.id !== x.docId); save();
    return { status: 200, ok: true };
  }

  /* Een zorgronde bijschrijven: ontworming, gebit, hoefsmid, trimmen. Zelfde
     vorm als een beurt in de woningtweeling -- de historie staat bij het dier en
     de volgende datum schuift mee. */
  function drZorg(key, x) {
    const d = vind(key, String(x.id || ''));
    if (!d) return { status: 404, error: 'Dit dier staat niet in uw kantoor.' };
    const wat = schoon(x.wat, 100);
    if (!wat) return { status: 400, error: 'Wat is er gedaan of gepland?' };
    if (!Array.isArray(d.zorg)) d.zorg = [];
    if (d.zorg.length >= 200) d.zorg.pop();
    d.zorg.unshift({ id: rid(), wat, op: isDatum(x.op) ? x.op : new Date().toISOString().slice(0, 10),
      door: schoon(x.door, 80), volgende: isDatum(x.volgende) ? x.volgende : '' });
    save();
    return { status: 200, ok: true };
  }
  function drZorgWeg(key, x) {
    const d = vind(key, String(x.id || ''));
    if (!d) return { status: 404, error: 'Niet gevonden.' };
    d.zorg = (d.zorg || []).filter(y => y.id !== x.zorgId); save();
    return { status: 200, ok: true };
  }

  function dieren(key) {
    const lijst = lees(key);
    return { status: 200,
      dieren: lijst.map(d => Object.assign({}, d, {
        // de eerstvolgende zorgronde vooraan, want dat is wat je wilt zien
        volgendeZorg: (d.zorg || []).map(z => z.volgende).filter(Boolean).sort()[0] || '',
        zonderOppas: !d.oppas
      })),
      soorten: SOORTEN, documentsoorten: DOCUMENTEN,
      zonderOppas: lijst.filter(d => !d.oppas).length };
  }

  return { dieren, drDier, drDierWeg, drDocument, drDocumentWeg, drZorg, drZorgWeg,
    DIER_SOORTEN: SOORTEN };
};
