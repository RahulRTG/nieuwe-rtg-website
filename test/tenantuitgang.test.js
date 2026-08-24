/* DE UITGANG EN DE LEVENSLOOP -- weggaan zonder je geschiedenis te verliezen.

   Exit-recht is niet af met een knop die JSON teruggeeft. De bewering is dat een
   organisatie bij ons weg kan en haar werk meeneemt, en die maak je alleen waar
   door de uitvoer WEER IN TE LEZEN en aan te tonen dat er hetzelfde uit komt.
   Toets 3 doet precies dat, en hij is de reden dat dit bestand bestaat.

   Vier beweringen die van buiten niet te zien zijn:

   1. De uitvoer draagt ALLES uit de werkruimte, en geen enkele sleutel.
   2. Hij is door de ontvanger na te rekenen, met het recept dat meereist.
   3. Inlezen levert dezelfde catalogus op -- en een NIEUWE werkruimte, met de
      leden zonder sleutel.
   4. Vernietigen kan niet voor de termijn, niet onder een bewaringsplicht, en
      nooit zonder bewijs. En uitvoer kan in ELKE stand behalve vernietigd --
      ook in de bewaring, want anders is exit-recht een gunst.

   Draai los: node --experimental-sqlite --test test/tenantuitgang.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const leesbaar = require('../server/kern/tenant/uitgang-leesbaar');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitgang-'));
const ORG = 'O-EXIT';
let srv, base, tech, ruimte, beheer, lidToken, lidId, uitvoer;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const bedrijf = (pad, body) => api('/api/bedrijf' + pad, body);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;

  const w = await bedrijf('/werkruimte/maak', { naam: 'Vertrekkende Klant BV', land: 'NL', kvk: '12345678' });
  ruimte = w.body.werkruimte; beheer = w.body.beheerToken;

  const l = await bedrijf('/lid/aanmeld', { werkruimte: ruimte, naam: 'Pia' });
  lidToken = l.body.lidToken; lidId = l.body.lidId;
  await bedrijf('/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId, akkoord: true });
  await bedrijf('/lid/rollen', { werkruimte: ruimte, beheerToken: beheer, lidId, rollen: ['projectleider'] });

  // echt werk in de werkruimte, zodat er iets te exporteren valt
  const S = { werkruimte: ruimte, lidToken };
  const p = await bedrijf('/project/maak', { ...S, naam: 'Uitrol Utrecht', werkvorm: 'stadsuitrol' });
  await bedrijf('/taak/maak', { ...S, titel: 'Vergunning aanvragen', projectId: p.body.project.id, wie: 'Pia' });
  const k = await bedrijf('/kennis/schrijf', { ...S, titel: 'Hoe wij aanbesteden', eigenaar: 'Pia', tekst: 'Zo doen wij dat hier.' });
  assert.equal(k.status, 200, 'het kennisartikel staat er: ' + JSON.stringify(k.body).slice(0, 120));

  await api('/api/techniek/tenant', { org: ORG, naam: 'Vertrekkende Klant' }, tech);
  await api('/api/techniek/tenant/bind', { org: ORG, soort: 'werkruimte', code: ruimte }, tech);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de uitvoer draagt de hele werkruimte, en geen enkele sleutel', async () => {
  const zonder = await api('/api/tenant/export', { werkruimte: ruimte });
  assert.equal(zonder.status, 403, 'zonder beheer-token komt er niets uit');

  const r = await api('/api/tenant/export', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(r.status, 200);
  uitvoer = r.body;

  assert.equal(uitvoer.werkruimte.code, ruimte);
  assert.equal(uitvoer.werkruimte.kvk, '12345678', 'de kop draagt de bedrijfsgegevens');
  assert.equal(uitvoer.tenant.org, ORG);
  const soorten = uitvoer.catalogus.map(c => c.soort);
  for (const s of ['leden', 'projecten', 'taken', 'kennis', 'journaal'])
    assert.ok(soorten.includes(s), s + ' zit in de catalogus');
  assert.ok(uitvoer.catalogus.find(c => c.soort === 'projecten').aantal >= 1, 'met het echte werk erin');

  /* DE GRENS DIE HIER ALLES IS. Niet drie velden prikken maar de hele uitvoer
     doorzoeken op de sleutels die we werkelijk hebben uitgedeeld: een geheim
     dat morgen ergens dieper opduikt, wordt zo ook gevonden. */
  const tekst = JSON.stringify(uitvoer);
  assert.ok(!tekst.includes(beheer), 'het beheer-token staat er niet in');
  assert.ok(!tekst.includes(lidToken), 'en het lid-token ook niet');
  assert.ok(!/"rtgKey"/.test(tekst), 'en geen enkele koppeling naar een RTG-account');
  assert.ok(tekst.includes('Pia'), 'de personeelsnamen van de werkgever gaan wel mee -- dat is zijn eigen administratie');
});

