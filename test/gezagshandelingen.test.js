/* DE GEDEELDE NAMESPACE VAN HANDELINGEN (scripts/gezagshandelingen.js).

   WAT HIER OP HET SPEL STAAT. TAKEN.md 4.54 zegt dat vijf schalen de vraag "mag
   de machine dit zelf" beantwoorden zonder elkaar te kennen, en noemt een
   tussenstap die al telt: een gedeelde namespace voor handelingen, zodat twee
   schalen elkaar UBERHAUPT kunnen tegenspreken. Deze meter is die tussenstap.

   DRIE DINGEN DIE NIET MOGEN SNEUVELEN, en alle drie zijn ze een keer misgegaan:

     1. ROUTES WORDEN OP DE ECHTE ROUTES VERGELEKEN EN NIET OP HUN PATROON.
        De eerste versie zette de TEKST van een reguliere expressie in de
        namespace, vond nul overlap, en die nul ging alleen over schrijfwijze:
        /^\/api\/aanmelding(\/|$)/ en /^\/api\/aanmelding\/(status|open)$/ zijn
        verschillende tekenreeksen en dezelfde routes. Tegen EXECUTION_MAP.json
        gehouden vond dezelfde meter er vier.
     2. EEN BODEM IS EEN PLAFOND EN GEEN MENING. Een tegenspraak is niet "de twee
        zeggen iets anders" maar "de allowlist gaat VERDER dan de bodem
        toestaat". Zou dit op gelijkheid gaan, dan meldt hij vier tegenspraken
        waar er geen zijn -- en na drie loze alarmen zet iemand hem uit.
     3. HIJ WOONT IN scripts/ EN NIET IN server/. Een noemer die door de code
        wordt aangeroepen IS een zesde schaal in plaats van de laag eroverheen --
        dezelfde grens als bij scripts/gezagsnoemer.js.

   Draai los: node --test test/gezagshandelingen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const meter = require('../scripts/gezagshandelingen.js');

const WORTEL = path.join(__dirname, '..');

test('alle vijf schalen leveren onderwerpen; geen enkele is stuk', () => {
  const nu = meter.meet();
  assert.deepEqual(nu.stuk, [], 'een schaal levert niets meer op; dan meet de rest niets');
  assert.equal(nu.schalen, 5);
  assert.ok(nu.onderwerpen > 200, 'te weinig onderwerpen (' + nu.onderwerpen + '); wordt er nog wel uitgevouwen?');
});

test('GRENS 1: routes staan als ECHT pad in de namespace, niet als patroon', () => {
  /* Een sleutel met regex-tekens erin betekent dat een patroon geen enkele
     route raakte -- dat mag, maar dan draagt hij `route-zonder-treffer:` en is
     dat zichtbaar in plaats van stil meegeteld als onderwerp. */
  const nu = meter.meet();
  const routes = [...new Set(nu.gedeeld.map(g => g.sleutel))].filter(k => k.startsWith('route:'));
  assert.ok(routes.length, 'geen enkele gedeelde route; de uitvouwing naar echte paden is weg');
  for (const r of routes) {
    assert.doesNotMatch(r, /[\\^$|]/, 'dit is een patroon en geen pad: ' + r);
    assert.match(r, /^route:\/api\//);
  }
});

test('de vier gedeelde routes zijn geldroutes, en beide schalen zeggen er iets over', () => {
  const nu = meter.meet();
  const gedeeld = nu.gedeeld.filter(g => g.sleutel.startsWith('route:'));
  assert.ok(gedeeld.length >= 4, 'minder dan vier gedeelde routes: ' + gedeeld.length);
  for (const g of gedeeld) {
    assert.equal(g.schalen.length >= 2, true);
    assert.ok(g.zegt['server/kern/stuur/beleid-lijsten.js'], 'de allowlist zegt niets over ' + g.sleutel);
    assert.ok(g.zegt['server/kern/frictie/bodem.js'], 'de bodem zegt niets over ' + g.sleutel);
  }
});

test('GRENS 2: gelijk is geen tegenspraak -- vandaag staan er nul', () => {
  const nu = meter.meet();
  assert.equal(nu.gedeeld.filter(g => g.tegenspraak).length, 0,
    'de allowlist gaat verder dan de bodem toestaat; dat is een echte bevinding en geen meetfout');
});

