/* DE HOOFDZEKERING -- in onderhoud komt alleen de eigenaar erbij, ook via een stroomticket.

   server/middleware/remmen.js (hoofdzekering) zet bij een gesprongen onder-
   houdszekering elke API op 503, behalve techniek/health/ready en de eigenaar.
   Een EventSource van de eigenaar stuurt geen kop maar een `?ticket=`; de
   zekering KIJKT naar dat ticket en stelt dezelfde vraag aan de sessie erin.

   Wat hier niet mag sneuvelen:
   1. Een token dat niet verifieert of van een ander is: 503, ook als het
      eigenaar-oordeel zelf gooit.
   2. Een ticket zonder token, van een ander, of een kijk die faalt: 503.
      Zonder stroomdienst (de standaard buiten een draaiende server) ook 503.
   3. Het ticket van de eigenaar laat hem erbij; pagina's buiten /api/ blijven
      bereikbaar zodat het onderhoudsscherm zelf laadt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - remmen.js: `if (uit && isBaas(geverifieerd(uit.token))) return next();` -> `if (uit) return next();` -> toets 2 zakt.
   - remmen.js isBaas(): `catch (e) { return false; }` -> `return true` -> toets 1 zakt.

   Draai los: node --test test/hoofdzekering-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hoofdzekering } = require('../server/middleware/remmen');

const db = { data: { techniek: { zekeringen: { onderhoud: { aan: false, reden: 'proef' } } } } };
const accounts = { verifyToken: (t) => { if (t === 'baas' || t === 'lid' || t === 'raar') return { id: t }; throw new Error('ongeldig'); } };
const eigenaar = { isEigenaar: (acc, u) => { if (u.id === 'raar') throw new Error('register weg'); return u.id === 'baas'; } };

function roep(mw, { pad = '/api/member/x', kop = '', ticket }) {
  return new Promise((klaar) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; klaar(this); return this; } };
    mw({ path: pad, get: () => kop, query: ticket === undefined ? {} : { ticket } }, res, () => { res.door = true; klaar(res); });
  });
}

test('1. een vreemd, ongeldig of onbeoordeelbaar token komt er niet in', async () => {
  const mw = hoofdzekering({ db, accounts, eigenaar, stroom: () => null });
  for (const kop of ['', 'Bearer kapot', 'Bearer lid', 'Bearer raar']) {
    const r = await roep(mw, { kop });
    assert.equal(r.code, 503, kop);
    assert.match(r.body.error, /onderhoud/);
  }
  assert.equal((await roep(mw, { kop: 'bearer baas' })).door, true, 'de eigenaar blijft erbij');
  for (const pad of ['/api/techniek/zekering', '/api/health', '/apps/app.html']) {
    assert.equal((await roep(mw, { pad })).door, true, pad);
  }
});

test('2. een ticket zonder token, van een ander of met een falende kijk: dicht', async () => {
  const tickets = { t1: { token: null }, t2: { token: 'lid' }, t3: { token: 'kapot' }, t4: { token: 'baas' } };
  const dienst = { kijk: (t) => (t === 'faal' ? Promise.reject(new Error('weg')) : tickets[t] || null) };
  const mw = hoofdzekering({ db, accounts, eigenaar, stroom: () => dienst });
  for (const ticket of ['t1', 't2', 't3', 'faal', 'onbekend']) {
    assert.equal((await roep(mw, { pad: '/api/stream', ticket })).code, 503, ticket);
  }
  assert.equal((await roep(mw, { pad: '/api/stream', ticket: 't4' })).door, true, 'het ticket van de eigenaar opent');
  assert.equal((await roep(hoofdzekering({ db, accounts, eigenaar, stroom: () => ({}) }), { pad: '/api/stream', ticket: 't4' })).code, 503,
    'een dienst zonder kijk is geen dienst');
  const standaard = hoofdzekering({ db, accounts, eigenaar });
  assert.equal((await roep(standaard, { pad: '/api/stream', ticket: 't4' })).code, 503, 'zonder draaiende stroomdienst geen uitzondering');
});

test('3. met de stroom erop doet de zekering niets', async () => {
  const aan = { data: { techniek: { zekeringen: { onderhoud: { aan: true } } } } };
  assert.equal((await roep(hoofdzekering({ db: aan, accounts, eigenaar }), {})).door, true);
  assert.equal((await roep(hoofdzekering({ db: { data: {} }, accounts, eigenaar }), {})).door, true);
});
