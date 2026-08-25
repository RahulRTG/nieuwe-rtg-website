/* DE BETAALDE KANT VAN DE APP STORE -- de bon, de aanschaf, de afdracht, de btw
   en het teruggaverecht.

   Wat deze toets vastlegt, en waarom elk punt er staat:

     1. De prijs staat in het MANIFEST, dus per versie, dus door de keuring. Een
        prijs die zonder handtekening kan veranderen, is geen prijs.
     2. Er is EEN rekensom. Wat het lid op de bon ziet en wat er wordt geboekt
        komen uit dezelfde functie; anders kunnen die twee uit elkaar lopen.
     3. De btw hoort in het land van het LID (kern/fiscaal/digitaal.js) en wordt
        nooit geraden -- geen land, geen aanschaf.
     4. Een betaalde app gaat pas op het startscherm als hij is gekocht, en die
        controle staat in de kern en niet in het scherm.
     5. De afdracht werkt VOORUIT: een bon die al is geschreven, wordt nooit
        herrekend.
     6. Intrekken laat een teruggaveRECHT achter, geen automatische terugboeking.
        Grens 5 blijft absoluut; het geld regelt een mens.
     7. Een uitgever ziet aantallen en bedragen, nooit wie.

   Draai los: node --experimental-sqlite --test test/appstore-geld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { splitsBruto } = require('../server/kern/fiscaal/digitaal');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-geld-'));
let srv, base, lid, lidCode, sup, office, tech;
const ORG = 'O-GELD';
const PRIJS = 999;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const APP_HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Betaald</title></head>' +
  '<body><p id="u">hoi</p><script src="app.js"></script></body></html>';
const bundel = (extra) => [{ pad: 'index.html', inhoud: APP_HTML },
  { pad: 'app.js', inhoud: 'document.getElementById("u").textContent = "draait";' }].concat(extra || []);
const manifest = (over) => {
  const m = Object.assign({
    sleutel: 'derden-betaald', naam: 'Betaalde App', versie: '1.0.0',
    uitleg: 'Een app van een derde die geld kost, om de bon en de afdracht te tonen.',
    categorie: 'leven', machtigingen: [], prijsCenten: PRIJS }, over || {});
  delete m._extra;   // dit is bundelwerk, geen manifestveld
  return m;
};

async function publiceer(over) {
  const r = await api('/api/appstore/uitgever/inzenden', { manifest: manifest(over), bestanden: bundel(over && over._extra) }, sup);
  assert.equal(r.status, 200, JSON.stringify(r.body.bevindingen || r.body.fouten || r.body.error || ''));
  const b = await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  return r.body.versie;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  /* Een DEMO-sessie als koper, net als test/pay.test.js doet. Dat is geen
     omweg om een poort heen: een echt account moet voor RTG Pay eenmalig zijn
     paspoort laten zien (kern/onboarding: payGate), en die poort geldt hier ook
     -- toets 9 controleert dat. Een demosessie heeft geen account en dus ook
     geen paspoortplicht. */
  const d = await api('/api/login', { tier: 'rtg' });
  lid = d.body.token;
  lidCode = (await api('/api/pay/overzicht', {}, lid)).body.codenaam;
  assert.ok(lid && lidCode, 'een lid met een wallet');
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  assert.ok(office && tech && sup, 'kantoor, eigenaar en uitgever ingelogd');
  assert.equal((await api('/api/techniek/tenant', { org: ORG, naam: 'Geld Uitgeverij' }, tech)).status, 200);
  assert.equal((await api('/api/techniek/tenant/bind', { org: ORG, soort: 'zaak', code: 'KIKUNOI' }, tech)).status, 200);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Geld Uitgeverij', contact: 'dev@geld.nl' }, sup);
  assert.equal((await api('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'toegelaten', door: 'Sam van RTG' }, office)).status, 200);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. de prijs staat in het manifest en gaat dus door de keuring', async () => {
  const raar = await api('/api/appstore/uitgever/inzenden', { manifest: manifest({ prijsCenten: 20 }), bestanden: bundel() }, sup);
  assert.equal(raar.status, 400);
  assert.match(raar.body.fouten[0].wat, /50 cent/);
  const groot = await api('/api/appstore/uitgever/inzenden', { manifest: manifest({ prijsCenten: 99999 }), bestanden: bundel() }, sup);
  assert.equal(groot.status, 400);
  const v = await publiceer();
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.items[0].prijsCenten, PRIJS,
    'wat de app kost staat op de kaart, voordat een lid iets doet');
  assert.equal(v.versie, '1.0.0');
});

test('2. zonder land geen bon: de btw wordt nooit geraden', async () => {
  const b = await api('/api/appstore/bon', { sleutel: 'derden-betaald' }, lid);
  assert.equal(b.status, 200);
  assert.equal(b.body.landNodig, true, 'hij vraagt het, hij verzint het niet');
  assert.ok(b.body.landen.length > 50, 'en geeft de lijst waaruit te kiezen valt');
  assert.match(b.body.waarom, /land waar jij woont/);
  assert.equal((await api('/api/appstore/koop', { sleutel: 'derden-betaald' }, lid)).status, 400, 'kopen zonder land kan niet');

  /* De keuzelijst is los op te vragen, want het scherm heeft hem ook nodig als
     het lid op "ander land" drukt. Hij komt uit dezelfde landentabel als het
     tarief: er kan dus geen land in staan waarvoor we geen tarief kennen. */
  const l = await api('/api/appstore/landen', {}, lid);
  assert.equal(l.status, 200);
  assert.ok(l.body.landen.some(x => x.code === 'NL' && x.naam === 'Nederland'));
  for (const x of l.body.landen.slice(0, 25)) {
    assert.equal((await api('/api/appstore/bon', { sleutel: 'derden-betaald', land: x.code }, lid)).body.landNodig, undefined,
      'elk land uit de lijst levert een bon: ' + x.code);
  }
});

test('3. de bon rekent EEN keer, en het scherm rekent niet mee', async () => {
  const b = await api('/api/appstore/bon', { sleutel: 'derden-betaald', land: 'NL' }, lid);
  assert.equal(b.status, 200);
  const eigen = splitsBruto(PRIJS, 'NL');
  assert.equal(b.body.brutoCenten, PRIJS);
  assert.equal(b.body.btwCenten, eigen.btwCenten, 'de btw komt uit kern/fiscaal en nergens anders vandaan');
  assert.equal(b.body.nettoCenten, eigen.nettoCenten);
  assert.equal(b.body.btwCenten + b.body.nettoCenten, b.body.brutoCenten, 'er verdwijnt geen cent');
  assert.equal(b.body.afdrachtProcent, 0, 'RTG rekent 0% tot de eigenaar iets anders besluit');
  assert.equal(b.body.uitgeverCenten, eigen.nettoCenten);
  /* Een ander land geeft een ander tarief, en dat is precies waarom het land
     van het LID telt en niet dat van de uitgever. */
  const de = await api('/api/appstore/bon', { sleutel: 'derden-betaald', land: 'DE' }, lid);
  assert.equal(de.body.btwProcent, 19);
  assert.notEqual(de.body.btwCenten, b.body.btwCenten);
});

test('4. een betaalde app gaat pas op het startscherm als hij is gekocht', async () => {
  const i = await api('/api/appstore/installeer', { sleutel: 'derden-betaald', machtigingen: [] }, lid);
  assert.equal(i.status, 402, 'niet verboden, maar onbetaald');
  assert.equal(i.body.moetKopen, true);
  assert.equal(i.body.prijsCenten, PRIJS);
  assert.equal((await api('/api/appstore/open', { sleutel: 'derden-betaald' }, lid)).status, 403);
});

test('5. kopen: het lid betaalt, de btw en de afdracht gaan er meteen af', async () => {
  await api('/api/pay/oplaad', { centen: 5000, idem: 'geld-oplaad-1' }, lid);
  const voor = (await api('/api/pay/overzicht', {}, lid)).body.saldo;
  const partnerVoor = (await api('/api/supplier/pay/overzicht', {}, sup)).body.saldo;

  const k = await api('/api/appstore/koop', { sleutel: 'derden-betaald', land: 'NL', idem: 'koop-1' }, lid);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  const bon = k.body.bon;
  assert.equal(bon.brutoCenten, PRIJS);
  assert.equal(bon.land, 'NL');
  assert.ok(bon.boekingId, 'er staat een boeking tegenover');

  assert.equal((await api('/api/pay/overzicht', {}, lid)).body.saldo, voor - PRIJS, 'het lid betaalde precies de prijs');
  const partnerNa = (await api('/api/supplier/pay/overzicht', {}, sup)).body.saldo;
  assert.equal(partnerNa - partnerVoor, bon.uitgeverCenten,
    'de uitgever houdt netto over: bruto min btw min afdracht, en dat staat als losse regels in zijn eigen boekingen');

  // twee keer op de knop is een keer betalen
  const nog = await api('/api/appstore/koop', { sleutel: 'derden-betaald', land: 'NL', idem: 'koop-1' }, lid);
  assert.equal(nog.status, 200);
  assert.equal((await api('/api/pay/overzicht', {}, lid)).body.saldo, voor - PRIJS, 'en boekt nooit dubbel');

  // en nu mag hij wel op het startscherm
  assert.equal((await api('/api/appstore/installeer', { sleutel: 'derden-betaald', machtigingen: [] }, lid)).status, 200);
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.apps[0].gekocht, true);

  /* De sluitcontrole van RTG Pay: de som van ALLE saldi is exact nul. Dat is de
     kern van elk betaalbedrijf, en een verkoop met inhoudingen is precies het
     soort boeking waarmee je hem kunt breken -- drie regels waar er een had
     moeten staan. Daarom hier hard nagevraagd en niet vriendelijk. */
  const g = await fetch(base + '/api/pay/gezond').then(async r => ({ status: r.status, body: await r.json() }));
  assert.equal(g.status, 200);
  assert.equal(g.body.klopt, true, 'de som van alle saldi is nog steeds exact nul');
});