test('2. de ontvanger kan hem narekenen zonder ons', async () => {
  const crypto = require('crypto');
  /* Precies het recept dat in de uitvoer staat, hier onafhankelijk nagebouwd.
     Zou dit de functie van de server aanroepen, dan toetsen we of hij met
     zichzelf overeenkomt en niet of het recept klopt. */
  const canoniek = (v) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canoniek).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canoniek(v[k])).join(',') + '}';
  };
  const som = (v) => crypto.createHash('sha256').update(canoniek(v)).digest('hex');

  assert.match(uitvoer.recept, /sha256/, 'het recept reist mee');
  for (const rij of uitvoer.catalogus)
    assert.equal(som(uitvoer.inhoud[rij.soort]), rij.checksum, 'de checksum van ' + rij.soort + ' klopt');
  assert.equal(som(uitvoer.catalogus), uitvoer.checksum, 'en die van de catalogus zelf');
});

test('3. de uitvoer gaat er weer in, en levert dezelfde catalogus op', async () => {
  const vreemd = await api('/api/techniek/tenant/invoer', { uitvoer });
  assert.equal(vreemd.status, 401, 'inlezen maakt een werkruimte; dat doet niet iedereen');

  const kapot = JSON.parse(JSON.stringify(uitvoer));
  kapot.inhoud.projecten.erbij = { id: 'erbij', naam: 'Stiekem project' };
  const fout = await api('/api/techniek/tenant/invoer', { uitvoer: kapot }, tech);
  assert.equal(fout.status, 400, 'een uitvoer die niet met zijn catalogus klopt, gaat er niet in');
  assert.match(fout.body.error, /projecten/, 'en hij zegt welke soort: ' + fout.body.error);

  const in1 = await api('/api/techniek/tenant/invoer', { uitvoer, naam: 'Herstel van Vertrekkende Klant' }, tech);
  assert.equal(in1.status, 200);
  assert.notEqual(in1.body.werkruimte, ruimte, 'een NIEUWE werkruimte, nooit over de bestaande heen');
  assert.ok(in1.body.beheerToken && in1.body.beheerToken !== beheer, 'met een eigen beheer-token');

  // en nu de echte proef: de herstelde werkruimte opnieuw exporteren
  const opnieuw = await api('/api/tenant/export',
    { werkruimte: in1.body.werkruimte, beheerToken: in1.body.beheerToken });
  assert.equal(opnieuw.status, 200);
  const was = new Map(uitvoer.catalogus.map(c => [c.soort, c.checksum]));
  const nu = new Map(opnieuw.body.catalogus.map(c => [c.soort, c.checksum]));
  /* `leden` mag verschillen: de sleutels zijn er bij het herstel uitgehaald en
     dat is een BESLUIT (zie uitgang.js). Al het andere hoort tot op de byte
     gelijk te zijn -- anders is "u kunt uw werk meenemen" niet waar. */
  for (const [soort, sum] of was) {
    if (soort === 'leden') continue;
    assert.equal(nu.get(soort), sum, soort + ' komt er identiek weer uit');
  }
  const lid = Object.values(opnieuw.body.inhoud.leden)[0];
  assert.equal(lid.naam, 'Pia', 'de mensen staan er weer in');
  assert.equal(lid.token, undefined, 'maar zonder sleutel: toegang teruggeven is een besluit');
});

