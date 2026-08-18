/* DE REISWACHT (kern/reiswacht.js) -- REIZEN.md fase 3.

   Dit is de gevaarlijkste functie van de reiswereld, en de toetsen gaan dan
   ook nauwelijks over wat de wacht ZIET -- ze gaan over wat hij TOEGEEFT:

   1. een bron die stilvalt wordt met naam en "RTG kijkt hier nu niet mee"
      gemeld, en de rest rekent door;
   2. de bronnen die NIET bestaan (externe luchtvaart, spoor) staan als
      `ontbreekt` in de lijst in plaats van weggelaten;
   3. het antwoord noemt zichzelf een momentopname -- er wordt nergens
      gesuggereerd dat RTG op de achtergrond doorwaakt;
   4. valt De Reis zelf om, dan is de wacht STUK (503) en niet "rustig";
   5. een rustige reis heet gereed -- rust is een uitkomst, geen leegte.

   Daarna pas de signalen zelf: een verlopend document telt alleen voor de reis
   waar het voor verloopt, een visumsignaal zonder taak is een VRAAG en geen
   bewering, en een open visumtaak wordt scherper naarmate het vertrek nadert.

   De eerste helft draait puur op nagebootste kernen (het gaat om het
   samenvoegen); de laatste toets bewijst de echte deur.

   Draai los: node --experimental-sqlite --test test/reiswacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakReiswacht } = require('../server/kern/reiswacht');
const { startServer, stop } = require('./helper');

const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

/* Een nagebootste kern: een reis naar Dubai over 20-25 dagen, geen attenties,
   geen taken, en een Reiswijzer die Dubai visumvrij noemt. Elke toets verbuigt
   precies het stuk waar hij over gaat. */
function wachtMet(over) {
  const reis = { id: 'R-dubai', bestemming: 'Dubai', venster: { van: dag(20), tot: dag(25) },
    onderdelen: [{ soort: 'verblijf', titel: 'Suite', status: 'bevestigd', sig: 'gezond', kenmerk: 'V1', app: 'Verblijven' }],
    telling: { onderdelen: 1 } };
  const kern = Object.assign({
    mijnReizen: () => ({ ok: true, reizen: [reis], los: [], stil: [] }),
    entourage: () => ({ attenties: [] }),
    agenda: { lijst: () => [] },
    reiswijzer: () => ({ ok: true, naam: 'Verenigde Arabische Emiraten', visum: { soort: 'vrij', label: 'Visumvrij' } })
  }, over || {});
  return maakReiswacht({ kern }).reiswacht;
}
const bron = (r, naam) => (r.bronnen || []).find(b => b.naam === naam);

test('1. een rustige reis heet gereed, en de wacht noemt zichzelf een momentopname', () => {
  const r = wachtMet().wacht('k');
  assert.equal(r.ok, true);
  assert.equal(r.reizen[0].gereed, true, 'rust is een uitkomst');
  assert.deepEqual(r.reizen[0].signalen, []);
  assert.equal(r.momentopname, true);
  assert.match(r.uitleg, /waakt niet op de achtergrond/i,
    'het antwoord zegt zelf dat er geen achtergrondwachter is');
  for (const naam of ['reizen', 'documenten', 'visumtaken', 'landregels'])
    assert.equal(bron(r, naam).stand, 'gemeten', naam + ' is gemeten');
});

test('2. de bronnen die niet bestaan staan er als ontbreekt -- niet weggelaten', () => {
  const r = wachtMet().wacht('k');
  const lucht = bron(r, 'luchtvaart (extern)');
  assert.ok(lucht, 'de externe luchtvaartbron staat in de lijst');
  assert.equal(lucht.stand, 'ontbreekt');
  assert.match(lucht.uitleg, /kijkt hier nu niet mee/i);
  assert.equal(bron(r, 'spoor (extern)').stand, 'ontbreekt');
});

