/* ============================================================================
   DE EIGEN WEBSITE VAN EEN LID -- 5 endpoints van de Website-maker.

   Deze vijf wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   site/haal, site/publiceer, site/offline, site/fotos en site/foto-weg. De
   maker zelf (bewaar, mijn) was wel beproefd; de kant waar iets NAAR BUITEN
   gaat niet. Dat is de verkeerde helft om onbeproefd te laten.

   WAT ER OP HET SPEL STAAT

   Publiceren is de enige knop in dit huis waarmee een lid iets zichtbaar maakt
   voor alle andere leden. Drie dingen moeten daarom vastliggen:

   - EEN ADRES IS VAN EEN. Zou een tweede site hetzelfde adres kunnen pakken,
     dan bepaalt de volgorde van opslaan wie er op naam.rtg staat -- en dan is
     het adres van iemand af te pakken. Ook een site die OFFLINE staat houdt
     zijn adres: je raakt het niet kwijt door je site even dicht te zetten.
   - OFFLINE IS ECHT OFFLINE. Niet "uit de gids maar nog te openen als je het
     adres weet". Dat is het verschil tussen een knop en een gordijn.
   - EEN SITE IS VAN ZIJN MAKER. Met het id van andermans site kun je hem niet
     openen, publiceren, offline halen of verwijderen.

   WAT HIER BEWUST NIET GETOETST WORDT: of een sitebezoeker script kan
   uitvoeren. Dat kan namelijk op twee plekken misgaan en de toets hoort te
   zeggen welke. schoon() haalt < en > uit alles wat wordt opgeslagen -- dat
   staat hieronder in toets 5. Dat de browser zelf alles met textContent
   tekent en nooit met innerHTML is een eigenschap van het scherm, en die
   hoort in een schermtoets thuis, niet hier.

   Draai los: node --test test/eigen-website.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, buur;
let siteId = null, buurSiteId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-website-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let n = 0;
async function registreer(naam) {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', { name: naam, email: u + '@voorbeeld.test',
    password: 'sitegeheim12', geboortedatum: '1991-05-05', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  return r.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '0' } });
  base = srv.base;
  lid = await registreer('Site Maker');
  buur = await registreer('Buur Maker');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een site ophalen kan alleen door zijn maker', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Atelier Nora',
    blokken: [{ type: 'kop', tekst: 'Welkom' }, { type: 'tekst', tekst: 'Handwerk uit Ibiza.' }] } }, lid);
  assert.equal(mk.status, 200);
  siteId = mk.body.design ? mk.body.design.id : mk.body.id;
  assert.ok(siteId, 'de site heeft een id');

  const mijn = await api('/api/site/haal', { id: siteId }, lid);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.design.titel, 'Atelier Nora');
  assert.equal(mijn.body.design.blokken.length, 2);

  /* 404 en niet 403: buiten je eigen sites bestaat een site-id hier niet.
     Zou het 403 zijn, dan verraadt het antwoord dat er iets op dat id staat. */
  assert.equal((await api('/api/site/haal', { id: siteId }, buur)).status, 404, 'de buurman kent dit id niet');
  assert.equal((await api('/api/site/haal', { id: 'bestaatniet' }, lid)).status, 404);
});

test('2. publiceren: het adres wordt genormaliseerd en moet iets voorstellen', async () => {
  assert.equal((await api('/api/site/publiceer', { id: siteId, adres: 'a' }, lid)).status, 400, 'een teken is geen adres');
  assert.equal((await api('/api/site/publiceer', { id: 'bestaatniet', adres: 'ergens' }, lid)).status, 404);

  const p = await api('/api/site/publiceer', { id: siteId, adres: 'rtg://Atelier Nora' }, lid);
  assert.equal(p.status, 200);
  assert.equal(p.body.adres, 'atelier-nora', 'rtg://, hoofdletters en spaties worden een net adres');
  assert.equal(p.body.online, true);

  // en het staat nu echt op het RTG-web, voor elk ingelogd lid
  const open = await api('/api/browser/open', { adres: 'atelier-nora' }, buur);
  assert.equal(open.status, 200);
  assert.equal(open.body.site.titel, 'Atelier Nora');
  assert.ok((await api('/api/browser/gids', {}, buur)).body.lijst.some(x => x.adres === 'atelier-nora'),
    'en hij staat in de gids');
  // "atelier-nora.rtg" en "rtg://atelier-nora" wijzen naar dezelfde site
  assert.equal((await api('/api/browser/open', { adres: 'atelier-nora.rtg' }, buur)).status, 200);
});

test('3. een adres is van een, ook als die site offline staat', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Buurhuis' } }, buur);
  buurSiteId = mk.body.design ? mk.body.design.id : mk.body.id;
  assert.equal((await api('/api/site/publiceer', { id: buurSiteId, adres: 'atelier-nora' }, buur)).status, 409,
    'het adres van een ander is bezet');

  const uit = await api('/api/site/offline', { id: siteId }, lid);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.online, false);

  /* DIT is de bewering die ertoe doet. Een adres dat vrijkomt zodra je je site
     even dichtzet, is een adres dat je kunt kwijtraken door een middag te
     verbouwen. */
  assert.equal((await api('/api/site/publiceer', { id: buurSiteId, adres: 'atelier-nora' }, buur)).status, 409,
    'offline betekent niet dat je adres vrijkomt');

  // offline is echt offline: niet uit de gids maar wel te openen als je het adres kent
  assert.equal((await api('/api/browser/open', { adres: 'atelier-nora' }, buur)).status, 404,
    'wie het adres kent komt er ook niet meer in');
  assert.ok(!(await api('/api/browser/gids', {}, buur)).body.lijst.some(x => x.adres === 'atelier-nora'),
    'en hij staat niet meer in de gids');

  // weer aanzetten zonder adres mee te geven houdt hetzelfde adres
  const terug = await api('/api/site/publiceer', { id: siteId }, lid);
  assert.equal(terug.body.adres, 'atelier-nora', 'het oude adres komt gewoon terug');
  assert.equal((await api('/api/browser/open', { adres: 'atelier-nora' }, buur)).status, 200);
});

