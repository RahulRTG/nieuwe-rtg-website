/* HET APP-CONTRACT EN DE BEWIJSBRON -- een app mag bewijs samenstellen uit een
   proef die al bestaat, en alleen als die proef het op deze code verdient.

   Wat dit bestand bewaakt, en elke regel kan zakken:

     1. Het contract is een VERKLARING en geen uitslag: er staat nergens een
        stand in (BEWEZEN, PASS). Wie PASS schrijft, maakt van een register
        administratie -- de machine verdient het, of het staat er niet.
     2. Alleen de acht bewijzen uit BETROUWBAARHEID.md, en alleen de bewijzen
        die een bronsoort mag leveren. Een ketenproef levert voltooibaar en
        niets anders; herstelbaar laten tellen op dubbele tikken zou het
        verkeerde experiment met een geldige uitslag zijn.
     3. Elke koppeling in het contract haalt de meting: de proef raakt routes
        die de ingang van de app werkelijk aanroept, en de app staat in MAPPEN.
     4. De vier uitkomsten van de bron, elk met een tegenproef: vers en dicht is
        BEWEZEN, vers en open is DEFECT, verouderd is NIET_GETEST (nooit DEFECT
        -- er is niets gemeten dat stuk was), en een kale datum is geen stempel.
     5. De telling kan de schakels niet overstemmen.
     6. Een voorvoegsel als `/api/` maakt geen koppeling (zo leken Stad en
        Betalen op alle zeven ketens te landen). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { BEWIJZEN, BRONSOORTEN, CONTRACT, ZONDER_APP } = require('../scripts/lib/appcontract');
const B = require('../scripts/lib/bewijsbron');
const reg = require('../scripts/lib/wereldregister');

const WORTEL = path.join(__dirname, '..');

const VERS = () => ({ vers: true, reden: 'gemeten op de huidige commit' });
const OUD = () => ({ vers: false, reden: 'sindsdien zijn 3 codebestand(en) gewijzigd' });
const STEMPEL = { op: '2026-09-24T10:00:00.000Z', commit: 'abc1234', boomVuil: false, instrument: 'scripts/x.js' };

function registerMet(inhoud) {
  const tekst = JSON.stringify(inhoud);
  return (rel) => (rel === 'X.json' ? tekst : null);
}
const dicht = { stempel: STEMPEL, sluit: true, telling: { stuk: 0, gebroken: 0 },
  schakels: [{ nr: 1, stand: 'gesloten', wat: 'a' }, { nr: 2, stand: 'gesloten', wat: 'b' }],
  storingen: [{ stand: 'gehouden', wat: 'dubbel' }] };

test('1. het contract draagt geen uitslag', () => {
  const tekst = fs.readFileSync(path.join(WORTEL, 'scripts', 'lib', 'appcontract.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const stand of ['BEWEZEN', 'PASS', 'GEBLOKKEERD_DOOR_DEFECT', 'NIET_GETEST']) {
    assert.ok(!tekst.includes(stand), 'het contract noemt "' + stand + '": een contract zegt welke bron mag, nooit wat hij opleverde');
  }
});

test('2. alleen de acht bewijzen, en alleen wat de bronsoort mag leveren', () => {
  const appwerkt = fs.readFileSync(path.join(WORTEL, 'scripts', 'appwerkt.js'), 'utf8');
  for (const b of BEWIJZEN) assert.ok(appwerkt.includes(b), b + ' staat niet in scripts/appwerkt.js');
  assert.equal(BEWIJZEN.length, 8, 'acht bewijzen, geen negende');
  assert.deepEqual(BRONSOORTEN.ketenproef, ['voltooibaar'], 'een ketenproef levert alleen voltooibaar');
  for (const [functie, c] of Object.entries(CONTRACT)) {
    assert.ok(typeof c.belofte === 'string' && c.belofte.length > 20, functie + ': de belofte in woorden ontbreekt');
    for (const [naam, bron] of Object.entries(c)) {
      /* belofte, en de koppeling (ingang, via, bestanden: scripts/lib/bewijsbron.js,
         ingangVan) -- gegevens over het contract, geen bewijzen. */
      if (['belofte', 'ingang', 'via', 'bestanden'].includes(naam)) continue;
      assert.ok(BEWIJZEN.includes(naam), functie + ': "' + naam + '" is geen bewijs');
      assert.ok((BRONSOORTEN[bron.soort] || []).includes(naam), functie + ': een ' + bron.soort + ' mag geen ' + naam + ' leveren');
    }
  }
  /* Tegenproef: een ketenproef die herstelbaar wil leveren, wordt geweigerd. */
  const vals = { 'link:x': { belofte: 'een belofte die lang genoeg is om te tellen', herstelbaar: { soort: 'ketenproef', register: 'X.json', instrument: 'scripts/x.js' } } };
  assert.throws(() => B.bewijsVoor('link:x', 'herstelbaar', '/apps/x.html', { contract: vals }), /mag geen herstelbaar/);
});

