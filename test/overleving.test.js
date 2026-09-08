/* DE OVERLEVINGSMETER, GETOETST -- want een meter die je niet hebt zien
   uitslaan, meet niets (LAT.md regel 2).

   Deze toets bewaakt vier eigenschappen die alle vier een keer fout zijn
   gegaan in de eerste ronde van scripts/overleving.js, en die alle vier stil
   fout gingen: de meter zag er precies zo uit als een meter die werkt.

   MUTATIES die zijn gedraaid en welke toets erop zakte:
   - de apparaat-probe 600 tekens laten lezen in plaats van zijn eigen entry
     -> toets 4 ZAKT (hij leest dan `uitgevoerd: true` van de buurstap).
   - `onbekend` laten terugvallen op `deels` bij een ontbrekende bron
     -> toets 2 ZAKT.
   - een kapot register als `{ ok: true, data: {} }` teruggeven
     -> toets 2b ZAKT. (Toets 2 alleen zag dit NIET: die geeft zijn eigen
     kapotte bronnen door aan meet() en raakt de lader nooit. Zo bleef de
     eerste versie groen op een mutatie die elk register stil leeg maakte.)
   - de zelfijking altijd `bewoog: true` laten teruggeven
     -> toets 3b ZAKT. (Toets 3 alleen zag dit ook NIET: die controleerde
     precies de vlag die de mutatie hardcodeert. Een ijking is pas beproefd als
     je hem ook `nee` hebt zien zeggen.) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meet, bronnen, zelfijking, leesRegister, leesBron, RIJEN, UITSLAGEN } = require('../scripts/overleving');

/* Alle bronnen kapot. Zo ziet een machine eruit waarop de registers nooit zijn
   gedraaid -- en dat is precies het geval waarin een meter graag geruststelt. */
const ALLES_STUK = () => {
  const stuk = { ok: false, reden: 'proefbron met opzet onleesbaar' };
  return { kantoormacht: stuk, isolatieproef: stuk, vertrouwen: stuk, lusstap: stuk,
    ceremonieEisen: stuk, goedkeuring: stuk, identiteitVertrouwen: stuk, intrekking: stuk,
    webauthnActies: stuk, bevestiging: stuk, tls: stuk, ca: stuk, webIndex: stuk };
};

test('1. elke rij geeft een van de vier uitslagen, met een grond erbij', () => {
  const u = meet(bronnen());
  assert.equal(u.rijen.length, RIJEN.length);
  for (const r of u.rijen) {
    assert.ok(UITSLAGEN.includes(r.uitkomst), r.id + ' gaf "' + r.uitkomst + '"');
    assert.ok(r.grond && r.grond.length > 20, r.id + ' heeft geen leesbare grond');
    assert.ok(r.nietGemeten && r.nietGemeten.length > 20,
      r.id + ' zegt niet wat hij NIET dekt, en een rij die daarover zwijgt laat een lezer ' +
      'denken dat hij alles bekeek');
    assert.ok(['gemeten', 'vermoed', 'onbekend'].includes(r.graad), r.id + ' heeft graad ' + r.graad);
  }
});

test('2. een ontbrekende bron wordt `onbekend` met de reden, nooit een middenwaarde', () => {
  /* DE BELANGRIJKSTE VAN DE VIER. Een meter die bij een kapotte bron `deels`
     zegt, is gevaarlijker dan geen meter: hij ziet er gevuld uit. */
  const u = meet(ALLES_STUK());
  for (const r of u.rijen) {
    assert.equal(r.uitkomst, 'onbekend',
      r.id + ' gaf "' + r.uitkomst + '" terwijl zijn bron onleesbaar was');
    assert.match(r.grond, /onleesbaar|bestaat niet|niet te lezen|proefbron/,
      r.id + ' noemt niet waarom hij niets weet');
  }
  assert.equal(u.telling.onbekend, RIJEN.length);
  assert.equal(u.telling.ja, 0);
  assert.equal(u.telling.deels, 0);
});

test('2b. de lader MELDT een kapotte bron in plaats van hem leeg door te geven', () => {
  /* Toets 2 hierboven voedt meet() zijn eigen kapotte bronnen en raakt de lader
     dus nooit. Wie `leesRegister` een ontbrekend bestand als `{ ok: true, data: {} }`
     laat teruggeven, breekt de hele keten -- en toets 2 blijft groen. Deze toets
     is die mutatie zien zakken. */
  const weg = leesRegister('BESTAAT-NIET-' + Date.now() + '.json');
  assert.equal(weg.ok, false, 'een ontbrekend register mag nooit als ok terugkomen');
  assert.match(weg.reden, /niet te lezen/);
  const wegBron = leesBron('server/bestaat-echt-niet-' + Date.now() + '.js');
  assert.equal(wegBron.ok, false, 'een ontbrekend bronbestand mag nooit als ok terugkomen');
  assert.match(wegBron.reden, /bestaat niet/);
});

test('3. de zelfijking beweegt: een vervalste bron geeft een andere uitslag', () => {
  const ij = zelfijking();
  assert.equal(ij.bewoog, true,
    'de kantoorcode-rij gaf op een vervalste bron dezelfde uitslag ("' + ij.echt + '"); ' +
    'dan leest die rij zijn bron niet en is elke uitslag ervan een ingetypte mening');
  assert.equal(ij.vervalst, 'ja',
    'op een bron waarin de gedeelde deur weg is en vier ogen bestaan, hoort de rij op `ja` te komen');
});

