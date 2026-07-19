/* De Overheid (kern/overheid.js): de landelijke laag naast de gemeente. Zes
   pijlers voor inwoners, ondernemers en rijksambtenaren. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-overheid-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Inwoner', email: 'o' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1988-03-03', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  // rijksambtenaar: log in als de rijks-partner (manager, PIN 1234)
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  const rlog = await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' });
  rijk = rlog.body.token;
  // een gewone RTG-partner (het demo-restaurant), om te tonen dat die niet mag behandelen
  const kik = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  partner = kik.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. Belastingdienst: aangifte levert een aanslag, betalen kan, dubbel wordt geweigerd, opnieuw indienen overschrijft', async () => {
  assert.equal((await api(base, '/api/overheid/aangifte', { inkomen: 50000 }, null)).status, 401);
  const a = await api(base, '/api/overheid/aangifte', { inkomen: 90000, aftrek: 2000, ingehouden: 10000 }, lid);
  assert.equal(a.status, 200);
  assert.ok(a.body.aanslag.saldo > 0, 'weinig ingehouden -> bijbetalen');
  const ref = a.body.aanslag.ref;
  // een bericht landt in de Berichtenbox
  const bx = await api(base, '/api/overheid/berichten', {}, lid);
  assert.ok(bx.body.berichten.some(b => /aanslag/i.test(b.titel)), 'de aanslag staat in de Berichtenbox');
  assert.ok(bx.body.ongelezen >= 1, 'er is een ongelezen bericht');
  // betalen
  const bet = await api(base, '/api/overheid/aanslag/betaal', { ref }, lid);
  assert.equal(bet.status, 200);
  assert.equal(bet.body.aanslag.betaald, true);
  assert.equal((await api(base, '/api/overheid/aanslag/betaal', { ref }, lid)).status, 409);
  // opnieuw indienen voor hetzelfde jaar overschrijft (nog steeds 1 aanslag)
  await api(base, '/api/overheid/aangifte', { inkomen: 30000, ingehouden: 20000 }, lid);
  const mijn = await api(base, '/api/overheid/aanslagen/mijn', {}, lid);
  assert.equal(mijn.body.aanslagen.length, 1, 'nog steeds een aanslag voor dit jaar');
  assert.ok(mijn.body.aanslagen[0].saldo < 0, 'nu teveel ingehouden -> teruggaaf');
});

test('2. Toeslagen: aanvragen, dubbel geweigerd, en de ambtenaar kent toe', async () => {
  const t = await api(base, '/api/overheid/toeslag', { soort: 'zorgtoeslag', inkomen: 22000 }, lid);
  assert.equal(t.status, 200);
  assert.ok(t.body.toeslag.maandbedrag > 0, 'bij laag inkomen is er recht');
  assert.equal((await api(base, '/api/overheid/toeslag', { soort: 'zorgtoeslag', inkomen: 22000 }, lid)).status, 409);
  // de ambtenaar ziet en beslist
  const lijst = await api(base, '/api/overheid/toeslagen', {}, rijk);
  assert.ok(lijst.body.toeslagen.some(x => x.ref === t.body.toeslag.ref));
  const bes = await api(base, '/api/overheid/toeslag/beslis', { ref: t.body.toeslag.ref, besluit: 'toegekend' }, rijk);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.toeslag.status, 'toegekend');
  // een gewone partner mag niet behandelen
  assert.equal((await api(base, '/api/overheid/toeslagen', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/regie', {}, lid)).status, 401);
});

test('3. RDW: voertuig registreren, dubbel geweigerd, en rijbewijs verlengen', async () => {
  const v = await api(base, '/api/overheid/voertuig/meld', { kenteken: 'RTG-01-A', merk: 'Land Rover' }, lid);
  assert.equal(v.status, 200);
  assert.ok(v.body.voertuig.apkTot, 'er is een APK-datum');
  assert.equal((await api(base, '/api/overheid/voertuig/meld', { kenteken: 'RTG01A', merk: 'x' }, lid)).status, 409);
  const lijst = await api(base, '/api/overheid/voertuigen', {}, lid);
  assert.ok(lijst.body.voertuigen.some(x => x.kenteken === 'RTG01A'));
  const rb = await api(base, '/api/overheid/rijbewijs', {}, lid);
  assert.ok(rb.body.rijbewijs.geldigTot);
  const verl = await api(base, '/api/overheid/rijbewijs/verleng', {}, lid);
  assert.equal(verl.status, 200);
  assert.ok(verl.body.rijbewijs.geldigTot > rb.body.rijbewijs.geldigTot, 'verlengen schuift de datum op');
});

test('4. KVK ondernemersloket: een lid schrijft een eenmanszaak in en vraagt zijn uittreksel op', async () => {
  const k = await api(base, '/api/overheid/kvk/inschrijven', { naam: 'Casa del Sol', rechtsvorm: 'eenmanszaak', sbi: '5610' }, lid);
  assert.equal(k.status, 200);
  assert.ok(/^\d{8}$/.test(k.body.inschrijving.kvkNummer), 'een 8-cijferig KVK-nummer');
  assert.equal((await api(base, '/api/overheid/kvk/inschrijven', { naam: 'Nog een' }, lid)).status, 409);
  const mijn = await api(base, '/api/overheid/kvk/mijn', {}, lid);
  assert.ok(mijn.body.inschrijvingen.some(x => x.naam === 'Casa del Sol'));
  // ook een onderneming zelf kan inschrijven
  const s = await api(base, '/api/supplier/overheid/kvk/inschrijven', { naam: 'Kikunoi Ibiza SL', rechtsvorm: 'bv' }, partner);
  assert.equal(s.status, 200);
});

test('5. Sociale zekerheid: aanvraag bij UWV en een besluit van de ambtenaar', async () => {
  const u = await api(base, '/api/overheid/uitkering', { soort: 'ww', toelichting: 'Contract afgelopen' }, lid);
  assert.equal(u.status, 200);
  assert.equal(u.body.aanvraag.status, 'aangevraagd');
  const lijst = await api(base, '/api/overheid/uitkeringen', {}, rijk);
  assert.ok(lijst.body.uitkeringen.some(x => x.ref === u.body.aanvraag.ref));
  const bes = await api(base, '/api/overheid/uitkering/beslis', { ref: u.body.aanvraag.ref, besluit: 'toegekend' }, rijk);
  assert.equal(bes.status, 200);
  const mijn = await api(base, '/api/overheid/uitkeringen/mijn', {}, lid);
  assert.equal(mijn.body.uitkeringen.find(x => x.ref === u.body.aanvraag.ref).status, 'toegekend');
});

test('6. Referendum: stemmen telt mee, dubbel stemmen wordt geweigerd, en de ambtenaar sluit de stemming', async () => {
  const v0 = await api(base, '/api/overheid/verkiezing', {}, lid);
  assert.equal(v0.status, 200);
  assert.equal(v0.body.verkiezing.alGestemd, false);
  const s = await api(base, '/api/overheid/stem', { keuze: 'voor' }, lid);
  assert.equal(s.status, 200);
  assert.equal(s.body.verkiezing.alGestemd, true);
  assert.ok(s.body.verkiezing.totaal >= 1);
  assert.equal((await api(base, '/api/overheid/stem', { keuze: 'tegen' }, lid)).status, 409);
  // de ambtenaar sluit de stemming; daarna kan niemand meer stemmen
  const sl = await api(base, '/api/overheid/verkiezing/sluit', { open: false }, rijk);
  assert.equal(sl.status, 200);
  assert.equal(sl.body.verkiezing.open, false);
});

test('7. Bezwaar & bekendmakingen: een lid maakt bezwaar, de ambtenaar beslist, en er zijn rijksbekendmakingen', async () => {
  const bk = await api(base, '/api/overheid/bekendmakingen', {}, lid);
  assert.ok(bk.body.bekendmakingen.length >= 1, 'er staan rijksbekendmakingen klaar');
  const bz = await api(base, '/api/overheid/bezwaar', { tegen: 'Aanslag IB ' + new Date().getFullYear(), reden: 'De aftrek is niet meegenomen' }, lid);
  assert.equal(bz.status, 200);
  const lijst = await api(base, '/api/overheid/bezwaren', {}, rijk);
  assert.ok(lijst.body.bezwaren.some(x => x.ref === bz.body.bezwaar.ref));
  const bes = await api(base, '/api/overheid/bezwaar/beslis', { ref: bz.body.bezwaar.ref, besluit: 'gegrond', motivatie: 'Aftrek alsnog verwerkt' }, rijk);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.bezwaar.status, 'gegrond');
  const mijn = await api(base, '/api/overheid/bezwaren/mijn', {}, lid);
  assert.equal(mijn.body.bezwaren.find(x => x.ref === bz.body.bezwaar.ref).status, 'gegrond');
});

test('8. Belasting-rekenhulp geeft dezelfde uitkomst zonder in te dienen', async () => {
  const r = await api(base, '/api/overheid/belasting/bereken', { inkomen: 60000, aftrek: 0, ingehouden: 15000 }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.uitkomst.belastbaar, 60000);
  assert.ok(r.body.uitkomst.saldo > 0, '15000 ingehouden op 60000 -> nog bijbetalen');
});