test('3. elke koppeling haalt de meting: de app staat in MAPPEN en de proef raakt zijn ingang', () => {
  assert.ok(Object.keys(CONTRACT).length >= 1, 'een leeg contract bewijst niets over de koppeling');
  for (const [functie, c] of Object.entries(CONTRACT)) {
    const i = functie.indexOf(':');
    const link = functie.slice(0, i) === 'link';
    const bron = link ? reg.LINKS[functie.slice(i + 1)] : null;
    /* Een tab of OS-app heeft geen adres: hij staat in de app (reg.los) en het
       contract wijst de navigatiestap en zijn eigen delen aan. */
    if (link) assert.ok(bron && bron.url, functie + ' staat niet (met een adres) in MAPPEN');
    else assert.ok(reg.los(functie).bestaat && c.ingang && c.via && Array.isArray(c.bestanden), functie + ' staat niet in de app, of mist ingang, via of bestanden');
    const ing = B.ingangVan(link ? bron.url : null, c);
    for (const [naam, b] of Object.entries(c)) {
      if (['belofte', 'ingang', 'via', 'bestanden'].includes(naam)) continue;
      assert.ok(fs.existsSync(path.join(WORTEL, b.instrument)), b.instrument + ' bestaat niet');
      const proef = B.proefRoutes(b.instrument);
      const raak = B.gedeeld(proef, ing);
      assert.ok(raak.length > 0, functie + ': ' + b.instrument + ' raakt geen route van ' + (link ? bron.url : c.bestanden.join(', ')));
    }
  }
  for (const z of ZONDER_APP) assert.ok(z.reden && z.nodig, 'een keten zonder app draagt zijn reden en wat er nodig is');
});

test('4a. vers en dicht is BEWEZEN', () => {
  const u = B.ketenUitslag('X.json', { lees: registerMet(dicht), versheid: VERS });
  assert.equal(u.status, 'BEWEZEN');
  assert.equal(u.bewijs.commit, 'abc1234');
});

test('4b. vers met een open schakel is DEFECT, en noemt de schakel', () => {
  const open = JSON.parse(JSON.stringify(dicht));
  open.schakels[1].stand = 'open';
  const u = B.ketenUitslag('X.json', { lees: registerMet(open), versheid: VERS });
  assert.equal(u.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(u.reden, /schakel 2 staat open/);
  const gebroken = JSON.parse(JSON.stringify(dicht));
  gebroken.storingen[0].stand = 'gebroken';
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(gebroken), versheid: VERS }).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('4c. verouderd is NIET_GETEST, ook als de keten toen open stond', () => {
  const open = JSON.parse(JSON.stringify(dicht));
  open.schakels[0].stand = 'stuk';
  for (const r of [dicht, open]) {
    const u = B.ketenUitslag('X.json', { lees: registerMet(r), versheid: OUD });
    assert.equal(u.status, 'NIET_GETEST', 'oud bewijs is geen bewijs, ook geen bewijs van een defect');
    assert.match(u.reden, /vervallen/);
  }
});

test('4d. een kale datum, geen stempel of geen register is NIET_GETEST', () => {
  let gevraagd = false;
  const spion = () => { gevraagd = true; return { vers: true, reden: '' }; };
  const datum = Object.assign({}, dicht, { stempel: '2026-09-19' });
  const u = B.ketenUitslag('X.json', { lees: registerMet(datum), versheid: spion });
  assert.equal(u.status, 'NIET_GETEST');
  assert.equal(gevraagd, false, 'een datum hoort versheid niet eens te bereiken: er is geen commit om te vergelijken');
  const zonder = Object.assign({}, dicht); delete zonder.stempel;
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(zonder), versheid: spion }).status, 'NIET_GETEST');
  assert.equal(B.ketenUitslag('Y.json', { lees: registerMet(dicht), versheid: VERS }).status, 'NIET_GETEST');
});

