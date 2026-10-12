/* SCHAKELEN IN DE VRIJGAVEPOORT (server/kern/vrijgave/schakelen.js): iedere
   weigering vóór het schrijven met zijn eigen status, de ongewijzigde gevallen
   die geen auditregel mogen opleveren, en een auditlog dat gooit zonder de
   schakeling terug te draaien. Het standbestand is echt (een tijdelijke map);
   het auditlog is een lijst die we nalezen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const maakSchakelen = require('../server/kern/vrijgave/schakelen');
const { maakStand } = require('../server/kern/vrijgave/stand');
const reg = require('../server/kern/vrijgave/register');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-schakelen-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;

/* Een niet-geldregel naast het echte register, voor het pad zonder passkey. */
const LOS = Object.freeze({ id: 'proef.los', geld: false, beveiliging: false, veiligeStand: 'disabled',
  standen: ['disabled', 'shadow', 'sandbox', 'enabled'] });
function opstelling(o = {}) {
  const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d);
  const st = maakStand({ bestand: path.join(d, 's.json') });
  const log = [];
  const audit = o.audit === undefined ? (wie, zin) => log.push([wie, zin]) : o.audit;
  const register = { vind: id => (id === LOS.id ? LOS : reg.vind(id)) };
  const s = maakSchakelen({ st, register, isOpenbaar: o.isOpenbaar || (() => false), sandboxMag: o.sandboxMag, k: { audit } });
  return Object.assign(s, { st, log });
}
const ZET = { wie: 'user-7', reden: 'proef van het schakelen', stapOmhoog: true };
const BESLUIT = { wie: 'user-7', bron: 'dossier-42', sha256: 'b'.repeat(64), reden: 'proef van een besluit', stapOmhoog: true };

test('zet weigert vóór het schrijven, ieder met zijn eigen status', () => {
  const s = opstelling();
  assert.equal(s.zet('geld.verzonnen', 'enabled', ZET).status, 404);
  assert.equal(s.zet('geld.inkomend', 'aan', ZET).status, 400);
  assert.equal(s.zet('proef.los', 'suspended', ZET).status, 409, 'een stand die deze capability niet kent');
  assert.equal(s.zet('geld.inkomend', 'disabled', Object.assign({}, ZET, { wie: undefined })).status, 403);
  assert.equal(s.zet('geld.inkomend', 'disabled', Object.assign({}, ZET, { wie: 'admin' })).status, 403);
  assert.equal(s.zet('geld.inkomend', 'disabled', Object.assign({}, ZET, { reden: '  kort   ' })).status, 400);
  assert.equal(s.zet('geld.inkomend', 'disabled').status, 403, 'zonder opties');
  const pk = s.zet('geld.inkomend', 'shadow', Object.assign({}, ZET, { stapOmhoog: 'ja' }));
  assert.equal(pk.status, 401);
  assert.equal(pk.bevestigingNodig, true, 'schaduw telt als aanzetten');
  assert.equal(s.st.lees().staat.versie, 0, 'er is niets geschreven');
  assert.deepEqual(s.log, []);
});

test('een niet-geldregel gaat aan zonder passkey; uitzetten van geld vraagt er nooit een', () => {
  const s = opstelling();
  const a = s.zet('proef.los', 'enabled', { wie: 'user-7', reden: 'aanzetten zonder geld' });
  assert.equal(a.ok, true);
  assert.equal(a.van, 'disabled');
  const b = s.zet('geld.inkomend', 'emergency_disabled', { wie: 'user-7', reden: 'noodstop van de proef' });
  assert.equal(b.ok, true);
  assert.equal(s.log.length, 2);
  assert.match(s.log[1][1], /^Vrijgave geld\.inkomend: disabled -> emergency_disabled \(versie 2\)\. Reden: noodstop van de proef$/);
});

test('sandbox: zonder sandboxMag beslist "niet openbaar", en een openbare of verboden installatie weigert', () => {
  const lokaal = opstelling();
  assert.equal(lokaal.zet('proef.los', 'sandbox', ZET).ok, true);
  assert.equal(opstelling({ isOpenbaar: () => true }).zet('proef.los', 'sandbox', ZET).status, 409);
  assert.equal(opstelling({ sandboxMag: () => false }).zet('proef.los', 'sandbox', ZET).status, 409);
  assert.equal(opstelling({ isOpenbaar: () => true, sandboxMag: () => true }).zet('proef.los', 'sandbox', ZET).ok, true,
    'een opgegeven sandboxMag gaat voor de openbaar-lezing');
});

