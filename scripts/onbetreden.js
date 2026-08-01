#!/usr/bin/env node
/* ============================================================================
   DE ONBETREDEN ROUTES -- wat nergens wordt aangeraakt.

   Er staan ruim tweeduizend API-routes in deze server en ruim tweehonderd
   toetsbestanden. Dat klinkt als dekking, maar het zegt niets over de VERDELING:
   de hoofdwegen zijn tien keer beproefd en er loopt een middenband doorheen die
   nergens bij naam voorkomt. Die band is onzichtbaar zolang niemand hem telt --
   en onzichtbaar is precies het probleem, want een route die niemand beproeft is
   een route waarvan niemand weet of hij dicht is.

   Deze meting doet EEN ding: ze zoekt elk routepad in server/ op als letterlijke
   tekenreeks in test/, scripts/ en public/, en meldt wat ze nergens tegenkomt.

   WAT DEZE METING WEL EN NIET BEWIJST

   Ze is bewust grof, en dat hoort erbij te staan. Een route die WEL wordt
   genoemd is niet daarmee goed beproefd -- hij kan in een toets staan die alleen
   kijkt of er geen 500 komt. En een route die NIET wordt genoemd kan best via
   een variabele worden aangeroepen ("/api/" + tak + "/lijst"); die telt hier
   onterecht als onbetreden. Het is dus geen dekkingscijfer maar een ZOEKLICHT:
   het wijst de plekken aan waar je moet gaan kijken.

   DE RANGSCHIKKING IS HET PUNT. Een onbetreden GET op een statuslijstje is iets
   anders dan een onbetreden POST die geld verplaatst. Daarom krijgt elke route
   een gewicht op grond van waar hij over gaat: geld, toegang, persoonsgegevens,
   een externe partij, of een deur die letterlijk opengaat. De lijst begint bij
   het zwaarste.

   Draai:  node scripts/onbetreden.js
           node scripts/onbetreden.js --alles      (ook de lichte)
           node scripts/onbetreden.js --groep pay  (een deel van het pad)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m', vet: '\x1b[1m' };
const arg = (n, s) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : s; };
const ALLES = process.argv.includes('--alles');
const GROEP = arg('--groep', '');

function loop(map, filter, doe) {
  let uit = [];
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      if (/^(node_modules|\.git|data|dist)$/.test(naam)) continue;
      uit = uit.concat(loop(p, filter, doe));
    } else if (filter.test(naam)) uit = uit.concat(doe(p) || []);
  }
  return uit;
}

/* ---------- 1. elke route die de server aanbiedt ---------- */
const ROUTE_RE = /\b(?:app|router)\.(post|get|put|delete|patch)\(\s*'([^']+)'/g;
const routes = new Map(); // pad -> { methode, bestand, regel }
loop(path.join(WORTEL, 'server'), /\.js$/, f => {
  const tekst = fs.readFileSync(f, 'utf8');
  const regels = tekst.split('\n');
  let m;
  while ((m = ROUTE_RE.exec(tekst))) {
    const pad = m[2];
    if (!pad.startsWith('/')) continue;
    const regel = tekst.slice(0, m.index).split('\n').length;
    // routers worden ergens gemount; het gemounte voorvoegsel zoeken we hieronder op
    const sleutel = pad;
    if (!routes.has(sleutel)) routes.set(sleutel, {
      methode: m[1].toUpperCase(), bestand: path.relative(WORTEL, f).replace(/\\/g, '/'), regel,
      viaRouter: /^\s*router\./.test(regels[regel - 1] || '')
    });
  }
});

/* ---------- 2. waar wordt een pad genoemd ---------- */
const bronnen = [];
for (const map of ['test', 'scripts', 'public']) {
  const d = path.join(WORTEL, map);
  if (!fs.existsSync(d)) continue;
  loop(d, /\.(js|html|mjs)$/, f => {
    const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
    if (rel.startsWith('public/dist/')) return; // bouwuitvoer: dezelfde bron, dubbel geteld
    bronnen.push({ rel, tekst: fs.readFileSync(f, 'utf8') });
  });
}
const toetsTekst = bronnen.filter(b => b.rel.startsWith('test/')).map(b => b.tekst).join('\n');
const chaosTekst = bronnen.filter(b => b.rel.startsWith('scripts/')).map(b => b.tekst).join('\n');
const clientTekst = bronnen.filter(b => b.rel.startsWith('public/')).map(b => b.tekst).join('\n');

/* ---------- 3. het gewicht: waar gaat deze route over ---------- */
/* Bewust op het PAD en niet op de code: het pad is wat een aanvaller ziet, en
   het is de enige beschrijving die er van elke route is. Een route die twee
   onderwerpen raakt telt het zwaarste. */
const WEEGSCHAAL = [
  [/pay|bank|betaal|munt|kassa|uitbetaal|factuur|saldo|tegoed|asset|beurs|crypto/i, 5, 'geld'],
  [/login|auth|token|sso|scim|wachtwoord|pin|verify|toegang|rol|office|techniek|admin/i, 5, 'toegang'],
  [/deur|slot|unlock|sleutel|kluis|paspoort|dossier|medisch|zorg|gezondheid/i, 5, 'fysiek of vertrouwelijk'],
  [/staff|personeel|gids|member\/find|codenaam|profiel|gezin|kind|adres|export|csv/i, 4, 'persoonsgegevens'],
  [/webhook|extern|stripe|provider|callback/i, 4, 'externe partij'],
  [/order|boeking|rit|reserv|ticket|voorraad|bestel|annuleer|refund/i, 3, 'transactie'],
  [/salon|post|chat|bericht|notif|review|foto|media|upload/i, 2, 'inhoud van gebruikers'],
];
function weeg(pad) {
  for (const [re, g, waarom] of WEEGSCHAAL) if (re.test(pad)) return { gewicht: g, waarom };
  return { gewicht: 1, waarom: 'overig' };
}

