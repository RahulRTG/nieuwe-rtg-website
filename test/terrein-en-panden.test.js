/* ============================================================================
   TERREIN, PANDEN EN DIEREN -- 6 endpoints uit de supplier-groep.

   gebouw/zaal/weg, golf/tee/weg, pand/foto, charter/fotos, boerderij/dier en
   boerderij/water stonden als nooit aangeroepen in de waargenomen
   dekkingsmeting. Vijf verschillende soorten zaken, met een gedeelde vorm:
   een plek of een dier waar iets mee gebeurt, en een bord waarop dat klopt.

   WAT ER OP HET SPEL STAAT

   - EEN ZAAL EN EEN TEETIME KUNNEN MAAR EEN KEER VERGEVEN WORDEN. Twee
     boekingen over hetzelfde tijdvak is geen dubbele omzet maar twee groepen
     die voor dezelfde deur staan. Het huis weigert dat met 409, en dat is de
     bewering waar deze twee routes om draaien -- want juist het WEGHALEN
     moet die plek dan ook echt weer vrijgeven.
   - EEN ZAAK ZONDER DIE FUNCTIE HOORT ER NIET BIJ TE KUNNEN. Een restaurant
     dat teetimes schrapt of diergroepen bijwerkt is geen club en geen
     boerderij; alle zes de routes zitten achter hun eigen cap of type.
   - BEHEREN IS STAFWERK, VERZORGEN IS DAGWERK. Een diergroep opvoeren doet
     de manager; water geven en voeren doet wie er 's ochtends staat. Dat
     onderscheid loopt door de hele boerderij en wordt hier afgerekend.

   Draai los: node --experimental-sqlite --test test/terrein-en-panden.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, toren, golf, boer, boerWerker, makelaar, charter, resto;
let boekingId = null, teeId = null, perceelId = null, dierId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-terrein-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}
const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  toren = await inlog('MERIDIAAN', 'manager');   // Meridiaan Toren: kantoorgebouw
  golf = await inlog('SAROCA', 'manager');       // Club de Golf Sa Roca
  boer = await inlog('CANFERRER', 'manager');    // Finca Can Ferrer
  boerWerker = await inlog('CANFERRER', 'staff');
  makelaar = await inlog('IBIZALIV', 'manager'); // Ibiza Living Estates: vastgoed
  charter = await inlog('AZUL', 'manager');      // Azul Yacht Charter
  resto = await inlog('KIKUNOI', 'manager');
  assert.ok(toren && golf && boer && makelaar && charter && resto, 'alle zaken staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een zaal weghalen geeft het tijdvak echt weer vrij', async () => {
  const zalen = (await api('/api/supplier/gebouw', {}, toren)).body.zalen || [];
  assert.ok(zalen.length, 'de toren heeft zalen');
  const zaalId = zalen[0].id;

  const boek = { zaalId, huurder: 'Advocatenkantoor Vidal', titel: 'Cliëntbespreking', datum: dag(5), van: '10:00', tot: '12:00' };
  const b1 = await api('/api/supplier/gebouw/zaal', boek, toren);
  assert.equal(b1.status, 200, JSON.stringify(b1.body));
  boekingId = b1.body.boeking.id;

  /* Dezelfde zaal, overlappend tijdvak. Twee boekingen over hetzelfde uur is
     geen dubbele omzet maar twee groepen die voor dezelfde deur staan. */
  const botst = await api('/api/supplier/gebouw/zaal',
    Object.assign({}, boek, { huurder: 'Iemand anders', van: '11:00', tot: '13:00' }), toren);
  assert.equal(botst.status, 409, 'het tijdvak is bezet');

  assert.equal((await api('/api/supplier/gebouw/zaal/weg', { id: 'bestaatniet' }, toren)).status, 404);
  assert.equal((await api('/api/supplier/gebouw/zaal/weg', { id: boekingId }, resto)).status, 403,
    'een restaurant is geen kantoorgebouw-partner');

  const weg = await api('/api/supplier/gebouw/zaal/weg', { id: boekingId }, toren);
  assert.equal(weg.status, 200);

  // en nu kan het weer: dat is waar weghalen voor is
  const opnieuw = await api('/api/supplier/gebouw/zaal',
    Object.assign({}, boek, { huurder: 'Iemand anders', van: '11:00', tot: '13:00' }), toren);
  assert.equal(opnieuw.status, 200, 'na het weghalen is het tijdvak weer vrij');
  await api('/api/supplier/gebouw/zaal/weg', { id: opnieuw.body.boeking.id }, toren);
});

