/* ============================================================================
   DE WAARSCHUWING OVER HET ONVEILIGE ADRES: ZEGT HIJ HET, EN ZWIJGT HIJ OOK?

   Waar dit over gaat: een browser geeft camera, microfoon en locatie alleen vrij
   op https of localhost. Een telefoon die deze server op http://192.168.x.x
   aanroept heeft dus geen navigator.mediaDevices, en dan doet geen enkel
   camerascherm iets -- terwijl op de laptop op localhost alles werkt. Dat was de
   klacht. server/opzet/veiligadres.js zegt dat bij het opstarten.

   Beide kanten zijn even belangrijk, en de tweede is de reden dat deze toets
   bestaat: een waarschuwing die in het gewone geval OOK afgaat, leert iedereen
   hem weg te kijken en is daarna niets meer waard. Dus:

     plat op het netwerk   -> WAARSCHUWING, met het echte adres erbij
     RTG_TLS=1             -> WEGWIJZER: het https-adres voor de telefoon
     op loopback gebonden  -> stil (er komt geen telefoon bij)
     alleen loopback in de -> stil (het speelt niet op deze machine)
       netwerkkaarten
     kind van de poort     -> stil (de poortwachter is de voordeur)

   De netwerkkaarten worden meegegeven en niet gelezen: anders hangt de uitslag
   af van de machine waarop de suite draait, en dan meet hij daar iets anders dan
   hier.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const veiligAdres = require('../server/opzet/veiligadres');

const NETTEN = {
  lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  eth0: [{ family: 'IPv4', address: '192.168.1.9', internal: false },
         { family: 'IPv6', address: 'fe80::1', internal: false }]
};
/* Een log die meeschrijft in plaats van naar de console: zo is de TEKST te
   toetsen. Warn en info apart, want het KANAAL is hier een bewering: een
   wegwijzer hoort geen waarschuwing te zijn, anders staat er in productie een
   WARN over iets wat juist goed staat. */
function logje() {
  const regels = [], kanaal = [];
  return { regels, kanaal,
    warn: (m) => { kanaal.push('warn'); regels.push(String(m)); },
    info: (m) => { kanaal.push('info'); regels.push(String(m)); } };
}

test('plat op het netwerk: hij noemt het adres en wat er dan niet werkt', () => {
  const log = logje();
  const uit = veiligAdres({ PORT: 3000, HOST: '', env: {}, netten: NETTEN, log });
  assert.ok(uit, 'er is iets gezegd');
  assert.equal(uit.soort, 'waarschuwing');
  assert.deepEqual(uit.adressen, ['192.168.1.9'], 'alleen het echte IPv4-adres, niet loopback');
  const alles = log.regels.join(' ');
  assert.match(alles, /http:\/\/192\.168\.1\.9:3000/, 'met het adres waar de telefoon naartoe gaat');
  assert.ok(!/https:\/\//.test(alles), 'en niet met een https-adres dat hier niet bestaat');
  assert.match(alles, /camera/, 'en met de camera erbij');
  assert.match(alles, /microfoon/, 'en de microfoon');
  assert.match(alles, /RTG_TLS=1/, 'en met wat je eraan doet');
  assert.equal(log.regels.length, 2, 'twee regels, niet meer -- dit is een waarschuwing en geen betoog');
  assert.deepEqual(log.kanaal, ['warn', 'warn'], 'en dit hoort in het waarschuwingskanaal');
});

test('met RTG_TLS=1: geen waarschuwing maar het https-adres voor de telefoon', () => {
  const log = logje();
  const uit = veiligAdres({ PORT: 3443, HOST: '', env: { RTG_TLS: '1' }, netten: NETTEN, log });
  assert.ok(uit, 'er is iets gezegd');
  assert.equal(uit.soort, 'wegwijzer', 'dit is geen waarschuwing: hier werkt het juist');
  const alles = log.regels.join(' ');
  assert.match(alles, /https:\/\/192\.168\.1\.9:3443/, 'met het https-adres van deze machine');
  assert.ok(!/LET OP/.test(alles), 'zonder LET OP -- er is niets aan de hand');
  assert.match(alles, /certificaat/, 'en met de waarschuwing over het self-signed cert erbij');
  assert.deepEqual(log.kanaal, ['info', 'info'],
    'als info en niet als warn: een WARN over iets wat goed staat, leert iedereen WARN te negeren');
});

test('op loopback, zonder netwerkkaart of achter de poortwachter: stil', () => {
  const gevallen = [
    ['op loopback gebonden', { PORT: 3000, HOST: '127.0.0.1', env: {}, netten: NETTEN }],
    ['op loopback met https', { PORT: 3000, HOST: '127.0.0.1', env: { RTG_TLS: '1' }, netten: NETTEN }],
    ['alleen loopback aanwezig', { PORT: 3000, HOST: '', env: {}, netten: { lo: NETTEN.lo } }],
    ['kind van de poortwachter', { PORT: 3000, HOST: '', env: { RTG_SERVER: '1' }, netten: NETTEN }]
  ];
  for (const [naam, opties] of gevallen) {
    const log = logje();
    const uit = veiligAdres(Object.assign({ log }, opties));
    assert.equal(uit, null, naam + ': niets teruggegeven');
    assert.deepEqual(log.regels, [], naam + ': en niets gezegd');
  }
});

test('0.0.0.0 en :: gelden als "op het netwerk", een echt adres niet', () => {
  for (const host of ['', '0.0.0.0', '::']) {
    const log = logje();
    assert.ok(veiligAdres({ PORT: 8080, HOST: host, env: {}, netten: NETTEN, log }),
      'HOST=' + JSON.stringify(host) + ' staat op alle interfaces, dus zeggen');
  }
  const log = logje();
  assert.equal(veiligAdres({ PORT: 8080, HOST: '10.0.0.5', env: {}, netten: NETTEN, log }), null,
    'een vast adres is een bewuste keuze van degene die start; daar hoort geen les bij');
});

test('lanAdressen laat loopback en IPv6 liggen', () => {
  assert.deepEqual(veiligAdres.lanAdressen(NETTEN), ['192.168.1.9']);
  assert.deepEqual(veiligAdres.lanAdressen({}), []);
  assert.deepEqual(veiligAdres.lanAdressen(null), []);
});
