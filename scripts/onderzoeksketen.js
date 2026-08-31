#!/usr/bin/env node
/* DE ONDERZOEKSKETEN GEMETEN -- welke stations van het onderzoek weten van
   elkaar, en welke niet.

   WAAROM DIT EEN METING IS EN GEEN ONTWERP. Het voorstel op tafel is één
   `research_id` die van een buurtvraag tot een publicatie meereist. Dat is
   precies de vorm waarin `Asset` hier een keer sneuvelde (DEVELOPERCLOUD.md
   par. 2): een begrip dat over de domeinen heen wordt VERKLAARD in plaats van
   erin gevonden. Een identiteit die tien stations moeten dragen terwijl er zes
   niet van elkaar weten, levert zes plekken op waar hij stil `null` is -- en dan
   is de keten een belofte in plaats van een spoor.

   Dus eerst tellen: welk station noemt welk ander station al? Het antwoord
   bepaalt of de id ergens GEVONDEN wordt, of dat er eerst schakels moeten worden
   gelegd -- en welke.

   HOE ER GEMETEN WORDT. Per station staan hieronder zijn bestand(en) en de
   naam waaronder ANDERE stations naar hem verwijzen. De bron wordt ontdaan van
   commentaar en tekenreeksen -- anders telt deze kop zichzelf mee -- en daarna
   wordt geteld welke verwijsnamen er in blijven staan, plus welke stations
   elkaar rechtstreeks `require`-en.

   Draai: node scripts/onderzoeksketen.js   (schrijft ONDERZOEKSKETEN.json) */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* De tien stations van de keten zoals ze in het voorstel staan, met wat ze in
   deze code ZIJN. `verwijst` is de naam waarmee een ander station naar dit
   station wijst; staat die naam nergens anders, dan bestaat de schakel niet. */
const STATIONS = [
  { id: 'buurtvraag', naam: 'Vraag uit de buurt', bestanden: ['server/kern/livinglab/themas.js'], verwijst: ['themaId', 'vraagId', 'buurtvraagId'] },
  { id: 'studie', naam: 'Studie (Living Lab)', bestanden: ['server/kern/livinglab/studie.js'], verwijst: ['studieId'] },
  { id: 'ethiek', naam: 'Ethiek en toestemming', bestanden: ['server/kern/livinglab/ethiek.js', 'server/kern/livinglab/waarborg.js'], verwijst: ['ethiekId', 'reviewId'] },
  { id: 'waarneming', naam: 'Waarnemingen', bestanden: ['server/kern/livinglab/waarnemen.js'], verwijst: ['waarnemingId', 'meting'] },
  { id: 'bewijs', naam: 'Bewijsmotor', bestanden: ['server/kern/livinglab/bewijs.js'], verwijst: ['bewijsId', 'conclusieId'] },
  { id: 'apparatuur', naam: 'Apparatuur', bestanden: ['server/kern/livinglab/apparatuur.js', 'server/kern/livinglab/apparatuurgebruik.js'], verwijst: ['apparaatId', 'kalibratieId'] },
  { id: 'doorbraak', naam: 'Uitgang / pilotvoorstel', bestanden: ['server/kern/livinglab/doorbraak.js'], verwijst: ['uitgangId', 'pilotId'] },
  /* `ctx.lab` is de naam waaronder het Onderzoekslab in het Living Lab binnenkomt
     (opzet/kernlaag2.js geeft hem als `lab` mee). Zonder deze alias mist de meting
     de enige schakel die er tussen de twee systemen WEL is -- en dan meet zij
     haar eigen blinde vlek in plaats van de code. */
  { id: 'onderzoekslab', naam: 'RTG Onderzoekslab', bestanden: ['server/kern/onderzoekslab.js'],
    verwijst: ['projectId', 'labProjectId'], aliassen: ['ctx.lab', 'projectMaak', 'logMaak'] },
  { id: 'labfonds', naam: 'Labfonds', bestanden: ['server/kern/labfonds.js'], verwijst: ['fondsId', 'voorstelId'], aliassen: ['labfonds', 'labFonds'] },
  { id: 'kosten', naam: 'Onderzoeksgrootboek', bestanden: ['server/kern/livinglab/ledger.js', 'server/kern/livinglab/ledgeradres.js'], verwijst: ['ledgerId', 'kostenId'] }
];

/* Commentaar en tekenreeksen eruit: dezelfde wringer als scripts/objectmodel.js,
   en om dezelfde reden -- een veldnaam in een uitleg is geen verwijzing. */
