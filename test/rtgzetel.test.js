'use strict';
/* STAP TWEE: EEN ZETEL IN DE RTG-ZAAK IS DE KANTOORSLEUTEL
   (kern/vrijheid/rtgzetel.js, VRIJHEID.md par. 6a).

   Tegen een echte server, de weg van een mens: de eigenaar maakt de RTG-zaak
   met Ria als leidinggevende, Ria zet zichzelf in een kamer, en haar eigen
   account krijgt daardoor de kantoorsleutel -- zonder gedeelde code en zonder
   uitnodiging. Haalt ze zich uit haar laatste kamer, dan is de sleutel weg. En
   de beleidsmotor telt per kamer door wie er zit (eigen / vreemd / zonder
   toewijzing), zonder te noteren wie. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

test('een zetel met een kamer opent het kantoor op naam; zonder kamer niet, en de kamers worden geteld', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtgzetel-'));
  const CODE = 'KANTOOR-ZETEL';
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_OWNER_EMAIL: '' } });
  const api = (pad, body, token) => fetch(srv.base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const eigenaar = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    const u = Date.now().toString().slice(-8);
    const ria = (await api('auth/register', { name: 'Ria Kantoor', email: 'ria' + u + '@x.nl', phone: '06' + u,
      password: 'geheim12345', geboortedatum: '1985-03-03', tier: 'rtg', pasApp: 'rtg' })).body.token;
    const bram = (await api('auth/register', { name: 'Bram Buiten', email: 'bram' + u + '@x.nl', phone: '07' + u,
      password: 'geheim12345', geboortedatum: '1990-04-04', tier: 'rtg', pasApp: 'rtg' })).body.token;
    assert.ok(eigenaar && ria && bram);

    /* Zonder RTG-zaak: geen kantoorsleutel, en start als kantoor weigert. */
    const zonder = (await api('account/rollen', {}, ria)).body.rollen;
    assert.equal(zonder.some(r => r.rol === 'kantoor'), false);
    assert.equal((await api('account/start', { rol: 'kantoor' }, ria)).status, 404);

    const m = await api('office/rtghuis/maak', { beheerder: 'Ria', beheerderLogin: 'ria' + u + '@x.nl' }, eigenaar);
    assert.equal(m.status, 200, JSON.stringify(m.body));

    /* In dienst, maar nog in geen enkele kamer: nog steeds geen sleutel. */
    const rollen = (await api('account/rollen', {}, ria)).body.rollen;
    const pers = rollen.find(r => r.rol === 'personeel' && r.code === m.body.code);
    assert.ok(pers, 'Ria is personeel van de RTG-zaak: ' + JSON.stringify(rollen));
    assert.equal(rollen.some(r => r.rol === 'kantoor'), false, 'een dienstverband alleen is geen kantoorsleutel');

    const zaak = (await api('account/start', { rol: 'personeel', code: pers.code, staffId: pers.staffId }, ria)).body.token;
    assert.ok(zaak);
    const zet = await api('supplier/rtg/afdeling', { staffId: pers.staffId, kamers: ['financien'] }, zaak);
    assert.equal(zet.status, 200, JSON.stringify(zet.body));

    const met = (await api('account/rollen', {}, ria)).body.rollen.find(r => r.rol === 'kantoor');
    assert.ok(met && met.viaRtgZaak, 'met een kamer staat de sleutel aan de bos');
    assert.deepEqual(met.kamers, ['financien']);
    assert.equal((await api('account/rollen', {}, bram)).body.rollen.some(r => r.rol === 'kantoor'), false,
      'de zetel is van RIA: een ander account zonder zetel krijgt hem niet');
    const k = await api('account/start', { rol: 'kantoor' }, ria);
    assert.equal(k.status, 200, JSON.stringify(k.body));
    const kantoor = k.body.token;

    /* De sessie is op naam: de naamdeur laat hem door, de gedeelde code niet. */
    const gedeeld = (await api('office/login', { code: CODE })).body.token;
    assert.equal((await api('office/verifications', {}, kantoor)).status, 200, 'de kluisdeur kent haar bij naam');
    assert.equal((await api('office/verifications', {}, gedeeld)).status, 403, 'tegenproef: de gedeelde code niet');

    /* De telling: eigen kamer, een andere kamer, en de gedeelde code zonder toewijzing. */
    const ander = 'hr';
    assert.equal((await api('office/kamer', { id: 'financien' }, kantoor)).status, 200);
    assert.equal((await api('office/kamer', { id: ander }, kantoor)).status, 200, 'de schaduw houdt niemand tegen');
    assert.equal((await api('office/kamer', { id: 'financien' }, gedeeld)).status, 200);
    /* een MENS zonder zetel (de eigenaar, met zijn eigen account) is ook zonder toewijzing */
    assert.equal((await api('office/kamer', { id: 'financien' }, eigenaar)).status, 200);
    const stand = (await api('office/beleidsmotor', {}, eigenaar)).body;
    const kamer = (id) => stand.kamers.find(x => x.kamer === id).naarToewijzing;
    assert.equal(kamer('financien').eigen, 1, JSON.stringify(stand.kamers.find(x => x.kamer === 'financien')));
    assert.equal(kamer('financien').zonderToewijzing, 2, 'de gedeelde code en de eigenaar');
    assert.equal(kamer(ander).vreemd, 1);
    assert.doesNotMatch(JSON.stringify(stand.kamers), /user-\d+|ria/i, 'geteld wordt de soort, niet wie');

    /* Uit de laatste kamer: de sleutel is bij de volgende vraag weg. */
    assert.equal((await api('supplier/rtg/afdeling', { staffId: pers.staffId, kamers: [] }, zaak)).status, 200);
    assert.equal((await api('account/rollen', {}, ria)).body.rollen.some(r => r.rol === 'kantoor'), false);
    assert.equal((await api('account/start', { rol: 'kantoor' }, ria)).status, 404);
  } finally {
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
