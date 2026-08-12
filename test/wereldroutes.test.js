/* DE DRIE SAMENHANGLAGEN OVER HUN EIGEN ROUTE (PLATFORM.md, het wereldpatroon).

   De lagen zelf staan los getoetst -- test/socialewereld.test.js,
   test/kantoorwereld.test.js en test/reiswereld.test.js roepen de kern
   rechtstreeks aan met een verzonnen kern eromheen. Precies daardoor stond geen
   van de drie ROUTES in enige toets: /api/sociaal/wereld, /api/kantoor/wereld
   en /api/reis/wereld konden alle drie stilvallen zonder dat er iets rood werd.

   Wat hier bestaat en op kernniveau niet kan bestaan:

     1. DE DRIE SPREKEN DEZELFDE TAAL. Dat is de belofte van het wereldpatroon en
        geen toeval: het Command Canvas tekent laag 0 en laag 1 uit dezelfde
        velden op alle drie de werelden (CANVAS.md). Wijkt er een af, dan breekt
        een scherm dat op de andere twee gebouwd is -- en dat merk je pas op het
        scherm zelf. Deze toets vergelijkt ze daarom NAAST ELKAAR en niet elk
        apart; dat laatste zou drie keer hetzelfde beweren zonder ooit vast te
        stellen dat het ook hetzelfde IS.
     2. EEN LEGE WERELD IS NIET STIL. Een vers lid heeft geen reizen en geen
        vergaderingen. Dan hoort er nul te staan met `stil: []` -- en niet een
        storing die eruitziet als rust. Dat verschil is de reden dat `stil`
        uberhaupt bestaat.
     3. ZE LEZEN ALLEEN. Geen van de drie heeft een tegenhanger die iets
        opslaat; boeken en wijzigen blijft in de app die het echte werk doet.

   Draai los: node --experimental-sqlite --test test/wereldroutes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;

function post(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* De drie routes met de naam van hun rijenveld. Dat veld heet met opzet niet
   overal hetzelfde -- `komend` bij Reizen, `regels` bij de andere twee -- want
   een reis is geen regel op een lijst. De rest van de vorm is wel gelijk, en
   dat is precies wat hieronder wordt nagemeten. */
const WERELDEN = [
  { naam: 'sociaal', pad: '/api/sociaal/wereld', rijen: 'regels' },
  { naam: 'kantoor', pad: '/api/kantoor/wereld', rijen: 'regels' },
  { naam: 'reizen', pad: '/api/reis/wereld', rijen: 'komend' }
];

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereldroutes-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const t = Date.now();
  const reg = await post('/api/auth/register', { name: 'Wereld Lid', email: 'wr' + t + '@e.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1988-04-04', tier: 'rtg' });
  assert.ok(reg.body.token, 'registreren hoort een token te geven');
  lid = reg.body.token;
});
test.after(() => stop(srv));

/* DE MUTATIE: laat een van de drie kernlagen `stand` weglaten uit zijn antwoord
   (of noem het veld anders). Deze toets zakt dan op die wereld met naam. */
test('1. de drie werelden spreken over hun route dezelfde taal', async () => {
  const uit = {};
  for (const w of WERELDEN) {
    const r = await post(w.pad, {}, lid);
    assert.equal(r.status, 200, w.naam + ': ' + JSON.stringify(r.body).slice(0, 200));
    uit[w.naam] = r.body;
  }

  for (const w of WERELDEN) {
    const d = uit[w.naam];
    assert.equal(d.ok, true, w.naam + ' hoort ok te melden');
    assert.ok(Array.isArray(d[w.rijen]), w.naam + ' levert zijn rijen als lijst (' + w.rijen + ')');
    assert.ok(Array.isArray(d.stil), w.naam + ' zegt WELKE bron er niet gemeten is');
    assert.ok(Array.isArray(d.bronnen) && d.bronnen.length,
      w.naam + ' noemt zijn bronnen -- een beeld met een weggevallen bron ziet er compleet uit');
    assert.ok(d.telling && typeof d.telling === 'object', w.naam + ' telt wat er staat');

    /* LAAG 0 VAN HET CANVAS: het oordeel in EEN woord, op de server berekend en
       niet op het scherm. Zou het scherm het afleiden, dan staat de regel
       wanneer iets 'Operationeel' heet op acht plekken (LAT.md regel 4). */
    assert.ok(d.stand && typeof d.stand.niveau === 'string' && d.stand.niveau,
      w.naam + ' draagt zijn stand, met een niveau');
    assert.equal(typeof d.stand.woord, 'string', w.naam + ': de stand heeft een woord');
  }

  /* En dan de vergelijking zelf: dezelfde sleutels in de stand, bij alle drie.
     Zonder deze bewering toetst het bovenstaande drie keer los hetzelfde, en
     kan een wereld alsnog uit de pas lopen. */
  const sleutels = (n) => Object.keys(uit[n].stand).sort().join(',');
  assert.equal(sleutels('kantoor'), sleutels('sociaal'), 'kantoor en sociaal dragen dezelfde stand');
  assert.equal(sleutels('reizen'), sleutels('sociaal'), 'en reizen ook');
});

/* DE MUTATIE: laat een bron in een van de lagen bij een leeg resultaat zijn naam
   in `stil` zetten. Deze toets zakt dan -- en dat is het verschil dat ertoe
   doet: leeg is een antwoord, stil is een storing. */
test('2. een vers lid krijgt drie lege werelden, en geen enkele storing', async () => {
  for (const w of WERELDEN) {
    const d = (await post(w.pad, {}, lid)).body;
    assert.equal(d[w.rijen].length, 0, w.naam + ': een vers lid heeft hier nog niets');
    assert.deepEqual(d.stil, [], w.naam + ': leeg is een antwoord, stil zou een storing zijn');
  }
});

test('3. ze lezen alleen, en zonder inlog komt niemand erin', async () => {
  for (const w of WERELDEN) {
    const zonder = await post(w.pad, {});
    assert.ok(zonder.status === 401 || zonder.status === 403,
      w.naam + ' hoort achter de inlog te staan');
  }

  /* Twee keer dezelfde vraag geeft hetzelfde antwoord: deze routes veranderen
     niets, ook niet aan zichzelf. Een samenhanglaag die bij het lezen iets
     bijwerkt, is geen laag maar een tweede administratie (PLATFORM.md). */
  for (const w of WERELDEN) {
    const een = (await post(w.pad, {}, lid)).body;
    const twee = (await post(w.pad, {}, lid)).body;
    assert.deepEqual(twee[w.rijen], een[w.rijen], w.naam + ': lezen verandert niets');
    assert.deepEqual(twee.telling, een.telling, w.naam + ': ook de telling niet');
  }
});
