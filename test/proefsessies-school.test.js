/* De waarheidsproef opent Bord en Schrift niet met een nagebouwde sleutel.
   Deze tegenproef bewijst dat de centrale helper de twee echte Foundation-
   deuren doorloopt en docent en leerling gescheiden houdt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { haalSessies } = require('../scripts/lib/proefsessies');
const { haalSchoolsessies } = require('../scripts/lib/schoolproefsessies');

test('de liegronde krijgt een echte tijdelijke Schoolpas voor bord en schrift', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schoolproef-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
  try {
    const { sessies, overgeslagen } = await haalSessies(srv.base, ['lid', 'gezin']);
    assert.deepEqual(overgeslagen, []);
    const school = await haalSchoolsessies(srv.base, sessies);
    assert.ok(school, 'de echte les en deelname moeten zijn gemaakt');
    const docent = school.bord.tijdelijk.rtf_docent;
    const leerling = school.schrift.tijdelijk.rtf_leerling;
    assert.equal(docent.code, leerling.code, 'beide sleutels horen bij dezelfde les');
    assert.notEqual(docent.token, leerling.token, 'docent en leerling delen geen bevoegdheidssleutel');
    assert.ok(!('rtf_docent' in school.bord.lokaal), 'de tijdelijke sleutel staat niet in localStorage');
    assert.ok(!('rtf_leerling' in school.schrift.lokaal), 'de tijdelijke sleutel staat niet in localStorage');

    const toegang = async (lokaal, appId) => {
      const gezin = JSON.parse(lokaal.rtf_sessie);
      const r = await fetch(srv.base + '/api/rtf/toegang', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: gezin.code, token: gezin.token, appId, scherm: 'app' }) });
      return r.status;
    };
    assert.equal(await toegang(school.bord.lokaal, 'rtf-bord'), 200);
    assert.equal(await toegang(school.schrift.lokaal, 'rtf-schrift'), 200);

    const lees = async (token) => fetch(srv.base + '/api/foundation/bord/' + docent.code,
      { headers: { Authorization: 'Bearer ' + token } });
    assert.equal((await lees(docent.token)).status, 200);
    assert.equal((await lees(leerling.token)).status, 200);
  } finally {
    await stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
