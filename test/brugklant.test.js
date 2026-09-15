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

const bouwBrug = (opties) => {
  const staat = { opslag: {}, bakjes: {} };
  return maakBrug(Object.assign({ S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k] }, opties || {}));
};

/* De brugklant met de ECHTE herhaalkaart van de brug. Een verzonnen kaart zou
   deze toetsen laten slagen terwijl de cel in productie iets anders krijgt. */
const bouwKlant = () => K.maakBrugklant(bouwBrug().herhaalKaart);

/* Een nagebouwd venster waarin de klant draait, met de time-out APART zodat een
   toets hem zelf kan laten afgaan. Dat is de enige weigering die in de cel
   ontstaat, en dus de enige die je hier kunt beproeven. */
function draaiKlant(js) {
  const luisteraars = [];
  const wekkers = [];
  let verstuurd = null;
  const venster = {
    addEventListener: (soort, fn) => luisteraars.push(fn),
    parent: { postMessage: (d) => { verstuurd = d; } },
    setTimeout: (fn) => { wekkers.push(fn); return wekkers.length; }
  };
  const klok = (fn) => { wekkers.push(fn); return wekkers.length; };
  new Function('window', 'setTimeout', js).call({ window: venster, setTimeout: klok, Promise, Error, String, JSON }, venster, klok);
  return { venster, luisteraars, wekkers, bericht: () => verstuurd };
}

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
  const js = bouwKlant();
  assert.match(js, /function maakFout/);
  assert.match(js, /e\.naam='RTGFout'/);
  // de velden worden overgezet, en niet alleen de zin
  assert.match(js, /for\(var i=0;i<VELDEN\.length;i\+\+\)/);
  assert.match(js, /if\(d\.fout\) w\.nee\(maakFout\(d\.fout\)\)/);
  for (const v of ['code', 'machtiging', 'verleend', 'hoe', 'herhaalbaar']) {
    assert.ok(K.FOUTVELDEN.includes(v), v + ' hoort mee te reizen naar de cel');
  }
});

