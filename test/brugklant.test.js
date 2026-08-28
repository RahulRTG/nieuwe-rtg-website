/* DE BRUGKLANT EN HET FOUTMODEL -- komt een weigering heel aan?

   De brug schrijft bij een weigering vier dingen op: welke machtiging nodig was,
   wat dit lid WEL gaf, wat het manifest vroeg, en hoe het op te lossen is. Dat is
   het verschil tussen een poort waar je doorheen leert komen en een poort waar je
   tegenaan blijft lopen -- en het bereikte niemand: de celpagina maakte er
   `new Error(d.error)` van en stuurde alleen `err.message` de cel in.

   Deze toets houdt de reparatie vast op de vier plekken waar hij sneuvelt:

     1. de brug zendt geen code uit (dan is er niets machineleesbaars);
     2. de celpagina slaat het antwoord weer plat tot een zin;
     3. de brugklant maakt van de velden alsnog een kale Error;
     4. de cel en de CLI krijgen elk hun eigen kopie van klant of CSP -- en dan
        is "werkt lokaal, geblokkeerd in de cel" een kwestie van tijd.

   Draai los: node --test test/brugklant.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../server/kern/appstore/brugklant');
const F = require('../server/kern/platformfout');
const { maakBrug } = require('../server/kern/appstore/brug');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');

const bouwBrug = () => {
  const staat = { opslag: {}, bakjes: {} };
  return maakBrug({ S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
};

test('1 - een weigering draagt een code en de vier velden', () => {
  const brug = bouwBrug();
  const r = brug.roep({ key: 'l', sleutel: 'a', methode: 'bericht.zet', args: { tekst: 'hoi daar' },
    codenaam: 'Havik', taal: 'nl', pas: 'rtg', verleend: ['profiel.basis'], vraagt: ['bericht.klaarzetten'] });
  assert.equal(r.status, 403);
  assert.equal(r.code, 'RTG_MACHTIGING_NIET_VERLEEND');
  assert.equal(r.machtiging, 'bericht.klaarzetten');
  assert.deepEqual(r.verleend, ['profiel.basis']);
  assert.deepEqual(r.gevraagd, ['bericht.klaarzetten']);
  assert.match(r.hoe, /Alleen het lid/);
  assert.equal(r.herhaalbaar, false);
  assert.ok(r.error.length > 40, 'en de zin voor een mens blijft gewoon staan');
});

test('2 - niet-gevraagd en niet-verleend zijn twee verschillende codes', () => {
  /* Drie van de vier oorzaken van een 403 kan een uitgever niet oplossen; het
     verschil tussen "ik vroeg het niet" en "het lid gaf het niet" is precies
     welke van de twee hij voor zich heeft. */
  const brug = bouwBrug();
  const basis = { key: 'l', sleutel: 'a', methode: 'bericht.zet', args: { tekst: 'hoi daar' },
    codenaam: 'Havik', taal: 'nl', pas: 'rtg', verleend: [] };
  const nietGevraagd = brug.roep(Object.assign({}, basis, { vraagt: [] }));
  const nietVerleend = brug.roep(Object.assign({}, basis, { vraagt: ['bericht.klaarzetten'] }));
  assert.equal(nietGevraagd.code, 'RTG_MACHTIGING_NIET_GEVRAAGD');
  assert.equal(nietVerleend.code, 'RTG_MACHTIGING_NIET_VERLEEND');
  assert.notEqual(nietGevraagd.hoe, nietVerleend.hoe, 'en ze wijzen naar een andere oplossing');
});

test('3 - alleen de rem is herhaalbaar', () => {
  const brug = bouwBrug();
  const ctx = { key: 'l', sleutel: 'a', codenaam: 'Havik', taal: 'nl', pas: 'rtg',
    verleend: ['opslag.eigen'], vraagt: ['opslag.eigen'] };
  let rem = null;
  for (let i = 0; i < brug.GRENS.roepenPerMinuut + 5 && !rem; i++) {
    const r = brug.roep(Object.assign({}, ctx, { methode: 'opslag.lijst' }));
    if (r.status === 429) rem = r;
  }
  assert.ok(rem, 'de rem hoort binnen zijn eigen grens te komen');
  assert.equal(rem.code, 'RTG_TE_VEEL_AANROEPEN');
  assert.equal(rem.herhaalbaar, true, 'dit is de enige weigering die vanzelf overgaat');

  const onbekend = brug.roep(Object.assign({}, ctx, { methode: 'zomaar.iets' }));
  assert.equal(onbekend.code, 'RTG_METHODE_ONBEKEND');
  assert.equal(onbekend.herhaalbaar, false);
});

