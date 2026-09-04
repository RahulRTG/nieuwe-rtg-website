/* DE APPBRUG (kern/mobiliteit/appbrug.js) -- van app-rit naar vervoersopdracht.

   Het besluit erachter staat in MAATSTAF.md par. 7.5: er waren twee ritwerelden
   die niets van elkaar wisten, en de OPDRACHT wordt de waarheid. De keten zelf
   draait in scripts/ritproef.js; hier staan de dingen die met een nagebootste
   opdrachtlaag veel scherper te ondervragen zijn dan over HTTP -- vooral het
   pad door de keten en de vertaling van de standen.

   DE GEVAARLIJKSTE TOETS IS NUMMER 4. `rijdt` betekent in de twee werelden iets
   verschillends: in `rides` een verouderde naam VOOR aan-boord (RIT_LEGACY mapt
   hem weg), in de opdrachtketen een eigen stand NA ingestapt. Wie de lijsten
   zonder vertaaltabel aan elkaar knoopt, zet een rit die net is ingestapt op
   "rijdt", of andersom.

   Draai los: node --test test/appbrug.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakBrug = require('../server/kern/mobiliteit/appbrug');
const keten = require('../server/kern/mobiliteit/keten');

/* Een nagebootste opdrachtlaag: hij houdt standen bij en handhaaft dezelfde
   keten als de echte (magNaar uit ./keten.js), zodat een pad dat hier loopt ook
   daar loopt. Wat hij NIET doet is prijzen, plekken of modules -- die poorten
   horen bij opdrachtMaak en worden in de ritproef over HTTP gemeten. */
function opstelling({ maakFaalt } = {}) {
  const opdrachten = new Map();
  let n = 0;
  const gezet = [];
  const brug = maakBrug({
    keten,
    opdrachtMaak: () => {
      if (maakFaalt) return { status: 400, error: maakFaalt };
      const ref = 'RTG-M-' + (++n);
      opdrachten.set(ref, { ref, status: 'aangevraagd' });
      return { ok: true, opdracht: { ref } };
    },
    opdrachtMet: (ref) => opdrachten.get(ref) || null,
    opdrachtNaar: (ref, stand) => {
      const o = opdrachten.get(ref);
      if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
      const check = keten.magNaar(o.status, stand);
      if (!check.mag) return { status: 409, error: check.reden };
      o.status = stand;
      gezet.push(stand);
      return { ok: true };
    }
  });
  return { brug, opdrachten, gezet };
}

const rit = (extra) => Object.assign({ ref: 'RTG-R-1', supplierCode: 'ISLATR', toCode: 'KIKUNOI',
  passengers: 2, status: 'aangevraagd' }, extra || {});
const sessie = { key: 'lid1', tier: 'rtg' };

test('1. een rit met een zaak als bestemming krijgt een opdracht', () => {
  const { brug, opdrachten } = opstelling();
  const uit = brug.opdrachtBijRit(rit(), sessie, {});
  assert.equal(uit.ok, true);
  assert.ok(opdrachten.get(uit.ref), 'de opdracht is niet aangemaakt');
});

test('2. een bestemming die alleen een tekst is, geeft geen opdracht maar wel een reden', () => {
  const { brug } = opstelling();
  const uit = brug.opdrachtBijRit(rit({ toCode: null, to: 'Haven' }), sessie, {});
  assert.equal(uit.ok, false);
  assert.match(uit.reden, /tekst/i, 'de reden zegt niet wat er aan de hand is');
  assert.ok(uit.reden.length > 60, 'een reden die niets uitlegt is een etiket');
});

test('3. een opdrachtlaag die weigert of stukgaat, breekt de rit niet', () => {
  /* Punt 1 uit de kop: een besluit uitvoeren mag geen aanvragen weigeren die
     gisteren nog gewoon doorgingen. */
  const a = opstelling({ maakFaalt: 'Dit vervoer is hier niet beschikbaar.' });
  const u1 = a.brug.opdrachtBijRit(rit(), sessie, {});
  assert.equal(u1.ok, false);
  assert.match(u1.reden, /niet beschikbaar/);

  const stuk = maakBrug({ keten, opdrachtMaak: () => { throw new Error('kapot'); },
    opdrachtMet: () => null, opdrachtNaar: () => ({ ok: true }) });
  const u2 = stuk.opdrachtBijRit(rit(), sessie, {});
  assert.equal(u2.ok, false, 'een uitzondering in de opdrachtlaag hoort te worden opgevangen');
  assert.match(u2.reden, /kapot/);
});