function kaal(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function lees(rel) {
  const p = path.join(WORTEL, rel);
  return fs.existsSync(p) ? kaal(fs.readFileSync(p, 'utf8')) : null;
}

const bronVan = {};
const ontbreekt = [];
for (const s of STATIONS) {
  const stukken = s.bestanden.map(b => ({ bestand: b, src: lees(b) }));
  for (const st of stukken) if (st.src == null) ontbreekt.push(st.bestand);
  bronVan[s.id] = stukken.filter(x => x.src).map(x => x.src).join('\n');
}

/* De matrix: noemt station A het station B? Twee manieren tellen mee en ze
   worden apart gehouden -- een `require` is een harde koppeling, een veldnaam is
   een verwijzing in de gegevens. */
const schakels = [];
for (const a of STATIONS) {
  for (const b of STATIONS) {
    if (a.id === b.id) continue;
    const src = bronVan[a.id] || '';
    const velden = b.verwijst.filter(v => new RegExp('\\b' + v + '\\b').test(src));
    const modules = b.bestanden.filter(bb => {
      const naam = path.basename(bb, '.js');
      return new RegExp("require\\([`'\"][^`'\"]*" + naam + "[`'\"]\\)").test(src)
        || new RegExp('\\bctx\\.' + naam + '\\b').test(src);
    });
    /* Een station kan ook onder een ANDERE naam binnenkomen dan zijn bestand
       (ctx.lab voor het Onderzoekslab). Die aliassen tellen als module-schakel:
       het is een aanroep en geen veld. */
    for (const al of (b.aliassen || [])) {
      if (new RegExp('\\b' + al.replace('.', '\\.') + '\\b').test(src) && !modules.includes(al)) modules.push(al);
    }
    if (velden.length || modules.length) schakels.push({ van: a.id, naar: b.id, velden, modules });
  }
}

const paren = STATIONS.length * (STATIONS.length - 1);
const gevonden = schakels.length;
const zonderUitgaand = STATIONS.filter(s => !schakels.some(k => k.van === s.id)).map(s => s.id);
const zonderInkomend = STATIONS.filter(s => !schakels.some(k => k.naar === s.id)).map(s => s.id);

/* DE KETEN ZOALS HET VOORSTEL HEM TEKENT: elk paar dat op elkaar volgt. Dit is
   de vraag die er werkelijk toe doet -- niet of alles alles kent, maar of de
   VOLGORDE aan elkaar hangt. */
const KETEN = ['buurtvraag', 'studie', 'ethiek', 'waarneming', 'bewijs', 'doorbraak', 'onderzoekslab', 'labfonds', 'kosten'];
const ketenstukken = [];
for (let i = 0; i < KETEN.length - 1; i++) {
  const van = KETEN[i], naar = KETEN[i + 1];
  const heen = schakels.find(k => k.van === van && k.naar === naar);
  const terug = schakels.find(k => k.van === naar && k.naar === van);
  ketenstukken.push({ van, naar, verbonden: !!(heen || terug),
    richting: heen && terug ? 'beide' : heen ? 'heen' : terug ? 'terug' : null,
    via: (heen || terug || {}).velden || [] });
}

/* DE HUB. Binnen het Living Lab verwijzen de stations niet naar ELKAAR maar
   allemaal naar dezelfde studie: `vindStudie(id)` en dan verder in het dossier.
   Dat is een ster en geen ketting, en het is de vorm die telt voor de vraag of
   er een research_id te vinden is. Zonder deze meting leest de matrix hierboven
   als "zes stations weten van niets", terwijl ze allemaal aan hetzelfde hangen. */
const hub = STATIONS.map(s => {
  const src = bronVan[s.id] || '';
  return { station: s.id,
    aanDeStudie: /\bvindStudie\b/.test(src) || /\bstudieId\b/.test(src),
    aanHetLab: /\bvindLab\b/.test(src) || /\blabId\b/.test(src) };
});

const uit = {
  gemeten: { op: new Date().toISOString().slice(0, 10), stations: STATIONS.length, paren, schakels: gevonden,
    ontbrekendeBestanden: ontbreekt },
  stations: STATIONS.map(s => ({ id: s.id, naam: s.naam, bestanden: s.bestanden, verwijst: s.verwijst })),
  schakels, zonderUitgaand, zonderInkomend, hub,
  keten: ketenstukken,
  ketenGesloten: ketenstukken.every(k => k.verbonden),
  let: 'Deze meting zegt welke stations NAAR ELKAAR VERWIJZEN in de code. Zij zegt niet of die verwijzing altijd gevuld is, en niet of het om hetzelfde onderzoek gaat.'
};

fs.writeFileSync(path.join(WORTEL, 'ONDERZOEKSKETEN.json'), JSON.stringify(uit, null, 2) + '\n');

console.log('DE ONDERZOEKSKETEN, GEMETEN');
console.log('  stations           : ' + STATIONS.length);
console.log('  mogelijke schakels : ' + paren);
console.log('  gevonden schakels  : ' + gevonden);
if (ontbreekt.length) console.log('  BESTANDEN WEG      : ' + ontbreekt.join(', '));
console.log('\nDE KETEN VAN HET VOORSTEL, stap voor stap:');
for (const k of ketenstukken) {
  console.log('  ' + (k.verbonden ? 'x' : ' ') + '  ' + k.van + ' -> ' + k.naar
    + (k.verbonden ? '   (' + k.richting + (k.via.length ? ' via ' + k.via.join(', ') : '') + ')' : '   GEEN SCHAKEL'));
}
console.log('\nDE HUB (hangt dit station aan de studie?):');
for (const h of hub) console.log('  ' + (h.aanDeStudie ? 'x' : ' ') + '  ' + h.station + (h.aanHetLab ? '   (en aan het lab)' : ''));
console.log('\n  keten gesloten: ' + (uit.ketenGesloten ? 'ja' : 'NEE'));
console.log('  zonder uitgaande verwijzing: ' + (zonderUitgaand.join(', ') || '-'));
console.log('  zonder inkomende verwijzing: ' + (zonderInkomend.join(', ') || '-'));
console.log('\nONDERZOEKSKETEN.json geschreven.');
