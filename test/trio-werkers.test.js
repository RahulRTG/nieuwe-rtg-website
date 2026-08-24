/* MEER VOORDEURPROCESSEN (server/trio-werkers.js, server/trio-schaduw.js).

   De poortwachter was gemeten het plafond: 90% van EEN kern terwijl de drie
   servers op ongeveer de helft stonden. Met RTG_POORTWACHTERS=N splitst de
   voordeur in een HOOFD die alleen bewaakt en N WERKERS die alleen doorsturen.

   ER ZIJN NU TWEE PLEKKEN DIE DEZELFDE KEUZE MAKEN, en dat is het gevaar van
   deze hele opzet: trio-spreiding.js kiest in de hoofdstand, trio-schaduw.js in
   een werker. Lopen die ooit uit elkaar, dan krijgt een lid een ander proces
   afhankelijk van welke voordeur zijn verbinding ving -- en dat is precies de
   bug die de kleefroutering moest wegnemen, alleen dan onvindbaar. Toets 5
   vergelijkt ze daarom over een paar honderd standen, en niet op een voorbeeld.

   Draai los: node --test test/trio-werkers.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { koppelWerkers, staatVan } = require('../server/trio-werkers.js');
const { maakSchaduw } = require('../server/trio-schaduw.js');
const { maakSpreiding } = require('../server/trio-spreiding.js');

const metKop = t => ({ headers: { authorization: 'Bearer ' + t }, url: '/api/notities/mijn' });

function nepWacht(servers, actief, spreiding) {
  return {
    actieve: () => actief,
    spreiding: { aan: () => spreiding },
    kiesActieve: () => {}
  };
}
function serverlijst(rollen) {
  return rollen.map((rol, i) => ({ nr: i + 1, port: 3001 + i, child: rol === null ? null : {},
    healthy: rol !== null, healthySince: 1, rol: rol === null ? 'uit' : rol }));
}
function metOmgeving(vlaggen, fn) {
  const sleutels = ['RTG_POORTWACHTERS', 'RTG_SPREIDING', 'REDIS_URL'];
  const oud = {}; for (const k of sleutels) oud[k] = process.env[k];
  for (const [k, v] of Object.entries(vlaggen)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); }
  finally { for (const k of sleutels) { if (oud[k] == null) delete process.env[k]; else process.env[k] = oud[k]; } }
}

/* ---------- de opbouw ---------- */

test('1. zonder RTG_POORTWACHTERS komt er geen enkel voordeurproces', () => {
  const servers = serverlijst(['leider', 'volger', 'volger']);
  for (const waarde of [null, '0', '', 'nee', '-3']) {
    const r = metOmgeving({ RTG_POORTWACHTERS: waarde }, () =>
      koppelWerkers({ WERKER: false, wacht: nepWacht(servers, 0, true), servers, log: () => {}, LOKAAL_TLS: false }));
    assert.equal(r.werkers, null, 'geen werkers bij RTG_POORTWACHTERS=' + JSON.stringify(waarde));
    assert.equal(r.VOORDEUREN, 0);
  }
});

test('2. een WERKER start er zelf nooit nog een -- anders vermenigvuldigt de voordeur zich', () => {
  const servers = serverlijst(['leider', 'volger', 'volger']);
  const r = metOmgeving({ RTG_POORTWACHTERS: '3' }, () =>
    koppelWerkers({ WERKER: true, wacht: nepWacht(servers, 0, true), servers, log: () => {}, LOKAAL_TLS: false }));
  assert.equal(r.VOORDEUREN, 0);
  assert.equal(r.werkers, null);
});

test('3. met lokale TLS worden er GEEN voordeuren gestart', () => {
  /* Elk proces geeft bij het starten zijn eigen certificaat uit. Drie voordeuren
     zouden een telefoon per verbinding een ander certificaat van dezelfde site
     laten zien. Dat weigeren we, en trio.js zegt bij het starten waarom. */
  const servers = serverlijst(['leider', 'volger', 'volger']);
  const r = metOmgeving({ RTG_POORTWACHTERS: '3' }, () =>
    koppelWerkers({ WERKER: false, wacht: nepWacht(servers, 0, true), servers, log: () => {}, LOKAAL_TLS: true }));
  assert.equal(r.werkers, null, 'geen werkers');
  assert.equal(r.VOORDEUREN, 3, 'maar de vraag is wel bewaard, zodat trio.js hem kan melden');
});