test('4. de standen worden VERTAALD: aan-boord wordt ingestapt, nooit rijdt', () => {
  const T = brugTabel();
  assert.equal(T['aan-boord'], 'ingestapt',
    'aan-boord vertaalt niet naar ingestapt; `rijdt` is in de opdrachtketen een ANDERE stand');
  assert.equal(T.afgerond, 'voltooid');
  assert.ok(!Object.values(T).includes('rijdt'),
    'een ritstand vertaalt naar "rijdt" -- dat woord betekent in de twee werelden niet hetzelfde');
  /* Elke ritstand die vertaalt, moet in de opdrachtketen bestaan. */
  for (const [van, naar] of Object.entries(T))
    assert.ok(keten.KETEN.includes(naar), van + ' -> ' + naar + ': die stand staat niet in de opdrachtketen');
});
function brugTabel() { return maakBrug.STAND_NAAR_OPDRACHT; }

test('5. de brug loopt het PAD door de fijnere opdrachtketen', () => {
  /* aangevraagd -> geaccepteerd is in de ritketen een stap en in de
     opdrachtketen drie. Zonder pad zou de opdracht op `aangevraagd` blijven
     staan -- precies wat de eerste versie deed. */
  const { brug, opdrachten, gezet } = opstelling();
  const r = rit();
  r.opdrachtRef = brug.opdrachtBijRit(r, sessie, {}).ref;

  const a = brug.standDoor(r, 'geaccepteerd');
  assert.equal(a.ok, true);
  assert.deepEqual(a.stappen, ['geprijsd', 'aangeboden', 'geaccepteerd'],
    'de tussenstappen van de opdrachtketen worden overgeslagen');
  assert.equal(opdrachten.get(r.opdrachtRef).status, 'geaccepteerd');

  brug.standDoor(r, 'onderweg');
  brug.standDoor(r, 'aangekomen');
  const b = brug.standDoor(r, 'aan-boord');
  assert.equal(opdrachten.get(r.opdrachtRef).status, 'ingestapt');
  assert.deepEqual(b.stappen, ['ingestapt']);

  const c = brug.standDoor(r, 'afgerond');
  assert.deepEqual(c.stappen, ['rijdt', 'voltooid'],
    'van ingestapt naar voltooid loopt via rijdt; dat is de fijnere keten');
  assert.equal(opdrachten.get(r.opdrachtRef).status, 'voltooid');
  assert.ok(gezet.length >= 8, 'er zijn minder gebeurtenissen gezet dan de keten kent');
});

test('6. het pad gaat nooit via een uitzonderingsstand', () => {
  const { brug } = opstelling();
  for (const doel of ['onderweg', 'aangekomen', 'ingestapt', 'voltooid']) {
    const pad = brug.padNaar('aangevraagd', doel) || [];
    for (const stap of pad)
      assert.ok(keten.KETEN.includes(stap),
        'het pad naar ' + doel + ' loopt via "' + stap + '", en dat is geen stand uit de hoofdketen');
    assert.ok(!pad.includes('incident') && !pad.includes('geannuleerd'),
      'een pad dat via incident of geannuleerd loopt, verzint een gebeurtenis die niet plaatsvond');
  }
});

test('7. een rit zonder opdracht laat de stand stil met een reden, en gaat niet stuk', () => {
  const { brug } = opstelling();
  const uit = brug.standDoor(rit(), 'onderweg');
  assert.equal(uit.ok, false);
  assert.match(uit.reden, /geen opdracht/i);
});

test('8. een stand zonder tegenhanger wordt niet stilzwijgend vertaald', () => {
  /* `geweigerd` heeft in de opdrachtketen een eigen weg (annuleren) en hoort
     niet op een keten-stand te belanden. */
  const { brug, opdrachten } = opstelling();
  const r = rit();
  r.opdrachtRef = brug.opdrachtBijRit(r, sessie, {}).ref;
  const uit = brug.standDoor(r, 'geweigerd');
  assert.equal(uit.ok, false);
  assert.match(uit.reden, /geen tegenhanger/i);
  assert.equal(opdrachten.get(r.opdrachtRef).status, 'aangevraagd', 'er is toch iets gezet');
});

test('9. de brug schrijft nooit terug van opdracht naar rit', () => {
  const bronTekst = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'mobiliteit', 'appbrug.js'), 'utf8');
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const kaal = zonderCommentaar(bronTekst);
  assert.doesNotMatch(kaal, /ride\.status\s*=|ride\.driver\s*=|rides\[/,
    'de brug schrijft in de rit; twee lijsten die elkaar bijwerken hebben geen waarheid meer');
});

test('10. wat de brug niet kan, staat in de code en niet alleen in een document', () => {
  const N = maakBrug.NIET_OVERBRUGD;
  assert.ok(N['terug-naar-de-rit'] && N['bestemming-als-tekst'] && N['bestaande-ritten']);
  for (const [k, v] of Object.entries(N))
    assert.ok(v.length > 60, k + ': de reden is te kort om een grens te zijn');
});