test('5. de telling kan de schakels niet overstemmen', () => {
  const liegt = JSON.parse(JSON.stringify(dicht));
  liegt.schakels[0].stand = 'open';
  liegt.telling = { schakels: 2, gesloten: 2, open: 0, stuk: 0, gebroken: 0 };
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(liegt), versheid: VERS }).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const leeg = Object.assign({}, dicht, { schakels: [] });
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(leeg), versheid: VERS }).status, 'NIET_GETEST',
    'geen schakels is geen gesloten keten');
});

test('6. een breed voorvoegsel maakt geen koppeling', () => {
  assert.equal(B.smalVoorvoegsel('/api/'), false);
  assert.equal(B.smalVoorvoegsel('/api/rtf/'), false);
  assert.equal(B.smalVoorvoegsel('/api/supplier/horeca/'), true);
  const ing = { exact: new Set(), voor: new Set(['/api/supplier/horeca/']) };
  assert.deepEqual(B.gedeeld(new Set(['/api/supplier/horeca/gang/vrij', '/api/ride/pay']), ing), ['/api/supplier/horeca/gang/vrij']);
  /* En via de echte ingangslezer: een scherm dat alleen `/api/` draagt, raakt niets. */
  const sr = { perScherm: [{ bestand: 'public/apps/breed.html', exact: [], voorvoegsels: ['/api/'] }] };
  const lees = (rel) => (rel === 'public/apps/breed.html' ? '<html></html>' : null);
  const breed = B.ingangRoutes('/apps/breed.html', { lees, schermroutes: sr });
  assert.deepEqual(B.gedeeld(new Set(['/api/ride/pay']), breed), []);
});

test('6b. een gebundeld script draagt de routes van zijn delen', () => {
  /* public/apps/office/app.js is een bundel van public/apps/office/app/*.js
     (scripts/bundel.js); de meting schrijft de paden aan de delen toe. */
  const sr = { perScherm: [{ bestand: 'public/apps/office/app/app-01.js', exact: [], voorvoegsels: ['/api/office/kantoorpakket/'] }] };
  const lees = (rel) => (rel === 'public/apps/kantoor.html' ? '<script src="/apps/office/app.js?v=1"></script>' : null);
  const ing = B.ingangRoutes('/apps/kantoor.html', { lees, schermroutes: sr });
  assert.deepEqual(B.gedeeld(new Set(['/api/office/kantoorpakket/maak', '/api/ride/pay']), ing), ['/api/office/kantoorpakket/maak']);
  /* Een gewoon script krijgt de delen van een ander niet. */
  const los = B.ingangRoutes('/apps/kantoor.html', { lees: () => '<script src="/apps/los.js"></script>', schermroutes: sr });
  assert.deepEqual(B.gedeeld(new Set(['/api/office/kantoorpakket/maak']), los), []);
});

test('7. een koppeling die de meting niet haalt, telt niet -- ook met een vers register', () => {
  const contract = { 'link:x': { belofte: 'een belofte die lang genoeg is om te tellen',
    voltooibaar: { soort: 'ketenproef', register: 'X.json', instrument: 'scripts/x.js' } } };
  const bestanden = { 'X.json': JSON.stringify(dicht), 'scripts/x.js': "roep('/api/ride/pay')", 'public/apps/x.html': '<html></html>' };
  const lees = (rel) => (rel in bestanden ? bestanden[rel] : null);
  const sr = { perScherm: [{ bestand: 'public/apps/x.html', exact: ['/api/iets/anders'], voorvoegsels: [] }] };
  const u = B.bewijsVoor('link:x', 'voltooibaar', '/apps/x.html', { contract, lees, schermroutes: sr, versheid: VERS });
  assert.equal(u.status, 'NIET_GETEST');
  assert.match(u.reden, /raakt geen enkele route/);
  /* Tegenproef: dezelfde opstelling met een gedeelde route is BEWEZEN. */
  sr.perScherm[0].exact.push('/api/ride/pay');
  assert.equal(B.bewijsVoor('link:x', 'voltooibaar', '/apps/x.html', { contract, lees, schermroutes: sr, versheid: VERS }).status, 'BEWEZEN');
});

