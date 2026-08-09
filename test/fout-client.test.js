/* ============================================================================
   DE INGANG VOOR BROWSERFOUTEN: POST /api/fout/client

   WAAROM DEZE TOETS BESTAAT.

   Dit is het enige spoor van een storing die alleen op het toestel van een
   gebruiker gebeurt (server/routes/fout.js, gevoed door
   public/shared/foutmelder.js). De route is BEWUST zonder inlog: een fout die
   het inloggen zelf sloopt komt nooit binnen achter een poort die inloggen
   vereist. Precies daarom is dit ook de makkelijkste plek om per ongeluk iets
   weg te geven -- iedereen op internet mag hier tekst naar binnen duwen, en
   alles wat de route logt komt in hetzelfde logboek als de serverfouten
   terecht.

   De route belooft daarom drie dingen, en die drie worden hier nagetrokken op
   wat er ECHT in het logboek verschijnt (de stderr van de kindserver), niet op
   een statuscode:

     1. alleen zeven afgesproken velden gaan mee -- geen token, geen codenaam,
        geen naam, en niets anders wat de melder meestuurt;
     2. alles gaat AFGEKAPT mee (een foutmelding kan zelf bevatten wat iemand
        intypte), en regel/ingelogd worden hard omgezet naar getal en ja/nee;
     3. wat er niet doorheen hoort -- onleesbare JSON, pathologisch diep
        genest -- wordt geweigerd en belandt ook niet in het logboek.

   Een negatieve bewering ("dit is NIET gelogd") kan alleen zakken als je zeker
   weet dat het logboek al bij is. Daarom staat er achter elk negatief geval een
   spoelmelding: pas als DIE regel binnen is, mag "er staat niets" iets
   betekenen. Zonder die spoeling zou deze toets groen blijven op een lek dat
   simpelweg nog onderweg was.

   Draai los: node --experimental-sqlite --test test/fout-client.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, bewaakKind } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foutclient-'));
let srv, base, stderrTekst = '';

/* De velden die de route mag loggen, en niets erbuiten. Deze lijst is de
   afspraak zelf: komt er een veld bij, dan hoort iemand daar bewust over te
   beslissen in plaats van het per ongeluk mee te laten liften. */
const TOEGESTANE_VELDEN = ['bestand', 'ingelogd', 'melding', 'pad', 'regel', 'soort', 'ua'];

function meld(lijf, kop) {
  return fetch(base + '/api/fout/client', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, kop || {}),
    body: typeof lijf === 'string' ? lijf : JSON.stringify(lijf || {})
  });
}

// De regels uit het logboek die van deze route komen, ontleed tot een object.
function logRegels() {
  return stderrTekst.split('\n')
    .filter(r => r.includes('clientfout'))
    .map(r => { try { return JSON.parse(r.slice(r.indexOf('{'))); } catch (e) { return null; } })
    .filter(Boolean);
}

// Wacht tot de logregel met dit merk er is (stderr komt via een pijp, dus niet
// gegarandeerd binnen voordat het antwoord bij ons is).
async function wachtOpLog(merk, ms) {
  const eind = Date.now() + (ms || 5000);
  for (;;) {
    const g = logRegels().find(r => JSON.stringify(r).includes(merk));
    if (g || Date.now() > eind) return g || null;
    await new Promise(r => setTimeout(r, 25));
  }
}

/* Spoelen: stuur een melding waarvan we WEL weten dat hij gelogd hoort te
   worden, en wacht tot die regel binnen is. Alles wat daarvoor is verstuurd,
   staat er dan ook -- of staat er nooit. */
let spoelnr = 0;
async function spoel() {
  const merk = 'SPOELING' + (++spoelnr);
  const r = await meld({ soort: 'fout', melding: merk });
  assert.equal(r.status, 204);
  assert.ok(await wachtOpLog(merk), 'de spoelmelding zelf kwam niet in het logboek; zonder die zekerheid zegt "niets gelogd" niets');
}

