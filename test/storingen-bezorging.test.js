'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const web = require('../server/web');
const protocol = require('../server/storingen/protocol');
const { openOpslag } = require('../server/storingen/opslag');
const hangOp = require('../server/opzet/storingenwebhook');
const { maakFoutmelder } = require('../server/foutmelder');
const sleutel = crypto.randomBytes(32).toString('hex');
async function luister(app) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: 'http://127.0.0.1:' + server.address().port + protocol.PAD };
}
const sluit = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
test('afzender naar echte ontvanger: verloren antwoord, retry, opslagfout en log zonder kringloop', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bezorging-'));
  const opslag = openOpslag(map), app = web(), regels = [];
  let kwijt = true, fout = false;
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = data => {
      if (kwijt && data.opgeslagen) { kwijt = false; req.socket.destroy(); return; }
      return json(data);
    }; next();
  });
  hangOp({ app, express: web, env: { ERR_WEBHOOK_SECRET: sleutel },
    log: { info: (m, v) => regels.push({ m, v }), uitzondering: () => assert.fail('ontvanger mag geen foutmelder oproepen') },
    opslagVan: () => ({ bewaar(...args) { if (fout) throw new Error('schijf stuk'); return opslag.bewaar(...args); } }) });
  const { server, url } = await luister(app);
  try {
    const m = maakFoutmelder({ url, sleutel, intern: true, appUrl: url, timeout: 500 });
    const r = await m.zelfproef('integratietest');
    assert.equal(r.ok, true); assert.equal(r.status, 200, 'eerste antwoord verloren, tweede ziet dezelfde opgeslagen gebeurtenis');
    assert.equal(m.stand().bezorgd, 1); assert.equal(m.stand().geprobeerd, 1);
    assert.equal(regels.filter(r => r.v.uitkomst === 'opgeslagen').length, 1);
    assert.equal(regels.filter(r => r.v.uitkomst === 'herhaald').length, 1);
    assert.equal(m.stand().onafhankelijk, false); assert.match(m.stand().beperking, /hostuitval/);
    assert.ok(!JSON.stringify(regels).includes(sleutel));
    fout = true;
    const mis = await m.zelfproef('opslagstoring');
    assert.equal(mis.ok, false); assert.equal(mis.status, 503);
    assert.equal(m.stand().mislukt, 1); assert.equal(m.stand().bezorgd, 1);
    assert.equal(regels.filter(r => r.v.uitkomst === 'opslag-mislukt').length, 1);
    assert.equal(mis.retryAfter, 60, 'de ontvanger krijgt de gevraagde rust; geen directe retrystorm');
    m.melden(new Error('ontvanger stuk'), { p: protocol.PAD });
    assert.equal(m.stand().geprobeerd, 2, 'ontvangstfouten worden niet opnieuw naar zichzelf gestuurd');
  } finally { await sluit(server); opslag.close(); fs.rmSync(map, { recursive: true, force: true }); }
});
test('een willekeurige HTTP 200 is geen opslagbewijs en time-outs worden eenmaal geteld', async () => {
  let hang = false;
  const { server, url } = await luister((req, res) => { req.resume(); if (!hang) res.end('{}'); });
  try {
    const m = maakFoutmelder({ url, sleutel, intern: true, timeout: 40 });
    assert.equal((await m.zelfproef()).ok, false);
    assert.match(m.stand().laatsteFout, /opslagbewijs/);
    hang = true;
    const start = Date.now();
    assert.equal((await m.zelfproef()).ok, false);
    assert.ok(Date.now() - start < 2500);
    assert.equal(m.stand().bezorgd, 0); assert.equal(m.stand().mislukt, 2);
  } finally { await sluit(server); }
});
test('gedeelde ontvangstlimiet en volle opslag geven geen vals ontvangstbewijs', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-storing-rem-'));
  const a = openOpslag(map, { limiet: 2, max: 1 }), b = openOpslag(map, { limiet: 2, max: 1 });
  try {
    const raw = Buffer.from('{}'), nu = Date.now();
    assert.equal(a.bewaar('eerste', raw, {}, nu).status, 201);
    assert.equal(b.bewaar('tweede', raw, {}, nu).status, 503);
    assert.equal(b.bewaar('eerste', raw, {}, nu).status, 200);
    assert.equal(a.bewaar('eerste', raw, {}, nu).status, 429);
  } finally { a.close(); b.close(); fs.rmSync(map, { recursive: true, force: true }); }
});

/* EEN GEWONE WEBHOOK LEVERT GEEN BEWIJS, DUS ZIJN ANTWOORD DOET NIET MEE.

   De grens van 4 KB op het antwoordlichaam stond buiten de ondertekende tak en
   gold daardoor ook voor een gewone collector (Slack, Discord, een eigen bak).
   Een 200 met een groter antwoord -- een pagina, een echo van de melding -- werd
   geboekt als MISLUKT met "Ontvangstbewijs te groot.", en de zelfproef op het
   techniekbord meldde een werkende alarmweg als kapot. Alleen de ONDERTEKENDE
   weg leest het antwoord; daar blijft de grens staan. */
test('een 2xx van een ongetekende webhook telt, ook met een groot antwoordlichaam', async () => {
  const groot = 'x'.repeat(5000);
  const gezien = [];
  const srv = http.createServer((req, res) => {
    const b = []; req.on('data', c => b.push(c));
    req.on('end', () => { gezien.push(Buffer.concat(b).length); res.writeHead(200, { 'content-type': 'text/html' }); res.end(groot); });
  });
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + srv.address().port + '/collector';
  try {
    const m = maakFoutmelder({ url, intern: true, appUrl: 'https://ergens-anders.test', timeout: 2000,
      log: { warn: () => {} } });
    assert.strictEqual(m.stand().onafhankelijk, true, 'deze collector staat buiten de app; anders meet de toets iets anders');
    const r = await m.zelfproef('grote-echo');
    assert.strictEqual(r.ok, true, 'een 200 is een geslaagde bezorging, wat de ontvanger verder ook terugpraat');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(m.stand().bezorgd, 1);
    assert.strictEqual(m.stand().mislukt, 0, 'en hij telt niet als mislukt');
    assert.strictEqual(m.stand().laatsteFout, null, 'er hoort geen "Ontvangstbewijs te groot." op het bord te staan');
    assert.strictEqual(gezien.length, 1, 'een ongetekende bezorging wordt niet herhaald');
  } finally { srv.closeAllConnections(); await new Promise(resolve => srv.close(resolve)); }
});

/* De ondertekende weg houdt zijn grens WEL: daar gaat het antwoord door
   JSON.parse, en een onbegrensd lichaam is daar een echte last. */
test('de ondertekende weg weigert nog steeds een te groot ontvangstbewijs', async () => {
  const srv = http.createServer((req, res) => {
    const b = []; req.on('data', c => b.push(c));
    req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"vul":"' + 'y'.repeat(6000) + '"}'); });
  });
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + srv.address().port + protocol.PAD;
  try {
    const m = maakFoutmelder({ url, sleutel, intern: true, appUrl: 'https://ergens-anders.test', timeout: 2000,
      log: { warn: () => {} } });
    const r = await m.zelfproef('te-groot-bewijs');
    assert.strictEqual(r.ok, false, 'een onbegrensd "bewijs" hoort niet door JSON.parse te gaan');
    assert.match(String(r.reden), /te groot/i);
  } finally { srv.closeAllConnections(); await new Promise(resolve => srv.close(resolve)); }
});
