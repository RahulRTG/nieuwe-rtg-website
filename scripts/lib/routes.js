/* Elke route die de server aanbiedt, uit de BRON gelezen.

   Waarom uit de bron en niet uit een draaiende server: express geeft zijn
   routetabel niet betrouwbaar prijs zodra er routers en mounts in het spel zijn,
   en we willen ook de plek weten (bestand:regel) om er iets zinnigs over te
   kunnen zeggen. De bron is bovendien de enige plek waar de MIDDLEWARE naast de
   route staat, en dat is bij een beveiligingsvraag het interessantste veld.

   Twee gebruikers, en die horen dezelfde lijst te zien:
   - scripts/onbetreden.js, dat telt wat nergens wordt aangeraakt;
   - de trede "de dwaler" in scripts/ladder/beveiliging.js, die elke route
     zonder token aanklopt.
   Zou elk zijn eigen scanner hebben, dan lopen ze op den duur uiteen en meet de
   een iets anders dan de ander -- de dubbele-waarheid-fout die in deze codebase
   al vaker duur was. */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

function loopMap(map, filter, doe) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      if (/^(node_modules|\.git|data|dist)$/.test(naam)) continue;
      loopMap(p, filter, doe);
    } else if (filter.test(naam)) doe(p);
  }
}

/* De registratie EN alles wat er tussen de haakjes achter staat, want daar
   staan de middlewares. `app.post('/api/x', auth, (req,res) => ...` levert dus
   niet alleen het pad maar ook 'auth'. We lezen tot de eerste haakjesopening van
   de handler of het einde van de regel -- genoeg om de bewakers te zien, en
   ruim genoeg om niet op een meerregelige handler te stuklopen. */
const ROUTE_RE = /\b(app|router)\.(post|get|put|delete|patch)\(\s*(['"`])([^'"`]+)\3([^\n]*)/g;

const BEWAKERS = ['auth', 'supplierAuth', 'officeAuth', 'staffAuth', 'techAuth', 'scimAuth',
  'kantoorAuth', 'eisAccount', 'lid', 'managerOnly', 'adminOnly', 'rem('];

/* DE REGISTRATIES IN EEN ENKEL BESTAND, uit zijn brontekst.

   Apart van alleRoutes() omdat scripts/deltapoort.js een bestand moet lezen dat
   NIET op de schijf staat: de vorige versie ervan, uit `git show`. Wie alleen
   over de werkmap kan scannen, kan geen verschil zien tussen wat er stond en
   wat er nu staat -- en dat verschil is precies wat een poort op nieuw werk
   nodig heeft. Dezelfde uitdrukking, dezelfde velden, een andere invoer. */
function routesInBron(tekst, bestandNaam) {
  const uit = [];
  let m;
  ROUTE_RE.lastIndex = 0;
  while ((m = ROUTE_RE.exec(tekst))) {
    const pad = m[4];
    if (!pad.startsWith('/')) continue;
    const staart = m[5] || '';
    uit.push({
      methode: m[2].toUpperCase(),
      pad,
      viaRouter: m[1] === 'router',
      bestand: bestandNaam || '?',
      regel: tekst.slice(0, m.index).split('\n').length,
      bewakers: BEWAKERS.filter(b => staart.includes(b)),
      rauw: staart.trim().slice(0, 160)
    });
  }
  return uit;
}

function alleRoutes() {
  const uit = [];
  const gezien = new Set();
  loopMap(path.join(WORTEL, 'server'), /\.js$/, f => {
    const tekst = fs.readFileSync(f, 'utf8');
    let m;
    ROUTE_RE.lastIndex = 0;
    while ((m = ROUTE_RE.exec(tekst))) {
      const pad = m[4];
      if (!pad.startsWith('/')) continue;
      const sleutel = m[2].toUpperCase() + ' ' + pad;
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      const staart = m[5] || '';
      uit.push({
        methode: m[2].toUpperCase(),
        pad,
        viaRouter: m[1] === 'router',
        bestand: path.relative(WORTEL, f).replace(/\\/g, '/'),
        regel: tekst.slice(0, m.index).split('\n').length,
        // welke bewakers staan er letterlijk achter het pad
        bewakers: BEWAKERS.filter(b => staart.includes(b)),
        rauw: staart.trim().slice(0, 160)
      });
    }
  });
  return uit.sort((a, b) => a.pad.localeCompare(b.pad));
}

/* DE GROTE HENDEL. De platformbrede schakelkast zet functies aan en uit voor de
   HELE server. Een proef die daar rommel heen stuurt, zet onderweg iets uit en
   meet daarna een platform dat hij zelf half heeft afgebroken -- elke bevinding
   erna is dan een gevolg van de proef en niet van de code.

   Deze lijst stond in scripts/beproeving.js en had de invoerproef net zo hard
   nodig. Twee kopieen van "wat mag je niet omzetten" lopen uiteen, en de eerste
   die achterloopt vergiftigt stil een hele ronde (LAT.md, regel 4). */
const SCHAKELPADEN = [
  '/api/office/boardroom/alles', '/api/office/boardroom/fase', '/api/office/boardroom/functie',
  '/api/office/boardroom/functie/zet', '/api/office/leveranciers', '/api/office/geld'
];
const isSchakel = (pad) => SCHAKELPADEN.some(p => String(pad || '').startsWith(p));

module.exports = { alleRoutes, routesInBron, WORTEL, loopMap, BEWAKERS, SCHAKELPADEN, isSchakel };