test('3. een stilgevallen bron meldt zich met naam, en de rest rekent door', () => {
  const r = wachtMet({ entourage: () => { throw new Error('kluis plat'); } }).wacht('k');
  assert.equal(r.ok, true, 'de wacht als geheel blijft staan');
  const doc = bron(r, 'documenten');
  assert.equal(doc.stand, 'stil');
  assert.match(doc.uitleg, /kijkt hier nu niet mee/i, 'en zegt dat hardop');
  assert.equal(bron(r, 'visumtaken').stand, 'gemeten', 'de andere bronnen zijn gewoon gemeten');
  // en de reis wordt niet "gereed met minder ogen" verkocht: hij is er gewoon
  assert.equal(r.reizen.length, 1);
});

test('4. valt De Reis zelf om, dan is de wacht stuk en niet rustig', () => {
  const r = wachtMet({ mijnReizen: () => { throw new Error('weg'); } }).wacht('k');
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  assert.equal(bron(r, 'reizen').stand, 'stil');
  assert.ok(!r.reizen, 'er wordt geen lege reizenlijst gefingeerd');
});

test('5. een verlopend document telt alleen voor de reis waar het voor verloopt', () => {
  const w = wachtMet({ entourage: () => ({ attenties: [
    { naam: 'Sam', soort: 'paspoort', tot: dag(22), verlopen: false },   // valt IN het venster (20-25)
    { naam: 'Kai', soort: 'visum', tot: dag(90), verlopen: false }       // ver na de reis
  ] }) });
  const r = w.wacht('k');
  const s = r.reizen[0].signalen;
  assert.equal(s.length, 1, 'alleen het document dat deze reis raakt: ' + JSON.stringify(s));
  assert.match(s[0].tekst, /paspoort van Sam/);
  assert.equal(s[0].bron, 'documenten');
  assert.match(s[0].grond, /zelf.*invulde/i, 'met de eerlijke grond erbij');
  assert.equal(s[0].ernst, 'aandacht');
  // een al verlopen document is een incident
  const r2 = wachtMet({ entourage: () => ({ attenties: [
    { naam: 'Sam', soort: 'paspoort', tot: dag(-2), verlopen: true }
  ] }) }).wacht('k');
  assert.equal(r2.reizen[0].signalen[0].ernst, 'incident');
});

test('6. het visumsignaal: een open taak is een feit, geen taak is een vraag', () => {
  const visumplichtig = () => ({ ok: true, naam: 'India', visum: { soort: 'evisum', label: 'E-visum vooraf aanvragen' } });
  // met een open taak (gekoppeld op het kenmerk van een onderdeel)
  const met = wachtMet({ reiswijzer: visumplichtig,
    agenda: { lijst: () => [{ titel: 'E-visum aanvragen voor India', gedaan: false, bron: 'reis:V1' }] } }).wacht('k');
  const s1 = met.reizen[0].signalen;
  assert.equal(s1.length, 1);
  assert.match(s1[0].tekst, /staat nog open/);
  assert.equal(s1[0].bron, 'visumtaken');
  // een afgevinkte taak: klaar is klaar, geen signaal
  const af = wachtMet({ reiswijzer: visumplichtig,
    agenda: { lijst: () => [{ titel: 'E-visum aanvragen voor India', gedaan: true, bron: 'reis:V1' }] } }).wacht('k');
  assert.deepEqual(af.reizen[0].signalen, [], 'wat gedaan is, wordt niet opnieuw aangekaart');
  // geen enkele taak, vertrek over 20 dagen: een VRAAG, met de onzekerheid erbij
  const zonder = wachtMet({ reiswijzer: visumplichtig }).wacht('k');
  const s3 = zonder.reizen[0].signalen;
  assert.equal(s3.length, 1);
  assert.match(s3[0].tekst, /geen taak/i);
  assert.match(s3[0].tekst, /Al geregeld\?/i, 'de wacht beweert niet dat het NIET geregeld is');
  assert.match(s3[0].grond, /weet alleen u/i);
  // en een visumvrije bestemming geeft helemaal niets
  assert.deepEqual(wachtMet().wacht('k').reizen[0].signalen, []);
});