test('8 - de brugklant draait, en levert een RTGFout met velden op', () => {
  /* De klant is een tekenreeks die in een browser draait; hier wordt hij in een
     nagebouwd venster uitgevoerd. Dat is geen browser, maar het is genoeg om te
     zien of een weigering met zijn velden aankomt -- en dat is precies de
     bewering die eerder niemand had nagerekend. */
  const { venster, luisteraars, bericht } = draaiKlant(bouwKlant());

  assert.ok(venster.RTG && typeof venster.RTG.roep === 'function', 'RTG.roep hoort te bestaan');
  const belofte = venster.RTG.roep('bericht.zet', { tekst: 'hoi' });
  const verstuurd = bericht();
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

/* ============================================================================
   DE DERDE AS: MAG EEN TAAKLOPER DIT OPNIEUW?  (14 september 2026)

   `herhaalbaar` hing aan de FOUT en niet aan de HANDELING. Twee codes stonden
   hard op `true` terwijl bij allebei onbekend is of de aanroep nog landde --
   `RTG_BRUG_FOUT` (doe() viel halverwege om) en `RTG_GEEN_ANTWOORD` (de cel
   hoorde vijftien seconden niets). Een taakloper van een derde die daarop netjes
   opnieuw probeerde, zette bij `bericht.zet` een tweede bericht klaar en bij
   `arena.zet` een tweede inzending.

   Dat de mutatieklasse dat voorspelde, stond al in `brugmethodes.js`. Hij werd
   alleen nergens gelezen: `magHerhalen()` uit kern/mutatie.js had nul
   aanroepers buiten zijn eigen module en twee toetsbestanden.
   ========================================================================== */

test('14 - de time-out in de cel antwoordt per METHODE en niet per fout', () => {
  const { venster, wekkers } = draaiKlant(bouwKlant());

  /* Per aanroep een eigen wekker. Hem laten afgaan is de enige manier om deze
     weigering te zien: hij ontstaat in de cel en niet op de server, dus geen
     enkele servertoets komt er ooit bij. */
  const naTimeout = (methode) => {
    const voor = wekkers.length;
    const belofte = venster.RTG.roep(methode, {});
    assert.equal(wekkers.length, voor + 1, methode + ': elke aanroep zet zijn eigen wekker');
    wekkers[voor]();
    return belofte.then(() => assert.fail('een time-out hoort te weigeren'), (e) => e);
  };

  return Promise.all([
    naTimeout('bericht.zet'), naTimeout('opslag.zet'), naTimeout('zomaar.iets')
  ]).then(([bericht, opslag, onbekend]) => {
    for (const e of [bericht, opslag, onbekend]) assert.equal(e.code, 'RTG_GEEN_ANTWOORD');

    /* DE DRAGENDE BEWERING. Zelfde code, zelfde status, zelfde tekst -- en toch
       een ander antwoord, want `bericht.zet` is `nietHerhaalbaar` en
       `opslag.zet` is `idempotent`. Stond hier bij allebei hetzelfde, dan is de
       hele reparatie weg en ziet de toets er nog steeds uit alsof hij iets
       beproeft. */
    assert.equal(bericht.herhaalbaar, false,
      'bericht.zet twee keer zet twee berichten klaar; na een time-out weet niemand of de eerste landde');
    assert.equal(opslag.herhaalbaar, true,
      'opslag.zet twee keer laat dezelfde stand achter, dus opnieuw proberen mag');

    /* Een methode die de kaart niet kent, krijgt `false` en niet `true`. Dat is
       de veilige kant: een naam die wij niet classificeren, classificeren we
       ook niet als veilig. */
    assert.equal(onbekend.herhaalbaar, false, 'een onbekende methode telt als nee');
  });
});

test('15 - RTG_BRUG_FOUT op de server hangt aan dezelfde klasse', () => {
  /* Een echte omval, en niet een nagemaakte: `save()` gooit, en zowel
     `opslag.zet` als `bericht.zet` roept hem aan NA het muteren. Dat is precies
     het geval waarin niet vaststaat of er iets is weggeschreven. */
  const brug = bouwBrug({ save() { throw new Error('de opslag is stuk'); } });
  const ctx = { key: 'l', sleutel: 'app', codenaam: 'Havik', taal: 'nl', pas: 'rtg' };

  const opslag = brug.roep(Object.assign({}, ctx, { methode: 'opslag.zet',
    args: { sleutel: 'k', waarde: 'v' }, verleend: ['opslag.eigen'], vraagt: ['opslag.eigen'] }));
  const bericht = brug.roep(Object.assign({}, ctx, { methode: 'bericht.zet',
    args: { tekst: 'hallo' }, verleend: ['bericht.klaarzetten'], vraagt: ['bericht.klaarzetten'] }));

  for (const r of [opslag, bericht]) {
    assert.equal(r.code, 'RTG_BRUG_FOUT', 'een omvallende doe() geeft deze code');
    assert.equal(r.status, 500);
  }
  assert.equal(opslag.herhaalbaar, true, 'idempotent: opnieuw proberen laat dezelfde stand achter');
  assert.equal(bericht.herhaalbaar, false, 'nietHerhaalbaar: opnieuw proberen IS een tweede gebeurtenis');
});

test('16 - een code die het zelf niet weet, komt er niet stil doorheen', () => {
  /* Vergeet een uitzender het antwoord, dan is dat een bouwfout in RTG en geen
     toestand van een derde. Stil terugvallen op `false` (of erger: op `true`)
     zou precies de fout herhalen die hier is weggehaald, en hem onzichtbaar
     maken -- dus valt `maak()` om, en zegt waar het antwoord vandaan hoort te
     komen. */
  for (const code of ['RTG_BRUG_FOUT', 'RTG_GEEN_ANTWOORD']) {
    assert.equal(F.CODES[code].herhaalbaar, null, code + ' hoort het zelf niet te weten');
    assert.equal(F.CODES[code].uitvoeringBekend, false, code + ': of de aanroep is uitgevoerd, staat niet vast');
    assert.throws(() => F.maak(code, 'stuk', { methode: 'x' }), /weet zelf niet of herhalen mag/,
      code + ' zonder antwoord hoort om te vallen');
    assert.throws(() => F.maak(code, 'stuk', { methode: 'x', herhaalbaar: 'ja' }), /weet zelf niet/,
      'en een tekenreeks is geen antwoord');
    assert.equal(F.maak(code, 'stuk', { methode: 'x', herhaalbaar: true }).herhaalbaar, true);
    assert.equal(F.maak(code, 'stuk', { methode: 'x', herhaalbaar: false }).herhaalbaar, false);
  }

  /* En andersom: de vijf codes die het WEL weten, vragen niets van de uitzender. */
  for (const { code, herhaalbaar } of F.overzicht().filter(c => c.herhaalbaar !== null)) {
    assert.equal(F.maak(code, 'x', { methode: 'm' }).herhaalbaar, herhaalbaar);
  }
});

test('17 - een uitzender kan het antwoord van de tabel niet overschrijven', () => {
  /* Dit gat stond er: `herhaalbaar` zat in de EERSTE helft van de Object.assign,
     dus `extra` won. Een 403 kon zichzelf herhaalbaar noemen zonder dat iets het
     tegenhield. Nu staat het in de laatste helft. */
  const r = F.maak('RTG_MACHTIGING_NIET_VERLEEND', 'nee', { machtiging: 'x', herhaalbaar: true });
  assert.equal(r.herhaalbaar, false, 'de tabel wint van de uitzender');
  const rem = F.maak('RTG_TE_VEEL_AANROEPEN', 'rustig', { herhaalbaar: false });
  assert.equal(rem.herhaalbaar, true, 'ook de andere kant op');
});

test('18 - de kaart van de cel is AFGELEID en geen tweede lijst', () => {
  const brug = bouwBrug();
  const M = require('../server/kern/mutatie');
  assert.ok(Object.keys(brug.herhaalKaart).length >= 9, 'elke methode hoort erin te staan');

  /* Elke waarde komt uit magHerhalen() en nergens anders. Zou de kaart met de
     hand worden bijgehouden, dan loopt hij een keer uit de pas met de tabel --
     en dan is het de CEL die het oude antwoord geeft. */
  for (const m of brug.mutaties) {
    assert.equal(brug.herhaalKaart[m.naam], M.magHerhalen(m.mutatie, false),
      m.naam + ' hoort het antwoord van zijn eigen mutatieklasse te dragen');
  }
  /* DE TRIPWIRE. `herhaalKaartVan` antwoordt voor een aanroeper ZONDER
     idempotentiesleutel, en dat is vandaag geen keuze maar de enige stand die
     ertoe doet: geen enkele brugmethode is `sleutelVereist`, dus de vraag komt
     niet voor. Er stond eerst een `metSleutel`-parameter, en die was met deze
     tabel niet te beproeven -- beide standen gaven hetzelfde antwoord, dus een
     mutatie erop gleed door alle negentien toetsen heen.

     De grendel staat daarom in de CODE en niet alleen hier: `herhaalKaartVan` weigert
     een `sleutelVereist`-opdracht. Daardoor kan het tweede argument van
     `magHerhalen` daarbinnen niet meer uitmaken -- voor elke klasse die de
     regel haalt zijn `true` en `false` hetzelfde antwoord. Een mutatie erop is
     dan geen ongemeten risico meer maar aantoonbaar een no-op. */
  const metSleutel = brug.mutaties.filter(m => m.sleutelNodig).map(m => m.naam);
  assert.deepEqual(metSleutel, [], 'geen enkele brugmethode is vandaag sleutelVereist');

  /* En de grendel gaat ook echt dicht. Hier mag de invoer verzonnen zijn: dit
     toetst de GRENDEL en niet de semantiek van een echte methode. */
  assert.throws(() => M.herhaalKaartVan({ 'iets.starten': { mutatie: 'sleutelVereist' } }),
    /idempotentiesleutel/, 'herhaalKaartVan hoort een sleutelklasse te weigeren');
  assert.deepEqual(M.herhaalKaartVan({ a: { mutatie: 'idempotent' }, b: { mutatie: 'nietHerhaalbaar' } }),
    { a: true, b: false }, 'en de andere klassen gewoon te beantwoorden');

  /* DE REDEN WAAROM DIE GRENDEL GENOEG IS, nagerekend in plaats van beweerd.
     `sleutelVereist` is de ENIGE klasse waarbij het tweede argument van
     magHerhalen iets uitmaakt. Klopt dat, dan kan de `false` achter de grendel
     niet stilletjes het verkeerde antwoord geven -- en dan is een mutatie op
     die `false` aantoonbaar een no-op in plaats van een ongemeten risico.

     Komt er ooit een tweede klasse waarbij de sleutel meetelt, dan zakt deze
     regel en moet de grendel mee verbreed worden. */
  const sleutelGevoelig = Object.keys(M.KLASSEN)
    .filter(k => M.magHerhalen(k, false) !== M.magHerhalen(k, true));
  assert.deepEqual(sleutelGevoelig, ['sleutelVereist'],
    'alleen sleutelVereist hoort van de sleutel af te hangen; anders dekt de grendel in herhaalKaartVan niet meer alles');

  assert.equal(brug.herhaalKaart['bericht.zet'], false);
  assert.equal(brug.herhaalKaart['arena.zet'], false);
  assert.equal(brug.herhaalKaart['opslag.zet'], true);

  /* En de klant weigert zonder kaart. Een brugklant die elke methode als
     niet-herhaalbaar afserveert, is stil verkeerd voor de zeven die het wel
     zijn -- dus valt hij bij het BEDRADEN om en niet in de cel van een ander. */
  assert.throws(() => K.maakBrugklant(), /herhaalkaart/);
  assert.throws(() => K.maakBrugklant({}), /herhaalkaart/);
});

test('19 - de twee schermen die dit tonen, kennen de derde stand', () => {
  /* `herhaalbaar` is nu drie standen en geen twee. Twee lezers renderden
     `f.herhaalbaar ? 'ja' : 'nee'`, en die zouden allebei "nee" tonen waar
     "hangt af van de methode" hoort te staan -- twee keer dezelfde stille fout
     (LAT-regel 4). De zin komt daarom uit de foutentaal zelf. */
  for (const { code, herhaalbaar, herhaalbaarTekst } of F.overzicht()) {
    assert.equal(herhaalbaarTekst,
      herhaalbaar === null ? 'hangt af van de methode' : (herhaalbaar ? 'ja' : 'nee'), code);
  }
  for (const bestand of ['scripts/rtg-sdk.js', 'public/apps/appstore-uitgever.html']) {
    const bron = lees(bestand);
    assert.match(bron, /herhaalbaarTekst/, bestand + ' hoort de zin uit de foutentaal te tonen');
    assert.doesNotMatch(bron, /f\.herhaalbaar \? '/,
      bestand + ' rekent de zin zelf uit, en toont dan "nee" waar de stand onbekend is');
  }
});
