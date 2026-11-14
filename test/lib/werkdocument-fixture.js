/* Echte lokale Room-data: persoonlijke kantooruitnodiging, RTMail en
   project/van-mail. Geen route.fulfill, opslaginjectie, besluit of betaling.
   Dit is een lokale SQLite-domeinfixture, geen productie-passkeykwalificatie.
   Sluit met await fixture.sluit(), ook wanneer de browserproef faalt. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const { startServer, stopHard, kantoorKoppelBody } = require('../helper');

async function startWerkdocumentFixture() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkdocument-'));
  const eigenaar = 'werkdocument-eigenaar@example.test', bootstrap = randomUUID();
  let srv, gesloten = false;
  async function sluit() {
    if (gesloten) return;
    gesloten = true;
    if (srv) await stopHard(srv.child);
    fs.rmSync(map, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  try {
    srv = await startServer({ env: {
      RTG_DATA_DIR: map, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', REDIS_URL: '',
      APP_URL: 'http://127.0.0.1', RTG_DEMO: '0', RTG_MAGNAAT_TEST: '0',
      RTG_OWNER_EMAIL: eigenaar, RTG_OWNER_BOOTSTRAP: bootstrap,
      SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '',
      RTG_AI_UIT: '1', RTG_BETALEN_UIT: '1', RTG_PUSH_UIT: '1'
    } });
    async function post(pad, body, token) {
      const r = await fetch(srv.base + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body || {}) });
      const d = await r.json();
      assert.equal(r.status, 200, pad + ': ' + JSON.stringify(d));
      assert.equal(d.error, undefined, pad + ': ' + JSON.stringify(d));
      assert.notEqual(d.ok, false, pad + ': ' + JSON.stringify(d));
      return d;
    }
    async function registreer(name, email, extra) {
      const d = await post('/api/auth/register', { name, email, password: 'Lokale-Room-proef-2026!',
        geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg', ...extra });
      assert.ok(d.token, 'registratie geeft een echte leden-token');
      return d.token;
    }
    const eigenaarLid = await registreer('Lokale Room-eigenaar', eigenaar, { eigenaarSleutel: bootstrap });
    const eigenaarOffice = (await post('/api/account/start', { rol: 'kantoor' }, eigenaarLid)).token;
    assert.ok(eigenaarOffice, 'de lokale eigenaar opent een persoonlijke kantoorsessie');
    const token = await registreer('Lokale Room-medewerker', 'werkdocument-medewerker@example.test');
    const koppel = await kantoorKoppelBody(srv.base, token, null, { eigenaar: eigenaarOffice });
    assert.match(koppel.uitnodiging, /^KU\./, 'de bestaande helper moet een echte uitnodiging ontvangen');
    assert.equal((await post('/api/account/koppel', koppel, token)).ok, true);
    const office = (await post('/api/account/start', { rol: 'kantoor' }, token)).token;
    assert.ok(office, 'de uitgenodigde medewerker opent het kantoor op naam');
    const me = (await post('/api/auth/me', {}, token)).user;
    assert.ok(me && me.codename);
    const state = async huis => {
      assert.ok(['rtg', 'rtf'].includes(huis));
      const d = await post('/api/rtgone/state', { huis }, office);
      assert.equal(d.ok, true); assert.equal(d.huis, huis);
      assert.equal(d.vandaag.persoonlijk, true);
      assert.equal(d.governance.identiteit, me.codename);
      assert.equal(d.governance.baas, false, 'de Room-medewerker is niet de lokale eigenaar');
      return d;
    };
    const huizen = {};
    for (const huis of ['rtg', 'rtf']) {
      const voor = await state(huis);
      assert.equal(voor.projecten.length, 0); assert.equal(voor.goedkeuringen.length, 0);
      // RTG One publiceert nog zijn historische persoonlijke @rtmail-adres.
      // Gebruik dat API-adres: moderne roladressen importeren is apart bereik.
      const naar = voor.vandaag.adres;
      assert.match(naar, /@rtmail$/);
      const titel = huis.toUpperCase() + ' · Broncontrole en overdracht van een lokaal werkdocument';
      const concept = await post('/api/member/rtmail/concept/bewaar', { naar, onderwerp: titel,
        tekst: 'Controleer de bron en leg een operationeel voorstel voor. Dit is uitsluitend geïsoleerde proefdata.' }, eigenaarLid);
      assert.equal(concept.ok, true); assert.ok(concept.concept.id);
      const verzonden = await post('/api/member/rtmail/concept/verstuur', { id: concept.concept.id }, eigenaarLid);
      assert.equal(verzonden.ok, true); assert.ok(verzonden.bericht.id);
      const inbox = await post('/api/member/rtmail/inbox', {}, token);
      const mail = inbox.berichten.find(m => m.id === verzonden.bericht.id);
      assert.ok(mail, 'de medewerker ontvangt de bron via zijn echte postvak');
      const gemaakt = await post('/api/rtgone/project/van-mail', { huis, mailId: mail.id, titel,
        bedoeling: 'De opgegeven bron controleren en de overdracht aantoonbaar voorbereiden.',
        goedkeuringType: 'operations', bedrag: 0, impact: 3, risico: 2, omkeerbaar: true,
        waaromNu: 'Een collega moet het dossier kunnen overnemen.', alternatief: 'Het bestaande proces ongewijzigd laten.',
        beheersing: 'Een mens beoordeelt het voorstel voordat uitvoering wordt vrijgegeven.' }, office);
      assert.equal(gemaakt.ok, true); assert.ok(gemaakt.project.goedkeuringId);
      const na = await state(huis);
      assert.equal(na.projecten.length, 1); assert.equal(na.goedkeuringen.length, 1);
      const project = na.projecten[0], besluit = na.goedkeuringen[0];
      assert.equal(project.id, gemaakt.project.id); assert.equal(project.bron.mailId, mail.id);
      assert.equal(project.huis, huis); assert.equal(project.taken.length, 3);
      assert.equal(besluit.id, project.goedkeuringId); assert.equal(besluit.projectId, project.id);
      assert.equal(besluit.aanvrager, project.eigenaarKey);
      assert.equal(besluit.bronMailId, mail.id); assert.equal(besluit.huis, huis);
      assert.equal(besluit.type, 'operations'); assert.equal(besluit.bedrag, 0);
      assert.equal(besluit.status, 'wacht'); assert.deepEqual(besluit.stemmen, []);
      huizen[huis] = { project, besluit, mail, intentie: gemaakt.intentie };
    }
    assert.notEqual(huizen.rtg.project.id, huizen.rtf.project.id);
    assert.notEqual(huizen.rtg.besluit.id, huizen.rtf.besluit.id);
    for (const huis of ['rtg', 'rtf']) {
      const d = await state(huis);
      assert.deepEqual(d.projecten.map(p => p.id), [huizen[huis].project.id]);
      assert.deepEqual(d.goedkeuringen.map(p => p.id), [huizen[huis].besluit.id]);
    }
    return { srv, base: srv.base, token, office, huizen, state, sluit };
  } catch (e) { await sluit(); throw e; }
}

module.exports = { startWerkdocumentFixture };
