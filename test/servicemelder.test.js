/* KOMT EEN ANTWOORD OP EEN SERVICEZAAK BIJ DE MELDER AAN?

   Tot 11 oktober 2026 ging de melding van kern/service/loop.js alleen als push
   naar een LIDaccount. Een zaak (`zaak-<code>`) kreeg daardoor nooit te horen dat
   RTG antwoordde, en een lid zonder pushabonnement had na een herlaadbeurt niets
   in zijn meldingen. Een bericht is pas bezorgd als er een LEZER bestaat
   (MAATSTAF.md par. 7f, kern/ontvanger.js); deze toetsen lezen daarom de bak die
   de melder zelf leest, via zijn eigen route en zijn eigen sessie.

   1. Een lid ziet het antwoord in /api/notifications, met een titel en een tekst
      (de lezer toont `title` en `body`; `titel` en `tekst` gaven een lege regel).
   2. Een zaak ziet het in /api/supplier/notifications.
   3. Een ander lid en een andere zaak zien er niets van.
   4. De bezorger zegt het als het niet lukt, en gooit nooit stil weg.
   Draai: node --test test/servicemelder.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
async function alsZaak(p, code) {
  const r = await p('/api/supplier/roster', { code });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  assert.ok(man, 'geen manager bij ' + code);
  const lg = await p('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, JSON.stringify(lg.body).slice(0, 160));
  return lg.body.token;
}
const lid = async (p, n) => (await p('/api/auth/register', { name: 'Melder ' + n, email: 'melder' + n + '@x.nl',
  phone: '061234' + String(5100 + n), password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' })).body.token;

test('een antwoord van het kantoor landt in de meldingen van het lid en van de zaak', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  try {
    const balie = await kantoorAlsPersoon(srv.base);
    const [a, b] = [await lid(p, 1), await lid(p, 2)];
    const [kiku, ander] = [await alsZaak(p, 'KIKUNOI'), await alsZaak(p, 'SAKURA')];

    // het lid
    const zl = (await p('/api/service/open', { onderwerp: 'bestelling', titel: 'Mijn bestelling kwam niet aan' }, a)).body.zaak;
    assert.ok(zl && zl.id, 'zaak van het lid geopend');
    const rl = await p('/api/office/service/bericht', { id: zl.id, tekst: 'Wat is het bezorgadres?' }, balie);
    assert.equal(rl.status, 200, JSON.stringify(rl.body).slice(0, 200));
    const nA = (await p('/api/notifications', {}, a)).body.notifications || [];
    const mA = nA.find(n => n.zaak === zl.id);
    assert.ok(mA, 'het lid ziet het antwoord in zijn meldingen: ' + JSON.stringify(nA).slice(0, 200));
    assert.match(mA.title, new RegExp(zl.id), 'met een titel die de lezer toont');
    assert.ok(mA.body && mA.body.length > 3, 'en een tekst die de lezer toont');
    assert.ok(!((await p('/api/notifications', {}, b)).body.notifications || []).some(n => n.zaak === zl.id),
      'een ander lid ziet het niet');

    // de zaak
    const zz = (await p('/api/supplier/service/open', { onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }, kiku)).body.zaak;
    assert.ok(zz && zz.id, 'zaak van de leverancier geopend');
    const rz = await p('/api/office/service/bericht', { id: zz.id, tekst: 'We kijken het na.' }, balie);
    assert.equal(rz.status, 200, JSON.stringify(rz.body).slice(0, 200));
    const nK = (await p('/api/supplier/notifications', {}, kiku)).body.notifications || [];
    assert.ok(nK.some(n => n.zaak === zz.id && n.title && n.body), 'de zaak ziet het antwoord: ' + JSON.stringify(nK).slice(0, 200));
    assert.ok(!((await p('/api/supplier/notifications', {}, ander)).body.notifications || []).some(n => n.zaak === zz.id),
      'een andere zaak ziet het niet');
  } finally { await stop(srv); }
});

test('de bezorger zegt het als hij niet kan bezorgen, en verzint geen ontvanger', async () => {
  const gelogd = [];
  const geschreven = [];
  const mp = require('../server/kern/service/melderpost')({
    meldLid: (k, n) => { geschreven.push(['lid', k, n]); return k === 'user-9' ? null : n; },
    notifySupplier: (c, n) => geschreven.push(['zaak', c, n]),
    keyVanCodenaam: async (c) => (c === 'Zilverreiger' ? { key: 'user-7' } : null),
    log: (t) => gelogd.push(t) });

  assert.deepEqual(mp.bezorg('user-3', { titel: 'T', tekst: 'x', zaak: 'Z1' }), { bezorgd: true, weg: 'lid' });
  assert.equal(geschreven[0][2].title, 'T', 'titel wordt title');
  assert.deepEqual(mp.bezorg('zaak-KIKUNOI', { titel: 'T', tekst: 'x' }), { bezorgd: true, weg: 'zaak' });
  assert.equal(geschreven[1][1], 'KIKUNOI');
  // tegengehouden door de rust van het lid is NIET bezorgd
  assert.equal(mp.bezorg('user-9', { titel: 'T' }).bezorgd, false);
  assert.equal(mp.bezorg('', {}).reden, 'geen-melder');
  assert.equal(mp.bezorg('zaak-', {}).reden, 'zaak-zonder-code');
  // een oude codenaam-melder gaat via de gids, en alleen bij een eenduidige treffer
  assert.deepEqual(await mp.bezorg('Zilverreiger', { titel: 'T' }), { bezorgd: true, weg: 'lid' });
  assert.equal(geschreven.at(-1)[1], 'user-7');
  assert.equal((await mp.bezorg('Onbekend', { titel: 'T' })).reden, 'codenaam-niet-eenduidig');
  assert.ok(gelogd.length >= 4, 'elke mislukte bezorging is gezegd: ' + gelogd.join(' | '));
});
