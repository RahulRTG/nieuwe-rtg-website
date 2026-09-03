/* SPRAAK NAAR TEKST -- lokaal, of helemaal niet.

   Dit is de helft die ontbrak onder de meeleesbaan. TOEGANKELIJK.md en regel 48
   van scripts/check.js telden tien live vormen zonder weg naar tekst; meelezen
   verplaatste dat naar "kan meedoen als de anderen meetypen", en deze laag maakt
   de tekst vanzelf.

   Wat hier wordt vastgelegd is vooral wat er NIET gebeurt:

   1. GEEN UITWIJK NAAR BUITEN. kern/ai.js heeft een uitwijkketen omdat een
      tekstantwoord bij de derde aanbieder net zo goed is. Geluid is dat niet:
      dat is de stem van een lid. Zonder lokaal model is het antwoord "kan hier
      niet", en nooit een andere aanbieder.
   2. EEN TEKSTMODEL WORDT NIET STILZWIJGEND VOOR GELUID GEBRUIKT. Een aparte
      LOCAL_AI_MODEL_SPRAAK, om dezelfde reden als de andere drie in local-ai.js.
   3. DE NETWERKGRENS IS DIE VAN local-ai.js EN GEEN TWEEDE. Een publieke host is
      geen lokale modelserver, hoe je hem ook noemt.
   4. Een fragment is een paar seconden en geen opname -- een lange opname is
      trouwens ook geen LIVE ondertiteling meer.
   5. De route zegt of het kan, en waarom niet. Een ondertitelknop die niets doet
      is erger dan geen knop: die laat iemand aan een gesprek beginnen in de
      veronderstelling dat hij het kan volgen.
   Draai: node --test test/spraaktekst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const laag = require('../server/kern/spraaktekst');

const LOKAAL = { LOCAL_AI_URL: 'http://127.0.0.1:8080', LOCAL_AI_MODEL_SPRAAK: 'whisper-nl' };

test('zonder lokale modelserver bestaat deze voorziening niet, met de reden erbij', async () => {
  const st = laag.beschikbaar({});
  assert.equal(st.beschikbaar, false);
  assert.match(st.reden, /lokaal/i, 'de reden legt niet uit dat het lokaal moet');

  /* En hij wijkt NIET uit: geen andere aanbieder, geen stille leegte. */
  const r = await laag.transcribeer(Buffer.from('x'.repeat(2000)), { env: {} });
  assert.equal(r.ingericht, false, JSON.stringify(r));
  assert.equal(r.status, 503);
  assert.ok(!r.ok);
});

test('een tekstmodel wordt niet stilzwijgend voor geluid gebruikt', () => {
  const st = laag.beschikbaar({ LOCAL_AI_URL: 'http://127.0.0.1:8080', LOCAL_AI_MODEL: 'een-tekstmodel' });
  assert.equal(st.beschikbaar, false, 'het tekstmodel werd voor spraak aangezien');
  assert.match(st.reden, /LOCAL_AI_MODEL_SPRAAK/);
});

test('de netwerkgrens is die van local-ai.js: een publieke host telt niet als lokaal', () => {
  const st = laag.beschikbaar({ LOCAL_AI_URL: 'https://spraak.example.com', LOCAL_AI_MODEL_SPRAAK: 'whisper' });
  assert.equal(st.beschikbaar, false, 'een publieke host kwam door als lokale modelserver');
  assert.match(st.reden, /netwerkgrens/i);

  /* Het eigen netwerk mag alleen met de vlag die daarvoor bestaat -- dezelfde
     vlag als in local-ai.js, en niet een tweede met een andere naam. */
  const zonder = laag.beschikbaar({ LOCAL_AI_URL: 'http://192.168.1.9:8080', LOCAL_AI_MODEL_SPRAAK: 'whisper' });
  assert.equal(zonder.beschikbaar, false);
  const met = laag.beschikbaar({ LOCAL_AI_URL: 'http://192.168.1.9:8080', LOCAL_AI_MODEL_SPRAAK: 'whisper',
    LOCAL_AI_LAN_TOESTAAN: '1' });
  assert.equal(met.beschikbaar, true, JSON.stringify(met));
});

test('een fragment is een paar seconden, geen opname', async () => {
  const groot = Buffer.alloc(laag.MAX_BYTES + 1);
  const r = await laag.transcribeer(groot, { env: LOKAAL });
  assert.equal(r.status, 413, JSON.stringify(r).slice(0, 200));
  assert.match(r.error, /live/i, 'de weigering legt niet uit waarom een opname iets anders is');
});

test('met een lokaal model gaat het geluid naar de eigen server en komt er tekst terug', async () => {
  let gezien = null;
  const nep = async (url, opties) => {
    gezien = { url: url, methode: opties.methode || opties.method };
    return { ok: true, status: 200, text: async () => 'Ik kom niet in mijn account.' };
  };
  const r = await laag.transcribeer(Buffer.from('geluidbytes'), { env: LOKAAL, fetchImpl: nep });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.tekst, 'Ik kom niet in mijn account.');

  /* NAAR DE EIGEN SERVER, en naar het pad dat een OpenAI-compatibele
     transcriptie-server draagt. Niet naar een andere host, hoe dan ook. */
  assert.ok(gezien.url.startsWith('http://127.0.0.1:8080/'), gezien.url);
  assert.match(gezien.url, /\/v1\/audio\/transcriptions$/);
});