test('3b. de zelfijking zegt ook NEE als er niets beweegt', () => {
  /* De enige toets die een liegende ijking ontmaskert. Toets 3 controleert dat
     `bewoog` true is -- precies wat een hardgecodeerde `bewoog = true` oplevert.
     Hier krijgt de ijking een basis waarin het probleem AL is opgelost: de
     vervalsing verandert dan niets, en `bewoog` HOORT false te zijn. */
  const alOpgelost = Object.assign(bronnen(), {
    kantoormacht: { ok: true, data: {
      gemeten: { routes: 586, deurGedeeld: 0, deurEistMens: 586 },
      machinerie: { vierogen: { aanKantoorroute: 12 }, voornemen: { aanKantoorroute: 12 } }
    } }
  });
  const ij = zelfijking(alOpgelost);
  assert.equal(ij.echt, 'ja');
  assert.equal(ij.vervalst, 'ja');
  assert.equal(ij.bewoog, false,
    'de ijking meldt beweging waar niets bewoog; dan is `bewoog` een constante en geen meting');
});

test('4. de apparaat-rij leest zijn EIGEN ceremoniestap en niet die van de buren', () => {
  /* Dit is de fout die er echt in zat: een slice van 600 tekens vanaf
     `apparaat:` liep door in `wachttijd` en `tweedePaarOgen`, die allebei op
     `uitgevoerd: true` staan. De rij meldde dat het toestel wordt
     gecontroleerd, terwijl de stap er letterlijk bij zegt dat hij dat niet is. */
  const b = Object.assign(bronnen(), {
    ceremonieEisen: { ok: true, tekst:
      "const STAPPEN = { apparaat: { wie: 'de sessie', uitgevoerd: false }, " +
      "wachttijd: { wie: 'de klok', uitgevoerd: true } };" }
  });
  const rij = meet(b).rijen.find(r => r.id === 'apparaat');
  assert.equal(rij.uitkomst, 'onbekend',
    'een stap met `uitgevoerd: false` mag nooit als gecontroleerd gelden');

  const b2 = Object.assign(bronnen(), {
    ceremonieEisen: { ok: true, tekst:
      "const STAPPEN = { apparaat: { wie: 'de sessie', uitgevoerd: true }, " +
      "wachttijd: { wie: 'de klok', uitgevoerd: false } };" }
  });
  assert.equal(meet(b2).rijen.find(r => r.id === 'apparaat').uitkomst, 'deels',
    'en andersom hoort hij wel mee te bewegen');
});

test('5. er komt geen samengesteld cijfer uit', () => {
  /* BEWIJSMACHINE.md verbiedt het enkele READY boven een scorecard. Acht
     eerlijke uitslagen die worden opgeteld tot een percentage, verbergen precies
     welke van de acht bewoog. Deze toets is de rem op die verleiding. */
  const u = meet(bronnen());
  const platte = JSON.stringify(u.telling);
  assert.ok(!/score|percentage|totaal|cijfer|ready/i.test(platte),
    'de telling draagt iets dat naar een samengesteld oordeel ruikt: ' + platte);
  assert.deepEqual(Object.keys(u.telling).sort(), ['deels', 'ja', 'nee', 'onbekend', 'rijen']);
});

test('6. het vastgelegde register is de ratel: ja mag niet dalen, nee en onbekend niet stijgen', () => {
  /* WAAROM DEZE RATEL IN EEN TOETS ZIT EN NIET ALLEEN IN CI. `npm run
     overleving:controle` doet hetzelfde, maar hij hangt aan een losse stap in
     ci.yml -- en scripts/norm.js telt een meetbestand in de wortel dat aan geen
     enkele ratel hangt als `metingenZonderRatel`. Terecht: een register waar
     alleen een aparte CI-stap op let, verliest zijn bewaker zodra iemand die
     stap verplaatst. Deze toets draait in elke scherf mee en noemt het bestand
     bij naam, zodat scripts/lib/metingen.js hem als eigenRatel kan aanwijzen.

     DE RICHTING IS HET PUNT. Niet "de getallen zijn gelijk" -- dat zou elke
     verbetering laten zakken en dan zet iemand de toets uit. Alleen de verkeerde
     kant op is fout. En `onbekend` staat er met opzet bij: zonder die derde is
     een bron weghalen de goedkoopste manier om een `nee` te laten verdwijnen. */
  const fs = require('node:fs');
  const path = require('node:path');
  const pad = path.join(__dirname, '..', 'OVERLEVING.json');
  const vastgelegd = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const nu = meet(bronnen()).telling;
  const was = vastgelegd.telling;

  assert.ok(nu.ja >= was.ja,
    'overleefde scenario\'s ' + was.ja + ' -> ' + nu.ja + '; deze teller mag alleen stijgen');
  assert.ok(nu.nee <= was.nee,
    'niet-overleefde scenario\'s ' + was.nee + ' -> ' + nu.nee + '; deze teller mag alleen dalen');
  assert.ok(nu.onbekend <= was.onbekend,
    'ongemeten scenario\'s ' + was.onbekend + ' -> ' + nu.onbekend + '; minder meten is geen vooruitgang');
  assert.equal(nu.rijen, was.rijen,
    'er is een scenario bij gekomen of weggehaald zonder OVERLEVING.json bij te werken ' +
    '(npm run overleving:vast)');
});
