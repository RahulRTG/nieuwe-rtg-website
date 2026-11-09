'use strict';
/* Een auditbreuk wordt niet met de gewone app-sleutel gladgestreken. Alleen
   een apart getekende verklaring kan exact van een bestaand extern punt via
   een gemeenschappelijk punt naar een aantoonbare lokale tak gaan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const herstel = require('../server/lib/ankerherstel');
const { maakAnkerdienst } = require('../server/lib/ankerdienst');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ankerherstel-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const H = n => String(n).repeat(32).slice(0, 32);
const AT = n => `2026-10-21T10:55:${String(n).padStart(2, '0')}.000Z`;
function paar() {
  const p = crypto.generateKeyPairSync('ed25519');
  return { prive: p.privateKey, publiek: p.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64') };
}
function dossier() {
  return { soort: herstel.SOORT, versie: 1, id: '0f5bf00a-3abc-49ba-97ca-9f6554f1780d',
    gemaaktAt: '2026-11-09T18:00:00.000Z', journaal: 'apiSpoor', redenCode: herstel.REDEN,
    van: { tijdvak: 1, nr: 7, hash: H(7), at: AT(7) },
    gemeenschappelijk: { nr: 3, hash: H(3), at: AT(3) },
    naar: { tijdvak: 2, nr: 4, hash: 'a'.repeat(32), at: AT(4) },
    verlies: { vanafNr: 4, totNr: 7, aantal: 4, status: 'inhoud-onherstelbaar' },
    bewijs: [{ soort: 'extern-ankerbestand', sha256: 'b'.repeat(64) }] };
}

test('vorm en aparte handtekening zijn fail-closed', () => {
  const h = paar(), app = paar();
  const v = herstel.teken(dossier(), h.prive);
  assert.equal(herstel.controleer(v, Buffer.from(h.publiek, 'base64')).geldig, true);
  assert.match(herstel.controleer(v, Buffer.from(app.publiek, 'base64')).reden, /herstelhandtekening/);
  const stuk = structuredClone(v); stuk.verlies.aantal = 3;
  assert.match(herstel.controleer(stuk, Buffer.from(h.publiek, 'base64')).reden, /verliesbereik/);
  const vals = structuredClone(v); vals.naar.hash = 'c'.repeat(32);
  assert.match(herstel.controleer(vals, Buffer.from(h.publiek, 'base64')).reden, /handtekening/);
});

test('de ankerdienst benoemt de breuk, markeert tijdvak 2 en geeft de verklaring mee', () => {
  const sleutel = Buffer.alloc(32, 11), h = paar();
  const extern = { data: { apiSpoor: { commandJournaal: [1, 2, 3, 4, 5, 6, 7].map(n => ({ at: AT(n), zegel: H(n) })), commandJournaalTotaal: 7 } } };
  const lokaal = { data: { apiSpoor: { commandJournaal: [
    { at: AT(1), zegel: H(1) }, { at: AT(2), zegel: H(2) }, { at: AT(3), zegel: H(3) },
    { at: AT(4), zegel: 'a'.repeat(32) }], commandJournaalTotaal: 4 } } };
  const oud = maakAnkerdienst({ db: extern, sleutel: () => sleutel, omgeving: {} }).blok();
  const v = herstel.teken(dossier(), h.prive);
  const bestand = path.join(tmp, 'verklaring.json');
  fs.writeFileSync(bestand, JSON.stringify(v));
  const dienst = maakAnkerdienst({ db: lokaal, sleutel: () => sleutel, omgeving: {
    RTG_ANKER_HERSTEL_FILE: bestand, RTG_ANKER_HERSTEL_PUBLIEK: h.publiek } });
  const uit = dienst.reken(oud);
  assert.equal(uit.ok, true);
  assert.equal(uit.perJournaal.apiSpoor.auditbreuk, true, 'geen gewone groene vergelijking');
  assert.equal(uit.perJournaal.apiSpoor.tijdvak, 2);
  assert.deepEqual(uit.herstelverklaringen.map(x => x.id), [v.id]);
  assert.deepEqual(dienst.blok().punten.apiSpoor, { nr: 4, hash: 'a'.repeat(32), at: AT(4), tijdvak: 2, herstelId: v.id });
});

test('zonder exact lokaal gemeenschappelijk en beginpunt blijft de breuk rood', () => {
  const h = paar(), v = herstel.teken(dossier(), h.prive);
  const bestand = path.join(tmp, 'verkeerd.json'); fs.writeFileSync(bestand, JSON.stringify(v));
  const db = { data: { apiSpoor: { commandJournaal: [
    { at: AT(3), zegel: 'd'.repeat(32) }, { at: AT(4), zegel: 'a'.repeat(32) }], commandJournaalTotaal: 4 } } };
  const m = herstel.maakHerstel({ omgeving: { RTG_ANKER_HERSTEL_FILE: bestand, RTG_ANKER_HERSTEL_PUBLIEK: h.publiek } });
  const u = m.verklaar({ naam: 'apiSpoor', anker: dossier().van,
    regels: require('../server/lib/ankerjournalen').JOURNALEN.apiSpoor(db.data) });
  assert.equal(u.verklaard, false); assert.match(u.reden, /gemeenschappelijke punt/);
});

test('de handmatige bediening houdt de private sleutel buiten app en verklaring', () => {
  const cli = require('../scripts/ankerherstel');
  const prive = path.join(tmp, 'offline.pem'), publiek = path.join(tmp, 'herstel.pub');
  cli.sleutel(prive, publiek);
  assert.equal(fs.statSync(prive).mode & 0o077, 0, 'private sleutel is alleen voor de eigenaar');
  const dossierPad = path.join(tmp, 'dossier.json'), uit = path.join(tmp, 'getekend.json');
  fs.writeFileSync(dossierPad, JSON.stringify(dossier()));
  cli.teken(dossierPad, uit, { RTG_ANKER_HERSTEL_SIGN_KEY_FILE: prive });
  const v = JSON.parse(fs.readFileSync(uit, 'utf8'));
  assert.equal(cli.controleer(uit, { RTG_ANKER_HERSTEL_PUBLIEK_BESTAND: publiek }).geldig, true);
  assert.ok(!fs.readFileSync(uit, 'utf8').includes('PRIVATE KEY'));
  assert.throws(() => cli.teken(dossierPad, uit, { RTG_ANKER_HERSTEL_SIGN_KEY_FILE: prive }), /exist|bestaat|EEXIST/i,
    'een verklaring wordt niet overschreven');
});

test('eenmalig tekenen bewaart alleen publiek en verklaring, nooit een private sleutel', () => {
  const cli = require('../scripts/ankerherstel');
  const basis = path.join(tmp, 'eenmalig'); fs.mkdirSync(basis);
  const dossierPad = path.join(basis, 'dossier.json'), verklaring = path.join(basis, 'verklaring.json');
  const publiek = path.join(basis, 'publiek.b64'); fs.writeFileSync(dossierPad, JSON.stringify(dossier()));
  const r = cli.tekenEenmalig(dossierPad, verklaring, publiek);
  assert.equal(r.priveBewaard, false);
  assert.deepEqual(fs.readdirSync(basis).sort(), ['dossier.json', 'publiek.b64', 'verklaring.json']);
  assert.equal(cli.controleer(verklaring, { RTG_ANKER_HERSTEL_PUBLIEK_BESTAND: publiek }).geldig, true);
  assert.throws(() => cli.tekenEenmalig(dossierPad, verklaring, publiek), /exist|bestaat|EEXIST/i);
});
