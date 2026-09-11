/* WELKE KAMER EEN ROUTE KRIJGT -- EN OF DE REGEL DIE DAT ZEGT OOK VUURT.

   server/kern/magnaat-kantoorregels/ wijst elke route een kantoorkamer toe met
   een lijst regels die op VOLGORDE wordt afgelopen: de eerste die matcht wint.
   De kop van tabel-lid.js zegt het zelf -- volgorde is gedrag.

   DE FAALVORM DIE HIER WORDT DICHTGEZET. De terugval "Onderzoek & data" is met
   opzet rood en wordt bewaakt (test/magnaat-capabilities.test.js: "de
   kantoormatrix bevat geen stil vangnet meer"). Maar een regel die door een
   BREDERE regel wordt overschaduwd valt daar niet in: hij geeft gewoon een
   kamer terug, alleen niet de zijne. Dat ziet er van buiten identiek uit aan
   een werkende regel.

   Dat is geen theorie. Bij het samenvoegen van drie takken bleken twee regels
   uit RTG Carriere nooit te vuren: `/api/office/voogdij` en de office-helft van
   `/api/(office/)?rugdekking` stonden in ./tabel-lid.js, die ACHTER
   ./tabel-platform.js wordt geplakt, en daar pakt `/\/api\/office\b/` alles wat
   met /api/office begint. Vijf routes kwamen uit op Intern & IT terwijl hun
   eigen regel Juridisch en Financien zei -- een beursbesluit, geld dat het huis
   verlaat, stond in de kamer voor toegangsbeheer. Geen enkele toets zag het.

   DE CORPUS KOMT UIT DE ROUTER en niet uit een register: ROUTEBRON.json liep bij
   het schrijven hiervan 1389 codebestanden achter, en een wachter die op een
   verouderde lijst kijkt, meldt dat er niets aan de hand is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { alleRoutes } = require('../scripts/lib/routes.js');
const REGELS = require('../server/kern/magnaat-kantoorregels/tabel');
const kamerVoor = require('../server/kern/magnaat-kantoorregels.js');

/* De vijf routes van de vondst hierboven, met de kamer die hun eigen regel
   noemt. Expliciet uitgeschreven en niet afgeleid: dit is precies het geval dat
   een afleiding niet zag. */
const CARRIERE = [
  ['/api/office/voogdij/besluit', 'juridisch'],
  ['/api/office/rugdekking/alle', 'financien'],
  ['/api/office/rugdekking/stel', 'financien'],
  ['/api/office/rugdekking/stop', 'financien'],
  ['/api/office/rugdekking/beurs', 'financien'],
];

/* Regels die AL overschaduwd waren voordat deze wachter er stond, op hun
   regexbron en niet op hun nummer -- een nummer schuift zodra iemand een regel
   toevoegt, en dan wijst de uitzondering naar de verkeerde regel.

   Ze staan hier met wat ze vandaag krijgen in plaats van dat ze weg zijn
   gepoetst. Elk van de vier vraagt een besluit over welke kamer de juiste is
   (dat is productwerk en geen bedradingsfout), en tot dat besluit valt mag hun
   aantal alleen dalen. */
const AL_OVERSCHADUWD = new Map([
  ["\\/cellier|\\/cercle|\\/concierge|\\/zaal|\\/entourage|\\/garderobe|\\/ghost|\\/hangar|\\/lifestyle|\\/horloge|\\/uitzicht|\\/maison|\\/mecenaat|\\/pulse|\\/rendezvous",
    'klantenservice, support, verkoop, financien, creatief en intern pakken deze paden eerder'],
  ["\\/klankwerk|\\/camera|\\/oog\\b|\\/media\\.html", 'hr en support pakken deze paden eerder'],
  ["\\/nalatenschap", 'klantenservice pakt dit pad eerder'],
  ["\\/magnaat\\.html|\\/rtg\\.html|\\/logboek", 'support, boardroom en klantenservice pakken deze paden eerder'],
]);

let paden = null;
async function routepaden() {
  if (paden) return paden;
  const rs = await alleRoutes();
  paden = [...new Set(rs.map(r => r.pad || r.route || r.path).filter(Boolean))];
  return paden;
}

test('1. de vijf carriere-routes landen in de kamer die hun eigen regel noemt', () => {
  for (const [pad, kamer] of CARRIERE) {
    const k = kamerVoor(pad);
    assert.equal(k.id, kamer, pad + ' hoort in ' + kamer + ' en staat in ' + k.id);
    assert.equal(k.toewijzing, 'regel', pad + ' krijgt zijn kamer uit de terugval en niet uit een regel');
  }
});

test('2. geen nieuwe regel wordt door een bredere regel overschaduwd', async () => {
  const alle = await routepaden();
  const overschaduwd = [];
  REGELS.forEach((regel, i) => {
    const treffers = alle.filter(p => regel[0].test(p));
    /* Geen enkele bestaande route raakt hem: dan is er niets te overschaduwen en
       ook niets bewezen. Dat is geen bevinding -- een regel mag vooruitlopen op
       een route die er nog niet is. */
    if (!treffers.length) return;
    if (treffers.some(p => kamerVoor(p).regel === i + 1)) return;
    overschaduwd.push({ bron: regel[0].source, kamer: regel[1], nummer: i + 1 });
  });
  const nieuw = overschaduwd.filter(o => !AL_OVERSCHADUWD.has(o.bron));
  assert.deepEqual(nieuw, [],
    'deze regel(s) vuren op geen enkele bestaande route, want een eerdere regel pakt ze af: ' +
    nieuw.map(o => 'regel ' + o.nummer + ' (' + o.bron.slice(0, 40) + ' -> ' + o.kamer + ')').join('; '));
});

test('3. de vier bekende overschaduwde regels bestaan nog, en het zijn er niet meer', async () => {
  const alle = await routepaden();
  const overschaduwd = new Set();
  REGELS.forEach((regel, i) => {
    const treffers = alle.filter(p => regel[0].test(p));
    if (treffers.length && !treffers.some(p => kamerVoor(p).regel === i + 1)) overschaduwd.add(regel[0].source);
  });
  assert.ok(overschaduwd.size <= AL_OVERSCHADUWD.size,
    'het aantal overschaduwde regels mag alleen dalen: ' + overschaduwd.size + ' tegen ' + AL_OVERSCHADUWD.size);
  /* Een uitzondering die niet meer nodig is, hoort weg -- anders dekt de lijst
     op een dag iets af wat er wel toe doet. */
  for (const bron of AL_OVERSCHADUWD.keys()) {
    if (!REGELS.some(r => r.source === bron)) continue;   // regel zelf is weg: prima
    assert.ok(overschaduwd.has(bron),
      'deze regel is niet meer overschaduwd; haal hem uit AL_OVERSCHADUWD: ' + bron);
  }
});
