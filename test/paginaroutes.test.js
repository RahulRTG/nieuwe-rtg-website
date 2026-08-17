/* DE ROUTES BUITEN /api/ -- de zeven die geen enkele meter kende.

   Draai los: node --experimental-sqlite --test test/paginaroutes.test.js

   WAAROM DIT BESTAND ER IS. De waargenomen dekkingsmeting keek tot deze ronde
   alleen naar paden die met /api/ beginnen (scripts/dekking.js deed letterlijk
   `.filter(p => p.startsWith('/api/'))`). Deze zeven routes waren daardoor niet
   ONGEDEKT -- ze bestonden niet voor het cijfer:

     GET /                     de voordeur
     GET /apps                 dezelfde homescreen
     GET /apps/bureau.html     dezelfde homescreen
     GET /apps/index.html      dezelfde homescreen
     GET /scriptbundel.js      de scriptbundel van ELKE pagina van het huis
     GET /stijlbundel.css      de stijlbundel van ELKE pagina van het huis
     GET /werken/:code         de wervingslink

   Bij de twee bundelroutes is dat het pijnlijkst. Er staan wel toetsen voor de
   middleware (test/scriptbundel.test.js en test/stijlbundel.test.js), maar die
   roepen de laag met een NAGEMAAKT verzoek aan. Of het pad ook echt aan de app
   hing -- app.get(PAD, ...) in opzet/poortwachters.js -- was nergens vastgelegd.
   Haal die regel weg en elke pagina van het huis verliest haar opmaak en al haar
   uitgestelde scripts, terwijl de suite groen blijft.

   Wat hier NIET staat: GET /media/:naam. Die heeft zijn eigen toetsen
   (test/media*.test.js) en wordt daar echt over http aangeroepen.

   DE MUTATIE (LAT.md regel 2): de vier regels van bureaublad() uit
   middleware/voordeur.js halen -> toets 1 en 2 zakken; app.get(stijlbundelPad,
   ...) uit opzet/poortwachters.js halen -> toets 3 zakt. Beide gedaan, beide
   zag ik zakken op de JUISTE toets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paginaroutes-'));

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const haal = (pad) => fetch(base + pad, { redirect: 'manual' })
  .then(async r => ({ status: r.status, type: r.headers.get('content-type') || '', tekst: await r.text() }));

/* De homescreen is te herkennen aan iets dat ALLEEN daar staat, en niet aan
   "het is html" -- dat laatste zou ook groen blijven als er een foutpagina werd
   geserveerd. Het app-main-script draagt het springboard en staat op geen enkele
   andere pagina. */
const isHomescreen = (d, waar) => {
  assert.equal(d.status, 200, waar + ' geeft 200, niet ' + d.status);
  assert.match(d.type, /text\/html/, waar + ' levert html');
  assert.match(d.tekst, /app-main/, waar + ' levert de homescreen (app-main), niet een andere pagina');
};

test('de voordeur: / is de homescreen, met een herschrijving en niet met een omleiding', async () => {
  /* Bewust geen 302: de nonce-laag moet er overheen kunnen (zie de kop van
     middleware/voordeur.js). Een omleiding zou hier dus een stille regressie
     zijn die er in een browser hetzelfde uitziet. */
  const d = await haal('/');
  assert.ok(d.status !== 301 && d.status !== 302,
    'de root herschrijft en stuurt niet door (status ' + d.status + ')');
  isHomescreen(d, 'GET /');
});

test('de drie oude bureaubladpaden komen allemaal op diezelfde homescreen uit', async () => {
  /* Er was een tweede beginscherm op /apps/index.html. Die paden blijven bestaan
     omdat er van buiten naar gelinkt kan zijn, maar ze horen THUIS te brengen.
     Zonder deze toets kan er ongemerkt weer een tweede bureaublad achter komen. */
  for (const pad of ['/apps', '/apps/', '/apps/bureau.html', '/apps/index.html']) {
    isHomescreen(await haal(pad), 'GET ' + pad);
  }
});

