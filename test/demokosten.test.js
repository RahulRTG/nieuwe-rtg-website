/* WAT DE DEMOSEED KOST, EN WAAROM DAT EEN METER VERDIENT.

   De demostand zet bij een verse database 183 personeelsrijen neer (71 zaken,
   server/kern/staffseed.js en staffseed2.js). Die kregen elk een scrypt-hash op
   VOLLE kosten, synchroon, voor `listen`. Op de verhoogde standaard (N=32768)
   is dat ruim twintig seconden waarin de server op 100% draait en niets
   aanneemt.

   HOE DAT AAN HET LICHT KWAM. test/zaakdoos.test.js wacht twintig seconden op
   /api/health en zakte op alle tien zijn toetsen met "kwam niet op". Nagemeten
   op dezelfde machine: N=16384 gaf een opstart van 10 s, N=32768 van 21 s, met
   RTG_SCRYPT_N=1024 3,5 s. Het verhogen van de kosten -- op zichzelf goed --
   duwde de opstart over de wachttijd van die toets heen. En omdat elke toets
   een VERSE datamap krijgt, betaalde de hele toetsenreeks dat per serverstart
   opnieuw.

   DE OORZAAK, NIET HET SYMPTOOM. De toets langer laten wachten was de
   verleiding. Maar deze wachtwoorden zijn de pincodes '1234' en '5678', ze
   staan letterlijk in de repo, en een sleutelafleiding beschermt een geheim --
   hier is er geen. Volle kosten voor een openbare waarde is werk zonder
   opbrengst. Vandaar hashDemoSync (server/accounts/wachtwoord.js).

   WAT DEZE TOETS VASTLEGT, en het kan allemaal zakken:
     1. hashDemoSync WEIGERT buiten de demostand -- de eerste grendel;
     2. wat hij schrijft is een gewone, leesbare hash die klopt, en een
        verkeerd wachtwoord komt er niet doorheen;
     3. moetVernieuwen() ziet hem als achterstallig, zodat de eerste echte
        inlog hem opwaardeert;
     4. DE METER ZELF: na een echte demostart staat de pincode van de seed in
        de database op demokosten en niet op volle kosten. Zet server.js terug
        op createStaffSync en deze toets zakt.
     5. en de seed-pincode werkt gewoon: de manager van KIKUNOI logt in.

   Punt 4 is waar het om gaat. Een opstarttijd meten zou van de machine
   afhangen; de N in de opgeslagen hash is een feit.

   Draai los: node --experimental-sqlite --test test/demokosten.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');

const W = require('../server/accounts/wachtwoord');

test('1. hashDemoSync bestaat alleen in de demostand', () => {
  const oud = process.env.RTG_DEMO;
  try {
    delete process.env.RTG_DEMO;
    assert.throws(() => W.hashDemoSync('1234'), /demostand/i,
      'zonder RTG_DEMO=1 hoort deze functie te weigeren, niet goedkoop te hashen');
    process.env.RTG_DEMO = '0';
    assert.throws(() => W.hashDemoSync('1234'), /demostand/i, 'en 0 is ook geen 1');
    process.env.RTG_DEMO = '1';
    assert.ok(W.hashDemoSync('1234').startsWith('s2$'), 'mét de vlag doet hij zijn werk');
  } finally {
    if (oud === undefined) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = oud;
  }
});

test('2. een demohash is een gewone hash: hij klopt, en een fout wachtwoord niet', async () => {
  const oud = process.env.RTG_DEMO;
  process.env.RTG_DEMO = '1';
  try {
    const h = W.hashDemoSync('1234');
    const d = h.split('$');
    assert.equal(d[0], 's2', 'zelfde vorm als elke andere hash -- geen apart formaat');
    assert.equal(Number(d[1]), W.DEMO_N, 'met de demokosten erin geschreven');
    assert.equal(await W.verifyPassword('1234', h), true, 'het juiste wachtwoord komt erdoor');
    assert.equal(await W.verifyPassword('5678', h), false, 'een ander niet');
    assert.equal(await W.verifyPassword('', h), false);
  } finally {
    if (oud === undefined) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = oud;
  }
});

test('3. een demohash is achterstallig, dus de eerste echte inlog waardeert hem op', () => {
  const oud = process.env.RTG_DEMO;
  process.env.RTG_DEMO = '1';
  try {
    assert.ok(W.DEMO_N < W.SCRYPT_N, 'anders levert dit hele bestand niets op');
    assert.equal(W.moetVernieuwen(W.hashDemoSync('1234')), true,
      'zonder dit zou een demohash voor altijd goedkoop blijven, ook na een echte inlog');
    assert.equal(W.moetVernieuwen(W.hashPasswordSync('1234')), false,
      'en een volwaardige hash hoort juist NIET vernieuwd te worden');
  } finally {
    if (oud === undefined) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = oud;
  }
});

test('4. DE METER: na een demostart staat de seed-pincode op demokosten', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-demokosten-'));
  let srv;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1' } });

    /* Rechtstreeks in de database kijken: de hash gaat niet over de HTTP-lijn,
       en dat hoort ook zo. Alleen-lezen, zodat deze toets de server die er nog
       op staat niet in de weg zit. */
    const db = new DatabaseSync(path.join(TMP, 'rtg.db'), { readOnly: true });
    let rijen;
    try {
      rijen = db.prepare("SELECT pin_hash FROM supplier_staff WHERE supplier_code = 'KIKUNOI'").all();
    } finally { db.close(); }

    assert.ok(rijen.length >= 2, 'de seed hoort personeel te hebben gezet (kreeg ' + rijen.length + ')');
    for (const r of rijen) {
      const d = String(r.pin_hash || '').split('$');
      assert.equal(d[0], 's2', 'een seed-hash hoort het huidige formaat te hebben: ' + String(r.pin_hash).slice(0, 12));
      assert.equal(Number(d[1]), W.DEMO_N,
        'de demoseed betaalt weer volle scrypt-kosten (N=' + d[1] + '); dat is twintig seconden voor listen');
    }

    /* TEGENPROEF op dezelfde server: het eigenaarsaccount is GEEN seed-pincode
       maar een echt wachtwoord, en dat hoort wel op volle kosten te staan.
       Zonder deze bewering zou "alles goedkoop" ook groen zijn. */
    const db2 = new DatabaseSync(path.join(TMP, 'rtg.db'), { readOnly: true });
    let users;
    try { users = db2.prepare('SELECT password_hash FROM users').all(); } finally { db2.close(); }
    const vol = users.filter(u => Number(String(u.password_hash || '').split('$')[1]) >= W.SCRYPT_N);
    assert.ok(vol.length > 0,
      'geen enkel ledenwachtwoord staat op volle kosten -- dan is de goedkope weg te ver doorgesijpeld');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('5. en de seed-pincode werkt gewoon: de manager van KIKUNOI logt in', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-demopin-'));
  let srv;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1' } });
    const post = (pad, body) => fetch(srv.base + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const man = (roster.staff || []).find(x => x.role === 'manager');
    assert.ok(man, 'KIKUNOI heeft een manager in het rooster');

    const goed = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    assert.ok(goed.body.token, 'de seed-pincode komt erdoor: ' + JSON.stringify(goed.body).slice(0, 120));

    const fout = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '9999' });
    assert.ok(!fout.body.token, 'en een verkeerde pincode niet -- goedkoper hashen is geen open deur');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
