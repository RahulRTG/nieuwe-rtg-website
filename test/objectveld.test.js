/* IS AUTORISATIE TOEWIJSBAAR? -- van voornemen naar machine.

   STANDAARD.md par. 0c: *autorisatie is toewijsbaar (par. 8)* stond op "geen
   handhaver", met erachter "een poort HEBBEN is niet hetzelfde als een
   toewijsbare uitslag geven; van de 716 OBJECT_SCOPED-routes dragen er 638 er
   geen". Dit bestand is die handhaver.

   WAT DE EIS IS, EN WAAROM. `kern/mutatiecontract/klassen.js` zegt het bij de
   klasse zelf: OBJECT_SCOPED eist "welk veld het object aanwijst. Zonder dat is
   de route niet te beproeven zonder een tweede eigenaar, en dat is een
   IDOR-proef en geen idempotentieproef." Twee mensen met dezelfde rol horen hier
   een ander antwoord te krijgen, en zonder het veld kan niemand nagaan waarop
   dat verschil dan hangt.

   HET GETAL 638 KLOPTE NIET MEER, EN DE WEG ERNAARTOE IS LEERZAAM. Nagemeten op
   4 september 2026 waren het er 47, niet 638. En van die 47 verdwenen er 29
   zodra de meting op de juiste plek keek: de spelroutes komen uit een LUS
   (`app.post('/api/rtf/spel/' + naam, ...)`), hebben daarom geen bewaker in de
   routetabel, en hangen allemaal achter rtfSpeler() -- die precies dezelfde
   profielcontrole doet als gezinsPoort. Ze hadden hun deur dus altijd al; de
   lezer keek ernaast. Zelfde vorm als de zeven "onvindbare bronnen" bij
   keuringsregel 28.

   Wat overblijft is 18, en die staan hieronder met naam. Een gat dat verdwijnt
   zodra je het goed bekijkt is een meetfout; wat daarna overblijft is echt.

   DE LIJST MAG ALLEEN KRIMPEN. Dat is het huispatroon (BEKEND in
   scripts/check.js regel 45) en het werkt twee kanten op: een nieuwe
   OBJECT_SCOPED-route zonder objectveld zakt meteen, en wie er een oplost moet
   hem van de lijst halen -- anders slijt de lijst en bewaakt hij op een dag
   niets meer.

   Draai los: node --test test/objectveld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const register = require(path.join(WORTEL, 'MUTATIECONTRACT.json'));
const handlerpoorten = require(path.join(WORTEL, 'server/kern/handlerpoorten'));
const { CONTRACTEN } = require(path.join(WORTEL, 'server/lib/mutatiecontracten'));

/* De achttien die vandaag geen objectveld hebben. Geen van alle is een bewezen
   lek -- ze zijn ONBEPAALD, en dat is het punt: van deze routes kan niemand
   zeggen waarop het verschil tussen twee eigenaren hangt. Ze clusteren in drie
   families (de uitnodigingen van gezin en school, de sollicitatiekant van de
   RTFoundation) plus drie losse. */
const NOG_ZONDER = [
  'POST /api/aanmeld/zeg',
  'POST /api/auth/reset',
  'POST /api/foundation/gezin/uitnodiging/accepteer',
  'POST /api/foundation/gezin/uitnodiging/bekijk',
  'POST /api/foundation/gezin/uitnodiging/intrek',
  'POST /api/foundation/gezin/uitnodiging/maak',
  'POST /api/foundation/kosten',
  'POST /api/foundation/mail/lees',
  'POST /api/foundation/mail/stuur',
  'POST /api/foundation/school/personeel/inlog/accepteer',
  'POST /api/foundation/school/personeel/uitnodiging/accepteer',
  'POST /api/foundation/school/personeel/uitnodiging/bekijk',
  'POST /api/foundation/school/school/activeren',
  'POST /api/rtf/apply/chat',
  'POST /api/rtf/apply/chat/send',
  'POST /api/rtf/solliciteer',
  'POST /api/rtf/talent/interesse',
  'POST /api/sso/wissel'
];

/* De vier bronnen waaruit een objectveld mag komen, in dezelfde volgorde als
   scripts/effectcontracten.js ze leest. Twee lezers van dezelfde waarheid lopen
   uiteen (LAT.md regel 4), dus dit hoort op termijn EEN functie te zijn; zolang
   dat niet zo is, staat hier letterlijk dezelfde ketting. */
function objectVeldVan(rij) {
  const t = rij.toegang || {};
  const uh = String(t.uitHandler || '');
  if (uh.startsWith('object: ')) return uh.slice(8);
  const c = CONTRACTEN[rij.route];
  if (c && c.toegang && c.toegang.objectVeld) return c.toegang.objectVeld;
  const viaBewaker = (t.bewakers || []).map(n => handlerpoorten.veldVanBewaker(n)).find(Boolean);
  if (viaBewaker) return viaBewaker;
  return handlerpoorten.veldVanPad(rij.route.replace(/^[A-Z]+ /, ''));
}

function objectRoutes() {
  return (register.rijen || []).filter(r => {
    const t = r.toegang || {};
    return t.waargenomen === 'OBJECT_SCOPED' || t.bedoeld === 'OBJECT_SCOPED';
  });
}

test('1. er zijn genoeg OBJECT_SCOPED-routes om iets te bewijzen', () => {
  const n = objectRoutes().length;
  assert.ok(n > 500,
    'er horen honderden objectgebonden routes te zijn; ' + n + ' is te weinig -- dan leest deze ' +
    'toets het register niet goed en zou hij groen staan zonder iets te meten');
});

test('2. geen NIEUWE objectgebonden route zonder objectveld', () => {
  const zonder = objectRoutes().filter(r => !objectVeldVan(r)).map(r => r.route).sort();
  const nieuw = zonder.filter(r => !NOG_ZONDER.includes(r));
  assert.deepEqual(nieuw, [],
    'deze objectgebonden route(s) zeggen niet welk veld het object aanwijst. Zonder dat is niet na ' +
    'te gaan waarop het verschil tussen twee eigenaren hangt, en is de route alleen met een ' +
    'IDOR-proef te beproeven:\n  ' + nieuw.join('\n  ') +
    '\nZet het veld in het contract (toegang.objectVeld), in de bewaker (ROUTERPOORTEN) of in de ' +
    'familie (FAMILIES) -- afhankelijk van waar de deur werkelijk hangt.');
});

test('3. de lijst slijt niet: wie er een oplost, haalt hem eraf', () => {
  const zonder = objectRoutes().filter(r => !objectVeldVan(r)).map(r => r.route);
  const opgelost = NOG_ZONDER.filter(r => !zonder.includes(r));
  assert.deepEqual(opgelost, [],
    'deze route(s) staan nog op NOG_ZONDER maar dragen inmiddels wel een objectveld. Haal ze van ' +
    'de lijst; een lijst die niet krimpt als het werk gedaan is, bewaakt op een dag niets meer:\n  ' +
    opgelost.join('\n  '));
});

test('4. elke route op de lijst bestaat nog', () => {
  const alle = new Set((register.rijen || []).map(r => r.route));
  const weg = NOG_ZONDER.filter(r => !alle.has(r));
  assert.deepEqual(weg, [],
    'deze route(s) staan op de lijst maar bestaan niet meer. Een lijst met dode namen geeft een ' +
    'vals gevoel van omvang:\n  ' + weg.join('\n  '));
});