test('8. stelSamen raakt alleen wat het contract noemt', () => {
  const r = { functie: 'link:bestaat-niet', ingang: '/apps/niets.html',
    bewijzen: { voltooibaar: { status: 'GEEN_FIXTURE', reden: 'x', bewijs: null } } };
  /* Met lege contract- en algemene lijsten: een algemene bron (ALGEMEEN) raakt
     elke rij, en die heeft zijn eigen toets in test/liegronde.test.js. */
  assert.deepEqual(B.stelSamen(r, { contract: {}, algemeen: {} }), []);
  assert.equal(r.bewijzen.voltooibaar.status, 'GEEN_FIXTURE');
});

test('9. een voltooiproef levert drie geschreven bewijzen plus het afgeleide menselijk, en een ontbrekend deel is niet gemeten', () => {
  /* Vier sinds 18 oktober 2026: menselijk wordt uit de antwoorden onder de
     storingen AFGELEID (scripts/voltooiproef.js, kop) en nooit door een
     scenario geschreven. Waarheidsgetrouw en bevoegd blijven buiten bereik:
     de proef leest geen scherm en kruist geen rol. */
  assert.deepEqual(BRONSOORTEN.voltooiproef, ['voltooibaar', 'persistent', 'herstelbaar', 'menselijk'],
    'een voltooiproef herstart en laat crashen, en leest geen scherm en kruist geen rol');
  assert.ok(!BRONSOORTEN.voltooiproef.includes('waarheidsgetrouw') && !BRONSOORTEN.voltooiproef.includes('bevoegd'));
  const vals = { 'link:x': { belofte: 'een belofte die lang genoeg is om te tellen', bevoegd: { soort: 'voltooiproef', register: 'X.json', instrument: 'scripts/x.js' } } };
  assert.throws(() => B.bewijsVoor('link:x', 'bevoegd', '/apps/x.html', { contract: vals }), /mag geen bevoegd/);
  const reg = { stempel: STEMPEL, apps: { 'link:x': { persistent: { schakels: [{ nr: 1, stand: 'gesloten', wat: 'a' }], storingen: [], telling: {}, sluit: true } } } };
  const dichtDeel = B.ketenUitslag('X.json', { lees: registerMet(reg), versheid: VERS, deel: ['apps', 'link:x', 'persistent'] });
  assert.equal(dichtDeel.status, 'BEWEZEN');
  const weg = B.ketenUitslag('X.json', { lees: registerMet(reg), versheid: VERS, deel: ['apps', 'link:x', 'herstelbaar'] });
  assert.equal(weg.status, 'NIET_GETEST', 'een bewijs dat de ronde niet mat, is niet gemeten en nooit bewezen');
  const ander = B.ketenUitslag('X.json', { lees: registerMet(reg), versheid: VERS, deel: ['apps', 'link:y', 'persistent'] });
  assert.equal(ander.status, 'NIET_GETEST', 'het deel van een ander onderdeel telt niet');
  /* Zonder deel leest de lezer het hele register als een keten: daar staan geen
     schakels, dus dat is NIET_GETEST en geen stille BEWEZEN. */
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(reg), versheid: VERS }).status, 'NIET_GETEST');
  /* En een open schakel in het deel is DEFECT, zoals bij elke keten. */
  reg.apps['link:x'].persistent.schakels.push({ nr: 2, stand: 'open', wat: 'na de herstart weg' });
  assert.equal(B.ketenUitslag('X.json', { lees: registerMet(reg), versheid: VERS, deel: ['apps', 'link:x', 'persistent'] }).status, 'GEBLOKKEERD_DOOR_DEFECT');
});

/* ---- MODUS SAMEN (eigenaarsbesluit 19 oktober 2026) ------------------------
   SAMEN, EXTERN en KETENS_ZONDER_APP zijn een verklaring; controleerSamen meet
   of de code hem waarmaakt. Hieronder elke grendel op een nagemaakt contract,
   met nagemaakte schermcode (bestandenVan + lees), zodat geen echt scherm
   hoeft te veranderen. */