test.before(async () => {
  // stderr op 'pipe' zodat we het logboek zelf kunnen meelezen; bewaakKind zet
  // de strenge poort er alsnog op (zie de kop van test/helper.js).
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, stderr: 'pipe' });
  base = srv.base;
  srv.child.stderr.on('data', d => { stderrTekst += d; });
  bewaakKind(srv.child);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de melder mag zonder inlog naar binnen, en krijgt een leeg antwoord terug', async () => {
  const r = await meld({ soort: 'fout', melding: 'OPEN1 kan eigenschap van null niet lezen', bestand: 'app.js', regel: 12, pad: '/apps/app/' });
  assert.equal(r.status, 204, 'geen inlog nodig: een fout die het inloggen sloopt moet juist binnenkomen');
  assert.equal(await r.text(), '', '204 draagt geen lijf');

  const gelogd = await wachtOpLog('OPEN1');
  assert.ok(gelogd, 'de melding staat in het logboek -- daar is de hele route voor');
  assert.equal(gelogd.bestand, 'app.js');
  assert.equal(gelogd.regel, 12);
  assert.equal(gelogd.pad, '/apps/app/');

  /* De open deur is een KEUZE, geen vergeten grendel. Naast hem zit een deur
     van hetzelfde huis die zonder inlog gewoon dichtblijft; zonder dat contrast
     zou "204 zonder token" net zo goed betekenen dat er nergens iets dichtzit. */
  const dicht = await fetch(base + '/api/techniek/fouten/wis', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(dicht.status, 401, 'de storingslijst wissen kan alleen ingelogd');
});

test('2. alleen de zeven afgesproken velden gaan het logboek in', async () => {
  const r = await meld({
    soort: 'fout', melding: 'VELD2 iets ging stuk', bestand: 'app.js', regel: 3, pad: '/apps/app/', ingelogd: true,
    // alles hieronder hoort NERGENS terecht te komen
    token: 'GEHEIM-TOKEN-abc123', codenaam: 'ARCTURUS', naam: 'Anna Aardenburg',
    email: 'anna@voorbeeld.nl', body: { wachtwoord: 'geheim123' }, stack: 'at geheim (app.js:1:1)'
  });
  assert.equal(r.status, 204);

  const gelogd = await wachtOpLog('VELD2');
  assert.ok(gelogd, 'de melding is gelogd');
  assert.deepEqual(Object.keys(gelogd).sort(), TOEGESTANE_VELDEN,
    'geen enkel meegestuurd extra veld liftte mee: ' + JSON.stringify(Object.keys(gelogd)));

  for (const geheim of ['GEHEIM-TOKEN-abc123', 'ARCTURUS', 'Aardenburg', 'anna@voorbeeld.nl', 'geheim123']) {
    assert.ok(!stderrTekst.includes(geheim), 'niets van "' + geheim + '" in het logboek');
  }
});

test('3. lange invoer wordt afgekapt, ook de user-agent', async () => {
  const r = await meld({
    soort: 'KAP3' + 'S'.repeat(40),
    melding: 'KAP3M' + 'm'.repeat(400) + 'STAART',
    bestand: 'KAP3B' + 'b'.repeat(120) + 'STAART',
    pad: '/KAP3P' + 'p'.repeat(200) + 'STAART'
  }, { 'User-Agent': 'KAP3U' + 'u'.repeat(200) + 'STAART' });
  assert.equal(r.status, 204);

  const g = await wachtOpLog('KAP3M');
  assert.ok(g, 'de melding is gelogd');
  assert.equal(g.soort.length, 20, 'soort tot 20');
  assert.equal(g.melding.length, 300, 'melding tot 300 -- hij kan bevatten wat iemand intypte');
  assert.equal(g.bestand.length, 80, 'bestand tot 80');
  assert.equal(g.pad.length, 120, 'pad tot 120');
  assert.equal(g.ua.length, 120, 'user-agent tot 120');
  assert.ok(!stderrTekst.includes('STAART'), 'geen enkel veld ging in zijn geheel mee');
});

test('4. regel is altijd een getal, ingelogd altijd een echte ja of nee', async () => {
  // een string die met cijfers begint is nog geen getal, en "ja" is geen ja
  const a = await meld({ soort: 'fout', melding: 'TYPE4A', regel: '77', ingelogd: 'ja' });
  assert.equal(a.status, 204);
  const ga = await wachtOpLog('TYPE4A');
  assert.ok(ga, 'de eerste melding is gelogd');
  assert.equal(ga.regel, 77, 'een cijferstring wordt een getal');
  assert.strictEqual(ga.ingelogd, false, 'alleen een echte true telt als ingelogd, geen waarheidsachtige string');

  const b = await meld({ soort: 'fout', melding: 'TYPE4B', regel: 'zeven', ingelogd: true });
  assert.equal(b.status, 204);
  const gb = await wachtOpLog('TYPE4B');
  assert.ok(gb, 'de tweede melding is gelogd');
  assert.equal(gb.regel, 0, 'onzin in regel wordt 0 en niet NaN of de tekst zelf');
  assert.strictEqual(gb.ingelogd, true);
});

