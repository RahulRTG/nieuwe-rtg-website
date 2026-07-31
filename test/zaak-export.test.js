/* ============================================================================
   WAT EEN ZAAK EXPORTEERT -- 2 endpoints uit de supplier-groep.

   rides.csv en dagrapport.csv stonden als nooit aangeroepen in de waargenomen
   dekkingsmeting. Ze vallen op tussen alle andere supplier-routes: het zijn
   de enige twee die met GET werken en hun token uit de QUERYSTRING halen. Dat
   is geen slordigheid maar noodzaak -- een downloadlink in een browser kan
   geen Authorization-kop meesturen -- en juist daarom horen ze beproefd te
   zijn.

   WAT ER OP HET SPEL STAAT

   - EEN DOWNLOADLINK IS NOG STEEDS EEN DEUR. Zonder token, met een verzonnen
     token, of met het token van een LID in plaats van een zaak: 401. Anders
     is de boekhouding van een zaak te downloaden door wie de URL raadt.
   - EEN CSV IS EEN PROGRAMMA ALS JE NIET OPLET. Een adres of een codenaam die
     met = + - of @ begint, wordt door Excel en Numbers als FORMULE uitgevoerd
     zodra iemand het bestand opent. De boekhouder van de zaak opent dat
     bestand. csvCel() zet er een apostrof voor; toets 3 rekent dat af met een
     rit waarvan het afleveradres letterlijk een formule is.
   - JE EXPORTEERT JE EIGEN ZAAK. De regels komen uit sess.code, niet uit een
     parameter, dus er valt niets te verdraaien -- maar dat moet wel vaststaan.

   Draai los: node --experimental-sqlite --test test/zaak-export.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, taxi, taxiWerker, resto, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-export-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const haal = (pad) => fetch(base + pad).then(async r => ({ status: r.status, tekst: await r.text().catch(() => '') }));
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = (roster.body.staff || []).find(x => x.role === rol);
  return wie ? (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token : null;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  taxi = await inlog('MKKX', 'manager');       // Ibiza Executive Cars: rijdt ritten
  taxiWerker = await inlog('MKKX', 'staff');
  resto = await inlog('KIKUNOI', 'manager');
  lid = (await api('/api/login', { tier: 'business' })).body.token;
  assert.ok(taxi && resto && lid, 'de taxi, het restaurant en een lid staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een downloadlink is nog steeds een deur', async () => {
  for (const pad of ['/api/supplier/rides.csv', '/api/supplier/dagrapport.csv']) {
    assert.equal((await haal(pad)).status, 401, pad + ' zonder token');
    assert.equal((await haal(pad + '?token=verzonnen')).status, 401, pad + ' met een verzonnen token');
    /* Een LID heeft een geldig token -- alleen niet van een zaak. Zonder de
       rolcontrole zou elk ingelogd lid de boekhouding van een partner kunnen
       ophalen door de link in te tikken. */
    assert.equal((await haal(pad + '?token=' + lid)).status, 401, pad + ' met het token van een lid');
  }
});

test('2. de export bevat de eigen zaak, met een kop en een bestandsnaam', async () => {
  const r = await fetch(base + '/api/supplier/rides.csv?token=' + taxi);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/csv/);
  assert.match(r.headers.get('content-disposition') || '', /attachment; filename="ritten-mkkx-/,
    'de bestandsnaam draagt de eigen zaakcode');
  /* De BOM moet je op BYTE-niveau controleren. fetch().text() decodeert als
     UTF-8 en haalt een leidende BOM er volgens de standaard af -- een toets op
     de gedecodeerde tekst ziet hem dus nooit, ook niet als hij er staat. Zonder
     die BOM leest Excel het bestand als Latin-1 en staat er "Sant Josep" met
     een kapot accent in de boekhouding. */
  const bytes = new Uint8Array(await (await fetch(base + '/api/supplier/rides.csv?token=' + taxi)).arrayBuffer());
  assert.deepEqual([bytes[0], bytes[1], bytes[2]], [0xEF, 0xBB, 0xBF], 'het bestand begint met een UTF-8 BOM');

  const tekst = await r.text();
  assert.match(tekst.split('\n')[0], /referentie;gast/, 'en een kopregel');

  const d = await fetch(base + '/api/supplier/dagrapport.csv?token=' + resto);
  assert.equal(d.status, 200);
  assert.match(d.headers.get('content-disposition') || '', /dagrapport-kikunoi-/);
  assert.match(await d.text(), /btw/i, 'het dagrapport gaat over omzet en btw');

  // ook de bediening mag exporteren: dit is geen managementroute
  if (taxiWerker) assert.equal((await haal('/api/supplier/rides.csv?token=' + taxiWerker)).status, 200);
});

