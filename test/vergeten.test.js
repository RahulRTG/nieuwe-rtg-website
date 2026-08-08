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
// de strenge poort mag de stderr van onze eigen server meelezen
const { bewaakKind } = require('./helper');

const PORT = 4700 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vergeten-'));
const SERVER = path.join(__dirname, '..', 'server', 'server.js');

let kind, token = null, codenaam = null, sleutel = null;
let bestandenVoor = [], bestandenVanWilma = [];
const NAAM = 'Wilma Wegduiker';
const MAIL = 'wilma@vergeten.test';

/* Een piepklein maar geldig PNG (1x1, transparant). Groot genoeg om door de
   Ontsmetter en de mediastore te komen, klein genoeg om hier te staan. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/* Wat staat er op SCHIJF? De bezem hieronder leest db.json, maar de zwaarste
   persoonsgegevens staan daar niet in -- daar staat alleen een verwijzing naar
   een los, versleuteld bestand in DATA_DIR/media (Salon-foto's, snaps,
   site-beelden), DATA_DIR/bestanden (de kluis) of DATA_DIR/uploads (de
   paspoortscans en selfies). Die mappen waren nooit onderdeel van deze test, en
   precies daar bleef alles staan.

   'uploads' is er als laatste bij gekomen, en dat was de ergste: elke upload
   schreef een NIEUW bestand met een tijdstempel terwijl de database er maar EEN
   onthield, en de selfienaam stond in member_state -- die rij verdwijnt mee met
   het account, dus na deleteUser was hij niet eens meer te lezen. Een lid dat
   drie keer een scherpere foto probeerde (wat de afwijzingsmail letterlijk
   aanraadt) liet twee paspoortscans en een selfie achter, en kreeg "ok: true". */
function opSchijf() {
  const uit = [];
  for (const map of ['media', 'bestanden', 'uploads']) {
    const p = path.join(TMP, map);
    let namen = [];
    try { namen = fs.readdirSync(p); } catch (e) { namen = []; }
    for (const n of namen) uit.push(path.join(p, n));
  }
  return uit;
}

const wacht = (ms) => new Promise(r => setTimeout(r, ms));
function post(pad, body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}

/* RTG_DEMO=1 is hier nodig en het staat er met reden. Deze toets heeft een
   CATALOGUS nodig (een partner om sporen bij achter te laten). Sinds de
   livegang-schoonmaak is gerepareerd, staat er in een niet-demo-database geen
   enkele geseede partner meer -- dat is de bedoeling en niet een gebrek. Een
   toets die een catalogus nodig heeft, moet dus om de demostand vragen. Wat
   deze toets bewijst verandert er niet door: hij werkt met leden die hij zelf
   registreert. */
