/* DE GEVERIFIEERDE PERSOON ALS UITGEVER -- en de grens die eraan hangt.

   Besloten op 27 augustus 2026: een geverifieerd persoon mag publiceren, maar
   alleen GRATIS. Betaalde distributie blijft een rechtspersoon vragen.

   De verleiding bij zo'n besluit is precies een ding: de grens als etiket
   opschrijven en hem nergens afdwingen. Dan staat er in een document dat een
   persoon gratis publiceert, en zet de eerste die een prijs in zijn manifest
   zet gewoon een betaalde app in de winkel.

   Deze toets houdt vijf dingen vast:

     1. de drie poorten voor de MENS staan er echt (geverifieerd, 18+, en een
        mens van RTG laat toe);
     2. 'niet vast te stellen' is ook hier geen ja;
     3. een prijs boven nul wordt GEWEIGERD, met de reden erbij;
     4. een rechtspersoon mag wel geld vragen -- de grens is niet "niemand";
     5. de orgcode van een persoon verraadt zijn account niet.

   Draai los: node --experimental-sqlite --test test/appstore-persoon.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const U = require('../server/kern/appstore/uitgevers');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-persoon-'));
let srv, base, lid, gast, office;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Proef</title></head>'
  + '<body><h1>Proef</h1><p>Een app van een mens.</p></body></html>';
const manifest = (over) => Object.assign({
  sleutel: 'van-een-mens', naam: 'Van een mens', versie: '1.0.0', categorie: 'leven',
  uitleg: 'Een app die door een geverifieerd persoon is ingezonden, om de grens te tonen.',
  machtigingen: [] }, over || {});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/login', { tier: 'rtg' })).body.token;
  gast = (await api('/api/login', { tier: 'guest' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(lid && gast && office, 'de drie inlogs horen te lukken');
});
test.after(async () => { await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); });

test('1 - de regel voor de mens is een pure functie en niet een regel in een route', () => {
  /* Een toegangsregel die in een route woont, kan alleen worden getoetst door
     een server op te starten -- en dus wordt hij bijna nooit getoetst. */
  assert.equal(typeof U.mensMagUitgeven, 'function');
  assert.equal(U.mensMagUitgeven({ geverifieerd: true, leeftijd: 31 }).mag, true);
  assert.equal(U.mensMagUitgeven({ geverifieerd: false, leeftijd: 31 }).mag, false);
  assert.match(U.mensMagUitgeven({ geverifieerd: false, leeftijd: 31 }).error, /geverifieerde identiteit/);
  assert.equal(U.mensMagUitgeven({ geverifieerd: true, leeftijd: 17 }).mag, false);
  assert.match(U.mensMagUitgeven({ geverifieerd: true, leeftijd: 17 }).error, /vanaf 18 jaar/);
});

test('2 - een leeftijd die niet vast te stellen is, is GEEN ja', () => {
  /* Dezelfde regel als de virusscanner in de machinepoort en als de
     toegankelijkheidskeuring: een controle die niet kon draaien, opent niets. */
  for (const l of [null, undefined, '', NaN, 'oud genoeg']) {
    const r = U.mensMagUitgeven({ geverifieerd: true, leeftijd: l });
    assert.equal(r.mag, false, 'leeftijd ' + JSON.stringify(l) + ' hoort de deur dicht te houden');
    assert.match(r.error, /niet vast te stellen/);
  }
});

test('3 - een anonieme gast komt er niet in', async () => {
  const r = await api('/api/appstore/persoon/aanvraag', { naam: 'Iemand', contact: 'ik@example.com' }, gast);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /geverifieerde identiteit/);
});

test('4 - een geverifieerd lid mag aanvragen, maar publiceert nog niet', async () => {
  const r = await api('/api/appstore/persoon/aanvraag', { naam: 'Katja Kiss', contact: 'katja@example.com' }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.uitgever.status, 'aangevraagd');
  assert.equal(r.body.uitgever.soort, 'persoon', 'een lid mag weten dat er een MENS achter een app staat');

  const in1 = await api('/api/appstore/persoon/inzenden', { manifest: manifest(), bestanden: [{ pad: 'index.html', inhoud: HTML }] }, lid);
  assert.equal(in1.status, 403, 'zolang een mens van RTG niet heeft getekend, gaat er niets in');
  assert.match(in1.body.error, /ligt bij RTG/);
});

