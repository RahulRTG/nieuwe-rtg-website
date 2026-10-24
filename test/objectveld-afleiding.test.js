/* Handgelezen objectpoorten mogen niet verdwijnen tussen generator en toets.
   Een veld mag evenmin worden geleend van een andere HTTP-methode of route. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { objectVeldVan } = require('../scripts/lib/objectveld');
const rij = route => ({ route, toegang: { waargenomen: 'OBJECT_SCOPED' } });

test('alle acht handgelezen Lab-objectpoorten leveren hun bestaande veld', () => {
  for (const pad of ['mijn', 'mijn/observatie', 'mijn/venster', 'mijn/meting',
    'mijn/reflectie', 'mijn/terugtrekken', 'mijn/terugtrekken/gevolg']) {
    assert.equal(objectVeldVan(rij('POST /api/lab2/' + pad)), 'pas');
  }
  assert.equal(objectVeldVan(rij('POST /api/lab2/bewoner/paspoort')), 'code');
});

test('handpoort leent geen veld aan andere methode, onbekende route of accountpoort', () => {
  for (const route of ['GET /api/lab2/mijn', 'DELETE /api/lab2/mijn',
    '/api/lab2/mijn', 'POST /api/lab2/mijn/onbekend',
    'POST /api/lab2/bewoner/klacht', 'POST /api/onbekend']) {
    assert.ok(!objectVeldVan(rij(route)), route);
  }
});

test('expliciete handler- en contractvelden behouden hun bestaande voorrang', () => {
  const r = rij('POST /api/lab2/mijn');
  const contracten = { [r.route]: { toegang: { objectVeld: 'contractVeld' } } };
  assert.equal(objectVeldVan(r, contracten), 'contractVeld');
  assert.equal(objectVeldVan({ ...r, toegang: { uitHandler: 'object: handlerVeld' } }, contracten), 'handlerVeld');
});

test('bestaande bewaker- en lusafleiding blijven werken zonder verzonnen veld', () => {
  assert.equal(objectVeldVan({route: 'POST /api/proef', toegang: {bewakers: ['gezinsPoort']}}), 'code');
  assert.equal(objectVeldVan(rij('POST /api/rtf/spel/zet')), 'code');
  assert.ok(!objectVeldVan(rij('POST /api/rtf/spelachtig/zet')));
  assert.ok(!objectVeldVan({}));
});


test('de zeventien voormalige uitzonderingen hebben expliciete bestaande handvelden', () => {
  const velden = {
    '/api/aanmeld/zeg': 'id', '/api/auth/reset': 'token',
    '/api/foundation/gezin/uitnodiging/accepteer': 'uitnodiging',
    '/api/foundation/gezin/uitnodiging/bekijk': 'uitnodiging',
    '/api/foundation/gezin/uitnodiging/intrek': 'code',
    '/api/foundation/gezin/uitnodiging/maak': 'code',
    '/api/foundation/mail/lees': 'code', '/api/foundation/mail/stuur': 'code',
    '/api/foundation/school/personeel/inlog/accepteer': 'inlog',
    '/api/foundation/school/personeel/uitnodiging/accepteer': 'uitnodiging',
    '/api/foundation/school/personeel/uitnodiging/bekijk': 'uitnodiging',
    '/api/foundation/school/school/activeren': 'activatie',
    '/api/rtf/apply/chat': 'code', '/api/rtf/apply/chat/send': 'code',
    '/api/rtf/solliciteer': 'code', '/api/rtf/talent/interesse': 'code',
    '/api/sso/wissel': 'sso'
  };
  for (const [pad, veld] of Object.entries(velden)) {
    assert.equal(objectVeldVan(rij('POST ' + pad)), veld, pad);
    assert.ok(!objectVeldVan(rij('GET ' + pad)), pad + ' heeft geen geleende GET-poort');
  }
});