test('de stijlbundel hangt echt aan de app en voegt de bladen samen', async () => {
  const paden = ['/shared/rtg-ui.css', '/shared/rtg-ontwerp.css'];
  const f = Buffer.from(paden.join('\n'), 'utf8').toString('base64url');
  const d = await haal('/stijlbundel.css?f=' + f);
  assert.equal(d.status, 200, 'de bundelroute bestaat en antwoordt');
  assert.match(d.type, /text\/css/, 'en levert css');
  /* Twee bladen, en uit BEIDE iets terugzien: alleen "het is css en niet leeg"
     zou ook groen blijven als de bundel maar een van de twee inlas. */
  assert.match(d.tekst, /--rtg-/, 'de tokens uit rtg-ui.css staan erin');
  assert.match(d.tekst, /rtg-ceremonie/, 'en de rollen uit rtg-ontwerp.css ook');
  assert.ok(d.tekst.length > 2000, 'het is een bundel en geen lege regel (' + d.tekst.length + ' tekens)');

  // en een pad dat er niet mag zijn komt er niet in
  const stout = Buffer.from('/../server/server.js', 'utf8').toString('base64url');
  assert.equal((await haal('/stijlbundel.css?f=' + stout)).status, 400,
    'een pad met .. wordt geweigerd en niet stil overgeslagen');
});

test('de scriptbundel hangt echt aan de app en houdt de volgorde aan', async () => {
  const paden = ['/shared/basis.js', '/shared/cookie.js'];
  const f = Buffer.from(paden.join('\n'), 'utf8').toString('base64url');
  const d = await haal('/scriptbundel.js?f=' + f);
  assert.equal(d.status, 200, 'de bundelroute bestaat en antwoordt');
  assert.match(d.type, /javascript/, 'en levert javascript');
  assert.ok(d.tekst.length > 500, 'het is een bundel en geen lege regel (' + d.tekst.length + ' tekens)');
  /* De naam van elk deel hoort in de bundel te staan (de laag wikkelt ze in),
     en basis hoort VOOR cookie te komen: een bundel die de rij door elkaar gooit
     verandert een belofte van de pagina. */
  const a = d.tekst.indexOf('basis.js'), b = d.tekst.indexOf('cookie.js');
  assert.ok(a !== -1 && b !== -1, 'beide delen zitten in de bundel');
  assert.ok(a < b, 'en in de volgorde waarin de pagina ze vroeg');

  const stout = Buffer.from('/../server/server.js', 'utf8').toString('base64url');
  assert.equal((await haal('/scriptbundel.js?f=' + stout)).status, 400,
    'een pad met .. wordt geweigerd en niet stil overgeslagen');
});

test('de wervingslink brengt je naar de app MET zijn code, en een rare code niet', async () => {
  /* DE CODE MOET DE BROWSER BEREIKEN, en dat is de hele bewering. Deze route
     herschreef eerst intern naar /apps/app.html?werving=CODE en gaf dat aan
     next() door. Dat gaf 404 -- de statische laag zit ervoor -- en zou ook bij
     een 200 niet gewerkt hebben: bij een herschrijving blijft de browser op
     /werken/AB12CD staan en ziet de pagina de code nooit. Een toets op alleen
     "geeft 200" zou die tweede helft niet hebben gevonden. */
  const r = await fetch(base + '/werken/AB12CD', { redirect: 'manual' });
  assert.equal(r.status, 302, 'de wervingslink stuurt door (status ' + r.status + ')');
  assert.equal(r.headers.get('location'), '/apps/app.html?werving=AB12CD',
    'naar de app, met de code in de query zodat de browser hem heeft');
  // en waar hij heen stuurt, staat ook echt iets
  isHomescreen(await haal('/apps/app.html'), 'het doel van de wervingslink');

  /* Een code die niet aan de vorm voldoet valt door naar de volgende laag. Dat
     is de belangrijkste helft: zonder deze bewering zou de route ELKE /werken/*
     doorsturen, en dan is de vormcontrole erin dode code. */
  const raar = await haal('/werken/dit-is-geen-code');
  assert.equal(raar.status, 404,
    'een code die niet zes tekens is valt door naar 404, niet naar de app (' + raar.status + ')');
});