/* ---------- 4. de meting ---------- */
const rijen = [];
for (const [pad, info] of routes) {
  if (GROEP && !pad.includes(GROEP)) continue;
  /* HET PAD STAAT NERGENS TWEE KEER HETZELFDE, en dat is de valkuil van deze
     meting. De gedeelde API-client (public/shared/appshell.js) zet '/api' er
     zelf voor, dus een scherm roept '/bank/rekening' aan terwijl de server
     '/api/bank/rekening' aanbiedt. Losse apps gaan verder: public/apps/
     kantoren.html doet api('bank/incasso') en plakt daar zelf '/api/office/'
     voor. Toetsen doen het door elkaar. En een router-pad is bovendien gemount
     onder een voorvoegsel dat in het bestand zelf niet staat.

     Zoeken op alleen het volle pad meldde daardoor 508 van de 2127 routes als
     onbetreden, inclusief de complete backoffice-bank -- waar gewoon knoppen
     voor zijn. Een meting die alles rood kleurt is net zo nutteloos als een die
     alles groen kleurt: ze wordt niet gelezen. Daarom telt elke STAART van het
     pad als aanroepvorm, met een ondergrens van twee segmenten en acht tekens
     (anders raakt 'chat/send' overal toevallig). Dat is bewust de MILDE kant:
     liever een route missen dan honderd keer vals alarm. */
  const delen = pad.replace(/^\//, '').split('/');
  const naalden = [pad];
  for (let i = 0; i < delen.length - 1; i++) {
    const staart = delen.slice(i).join('/');
    if (staart.length >= 8) naalden.push(staart);
  }

  /* EEN PAD MET EEN PARAMETER STAAT NOOIT LETTERLIJK IN EEN AANROEP. De server
     kent '/gezin/:code/mij'; de client tikt '/gezin/' + code + '/mij'. Zoeken op
     de tekenreeks meldt die dus altijd als onbetreden -- dertien gezinsroutes
     met persoonsgegevens stonden zo ten onrechte rood, en dat is precies hoe een
     meting haar geloofwaardigheid verliest. Voor die paden zoeken we met een
     patroon: het vaste deel moet kloppen, op de plek van de parameter mag alles
     staan behalve een schuine streep of een aanhalingsteken. */
  const patronen = pad.includes(':')
    ? naalden.map(n => new RegExp(n.split('/').map(s =>
        s.startsWith(':') ? '[^/\'"`\\s)]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')))
    : null;
  const ergens = (tekst) => patronen
    ? patronen.some(re => re.test(tekst))
    : naalden.some(n => tekst.includes(n));
  const inToets = ergens(toetsTekst);
  const inChaos = ergens(chaosTekst);
  const inClient = ergens(clientTekst);
  if (inToets || inChaos) continue;         // ergens beproefd: niet onbetreden
  const w = weeg(pad);
  rijen.push({ pad, ...info, ...w, inClient });
}
rijen.sort((a, b) => (b.gewicht - a.gewicht) || a.pad.localeCompare(b.pad));

const zwaar = rijen.filter(r => r.gewicht >= 4);
const toon = ALLES ? rijen : zwaar;

console.log('\n' + K.vet + 'ONBETREDEN ROUTES' + K.reset + K.grijs
  + '  ' + routes.size + ' routes in server/, ' + rijen.length + ' komen nergens in test/ of scripts/ voor' + K.reset + '\n');

let vorig = null;
for (const r of toon) {
  if (r.gewicht !== vorig) {
    vorig = r.gewicht;
    const kop = r.gewicht >= 5 ? K.rood + 'ZWAAR' : r.gewicht === 4 ? K.geel + 'STEVIG' : K.grijs + 'LICHT';
    console.log('  ' + kop + K.reset + K.grijs + '  (' + r.waarom + ')' + K.reset);
  }
  console.log('    ' + r.methode.padEnd(5) + ' ' + r.pad.padEnd(46)
    + K.grijs + r.bestand + ':' + r.regel + (r.inClient ? '' : '  [ook door geen enkele client aangeroepen]') + K.reset);
}

const dood = rijen.filter(r => !r.inClient);
console.log('\n' + K.vet + 'DE UITKOMST' + K.reset);
console.log('  ' + rijen.length + ' onbetreden, waarvan ' + zwaar.length + ' over geld, toegang, gegevens of een externe partij');
console.log('  ' + dood.length + ' daarvan worden ook door GEEN ENKELE client in public/ aangeroepen'
  + K.grijs + ' -- of dood, of alleen voor machines' + K.reset);
if (!ALLES && rijen.length > toon.length)
  console.log('  ' + K.grijs + (rijen.length - toon.length) + ' lichtere routes verborgen; --alles toont ze' + K.reset);
console.log('  ' + K.grijs + 'Genoemd worden is niet hetzelfde als beproefd zijn: dit is een zoeklicht, geen cijfer.' + K.reset + '\n');

/* Deze meting BREEKT niets. Ze telt en rangschikt; wat je ermee doet is een
   besluit, geen automatisme. Een drempel invoeren zou betekenen dat iemand
   toetsen gaat schrijven om een getal te halen, en dat is precies de soort
   toets waar dit huis vandaag tachtig van heeft opgeruimd. */
process.exitCode = 0;