test('5 - een tweede aanvraag maakt geen tweede uitgeversplek', async () => {
  const eerste = (await api('/api/appstore/persoon', {}, lid)).body.org;
  await api('/api/appstore/persoon/aanvraag', { naam: 'Katja K.', contact: 'katja@example.com' }, lid);
  assert.equal((await api('/api/appstore/persoon', {}, lid)).body.org, eerste,
    'dezelfde mens hoort dezelfde uitgeversplek te houden');
  /* En TELLEN, niet alleen kijken wat er teruggegeven wordt. De eerste versie
     van deze toets las alleen de zichtbare org, en die blijft dezelfde zolang
     het zoeken de eerste treffer pakt -- ook als er ondertussen een tweede plek
     is bijgekomen die niemand ziet. Een verzwakking die dat deed, bleef groen. */
  const mensen = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body.uitgevers
    .filter(u => u.soort === 'persoon');
  assert.equal(mensen.length, 1, 'er hoort er precies EEN te staan, gevonden: ' + JSON.stringify(mensen.map(u => u.org)));
});

test('6 - de orgcode verraadt het account niet', async () => {
  /* publiekU.org staat in de catalogus bij elke app. Zou hij van het account
     zijn afgeleid, dan is het accountnummer van een mens publiek -- en dat is
     het codenaamontwerp omzeilen (CLAUDE.md). */
  const org = (await api('/api/appstore/persoon', {}, lid)).body.org;
  assert.ok(org, 'er hoort een orgcode te zijn');
  assert.ok(!org.includes('rtg'), 'de sessiesleutel hoort er niet in te zitten, gevonden: ' + org);
  assert.match(org, /^P-[0-9A-F]{10}$/, 'een willekeurige code en niet iets wat uit de mens is gebouwd');

  /* En de sleutel zelf hoort NERGENS naar buiten te komen. publiekU is de enige
     weg waarlangs een uitgever een scherm bereikt; wat daar niet in staat,
     bestaat voor de buitenwereld niet. */
  const publiek = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body.uitgevers
    .filter(u => u.soort === 'persoon');
  assert.equal(publiek.length, 1);
  assert.equal(publiek[0].persoonKey, undefined, 'de sessiesleutel hoort niet in het publieke beeld te staan');
  assert.ok(!JSON.stringify(publiek[0]).includes('user-'), 'en ook niet vermomd in een ander veld');
  assert.match(publiek[0].org, /^P-[0-9A-F]{10}$/);
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/appstore/uitgevers.js'), 'utf8');
  assert.ok(!/org.*=.*persoonKey|persoonKey.*\+.*org/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
    'de orgcode hoort niet uit de persoonssleutel te worden gebouwd');
});

