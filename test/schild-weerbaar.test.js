/* HET SCHILD, WEERBAAR (server/kern/schild.js).

   Het schild is de voordeur: een applicatie-WAF op pad, query en user-agent,
   een DDoS-rem per IP, de banlijst, en de poort waar De Wacht zijn quarantaine
   afdwingt. Het levert daarnaast de signalen waar De Wacht op meet. Elders
   wordt alleen `logDoel` en de bedrading geraakt; hier gaat de middleware zelf
   met nagemaakte verzoeken langs elke deur.

   Wat hier niet mag sneuvelen:
   1. elke handtekening (pad-klimmen, null-byte, sondes, XSS, SQLi, een te
      lange URL, een scanner-UA) wordt geweigerd met 403 en komt NIET bij de
      app; een gewoon verzoek wel;
   2. wie vijf keer raak schiet, gaat op de banlijst, en een ban is een
      kritieke melding -- daarvoor zijn het waarschuwingen per treffer;
   3. een bron in quarantaine komt er niet in, ongeacht banlijst of plafond,
      en dat wordt gemeld;
   4. het plafond per tien seconden bant, en een ban dooft na vijftien
      minuten vanzelf; een nieuw venster begint weer bij nul;
   5. localhost (health-checks, de poortwachter) gaat altijd door, maar telt
      wel mee in de verzoekteller -- anders is de meter van De Wacht stil;
   6. het banlog draagt geen ondertekende medialink: een ticket in het pad is
      een sleutel;
   7. zonder melder of logboek valt het schild niet om.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (b.wafTreffers >= 5)` vervangen door `if (b.wafTreffers >= 50)`
     -> "2. vijf WAF-treffers", "7. zonder melder" en "8. de veegbeurt"
     ZAKKEN (RAAK): de vijfde treffer bant niet.
   - `if (quarantaine && quarantaine(ip))` vervangen door `if (false)`
     -> "3. quarantaine gaat voor alles" en "5. localhost" (het verzoek zonder
     ip) ZAKKEN (RAAK).
   - `if (tot > nu) return res.status(403)...` vervangen door `if (false) ...`
     -> "2. vijf WAF-treffers" en "4. het plafond" ZAKKEN (RAAK): de gebande
     bron komt weer binnen.

   Draai: node --test test/schild-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSchild, logDoel, WAF_PATRONEN } = require('../server/kern/schild');

function verzoek(ip, url, ua) {
  return { ip, originalUrl: url, url, get: (h) => (h === 'user-agent' ? ua : undefined) };
}
function antwoord() {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
function opzet(opties) {
  const meldingen = [], log = [];
  const o = opties || {};
  const schild = maakSchild({
    meld: o.zonderMelder ? undefined : (type, ernst, tekst, meta) => meldingen.push({ type, ernst, tekst, meta }),
    logboek: o.zonderMelder ? undefined : { warn: (s, d) => log.push({ s, d }) },
    quarantaine: o.quarantaine
  });
  function stuur(ip, url, ua) {
    const res = antwoord(); let door = false;
    schild.middleware(verzoek(ip, url, ua), res, () => { door = true; });
    return { door, code: res.code, body: res.body };
  }
  return { schild, stuur, meldingen, log };
}
function metKlok(t0) {
  const echt = Date.now;
  let nu = t0;
  Date.now = () => nu;
  return { verder: (ms) => { nu += ms; }, terug: () => { Date.now = echt; } };
}

test('1. elke WAF-handtekening wordt geweigerd en komt niet bij de app; gewoon verkeer wel', () => {
  const gevallen = [
    ['/../../etc/passwd', 'pad-klimmen'], ['/a/%2E%2E/b', 'pad-klimmen'],
    ['/x%00.png', 'null-byte'],
    ['/index.php', 'aanvalsdoel-sonde'], ['/backup.sql?x=1', 'aanvalsdoel-sonde'],
    ['/wp-admin/', 'aanvalsdoel-sonde'], ['/.git/config', 'aanvalsdoel-sonde'],
    ['/zoek?q=<script>alert(1)', 'xss-in-url'],
    ['/zoek?q=1 union select pw', 'sqli-in-url'], ['/x?q=sleep(5)', 'sqli-in-url']
  ];
  gevallen.forEach(([url, reden], i) => {
    const { stuur, meldingen } = opzet();
    const r = stuur('10.0.0.' + i, url, 'Mozilla');
    assert.equal(r.door, false, url + ' mag de app niet bereiken');
    assert.equal(r.code, 403);
    assert.deepEqual(r.body, { error: 'Geblokkeerd.' });
    assert.equal(meldingen[0].type, 'waf');
    assert.equal(meldingen[0].ernst, 'waarschuwing');
    assert.match(meldingen[0].tekst, new RegExp('\\(' + reden + '\\)'), url + ' heet ' + reden);
    assert.equal(meldingen[0].meta.bron, 'waf:10.0.0.' + i);
  });
  assert.equal(WAF_PATRONEN.length, 6);

  const { stuur, meldingen } = opzet();
  const lang = stuur('10.1.0.1', '/a?' + 'x'.repeat(2100), 'Mozilla');
  assert.equal(lang.code, 403);
  assert.match(meldingen[0].tekst, /url-te-lang/);
  const scan = stuur('10.1.0.2', '/gewoon', 'sqlmap/1.7');
  assert.equal(scan.code, 403);
  assert.match(meldingen[1].tekst, /scanner-user-agent/);
  const goed = stuur('10.1.0.3', '/apps/app.html?tab=reizen', 'Mozilla/5.0');
  assert.equal(goed.door, true, 'een gewoon verzoek gaat door');
  assert.equal(goed.code, null);
  assert.equal(meldingen.length, 2, 'een gewoon verzoek meldt niets');
});

test('2. vijf WAF-treffers: vier waarschuwingen en dan een kritieke ban, en daarna is alles dicht', () => {
  const { schild, stuur, meldingen, log } = opzet();
  for (let i = 0; i < 4; i++) stuur('6.6.6.6', '/wp-login.php', 'x');
  assert.equal(meldingen.filter(m => m.type === 'waf').length, 4);
  assert.equal(schild.banlijst.has('6.6.6.6'), false, 'vier treffers is nog geen ban');
  assert.deepEqual(schild.signalen.verdachteBronnen(), [{ bron: '6.6.6.6', treffers: 4 }],
    'de treffers zijn het signaal waarop De Wacht afsnijden voorstelt');
  stuur('6.6.6.6', '/.env', 'x');
  assert.equal(schild.banlijst.has('6.6.6.6'), true, 'de vijfde treffer bant');
  const ban = meldingen.find(m => m.type === 'schild-ban');
  assert.equal(ban.ernst, 'kritiek');
  assert.match(ban.tekst, /herhaalde WAF-treffers: aanvalsdoel-sonde/);
  assert.equal(ban.meta.bron, 'schild:6.6.6.6');
  assert.equal(meldingen.filter(m => m.type === 'waf').length, 4, 'de bannende treffer is een ban, geen vijfde waarschuwing');
  assert.equal(log[0].s, 'schild-ban');
  assert.equal(log[0].d.ip, '6.6.6.6');
  // nu is ook een onschuldig verzoek dicht
  const r = stuur('6.6.6.6', '/', 'Mozilla');
  assert.equal(r.door, false);
  assert.deepEqual(r.body, { error: 'Toegang tijdelijk geblokkeerd.' });
  assert.equal(schild.signalen.bans(), 1);
});

test('3. quarantaine gaat voor alles en wordt gemeld; wie er niet in staat, gaat door', () => {
  const gevraagd = [];
  const { stuur, meldingen } = opzet({ quarantaine: (ip) => { gevraagd.push(ip); return ip === '7.7.7.7'; } });
  const r = stuur('7.7.7.7', '/', 'Mozilla');
  assert.equal(r.door, false);
  assert.equal(r.code, 403);
  assert.deepEqual(r.body, { error: 'Toegang geblokkeerd (quarantaine).' });
  assert.equal(meldingen[0].type, 'quarantaine-geblokkeerd');
  assert.equal(meldingen[0].meta.bron, 'quarantaine:7.7.7.7');
  assert.equal(stuur('8.8.8.8', '/', 'Mozilla').door, true);
  assert.deepEqual(gevraagd, ['7.7.7.7', '8.8.8.8'], 'de quarantaine wordt per verzoek gevraagd');
  // zonder melder: nog steeds dicht
  const stil = opzet({ zonderMelder: true, quarantaine: () => true });
  assert.equal(stil.stuur('7.7.7.7', '/', 'x').code, 403);
});

test('4. het plafond bant, de ban dooft na vijftien minuten, en een nieuw venster begint bij nul', () => {
  const oud = process.env.RTG_SCHILD_PLAFOND;
  process.env.RTG_SCHILD_PLAFOND = '3';
  const klok = metKlok(1e12);
  try {
    const { schild, stuur, meldingen, log } = opzet();
    for (let i = 0; i < 3; i++) assert.equal(stuur('5.5.5.5', '/media/t/GEHEIMTICKET123/foto.jpg', 'x').door, true);
    const vierde = stuur('5.5.5.5', '/media/t/GEHEIMTICKET123/foto.jpg', 'x');
    assert.equal(vierde.door, false, 'boven het plafond: geweigerd');
    assert.deepEqual(vierde.body, { error: 'Toegang tijdelijk geblokkeerd.' });
    assert.match(meldingen[0].tekst, /4 verzoeken in 10 s \(plafond 3\)/);
    assert.equal(log[0].d.pad, '/media/t/:ticket/foto.jpg', 'het banlog draagt het ticket niet');

    klok.verder(15 * 60000 - 1);
    assert.equal(stuur('5.5.5.5', '/', 'x').door, false, 'een milliseconde voor het einde nog dicht');
    klok.verder(2);
    const terug = stuur('5.5.5.5', '/', 'x');
    assert.equal(terug.door, true, 'na vijftien minuten vanzelf weer open, en een nieuw venster');
    assert.equal(schild.banlijst.has('5.5.5.5'), false);
    assert.equal(schild.emmers.get('5.5.5.5').n, 1);

    // binnen het venster telt hij door; na tien seconden weer bij nul
    stuur('4.4.4.4', '/', 'x'); stuur('4.4.4.4', '/', 'x');
    klok.verder(10001);
    stuur('4.4.4.4', '/', 'x');
    assert.equal(schild.emmers.get('4.4.4.4').n, 1, 'een nieuw venster begint weer bij nul');
  } finally {
    klok.terug();
    if (oud === undefined) delete process.env.RTG_SCHILD_PLAFOND; else process.env.RTG_SCHILD_PLAFOND = oud;
  }
});

test('5. localhost gaat altijd door maar telt mee in de verzoekteller', () => {
  const { schild, stuur } = opzet({ quarantaine: () => true });
  for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    const r = stuur(ip, '/../../etc/passwd', 'sqlmap');
    assert.equal(r.door, true, ip + ' is de eigen machine en wordt niet gekeurd');
  }
  assert.equal(schild.signalen.verzoeken(), 3, 'ook lokaal verkeer is verkeer voor de meter');
  assert.equal(schild.signalen.actieveIps(), 0, 'lokaal maakt geen emmer');
  // een verzoek zonder ip, url en user-agent valt niet om
  const res = antwoord(); let door = false;
  schild.middleware({ get: () => undefined }, res, () => { door = true; });
  assert.equal(door, false, 'zonder ip is het geen localhost en de quarantaine-haak zegt nee');
  assert.equal(res.code, 403);
});

test('6. logDoel maskeert een ondertekende medialink en begrenst de lengte', () => {
  assert.equal(logDoel('/media/t/abc.def-123/x.jpg?y=1'), '/media/t/:ticket/x.jpg?y=1');
  assert.equal(logDoel('/MEDIA/T/abc'), '/media/t/:ticket');
  assert.equal(logDoel('/elders/media/t/abc'), '/elders/media/t/abc', 'alleen een pad dat met de medialink begint');
  assert.equal(logDoel(null), '');
  assert.equal(logDoel('/' + 'a'.repeat(300)).length, 120);
});

test('7. zonder melder of logboek bant en weigert het schild gewoon', () => {
  const { schild, stuur } = opzet({ zonderMelder: true });
  for (let i = 0; i < 5; i++) assert.equal(stuur('3.3.3.3', '/x.asp', 'x').code, 403);
  assert.equal(schild.banlijst.has('3.3.3.3'), true);
  assert.equal(stuur('3.3.3.4', '/ok', '').door, true);
  // een verzoek zonder originalUrl valt terug op url
  const res = antwoord(); let door = false;
  schild.middleware({ ip: '3.3.3.5', url: '/wp-admin', get: () => '' }, res, () => { door = true; });
  assert.equal(door, false);
  assert.equal(res.code, 403);
  const leeg = antwoord(); let ook = false;
  schild.middleware({ ip: '3.3.3.6', get: () => '' }, leeg, () => { ook = true; });
  assert.equal(ook, true, 'een verzoek zonder url is geen aanval');
  // maakSchild zonder opties valt niet om
  const kaal = maakSchild();
  let doorKaal = false;
  kaal.middleware(verzoek('2.2.2.2', '/', 'x'), antwoord(), () => { doorKaal = true; });
  assert.equal(doorKaal, true);
});

test('8. de veegbeurt elke minuut ruimt oude emmers en verlopen bans op, en laat verse staan', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1e12 });
  const { schild, stuur } = opzet();
  stuur('1.0.0.1', '/', 'x');
  for (let i = 0; i < 5; i++) stuur('1.0.0.2', '/x.php', 'x');
  assert.equal(schild.banlijst.has('1.0.0.2'), true);
  t.mock.timers.tick(60000);
  assert.equal(schild.emmers.has('1.0.0.1'), false, 'een emmer ouder dan twee vensters gaat weg');
  assert.equal(schild.banlijst.has('1.0.0.2'), true, 'een ban van een minuut oud blijft staan');
  stuur('1.0.0.3', '/', 'x');
  t.mock.timers.tick(15 * 60000);
  assert.equal(schild.banlijst.size, 0, 'na vijftien minuten is de ban weggeveegd, ook zonder nieuw verzoek');
  assert.equal(schild.signalen.bans(), 0);
  assert.equal(schild.signalen.actieveIps(), 0);
});