test('6. de afdracht werkt vooruit; een geschreven bon wordt nooit herrekend', async () => {
  const eerste = (await api('/api/appstore/bonnen', {}, lid)).body.bonnen[0];
  assert.equal(eerste.afdrachtProcent, 0);

  assert.equal((await api('/api/appstore/kantoor/afdracht', { procent: 15 }, office)).status, 400, 'zonder naam en reden gaat het niet');
  const z = await api('/api/appstore/kantoor/afdracht', { procent: 15, reden: 'toets: RTG gaat een deel inhouden', door: 'Sam van RTG' }, office);
  assert.equal(z.status, 200);
  assert.equal(z.body.afdracht.procent, 15);
  assert.match(z.body.let, /niet herrekend/);
  assert.equal((await api('/api/appstore/kantoor/afdracht', { procent: 99, reden: 'te veel', door: 'Sam' }, office)).status, 400, 'er zit een bovengrens op');

  assert.equal((await api('/api/appstore/bonnen', {}, lid)).body.bonnen[0].afdrachtProcent, 0,
    'de bon van gisteren houdt het percentage van gisteren');
  const nieuw = await api('/api/appstore/bon', { sleutel: 'derden-betaald', land: 'NL' }, lid);
  assert.equal(nieuw.body.afdrachtProcent, 15, 'een nieuwe bon rekent met het nieuwe percentage');
  assert.ok(nieuw.body.afdrachtCenten > 0);
  assert.equal(nieuw.body.btwCenten + nieuw.body.afdrachtCenten + nieuw.body.uitgeverCenten, nieuw.body.brutoCenten,
    'bruto is precies btw plus afdracht plus wat de uitgever krijgt');
});

