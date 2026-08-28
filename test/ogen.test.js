/* DE OGENREGEL OP EEN PLEK.

   "Dezelfde ogen tellen niet dubbel" stond in vier formuleringen in huis en
   werd op vijf plekken gebruikt: de documentenuitgifte, de naheffingsaanslag,
   het bezwaar, het dwangbevel en de kwijtschelding. Vijf beweringen:

   1. DE VERGELIJKING TRIMT EN NEGEERT HOOFDLETTERS -- en twee LEGE namen zijn
      niet dezelfde persoon, want dan zouden twee ongetekende plekken elkaar
      opheffen.
   2. MEETEKENEN WEIGERT MET EEN REDEN, niet met een stille false.
   3. HET REGISTER ZEGT WAT ELKE HANDELING VRAAGT, en zegt er eerlijk bij dat er
      GEEN bedrag-grens is vastgesteld. Dat is een bestuurlijk besluit; een
      verzonnen grens die stilzwijgend gaat gelden is erger dan geen grens.
   4. EEN ONBEKENDE HANDELING BELOOFT NIETS -- geen stilzwijgend "twee ogen is
      vast genoeg".
   5. DE REGEL GELDT ECHT waar hij hoort te gelden: de naheffing en de uitgifte
      gebruiken hem, en niet elk hun eigen kopie.

   Draai los: node --experimental-sqlite --test test/ogen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ogen = require('../server/kern/ogen');

test('de vergelijking trimt en negeert hoofdletters; leeg is nooit dezelfde persoon', () => {
  assert.equal(ogen.zelfdeOgen('A. Bakker', 'a. bakker'), true);
  assert.equal(ogen.zelfdeOgen('A. Bakker', ' A. Bakker '), true);
  assert.equal(ogen.zelfdeOgen('A. Bakker', 'M. de Wit'), false);
  /* De twee die ertoe doen: niets is nooit gelijk aan niets. Anders zou een
     ongetekende plek een andere ongetekende plek blokkeren -- of erger, als
     "al getekend" tellen. */
  assert.equal(ogen.zelfdeOgen('', ''), false);
  assert.equal(ogen.zelfdeOgen(null, undefined), false);
  assert.equal(ogen.zelfdeOgen('  ', ''), false);
});

test('meetekenen weigert met een reden', () => {
  const eerder = [{ door: 'A. Bakker' }];
  assert.equal(ogen.magMeetekenen(eerder, 'M. de Wit').ok, true);

  const zelfde = ogen.magMeetekenen(eerder, ' a. bakker ');
  assert.equal(zelfde.status, 409);
  assert.match(zelfde.error, /ANDERE/);
  // de rol komt in de zin, zodat de melding op zijn plek klopt
  assert.match(ogen.magMeetekenen(eerder, 'A. Bakker', 'inspecteur').error, /ANDERE inspecteur/);

  // een handtekening staat altijd op naam
  assert.equal(ogen.magMeetekenen([], 'X').status, 400);
  assert.equal(ogen.magMeetekenen([], '   ').status, 400);
  // hij neemt zowel een lijst objecten als losse namen aan
  assert.equal(ogen.magMeetekenen(['A. Bakker'], 'a. bakker').status, 409);
  assert.equal(ogen.magMeetekenen('A. Bakker', 'M. de Wit').ok, true);
});

test('het register zegt wat een handeling vraagt, en dat er geen bedrag-grens is', () => {
  const nh = ogen.eist('naheffing.vaststellen');
  assert.equal(nh.bekend, true);
  assert.equal(nh.ogen, 4, 'twee mensen');
  assert.equal(nh.wat, 'inspecteur');
  assert.equal(nh.drempelsVastgesteld, true, 'voor de naheffing IS er een grens gezet');

  // het bezwaar vraagt er meer: de opmaker en de vaststeller beslissen niet mee
  assert.equal(ogen.eist('naheffing.bezwaar').ogen, 6);

  /* DE GRENS DIE EEN MENS HEEFT GEZET: boven 25.000 euro tekent er een derde
     inspecteur mee. Op de cent van de grens telt hij al mee -- een grens die
     pas een cent later ingaat, is een grens waar niemand op rekent. */
  assert.equal(ogen.eist('naheffing.vaststellen', { bedragCenten: 2499999 }).ogen, 4);
  assert.equal(ogen.eist('naheffing.vaststellen', { bedragCenten: 2500000 }).ogen, 6);
  assert.match(ogen.eist('naheffing.vaststellen', { bedragCenten: 2500000 }).grond, /25000 euro/);

  /* En waar GEEN grens is gezet, verandert een bedrag niets en wordt er ook
     niets gesuggereerd. Dat onderscheid is het punt van dit register. */
  const dw = ogen.eist('naheffing.dwangbevel', { bedragCenten: 500000000 });
  assert.equal(dw.ogen, 4);
  assert.equal(dw.drempelsVastgesteld, false);
  assert.match(dw.let, /geen bedrag-grens vastgesteld/i);

  // de uitgifte kent geen vast getal: de aanvrager kiest 4 of 6
  const ug = ogen.eist('uitgifte.vrijgeven');
  assert.equal(ug.ogen, null);
  assert.match(ug.let, /aanvrager/i);

  assert.ok(ogen.alles().length >= 5, 'alle handelingen zijn op te sommen');
});

test('een onbekende handeling belooft niets', () => {
  const o = ogen.eist('iets.nieuws');
  assert.equal(o.bekend, false);
  assert.equal(o.ogen, null, 'geen stilzwijgend "twee ogen is vast genoeg"');
  assert.match(o.let, /niets over vastgelegd/i);
});

test('de regel geldt echt in de uitgifte en in de naheffing', () => {
  const { maakUitgifte } = require('../server/kern/uitgifte');
  const db = { data: {} };
  const { uitgifte } = maakUitgifte({ db, save: () => {}, crypto });

  const u = uitgifte.start('zaak', 'MERIDIAAN', 'A. Bakker', { bron: 'facturen', ogen: 4 });
  assert.ok(u.ok, u.error);
  const id = u.uitgifte.id;

  // dezelfde persoon, met spaties en andere hoofdletters, telt niet als tweede
  const zelf = uitgifte.teken('zaak', 'MERIDIAAN', id, ' a. bakker ');
  assert.equal(zelf.status, 409, 'de aanvrager tekent zijn eigen uitgifte niet af');
  assert.match(zelf.error, /ANDERE/);

  // een ander mag wel, en dan is hij vrijgegeven
  const ander = uitgifte.teken('zaak', 'MERIDIAAN', id, 'M. de Wit');
  assert.ok(ander.ok, ander.error);
});
