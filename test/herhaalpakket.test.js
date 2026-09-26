/* HET HERHAALPAKKET EN DE HERHAALMATRIX (scripts/lib/herhaalpakket.js,
   BEWIJSLUS.md par. 5).

   Het vaste pakket test/fixtures/herhaalpakket-verzoekrace.json is ECHT: gemaakt
   met `npm run herhaalpakket -- maak` op f9417aed, de commit van voor de
   reparatie van de dubbele betaling (par. 3a). Twee stappen: een verzoek van een
   cent, en twee gelijktijdige betalingen met elk een eigen sleutel. De matrix gaf
   op 25 september 2026:

     f3bab5a1^    breekt  (E2 -> E3)     de commit van voor de reparatie
     origin/main  breekt  (E2 -> E3)     main had de reparatie nog niet
     f3bab5a1     houdt                  de reparatie
     HEAD         houdt

   Wat hier bewezen wordt:
   1. DE REPARATIE HOUDT, in pakketvorm. Hetzelfde pakket op deze checkout: houdt.
   2. HET PAKKET KAN BREKEN, en herhaalt zich. Met een sabotage breekt het, twee
      keer achter elkaar op dezelfde manier (LAT.md regel 10: een meter die niet
      kan uitslaan, meet niets).
   3. EEN ANDERE WET IS EEN ANDERE UITKOMST. Breekt er een andere wet, dan heet
      dat `breekt-anders` en nooit `breekt`.
   4. GEEN ALIASSEN. Een gemaakt pakket draagt rollen en geen codenamen, en de
      grendel weigert zodra er toch een doorheen komt.
   5. EEN KOLOM DIE NIET KON DRAAIEN IS NIET GROEN. Een onbekende commit geeft
      `niet vast te stellen` en uitgang 2; de werkende kolom zegt `houdt`.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - in speelNa() `breekt-anders` samenvallen met `breekt`   -> toets 3 zakt
   - in maakPakket() de grendel weghalen                     -> toets 4b zakt
   - in kolom() een mislukte worktree `houdt` laten heten    -> toets 5 zakt

   Draai los: node --test test/herhaalpakket.test.js */
'use strict';
process.env.RTG_SIMULATIEBANK = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MOLLIE_API_KEY;
delete process.env.ADYEN_API_KEY;
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const cp = require('child_process');
const hp = require('../scripts/lib/herhaalpakket');
const tv = require('../scripts/lib/tegenvoorbeeld');

const PAKKET = require('./fixtures/herhaalpakket-verzoekrace.json');
const SPELERS = tv.maakWereld().spelers;

/* Een betaald verzoek krijgt een tweede klompje-regel (zelfde als in
   test/tegenvoorbeeld.test.js, sabotage C). */
const verzoekTweeKeer = (pay, db) => {
  const echt = pay.verzoekBetaal;
  pay.verzoekBetaal = async (a) => {
    const r = await echt(a);
    if (r && r.ok) {
      const rij = db.data.payBoekingen.filter(x => x.soort === 'klompje' && x.ref === a.verzoekId).pop();
      if (rij) db.data.payBoekingen.push(Object.assign({}, rij, { id: rij.id + '-X' }));
    }
    return r;
  };
};
/* Na een geslaagde betaling een cent erbij zonder tegenboeking: breekt de
   sluitcontrole, een ANDERE wet dan die van het pakket. */
const centErbij = (pay, db) => {
  const echt = pay.verzoekBetaal;
  pay.verzoekBetaal = async (a) => {
    const r = await echt(a);
    if (r && r.ok) db.data.paySaldi[pay.rekLid(a.codenaam)] += 1;
    return r;
  };
};

test('1. het echte pakket van voor de reparatie houdt op deze checkout', async () => {
  assert.equal(PAKKET.verwacht.schending.wet, 'een verzoek wordt ten hoogste een keer betaald');
  assert.equal(PAKKET.herkomst.artefact.commit.slice(0, 8), 'f9417aed', 'gemaakt op de commit van voor de reparatie');
  const r = await hp.speelNa(PAKKET);
  assert.equal(r.uitkomst, 'houdt', JSON.stringify(r));
  assert.equal(r.schending, null);
});

test('2. met een sabotage breekt het, twee keer op dezelfde manier', async () => {
  const a = await hp.speelNa(PAKKET, { sabotage: verzoekTweeKeer });
  const b = await hp.speelNa(PAKKET, { sabotage: verzoekTweeKeer });
  assert.equal(a.uitkomst, 'breekt', JSON.stringify(a));
  assert.deepEqual({ s: a.schending, d: a.divergentie }, { s: b.schending, d: b.divergentie }, 'hetzelfde pakket, dezelfde logische uitkomst');
});

test('3. een andere wet is breekt-anders en geen breekt', async () => {
  const r = await hp.speelNa(PAKKET, { sabotage: centErbij });
  assert.equal(r.schending && r.schending.wet, 'geld-conservatie');
  assert.equal(r.uitkomst, 'breekt-anders');
});

test('4a. een gemaakt pakket draagt rollen en geen codenamen', async () => {
  const u = await tv.zoek({ zaad: 3, reeksen: 40, lengte: 10, spelers: SPELERS,
    maak: () => tv.maakWereld({ sabotage: verzoekTweeKeer }) });
  assert.equal(u.gevonden, true);
  const p = await hp.maakPakket(u, { zaad: 3, reeksen: 40, lengte: 10 });
  const tekst = JSON.stringify(p);
  for (const naam of SPELERS.concat(tv.ONBEKEND)) assert.ok(!tekst.includes(naam), 'codenaam ' + naam + ' in het pakket');
  assert.ok(/speler-\d/.test(tekst), 'de deelnemers staan er als rol in');
  assert.equal(p.begintoestand.soort, 'leeg');
  assert.deepEqual(Object.keys(p.bevatNiet).sort(), ['aliassen', 'productie', 'ruweGegevens']);
  assert.ok(p.voorbehoud.some(v => /klok/.test(v)), 'dat de klok niet is vastgezet, staat erin');
});

test('4b. de grendel weigert een pakket waar een codenaam doorheen komt', async () => {
  const u = await tv.zoek({ zaad: 3, reeksen: 40, lengte: 10, spelers: SPELERS,
    maak: () => tv.maakWereld({ sabotage: verzoekTweeKeer }) });
  u.stappen[0].ops[0].notitie = SPELERS[0];   // een veld dat de rolomzetting niet kent
  await assert.rejects(hp.maakPakket(u, { zaad: 3, reeksen: 40, lengte: 10 }), /codenaam/);
});

test('5. de matrix: een onbekende commit is niet vast te stellen, en HEAD houdt', () => {
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'herhaalpakket.js'), 'matrix',
    path.join(__dirname, 'fixtures', 'herhaalpakket-verzoekrace.json'), '--tegen=bestaat-niet-als-commit,HEAD'],
  { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 300000, env: Object.assign({}, process.env, { RTG_SIMULATIEBANK: '1' }) });
  const uit = r.stdout || '';
  assert.match(uit, /bestaat-niet-als-commit\s+niet vast te stellen/, uit + (r.stderr || ''));
  assert.match(uit, /HEAD\s+\S+\s+houdt/, uit + (r.stderr || ''));
  assert.equal(r.status, 2, 'een kolom die niet kon draaien laat de matrix niet groen eindigen');
});
