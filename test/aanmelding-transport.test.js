'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
function fixture(header) {
  const db = { data: {}, writable: true }, routes = new Map();
  const accounts = { sleutelVoor: () => Buffer.alloc(32, 1), getUserById: id => ({ id }),
    verifyToken: () => ({ id: 1 }) };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'memory', db, save() {} });
  const motor = require('../server/kern/aanmeldingen')({ db, accounts, bewerkCollectie, save() {}, crypto,
    schoon: (s, n) => String(s ?? '').trim().slice(0, n) }).aanmeldingen;
  require('../server/routes/aanmeldingen')({ app: { post(p, ...fn) { routes.set(p, fn.at(-1)); } },
    aanmeldingen: motor, accounts });
  const lagen = [require('../server/lib/idem-poort')(), require('../server/lib/dubbeltik')
    .maakDubbeltik({ overslaan: req => require('../server/opzet/geldwegen').slaOver(req.path) }).middleware(),
  require('../server/middleware/idempotentie')()];
  const body = { idem: crypto.randomUUID(), pas: 'rtg', naam: 'Amber' };
  async function roep(b = body, pad = '/api/aanmelding/aanvraag') {
    const kop = { authorization: 'Bearer eigen', ...(header ? { 'idempotency-key': body.idem } : {}) };
    const req = { method: 'POST', path: pad, url: pad, ip: 'fixture', body: b, get: n => kop[n.toLowerCase()] };
    const res = new EventEmitter(); res.statusCode = 200;
    res.status = n => { res.statusCode = n; return res; };
    res.set = res.type = () => res;
    return new Promise((resolve, reject) => {
      res.json = data => { res.emit('finish'); resolve({ status: res.statusCode, data }); return res; };
      res.send = data => res.json(typeof data === 'string' ? JSON.parse(data) : data);
      let i = 0;
      function next() {
        try { Promise.resolve(i < lagen.length ? lagen[i++](req, res, next) :
          routes.get(pad)(req, res)).catch(reject); } catch (e) { reject(e); }
      }
      next();
    });
  }
  return { db, accounts, routes, body, roep };
}
for (const header of [false, true]) {
  test('alle transportcaches laten actuele aanvraagkern beslissen; extra header=' + header, async () => {
    const f = fixture(header), a = await f.roep(); assert.equal(a.status, 200);
    assert.deepEqual(await f.roep(), a, 'exact compact bewijs zonder cachemarkering');
    assert.deepEqual(await f.roep({ ...f.body, naam: ' Amber ' }), a, 'domeinnormalisatie blijft gelden');
    assert.equal((await f.roep({ ...f.body, naam: 'Anders' })).status, 409);
    f.accounts.verifyToken = () => null;
    assert.equal((await f.roep()).status, 401, 'zelfde token mag na intrekking geen cacheantwoord krijgen');
    f.accounts.verifyToken = () => ({ id: 1 });
    f.db.data.aanmeldingen = [];
    assert.equal((await f.roep()).status, 410, 'redactie wordt niet overstemd door bewaarde200');
    assert.equal((await f.roep({ ...f.body, naam: 'Anders' })).status, 410);
    assert.equal(f.db.data.aanmeldingen.length, 0);
  });
}
test('naastgelegen route zonder eigen receipt blijft door gewone caches beschermd', async () => {
  const f = fixture(true), pad = '/api/aanmelding/aanvraag-extra'; let teller = 0;
  f.routes.set(pad, (req, res) => res.json({ ok: true, teller: ++teller }));
  assert.equal((await f.roep(f.body, pad)).data.teller, 1);
  assert.equal((await f.roep(f.body, pad)).data.teller, 1);
  assert.equal(teller, 1);
});

// Echte transportlagen; de eindhandler is hier een gecontroleerde autorisatieprobe.
for (const pad of ['/api/member/bureau/zaak/open', '/api/office/bank/rekening/open',
  '/api/werkplek/taak', '/api/labfonds/scheidsrechter', '/api/office/magnaat/scan',
  '/api/rtf/onboarding/teken']) {
  for (const header of [false, true]) test(pad + ' bereikt actuele handler, header=' + header, async () => {
    const f = fixture(header); let bevoegd = true, versie = 1, bezoeken = 0;
    f.routes.set(pad, (req, res) => {
      bezoeken++;
      if (!bevoegd) return res.status(403).json({ error: 'ingetrokken' });
      if (req.body.naam !== 'Amber') return res.status(409).json({ error: 'ander verzoek' });
      return res.json({ ok: true, versie });
    });
    assert.equal((await f.roep(f.body, pad)).data.versie, 1);
    versie = 2;
    assert.equal((await f.roep(f.body, pad)).data.versie, 2);
    assert.equal((await f.roep({ ...f.body, naam: 'anders' }, pad)).status, 409);
    bevoegd = false;
    assert.equal((await f.roep(f.body, pad)).status, 403);
    assert.equal(bezoeken, 4);
    const match = require('../server/lib/ontvangst-operatiepad');
    assert.equal(match(pad.toUpperCase() + '/'), true);
    assert.equal(match(pad + '-extra'), false);
    assert.equal(match(pad + '/extra'), false);
  });
}