test('dezelfde stand nog eens: ongewijzigd en zonder auditregel; een lange reden wordt ingekort', () => {
  const s = opstelling();
  const lang = 'x'.repeat(800);
  assert.equal(s.zet('geld.inkomend', 'suspended', Object.assign({}, ZET, { reden: lang })).ok, true);
  assert.equal(s.st.standVan('geld.inkomend').reden.length, 500);
  const nog = s.zet('geld.inkomend', 'suspended', ZET);
  assert.deepEqual(nog, { versie: 2, ok: true, ongewijzigd: true, stand: 'suspended' });
  assert.equal(s.log.length, 1);
  assert.equal(s.st.lees().staat.geschiedenis.length, 1);
});

test('een auditlog dat gooit draait geen schakeling, vastlegging of intrekking terug', () => {
  const s = opstelling({ audit: () => { throw new Error('log stuk'); } });
  assert.equal(s.zet('geld.inkomend', 'suspended', ZET).ok, true);
  assert.equal(s.besluitVastleggen('emoney.b3', BESLUIT).ok, true);
  assert.equal(s.besluitIntrekken('emoney.b3', { wie: 'user-7', reden: 'proef van intrekken' }).ok, true);
  assert.equal(s.st.standVan('geld.inkomend').stand, 'suspended');
  assert.ok(s.st.lees().staat.besluiten['emoney.b3'].ingetrokken);
});

test('zonder auditlog werkt schakelen gewoon', () => {
  const s = opstelling({ audit: null });
  assert.equal(s.zet('geld.inkomend', 'suspended', ZET).ok, true);
  assert.equal(s.besluitVastleggen('emoney.b3', BESLUIT).ok, true);
  assert.equal(s.besluitIntrekken('emoney.b3', { wie: 'user-7', reden: 'proef van intrekken' }).ok, true);
});

test('besluitVastleggen weigert ieder ontbrekend stuk met zijn eigen status', () => {
  const s = opstelling();
  const met = x => Object.assign({}, BESLUIT, x);
  assert.equal(s.besluitVastleggen('verzonnen', BESLUIT).status, 404);
  assert.equal(s.besluitVastleggen('emoney.b3', met({ wie: 'iemand' })).status, 403);
  assert.equal(s.besluitVastleggen('emoney.b3').status, 403, 'zonder opties');
  const pk = s.besluitVastleggen('emoney.b3', met({ stapOmhoog: false }));
  assert.equal(pk.status, 401);
  assert.equal(pk.bevestigingNodig, true);
  assert.match(s.besluitVastleggen('emoney.b3', met({ sha256: 'B'.repeat(64) })).error, /SHA-256/);
  assert.match(s.besluitVastleggen('emoney.b3', met({ sha256: undefined })).error, /SHA-256/);
  assert.match(s.besluitVastleggen('emoney.b3', met({ bron: 'kort' })).error, /bron/);
  assert.match(s.besluitVastleggen('emoney.b3', met({ bron: 'x'.repeat(301) })).error, /bron/);
  assert.match(s.besluitVastleggen('emoney.b3', met({ bron: undefined })).error, /bron/);
  assert.match(s.besluitVastleggen('emoney.b3', met({ reden: 'te kort' })).error, /tien tekens/);
  assert.equal(s.st.lees().staat.versie, 0);
  const ok = s.besluitVastleggen('emoney.b3', BESLUIT);
  assert.deepEqual(ok, { versie: 1, ok: true, besluit: 'emoney.b3' });
  assert.equal(s.st.besluit('emoney.b3').bron, 'dossier-42');
  assert.match(s.log[0][1], /emoney\.b3 vastgelegd \(bron dossier-42, sha256 b{64}\)/);
});

test('besluitIntrekken: weigeringen, ongewijzigd als er niets (meer) is, en een spoor als er wel iets was', () => {
  const s = opstelling();
  const IN = { wie: 'user-7', reden: 'proef van intrekken' };
  assert.equal(s.besluitIntrekken('verzonnen', IN).status, 404);
  assert.equal(s.besluitIntrekken('emoney.b3', { reden: IN.reden }).status, 403);
  assert.equal(s.besluitIntrekken('emoney.b3').status, 403, 'zonder opties');
  assert.equal(s.besluitIntrekken('emoney.b3', { wie: 'user-7', reden: 'kort' }).status, 400);
  assert.equal(s.besluitIntrekken('emoney.b3', IN).ongewijzigd, true, 'niets om in te trekken');
  assert.equal(s.besluitVastleggen('emoney.b3', BESLUIT).ok, true);
  const ja = s.besluitIntrekken('emoney.b3', IN);
  assert.equal(ja.ingetrokken, true);
  assert.equal(s.st.besluit('emoney.b3'), null);
  assert.equal(s.besluitIntrekken('emoney.b3', IN).ongewijzigd, true, 'al ingetrokken');
  assert.deepEqual(s.log.map(r => r[1].includes('INGETROKKEN')), [false, true], 'alleen de echte intrekking komt in het log');
});