test('7. een open taak wordt een incident als het vertrek dichtbij komt', () => {
  const visumplichtig = () => ({ ok: true, naam: 'India', visum: { soort: 'visum', label: 'Visum vooraf aanvragen' } });
  const reisDichtbij = { id: 'R-i', bestemming: 'India', venster: { van: dag(7), tot: dag(12) },
    onderdelen: [{ soort: 'reis', titel: 'Rondreis', status: 'bevestigd', sig: 'gezond', kenmerk: 'R7', app: 'Reisbureau' }] };
  const r = wachtMet({
    mijnReizen: () => ({ ok: true, reizen: [reisDichtbij], los: [], stil: [] }),
    reiswijzer: visumplichtig,
    agenda: { lijst: () => [{ titel: 'Visum aanvragen voor India', gedaan: false, bron: 'reis:R7' }] }
  }).wacht('k');
  assert.equal(r.reizen[0].signalen[0].ernst, 'incident', 'zeven dagen voor vertrek is dit geen aandachtspunt meer');
});

test('8. een onderdeel dat aandacht vraagt komt als signaal mee, met zijn domein als bron', () => {
  const reis = { id: 'R-d', bestemming: 'Dubai', venster: { van: dag(20), tot: dag(25) },
    onderdelen: [
      { soort: 'vlucht', titel: 'RT101', status: 'vertraagd', sig: 'aandacht', kenmerk: 'B1', app: 'Vluchten' },
      { soort: 'reis', titel: 'Woestijn', status: 'afgewezen', sig: 'incident', kenmerk: 'R1', app: 'Reisbureau' },
      { soort: 'verblijf', titel: 'Suite', status: 'bevestigd', sig: 'gezond', kenmerk: 'V1', app: 'Verblijven' }
    ] };
  const r = wachtMet({ mijnReizen: () => ({ ok: true, reizen: [reis], los: [], stil: [] }) }).wacht('k');
  const s = r.reizen[0].signalen;
  assert.equal(s.length, 2, 'het gezonde onderdeel doet niet mee');
  assert.deepEqual(s.map(x => x.bron).sort(), ['Reisbureau', 'Vluchten'], 'de bron is het domein zelf');
  assert.equal(r.reizen[0].gereed, false);
});

test('9. de stille bronnen van de reiswereld reizen door tot in de wacht', () => {
  const r = wachtMet({ mijnReizen: () => ({ ok: true, reizen: [], los: [], stil: ['vluchten'] }) }).wacht('k');
  assert.deepEqual(r.stil, ['vluchten'], 'een onvolledig beeld blijft onvolledig heten');
});

/* En de deur: op een echte server, met een echte visumplichtige boeking. */
test('10. /api/reis/wacht: dicht zonder inlog, en een echte reis geeft een echt beeld', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reiswacht-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    assert.equal((await post('/api/reis/wacht', {}, null)).status, 401);
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'rw' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    // een reis invoeren naar een land dat vooraf een visum vraagt, vertrek binnen 30 dagen
    const lees = await post('/api/reis/invoer/lees', { tekst: 'Rondreis India, vertrek ' + dag(20) }, lid);
    const bev = await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
      velden: { titel: 'Rondreis India', soort: 'activiteit', bestemming: 'India', van_datum: dag(20) } }, lid);
    assert.equal(bev.status, 200);

    const r = await post('/api/reis/wacht', {}, lid);
    assert.equal(r.status, 200);
    assert.equal(r.body.momentopname, true);
    const reis = r.body.reizen.find(x => /india/i.test(x.bestemming));
    assert.ok(reis, 'de ingevoerde reis staat onder de wacht');
    assert.ok(reis.signalen.some(s => s.bron === 'landregels' && /geen taak/i.test(s.tekst)),
      'de wacht stelt de visumvraag: er is geen taak, want de reis kwam niet via een boeking binnen');
    assert.ok(r.body.bronnen.some(b => b.naam === 'luchtvaart (extern)' && b.stand === 'ontbreekt'),
      'en ook op de echte server staat de ontbrekende bron erbij');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