test('4 - elke code die wordt uitgezonden, bestaat in de foutentaal', () => {
  /* Alle RTG_-codes in de bron, en niet alleen die direct achter fout.maak(:
     de 403 kiest zijn code met een ternair, en die zou een nauwere regex
     missen -- dan toetst dit niets over precies de interessantste weigering. */
  for (const bestand of ['server/kern/appstore/brug.js', 'server/kern/appstore/brugklant.js']) {
    const gebruikt = [...new Set([...lees(bestand).matchAll(/'(RTG_[A-Z_]+)'/g)].map(m => m[1]))];
    assert.ok(gebruikt.length, bestand + ' hoort codes uit te zenden');
    for (const c of gebruikt) assert.ok(F.isCode(c), c + ' wordt uitgezonden in ' + bestand + ' maar staat niet in kern/platformfout.js');
  }
});

test('5 - en elke code in de foutentaal wordt ergens uitgezonden', () => {
  /* Andersom is even belangrijk: een code in een tabel die geen enkele regel kan
     produceren, is een belofte in tekst zonder belofte in code (LAT-regel 6). */
  for (const { code, uitgezondenDoor } of F.overzicht()) {
    /* En de tabel wijst het bestand aan waar hij vandaan komt, dus DAAR wordt
       gekeken. Zo is `uitgezondenDoor` een bewering die wordt nagerekend en geen
       versiering die stilletjes veroudert. */
    assert.match(lees(uitgezondenDoor), new RegExp("'" + code + "'"),
      code + ' staat in de tabel met "' + uitgezondenDoor + '" maar wordt daar niet uitgezonden');
  }
});

test('6 - wat er GEEN code heeft, staat er met een reden', () => {
  for (const [code, reden] of Object.entries(F.NOG_GEEN_CODE)) {
    assert.ok(reden.length > 60, code + ' hoort een echte reden te dragen en geen etiket');
    assert.ok(!F.isCode(code), code + ' staat zowel bij de codes als bij de niet-gebouwde');
  }
});

test('7 - de brugklant bouwt een fout MET velden, niet een kale Error', () => {
  assert.match(K.BRUGKLANT, /function maakFout/);
  assert.match(K.BRUGKLANT, /e\.naam='RTGFout'/);
  // de velden worden overgezet, en niet alleen de zin
  assert.match(K.BRUGKLANT, /for\(var i=0;i<VELDEN\.length;i\+\+\)/);
  assert.match(K.BRUGKLANT, /if\(d\.fout\) w\.nee\(maakFout\(d\.fout\)\)/);
  for (const v of ['code', 'machtiging', 'verleend', 'hoe', 'herhaalbaar']) {
    assert.ok(K.FOUTVELDEN.includes(v), v + ' hoort mee te reizen naar de cel');
  }
});

test('8 - de brugklant draait, en levert een RTGFout met velden op', () => {
  /* De klant is een tekenreeks die in een browser draait; hier wordt hij in een
     nagebouwd venster uitgevoerd. Dat is geen browser, maar het is genoeg om te
     zien of een weigering met zijn velden aankomt -- en dat is precies de
     bewering die eerder niemand had nagerekend. */
  const luisteraars = [];
  let verstuurd = null;
  const venster = {
    addEventListener: (soort, fn) => luisteraars.push(fn),
    parent: { postMessage: (d) => { verstuurd = d; } },
    setTimeout: () => 0
  };
  const scope = { window: venster, setTimeout: () => 0, Promise, Error, String, JSON };
  new Function('window', 'setTimeout', K.BRUGKLANT).call(scope, venster, () => 0);

  assert.ok(venster.RTG && typeof venster.RTG.roep === 'function', 'RTG.roep hoort te bestaan');
  const belofte = venster.RTG.roep('bericht.zet', { tekst: 'hoi' });
  assert.ok(verstuurd && verstuurd.rtgcel === 1, 'de aanroep gaat als bericht naar boven');

  // het antwoord van de celpagina, met de weigering van de brug erin
  luisteraars[0]({ source: venster.parent, data: { rtgcel: 1, nr: verstuurd.nr, fout: {
    code: 'RTG_MACHTIGING_NIET_VERLEEND', error: 'niet verleend',
    machtiging: 'bericht.klaarzetten', verleend: ['profiel.basis'], hoe: 'vraag het lid', herhaalbaar: false } } });

  return belofte.then(() => assert.fail('dit hoort te weigeren'), (e) => {
    assert.equal(e.naam, 'RTGFout');
    assert.equal(e.code, 'RTG_MACHTIGING_NIET_VERLEEND');
    assert.equal(e.machtiging, 'bericht.klaarzetten');
    assert.deepEqual(e.verleend, ['profiel.basis']);
    assert.equal(e.hoe, 'vraag het lid');
    assert.equal(e.herhaalbaar, false);
    assert.equal(e.message, 'niet verleend', 'en de zin blijft de zin');
  });
});