test('7 - een mens van RTG laat toe, en daarna gaat het gratis wel', async () => {
  const org = (await api('/api/appstore/persoon', {}, lid)).body.org;
  const t = await api('/api/appstore/kantoor/uitgever', { org, besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const r = await api('/api/appstore/persoon/inzenden', { manifest: manifest(), bestanden: [{ pad: 'index.html', inhoud: HTML }] }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body.bevindingen || r.body.fouten || r.body.error));

  const toegankelijk = await api('/api/appstore/kantoor/toegankelijk',
    { versieId: r.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  assert.equal(toegankelijk.status, 200, JSON.stringify(toegankelijk.body));
  const live = await api('/api/appstore/kantoor/besluit',
    { versieId: r.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
  assert.equal(live.status, 200, JSON.stringify(live.body));

  const dossier = await api('/api/appstore/persoon/dossier', { sleutel: 'van-een-mens' }, lid);
  assert.equal(dossier.status, 200, JSON.stringify(dossier.body));
  assert.ok(dossier.body.kanaal && Array.isArray(dossier.body.kanaal.machtigingen),
    'de maker ziet ook exact de begrensde machtigingencatalogus van het klantkanaal');
  assert.ok(dossier.body.watHetMag && dossier.body.waarDeGegevensBlijven,
    'het persoonlijke dossier draagt dezelfde herleidbare inkoopinformatie als het klantdossier');
  assert.equal((await api('/api/appstore/persoon/dossier', { sleutel: 'bestaat-niet' }, lid)).status, 404,
    'een onbekende of andermans app lekt niet via het persoonlijke dossier');
  assert.equal((await api('/api/appstore/persoon/dossier', { sleutel: 'van-een-mens' }, gast)).status, 403,
    'een ongeverifieerde gast kan het uitgeversdossier niet openen');
});

test('8 - EEN PRIJS WORDT GEWEIGERD, en de reden staat erbij', async () => {
  /* Dit is de grens van 27 augustus 2026 en de kern van dit bestand. */
  const r = await api('/api/appstore/persoon/inzenden',
    { manifest: manifest({ sleutel: 'betaald-van-een-mens', prijsCenten: 499, versie: '1.0.1' }),
      bestanden: [{ pad: 'index.html', inhoud: HTML + '<!-- 2 -->' }] }, lid);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.match(r.body.error, /geverifieerd persoon/);
  assert.match(r.body.error, /rechtspersoon/, 'en de weg vooruit hoort erbij te staan');
  assert.equal((await api('/api/appstore/catalogus', {}, lid)).body.items.filter(i => i.sleutel === 'betaald-van-een-mens').length, 0);
});

test('8b - de proefkeuring kan ZONDER uitgeversplek, want anders kan niemand leren', async () => {
  /* Voor een mens die begint is dit het belangrijkste scherm dat er is: hij
     leert waar de poort staat voordat hij iets aanvraagt. Zou hij eerst een plek
     moeten hebben, dan bewaakt de rem op inzenden niet het misbruik maar het
     leren. 'Zonder plek' houdt hier op bij de identiteitspoort: een geverifieerd
     lid mag oefenen, een anonieme gast niet -- die komt er sowieso niet in
     (toets 3). */
  const r = await api('/api/appstore/persoon/proef', { manifest: manifest({ sleutel: 'proefje' }),
    bestanden: [{ pad: 'index.html', inhoud: HTML }] }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(typeof r.body.door, 'boolean', 'de proef zegt of de machinepoort dit doorlaat');
  assert.match(r.body.let, /geen goedkeuring|kijkt daarna|komt deze bundel/,
    'en zegt erbij dat de machine niets goedkeurt');

  const n = await api('/api/appstore/persoon/naslag', {}, lid);
  assert.equal(n.status, 200);
  assert.ok(Array.isArray(n.body.methodes) && n.body.methodes.length, 'het naslagwerk hoort er ook zonder plek te zijn');
});

test('8c - er is geen omzetscherm, en dat staat er MET de reden', async () => {
  /* Een lege omzetpagina zou suggereren dat er ooit iets in komt te staan.
     Wat er niet is, staat er met de reden (APPSTORE.md, TENANT.md). */
  const r = await api('/api/appstore/persoon/omzet', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.aantal, null);
  assert.match(r.body.nietGebouwd, /gratis/);
  assert.match(r.body.nietGebouwd, /rechtspersoon/);
});

test('9 - de grens staat op EEN plek', () => {
  const kern = fs.readFileSync(path.join(__dirname, '..', 'server/kern/appstore/uitgevers.js'), 'utf8');
  assert.match(kern, /function magPrijsVragen/, 'de regel hoort in de kern te staan');
  const routes = fs.readFileSync(path.join(__dirname, '..', 'server/routes/appstore/persoon.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/prijsCenten/.test(routes), 'de route hoort niets over prijzen te weten');
});

test('10 - een rechtspersoon mag wel geld vragen', () => {
  /* De grens is niet "niemand vraagt geld" maar "een MENS vraagt geen geld".
     Zonder deze toets zou een verzwakking die iedereen tegenhoudt groen blijven. */
  const staat = { uitgevers: {} };
  const laag = U({ S: () => staat, save() {}, nu: () => new Date().toISOString(), boek() {},
    eigen: (o, k) => o[k], norm: (x) => String(x || '').toUpperCase() });
  staat.uitgevers.ZAAK = { org: 'ZAAK', soort: 'rechtspersoon', status: 'toegelaten' };
  staat.uitgevers.MENS = { org: 'MENS', soort: 'persoon', status: 'toegelaten' };
  assert.equal(laag.magPrijsVragen('ZAAK').mag, true);
  assert.equal(laag.magPrijsVragen('MENS').mag, false);
  assert.equal(laag.magPrijsVragen('BESTAAT-NIET').mag, false, 'en een onbekende org is ook geen ja');
});
