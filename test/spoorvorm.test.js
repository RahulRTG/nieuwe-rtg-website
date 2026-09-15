/* DE CONVERGENTIEMATRIX -- meet hij wat hij zegt te meten?

   Deze meter beoordeelt code op vier eigenschappen, en op de echte boom haalt
   precies één mechanisme ze alle vier. Zo'n uitslag is gevaarlijk: een meter die
   niets herkent geeft dezelfde matrix als een huis dat niets vastlegt. Daarom
   staat hier naast de gedragstoetsen een stel VERZONNEN lijven waarop hij
   aantoonbaar moet uitslaan.

   Toets 4 is de belangrijkste en hij bestaat omdat de meter er op 15 september
   2026 op ZAKTE: V-3 vergeleek het spoor met de eerste status-return in het
   lijf, en dat is in de referentie de 404 "U heeft deze machtiging niet" -- een
   voorwaarde-uitgang die vóór het oordeel ligt. De referentie zakte daardoor op
   de eigenschap die zij zelf definieert. Een geldige uitslag van het verkeerde
   experiment (BEWIJSMACHINE.md par. 6a), gevonden door de besturingsproef in de
   meter en niet door een mens.

   Draai los: node --test test/spoorvorm.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../scripts/spoorvorm');

const WORTEL = path.join(__dirname, '..');

/* Een lijf dat alle vier de eigenschappen voert -- de vorm van de referentie,
   uitgekleed tot wat de meter hoort te herkennen. */
const GOED = `{
  const gevonden = zoek(x);
  if (!gevonden) return { status: 404, error: 'niet van u' };
  const oordeel = magHandelen(m, b);
  const regel = { soort: 'handeling', gelukt: !!oordeel.mag, reden: oordeel.reden };
  const mis = await vastleggen(() => spoor(clientKey, regel));
  if (mis) return mis;
  if (!oordeel.mag) return { status: 403, error: oordeel.reden };
  return { status: 200, ok: true };
}`;

test('1. de vier eigenschappen worden herkend op een lijf dat ze alle vier voert', () => {
  const r = S.beoordeel(GOED);
  assert.deepEqual([r.V1, r.V2, r.V3, r.V4], [true, true, true, true]);
  assert.equal(r.gehaald, 4);
});

test('2. MUTATIE: zonder duurzame weg zakt V-4, en alleen V-4', () => {
  /* Het spoor wordt nog geschreven en staat nog op de goede plek -- het kan de
     handeling alleen niet meer tegenhouden. Dat is precies het verschil met
     scripts/stilspoor.js, die deze vorm niet als gebrek ziet. */
  const r = S.beoordeel(GOED.replace('const mis = await vastleggen(() => spoor(clientKey, regel));\n  if (mis) return mis;',
    'spoor(clientKey, regel);'));
  assert.deepEqual([r.V1, r.V2, r.V3], [true, true, true], 'de andere drie blijven staan');
  assert.equal(r.V4, false, 'maar het spoor houdt niets meer tegen');
});

test('3. MUTATIE: een duurzame weg waarvan niemand de uitslag leest, haalt V-4 niet', () => {
  /* De scherpste vorm: er staat `vastleggen(...)`, dus het LIJKT te kunnen
     weigeren. Wie de uitslag weggooit, heeft een belofte en geen grendel. */
  const r = S.beoordeel(GOED.replace('const mis = await vastleggen(() => spoor(clientKey, regel));\n  if (mis) return mis;',
    'await vastleggen(() => spoor(clientKey, regel));'));
  assert.equal(r.V4, false, 'een genegeerde uitslag is geen grendel');
  assert.equal(r.V1, true, 'er wordt nog wel geschreven');
});

test('4. een VOORWAARDE-uitgang vóór het oordeel laat V-3 staan', () => {
  /* De fout die de besturingsproef vond. `return { status: 404 }` staat vóór het
     oordeel en zegt "dit gaat niet over u" -- niet "dit mag niet". Zou die
     meetellen, dan zakt de referentie op de eigenschap die zij definieert.

     ZAKT OP: in scripts/spoorvorm.js V-3 weer tegen de EERSTE uitkomst-return
     leggen in plaats van tegen de eerste ná het oordeel. */
  assert.equal(S.beoordeel(GOED).V3, true, 'de 404 ervóór telt niet mee');

  const zonderVoorwaarde = GOED.replace("  if (!gevonden) return { status: 404, error: 'niet van u' };\n", '');
  assert.equal(S.beoordeel(zonderVoorwaarde).V3, true, 'en zonder die uitgang blijft hij ook staan');
});

test('5. MUTATIE: het spoor NA de uitkomst laat V-3 zakken', () => {
  const na = `{
  const oordeel = magHandelen(m, b);
  if (!oordeel.mag) return { status: 403, error: oordeel.reden };
  const regel = { gelukt: !!oordeel.mag };
  const mis = await vastleggen(() => spoor(clientKey, regel));
  if (mis) return mis;
  return { status: 200, ok: true };
}`;
  const r = S.beoordeel(na);
  assert.equal(r.V3, false, 'een geweigerde handeling komt hier nooit langs het spoor');
  assert.equal(r.V2, true, 'de regel draagt het oordeel nog wel -- daarom is V-2 alleen niet genoeg');
});

