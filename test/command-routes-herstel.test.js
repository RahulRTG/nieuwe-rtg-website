/* ============================================================================
   DE HERSTELROUTES VAN RTG COMMAND -- runbooks, zaken, de operator, de zandbak
   en de eerste stap van een overname.

   De tegenhanger van test/command-routes-bestuur.test.js: daar staat wat er
   BESLOTEN wordt, hier wat er GEDAAN wordt. Ook hier gaat het om de bedrading
   plus het gedrag dat mis kan gaan, en niet om een aanraking:

     - droog is de standaard, en wie `droog` vergeet krijgt geen wijziging;
     - een run is terug te draaien, en na het terugdraaien zegt de run dat zelf;
     - een zaak loopt open -> in behandeling -> afgehandeld en niet andersom;
     - de operator VERWOORDT een plan maar bedenkt het niet, dus een plan zonder
       kandidaten blijft leeg in plaats van iets te verzinnen;
     - de zandbak draait op zijn eigen kopie en raakt de productie niet.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - `droog: req.body.droog !== false` omgezet naar `!!req.body.droog`
     -> "wie droog vergeet, verandert niets" ZAKT (RAAK)
   - de teruggedraaid-vlag niet zetten in draaiTerug()
     -> "een teruggedraaide run zegt dat zelf" ZAKT (RAAK)
   - de statuscontrole uit zaken.besluit() gehaald
     -> "een zaak loopt open, in behandeling, afgehandeld" ZAKT (RAAK)
   - dezelfde controle uit zaken.neem() gehaald
     -> zakt NU ook, maar bleef eerst groen: die regel staat twee keer in
        kern/command/zaken.js en de toets raakte er maar een van. Dat is precies
        wat een mutatieproef hoort te vinden, en de tweede assertie in toets 4
        staat er sindsdien.

   Draai los: node --experimental-sqlite --test test/command-routes-herstel.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cmdherstel-'));
const CODE = 'KANTOOR-CMDHERSTEL-1';
let srv, base, office;

const api = (pad, body) => fetch(base + '/api/command/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, wat) {
  const r = await api(pad, body);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  const l = await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE })
  })).json();
  office = l.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. de runbooks dragen hun eigen oordeel, met de opbouw erbij', async () => {
  const l = await moet('runbooks', {}, 'de runbooklijst');
  assert.ok(l.runbooks.length > 0, 'er staan recepten in');
  for (const r of l.runbooks) {
    assert.ok(r.oordeel && ['auto', 'assist', 'hand'].includes(r.oordeel.niveau),
      r.id + ' heeft een niveau');
    assert.ok(Array.isArray(r.oordeel.opbouw) && r.oordeel.opbouw.length > 0,
      r.id + ' laat zien hoe de score is opgebouwd en noemt hem niet alleen');
  }
});

test('2. wie droog vergeet, verandert niets', async () => {
  const l = await moet('runbooks', {}, 'de lijst');
  const rb = l.runbooks.find(r => r.oordeel.niveau === 'auto') || l.runbooks[0];

  const zonderVeld = await moet('runbook/voer', { id: rb.id, reden: 'de routetoets vergeet het veld' },
    'draaien zonder het droog-veld');
  assert.equal(zonderVeld.run.droog, true, 'de standaard is droog, niet nat');

  const nat = await moet('runbook/voer', { id: rb.id, droog: false, reden: 'de routetoets draait nat',
    menselijkAkkoord: true }, 'nat draaien');
  assert.equal(nat.run.droog, false, 'nu pas gaat hij echt');
  assert.equal(typeof nat.run.geraakt, 'number', 'en zegt hoeveel objecten hij raakte');
});

test('3. een teruggedraaide run zegt dat zelf, en staat zo in de runlijst', async () => {
  const l = await moet('runbooks', {}, 'de lijst');
  const rb = l.runbooks.find(r => r.terugDraaibaar);
  assert.ok(rb, 'er is een terugdraaibaar recept');
  const uit = await moet('runbook/voer', { id: rb.id, droog: false, reden: 'de routetoets',
    menselijkAkkoord: true }, 'nat draaien');

  const terug = await moet('runbook/terug', { run: uit.run.id, reden: 'de routetoets draait terug' },
    'terugdraaien');
  assert.equal(terug.run.teruggedraaid, true, 'de run draagt zijn eigen terugdraaiing');
  assert.ok(terug.run.terugDoor, 'en de naam van wie het deed');

  const een = await moet('runs', { id: uit.run.id }, 'die ene run opvragen');
  assert.equal(een.run.teruggedraaid, true, 'ook los opgevraagd staat het er');
  const lijst = await moet('runs', { n: 10 }, 'de runlijst');
  assert.ok(lijst.runs.some(r => r.id === uit.run.id), 'de run staat in de lijst');

  const onbekend = await api('runbook/terug', { run: 'bestaat-niet', reden: 'x' });
  assert.equal(onbekend.status, 404, 'een onbekende run is 404 en geen stille nul');
});

test('4. een zaak loopt open, in behandeling, afgehandeld -- en niet andersom', async () => {
  const open = await moet('zaak/open', { titel: 'Routetoets', domein: 'command',
    oorzaak: 'toets', reden: 'de routetoets opent er een' }, 'openen');
  const id = open.zaak.id;
  assert.equal(open.zaak.status, 'open');
  assert.equal(open.zaak.eigenaar, null, 'een verse zaak heeft nog geen eigenaar');

  const neem = await moet('zaak/neem', { id }, 'oppakken');
  assert.equal(neem.zaak.status, 'in behandeling');
  assert.ok(neem.zaak.eigenaar, 'de eigenaar komt uit de sessie en niet uit de body');

  const besluit = await moet('zaak/besluit', { id, keuze: 'opgelost',
    reden: 'de routetoets sluit hem' }, 'besluiten');
  assert.equal(besluit.zaak.status, 'afgehandeld');
  assert.equal(besluit.zaak.besluit.keuze, 'opgelost');
  assert.ok(besluit.zaak.stappen.length >= 3, 'alle drie de stappen staan in het spoor');

  /* BEIDE KANTEN VAN DE GRENDEL. Dezelfde regel staat twee keer in
     kern/command/zaken.js -- een keer in neem() en een keer in besluit() -- en
     een toets die er maar een van raakt, laat de andere ongemerkt verdwijnen.
     Dat is hier ook gebeurd: de mutatieproef haalde de bovenste weg en alles
     bleef groen. Vandaar deze twee regels naast elkaar. */
  const nogmaals = await api('zaak/besluit', { id, keuze: 'opgelost', reden: 'nog een keer' });
  assert.equal(nogmaals.status, 409, 'een afgehandelde zaak is niet nog eens te besluiten');
  const opnieuwOppakken = await api('zaak/neem', { id });
  assert.equal(opnieuwOppakken.status, 409, 'en ook niet nog eens op te pakken');

  const lijst = await moet('zaken', { max: 50 }, 'de zakenlijst');
  assert.ok(lijst.tellingen && Array.isArray(lijst.leerpunten),
    'de lijst komt met tellingen en leerpunten');
});

