/* Echte Redis-proef voor de levende contactcode. Deze staat in de verplichte
   infrastructuurronde: twee afzonderlijke kerninstanties delen uitsluitend
   Redis en het productiegeheim. Geen lokale Map mag de proef groen maken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const maakSociaal = require('../server/kern/sociaal');

function instantie(db, geheim) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contact-live-'));
  const dyncode = require('../server/kern/dyncode')({ crypto, dataDir: dir,
    sharedSecret: geheim });
  const rtf = { profielInfoVanHandle() { return null; }, socialProfielen() { return []; } };
  const sociaal = maakSociaal({ db, save() {}, sseToCustomer() {}, rtf, crypto,
    gidsHaal: h => ({ codename: 'Lid ' + h, tier: 'rtg' }),
    gidsHaalWacht: async h => ({ codename: 'Lid ' + h, tier: 'rtg' }),
    gidsZoekCodenaam: async () => [], media: {}, dyncodeGeef: () => dyncode });
  return { sociaal, dir };
}

test('levende contactcode roteert en claimt atomair over twee Redis-instanties',
  { skip: !process.env.REDIS_URL }, async () => {
  const oud = process.env.RTG_SECRET_KEY;
  const geheim = crypto.randomBytes(32).toString('hex');
  process.env.RTG_SECRET_KEY = geheim;
  const db = { data: { connections: [], blocks: [], reports: [], memberChats: {}, contactPins: {} } };
  const a = instantie(db, geheim), b = instantie(db, geheim);
  const uitgever = 'uitgever-' + crypto.randomBytes(8).toString('hex');
  const kijkerB = 'kijker-b-' + crypto.randomBytes(8).toString('hex');
  const kijkerC = 'kijker-c-' + crypto.randomBytes(8).toString('hex');
  try {
    const oudCode = await a.sociaal.liveMaak(uitgever);
    const vers = await a.sociaal.liveMaak(uitgever);
    assert.equal((await b.sociaal.liveKijk(kijkerB, oudCode.token)).status, 404,
      'rotatie is meteen zichtbaar op de andere instance');
    const kaartB = await b.sociaal.liveKijk(kijkerB, vers.token);
    const kaartC = await a.sociaal.liveKijk(kijkerC, vers.token);
    assert.equal(kaartB.codename, 'Lid ' + uitgever);

    const ref = Buffer.from(vers.token.split('.')[1], 'base64url')
      .toString('utf8').split('|')[1];
    const redis = require('../server/redis').createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    try {
      const scan = await redis.scan('0', 'rtg:pin:live:*', 1000);
      const waarden = await Promise.all((scan[1] || []).map(k => redis.get(k)));
      assert.equal((scan[1] || []).some(k => String(k).includes(ref)), false,
        'de rauwe verwijzing staat niet in een Redis-sleutel');
      assert.equal(waarden.some(v => String(v || '').includes(ref)), false,
        'de rauwe verwijzing staat niet in een Redis-record');
    } finally { await redis.quit(); }

    const uit = await Promise.all([
      b.sociaal.liveVerbind(kijkerB, vers.token, kaartB.bevestiging),
      a.sociaal.liveVerbind(kijkerC, vers.token, kaartC.bevestiging)
    ]);
    assert.equal(uit.filter(x => x && x.status === 200).length, 1,
      'GET+DEL kent over processen precies een winnaar');
    assert.equal(db.data.connections.length, 1);
    assert.equal((await a.sociaal.liveKijk(kijkerB, vers.token)).status, 404,
      'na de claim is de code op iedere instance nutteloos');
  } finally {
    try { await a.sociaal.liveTrekIn(uitgever); } catch (e) {}
    await Promise.all([a.sociaal.liveSluit(), b.sociaal.liveSluit()]);
    try { fs.rmSync(a.dir, { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(b.dir, { recursive: true, force: true }); } catch (e) {}
    if (oud == null) delete process.env.RTG_SECRET_KEY; else process.env.RTG_SECRET_KEY = oud;
  }
});
