/* ============================================================================
   DE BRON VAN EEN ROUTE MET EEN SAMENGESTELD PAD.

   WAT ER MIS WAS. scripts/lib/routes.js vond het bronbestand van een route door
   het pad letterlijk in de code te zoeken. Een registratie in een lus --
   `app.post('/api/rtf/spel/' + naam, ...)` over een actietabel -- draagt dat
   letterlijke pad niet, en dus kregen alle drieenveertig spelroutes
   `bestand: null`. Dat is niet een cosmetisch gat: alle vier de bewijsproeven
   lezen de handler via dat bestand, dus voor die routes kon geen van hen iets
   vaststellen. scripts/handlerwacht.js meldde ze als "niet gelezen", en dat was
   in een keer de grootste blinde vlek van de hele meting.

   Erger nog was de stille kant: `'/api/rtf/spel/'` werd als EXACT pad in de
   index gezet, dus de blinde vlek droeg ook nog een onjuiste regel.

   WAT ER NU GEBEURT. Een string die verdergaat met `+` levert een VOORVOEGSEL.
   Een route zonder exacte en zonder staarttreffer krijgt het langste
   voorvoegsel dat op zijn pad past, en alleen als daar precies een registratie
   op staat -- dezelfde discipline als bij de staart, want een verkeerd
   toegewezen bronbestand is erger dan geen.

   DE MUTATIE: haal het `isVoorvoegsel`-blok uit bronIndex() in
   scripts/lib/routes.js -> de eerste twee toetsen zakken.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { alleRoutes } = require('../scripts/lib/routes');

const ROUTES = alleRoutes();
const zoek = (m, p) => ROUTES.find(r => r.methode === m && r.pad === p);

test('een route uit een lus met een samengesteld pad kent zijn bron', () => {
  const r = zoek('POST', '/api/rtf/spel/zet');
  assert.ok(r, '/api/rtf/spel/zet hoort in de routekaart te staan');
  assert.equal(r.bestand, 'server/routes/spellen.js',
    'de bron van een lusregistratie hoort gevonden te worden');
  assert.ok(r.regel > 0, 'en met een regelnummer');
});

test('zo een plek zegt er zelf bij dat hij de REGISTRATIE is en niet de handler', () => {
  const r = zoek('POST', '/api/rtf/spel/zet');
  assert.equal(r.samengesteld, true,
    'wie de regel van een lus krijgt, hoort dat te weten: de handler per actie staat elders');
  const gewoon = ROUTES.find(x => x.bestand && !x.samengesteld);
  assert.equal(gewoon.samengesteld, false, 'een gewone route is niet samengesteld');
});

test('het voorvoegsel zelf komt niet als route in de index terecht', () => {
  assert.equal(zoek('POST', '/api/rtf/spel/'), undefined,
    "'/api/rtf/spel/' is een voorvoegsel en geen pad");
});

test('ook de omgekeerde vorm: een variabele met een letterlijk achtervoegsel', () => {
  /* server/routes/rtmail-vak.js: app.post(p.pad + '/vak', ...) in een lus over
     twee poorten. Vierenzeventig rtmail-routes stonden zo buiten bereik. */
  for (const pad of ['/api/member/rtmail/vak', '/api/supplier/rtmail/vak']) {
    const r = zoek('POST', pad);
    assert.ok(r, pad + ' hoort in de routekaart te staan');
    assert.equal(r.bestand, 'server/routes/rtmail-vak.js', pad + ' wijst naar de verkeerde bron');
    assert.equal(r.samengesteld, true);
  }
});

test('wat er overblijft is de routefabriek, en dat blijft eerlijk leeg', () => {
  /* De derde vorm is `app.post(basis + pad, ...)` met TWEE variabelen
     (server/routes/verzorging.js). Daar valt met een index over de brontekst
     niets te vinden: er staat geen letterlijk deel in de aanroep. Die routes
     houden `bestand: null` in plaats van naar de fabriek te wijzen -- een
     verkeerd toegewezen bronbestand is erger dan geen.

     Deze toets legt vast dat het er nog zijn en hoeveel, zodat het aantal niet
     ongemerkt groeit. Zakt hij omdat het er MINDER zijn, dan is dat winst en
     mag het getal omlaag. */
  const zonder = ROUTES.filter(r => !r.bestand);
  assert.ok(zonder.length <= 54,
    'routes zonder bron: ' + zonder.length + ' (was 54); groeit dit, dan is er een vorm bijgekomen');
});

test('geen enkele route wordt aan meer dan een bron tegelijk toegewezen', () => {
  /* De voorvoegselingang is de ruimste van de drie. Als hij ooit te ruim wordt,
     is dat hier te zien: een voorvoegsel met meerdere registraties hoort te
     worden geweigerd, niet gegokt. */
  const perPlek = new Map();
  for (const r of ROUTES.filter(x => x.samengesteld)) {
    const k = r.bestand + ':' + r.regel;
    perPlek.set(k, (perPlek.get(k) || 0) + 1);
  }
  assert.ok(perPlek.size > 0, 'er hoort minstens een samengestelde registratie te zijn');
  for (const [k, n] of perPlek) {
    assert.ok(n < 200, k + ' claimt ' + n + ' routes; dat ruikt naar een te kort voorvoegsel');
  }
});
