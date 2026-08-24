/* DE ORGANISATIESTAND OP EEN ECHT SCHERM -- en vooral wat er NIET staat.

   De bewijspoort (kern/tenant/bewijs.js) maakte van elke enterprisebewering een
   object met een bron of een reden. Dat antwoord bestond en had geen scherm, en
   dan is het een JSON die niemand opent. Dit is dat scherm, en deze toets meet
   de drie dingen waarop zo'n pagina stilletjes verkeerd gaat:

   1. HIJ TOONT DE BEWERINGEN DIE NIET WAAR ZIJN. Een pagina die alleen de
      groene vinkjes laat zien, is dezelfde badgemuur als de weggehaalde
      enterprise-schil -- alleen met een betere herkomst. "Eigen domein" en
      "SLA" horen er te staan, op nee, met de reden.
   2. HIJ ZET ER GEEN CIJFER NEER DAT DE METING NIET KAN DRAGEN. De
      beschikbaarheid wordt platformbreed gemeten en niet per organisatie.
      Er hoort dus GEEN percentage op te staan, maar de zin waarom niet.
   3. HIJ VERZINT NIETS ALS HET NIET MAG. Een medewerker zonder het recht
      `werkruimte` krijgt de rechtenweigering te zien -- geen leeg scherm, geen
      uitlog, en zeker geen halve stand.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');

const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkstatus-'));

test('de tenantstand staat onder Instellingen, met de beweringen die NIET waar zijn erbij',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser;
  try {
    const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body) }).then(r => r.json());
    const bedrijf = (pad, body) => post('/api/bedrijf' + pad, body);

    const w = await bedrijf('/werkruimte/maak', { naam: 'Standhuis BV', land: 'NL' });
    const S = { werkruimte: w.werkruimte, beheerToken: w.beheerToken };
    const maakLid = async (naam, rollen) => {
      const l = await bedrijf('/lid/aanmeld', { werkruimte: w.werkruimte, naam });
      await bedrijf('/lid/besluit', Object.assign({ lidId: l.lidId, akkoord: true }, S));
      await bedrijf('/lid/rollen', Object.assign({ lidId: l.lidId, rollen }, S));
      return l;
    };
    /* Pia is directie -- de enige rol die het recht `werkruimte` draagt, en dus
       per definitie wie deze werkruimte beheert. Sam is medewerker. */
    const pia = await maakLid('Pia', ['directie']);
    const sam = await maakLid('Sam', ['medewerker']);

    const tech = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).token;
    await post('/api/techniek/tenant', { org: 'O-STAND', naam: 'Standhuis Groep', modus: 'powered' }, tech);
    await post('/api/techniek/tenant/bind', { org: 'O-STAND', soort: 'werkruimte', code: w.werkruimte }, tech);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* Een hoog venster: dit scherm heeft twee kolommen met elk vier kaarten, en
   op 720 pixels valt de onderste knop buiten beeld. Een groter venster is
   eerlijker dan de knop programmatisch aanklikken -- dan toets je of hij
   BEREIKBAAR is en niet alleen of hij bestaat. */
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1500, height: 1400 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const inloggen = async (token) => {
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtg_werk_sessie'); });
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      await page.fill('#iWerkruimte', w.werkruimte);
      await page.fill('#iToken', token);
      await page.click('#inlogGa');
      await page.waitForTimeout(1000);
      await page.click('[data-wk="settings"]');
      await page.waitForTimeout(900);
    };
    const lees = () => page.evaluate(() => {
      const t = (id) => { const el = document.getElementById(id); return el ? el.innerText.replace(/\s+/g, ' ') : ''; };
      return {
        open: !document.getElementById('vStatus').hidden,
        andereWeg: document.getElementById('vStart').hidden && document.getElementById('vPeople').hidden,
        kop: t('stKop'), let: t('stLet'), contract: t('stContract'),
        waar: t('stWaar'), nietWaar: t('stNietWaar'), sla: t('stSla'), platform: t('stPlatform'),
        alles: document.getElementById('vStatus').innerText.replace(/\s+/g, ' ')
      };
    });

    /* ---- Pia: directie ---- */
    await inloggen(pia.lidToken);
    const p = await lees();
    assert.equal(p.open, true, 'Instellingen opent de stand');
    assert.equal(p.andereWeg, true, 'en de andere weergaven gaan dicht -- geen twee schermen over elkaar');
    assert.match(p.kop, /Standhuis Groep/, 'met de naam van de organisatie');
    assert.match(p.contract, /O-STAND/);
    assert.match(p.contract, /actief/, 'de levensloop staat erbij');
    assert.match(p.contract, /Verzoeken dit uur/, 'en het verbruik');

    /* BEWERING 1. De twee die altijd op nee staan, staan er MET de reden. */
    assert.match(p.nietWaar, /Eigen domein/, 'wat niet waar is staat er: ' + p.nietWaar);
    assert.match(p.nietWaar, /geen externe hosting/, 'met de reden erbij');
    assert.match(p.nietWaar, /SLA/);
    assert.match(p.nietWaar, /Er ontbreekt nog/, 'en de SLA zegt WAT er ontbreekt');

    /* De SLA is een berekening: vier voorwaarden, en de twee die vandaag
       ontbreken staan er met naam. Een dichte deur hoort een sleutelgat te
       hebben. */
    assert.match(p.sla, /een lopend contract/);
    assert.match(p.sla, /een incidentproces met een gemeten reactietijd/);
    assert.match(p.sla, /een herstelproef/);
    assert.match(p.sla, /ticketstroom die een reactietijd meet/, 'met de reden waarom hij ontbreekt');

    /* BEWERING 2. Nergens een beschikbaarheidscijfer -- wel de zin waarom. */
    assert.ok(!/\d+[,.]\d+\s?%/.test(p.alles) && !/99[,.]\d/.test(p.alles),
      'er staat geen beschikbaarheidspercentage op dit scherm: ' + p.alles.slice(0, 300));
    assert.match(p.platform, /niet over deze organisatie/);
    assert.match(p.platform, /geen meting per ORGANISATIE/i, 'en waarom er geen cijfer voor DEZE klant staat');

    /* DE METING PER CAPABILITY staat er wel, en dat is de reparatie van precies
       die reden: een storing in een onderdeel dat u niet gebruikt hoort niet als
       uw storing te lezen, en dat los je op door te tonen WELK onderdeel het was
       -- niet door alsnog een totaalcijfer op te schrijven. */
    assert.match(p.platform, /Sinds \d{4}-\d{2}-\d{2}/, 'met het venster erbij: ' + p.platform.slice(0, 200));
    assert.match(p.platform, /geen maandcijfer/, 'en met wat dat venster NIET is');
    assert.match(p.platform, /serverfouten over \d+ verzoeken|te weinig verzoeken/,
      'en per onderdeel een cijfer of de reden dat het er niet is');

    /* Wat WEL waar is, staat er met zijn bron en niet als los vinkje. */
    assert.match(p.waar, /Commercieel contract|Auditspoor|Versleutelde opslag/,
      'wat waar is staat er: ' + p.waar);

    /* DE HERSTELPROEF ALS KNOP -- de enige regel op deze pagina die een klant
       zelf waar kan maken. Vooraf staat de bewering op nee met de reden; na een
       druk op de knop staat hij op ja met een datum. */
    assert.match(p.nietWaar, /Uitvoer teruggelezen/, 'vooraf staat hij bij wat NIET waar is');
    /* De kolommen van dit scherm scrollen elk apart, dus de knop staat buiten
       het venster tot je erheen scrolt -- net als voor een mens. */
    await page.evaluate(() => document.getElementById('stProef').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await page.click('#stProef');
    await page.waitForTimeout(1800);
    const uitslag = await page.evaluate(() => document.getElementById('stProefUit').innerText.replace(/\s+/g, ' '));
    assert.match(uitslag, /Geslaagd/, 'de proef slaagt: ' + uitslag);
    assert.match(uitslag, /soorten/);
    const nu2 = await lees();
    assert.match(nu2.waar, /Uitvoer teruggelezen/, 'en daarna staat hij bij wat WEL waar is');
    assert.ok(!/Uitvoer teruggelezen/.test(nu2.nietWaar), 'en niet meer bij wat niet waar is');
    /* En de SLA blijft op nee: dit bewijst het exit-pad en niet de back-up. */
    assert.match(nu2.nietWaar, /SLA/, 'de SLA blijft ontbreken');

    /* VERVERSEN VERVERST WAT ER OPEN STAAT. Dat deed het niet: de knop las
       `vStart.hidden ? 'modules' : 'start'` -- een gok die klopte bij twee
       weergaven en fout werd bij de derde. Vanuit de organisatiestand sprong
       Ververs naar Modules, een scherm waar de gebruiker niet was. */
    await page.evaluate(() => { document.getElementById('stKop').textContent = 'LEEGGEMAAKT'; });
    await page.click('#ververs');
    await page.waitForTimeout(700);
    const na = await lees();
    assert.equal(na.open, true, 'Ververs laat de organisatiestand staan');
    assert.match(na.kop, /Standhuis Groep/, 'en haalt hem opnieuw op');

    /* DE VERBORGEN TABS ZIJN VOOR EEN TOETSENBORD, EN DIE MOETEN DE STAND OOK
       SLUITEN. De bank deed dat al; de tabs niet -- en dan staan er twee
       schermen over elkaar met de bovenste als winnaar. */
    await page.evaluate(() => document.getElementById('tabStart').click());
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.getElementById('vStatus').hidden), true,
      'de verborgen starttab sluit de organisatiestand ook');
    assert.equal(await page.evaluate(() => document.getElementById('vStart').hidden), false,
      'en zet de briefing terug');

    /* ---- Sam: geen recht `werkruimte` ---- */
    await inloggen(sam.lidToken);
    const s = await lees();
    assert.equal(s.open, true, 'het scherm gaat wel open');
    assert.match(s.let, /werkruimte/, 'met de rechtenweigering: ' + s.let);
    assert.ok(!/O-STAND|Standhuis Groep|Proef/.test(s.alles),
      'en zonder een spoor van de stand: ' + s.alles.slice(0, 300));
    /* En hij is NIET uitgelogd: een rechtenweigering is geen sleutelweigering. */
    assert.equal(await page.evaluate(() => !!localStorage.getItem('rtg_werk_sessie')), true,
      'een rechtenweigering logt niemand uit');

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