test('een JSON-antwoord van een server die geen platte tekst geeft, wordt gewoon gelezen', async () => {
  const nep = async () => ({ ok: true, status: 200, text: async () => '{"text":"hallo daar"}' });
  const r = await laag.transcribeer(Buffer.from('x'), { env: LOKAAL, fetchImpl: nep });
  assert.equal(r.tekst, 'hallo daar');
});

test('een stukke modelserver levert een fout en geen lege regel', async () => {
  const stuk = async () => { throw new Error('connection refused'); };
  const r = await laag.transcribeer(Buffer.from('x'), { env: LOKAAL, fetchImpl: stuk });
  assert.ok(!r.ok, JSON.stringify(r));
  assert.equal(r.status, 502);
  /* Een lege string zou op stilte lijken terwijl er iets misging, en dan zoekt
     iemand naar woorden die nooit komen. */
  assert.equal(r.tekst, undefined);
});

/* DE HELE KETEN OVER DE ECHTE ROUTE, met een neplokaal model.

   De toetsen hierboven staan op moduleniveau. Deze doet het over de deur die een
   scherm werkelijk gebruikt, en beproeft de bewering die het mutatiecontract
   doet: er wordt NIETS bewaard. Dat is niet af te leiden uit lezen -- een route
   die geluid aanneemt is precies het soort route waar iemand "even" een kopie
   wegschrijft.

   Het nepmodel is een gewone HTTP-server op loopback. Dat is geen truc om de
   netwerkgrens te omzeilen: loopback is exact waar een lokaal model hoort te
   draaien, en de grens uit local-ai.js laat hem daarom door. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { startServer, stop, postJson } = require('./helper');

test('over de echte route: geluid erin, tekst eruit, en niets bewaard', async () => {
  let gezien = 0;
  const model = http.createServer((req, res) => {
    gezien++;
    /* Een OpenAI-compatibele transcriptieserver antwoordt op dit pad. Zou de
       laag ergens anders heen sturen, dan komt hier niets binnen en zakt deze
       toets -- dat is de bedoeling. */
    if (!/\/v1\/audio\/transcriptions$/.test(req.url)) { res.writeHead(404); res.end(); return; }
    req.resume();
    req.on('end', () => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('mijn boeking is niet doorgekomen'); });
  });
  await new Promise(r => model.listen(0, '127.0.0.1', r));
  const poort = model.address().port;

  const srv = await startServer({ env: { SMTP_URL: '',
    LOCAL_AI_URL: 'http://127.0.0.1:' + poort, LOCAL_AI_MODEL_SPRAAK: 'nep-whisper' } });
  try {
    const post = postJson(srv.base);
    const reg = await post('/api/auth/register', { name: 'Ondertitel Proef', email: 'ondertitel@x.nl',
      phone: '0612345698', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, JSON.stringify(reg).slice(0, 200));

    const stand = await post('/api/ondertiteling/stand', {}, reg.token);
    assert.equal(stand.beschikbaar, true, JSON.stringify(stand));
    /* Wat het scherm de gebruiker vertelt, is niet "het verlaat uw toestel niet"
       -- dat zou onwaar zijn. De zin hoort te zeggen waar het geluid WEL heen
       gaat en wat er niet mee gebeurt. */
    assert.match(stand.let, /lokaal model/i);
    assert.match(stand.let, /niet bewaard/i);

    const voor = kijkjeInDeOpslag(srv);
    const r = await fetch(srv.base + '/api/ondertiteling/fragment', { method: 'POST',
      headers: { 'Content-Type': 'audio/webm', Authorization: 'Bearer ' + reg.token },
      body: Buffer.from('nepgeluidbytes-nepgeluidbytes') });
    const uit = await r.json();
    assert.equal(uit.ok, true, JSON.stringify(uit).slice(0, 200));
    assert.equal(uit.tekst, 'mijn boeking is niet doorgekomen');
    assert.equal(gezien, 1, 'de laag sprak het lokale model niet aan, of te vaak');

    await new Promise(x => setTimeout(x, 400));
    assert.equal(kijkjeInDeOpslag(srv), voor,
      'er is iets bewaard van een geluidsfragment; het contract zegt dat dat niet gebeurt');
  } finally {
    await stop(srv);
    await new Promise(r => model.close(r));
  }
});

/* De opslag als een tekenreeks. Grof met opzet: elke schrijfactie in db.json
   verandert hem, en dat is precies wat hier NIET mag gebeuren. */
function kijkjeInDeOpslag(srv) {
  const map = srv.dataDir || path.join(__dirname, '..', 'server', 'data');
  try { return fs.readFileSync(path.join(map, 'db.json'), 'utf8').length + ':' +
    fs.readdirSync(map).sort().join(','); } catch (e) { return 'onleesbaar'; }
}
