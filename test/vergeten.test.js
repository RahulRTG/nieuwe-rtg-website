/* VERGETEN -- blijft er na "verwijder mijn gegevens" echt niets achter?

   Het recht op vergetelheid (AVG art. 17) is makkelijk te BELOVEN en moeilijk
   waar te maken in een systeem dat gegroeid is. De verwijderroute is ooit
   geschreven toen er een handvol takken in de database stonden; inmiddels zijn
   het er ruim honderdvijftig. Elke nieuwe functie die iets onder de sleutel van
   een lid wegschrijft, is een nieuwe plek waar dat lid kan blijven staan --
   zonder dat iemand het merkt, want niets faalt.

   Deze test doet daarom niet wat de verwijderroute zegt te doen, maar kijkt na
   afloop met een bezem door de HELE database: komt de sleutel of de codenaam
   van het verwijderde lid nog ergens voor? Zo ja, dan staat hier welke tak.

   Zo blijft de belofte meegroeien met het systeem in plaats van erachteraan.

   Draai los: node --experimental-sqlite --test test/vergeten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4700 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vergeten-'));
const SERVER = path.join(__dirname, '..', 'server', 'server.js');

let kind, token = null, codenaam = null, sleutel = null;
const NAAM = 'Wilma Wegduiker';
const MAIL = 'wilma@vergeten.test';

const wacht = (ms) => new Promise(r => setTimeout(r, ms));
function post(pad, body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}

test('een lid aanmaken dat overal sporen achterlaat', async () => {
  /* RTG_STORE=json is hier een bewuste testkeuze, geen omweg. Een verse
     installatie draait op SQLite (store.db), en die inhoud is exact dezelfde --
     alleen het doosje verschilt. Met de JSON-opslag kan de bezem hieronder
     rechtstreeks lezen wat er op schijf staat, zonder dat de test een
     databaseschema hoeft te kennen dat met elke functie kan veranderen. */
  kind = spawn(process.execPath, ['--experimental-sqlite', SERVER], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), RTG_DATA_DIR: TMP,
      SMTP_URL: '', RTG_DEMO: '0', RTG_STORE: 'json' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) {}
    await wacht(200);
  }

  const reg = await post('/api/auth/register', {
    name: NAAM, email: MAIL, phone: '0611111111', password: 'geheim12345',
    geboortedatum: '1988-05-05', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(reg.status, 200, 'registreren lukt');
  token = (await reg.json()).token;

  const antwoord = await (await post('/api/state', {}, token)).json();
  const staat = antwoord.state || antwoord;
  codenaam = staat.user && staat.user.codename;
  sleutel = 'user-' + (staat.user && staat.user.id);
  assert.ok(codenaam, 'het lid heeft een codenaam: ' + codenaam);

  /* Nu sporen achterlaten in verschillende hoeken. Niet uitputtend -- dat kan
     ook niet met 157 takken -- maar wel in de soorten die er in de praktijk
     toe doen: een profiel-document, een bericht, een voorkeur, een lijstje. */
  await post('/api/cv/save', { cv: { headline: 'Iets van Wilma', skills: ['zeilen'] } }, token);
  await post('/api/salon/post', { text: 'Hallo vanuit de Salon' }, token);
  await post('/api/favoriet', { code: 'DEMO', aan: true }, token);
  await post('/api/agenda/voeg', { titel: 'afspraak', wanneer: '2026-09-01T10:00' }, token);
  await post('/api/live/deel', { lat: 52.1, lon: 4.3 }, token);
  /* En praten met Rahul. Dat stond hier niet, en juist daarom bleef zijn
     geheugen na het verwijderen gewoon staan: de bezem hieronder veegt door de
     hele database, maar een tak die nooit is aangemaakt kan hij niet vinden.
     Wat er in staat is precies wat art. 17 bedoelt -- de weetjes die het lid
     zelf deelde en de laatste beurten van het gesprek. */
  await post('/api/fluister', { q: 'plan mijn dag' }, token);
  await post('/api/fluister', { q: 'onthoud dat ik graag bij het raam zit' }, token);

  /* En dan BREED. De bezem hieronder is zo goed als de wandeling hierboven: een
     tak die dit lid nooit aanraakt, kan hij niet vinden. Precies zo bleef Rahuls
     geheugen staan. Daarom loopt Wilma nu langs de takken die aan haar SLEUTEL
     hangen -- dat is het lijstje waarmee ze weer terug te vinden zou zijn.

     Per stap wordt afgedwongen dat de actie ook echt landde (zie hieronder):
     een aanroep die stilletjes 404't voegt geen dekking toe maar suggereert die
     wel, en dat is erger dan hem weglaten. */
  const partners = (await (await post('/api/suppliers', {}, token)).json()).suppliers || [];
  const zaak = partners.find(p => (p.menu || []).length) || partners[0];
  assert.ok(zaak && zaak.code, 'er is een partner om sporen bij achter te laten');
  const talen = (await (await post('/api/member/taal', {}, token)).json()).talen || [];

  const sporen = [
    ['/api/zorgprofiel/zet', { allergenen: ['noten'], deel: true }],
    ['/api/member/taal/zet', { code: (talen[0] && (talen[0].code || talen[0])) || 'nl' }],
    ['/api/favoriet', { supplierCode: zaak.code }],
    ['/api/wallet/voeg', { soort: 'klantenkaart', titel: 'Kaart van Wilma', code: 'WIL-1234' }],
    ['/api/bestanden/upload', { naam: 'wilma.txt', dataUrl: 'data:text/plain;base64,' + Buffer.from('van Wilma').toString('base64') }],
    ['/api/order', { supplierCode: zaak.code, items: ((zaak.menu || [])[0] ? [{ id: zaak.menu[0].id, qty: 1 }] : []) }],
    ['/api/verify/upload', { image: 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64') }],
    ['/api/giftcard/buy', { supplierCode: zaak.code, bedrag: 25 }],
    ['/api/splits', { ref: 'x', metKeys: [] }],
    ['/api/review', { soort: 'order', ref: 'x', score: 5 }]
  ];
  const geland = [];
  for (const [pad, lijf] of sporen) {
    const r = await post(pad, lijf, token);
    if (r.status === 200) geland.push(pad);
  }
  /* Minstens zes moeten echt raak zijn, anders is deze wandeling in stilte
     leeggelopen (een endpoint dat hernoemd wordt, valt hier op) en zou de bezem
     hieronder groen staan zonder iets te hebben geveegd. */
  assert.ok(geland.length >= 6, 'te weinig sporen geland (' + geland.length + '): ' + geland.join(', '));

  await wacht(400); // de opslag even laten landen
});

test('na verwijderen is het account echt weg', async () => {
  const weg = await post('/api/privacy/delete', {}, token);
  assert.equal(weg.status, 200, 'de verwijderroute meldt succes');

  // het token doet niets meer
  const na = await post('/api/state', {}, token);
  assert.ok(na.status === 401 || na.status === 403, 'de sessie is beeindigd (kreeg ' + na.status + ')');

  // en opnieuw inloggen kan niet
  const inlog = await post('/api/auth/login', { login: MAIL, password: 'geheim12345', pasApp: 'rtg' });
  assert.ok(inlog.status >= 400, 'het account bestaat niet meer (kreeg ' + inlog.status + ')');
});

test('de bezem door de hele database: geen sleutel, codenaam of naam meer', async () => {
  /* De server heeft zijn eigen kopie in het geheugen; we lezen wat er op schijf
     staat, want dat is wat na een herstart terugkomt en wat in een backup
     belandt. Dat is de eerlijke maat voor "weg". */
  await wacht(600);
  const bestand = path.join(TMP, 'db.json');
  assert.ok(fs.existsSync(bestand), 'er staat een databasebestand: ' + bestand);
  const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));

  /* Per tak kijken, zodat de fout zegt WAAR het lid nog staat. Een tak die het
     nog noemt is niet automatisch een overtreding -- een geanonimiseerde
     sollicitatie mag blijven -- maar de SLEUTEL en de CODENAAM zijn precies de
     twee dingen die er niet meer horen te zijn: daarmee is de persoon weer
     terug te vinden. */
  const raak = [];
  for (const [tak, waarde] of Object.entries(data)) {
    const tekst = JSON.stringify(waarde == null ? null : waarde);
    if (!tekst) continue;
    const wat = [];
    if (sleutel && tekst.includes('"' + sleutel + '"')) wat.push('sleutel');
    if (codenaam && tekst.includes(codenaam)) wat.push('codenaam');
    if (tekst.includes(NAAM) || tekst.includes(MAIL)) wat.push('NAAM/E-MAIL');
    if (wat.length) raak.push(tak + ' (' + wat.join(' + ') + ')');
  }

  assert.deepEqual(raak, [],
    'na verwijderen staat dit lid nog in deze takken; elke tak hier is een plek ' +
    'waar het recht op vergetelheid niet is nagekomen:\n  ' + raak.join('\n  '));
});

test('de echte naam stond sowieso nooit in de gedeelde database', () => {
  /* Los van verwijderen: het hele privacy-ontwerp staat of valt hiermee. De
     operationele data draait op codenamen; de naam ligt versleuteld in de
     aparte kluis (rtg.db). Zou hij ook in db.json staan, dan was de kluis
     decoratie. */
  const bestand = path.join(TMP, 'db.json');
  const ruw = fs.readFileSync(bestand, 'utf8');
  assert.ok(!ruw.includes(NAAM), 'de echte naam staat niet in de gedeelde database');
  assert.ok(!ruw.includes(MAIL), 'het e-mailadres ook niet');
});

test.after(async () => {
  if (kind) kind.kill();
  await wacht(200);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});
