/* HET STUURSPOOR -- observeert het, en bewijst het iets?

   Twee beloften. Ten eerste: het spoor BESLIST NIETS -- geen enkele markering
   mag de keten kunnen tegenhouden of veranderen. Ten tweede: het bewijst dat
   plan.js, gevolg.js en de mandaatlaag ECHT geraakt zijn, in plaats van dat er
   alleen een antwoord uitkwam.

   Die tweede is de reden dat dit vóór de tien mutatieproeven komt. Zes van die
   tien luiden "stap weggehaald -> spoor incompleet"; zonder spoor is er niets
   om incompleet te zijn.

   Elke bewering draagt zijn MUTATIE. Draai los:
     node --test test/stuurspoor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { maakSpoor, spoorNaarBuiten, FASEN, STANDEN } = require('../server/kern/stuur/spoor');
const { maakCorpusRail } = require('../server/kern/stuur/rail-corpus');
const { toegestanePaden } = require('../server/kern/stuur/beleid');
const { classificeer, parseSubs } = require('../server/kern/stuur/classificatie');

const KANDIDATEN = ['/api/agenda/mijn', '/api/agenda/toevoegen', '/api/agenda/wijzig',
  '/api/locatie/mijn', '/api/locatie/deel', '/api/asset/mijn', '/api/site/mijn',
  '/api/site/bewaar', '/api/meet/mijn', '/api/meet/maak', '/api/leerstof/vakken',
  '/api/onderwijs/advies', '/api/mediaos/wereld', '/api/bijles/gesprek',
  '/api/kantoorpakket/mijn', '/api/reisbureau/boek'];
const NEPREQ = { socket: { localPort: 0 }, get: () => null, session: {} };

function maakLus(extra) {
  const geroepen = [];
  const stuurRoep = async (req, pad) => { geroepen.push(pad); return { status: 200, antwoord: {} }; };
  const alle = toegestanePaden(KANDIDATEN, 'member');
  const lus = require('../server/kern/stuur/lus')(Object.assign({
    /* `railNaam` moet mee: het spoor verlaat de lus alleen op de
       deterministische rail (kern/stuur/lus.js), en deze proef IS die rail.
       Vergeet je hem, dan komt er geen spoor terug en zakt de toets luid --
       precies de kant op die je wilt. */
    anthropic: maakCorpusRail({}), railNaam: 'DETERMINISTISCH',
    app: {}, log: null, stuurRoep,
    stuurPaden: () => alle, classificeer, parseSubs, isolatie: null
  }, extra || {}));
  return { lus, geroepen };
}

test('1. het spoor BESLIST NIETS', () => {
  /* De gevaarlijkste faalvorm van een bewijslaag is dat hij een tweede
     besluitlaag wordt. mark() geeft met opzet `undefined` terug: er valt niets
     op af te slaan. En hij kan niet gooien -- de levering gaat voor.
     MUTATIE: laat mark() `false` teruggeven bij een onbekende fase, en bouw in
     lusstap.js `if (!spoor.mark(...)) return;`. Dan is het een poort. */
  const s = maakSpoor({ vraag: 'x' });
  assert.equal(s.mark('INTENT_RESOLVED', 'PASS'), undefined, 'mark() geeft iets terug om op af te slaan');
  assert.equal(s.mark('BESTAAT_NIET', 'ONZIN'), undefined);
  /* Ook met rommel erin gooit hij niet. */
  assert.doesNotThrow(() => s.mark(null, null, 'geen object'));
  assert.doesNotThrow(() => s.mark({}, [], null));
});

test('2. de bron draagt geen enkele tak die op het spoor afslaat', () => {
  /* Een gedragstoets kan dit niet zien: een `if (spoor...)` die pas bij een
     zeldzame invoer bijt, blijft groen. Daarom op de BRON.
     MUTATIE: schrijf `if (spoor && spoor.mark(...) === false) return;` in
     lusstap.js. */
  for (const f of ['server/kern/stuur/lusstap.js', 'server/kern/stuur/lus.js']) {
    const bron = fs.readFileSync(path.join(WORTEL, f), 'utf8');
    assert.doesNotMatch(bron, /if\s*\([^)]*spoor\.mark/,
      f + ' laat de keten afslaan op een markering; dan is het spoor een poort geworden');
    assert.doesNotMatch(bron, /(const|let|var)\s+\w+\s*=\s*spoor\.mark/,
      f + ' vangt de uitkomst van een markering op; die hoort nergens voor te dienen');
  }
});