test('9 - de celpagina slaat de weigering niet meer plat', () => {
  const bron = lees('public/apps/appcel.html');
  assert.match(bron, /e\.antwoord = d/, 'het hele antwoord hoort aan de fout te blijven hangen');
  assert.match(bron, /stuur\(\{ fout \}\)/, 'en als object de cel in te gaan');
  assert.doesNotMatch(bron, /stuur\(\{ error: err\.message \}\)/, 'de oude platslag hoort weg te zijn');
});

test('10 - de doorlaatlijst van de celpagina is dezelfde als die van de brugklant', () => {
  /* Een celpagina kent geen require, dus de lijst staat daar als tekenreeks.
     Precies daarom moet iets hem gelijkhouden -- anders is dit de tweede
     waarheid die LAT-regel 4 verbiedt. */
  const bron = lees('public/apps/appcel.html');
  const m = bron.match(/const FOUTVELDEN = \[([\s\S]*?)\];/);
  assert.ok(m, 'de celpagina hoort een doorlaatlijst te hebben');
  const inPagina = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map(x => x[1]);
  assert.deepEqual(inPagina.sort(), K.FOUTVELDEN.slice().sort(),
    'de lijst in appcel.html loopt uit de pas met kern/appstore/brugklant.js');
});

test('11 - de cel heeft GEEN eigen kopie van de klant of de CSP', () => {
  /* Dit is de toets die de hele verhuizing vasthoudt. Zou de cel zijn eigen
     tekenreeks terugkrijgen, dan loopt hij een keer uit de pas met wat rtg dev
     serveert -- en dan is de eerste ervaring van een uitgever "werkt lokaal,
     geblokkeerd in de cel". */
  const bron = lees('server/routes/appstore/cel.js');
  assert.match(bron, /require\('\.\.\/\.\.\/kern\/appstore\/brugklant'\)/,
    'cel.js hoort de gedeelde brugklant te gebruiken');
  assert.doesNotMatch(bron, /const BRUGKLANT = `/, 'cel.js hoort geen eigen brugklant te definieren');
  assert.doesNotMatch(bron, /default-src 'none'/, 'cel.js hoort geen eigen CSP te definieren');
});

test('12 - de CSP houdt de app zonder netwerk en in een naamloze herkomst', () => {
  const csp = K.celCsp('https://rtg.example');
  assert.match(csp, /connect-src 'none'/, 'geen netwerk is de kern van de cel');
  assert.match(csp, /sandbox allow-scripts/, 'en zonder allow-same-origin: een naamloze herkomst');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors https:\/\/rtg\.example/);
  assert.doesNotMatch(csp, /allow-same-origin/);
});

test('13 - het brugscript wordt geinjecteerd, niet gevraagd', () => {
  const met = K.metBrug('<html><head><title>x</title></head><body>hoi</body></html>');
  assert.match(met, /<head[^>]*><script src="\/appcel\/brug\.js">/, 'vooraan in de head, voor de eigen code van de app');
  // zonder head belandt hij vooraan, en niet nergens
  const zonder = K.metBrug('<div>hoi</div>');
  assert.match(zonder, /^<script src="\/appcel\/brug\.js"><\/script><div>/);
});