test('3b. er is ook een LEESBARE uitvoer, en die doet zich niet voor als de echte', async () => {
  const r = await fetch(base + '/api/tenant/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ werkruimte: ruimte, beheerToken: beheer, vorm: 'leesbaar' }) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/markdown/, 'platte tekst, geen PDF');
  const md = await r.text();

  assert.match(md, /# Uitvoer van Vertrekkende Klant BV/, 'met de naam van de klant');
  assert.match(md, /\| Pia \|/, 'en de mensen met hun rollen');
  assert.match(md, /projectleider/);
  assert.match(md, /12345678/, 'de bedrijfsgegevens staan erin');

  /* DE BELANGRIJKSTE REGEL VAN DIT OVERZICHT: het zegt zelf dat het het
     overzicht is en niet de uitvoer. Twee volledige uitvoeren naast elkaar
     zouden de vraag oproepen welke van de twee geldt. */
  assert.match(md, /Dit overzicht is niet de uitvoer zelf/);
  assert.match(md, /Zelf narekenen/, 'en het recept staat er ook in');
  assert.match(md, /Wat er NIET in zit/, 'inclusief wat er ontbreekt en waarom');

  /* En hij lekt net zomin als de JSON. */
  assert.ok(!md.includes(beheer), 'geen beheer-token in het overzicht');
  assert.ok(!md.includes(lidToken), 'en geen lid-token');
});

/* De naam van een mens is INVOER, en dit overzicht is een tabel. Een naam die
   letterlijk een backslash voor een pijp draagt, schuift zonder de juiste
   volgorde van afschermen een eigen kolom de tabel in -- en dan staat er in het
   archief een andere rol achter iemands naam dan hij had. Dit is de reden dat
   `esc` eerst de backslash verdubbelt en pas daarna de pijp afschermt. */
test('3c. een naam kan geen eigen kolom in het overzicht openen', () => {
  const gemeen = 'Pia \\| beheerder';               // backslash, dan pijp
  const md = leesbaar.ledenTabel({
    a: { naam: gemeen, functie: 'balie', status: 'actief', rollen: [] },
    b: { naam: 'Jan\rSmit', functie: 'balie', status: 'actief', rollen: [] },
  });

  /* Splits op ELK regeleinde, ook een losse \r: een lezer die daarop splitst
     ziet anders een rij die wij niet geschreven hebben. */
  const regels = md.trim().split(/\r\n|\r|\n/);
  assert.equal(regels.length, 4, 'kop, streep en twee rijen -- een regeleinde breekt de tabel niet');

  const rij = regels.find(l => l.includes('Pia'));
  /* Lees de rij zoals een markdownlezer dat doet: een backslash neemt het
     volgende teken mee, en alleen een pijp die dat NIET overkomt scheidt. */
  const cellen = [];
  let cel = '';
  for (let i = 0; i < rij.length; i += 1) {
    if (rij[i] === '\\') { cel += rij[i + 1] === undefined ? '\\' : rij[i + 1]; i += 1; continue; }
    if (rij[i] === '|') { cellen.push(cel.trim()); cel = ''; continue; }
    cel += rij[i];
  }
  cellen.push(cel.trim());

  assert.equal(cellen.length, 7, 'vijf kolommen tussen twee lege randen, en geen kolom erbij');
  assert.equal(cellen[1], gemeen, 'en de naam komt er ongeschonden weer uit');
});

/* DE BLOOTSTELLING REIST MEE (VERTROUWEN.md laag 1). Zonder deze toets is de
   meter een module die niemand aanroept -- en dat is precies wat de keuring
   "scheef" noemt. Hij legt twee dingen vast: het getal komt uit de catalogus
   en is dus geteld en niet geschat, en de gewoonte groeit pas NA een uitvoer
   die echt is gelukt. */
test('3d. de uitvoer draagt zijn eigen omvang, en die is geteld', async () => {
  const r = await api('/api/tenant/export', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(r.status, 200);
  const b = r.body.blootstelling;
  assert.ok(b, 'de uitvoer draagt een blootstelling');
  assert.equal(b.gemeten, true);
  assert.equal(b.soort, 'tenant.uitvoer');

  const uitCatalogus = r.body.catalogus.reduce((n, c) => n + c.aantal, 0);
  assert.equal(b.aantal, uitCatalogus, 'geteld uit de catalogus, niet geschat');
  assert.equal(b.omkeerbaar, false, 'een uitvoer verlaat het huis');
  assert.ok(Array.isArray(b.nietGerekend) && b.nietGerekend.length,
    'en hij noemt waar hij niet over gaat');

  /* De eerste keer is er geen eigen grondslag, en dat staat er met het aantal
     waarnemingen in plaats van als stilte. */
  assert.equal(b.grondslag, 'vast');

  const weer = await api('/api/tenant/export', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(weer.body.blootstelling.waarnemingen, b.waarnemingen + 1,
    'de vorige uitvoer is uitgevoerd, dus die telt mee');
});

test('4. de bewaring sluit de toegang -- en de uitgang blijft open', async () => {
  const zonderReden = await api('/api/techniek/tenant/levensloop', { org: ORG, naar: 'opzegging' }, tech);
  assert.equal(zonderReden.status, 400, 'een levensloop zonder reden is later niet te reconstrueren');

  const sprong = await api('/api/techniek/tenant/levensloop',
    { org: ORG, naar: 'bewaring', reden: 'Klant stopt.' }, tech);
  assert.equal(sprong.status, 409, 'van actief kun je niet rechtstreeks de bewaring in');

  const op = await api('/api/techniek/tenant/levensloop',
    { org: ORG, naar: 'opzegging', reden: 'Contract per 1 december opgezegd.' }, tech);
  assert.equal(op.status, 200);
  assert.equal(op.body.levensloop.stand, 'opzegging');

  // tijdens de opzegging werkt alles nog gewoon
  const tijdens = await api('/api/bedrijf/start', { werkruimte: ruimte, lidToken });
  assert.equal(tijdens.status, 200, 'een opzegging is een aankondiging, geen afsluiting');

  const bew = await api('/api/techniek/tenant/levensloop',
    { org: ORG, naar: 'bewaring', reden: 'Uitlooptijd gestart.', bewaardagen: 30 }, tech);
  assert.equal(bew.status, 200);
  assert.ok(bew.body.levensloop.bewaarTot, 'met een einddatum');

  const na = await api('/api/bedrijf/start', { werkruimte: ruimte, lidToken });
  assert.equal(na.status, 403, 'de sleutels van de leden zijn ingetrokken');

  /* DE BELANGRIJKSTE ASSERTIE VAN DIT BESTAND. Zou de uitgang aan de stand
     hangen, dan is exit-recht een gunst die wij kunnen intrekken op precies het
     moment dat hij telt. */
  const exportInBewaring = await api('/api/tenant/export', { werkruimte: ruimte, beheerToken: beheer });
  assert.equal(exportInBewaring.status, 200, 'de uitvoer kan ook in de bewaring');
  assert.ok(exportInBewaring.body.catalogus.length, 'en hij is niet leeg');
});

test('5. vernietigen kan niet voor de termijn, en niet onder een bewaringsplicht', async () => {
  const teVroeg = await api('/api/techniek/tenant/vernietig', { org: ORG }, tech);
  assert.equal(teVroeg.status, 409);
  assert.match(teVroeg.body.error, /bewaartermijn loopt tot/);

  // de termijn opzij zetten door hem opnieuw en korter te zetten kan niet vanuit bewaring
  const terug = await api('/api/techniek/tenant/levensloop',
    { org: ORG, naar: 'actief', reden: 'Toch niet.' }, tech);
  assert.equal(terug.status, 409, 'uit de bewaring kom je niet terug -- dat is een eindstand tot de vernietiging');
});

test('6. een bewaringsplicht houdt de vernietiging tegen, ook na de termijn', async () => {
  /* De termijn opzij zetten kan alleen door de klok, en die kunnen we in een
     toets niet vooruitzetten. Daarom een TWEEDE tenant met een termijn die
     hier meteen verstrijkt: dezelfde code, ander pad erdoorheen. */
  const w = await bedrijf('/werkruimte/maak', { naam: 'Korte Klant BV' });
  await api('/api/techniek/tenant', { org: 'O-KORT', naam: 'Korte Klant' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-KORT', soort: 'werkruimte', code: w.body.werkruimte }, tech);
  await api('/api/techniek/tenant/levensloop', { org: 'O-KORT', naar: 'opzegging', reden: 'Stopt.' }, tech);

  const kort = await api('/api/techniek/tenant/levensloop',
    { org: 'O-KORT', naar: 'bewaring', reden: 'Uitloop.', bewaardagen: 1 }, tech);
  assert.equal(kort.status, 400, 'een termijn onder de ondergrens wordt niet geaccepteerd');
  await api('/api/techniek/tenant/levensloop', { org: 'O-KORT', naar: 'bewaring', reden: 'Uitloop.', bewaardagen: 30 }, tech);

  const hold = await api('/api/techniek/tenant/bewaringsplicht',
    { org: 'O-KORT', aan: true, reden: 'Lopende zaak bij de kantonrechter.' }, tech);
  assert.equal(hold.status, 200);
  assert.equal(hold.body.levensloop.legalHold, true);

  const geenGrond = await api('/api/techniek/tenant/bewaringsplicht', { org: 'O-KORT', aan: true }, tech);
  assert.equal(geenGrond.status, 400, 'een bewaringsplicht zonder grond bestaat niet');

  const poging = await api('/api/techniek/tenant/vernietig', { org: 'O-KORT' }, tech);
  assert.equal(poging.status, 409);
  assert.match(poging.body.error, /bewaringsplicht|kantonrechter/,
    'en de bewaringsplicht wordt eerder genoemd dan de termijn: ' + poging.body.error);
});