test('3. een fase die niet liep heet OVERGESLAGEN en niet PASS', () => {
  /* Een ontbrekende regel leest als een fase die niemand heeft gemeten. Elke
     fase uit de gesloten lijst staat er dus in, met zijn eigen stand.
     MUTATIE: laat uitslag() alleen de gemarkeerde fasen teruggeven. */
  const u = maakSpoor({ vraag: 'x' }).uitslag();
  for (const f of FASEN) assert.ok(u.perFase[f], 'fase ' + f + ' ontbreekt in de uitslag');
  assert.equal(u.perFase.EXECUTED.stand, 'OVERGESLAGEN');
  assert.equal(u.perFase.INPUT_RECEIVED.stand, 'PASS', 'INPUT_RECEIVED valt bij het maken');
});

test('4. NOT_RUN wordt NIET bij PASS opgeteld', () => {
  /* Anders lijkt een keten die niets deed even ver gekomen als een die alles
     deed -- en juist bij plafond `tonen` HOORT er niets uitgevoerd te worden.
     MUTATIE: tel NOT_RUN mee in `gehaald`. */
  const s = maakSpoor({ vraag: 'x' });
  s.mark('PLAN_COMPILED', 'PASS');
  s.mark('EXECUTED', 'NOT_RUN');
  const u = s.uitslag();
  assert.equal(u.gehaald, 2, 'INPUT_RECEIVED + PLAN_COMPILED');
  assert.equal(u.nietGelopen, 1);
  assert.ok(u.gehaald + u.nietGelopen + u.overgeslagen === FASEN.length,
    'elke fase valt in precies een bak');
});

test('5. een onbekende fase wordt GEMELD en niet weggegooid', () => {
  /* Stil weggooien zou een verkeerd gespelde fase als "niet doorlopen" laten
     lezen -- de valse nul.
     MUTATIE: negeer een fase die niet in FASEN staat. */
  const s = maakSpoor({ vraag: 'x' });
  s.mark('INTENT_RESOVLED', 'PASS');          // typefout, met opzet
  const u = s.uitslag();
  assert.equal(u.onbekendeFasen.length, 1);
  assert.match(u.onbekendeFasen[0], /^ONBEKEND:/);
  assert.equal(u.perFase.INTENT_RESOLVED.stand, 'OVERGESLAGEN',
    'de typefout mag de echte fase niet vullen');
});

test('6. twee sporen houden elkaars fasen niet bij', () => {
  /* Moduletoestand zou betekenen dat twee gesprekken tegelijk elkaars fasen
     opschrijven. Zelfde reden als de stapindex van de corpusrail.
     MUTATIE: houd `merken` op moduleniveau. */
  const a = maakSpoor({ vraag: 'a' });
  const b = maakSpoor({ vraag: 'b' });
  a.mark('PLAN_COMPILED', 'PASS');
  assert.notEqual(a.id, b.id, 'twee sporen delen een kenmerk');
  assert.equal(b.uitslag().perFase.PLAN_COMPILED.stand, 'OVERGESLAGEN');
  assert.equal(a.uitslag().perFase.PLAN_COMPILED.stand, 'PASS');
});

test('7. de ECHTE keten vult het spoor, zonder enig model', async () => {
  /* Dit is waar het om gaat: bewijzen DAT de resolver, de compiler, de
     gevolgvoorspelling en de mandaatgrendel geraakt zijn -- niet dat er een
     antwoord uitkwam.
     MUTATIE: haal de plan-stap uit de corpusregel; dan zakt PLAN_COMPILED. */
  const { lus } = maakLus();
  const uit = await lus(NEPREQ, { vraag: 'zet vrijdag in mijn agenda', wereld: 'member',
    filter: (p) => !p.startsWith('/api/reisbureau') });
  assert.ok(uit && uit.spoor, 'de lus gaf geen spoor terug');
  const f = uit.spoor.perFase;
  assert.equal(f.INPUT_RECEIVED.stand, 'PASS');
  assert.equal(f.INTENT_RESOLVED.stand, 'PASS', 'de echte resolver is niet geraakt');
  assert.equal(f.PLAN_COMPILED.stand, 'PASS', 'de echte compileer() is niet geraakt');
  assert.equal(f.CONSEQUENCE_EVALUATED.stand, 'PASS', 'de echte voorspel() is niet geraakt');
  assert.equal(f.MANDATE_EVALUATED.stand, 'PASS', 'de mandaatgrendel heeft niet gewogen');
  assert.equal(f.PROJECTED.stand, 'PASS');
  assert.ok(typeof uit.spoor.id === 'string' && uit.spoor.id.length > 8,
    'een spoor zonder kenmerk verbindt geen fasen');
});