test('5. een melding kan geen tweede logregel vervalsen', async () => {
  /* Iedereen mag hier tekst insturen. Kwam die tekst rauw in het logboek, dan
     schrijft een aanvaller met een enkele regelovergang zijn eigen "storing" in
     het logboek van dit huis -- en daarmee is het logboek als bewijs weg. */
  const nep = 'INJECTIE5\n2026-01-01T00:00:00Z ERROR uitzondering {"serverfout":true} verzonnen';
  const r = await meld({ soort: 'fout', melding: nep });
  assert.equal(r.status, 204);
  assert.ok(await wachtOpLog('INJECTIE5'), 'de melding is gelogd');

  const raakt = stderrTekst.split('\n').filter(l => l.includes('INJECTIE5'));
  assert.equal(raakt.length, 1, 'de hele melding staat op EEN regel; de regelovergang is ontsnapt in plaats van doorgegeven');
  assert.ok(raakt[0].includes('\\n'), 'de regelovergang staat er als ontsnapte tekst in');
  assert.ok(!/^\s*2026-01-01T00:00:00Z ERROR/m.test(stderrTekst), 'er is geen verzonnen ERROR-regel in het logboek gekomen');
});

test('6. een onleesbaar lijf wordt geweigerd en belandt niet in het logboek', async () => {
  const r = await meld('{"melding":"KAPOT6", dit is geen json');
  assert.equal(r.status, 400, 'onleesbare JSON is een invoerfout, geen 204 en geen 500');
  const uit = await r.json();
  assert.ok(uit.error && !/JSON|token|position/i.test(uit.error), 'de client krijgt een nette zin, geen ontleedfout: ' + uit.error);
  assert.ok(!uit.stack, 'en zeker geen stack');

  await spoel();
  assert.ok(!stderrTekst.includes('KAPOT6'), 'van een geweigerd lijf komt niets in het logboek');
});

test('7. pathologisch diep genest lijf: geweigerd door de lijfpoort, en niets gelogd', async () => {
  let diep = 'DIEP7';
  for (let i = 0; i < 60; i++) diep = { n: diep };
  const r = await meld({ soort: 'fout', melding: 'diep', extra: diep });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /diep genest/, 'de lijfpoort noemt de reden');

  await spoel();
  assert.ok(!stderrTekst.includes('DIEP7'), 'een geweigerd lijf komt niet in het logboek');
});

test('8. de melder luistert alleen naar POST', async () => {
  const r = await fetch(base + '/api/fout/client');
  assert.equal(r.status, 404, 'GET hoort hier niets te doen');
  assert.equal((await r.json()).error, 'Onbekend eindpunt.', 'en onder /api is een 404 JSON, geen HTML-pagina');
});

test('9. wat niet als JSON is aangeboden, wordt niet meegelogd', async () => {
  /* De melder in de browser stuurt zijn beacon met type application/json. Komt
     er tekst binnen die zich niet als JSON aandient, dan wordt hij niet ontleed
     -- en dan hoort hij ook nergens in het logboek te staan, want ontleed of
     niet, het is nog steeds tekst die iemand heeft ingetypt. */
  const r = await meld({ melding: 'PLATTETEKST9 met van alles erin' }, { 'Content-Type': 'text/plain' });
  assert.equal(r.status, 204, 'de melder krijgt geen fout terug: een melding die niet aankomt mag geen tweede fout maken');

  await spoel();
  assert.ok(!stderrTekst.includes('PLATTETEKST9'), 'een niet-ontleed lijf lekt niet alsnog het logboek in');
  const leeg = logRegels().filter(g => g.melding === '' && g.soort === '');
  assert.ok(leeg.length >= 1, 'er staat een lege melding in het logboek: het spoor blijft, de inhoud niet');
});