const AC = require('../scripts/lib/appcontract');
const SAMENSCHERM = {
  'public/apps/geef.html': "<script>window.parent.postMessage({ rtg: 'sleep-start', object: { soort: 'reis', id: 'R1' } });</script>",
  'public/apps/neem.html': "<script>var KAN = { reis: { wat: 'x' } }; if (e.data.rtg === 'sleep-kan') {}</script>",
  'public/apps/stil.html': '<p>geen protocol</p>'
};
const samenOpties = (samen, extra = {}) => Object.assign({
  samen, extern: {}, zonderApp: [],
  functies: new Map([['link:geef', '/apps/geef.html'], ['link:neem', '/apps/neem.html'], ['link:stil', '/apps/stil.html']]),
  bestandenVan: (ingang) => ['public' + ingang],
  lees: (rel) => (rel in SAMENSCHERM ? SAMENSCHERM[rel] : (rel === 'scripts/proef.js' ? '// proef' : null))
}, extra);
const keten = (schakels, proef = { register: 'X.json', instrument: 'scripts/proef.js' }) => ({ naam: 'k', schakels, proef });

test('SAMEN: het echte contract wordt door de code gedekt, en elke keten heeft een proef', () => {
  assert.deepEqual(B.controleerSamen(), []);
  for (const k of AC.KETENS_ZONDER_APP) assert.ok(k.proef && fs.existsSync(path.join(WORTEL, k.proef.instrument)), k.naam);
});

test('SAMEN: een goed verbonden paar geeft geen bezwaar', () => {
  assert.deepEqual(B.controleerSamen(samenOpties({
    'link:geef': { uitgeeft: ['reis'], ketens: [keten(['link:geef', 'link:neem'])] },
    'link:neem': { ontvangt: ['reis'] }
  })), []);
});

test('SAMEN: een keten noemt alleen schakels die in MAPPEN bestaan', () => {
  const b = B.controleerSamen(samenOpties({ 'link:geef': { uitgeeft: ['reis'], ketens: [keten(['link:geef', 'link:bestaatniet'])] } }));
  assert.ok(b.some((x) => /link:bestaatniet, en die bestaat niet in MAPPEN/.test(x)), b.join('\n'));
  assert.ok(B.controleerSamen(samenOpties({ 'link:verzonnen': {} })).some((x) => /geen functie in MAPPEN/.test(x)));
});

test('SAMEN: elke ontvangst heeft ergens een uitgifte, of staat uitdrukkelijk in EXTERN', () => {
  const zonder = B.controleerSamen(samenOpties({ 'link:neem': { ontvangt: ['reis'] } }));
  assert.ok(zonder.some((x) => /ontvangt reis, maar geen app geeft die uit/.test(x)), zonder.join('\n'));
  assert.deepEqual(B.controleerSamen(samenOpties({ 'link:neem': { ontvangt: ['reis'] } }, { extern: { reis: 'uit een andere kalender' } })), []);
});

test('SAMEN: een opgegeven keten zonder proef, of met een proef die niet bestaat, is een bezwaar', () => {
  const zonderProef = B.controleerSamen(samenOpties({ 'link:geef': { uitgeeft: ['reis'], ketens: [{ naam: 'k', schakels: ['link:geef', 'link:neem'] }] }, 'link:neem': { ontvangt: ['reis'] } }));
  assert.ok(zonderProef.some((x) => /noemt geen proef/.test(x)), zonderProef.join('\n'));
  const weg = B.controleerSamen(samenOpties({ 'link:geef': { uitgeeft: ['reis'], ketens: [keten(['link:geef', 'link:neem'], { register: 'X.json', instrument: 'scripts/weg.js' })] }, 'link:neem': { ontvangt: ['reis'] } }));
  assert.ok(weg.some((x) => /bestaat niet/.test(x)), weg.join('\n'));
});

test('SAMEN: een verklaring die de schermcode niet waarmaakt, telt niet', () => {
  const b = B.controleerSamen(samenOpties({ 'link:stil': { uitgeeft: ['reis'], ontvangt: ['reis'] }, 'link:geef': { uitgeeft: ['reis'] } }));
  assert.ok(b.some((x) => /link:stil: verklaart uitgeeft reis/.test(x)), b.join('\n'));
  assert.ok(b.some((x) => /link:stil: verklaart ontvangt reis/.test(x)), b.join('\n'));
  /* En een soort die de objectpoort niet doorlaat (te lang) is geen soort. */
  assert.ok(B.controleerSamen(samenOpties({ 'link:geef': { uitgeeft: ['x'.repeat(40)] } })).some((x) => /geen soort die de objectpoort doorlaat/.test(x)));
});