test('een lid aanmaken dat overal sporen achterlaat', async () => {
  /* RTG_STORE=json is hier een bewuste testkeuze, geen omweg. Een verse
     installatie draait op SQLite (store.db), en die inhoud is exact dezelfde --
     alleen het doosje verschilt. Met de JSON-opslag kan de bezem hieronder
     rechtstreeks lezen wat er op schijf staat, zonder dat de test een
     databaseschema hoeft te kennen dat met elke functie kan veranderen. */
  kind = spawn(process.execPath, ['--experimental-sqlite', SERVER], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), RTG_DATA_DIR: TMP,
      SMTP_URL: '', RTG_DEMO: '1', RTG_STORE: 'json' },
    // stderr naar 'pipe' zodat de strenge poort meeleest (zie helper.bewaakKind)
    stdio: ['ignore', 'ignore', 'pipe']
  });
  bewaakKind(kind);
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
  // wat er al op schijf stond voordat Wilma iets deed (seed-beeld e.d.)
  bestandenVoor = opSchijf();

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

  /* EN NU DE SPOREN DIE NIET IN db.json STAAN. Drie plekken die alle drie
     alleen een verwijzing in de database achterlaten en de echte inhoud op
     schijf zetten: een Salon-post met foto, een foto in de eigen
     site-bibliotheek, en het kluisbestand hierboven. Deze drie stonden nooit in
     deze test, en daardoor bleef de bezem groen terwijl alles er nog lag. */
  const salon = await post('/api/salon/plaats', { tekst: 'Wilma met beeld', media: [{ beeld: PNG, alt: 'stipje' }] }, token);
  assert.equal(salon.status, 200, 'de Salon-post met foto landt: ' + (await salon.text()).slice(0, 160));
  const siteFoto = await post('/api/site/foto', { dataUrl: PNG }, token);
  assert.equal(siteFoto.status, 200, 'de site-foto landt: ' + (await siteFoto.text()).slice(0, 160));

  /* EN DE IDENTITEITSMAP, want dat was het ergste gat. De wandeling hierboven
     deed EEN paspoort-upload; het probleem ontstaat pas bij de TWEEDE. Elke
     upload schreef een nieuw bestand met een tijdstempel terwijl de database er
     maar een onthield, dus de eerste bleef als wees achter -- en dat gebeurt in
     de praktijk, want de afwijzingsmail raadt letterlijk aan het opnieuw te
     proberen met een duidelijkere foto. De selfie was nog erger: zijn naam
     stond in member_state, en die rij verdwijnt mee met het account, dus na
     deleteUser was hij niet eens meer te lezen om te wissen. */
  const tweede = await post('/api/verify/upload', { image: PNG }, token);
  assert.equal(tweede.status, 200, 'een tweede paspoortpoging landt: ' + (await tweede.text()).slice(0, 160));
  const selfie = await post('/api/verify/selfie', { image: PNG }, token);
  assert.equal(selfie.status, 200, 'de selfie landt: ' + (await selfie.text()).slice(0, 160));

  /* En meteen de andere helft van hetzelfde gat, want die valt buiten de bezem
     hieronder: die kijkt na het VERWIJDEREN, en daar wordt inmiddels alles van
     dit account gewist. Voor een lid dat nooit verwijdert -- de meesten -- is de
     vraag of de map überhaupt begrensd is. Twee paspoortpogingen horen EEN
     bestand op te leveren, niet twee. Zonder die grens is er geen plafond, geen
     bewaartermijn en geen opruimtaak, en gaat er 5 MB per verzoek in. */
  const id = String(sleutel).replace('user-', '');
  let inMap = [];
  try { inMap = fs.readdirSync(path.join(TMP, 'uploads')); } catch (e) {}
  const bewijzen = inMap.filter(n => new RegExp('^' + id + '-\\d+\\.').test(n));
  const selfies = inMap.filter(n => new RegExp('^' + id + '-selfie-\\d+\\.').test(n));
  assert.equal(bewijzen.length, 1,
    'na twee paspoortpogingen staat er precies EEN bewijs op schijf (nu: ' + bewijzen.join(', ') + ')');
  assert.equal(selfies.length, 1, 'en precies een selfie (nu: ' + selfies.join(', ') + ')');

  await wacht(400); // de opslag even laten landen

  const na = opSchijf();
  bestandenVanWilma = na.filter(p => !bestandenVoor.includes(p));
  /* Vijf is de ondergrens: de kluisupload, de Salon-foto, de site-foto, het
     paspoort en de selfie. Blijft dit eronder, dan is de wandeling hierboven in
     stilte leeggelopen en bewijst de controle na het verwijderen niets. */
  assert.ok(bestandenVanWilma.some(p => p.includes('/uploads/')),
    'er staat een identiteitsbewijs op schijf om over te controleren: ' + bestandenVanWilma.join(', '));
  assert.ok(bestandenVanWilma.length >= 5,
    'te weinig bestanden op schijf van Wilma (' + bestandenVanWilma.length + '): ' + bestandenVanWilma.join(', '));
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
  /* DE SLEUTELMATCH HAD EEN GAT, EN DAAR PASTE DE HELE KLUIS DOORHEEN.

     Er stond `tekst.includes('"' + sleutel + '"')`: de sleutel MET aanhalings-
     tekens aan beide kanten. RTG Bestanden bewaart zijn borden onder de naam
     "lid:user-5" -- die begint niet met een aanhalingsteken voor de sleutel, dus
     die matchte niet. De hele kluis van het lid, mappen en al, kon blijven staan
     zonder dat deze test iets zei.

     Nu op een woordgrens in plaats van op aanhalingstekens: user-5 mag niet
     gevolgd worden door een cijfer (anders is user-50 een valse treffer), maar
     wat eraan VOORAF gaat maakt niet uit. */
  const sleutelRe = sleutel ? new RegExp(sleutel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9])') : null;
  const raak = [];
  for (const [tak, waarde] of Object.entries(data)) {
    const tekst = JSON.stringify(waarde == null ? null : waarde);
    if (!tekst) continue;
    const wat = [];
    if (sleutelRe && sleutelRe.test(tekst)) wat.push('sleutel');
    if (codenaam && tekst.includes(codenaam)) wat.push('codenaam');
    if (tekst.includes(NAAM) || tekst.includes(MAIL)) wat.push('NAAM/E-MAIL');
    if (wat.length) raak.push(tak + ' (' + wat.join(' + ') + ')');
  }

  assert.deepEqual(raak, [],
    'na verwijderen staat dit lid nog in deze takken; elke tak hier is een plek ' +
    'waar het recht op vergetelheid niet is nagekomen:\n  ' + raak.join('\n  '));
});

/* EN DE BEZEM OVER DE SCHIJF. Dit was de blinde vlek van de test hierboven: die
   leest db.json, en juist de zwaarste gegevens staan daar niet in. De foto's uit
   De Salon, de beelden van een eigen site en de bestanden uit RTG Bestanden
   liggen als losse, met ONZE sleutel versleutelde bestanden in DATA_DIR. Een
   verwijderde verwijzing met een blijvend bestand is geen vergetelheid maar een
   wees die wij nog gewoon kunnen openen -- en bij de kluis gaat dat over
   paspoortscans, contracten en medische brieven. */
test('en de bezem over de schijf: geen weesbestanden van dit lid', async () => {
  await wacht(600);
  assert.ok(bestandenVanWilma.length >= 5, 'de vorige test heeft bestanden vastgelegd om op te controleren');
  const blijven = bestandenVanWilma.filter(p => fs.existsSync(p));
  assert.deepEqual(blijven, [],
    'na verwijderen staan deze bestanden van het lid nog op schijf; elk bestand hier ' +
    'is inhoud die wij kunnen openen van iemand die gevraagd heeft vergeten te worden:\n  ' + blijven.join('\n  '));
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
