/* EEN AANVALLER MAG HET HELE HUIS NIET KUNNEN SLUITEN.

   server/beveiliging.js draagt een automatische noodrem: vanaf drie
   aanvalsbronnen binnen tien minuten gaat de registratie-zekering eruit, vanaf
   zes de ONDERHOUDS-zekering -- en dan geeft elke /api/-route 503 "De app is in
   onderhoud", voor iedereen.

   DE VRAAG IS WAT EEN "BRON" IS. De noodrem telde verschillende BUCKETS, en een
   bucket is (server/routes/auth/inlog.js):

       const bucket = 'auth:' + req.ip + ':' + login.toLowerCase()

   De INLOGNAAM zit erin. Voor de snelheidsrem is dat juist goed -- anders kan
   iemand het account van een ander op slot zetten door het fout te raden. Maar
   voor de noodrem stelt het de verkeerde vraag: die wil weten HOEVEEL
   AANVALLERS er zijn, en telde in plaats daarvan hoeveel DEUREN er zijn
   aangeklopt.

   Gevolg: een script vanaf EEN adres dat zes gebruikersnamen probeert -- de
   meest gewone aanval die er is, credential stuffing -- zette het hele platform
   in onderhoud. Dat is geen verdediging maar een zelf toegebrachte storing: de
   aanvaller heeft geen enkel account nodig, alleen zes namen.

   HOE DIT AAN HET LICHT KWAM. Niet door nadenken maar door een meting. De A/B
   van npm run beproeving liet de versnelde kant 87.963 keer 503 geven waar de
   trage kant er nul gaf; van de goede verhalen kwam nog 8,8% door in plaats van
   99%, en na de storm herstelde de server helemaal niet. De snellere server
   haalde binnen dezelfde drie minuten simpelweg meer inlognamen langs de tien
   mislukkingen. De drempel was geijkt op een tragere server, en de versnelling
   maakte zichtbaar wat er al stond.

   WAT DEZE TOETS VASTLEGT, en het kan allemaal zakken:
     1. TEGENPROEF: de snelheidsrem doet zijn werk nog -- na tien mislukte
        pogingen op dezelfde naam volgt 429;
     2. EEN bron die zes namen probeert sluit het huis NIET; een gewone
        gebruiker komt daarna nog gewoon binnen;
     3. en de noodrem is niet uitgezet: ZES verschillende bronnen sluiten het
        huis wel degelijk.

   Punt 3 is wat deze toets eerlijk houdt. Zonder die bewering zou "het huis
   gaat niet dicht" ook groen zijn als de noodrem helemaal niet meer werkt, en
   dan had ik een beveiliging weggehaald in plaats van gerepareerd.

   Draai los: node --experimental-sqlite --test test/noodrem-bron.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* Elke toets hieronder krijgt zijn EIGEN server met een eigen datamap. De
   noodrem is een opgeslagen zekering: is hij eenmaal gesprongen, dan blijft hij
   gesprongen, en dan zou toets 2 afhangen van de volgorde waarin toets 3 liep. */
async function versServer() {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-noodrem-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  srv.op = () => { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
  return srv;
}

const post = (base, pad, body, kop) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, kop || {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Tien mislukte pogingen op een naam: precies de drempel waarop de
   snelheidsrem dichtgaat en er een brute-force-alarm wordt gemeld. */
async function raadDoor(base, naam, vanaf) {
  const kop = vanaf ? { 'X-Forwarded-For': vanaf } : {};
  const uit = [];
  for (let i = 0; i < 11; i++) {
    uit.push((await post(base, '/api/auth/login', { login: naam, password: 'fout' + i }, kop)).status);
  }
  return uit;
}

/* Staat het huis nog open?

   NIET met /api/health, en dat is een fout die deze toets zelf eerst maakte.
   De hoofdzekering (server/middleware/remmen.js) laat /api/health, /api/ready
   en /api/techniek er met opzet DOOR -- anders zou een server in onderhoud er
   voor een loadbalancer uitzien als een dode server. Een toets die de
   onderhoudsstand aan /api/health afmeet, meldt dus altijd "open" en meet
   niets (LAT-regel 10). Toets 3 zakte daar dan ook op, terwijl het slot wel
   degelijk om was.

   Daarom een gewone ledenroute, die precies is wat een echte gebruiker raakt. */
async function huisOpen(base) {
  const r = await fetch(base + '/api/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  return r.status !== 503;
}

test('1. TEGENPROEF: de snelheidsrem zelf werkt nog', async () => {
  const srv = await versServer();
  try {
    const statussen = await raadDoor(srv.base, 'iemand@voorbeeld.test');
    assert.ok(statussen.includes(401), 'de eerste pogingen horen gewoon geweigerd te worden');
    assert.equal(statussen[statussen.length - 1], 429,
      'na tien mislukkingen hoort de inlog op slot te gaan: ' + statussen.join(','));
  } finally { srv.op(); }
});

test('2. EEN bron met zes namen sluit het huis niet', async () => {
  const srv = await versServer();
  try {
    /* Zes verschillende inlognamen, allemaal vanaf hetzelfde adres. Dat is
       credential stuffing: de aanvaller heeft geen account nodig, alleen namen. */
    for (const naam of ['aap@x.test', 'noot@x.test', 'mies@x.test', 'wim@x.test', 'zus@x.test', 'jet@x.test']) {
      await raadDoor(srv.base, naam);
    }

    assert.equal(await huisOpen(srv.base), true,
      'een enkele aanvaller met zes namen zette het HELE platform in onderhoud');

    /* En een gewone gebruiker komt er daarna nog gewoon in. "Niet 503" is niet
       hetzelfde als "het werkt": registreren zit achter een tweede zekering die
       al vanaf drie bronnen springt, en die hoort hier ook niet gesprongen te
       zijn. */
    const u = (Date.now() + Math.floor(Math.random() * 1e6)).toString().slice(-9);
    const reg = await post(srv.base, '/api/auth/register', {
      name: 'Gewoon Lid', email: 'gewoon' + u + '@voorbeeld.test', phone: '06' + u,
      password: 'geheim12345', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg'
    });
    assert.ok(reg.body.token,
      'een gewone gebruiker kon zich niet meer aanmelden: ' + reg.status + ' ' + JSON.stringify(reg.body).slice(0, 140));
  } finally { srv.op(); }
});

test('3. maar ZES bronnen sluiten het huis wel degelijk', async () => {
  const srv = await versServer();
  try {
    /* Zes verschillende adressen, elk op zijn eigen naam. Dit is wel het beeld
       waar de noodrem voor bestaat: een verdeelde aanval. */
    for (let i = 1; i <= 6; i++) {
      await raadDoor(srv.base, 'doel' + i + '@x.test', '203.0.113.' + i);
    }
    assert.equal(await huisOpen(srv.base), false,
      'zes verschillende bronnen horen de onderhouds-zekering er wel uit te halen');
  } finally { srv.op(); }
});