test('SAMEN: de codemeting vergist zich niet in een soort die op een andere lijkt', () => {
  assert.equal(B.noemtSoort("sleep-start ' data-sleep=\"reisje\"", 'reis', 'sleep-start'), false);
  assert.equal(B.noemtSoort("sleep-start soort: 'reis'", 'reis', 'sleep-start'), true);
  assert.equal(B.noemtSoort('sleep-kan var KAN = { reisje: {', 'reis', 'sleep-kan'), false);
  assert.equal(B.noemtSoort('var KAN = { reis: {', 'reis', 'sleep-kan'), false, 'zonder het protocol is het geen ontvanger');
});

test('SAMEN: leeg is "niet verbonden", en een keten zonder vers register is NIET_GETEST, nooit bewezen', () => {
  assert.deepEqual(B.controleerSamen(samenOpties({})), []);
  const k = B.samenKetens({ samen: { 'link:geef': { ketens: [keten(['link:geef', 'link:neem'])] } }, zonderApp: [], lees: () => null });
  assert.equal(k.length, 1);
  assert.equal(k[0].status, 'NIET_GETEST');
  /* Een register met de keten, vers en gesloten: dan pas BEWEZEN. */
  const reg = JSON.stringify({ stempel: { op: 'nu', commit: 'abc' }, ketens: { k: { schakels: [{ nr: 1, stand: 'gesloten', wat: 'x' }], storingen: [{ nr: 1, stand: 'gehouden', wat: 'y' }] } } });
  const vers = B.samenKetens({ samen: { 'link:geef': { ketens: [keten(['link:geef', 'link:neem'])] } }, zonderApp: [],
    lees: (r) => (r === 'X.json' ? reg : null), versheid: () => ({ vers: true, reden: 'nu' }) });
  assert.equal(vers[0].status, 'BEWEZEN');
  const gebroken = reg.replace('"gehouden"', '"gebroken"');
  assert.equal(B.samenKetens({ samen: { 'link:geef': { ketens: [keten(['link:geef', 'link:neem'])] } }, zonderApp: [],
    lees: (r) => (r === 'X.json' ? gebroken : null), versheid: () => ({ vers: true, reden: 'nu' }) })[0].status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('SAMEN: een keten zonder app draagt zijn reden en wat er nodig is, en wordt in de code gemeten', () => {
  for (const k of AC.KETENS_ZONDER_APP) assert.ok(k.reden && k.nodig, k.naam);
  const b = B.controleerSamen(samenOpties({}, { zonderApp: [{ naam: 'z', reden: 'r', nodig: 'n',
    schakels: [{ scherm: '/apps/stil.html', uitgeeft: 'reis' }], proef: { register: 'X.json', instrument: 'scripts/proef.js' } }] }));
  assert.ok(b.some((x) => /stil\.html geeft reis niet in zijn code/.test(x)), b.join('\n'));
});

test('SAMEN: een ontvanger op de contextbus wordt aan zijn eigen protocol gemeten', () => {
  const ontvanger = "window.addEventListener('message', function (e) { if (e.data.rtg !== 'context') return; }); var VOLGT = { reis: function (ref, items) {} };";
  assert.equal(B.noemtSoort(ontvanger, 'reis', B.PROTOCOL.context.in), true);
  assert.equal(B.noemtSoort(ontvanger, 'reis', B.PROTOCOL.sleep.in), false, 'een contextontvanger is geen sleepontvanger');
  const opt = samenOpties({}, { zonderApp: [{ naam: 'c', reden: 'r', nodig: 'n', proef: { register: 'X.json', instrument: 'scripts/proef.js' },
    schakels: [{ scherm: '/apps/neem.html', ontvangt: 'reis', protocol: 'context' }] }], extern: { reis: 'proef' } });
  assert.ok(B.controleerSamen(opt).some((x) => /neem\.html ontvangt reis niet in zijn code \(context\)/.test(x)),
    'neem.html spreekt alleen sleep-kan; als contextontvanger telt hij niet');
});