test('2. een teetime schrappen geeft de starttijd terug aan de baan', async () => {
  const t1 = await api('/api/supplier/golf/tee', { naam: 'Flight Vidal', datum: dag(6), tijd: '09:20', spelers: 3 }, golf);
  assert.equal(t1.status, 200, JSON.stringify(t1.body));
  teeId = t1.body.teetime.id;
  assert.equal(t1.body.teetime.spelers, 3);

  assert.equal((await api('/api/supplier/golf/tee', { naam: 'Andere flight', datum: dag(6), tijd: '09:20', spelers: 2 }, golf)).status, 409,
    'die starttijd is vergeven');
  assert.equal((await api('/api/supplier/golf/tee', { naam: 'Te groot', datum: dag(6), tijd: '10:00', spelers: 9 }, golf)).status, 400,
    'een flight is een tot vier spelers');

  assert.equal((await api('/api/supplier/golf/tee/weg', { id: teeId }, resto)).status, 403, 'een restaurant is geen golfclub');
  assert.equal((await api('/api/supplier/golf/tee/weg', { id: 'bestaatniet' }, golf)).status, 404);

  assert.equal((await api('/api/supplier/golf/tee/weg', { id: teeId }, golf)).status, 200);
  assert.equal((await api('/api/supplier/golf/tee', { naam: 'Andere flight', datum: dag(6), tijd: '09:20', spelers: 2 }, golf)).status, 200,
    'de starttijd is weer te vergeven');
});

test('3. de boerderij: beheren is stafwerk, verzorgen is dagwerk', async () => {
  const ov = (await api('/api/supplier/boerderij/overzicht', {}, boer)).body;
  const percelen = ov.percelen || (ov.overzicht && ov.overzicht.percelen) || [];
  assert.ok(percelen.length, 'de finca heeft percelen: ' + Object.keys(ov).join(','));
  perceelId = percelen[0].id;

  assert.equal((await api('/api/supplier/boerderij/dier', { naam: 'Geiten' }, resto)).status, 409,
    'een restaurant is geen boerderij');
  if (boerWerker) assert.equal((await api('/api/supplier/boerderij/dier', { soort: 'geit', aantal: 12 }, boerWerker)).status, 403,
    'een diergroep opvoeren doet de manager');
  assert.equal((await api('/api/supplier/boerderij/dier', { soort: 'draak', aantal: 3 }, boer)).status, 400,
    'een diersoort die we niet kennen');

  /* Een groep draagt geen vrije naam maar een SOORT uit een vaste lijst
     (melkkoe, legkip, varken, schaap, geit). Dat is geen beperking maar de
     hele reden dat het bord kan rekenen: voer per dier en dagopbrengst hangen
     aan die soort. */
  const d = await api('/api/supplier/boerderij/dier', { soort: 'geit', aantal: 12, stal: 'Stal C' }, boer);
  assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 200));
  const groepen = d.body.dieren || (d.body.overzicht && d.body.overzicht.dieren) || [];
  const nieuw = groepen.find(g => g.soort === 'geit' && g.stal === 'Stal C');
  assert.ok(nieuw, 'de groep staat op het bord: ' + JSON.stringify(groepen).slice(0, 200));
  dierId = nieuw.id;
  assert.equal(nieuw.aantal, 12);
  assert.ok(nieuw.voerKgPerDag > 0, 'en het bord rekent er meteen mee');

  /* Water geven en voeren staan bewust NIET achter de manager: dat is het werk
     van wie er 's ochtends staat, en dat hoort niet op een manager te wachten. */
  const w = await api('/api/supplier/boerderij/water', { id: perceelId }, boerWerker || boer);
  assert.equal(w.status, 200, 'beregenen doet wie er staat');
  assert.equal((await api('/api/supplier/boerderij/water', { id: 'bestaatniet' }, boer)).status, 400);
  assert.equal((await api('/api/supplier/boerderij/water', { id: perceelId }, resto)).status, 409);

  const v = await api('/api/supplier/boerderij/voer', { id: dierId }, boerWerker || boer);
  assert.equal(v.status, 200, 'voeren ook');
});