test('3. een csv is een programma als je niet oplet', async () => {
  /* Een adres dat met = begint wordt door Excel en Numbers als FORMULE
     uitgevoerd zodra het bestand opengaat -- en het is de boekhouder van de
     zaak die dat bestand opent. De klassieke vorm is =HYPERLINK of een
     verwijzing naar een extern bestand; er zijn varianten die met + - of @
     beginnen. csvCel() zet er een apostrof voor.

     Dit is de enige plek in dit huis waar tekst van een gast in een bestand
     belandt dat bij iemand anders in een spreadsheet opengaat, dus hier hoort
     die bewering te staan. */
  const rit = {
    ref: 'RTG-R-FORMULE', supplierCode: 'MKKX', customerCodename: '=1+1',
    from: '=HYPERLINK("http://kwaad.example","Klik")', to: '@SUM(A1:A9)',
    km: 12, passengers: 2, quote: 45, status: 'afgerond',
    at: new Date().toISOString(), finishedAt: new Date().toISOString()
  };
  const gezet = await api('/api/test/rit', rit, taxi);
  if (gezet.status !== 200) {
    /* Geen testdeur om een rit te planten? Dan toetsen we de beveiliging waar
       hij woont, op precies dezelfde functie die de route gebruikt. Dat is
       eerlijker dan de bewering weglaten. */
    const { csvCel } = require('../server/kern/factuur');
    assert.equal(csvCel('=1+1'), "'=1+1", 'een cel die met = begint krijgt een apostrof');
    assert.equal(csvCel('+SUM(A1)'), "'+SUM(A1)");
    assert.equal(csvCel('@import'), "'@import");
    assert.equal(csvCel('-cmd'), "'-cmd");
    /* Een gewoon negatief bedrag krijgt GEEN apostrof -- dat is de hele reden
       dat de getalcontrole naast de formulecontrole staat. Wel komt het tussen
       aanhalingstekens, want in dit huis is de komma het decimaalteken en de
       puntkomma het scheidingsteken; zonder quotes zou een spreadsheet er
       alsnog twee kolommen van kunnen maken. */
    assert.equal(csvCel('-12,50'), '"-12,50"', 'een negatief bedrag blijft een bedrag, alleen netjes gequote');
    assert.ok(!csvCel('-12,50').includes("'"), 'en krijgt zeker geen apostrof');
    assert.equal(csvCel('12,5%'), '"12,5%"');
    assert.equal(csvCel('-1250'), '-1250', 'zonder komma is er niets te quoten');
    assert.equal(csvCel('Sal de Mar; Ibiza'), '"Sal de Mar; Ibiza"', 'een puntkomma wordt netjes gequote');
    assert.equal(csvCel('Zei "hallo"'), '"Zei ""hallo"""', 'en een aanhalingsteken verdubbeld');
    return;
  }
  const tekst = (await fetch(base + '/api/supplier/rides.csv?token=' + taxi)).text
    ? await (await fetch(base + '/api/supplier/rides.csv?token=' + taxi)).text() : '';
  assert.ok(!/(^|;)=HYPERLINK/m.test(tekst), 'geen enkele cel begint kaal met een formule: ' + tekst.slice(0, 300));
  assert.match(tekst, /'=HYPERLINK|"'=HYPERLINK/, 'de formule staat onschadelijk gemaakt in het bestand');
});