test('MUTATIE: een bodem die STRENGER wordt dan de allowlist geeft een tegenspraak', () => {
  /* De proef die deze meter eerlijk houdt. Zonder deze zou "nul tegenspraken"
     ook waar zijn als de vergelijking helemaal niets deed. Gemeten: minimum
     'assist' -> 'hand' op de geldroutes geeft er twee.

     Het bestand wordt echt gemuteerd en in de finally teruggezet -- dezelfde
     vorm als test/gezag.test.js, met dezelfde waarschuwing: een kill tussen die
     twee laat de mutatie staan. */
  const bestand = path.join(WORTEL, 'server/kern/frictie/bodem.js');
  const origineel = fs.readFileSync(bestand, 'utf8');
  const zoek = "pad: /^\\/api\\/(bank\\/sepa|supplier\\/pay\\/uitbetaal|pay\\/uitbetaal)(\\/|$)/, minimum: 'assist'";
  assert.ok(origineel.includes(zoek), 'de aanname onder deze mutatie klopt niet meer; werk hem bij');
  try {
    fs.writeFileSync(bestand, origineel.replace(zoek, zoek.replace("'assist'", "'hand'")));
    /* De meter leest bodem.js met require; de cache moet leeg. */
    delete require.cache[require.resolve('../server/kern/frictie/bodem.js')];
    delete require.cache[require.resolve('../server/kern/frictie/index.js')];
    const nu = meter.meet();
    const bots = nu.gedeeld.filter(g => g.tegenspraak);
    assert.ok(bots.length >= 2, 'de meter zag geen tegenspraak terwijl de bodem strenger staat dan de allowlist');
    assert.ok(bots.some(g => g.sleutel === 'route:/api/bank/sepa'));
  } finally {
    fs.writeFileSync(bestand, origineel);
    delete require.cache[require.resolve('../server/kern/frictie/bodem.js')];
    delete require.cache[require.resolve('../server/kern/frictie/index.js')];
  }
});

test('twee schalen staan ALLEEN, en dat is de bevinding en geen tekortkoming', () => {
  /* geldbeleid/regels.js spreekt in regelsoorten en bureau/delegatie.js in
     levensdomeinen; geen andere schaal kent die soorten. Ze kunnen dus door
     niemand worden tegengesproken. Dat getal mag alleen omlaag. */
  const nu = meter.meet();
  assert.equal(nu.alleen.length, 2);
  assert.ok(nu.alleen.includes('server/kern/geldbeleid/regels.js'));
  assert.ok(nu.alleen.includes('server/kern/bureau/delegatie.js'));
});

test('GRENS 3: niets in server/ importeert deze meter', () => {
  /* Zou de code hem aanroepen, dan is hij de zesde gezagsschaal in plaats van
     de laag eroverheen -- precies wat TAKEN.md 4.54 juist wil oplossen. */
  const gevonden = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      let bron; try { bron = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
      /* EEN REQUIRE, EN NIET HET WOORD. Dit stond als `bron.includes(...)` en
         zakte op 3 september 2026 op een COMMENTAARREGEL: de kop van
         server/kern/handelingsklasse/risico.js noemt deze meter als de plek waar
         dezelfde fout eerder is gemaakt (een lijst met patronen vergelijken op
         hun tekst). Een verwijzing in een uitleg is geen aanroep, en een toets
         die daar op zakt straft juist het opschrijven van een les af.

         Wat hij WEL moet vangen staat er nu letterlijk: een require van dit
         script. Dat is de vorm waarin hij een zesde gezagsschaal zou worden. */
      if (/require\([^)]*gezagshandelingen/.test(bron)) gevonden.push(path.relative(WORTEL, p));
    }
  })(path.join(WORTEL, 'server'));
  assert.deepEqual(gevonden, [],
    'server/ haalt de noemer binnen; dan is hij een zesde schaal in plaats van de laag eroverheen');
});

test('het register loopt niet achter op de meting', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GEZAGSHANDELINGEN.json'), 'utf8'));
  const nu = meter.meet();
  assert.equal(reg.gemeten.schalen, nu.schalen);
  assert.ok(nu.gedeeld.length >= reg.gemeten.gedeeldeOnderwerpen,
    'er worden MINDER onderwerpen gedeeld dan vastgelegd; de schalen zijn uit elkaar gelopen');
  assert.ok(nu.alleen.length <= reg.gemeten.schalenZonderGedeeldeSoort,
    'er staan MEER schalen alleen dan vastgelegd');
});