test('4. een pandfoto hoort bij een pand van de eigen makelaar', async () => {
  const mk = await api('/api/supplier/pand', { titel: 'Finca met zeezicht, Sant Josep', prijs: 1850000 }, makelaar);
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 200));
  const panden = mk.body.panden || [];
  const pandId = (panden.find(p => /Sant Josep/.test(p.titel)) || panden[0]).id;
  assert.ok(pandId, 'het pand staat in de portefeuille');

  assert.equal((await api('/api/supplier/pand/foto', { id: pandId, foto: PNG }, resto)).status >= 400, true,
    'een restaurant beheert geen panden');
  assert.equal((await api('/api/supplier/pand/foto', { id: 'bestaatniet', foto: PNG }, makelaar)).status, 404);
  assert.equal((await api('/api/supplier/pand/foto', { id: pandId, foto: 'https://ergens.example/f.jpg' }, makelaar)).status, 400,
    'een verwijzing naar een vreemde server is geen foto');

  const f1 = await api('/api/supplier/pand/foto', { id: pandId, foto: PNG }, makelaar);
  assert.equal(f1.status, 200, JSON.stringify(f1.body).slice(0, 200));
  const f2 = await api('/api/supplier/pand/foto', { id: pandId, foto: PNG }, makelaar);
  const aantal = f2.body.aantal;
  assert.ok(aantal >= 2, 'er staan twee foto\'s bij het pand');

  /* Weghalen gaat op INDEX, en dat is dezelfde valkuil als bij photo/remove:
     splice(-1) haalt de laatste weg en splice(NaN) de eerste. Daar stond een
     grens; hier stond hij niet. Een tikfout in het scherm haalde dus zomaar
     een andere foto van het pand af dan de bedoeling was. */
  const negatief = await api('/api/supplier/pand/foto', { id: pandId, foto: PNG, weg: -1 }, makelaar);
  assert.equal(negatief.status, 400, 'een negatieve index haalt de laatste foto niet weg');
  const geenGetal = await api('/api/supplier/pand/foto', { id: pandId, foto: PNG, weg: 'twee' }, makelaar);
  assert.equal(geenGetal.status, 400, 'en een index die geen getal is haalt de eerste niet weg');
  const buiten = await api('/api/supplier/pand/foto', { id: pandId, foto: PNG, weg: 99 }, makelaar);
  assert.equal(buiten.status, 400, 'een index buiten bereik ook niet');
  assert.equal((await api('/api/supplier/pand/foto', { id: pandId, foto: PNG, weg: 0 }, makelaar)).body.aantal, aantal - 1,
    'de eerste foto gaat er wel af, dus de lijst was intact gebleven');


});

test('5. de fotolijst van een charterreis is van de eigen zaak', async () => {
  /* De fotolijst hangt aan EEN reis, niet aan de zaak: zonder geldige ref is
     er niets te tonen. Dat is precies de goede volgorde -- de foto's van een
     charter horen bij die vaart en niet bij een algemene map waar iedereen
     van de zaak in kan graaien. */
  assert.equal((await api('/api/supplier/charter/fotos', {}, charter)).status, 404,
    'zonder reis is er geen fotolijst');
  assert.equal((await api('/api/supplier/charter/fotos', { ref: 'BESTAATNIET' }, charter)).status, 404);
  assert.equal((await api('/api/supplier/charter/fotos', { ref: 'X' }, resto)).status, 409,
    'een restaurant vaart geen charters');
});
