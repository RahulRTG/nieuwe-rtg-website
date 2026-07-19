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

test('9. Provincie: subsidie aanvragen (gecapt op het maximum) en de ambtenaar kent een bedrag toe', async () => {
  const reg = await api(base, '/api/overheid/subsidies', {}, lid);
  assert.ok(reg.body.regelingen.some(r => r.id === 'verduurzaming'));
  // meer vragen dan het maximum wordt gecapt
  const s = await api(base, '/api/overheid/subsidie', { regeling: 'verduurzaming', project: 'Zonnepanelen op het dak', bedrag: 99999 }, lid);
  assert.equal(s.status, 200);
  assert.equal(s.body.subsidie.gevraagd, 4000, 'gecapt op het maximum van de regeling');
  const lijst = await api(base, '/api/overheid/subsidies/lijst', {}, rijk);
  assert.ok(lijst.body.subsidies.some(x => x.ref === s.body.subsidie.ref));
  const bes = await api(base, '/api/overheid/subsidie/beslis', { ref: s.body.subsidie.ref, besluit: 'toegekend', bedrag: 3000 }, rijk);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.subsidie.toegekend, 3000);
  // een gewone partner mag niet behandelen
  assert.equal((await api(base, '/api/overheid/subsidies/lijst', {}, partner)).status, 403);
});

test('10. Waterschap: aanslagen verschijnen en zijn te betalen; een watermelding wordt door de ambtenaar afgehandeld', async () => {
  assert.equal((await api(base, '/api/overheid/waterschap/betaal', { ref: 'x' }, null)).status, 401);
  const mijn = await api(base, '/api/overheid/waterschap/mijn', {}, lid);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.aanslagen.length >= 2, 'watersysteem- en zuiveringsheffing staan klaar');
  const open = mijn.body.aanslagen.find(a => !a.betaald);
  const bet = await api(base, '/api/overheid/waterschap/betaal', { ref: open.ref }, lid);
  assert.equal(bet.status, 200);
  assert.equal(bet.body.aanslag.betaald, true);
  assert.equal((await api(base, '/api/overheid/waterschap/betaal', { ref: open.ref }, lid)).status, 409);
  // een melding aan het waterschap
  const m = await api(base, '/api/overheid/water/meld', { soort: 'wateroverlast', tekst: 'Ondergelopen fietstunnel na de bui', locatie: 'Tunnel Vara de Rey' }, lid);
  assert.equal(m.status, 200);
  const lijst = await api(base, '/api/overheid/water/meldingen', {}, rijk);
  assert.ok(lijst.body.meldingen.some(x => x.ref === m.body.melding.ref));
  const zet = await api(base, '/api/overheid/water/melding/zet', { ref: m.body.melding.ref, status: 'in behandeling', update: 'Gemaal opgeschaald' }, rijk);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.melding.status, 'in behandeling');
  const na = await api(base, '/api/overheid/water/meldingen/mijn', {}, lid);
  const mine = na.body.meldingen.find(x => x.ref === m.body.melding.ref);
  assert.equal(mine.status, 'in behandeling');
  assert.ok(mine.updates.some(u => /opgeschaald/.test(u.tekst)), 'de update reist mee naar de melder');
});

test('11. Koppeling KVK: een onderneming schrijft zich in één tik in (idempotent) en de ambtenaar ziet het handelsregister', async () => {
  const z1 = await api(base, '/api/supplier/overheid/kvk/zorg', {}, partner);
  assert.equal(z1.status, 200);
  assert.ok(z1.body.inschrijving.kvkNummer, 'er is een KVK-nummer');
  // nog een keer levert dezelfde inschrijving, geen dubbele
  const z2 = await api(base, '/api/supplier/overheid/kvk/zorg', {}, partner);
  assert.equal(z2.status, 200);
  assert.equal(z2.body.nieuw, false);
  assert.equal(z2.body.inschrijving.kvkNummer, z1.body.inschrijving.kvkNummer);
  // de ambtenaar ziet het in het handelsregister
  const lijst = await api(base, '/api/overheid/kvk/lijst', {}, rijk);
  assert.ok(lijst.body.inschrijvingen.some(k => k.kvkNummer === z1.body.inschrijving.kvkNummer));
  // een gewoon lid mag het register niet inzien
  assert.equal((await api(base, '/api/overheid/kvk/lijst', {}, lid)).status, 401);
});

test('12. Koppeling RDW: een geregistreerd kenteken is bekend met APK-status, een onbekend kenteken niet', async () => {
  // in test 3 registreerde het lid RTG01A
  const ok = await api(base, '/api/overheid/rdw/check', { kenteken: 'rtg-01-a' }, lid);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.bekend, true);
  assert.equal(ok.body.kenteken, 'RTG01A');
  assert.equal(typeof ok.body.apkGeldig, 'boolean');
  const onbekend = await api(base, '/api/overheid/rdw/check', { kenteken: 'ZZ-999-Z' }, lid);
  assert.equal(onbekend.body.bekend, false);
  // te kort kenteken wordt geweigerd
  assert.equal((await api(base, '/api/overheid/rdw/check', { kenteken: 'AB' }, lid)).status, 400);
});
