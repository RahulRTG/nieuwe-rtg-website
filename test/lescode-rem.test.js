/* DE REM OP HET RADEN VAN EEN LESCODE.

   De lescode IS de geloofsbrief van een les: wie hem heeft ziet leerlingnamen,
   schriften en het bord (`/les/:code`, `/bord/:code`, `/schrift/:code`). Tot
   2 september 2026 was die code 29,7 bits EN onbegrensd te raden. Het is die
   COMBINATIE die telt -- entropie maakt raden duur, een rem maakt het traag, en
   je hebt ze allebei nodig. De code is sindsdien acht tekens (39,6 bits) en
   `lesVan()` in server/foundation/onderwijs.js draagt de rem.

   WAAROM DIT EEN EIGEN BESTAND IS, EN GEEN TOETS IN foundation.test.js. Dat
   bestand start zijn server met `RTG_GEZIN_REM_UIT: '1'`, en met goede reden: het
   maakt zeventien gezinnen achter elkaar vanaf hetzelfde adres en zou anders op
   zijn eigen misbruikgrens stuklopen. Maar daarmee staat de rem daar UIT, en een
   rem die in het toetsbestand uitstaat is een rem die niemand ooit heeft zien
   werken -- precies wat de kop van server/foundation/rem.js beschrijft als de
   fout die eerder is gemaakt.

   Dus start dit bestand een server ZONDER die vlag. Dat is de hele reden van
   zijn bestaan, en het is ook de reden dat het klein blijft: alles wat hier bij
   komt, komt onder een aangezette rem te staan.

   EN DAAROM STAAN DE TWEE OPEN SCHRIJFROUTES ER OOK IN (toets 4 en 5). Het
   onderwijs van de RTFoundation heeft drie deuren zonder inlog -- de lescode
   raden, een les MAKEN en een reisaanvraag indienen -- en alle drie zijn ze
   alleen te toetsen op een server waar de rem aanstaat. Ze bij elkaar zetten is
   geen thema-drift maar de enige plek waar ze te meten zijn.

   Draai los: node --test test/lescode-rem.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-lescode-'));

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  /* GEEN RTG_GEZIN_REM_UIT. Dat is het hele punt van dit bestand. */
  ({ child, base: BASE } = await startServer({
    env: { RTG_DATA_DIR: TMP, SMTP_URL: '' },
    wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* DE VOLGORDE VAN DEZE TWEE TOETSEN IS GEDRAG EN GEEN SMAAK. De rem staat per
   ADRES, en dit bestand draait ze allebei vanaf hetzelfde adres. Zou de raadtoets
   eerst gaan, dan staat de bak dicht en zakt de tegenproef -- niet omdat er iets
   stuk is, maar omdat de rem werkt. Dus eerst bewijzen dat een goede code werkt,
   dan pas de rem laten aanslaan. */
test('DE TEGENPROEF EERST: een juiste code komt gewoon binnen', async () => {
  /* Zonder deze zou een `lesVan()` die ALTIJD weigert de raadtoets hieronder ook
     halen -- en dan is een kapotte les een geslaagde beveiliging. */
  const d = await json(await api('/les/maak', { vak: 'Rekenen', naam: 'Meester' }));
  assert.ok(d.code && d.code.length >= 8,
    'een nieuwe lescode is minstens acht tekens (nu ' + (d.code || '').length + ')');
  const goed = await api('/les/join', { code: d.code, naam: 'Sam' });
  assert.equal(goed.status, 200, 'de juiste code komt binnen');
  const daarna = await api('/les/join', { code: d.code, naam: 'Noor' });
  assert.equal(daarna.status, 200, 'en een tweede leerling ook -- goedePoging() wist de teller');
});

test('een lescode raden loopt tegen de rem', async () => {
  /* We gokken niet op een exact nummer maar tellen tot de rem aanslaat. Een
     toets die op "de eenentwintigste" staat, zakt zodra iemand het quotum
     verandert -- en dan zakt hij op een getal in plaats van op de bewering.

     Wat hij WEL hard maakt: binnen dertig pogingen moet er een rem zijn. Blijft
     die uit, dan is raden onbegrensd, en dat is precies het gat dat hier dicht
     ging. Mutatie nagetrokken: de drie remregels uit `lesVan()` weghalen laat
     deze toets vallen op deze assertie. */
  let zagRem = false, missers = 0;
  for (let i = 0; i < 30 && !zagRem; i++) {
    const r = await api('/les/join', { code: 'ZZZZZZZZ', naam: 'Raadt' });
    if (r.status === 429) zagRem = true;
    else { assert.equal(r.status, 404, 'een onbekende lescode hoort 404 te geven tot de rem aanslaat'); missers++; }
  }
  assert.ok(zagRem, 'na ' + missers + ' foute lescodes hoort de rem te hebben aangeslagen (429); ' +
    'zonder rem is een code van 39,6 bits alsnog te bestoken');

  /* EN DE PRIJS, hier expliciet vastgelegd in plaats van als verrassing. Een
     adres dat de grens raakt staat buiten -- OOK met een goede code. Dat is de
     keuze: een rem die een geslaagde gok doorlaat, remt niets, want een treffer
     levert dan gewoon een 200 op. Wie deze bewering ooit omdraait, verandert de
     beveiliging en niet de vriendelijkheid; zie de uitleg bij `lesVan()`. */
  const d = await json(await api('/les/maak', { vak: 'Taal', naam: 'Juf' }));
  const metGoedeCode = await api('/les/join', { code: d.code, naam: 'Kim' });
  assert.equal(metGoedeCode.status, 429,
    'zolang de rem staat, komt ook een JUISTE code er niet langs -- anders remt hij niets');
});

/* DERDE, EN HIJ HOORT NA DE TWEEDE. De rem zat eerst alleen op de POST-routes,
   want die riepen `lesVan()` aan en de LEESroutes (`/les/:code`, `/bord/:code`,
   `/schrift/:code`, `/opgaven/:code`, de stream) zochten de les rechtstreeks op
   in `F().lessen[...]`. Dat is de verkeerde helft om open te laten: raden loont
   juist aan de leeskant, want daar staat wat je wilt hebben.

   Deze toets maakt hard dat de leeskant DEZELFDE bak deelt: de vorige toets heeft
   hem met POST-pogingen volgemaakt, en dan hoort ook een GET tegen 429 te lopen.
   Mutatie nagetrokken: zet in les.js `const les = lesVan(req, res)` terug naar
   `F().lessen[...]` en deze toets zakt op 404 in plaats van 429 -- precies het
   gat dat op 2 september 2026 dichtging. */
test('de leesroutes delen dezelfde bak als de POST-routes', async () => {
  const r = await fetch(BASE + '/api/foundation/bord/ZZZZZZZZ');
  assert.equal(r.status, 429,
    'GET /bord/:code hoort door lesVan() te gaan; anders is de rem alleen op de schrijfkant');
});

/* ---------- de twee open SCHRIJFroutes ----------
   Deze twee staan achteraan omdat ze elk hun eigen bak vullen en die daarna
   dicht blijft; wie ze naar voren haalt, sluit zichzelf uit de rest. */

test('een les maken loopt tegen zijn eigen rem', async () => {
  /* Zonder rem groeit `F().lessen` onbegrensd: elke les blijft staan en wordt
     bij elke opslag meegeschreven. Geen exact getal in de assertie -- wel de
     bewering dat er ergens een bodem is. Mutatie nagetrokken: de twee remregels
     uit /les/maak weghalen laat deze toets vallen.

     ELKE POGING KRIJGT EEN EIGEN VAKNAAM, en dat is geen opsmuk. Deze route staat
     in lib/idemsleutels-kaleronde.js als `zelfdeVerzoek: true`: een IDENTIEK lijf
     wordt herkend als herhaling en krijgt het bewaarde antwoord terug zonder dat
     de handler draait. Veertig keer exact hetzelfde sturen maakt dus een les en
     negenendertig echo's -- geen rem in zicht, en ook geen probleem. De aanval
     die de rem moet stoppen varieert het lijf, want alleen dan komt er telkens
     een les bij. Deze toets doet dat dus ook; met een vast lijf toetste hij de
     idempotentielaag en niet de rem. */
  let zagRem = false, gemaakt = 0;
  for (let i = 0; i < 40 && !zagRem; i++) {
    const r = await api('/les/maak', { vak: 'Vul ' + i, naam: 'Vuller' });
    if (r.status === 429) zagRem = true; else { assert.equal(r.status, 200); gemaakt++; }
  }
  assert.ok(zagRem, 'na ' + gemaakt + ' nieuwe lessen vanaf een adres hoort de rem te staan');
});

test('een reisaanvraag indienen loopt tegen zijn eigen rem', async () => {
  /* De lijst is afgekapt op duizend en nieuwe aanvragen komen er VOORAAN in.
     Onbegrensd volschrijven wist dus de hulpvragen van echte gezinnen achteraan
     uit de lijst -- daarom is dit geen ongemak maar de zwaarste van de drie. */
  const lijf = i => ({ soort: 'aanvraag', naam: 'Test ' + i, contact: 'test@voorbeeld.test',
    gezin: '2 volwassenen', waarom: 'Een reden die lang genoeg is om erdoor te komen.' });
  let zagRem = false, ingediend = 0;
  for (let i = 0; i < 25 && !zagRem; i++) {
    const r = await api('/reis/aanvraag', lijf(i));
    if (r.status === 429) zagRem = true; else { assert.equal(r.status, 200); ingediend++; }
  }
  assert.ok(zagRem, 'na ' + ingediend + ' aanvragen vanaf een adres hoort de rem te staan; ' +
    'zonder rem duwt duizend nepaanvragen elke echte hulpvraag uit de lijst');
});
