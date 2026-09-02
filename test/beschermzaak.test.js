/* ============================================================================
   DE BESCHERMZAAK: EEN ANDERE DATAKLASSE, EN DE GRENDELS DIE DAT WAARMAKEN

   HDI.md par. 5.2 zegt dat veiligheidsgegevens een andere dataklasse zijn en
   geen gevoeliger veld. Dat is een bewering over code, en dit bestand is de
   plek waar hij kan zakken. Zeven zinnen:

     1. een veld dat deze klasse niet heeft, wordt GEWEIGERD en niet genegeerd;
     2. de veiligheidsvraag gaat voor alles: zonder antwoord geen volgende stand;
     3. een overdracht gaat alleen naar de ontvanger die in de toestemming staat;
     4. intrekken werkt meteen en werkt achteruit;
     5. sluiten zonder zelfgekozen bewaartermijn lukt niet -- er is geen standaard;
     6. de lijst draagt geen inhoud, en lezen laat een spoor achter;
     7. de klasse staat los van de casus: geen gedeelde require, geen gedeeld pad.

   WAT ER MET EEN MUTATIE IS NAGETROKKEN (LAT.md regel 2). Elke bewering is een
   keer gezien terwijl hij zakte, door de grendel eruit te halen:

     - keurInvoer() laten teruggeven null: RAAK op 1, en op niets anders;
     - de `!z.veiligheid`-controle in stand() weghalen: RAAK op 2;
     - de vergelijking naar/ontvanger in draagOver() weghalen: RAAK op 3;
     - in trekIn() de terugval naar 'toestemming' weghalen: RAAK op 4 (de
       tweede helft; de eerste helft bleef staan, en dat is precies waarom er
       twee beweringen in staan en niet een);
     - in sluit() een standaard van 730 dagen invullen als bewaarDagen ontbreekt:
       RAAK op 5;
     - `wat` toevoegen aan lijstbeeld(): RAAK op 6.

   DE MUTATIE DIE IETS OPLEVERDE. Bewering 3 sloeg eerst AF: de overdracht
   weigerde al op de stand ('stabilisatie' in plaats van 'overdracht'), dus de
   toets keurde de ketenfout goed terwijl hij dacht de ontvanger te toetsen --
   de val van LAT.md regel 9. De toets zet de zaak nu eerst netjes op
   'overdracht' en toetst daarna pas de naam, en bijt dan wel.

   Draai los: node --test test/beschermzaak.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beschermzaak-'));
const OFFICE_CODE = 'BZ-KEURING';

let srv, BASE, LAND, STAD;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const bz = (pad, body) => post('/api/rtfos/bescherming/' + pad, body, LAND);

// Een verse zaak tot en met de gevraagde stand, zodat elke bewering bij zijn
// eigen grendel begint en niet op de vorige struikelt.
async function zaakTot(stand) {
  const o = await bz('open', { stad: STAD, aanleiding: 'huiselijk-geweld', wat: 'Melding via de huisarts.' });
  assert.equal(o.status, 200, 'openen mislukte: ' + JSON.stringify(o.body).slice(0, 200));
  const id = o.body.zaak.id;
  if (stand === 'veiligheid') return id;
  await bz('veiligheid', { id, nuVeilig: true, kanMeekijken: false });
  await bz('stand', { id, naar: 'minimaal' });
  if (stand === 'minimaal') return id;
  await bz('stand', { id, naar: 'toestemming' });
  if (stand === 'toestemming') return id;
  await bz('toestemming', { id, ontvanger: 'Blijf Groep', tekst: 'Zij mag mijn situatie horen.' });
  await bz('stand', { id, naar: 'stabilisatie' });
  if (stand === 'stabilisatie') return id;
  const ov = await bz('stand', { id, naar: 'overdracht' });
  assert.equal(ov.status, 200, 'naar overdracht mislukte: ' + JSON.stringify(ov.body).slice(0, 200));
  return id;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');
  const s = await post('/api/rtfos/stad/maak', { naam: 'Haarlem' }, LAND);
  STAD = s.body.stad.id;
  await post('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, LAND);
  await post('/api/rtfos/stad/module', { id: STAD, vlag: 'individual_cases', aan: true }, LAND);
});
test.after(() => stop(srv));

test('1. een veld dat deze klasse niet heeft, wordt geweigerd en niet genegeerd', async () => {
  const o = await bz('open', { stad: STAD, aanleiding: 'stalking', wat: 'Volgt haar al weken.',
    adres: 'Kerkstraat 1' });
  assert.equal(o.status, 400, 'een adres meesturen hoort te WEIGEREN, niet stil weg te vallen');
  assert.match(o.body.error, /adres/i, 'de fout hoort te zeggen welk veld niet bestaat');
  assert.ok(!o.body.zaak, 'er hoort geen zaak te ontstaan');

  // en hetzelfde voor het zoekveld, want dat is de andere kant van dezelfde grens
  const l = await post('/api/rtfos/bescherming/zaken', { stad: STAD, zoek: 'kerkstraat' }, LAND);
  assert.equal(l.status, 400, 'zoeken over deze zaken hoort geweigerd te worden');
});

test('2. zonder de veiligheidsvraag komt een zaak niet verder', async () => {
  const id = await zaakTot('veiligheid');
  const vroeg = await bz('stand', { id, naar: 'minimaal' });
  assert.equal(vroeg.status, 400, 'zonder antwoord op de veiligheidsvraag hoort dit te weigeren');
  assert.match(vroeg.body.error, /veilig/i);

  // "weet niet" bestaat niet: het antwoord moet een echte booleaan zijn
  const half = await bz('veiligheid', { id, nuVeilig: true });
  assert.equal(half.status, 400, 'de tweede vraag (kan iemand meekijken) is niet optioneel');

  const goed = await bz('veiligheid', { id, nuVeilig: false, kanMeekijken: true });
  assert.equal(goed.status, 200);
  const nu = await bz('stand', { id, naar: 'minimaal' });
  assert.equal(nu.status, 200, 'met het antwoord erin hoort de stand wel te verzetten');
});

test('3. een overdracht gaat alleen naar de ontvanger uit de toestemming', async () => {
  const id = await zaakTot('overdracht');
  const fout = await bz('overdracht', { id, naar: 'Wijkagent', wat: 'De hele situatie.' });
  assert.equal(fout.status, 403, 'een andere ontvanger dan in de toestemming hoort te weigeren');
  assert.match(fout.body.error, /Blijf Groep/, 'de fout hoort te noemen voor wie de toestemming wel geldt');

  const goed = await bz('overdracht', { id, naar: 'Blijf Groep', wat: 'Aanleiding en wat er nu nodig is.' });
  assert.equal(goed.status, 200, 'naar de genoemde ontvanger hoort het wel te kunnen');
  assert.equal(goed.body.zaak.overdrachten.length, 1);
});

test('4. intrekken werkt meteen, en het werkt achteruit', async () => {
  const id = await zaakTot('overdracht');
  const weg = await bz('toestemming-weg', { id, reden: 'Wil het zelf doen.' });
  assert.equal(weg.status, 200);

  // eerste helft: er kan niets meer over
  const na = await bz('overdracht', { id, naar: 'Blijf Groep', wat: 'Alsnog doorgeven.' });
  assert.notEqual(na.status, 200, 'na intrekken hoort er niets meer over te gaan');

  // tweede helft: de zaak valt terug, hij blijft niet op "overdracht" staan
  assert.equal(weg.body.zaak.stand, 'toestemming',
    'een ingetrokken toestemming hoort de zaak terug te zetten, niet hem op overdracht te laten staan');
});

test('5. sluiten vraagt een zelfgekozen bewaartermijn met een reden', async () => {
  const id = await zaakTot('stabilisatie');
  const zonder = await bz('sluit', { id, uitkomst: 'Overgedragen en afgerond.' });
  assert.equal(zonder.status, 400, 'er hoort GEEN standaardtermijn te zijn');
  assert.match(zonder.body.error, /bewaartermijn/i);

  const teLang = await bz('sluit', { id, uitkomst: 'Overgedragen en afgerond.', bewaarDagen: 730, bewaarWaarom: 'Gewoonte.' });
  assert.equal(teLang.status, 400, '730 dagen (de casus-termijn) hoort hier niet te passen');

  const zonderReden = await bz('sluit', { id, uitkomst: 'Overgedragen en afgerond.', bewaarDagen: 30 });
  assert.equal(zonderReden.status, 400, 'een termijn zonder reden is een gewoonte en hoort te weigeren');

  const goed = await bz('sluit', { id, uitkomst: 'Overgedragen aan Blijf Groep, mens is veilig.',
    bewaarDagen: 30, bewaarWaarom: 'Nazorg loopt nog een maand.' });
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));
  assert.ok(goed.body.zaak.bewaarTot, 'een gesloten zaak hoort een einddatum te dragen');
});

test('6. de lijst draagt geen inhoud, en lezen laat een spoor achter', async () => {
  const id = await zaakTot('minimaal');
  const l = await post('/api/rtfos/bescherming/zaken', { stad: STAD }, LAND);
  assert.equal(l.status, 200);
  const rij = l.body.zaken.find(z => z.id === id);
  assert.ok(rij, 'de zaak hoort in de lijst te staan');
  assert.equal(rij.wat, undefined, 'de lijst hoort de omschrijving NIET te dragen');
  assert.ok(rij.codenaam.startsWith('BZ-'), 'een lijstrij draait op een codenaam');

  const gelezen = await bz('lees', { id });
  assert.equal(gelezen.status, 200);
  assert.ok(gelezen.body.zaak.wat, 'na een expliciete opening hoort de inhoud er wel te zijn');

  // en dat openen staat in het auditspoor, met de codenaam en niet met een mens
  const a = await post('/api/rtfos/audit', { limiet: 50 }, LAND);
  const regels = (a.body.regels || a.body.audit || []).map(r => JSON.stringify(r)).join('\n');
  assert.match(regels, /beschermzaak\.gelezen/, 'een zaak lezen hoort een auditregel te zijn');
});

test('7. de beschermzaak staat los van de casus', () => {
  // geen gedeelde code: een require tussen de twee is precies hoe de klassen
  // weer een worden, en dan is de scheiding een afspraak in plaats van een vorm
  const map = path.join(__dirname, '..', 'server', 'kern', 'beschermzaak');
  for (const f of fs.readdirSync(map).filter(n => n.endsWith('.js'))) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8');
    assert.ok(!/require\([^)]*rtfos\/casus/.test(bron),
      f + ' laadt casus-code; dan is de beschermzaak een variant van de casus geworden');
  }
  const casusMap = path.join(__dirname, '..', 'server', 'kern', 'rtfos');
  for (const f of fs.readdirSync(casusMap).filter(n => n.startsWith('casus'))) {
    const bron = fs.readFileSync(path.join(casusMap, f), 'utf8');
    assert.ok(!/beschermzaak/.test(bron), f + ' kent de beschermzaak; die kant hoort ook dicht te zijn');
  }

  /* En de collectie lekt niet naar de verantwoordingslaag. Kleine getallen over
     geweld in een wijk zijn geen statistiek maar een aanwijzing (HDI.md 5.2). */
  for (const f of ['rapport.js', 'gemeente.js', 'jaarverslag.js']) {
    const bron = fs.readFileSync(path.join(casusMap, f), 'utf8');
    assert.ok(!/beschermzaken/.test(bron), f + ' leest de beschermzaken; die horen nergens geteld te worden');
  }
});