test('4. anders komen er precies zoveel voordeuren als gevraagd, met een plafond', () => {
  const servers = serverlijst(['leider', 'volger', 'volger']);
  const bouw = (n) => metOmgeving({ RTG_POORTWACHTERS: n }, () =>
    koppelWerkers({ WERKER: false, wacht: nepWacht(servers, 0, true), servers, log: () => {}, LOKAAL_TLS: false }));
  const r = bouw('4');
  assert.equal(r.VOORDEUREN, 4);
  assert.ok(r.werkers && typeof r.werkers.startAlle === 'function');
  assert.equal(r.werkers.aantal, 4);
  r.werkers.stop();   // er is er nog geen gestart; dit hoort niet te klagen

  assert.equal(bouw('2.7').VOORDEUREN, 2, 'een gebroken getal wordt naar beneden afgerond');
  /* Het plafond is er tegen een typefout. Een nul te veel mag geen duizend
     processen forken op een machine met vier kernen. */
  const veel = bouw('1000');
  assert.equal(veel.VOORDEUREN, 64, 'meer dan het plafond wordt het plafond');
  veel.werkers.stop();
});

/* ---------- de schaduw ---------- */

/* Elke schaduw hangt een luisteraar aan `process`. In een echt proces is er er
   precies een; hier maken we er tientallen, dus ruimen we ze op. Zonder dit
   waarschuwt Node over een lek -- en die waarschuwing zou dan terecht zijn. */
const opgeruimd = [];
test.after(() => { for (const s of opgeruimd) try { s.stop(); } catch (e) {} });
function nieuweSchaduw() {
  const s = maakSchaduw({ log: () => {} });
  opgeruimd.push(s);
  return s;
}
const zendStand = (servers, actief, spreiding) =>
  process.emit('message', { soort: 'staat', staat: staatVan({ servers, actief, spreiding }) });
function schaduwMet(servers, actief, spreiding) {
  const s = nieuweSchaduw();
  zendStand(servers, actief, spreiding);
  return s;
}

test('5. de werker maakt EXACT dezelfde keuze als de hoofd', async () => {
  /* Twee implementaties van een regel is een belofte die niemand nakomt tenzij
     hij gemeten wordt. Hier gaat elke stand door allebei. */
  const standen = [
    ['leider', 'volger', 'volger'],
    ['leider', 'volger', null],
    ['leider', null, 'volger'],
    ['leider', null, null],
    ['leider', 'uit', 'volger'],
    ['leider', 'uit', 'uit']
  ];
  const oud = { s: process.env.RTG_SPREIDING, r: process.env.REDIS_URL };
  process.env.RTG_SPREIDING = '1';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  try {
    let vergeleken = 0;
    for (const rollen of standen) {
      const servers = serverlijst(rollen);
      const hoofd = maakSpreiding({ servers, apiCall: async () => ({ status: 200 }), log: () => {} });
      const schaduw = schaduwMet(servers, 0, true);
      for (let i = 0; i < 60; i++) {
        const req = metKop('lid-' + i + '-abcdefgh');
        assert.equal(schaduw.kleefDoel(req, 0), hoofd.kleefDoel(req, 0),
          'zelfde keuze bij ' + JSON.stringify(rollen) + ' voor lid ' + i);
        vergeleken++;
      }
      // en een verzoek zonder token blijft in beide gevallen bij de terugval
      const kaal = { headers: {}, url: '/apps/app.html' };
      assert.equal(schaduw.kleefDoel(kaal, 0), hoofd.kleefDoel(kaal, 0));
      schaduw.stop();   // meteen, niet pas aan het eind: anders staan er zes tegelijk te luisteren
    }
    assert.ok(vergeleken >= 360, 'genoeg standen vergeleken: ' + vergeleken);
  } finally {
    if (oud.s == null) delete process.env.RTG_SPREIDING; else process.env.RTG_SPREIDING = oud.s;
    if (oud.r == null) delete process.env.REDIS_URL; else process.env.REDIS_URL = oud.r;
  }
});

test('6. de serverlijst wordt BIJGEWERKT en niet vervangen', () => {
  /* trio.js pakt `const { servers } = wacht` een keer bij het laden en zet op het
     foutpad rechtstreeks servers[i].healthy = false. Kwam er bij elke stand een
     nieuwe array, dan zou die van trio.js voor altijd naar de lege beginlijst
     wijzen -- en dan geeft ELK verzoek een 503 omdat er in zijn ogen geen server
     bestaat. Dat stond er eerst; vandaar deze toets. */
  const schaduw = nieuweSchaduw();
  const lijst = schaduw.servers;
  assert.equal(lijst.length, 0, 'begint leeg');
  zendStand(serverlijst(['leider', 'volger', 'volger']), 0, true);
  assert.equal(schaduw.servers, lijst, 'nog steeds dezelfde array');
  assert.equal(lijst.length, 3, 'en hij is gevuld');
  zendStand(serverlijst(['leider', null, null]), 0, true);
  assert.equal(schaduw.servers, lijst, 'ook na een tweede stand');
  assert.equal(lijst.filter(s => s.healthy).length, 1, 'en de stand is bijgewerkt');
});