test('4. offline en verwijderen zijn ook van de maker', async () => {
  assert.equal((await api('/api/site/offline', { id: siteId }, buur)).status, 404,
    'de buurman haalt jouw site niet offline');
  assert.equal((await api('/api/site/publiceer', { id: siteId, adres: 'gekaapt' }, buur)).status, 404,
    'en verhuist hem al helemaal niet');

  /* verwijder() filtert op id EN eigenaar, dus een poging van de buurman raakt
     niets. Hij krijgt wel 200: er valt voor hem niets te verwijderen en dat is
     geen fout. Wat telt is dat de site er daarna nog staat. */
  await api('/api/site/verwijder', { id: siteId }, buur);
  assert.equal((await api('/api/site/haal', { id: siteId }, lid)).status, 200,
    'de site van het lid staat er nog gewoon');
});

test('5. wat je in een blok typt wordt geschoond, niet gerenderd', async () => {
  /* schoon() haalt < en > uit alles. Dat is de eerste van twee lagen: de
     tweede is dat de browser met textContent tekent. Hier rekenen we de
     opslagkant af -- wat er niet in komt, kan er nooit meer uit. */
  const vies = '<script>alert(1)</script> en <img src=x onerror=1>';
  const mk = await api('/api/site/bewaar', { design: { id: siteId, titel: vies,
    blokken: [{ type: 'tekst', tekst: vies }, { type: 'citaat', tekst: vies, bron: vies }] } }, lid);
  assert.equal(mk.status, 200);

  const d = (await api('/api/site/haal', { id: siteId }, lid)).body.design;
  const alles = JSON.stringify(d);
  assert.ok(!alles.includes('<') && !alles.includes('>'),
    'nergens in de opgeslagen site staat nog een punthaak: ' + alles.slice(0, 200));
  assert.ok(d.titel.includes('alert(1)'), 'de tekst zelf blijft wel staan, alleen de haken zijn eraf');

  // een onbekend bloktype wordt gewone tekst, geen onbekend ding in de opslag
  const raar = await api('/api/site/bewaar', { design: { id: siteId, titel: 'Atelier Nora',
    blokken: [{ type: 'iframe', tekst: 'hallo' }] } }, lid);
  assert.equal(raar.body.design.blokken[0].type, 'tekst', 'een type dat we niet kennen wordt tekst');
});

test('6. de fotobibliotheek is per lid, en neemt alleen eigen media aan', async () => {
  const leeg = await api('/api/site/fotos', {}, lid);
  assert.equal(leeg.status, 200);
  assert.ok(Array.isArray(leeg.body.fotos), 'er komt een lijst terug, ook als hij leeg is');
  assert.equal(leeg.body.fotos.length, 0);

  /* Uploaden loopt langs de Ontsmetter en de mediastore; wat er in de
     bibliotheek belandt is alleen een /media-verwijzing. Een 1x1 png is klein
     genoeg om echt door die keten heen te gaan. */
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await api('/api/site/foto', { dataUrl: png }, lid);
  assert.equal(up.status, 200, 'de foto is opgeslagen: ' + JSON.stringify(up.body));
  assert.match(up.body.url, /^\/media\//, 'wat we bewaren is een eigen media-verwijzing');

  assert.equal((await api('/api/site/foto', { dataUrl: 'https://ergens.example/foto.jpg' }, lid)).status, 400,
    'een verwijzing naar een vreemde server is geen foto');
  assert.equal((await api('/api/site/foto', { dataUrl: 'data:text/html;base64,PGh0bWw+' }, lid)).status, 400,
    'en html is geen afbeelding');

  /* De vondst van dit bestand. De deur nam gif aan, de kluis niet: het bestand
     kwam door de vormcontrole en door de Ontsmetter heen om daarna te stranden
     op "De foto kon niet worden opgeslagen" -- een onbegrijpelijke fout voor
     iets wat de app zelf zei aan te nemen. Nu weigert de deur hem meteen, met
     een zin die klopt. */
  const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const g = await api('/api/site/foto', { dataUrl: gif }, lid);
  assert.equal(g.status, 400, 'gif gaat niet in de kluis, dus de deur belooft hem ook niet');
  assert.match(g.body.error, /jpg, png of webp/, 'en zegt precies wat er wel in mag: ' + g.body.error);

  assert.equal((await api('/api/site/fotos', {}, lid)).body.fotos.length, 1);
  assert.equal((await api('/api/site/fotos', {}, buur)).body.fotos.length, 0,
    'de bibliotheek van de buurman blijft leeg: dit is per lid');

  const weg = await api('/api/site/foto-weg', { url: up.body.url }, lid);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.fotos.length, 0, 'en een foto gaat er weer af');
});