test('7. de uitgever ziet aantallen en bedragen, nooit wie', async () => {
  const o = await api('/api/appstore/uitgever/omzet', {}, sup);
  assert.equal(o.status, 200);
  assert.equal(o.body.aantal, 1);
  assert.equal(o.body.brutoCenten, PRIJS);
  const plat = JSON.stringify(o.body);
  assert.ok(!plat.includes(lidCode), 'de codenaam van de koper staat er niet in -- een codenaam plus een tijdstip is een spoor');
  assert.equal(o.body.perApp[0].sleutel, 'derden-betaald');
});

test('8. intrekken laat een RECHT achter, geen automatische terugboeking', async () => {
  const partnerVoor = (await api('/api/supplier/pay/overzicht', {}, sup)).body.saldo;
  const t = await api('/api/appstore/kantoor/intrekken', { sleutel: 'derden-betaald', reden: 'toets', door: 'Sam van RTG' }, office);
  assert.equal(t.status, 200);
  assert.equal(t.body.teruggaverechten, 1, 'wie betaalde, krijgt een recht');
  assert.equal((await api('/api/supplier/pay/overzicht', {}, sup)).body.saldo, partnerVoor,
    'en er is nog niets teruggeboekt: grens 5 blijft hard, het geld regelt een mens');
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.apps.length, 0, 'de app is weg, ook bij wie betaalde');

  const lijst = await api('/api/appstore/kantoor/teruggaven', {}, office);
  assert.equal(lijst.body.open.length, 1);
  const recht = lijst.body.open[0];
  assert.equal(recht.centen, PRIJS);

  assert.equal((await api('/api/appstore/kantoor/teruggave', { id: recht.id, besluit: 'terugbetaald' }, office)).status, 400,
    'ook een teruggave draagt een naam');
  const saldoVoor = (await api('/api/pay/overzicht', {}, lid)).body.saldo;
  const g = await api('/api/appstore/kantoor/teruggave', { id: recht.id, besluit: 'terugbetaald', door: 'Sam van RTG' }, office);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal((await api('/api/pay/overzicht', {}, lid)).body.saldo, saldoVoor + PRIJS, 'het lid heeft zijn geld terug');
  assert.equal((await api('/api/appstore/kantoor/teruggaven', {}, office)).body.open.length, 0);
  assert.equal((await api('/api/appstore/kantoor/teruggave', { id: recht.id, besluit: 'terugbetaald', door: 'Sam' }, office)).status, 409,
    'en twee keer terugbetalen kan niet');
  const g2 = await fetch(base + '/api/pay/gezond').then(async r => ({ status: r.status, body: await r.json() }));
  assert.equal(g2.body.klopt, true, 'ook na een teruggave uit drie potjes sluit het grootboek');
});

test('9. RTG Pay-poorten gelden ook hier: een echt account laat eerst zijn paspoort zien', async () => {
  const reg = await api('/api/auth/register', { name: 'Echt Lid', email: 'echt@x.nl', phone: '0612345675',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token);
  await publiceer({ versie: '1.1.0', _extra: [{ pad: 'extra.txt', inhoud: 'v11' }] });
  const k = await api('/api/appstore/koop', { sleutel: 'derden-betaald', land: 'NL' }, reg.body.token);
  assert.equal(k.status, 403);
  assert.equal(k.body.kyc, true, 'de App Store is geen weg om de paspoortpoort van RTG Pay heen');
});
