/* STAAT ELKE FUNCTIE VAN HET PLATFORM IN DE BOARDROOM?

   De schakelkast is niet zo compleet als haar knoppen, maar zo compleet als
   haar CATALOGUS. Een route die door geen enkele functie wordt bewaakt is
   vanuit de boardroom onzichtbaar: niet uit te zetten, niet per stad te
   sluiten, en de storingswachter grijpt er nooit op in. Hij is er gewoon,
   altijd, voor iedereen.

   Dat gat groeit vanzelf. Routes schrijven is stap een; de catalogus in
   server/functies/register/ bijwerken is stap twee, en stap twee wordt
   vergeten. Toen dit werd gemeten stond 41% van de routes buiten de kast --
   niet door een besluit, maar door optelling.

   Deze toets pint de meting zelf vast (scripts/schakelbaar.js), plus de twee
   nieuwe deuren die bij deze ronde horen. De RATEL op het getal staat in
   NORM.json (routesNietSchakelbaar, richting omlaag): het gat mag kleiner
   worden en nooit groter.

   Draai los: node --experimental-sqlite --test test/schakelkast-dekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { meet, BUITEN } = require('../scripts/schakelbaar');
const functies = require('../server/functies');

test('de meting vindt echt routes, en het gat is kleiner dan de helft', () => {
  const r = meet();
  /* Een meting die niets vindt is geen schone lei maar een kapotte scanner
     (LAT.md regel 3). Zonder deze regel zou een veranderde routevorm netjes
     "nul ongedekt" melden en zou de ratel voorgoed tevreden zijn. */
  assert.ok(r.totaal > 1500, 'de scanner vindt de routes (' + r.totaal + ')');
  assert.ok(r.gedekt.length > 1500, 'het merendeel staat in de kast (' + r.gedekt.length + ')');
  assert.ok(r.ongedekt.length < r.gedekt.length, 'er staat meer in de kast dan erbuiten');
});

test('de bestuurslaag staat er met reden buiten, en die reden is opgeschreven', () => {
  const r = meet();
  assert.ok(r.bestuur.length > 0, 'de bestuurslaag is herkend');
  for (const [pad, reden] of BUITEN)
    assert.ok(reden && reden.length > 20, pad + ' draagt een echte reden, geen woord');
  /* Het techniekbord en de kast zelf mogen NOOIT achter een schakelaar: dat is
     een deur met het slot aan de binnenkant. */
  assert.equal(functies.functieVoorPad('/api/techniek/functie'), null, 'het techniekbord blijft buiten de kast');
  assert.equal(functies.functieVoorPad('/api/boardroom/zet'), null, 'de schakelkast schakelt zichzelf niet uit');
});

test('de grote domeinen staan nu wel in de kast', () => {
  /* Deze stonden er op 2 augustus 2026 alle acht buiten; ze zijn de reden dat
     cat-domeinen.js bestaat. Verdwijnt er hier een uit de catalogus, dan is dat
     een domein dat weer onbestuurbaar is geworden. */
  for (const pad of ['/api/overheid/aangifte', '/api/bank/rekening', '/api/gemeente/melding',
    '/api/genootschap/kring', '/api/sport/team', '/api/muziek/lied', '/api/mall/land', '/api/thuis/detail']) {
    const f = functies.functieVoorPad(pad);
    assert.ok(f, pad + ' hoort onder een schakelbare functie te vallen');
  }
});

test('elke functie in de catalogus draagt alles wat de kast van haar vraagt', () => {
  for (const f of functies.FUNCTIES) {
    assert.ok(f.id && f.naam && f.categorie, 'elke functie heeft id, naam en categorie: ' + f.id);
    assert.ok(Array.isArray(f.paden) && f.paden.length, f.id + ' bewaakt minstens een pad');
    assert.ok(Array.isArray(f.doelgroepen) && f.doelgroepen.length, f.id + ' noemt zijn doelgroepen');
    for (const dg of f.doelgroepen)
      assert.ok(functies.DOELGROEP_IDS.includes(dg), f.id + ' noemt een bestaande doelgroep, niet ' + dg);
    assert.ok(f.uitleg && f.uitleg.length > 15, f.id + ' legt uit wat hij is (de boardroom toont die zin)');
  }
});

test('elke functie komt ook ECHT op het bord: geen enkele valt uit de groepering', () => {
  /* De val die dit vangt is een keer dichtgeklapt: het bord groepeert per
     categorie en laat stil vallen wat in geen groep past. Er stonden 91
     functies in de kast en 56 op het bord. Geen fout, geen melding,
     vijfendertig schakelaars die niemand zag. Sindsdien faalt
     register/index.js bij het opstarten op een onbekende categorie -- en deze
     toets bewaakt de uitkomst in plaats van het mechanisme. */
  const opBord = functies.catalogus({}).reduce((n, g) => n + g.functies.length, 0);
  assert.equal(opBord, functies.FUNCTIES.length,
    'alles wat in de kast zit hoort ook op het bord te staan (' + opBord + ' van ' + functies.FUNCTIES.length + ')');
});

test('de nieuwe deuren van deze ronde bestaan en staan achter hun poort', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schakelkast-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: 'kast@x.nl' } });
  try {
    const post = (pad, body, tok) => fetch(srv.base + pad, {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    // zonder inlog komt niemand bij het bewaarverzoek of de fijne schakelaar
    assert.ok([401, 403].includes((await post('/api/office/bewaarverzoek', { userId: 1, reden: 'zomaar even' })).status),
      'het bewaarverzoek zit achter de kantoorpoort');
    assert.ok([401, 403].includes((await post('/api/office/boardroom/schakel-fijn', { functie: 'salon', as: 'plaats', sleutel: 'Zaandam', aan: false })).status),
      'de fijne schakelaar zit achter de boardroomdeur');

    // met de eigenaar erin: een verzoek zonder reden wordt geweigerd, met reden niet
    const owner = (await post('/api/techniek/inloggen', { login: 'kast@x.nl', wachtwoord: 'Imran' })).body.token;
    assert.ok(owner, 'de eigenaar logt in');
    const zonder = await post('/api/office/bewaarverzoek', { userId: 1, reden: 'x' }, owner);
    assert.equal(zonder.status, 400, 'een verzoek zonder echte reden wordt geweigerd');
    assert.match(String(zonder.body.error || ''), /reden|waarom/i, 'en zegt waarom');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