test('6. MUTATIE: een spoor binnen de toegestane tak haalt V-2 niet', () => {
  const alleenJa = `{
  const oordeel = magHandelen(m, b);
  if (!oordeel.mag) return { status: 403, error: oordeel.reden };
  const mis = await vastleggen(() => spoor(clientKey, { soort: 'handeling' }));
  if (mis) return mis;
  return { status: 200, ok: true };
}`;
  const r = S.beoordeel(alleenJa);
  assert.equal(r.V1, true, 'toegestaan wordt vastgelegd');
  assert.equal(r.V2, false, 'geweigerd niet: de regel draagt geen oordeel');
});

test('7. ONBEPAALD is geen NEE: zonder oordeelsvariabele geeft V-3 null met een reden', () => {
  /* Een meter die niet kan bepalen, hoort dat te zeggen. Zou hij `false`
     invullen, dan leest een tekort van de meter als een gebrek van het huis. */
  const vaag = `{
  const mis = await vastleggen(() => spoor(k, { soort: 'iets' }));
  if (mis) return mis;
  return { status: 200, ok: true };
}`;
  const r = S.beoordeel(vaag);
  assert.equal(r.V3, null);
  assert.match(r.V3reden, /niet bepalen|kan niet/i);
});

test('8. BESTURINGSPROEF: de referentie haalt vier van vier op de ECHTE boom', () => {
  /* Zonder deze regel bewijzen de verzonnen lijven hierboven alleen dat de
     regexen werken, en niets over het huis.

     WAT DEZE TOETS WEL EN NIET BEWAAKT, en dat staat er omdat een mutatie het
     heeft laten zien. De inhoudelijke eigenschap -- de referentie scoort vier
     van vier -- wordt hieronder hard getoetst. Het VELD `besturing.inOrde` is
     een gemak voor de opdrachtregel (het bepaalt de foutcode), en wie dat veld
     hardcodeert op `true` wordt door geen enkele toets gezien zolang de
     referentie toch vier haalt. Dat is aanvaard en niet gerepareerd: de
     eigenschap is bewaakt, de vlag is een afgeleide ervan. Wordt de vlag ooit
     de enige plek waar het oordeel valt, dan hoort hier een proef bij die hem
     ziet omslaan. */
  const uit = S.meet();
  const ref = uit.rijen.find(r => r.referentie);
  assert.ok(ref, 'er is een referentierij');
  assert.equal(ref.mechanisme, 'vertegenwoordiging');
  assert.equal(ref.gehaald, 4, 'de referentie definieert de vorm en moet hem dus halen');
  assert.equal(uit.besturing.inOrde, true);
});

test('9. elke rij noemt een BESTAAND bestand en een gevonden ingang, of zegt waarom niet', () => {
  const uit = S.meet();
  assert.equal(uit.rijen.length, 7, 'zeven mechanismen, dezelfde als in NAMENSVORM.json');
  for (const r of uit.rijen) {
    assert.ok(r.bestandenGevonden.length > 0, r.mechanisme + ': geen van de opgegeven bestanden bestaat');
    if (!r.ingangGevonden) {
      assert.ok(r.reden && r.reden.length > 40,
        r.mechanisme + ': een niet-gevonden ingang hoort een reden te dragen, want dat is een tekort van ' +
        'DEZE meter en geen uitspraak over het mechanisme');
      assert.equal(r.V1, null, 'en dan staat er geen oordeel');
    }
    assert.ok(r.waarom && r.waarom.length > 20, r.mechanisme + ': de indeling hoort verklaard te zijn');
  }
});

test('10. de uitslag kruist met NAMENSVORM.json, dat spoor onafhankelijk telde', () => {
  /* Twee meters, apart gebouwd, dezelfde zeven mechanismen. NAMENSVORM telde op
     de WERKWOORD-as hoeveel mechanismen `spoor` voeren; deze telt hoeveel er iets
     vastleggen. Lopen die uiteen, dan is er iets mis met een van beide -- en dan
     hoort dat op te vallen in plaats van weggemiddeld te worden. */
  const p = path.join(WORTEL, 'NAMENSVORM.json');
  if (!fs.existsSync(p)) return;                       // register niet in deze boom
  const nv = JSON.parse(fs.readFileSync(p, 'utf8'));
  const uit = S.meet();
  assert.ok(uit.gemeten.metSpoor >= 1 && uit.gemeten.metSpoor <= 7);
  assert.equal(uit.gemeten.mechanismen, (nv.gemeten && nv.gemeten.werkwoord
    ? nv.gemeten.werkwoord.mechanismen : 7), 'beide meters praten over evenveel mechanismen');
});