test('7. een werker zet nooit een rol -- hij meldt en gaat verder', async () => {
  /* Twee processen die allebei mogen promoveren, doen dat ooit tegelijk, en dan
     zijn er twee leiders: twee servers die de backup maken en de
     zelfzorgautomaat draaien. */
  const schaduw = schaduwMet(serverlijst(['leider', 'volger', 'volger']), 0, true);
  schaduw.servers[1].healthy = false;   // trio.js doet dit op het foutpad
  const verstuurd = [];
  const echt = process.send;
  process.send = (m) => { verstuurd.push(m); return true; };
  try { await schaduw.kiesActieve('server 2 liet een verzoek vallen'); }
  finally { if (echt) process.send = echt; else delete process.send; }
  assert.equal(verstuurd.length, 1, 'precies een melding aan de hoofd');
  assert.equal(verstuurd[0].soort, 'gevallen');
  assert.equal(verstuurd[0].idx, 1, 'en hij zegt welke');
  assert.match(verstuurd[0].reden, /liet een verzoek vallen/);
  assert.deepEqual(schaduw.servers.map(s => s.rol), ['leider', 'volger', 'volger'],
    'de rollen zijn NIET door de werker aangeraakt');
});

test('8. wachtOpActieve wacht op de eerste stand, en geeft op als die niet komt', async () => {
  const leeg = nieuweSchaduw();
  const t0 = Date.now();
  assert.equal(await leeg.wachtOpActieve(120), -1, 'zonder stand geen leider');
  assert.ok(Date.now() - t0 >= 100, 'en hij heeft echt gewacht');

  const schaduw = nieuweSchaduw();
  const belofte = schaduw.wachtOpActieve(3000);
  zendStand(serverlijst(['leider', 'volger', 'volger']), 0, true);
  assert.equal(await belofte, 0, 'zodra de stand er is, gaat het verzoek door');
  assert.equal(await schaduw.wachtOpActieve(3000), 0, 'en daarna meteen');
});

test('9. een onzinnige of kapotte stand laat de werker met rust', () => {
  const schaduw = schaduwMet(serverlijst(['leider', 'volger', 'volger']), 0, true);
  const voor = schaduw.servers.map(s => s.rol).join(',');
  for (const m of [null, {}, { soort: 'iets' }, { soort: 'staat' }, { soort: 'staat', staat: '{kapot' }]) {
    process.emit('message', m);
  }
  assert.equal(schaduw.servers.map(s => s.rol).join(','), voor, 'de stand is onveranderd');
  assert.equal(schaduw.actieve(), 0);
});

test('10. een werker stuurt nooit verkeer naar een server die net omviel', async () => {
  /* DIT KWAM UIT DE CHAOSPROEF, niet uit een bedenksel. In de hoofdstand kiest
     kiesActieve() synchroon een nieuwe leider; in een werker is het alleen een
     seintje naar de hoofd. Tussen de klap en de volgende stand wees `actief` dus
     nog naar de omgevallen server, en een verzoek ZONDER token heeft geen
     kleefkeuze om op terug te vallen -- dat kwam op een 503 uit terwijl er twee
     kerngezonde servers naast stonden. Gemeten: 1 mislukt verzoek waar de
     hoofdstand er 0 had. */
  const schaduw = schaduwMet(serverlijst(['leider', 'volger', 'volger']), 0, true);
  assert.equal(schaduw.actieve(), 0, 'normaal is dat gewoon de leider');

  // precies wat server/trio-proxy.js op het foutpad doet
  schaduw.servers[0].healthy = false;
  schaduw.servers[0].rol = 'uit';
  const nu = schaduw.actieve();
  assert.ok(nu === 1 || nu === 2, 'de terugval wijst naar een LEVENDE server, niet naar de omgevallen (' + nu + ')');
  assert.equal(await schaduw.wachtOpActieve(200), nu, 'en een wachtend verzoek krijgt diezelfde');

  // en een verzoek zonder kleefsleutel komt daar dus ook terecht
  const kaal = { headers: {}, url: '/api/health' };
  assert.notEqual(schaduw.kleefDoel(kaal, nu), 0, 'nooit terug naar de omgevallen server');

  // valt ALLES om, dan is -1 het eerlijke antwoord en volgt er een 503
  for (const s of schaduw.servers) s.healthy = false;
  assert.equal(schaduw.actieve(), -1);
  assert.equal(await schaduw.wachtOpActieve(120), -1);
});