test('8. een kijkvraag laat EXECUTED op OVERGESLAGEN', async () => {
  /* De scherpste regel: geen enkele bestaande vraag krijgt automatisch een
     side effect. Het spoor hoort dat te LATEN ZIEN in plaats van het alleen
     waar te maken.
     MUTATIE: zet een `doe`-stap in de corpusregel van "parijs vrijdag". */
  const { lus, geroepen } = maakLus();
  const uit = await lus(NEPREQ, { vraag: 'parijs vrijdag', wereld: 'member' });
  assert.equal(uit.spoor.perFase.EXECUTED.stand, 'OVERGESLAGEN',
    'er is iets uitgevoerd op een vraag die alleen kijkt');
  assert.equal(uit.spoor.perFase.CAPABILITY_SELECTED.stand, 'OVERGESLAGEN');
  assert.equal(geroepen.length, 0, 'er is een echte API-aanroep gedaan');
});

test('9. de mandaatgrendel wordt gemeten waar hij WEEGT', async () => {
  /* Niet waar de trede wordt gekozen maar waar hij de padenlijst versmalt.
     Zonder filter is er niets gewogen, en dan is NOT_RUN de eerlijke stand --
     geen PASS.
     MUTATIE: markeer MANDATE_EVALUATED altijd als PASS. */
  const { lus } = maakLus();
  const zonder = await lus(NEPREQ, { vraag: 'parijs vrijdag', wereld: 'member' });
  assert.equal(zonder.spoor.perFase.MANDATE_EVALUATED.stand, 'NOT_RUN',
    'zonder grendel is er niets gewogen; dat is geen PASS');
  const met = await lus(NEPREQ, { vraag: 'parijs vrijdag', wereld: 'member',
    filter: (p) => p.startsWith('/api/agenda') });
  const d = met.spoor.merken.find((m) => m.fase === 'MANDATE_EVALUATED');
  assert.equal(met.spoor.perFase.MANDATE_EVALUATED.stand, 'PASS');
  assert.ok(d.detail.na < d.detail.voor, 'de grendel hoort de lijst te versmallen: ' + JSON.stringify(d.detail));
});

test('10. de standen zijn een gesloten lijst', () => {
  /* Een vrije stand levert uitslagen op die geen enkele afhandeling kent; een
     onbekende stand valt daarom terug op PASS noch op stilte, maar wordt
     genormaliseerd.
     MUTATIE: laat een onbekende stand ongemoeid doorlopen. */
  assert.deepEqual([...STANDEN], ['PASS', 'NOT_RUN', 'OVERGESLAGEN']);
  const s = maakSpoor({ vraag: 'x' });
  s.mark('PLAN_COMPILED', 'MISSCHIEN');
  assert.equal(s.uitslag().perFase.PLAN_COMPILED.stand, 'PASS',
    'een onbekende stand hoort genormaliseerd te worden, niet bewaard');
});

test('10. het spoor verlaat de server fail-closed, en zegt altijd waarom', () => {
  /* Zonder deze grendel is fase 12 onmogelijk (een andere rail valt dan niet te
     meten) en met een te ruime grendel lekt hij wat RTG voor een echt lid aan
     het doen was. Drie standen, en de productieregel wint van alles.
     MUTATIE: laat productie erdoor zodra RTG_SPOOR_UIT=1 staat. */
  const det = spoorNaarBuiten({ env: {}, railNaam: 'DETERMINISTISCH' });
  assert.equal(det.mag, true, 'de deterministische rail draagt een gescript corpus');

  /* Een modelrail is dicht tenzij iemand hem met opzet opent. */
  assert.equal(spoorNaarBuiten({ env: {}, railNaam: 'LOKAAL' }).mag, false);
  assert.equal(spoorNaarBuiten({ env: {}, railNaam: 'CLAUDE' }).mag, false);
  assert.equal(spoorNaarBuiten({ env: { RTG_SPOOR_UIT: '1' }, railNaam: 'LOKAAL' }).mag, true);

  /* PRODUCTIE WINT VAN ALLES, ook van de deterministische rail en ook mét de
     vlag. Een slot dat opengaat als iemand iets vergeet, is geen slot. */
  for (const rail of ['DETERMINISTISCH', 'LOKAAL', 'CLAUDE', 'GEEN'])
    for (const vlag of [{}, { RTG_SPOOR_UIT: '1' }])
      assert.equal(spoorNaarBuiten({ env: Object.assign({ NODE_ENV: 'production' }, vlag), railNaam: rail }).mag,
        false, 'het spoor kwam in productie naar buiten op rail ' + rail);

  /* En elke uitkomst draagt een leesbare reden -- ook de ja's. */
  for (const g of [det, spoorNaarBuiten({ env: {}, railNaam: 'LOKAAL' }),
    spoorNaarBuiten({ env: { NODE_ENV: 'production' }, railNaam: 'DETERMINISTISCH' })])
    assert.ok(g.reden && g.reden.length > 30, 'een uitkomst zonder uitgeschreven reden: ' + JSON.stringify(g));
});