test('5. de operator verzint niets: een plan zonder kandidaten blijft leeg', async () => {
  const p = await moet('operator/plan', { q: 'herstel alle vastgelopen ritten' }, 'een plan maken');
  assert.ok(p.plan.id && p.plan.vraag, 'het plan draagt de vraag en een id');
  assert.equal(typeof p.plan.totaal, 'number', 'het plan telt zijn eigen gevallen');
  assert.ok(p.plan.tekst && p.plan.tekst.length > 20,
    'de verwoording staat er ook zonder AI-sleutel: ' + p.plan.tekst);
  if (p.plan.totaal === 0) assert.equal(p.plan.delen.length, 0, 'nul gevallen betekent nul delen');

  const uit = await moet('operator/uitvoeren', { plan: p.plan.id, reden: 'de routetoets voert uit' },
    'het plan uitvoeren');
  assert.equal(uit.hersteld, p.plan.veilig, 'er is precies hersteld wat het plan veilig noemde');

  const recent = await moet('operator/recent', { n: 5 }, 'de recente plannen');
  const mijn = recent.plannen.find(x => x.id === p.plan.id);
  assert.ok(mijn && mijn.uitgevoerd === true, 'het plan staat als uitgevoerd in de lijst');

  const weg = await api('operator/uitvoeren', { plan: 'bestaat-niet', reden: 'x' });
  assert.equal(weg.status, 404, 'een plan dat er niet is, wordt niet stilzwijgend overgeslagen');
});

test('6. de zandbak draait een runbook op zijn eigen kopie', async () => {
  await moet('zandbak/maak', { naam: 'herstelbak', waarvoor: 'de routetoets' }, 'een zandbak maken');
  const l = await moet('runbooks', {}, 'de lijst');
  const rb = l.runbooks[0];

  const in1 = await moet('zandbak/runbook', { naam: 'herstelbak', runbook: rb.id, droog: false,
    reden: 'de routetoets draait in de bak' }, 'in de zandbak draaien');
  assert.equal(in1.zandbak, 'herstelbak', 'elk antwoord draagt de naam van de bak');
  assert.ok(in1.run, 'er is in de bak echt een run gemaakt');

  const echt = await moet('runs', { n: 50 }, 'de echte runlijst');
  assert.equal(echt.runs.filter(r => r.id === in1.run.id).length, 0,
    'de run uit de zandbak staat NIET in het echte runjournaal');

  const geenBak = await api('zandbak/runbook', { naam: 'bestaat-niet', runbook: rb.id });
  assert.equal(geenBak.status, 404, 'een zandbak die er niet is, is 404');
});

test('7. de overname leest in en stelt voor, maar verzint geen soort', async () => {
  const lijst = await moet('overname', {}, 'de overnamelijst');
  assert.ok(lijst.soorten.length > 0, 'de lijst noemt welke soorten hij kent');
  const soort = lijst.soorten[0];

  const onzin = await api('overname/lees', { naam: 'Onzin BV', soort: 'ditbestaatniet', rijen: [{}] });
  assert.equal(onzin.status, 404, 'een onbekende soort wordt geweigerd en niet geraden');

  const gelezen = await moet('overname/lees', { naam: 'Routetoets BV', soort: soort.type,
    rijen: [{ naam: 'Een rij uit de toets', code: 'ROUTETOETS-1' }] }, 'inlezen');
  const id = gelezen.partij && gelezen.partij.id;
  assert.ok(id, 'de inlezing krijgt een id: ' + JSON.stringify(gelezen).slice(0, 200));
  assert.equal(gelezen.partij.stand, 'ingelezen', 'inlezen is nog geen overnemen');

  const voorstel = await moet('overname/voorstel', { id }, 'het afbeeldvoorstel');
  assert.ok(voorstel && typeof voorstel === 'object', 'er komt een voorstel terug');
});
