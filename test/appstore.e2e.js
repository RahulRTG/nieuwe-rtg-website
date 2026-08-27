/* DE CEL IN EEN ECHTE BROWSER -- het enige bewijs dat telt voor deze laag.

   test/appstore.test.js bewijst wat de SERVER doet. Dat is niet hetzelfde als
   wat een browser doet: een naamloze herkomst, een postMessage tussen twee
   documenten en een CSP met `sandbox` erin zijn precies het soort dingen die
   over de lijn kloppen en in een venster stukgaan. Daarom deze toets.

   Wat hij vastlegt:
     1. de cel draait ECHT op een naamloze herkomst -- de ouder kan niet bij
        het document erin, en de app kan niet bij de ouder;
     2. de brug werkt: een app die RTG.roep() aanroept krijgt antwoord;
     3. een machtiging die het lid niet heeft verleend, komt niet door -- ook
        niet in een browser waar de app zelf mag proberen wat hij wil.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* DE BROWSER KOMT UIT ./browser.js EN NIET UIT EEN EIGEN KOPIE. Hier stond een
   eigen laadPlaywright() plus een hardgecodeerd executablePath naar
   /opt/pw-browsers/chromium -- het pad van de ontwikkelcontainer waarin dit is
   geschreven. Dat pad bestaat niet op een GitHub-runner, dus deze drie toetsen
   vielen daar om met "Executable doesn't exist" terwijl ze hier groen stonden.

   Dat is precies de fout waarvoor ./browser.js is gemaakt: die probeert te
   STARTEN in plaats van te laden, loopt alle kandidaten af en slaat pas over als
   er echt geen browser opengaat. Een eigen pad ernaast maakt van "kies een
   browser" weer een vraag met twee antwoorden (LAT-regel 4). */
/* DE SESSIE WORDT GEZAAID MET addInitScript EN NIET DOOR EERST /apps/app.html TE
   OPENEN. Dat scheelde niet alleen een paginalading: app.html registreert de
   service worker, en daarna bedient DIE elke volgende navigatie. De server ziet
   dan geen `Sec-Fetch-Mode: navigate` meer maar een gewone fetch, en noteert het
   scherm als NEVENVERZOEK in plaats van als bezoek (server/routelog.js,
   soortVan). Gevolg: scripts/schermen.js zag alle vier de App Store-schermen als
   "wel opgehaald, nooit afgelegd" en de schermdekking zakte -- terwijl deze
   toetsen die schermen wel degelijk doorlopen.

   addInitScript zet de sleutel vóór het eerste script van de pagina waar we
   werkelijk heen gaan. Geen service worker ertussen, en de navigatie is een
   navigatie. Dat is ook wat de andere schermtoetsen in dit huis doen.

   DE try/catch ERBIJ IS GEEN SLORDIGHEID MAAR HET BEWIJS. Een init-script draait
   in ELK frame, dus ook in de cel -- en daar bestaat localStorage niet, want die
   draait op een naamloze herkomst zonder allow-same-origin. De browser zegt het
   met zoveel woorden: "The document is sandboxed and lacks the
   'allow-same-origin' flag." Precies wat grens 1 belooft. Zonder de catch komt
   die weigering als onopgevangen fout in de lijst en zakt de celtoets op zijn
   eigen sandbox. Zakt het zetten op de RTG-pagina zelf, dan valt de toets alsnog
   om op elke bewering die een sessie nodig heeft. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* Een echte proef-app: hij vraagt zijn stand op bij de brug, schrijft er een
   nieuwe en probeert daarna iets waar hij geen machtiging voor heeft. Alle drie
   de uitkomsten zet hij in de DOM, zodat de toets ze kan lezen. */
const PROEF_JS = [
  'function zet(id, t) { document.getElementById(id).textContent = t; }',
  'RTG.roep("opslag.zet", { sleutel: "stand", waarde: "42" })',
  '  .then(function () { return RTG.roep("opslag.lees", { sleutel: "stand" }); })',
  '  .then(function (r) { zet("uit", "stand=" + r.waarde); })',
  '  .catch(function (e) { zet("uit", "fout: " + e.message); });',
  'RTG.roep("profiel.wieBenIk")',
  '  .then(function (r) { zet("wie", "kreeg: " + JSON.stringify(r)); })',
  '  .catch(function (e) { zet("wie", "geweigerd: " + e.message); });',
  /* En hij probeert bij het venster erboven te komen, LANGS de statische
     keuring heen. De open vorm (`window.parent.…`) wordt bij het inzenden
     afgekeurd -- dat toetst test/appstore-cel.test.js. Hier gaat het om de
     vraag daarna: wat als iemand die keuring omzeilt? Dan hoort de BROWSER hem
     tegen te houden, en dat is precies wat een naamloze herkomst doet. Twee
     sloten, en dit is het tweede. */
  'try { zet("ouder", String(window[["par","ent"].join("")].location.href)); }',
  'catch (e) { zet("ouder", "geen toegang tot de ouder"); }'
].join('\n');
const PROEF_HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Proef</title></head><body>' +
  '<p id="uit">bezig</p><p id="wie">bezig</p><p id="ouder">bezig</p>' +
  '<script src="app.js"></script></body></html>';

test('de cel: naamloze herkomst, werkende brug, en een geweigerde machtiging', { skip: !pw && 'Playwright niet beschikbaar' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser = null;
  try {
    // ---- opzetten: uitgever, app, publicatie, lid ----
    const tech = (await api(base, '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const chef = (roster.staff || []).find(x => x.role === 'manager');
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
    const lid = (await api(base, '/api/auth/register', { name: 'Cel Lid', email: 'cel@x.nl', phone: '0612345677',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
    assert.ok(tech && office && sup && lid, 'alle vier de sessies staan');

    await api(base, '/api/techniek/tenant', { org: 'O-CEL', naam: 'Cel Uitgeverij' }, tech);
    await api(base, '/api/techniek/tenant/bind', { org: 'O-CEL', soort: 'zaak', code: 'KIKUNOI' }, tech);
    await api(base, '/api/appstore/uitgever/aanvraag', { naam: 'Cel Uitgeverij', contact: 'dev@cel.nl' }, sup);
    await api(base, '/api/appstore/kantoor/uitgever', { org: 'O-CEL', besluit: 'toegelaten', door: 'Sam van RTG' }, office);

    const inz = await api(base, '/api/appstore/uitgever/inzenden', {
      manifest: { sleutel: 'cel-proef', naam: 'Celproef', versie: '1.0.0', categorie: 'leven',
        uitleg: 'Een proefapp die laat zien wat er wel en niet door de brug komt.',
        machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }, { id: 'profiel.basis', doel: 'aanspreken' }] },
      bestanden: [{ pad: 'index.html', inhoud: PROEF_HTML }, { pad: 'app.js', inhoud: PROEF_JS }]
    }, sup);
    assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
    await api(base, '/api/appstore/kantoor/toegankelijk', { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
    assert.equal((await api(base, '/api/appstore/kantoor/besluit',
      { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office)).status, 200);

    /* Het lid verleent er EEN van de twee. Dat is de kern van de toets: de app
       probeert straks allebei, in een echte browser, en krijgt er een. */
    assert.equal((await api(base, '/api/appstore/installeer',
      { sleutel: 'cel-proef', machtigingen: ['opslag.eigen'] }, lid)).status, 200);

    // ---- de browser ----
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = letOpFouten(page, []);
    await page.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); } catch (e) { /* de cel mag niet bij opslag */ } }, lid);
    await page.goto(base + '/apps/appcel.html?app=cel-proef');

    await page.waitForSelector('iframe', { timeout: 15000 });
    const sandbox = await page.getAttribute('iframe', 'sandbox');
    assert.equal(sandbox, 'allow-scripts', 'GRENS 1: precies een vlag, en dat is deze');

    /* De ouder kan niet bij het document in de cel. Dat is geen keuze van ons
       maar het gevolg van de naamloze herkomst -- en het is meteen het bewijs
       dat die herkomst er echt is. */
    const binnen = await page.evaluate(() => {
      try { return document.querySelector('iframe').contentDocument ? 'wel' : 'niet'; }
      catch (e) { return 'niet'; }
    });
    assert.equal(binnen, 'niet', 'de RTG-pagina komt niet in het document van de derde');

    const frame = page.frames().find(f => /\/appcel\//.test(f.url()));
    assert.ok(frame, 'de cel is geladen');
    await frame.waitForFunction(() => document.getElementById('uit').textContent !== 'bezig', null, { timeout: 15000 });
    await frame.waitForFunction(() => document.getElementById('wie').textContent !== 'bezig', null, { timeout: 15000 });

    assert.equal(await frame.textContent('#uit'), 'stand=42',
      'de brug werkt: de app schreef en las zijn eigen kladblok');
    const wie = await frame.textContent('#wie');
    assert.match(wie, /^geweigerd: /, 'wat het lid niet verleende, komt ook in een browser niet door: ' + wie);
    assert.match(wie, /profiel\.basis/, 'en de app hoort te lezen welke machtiging hij mist');
    assert.equal(await frame.textContent('#ouder'), 'geen toegang tot de ouder',
      'de app komt niet bij het venster erboven');

    // en aan de RTG-kant staat de waarde echt
    const gelezen = await api(base, '/api/appstore/brug',
      { sleutel: 'cel-proef', methode: 'opslag.lees', args: { sleutel: 'stand' } }, lid);
    assert.equal(gelezen.body.uit.waarde, '42');
    assert.deepEqual(fouten, [], 'de celpagina boot zonder onopgevangen fouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* De twee schermen eromheen, in dezelfde browser. Ze staan hier en niet in een
   API-toets omdat de fout die deze toets vond ALLEEN in een venster bestaat: de
   startregel van mall.html roept laadAppstore() aan terwijl het script nog wordt
   doorlopen, en een `const` die verderop stond zat op dat moment nog in zijn
   dode zone. Gevolg: de hele afdeling viel stil, de API antwoordde vrolijk 200,
   en geen enkele toets over de lijn merkte iets. */
test('de winkel en het uitgeversbureau openen zonder fouten', { skip: !pw && 'Playwright niet beschikbaar' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-ui-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser = null;
  try {
    const tech = (await api(base, '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const chef = (roster.staff || []).find(x => x.role === 'manager');
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
    const lid = (await api(base, '/api/auth/register', { name: 'Winkel Lid', email: 'winkel@x.nl', phone: '0612345676',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
    await api(base, '/api/techniek/tenant', { org: 'O-WINKEL', naam: 'Winkel Uitgeverij' }, tech);
    await api(base, '/api/techniek/tenant/bind', { org: 'O-WINKEL', soort: 'zaak', code: 'KIKUNOI' }, tech);
    await api(base, '/api/appstore/uitgever/aanvraag', { naam: 'Winkel Uitgeverij', contact: 'dev@winkel.nl' }, sup);
    await api(base, '/api/appstore/kantoor/uitgever', { org: 'O-WINKEL', besluit: 'toegelaten', door: 'Sam van RTG' }, office);
    const inz = await api(base, '/api/appstore/uitgever/inzenden', {
      manifest: { sleutel: 'winkel-proef', naam: 'Winkelproef', versie: '1.0.0', categorie: 'leven',
        uitleg: 'Een proefapp om de winkelkant van de App Store te tonen.',
        machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }, { id: 'profiel.basis', doel: 'aanspreken' }] },
      bestanden: [{ pad: 'index.html', inhoud: PROEF_HTML }, { pad: 'app.js', inhoud: PROEF_JS }] }, sup);
    assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
    await api(base, '/api/appstore/kantoor/toegankelijk', { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
    await api(base, '/api/appstore/kantoor/besluit', { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });

    // ---- de winkel in de Mall ----
    const page = await browser.newPage();
    const fouten = letOpFouten(page, []);
    await page.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); } catch (e) { /* de cel mag niet bij opslag */ } }, lid);
    await page.goto(base + '/apps/mall.html');
    await page.waitForSelector('#asGrid .boutiek', { timeout: 20000 });
    assert.deepEqual(fouten, [], 'de Mall boot zonder onopgevangen fouten');
    assert.equal(await page.locator('#asGrid input[data-m]').count(), 2,
      'wat de app vraagt staat als vinkje op de kaart -- een toestemming die je pas na het drukken ziet, is geen keuze');
    const kaart = await page.textContent('#asGrid .boutiek');
    assert.match(kaart, /Winkel Uitgeverij/, 'van wie de app is, staat erbij');
    assert.match(kaart, /Nooit:/, 'en wat hij NOOIT krijgt staat er even groot bij');

    // een vinkje weglaten en installeren: dan krijgt de app er een
    await page.uncheck('#asGrid input[data-m][data-m="profiel.basis"]');
    await page.click('#asGrid .asZet');
    await page.waitForSelector('#asGrid a:has-text("Openen")', { timeout: 15000 });
    const mijn = await api(base, '/api/appstore/mijn', {}, lid);
    assert.deepEqual(mijn.body.apps[0].verleend.map(m => m.id), ['opslag.eigen'],
      'het lid gaf er een van de twee, en dat is wat er staat');

    /* ---- DE ENTERPRISE-KANT IN EEN VENSTER. Het inkoopdossier en de tijdlijn
       zijn API-groen zodra test/appstore-dossier.test.js draait; dat zegt niets
       over of een mens ze ziet. Deze laag heeft die les al een keer geleerd --
       de cel antwoordde 200 terwijl er in het venster niets stond -- en het
       dossier is juist het stuk waarvan de hele waarde is dat iemand het LEEST. */
    await page.click('#asGrid .asDos');
    await page.waitForSelector('#asGrid .asDosVak:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => !/wordt opgemaakt/.test(document.querySelector('.asDosVak').textContent),
      null, { timeout: 15000 });
    const dos = await page.textContent('#asGrid .asDosVak');
    assert.match(dos, /geen kopie/, 'de sterkste claim staat er, en die is negatief');
    assert.match(dos, /bron: /, 'elke bewering draagt zijn bron zichtbaar, niet in een tooltip');
    assert.match(dos, /Wat dit dossier NIET zegt/, 'en wat wij niet kunnen aantonen staat er als eigen blok');
    assert.match(dos, /beschikbaarheid van de leverancier/, 'met de reden erbij en niet als kleine letters');

    await page.click('#asGesch');
    await page.waitForSelector('#asTijd:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => !/Even ophalen/.test(document.getElementById('asTijd').textContent),
      null, { timeout: 15000 });
    const gesch = await page.textContent('#asTijd');
    assert.match(gesch, /op je startscherm gezet/, 'wat het lid net deed, staat in zijn geschiedenis');
    assert.match(gesch, /opslag\.eigen/, 'met wat hij GAF erbij -- daar gaat de vraag later over');
    assert.deepEqual(fouten, [], 'dossier en geschiedenis openen zonder onopgevangen fouten');

    // ---- het uitgeversbureau ----
    const p2 = await browser.newPage();
    const f2 = letOpFouten(p2, []);
    await p2.addInitScript((t) => { try { localStorage.setItem('rtg_sup_token', t); } catch (e) { /* de cel mag niet bij opslag */ } }, sup);
    await p2.goto(base + '/apps/appstore-uitgever.html');
    await p2.waitForSelector('#mSleutel', { timeout: 20000 });
    assert.deepEqual(f2, [], 'het uitgeversbureau boot zonder onopgevangen fouten');
    assert.equal(await p2.locator('input[data-mach]').count(), 3, 'alle drie de machtigingen staan er om te vragen');

    /* DE UITGEVER LEEST WAT DE KLANT LEEST. Deze knop bestaat omdat een
       leverancier die pas bij het inkoopgesprek ontdekt wat er over hem staat,
       er niet meer op kan reageren. Hij kan er niets aan veranderen -- en juist
       daarom hoort hij het te kunnen zien. */
    await p2.click('.aDos');
    await p2.waitForFunction(() => {
      const v = document.querySelector('.uDos'); return v && !v.hidden && !/Bezig/.test(v.textContent);
    }, null, { timeout: 15000 });
    const uDos = await p2.textContent('.uDos');
    assert.match(uDos, /geen kopie/, 'de claim waar hij op wordt afgerekend staat er');
    assert.match(uDos, /van je concurrent/, 'met de mededeling dat het NIET-blok bij elke app hetzelfde is');
    /* En dat blok staat er ook echt. Alleen op die mededeling toetsen liet het
       blok zelf ongemerkt van de pagina vallen: dan staat er "bij elke app
       hetzelfde" zonder dat er iets volgt. */
    assert.match(uDos, /penetratietest/, 'met wat er over zijn app NIET wordt beweerd, bij naam');
    assert.match(uDos, /SBOM/);
    assert.ok(await p2.locator('#bProef').count(), 'en de proefkeuring staat er');
    assert.match(await p2.textContent('body'), /Winkelproef/, 'de eigen app staat in de lijst');

    /* ---- DE EIGEN DOSSIERPAGINA, in twee standen. Hij bestaat naast het
       uitklapblok in de Mall voor de TWEEDE lezer: een inkoper die er niet
       toevallig langs komt maar er specifiek naartoe wordt gestuurd, en die een
       adres nodig heeft dat hij kan bewaren en doorsturen. ---- */
    const p3 = await browser.newPage();
    const f3 = letOpFouten(p3, []);
    await p3.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); } catch (e) { /* de cel mag niet bij opslag */ } }, lid);

    await p3.goto(base + '/apps/appstore-dossier.html?app=winkel-proef');
    await p3.waitForSelector('main .kaart h2', { timeout: 20000 });
    const perApp = await p3.textContent('main');
    assert.match(perApp, /Waar de gegevens blijven/, 'de app-stand toont het dossier van die app');
    assert.match(perApp, /Winkel Uitgeverij/, 'met de leverancier erbij');
    assert.match(perApp, /Wat dit dossier NIET zegt/, 'en met wat er niet wordt beweerd');

    /* De stand ZONDER app is de belangrijkste: "kan zo'n app ooit bij onze
       betaalgegevens?" is een vraag per platform en niet per app. */
    await p3.goto(base + '/apps/appstore-dossier.html');
    await p3.waitForSelector('main .kaart h2', { timeout: 20000 });
    const kanaal = await p3.textContent('main');
    assert.match(kanaal, /Wat geen enkele app kan vragen/, 'het kanaaldossier begint bij wat er NIET kan');
    /* En die kop moet ook GEVULD zijn. Hier stond eerst alleen de kop, en toen
       bleef deze toets groen terwijl de lijst eronder leeg werd gemaakt -- een
       kop zonder inhoud leest als "er is niets dat een app niet kan", precies
       het tegenovergestelde van wat er hoort te staan. */
    assert.match(kanaal, /betalen/, 'met de machtigingen die er NIET zijn, bij naam');
    assert.match(kanaal, /locatie/);
    assert.match(kanaal, /RTG Pay/, 'en met de reden waarom ze er niet zijn');
    assert.match(kanaal, /profiel\.basis/, 'en daarna pas wat er wel te vragen valt');
    assert.ok(!/Winkel Uitgeverij/.test(kanaal), 'en het gaat over het platform, niet over een leverancier');
    assert.deepEqual(f3, [], 'de dossierpagina boot in beide standen zonder onopgevangen fouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* De betaalde kant in een browser: de bon voordat er wordt betaald, en de
   keuringskant waar een mens aftekent. Ze staan hier en niet in een API-toets
   omdat de fout die je hier zoekt alleen in een venster bestaat -- een bon die
   niet optelt op het scherm, een knop die twee keer boekt, een keuringspagina
   die zonder naam toch doorgaat. */
test('de bon, de koop en de keuringskant in een browser', { skip: !pw && 'Playwright niet beschikbaar' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-geld-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser = null;
  try {
    const tech = (await api(base, '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const chef = (roster.staff || []).find(x => x.role === 'manager');
    const sup = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
    /* Een demosessie als koper: een echt account moet voor RTG Pay eenmalig zijn
       paspoort laten zien, en die poort geldt hier ook (test/appstore-geld.test.js
       toets 9). Een demosessie heeft geen account en dus geen paspoortplicht. */
    const lid = (await api(base, '/api/login', { tier: 'rtg' })).body.token;
    await api(base, '/api/pay/oplaad', { centen: 5000, idem: 'e2e-oplaad' }, lid);

    await api(base, '/api/techniek/tenant', { org: 'O-BON', naam: 'Bon Uitgeverij' }, tech);
    await api(base, '/api/techniek/tenant/bind', { org: 'O-BON', soort: 'zaak', code: 'KIKUNOI' }, tech);
    await api(base, '/api/appstore/uitgever/aanvraag', { naam: 'Bon Uitgeverij', contact: 'dev@bon.nl' }, sup);
    await api(base, '/api/appstore/kantoor/uitgever', { org: 'O-BON', besluit: 'toegelaten', door: 'Sam van RTG' }, office);
    const inz = await api(base, '/api/appstore/uitgever/inzenden', {
      manifest: { sleutel: 'bon-proef', naam: 'Bonproef', versie: '1.0.0', categorie: 'leven',
        uitleg: 'Een betaalde proefapp om de bon en de keuringskant te tonen.', machtigingen: [], prijsCenten: 999 },
      bestanden: [{ pad: 'index.html', inhoud: PROEF_HTML }, { pad: 'app.js', inhoud: PROEF_JS }] }, sup);
    assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });

    /* ---- eerst de keuringskant: hier moet een MENS aftekenen ---- */
    const kp = await browser.newPage();
    const kf = letOpFouten(kp, []);
    await kp.addInitScript((t) => { try { localStorage.setItem('rtg_office_token', t); } catch (e) { /* de cel mag niet bij opslag */ } }, office);
    await kp.goto(base + '/apps/appstore-kantoor.html');
    await kp.waitForSelector('[data-v] .pub', { timeout: 20000 });
    assert.deepEqual(kf, [], 'de keuringspagina boot zonder onopgevangen fouten');

    /* DE CONTROLERONDE HEEFT EEN KNOP, en die wordt hier ingedrukt. Hij stond
       eerst alleen als route: een controle die geen mens kan starten, wordt
       nooit gedraaid. Op dit moment staat er nog niets live -- de app hieronder
       moet nog worden afgetekend -- dus het juiste antwoord is nul, en dat is
       ook een antwoord dat op het scherm hoort te komen. */
    await kp.click('#hcDoe');
    await kp.waitForFunction(() => !/Bezig met nalopen/.test(document.getElementById('hcUit').textContent),
      null, { timeout: 15000 });
    assert.match(await kp.textContent('#hcUit'), /0 nagelopen/, 'er staat nog niets live, en dat zegt hij ook');
    assert.match(await kp.textContent('#hcUit'), /byte voor byte/, 'met wat de ronde eigenlijk heeft gedaan erbij');
    assert.match(await kp.textContent('#main'), /Bonproef/, 'de inzending staat in de wachtrij');
    assert.match(await kp.textContent('#main'), /keurt nooit goed/, 'en de pagina zegt zelf dat de machine niets goedkeurt');
    /* DE TOEGANKELIJKHEIDSPOORT, van scherm tot server (besluit 27 augustus
       2026). Hier komt hij aan zijn eind toe: er is nog geen keuring gedraaid,
       dus deze versie gaat niet live -- ook niet als er een naam onder staat.
       Dat het scherm dat zegt is geen luxe: zonder die regel drukt wie hier zit
       op Publiceren en moet hij raden waarom er niets gebeurt. */
    /* Op #main kijken en niet op body: het script staat IN de body, dus
       body.textContent bevat ook de bron van dit scherm. Een toets die daarop
       kijkt, blijft groen als het blok nooit wordt getekend -- dat is hier eerst
       gebeurd. */
    assert.match(await kp.textContent('#main'), /Toegankelijkheid: nog niet gekeurd/,
      'het keuringsscherm zegt dat de toegankelijkheidskeuring nog moet draaien');

    // zonder naam gaat het niet
    await kp.click('[data-v] .pub');
    await kp.waitForTimeout(800);
    assert.equal((await api(base, '/api/appstore/catalogus', {}, lid)).body.totaal, 0, 'zonder naam is er niets gepubliceerd');

    // en met een naam ook niet, zolang de keuring niet is gedraaid
    await kp.fill('#wie', 'Sam van RTG');
    await kp.click('[data-v] .pub');
    /* Op de TEKST van deze weigering wachten en niet op "er staat iets": de
       melding van de vorige klik ("zet je naam erbij") staat er nog even, en
       daar zit het woord keuring ook in. */
    await kp.waitForFunction(() => /nog niet over deze bundel gedraaid/.test(document.getElementById('melding').textContent),
      null, { timeout: 15000 });
    assert.match(await kp.textContent('#melding'), /nog niet over deze bundel gedraaid/,
      'de server weigert, en zegt waarom');
    assert.equal((await api(base, '/api/appstore/catalogus', {}, lid)).body.totaal, 0,
      'een naam alleen publiceert niets: de keuring moet eerst gedraaid zijn');

    /* De keurloper doet dit in het echt (scripts/appstore-a11y.js: hij rendert
       de bundel in de cel en noteert wat hij vindt). Hier zetten we de uitslag
       zelf neer -- deze toets gaat over de POORT, niet over de meting. */
    const keur = await api(base, '/api/appstore/kantoor/toegankelijk',
      { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
    assert.equal(keur.status, 200, JSON.stringify(keur.body));

    await kp.reload();
    await kp.waitForSelector('[data-v] .pub', { timeout: 20000 });
    assert.match(await kp.textContent('#main'), /Toegankelijkheid: geen fouten gevonden/,
      'en de uitslag komt op het scherm terecht');
    assert.match(await kp.textContent('#main'), /geen goedkeuring|blokkade weg/,
      'met erbij dat een geslaagde keuring nog steeds niets goedkeurt');
    await kp.click('[data-v] .pub');
    await kp.waitForFunction(() => !document.querySelector('[data-v] .pub'), null, { timeout: 15000 });
    assert.equal((await api(base, '/api/appstore/catalogus', {}, lid)).body.totaal, 1, 'daarna wel');

    /* ---- en dan de winkel: de bon voordat er wordt betaald ---- */
    const page = await browser.newPage();
    const fouten = letOpFouten(page, []);
    await page.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); } catch (e) { /* de cel mag niet bij opslag */ } }, lid);
    await page.goto(base + '/apps/mall.html');
    await page.waitForSelector('#asGrid .asKoop', { timeout: 20000 });
    assert.deepEqual(fouten, [], 'de Mall boot zonder onopgevangen fouten');
    assert.match(await page.textContent('#asGrid .boutiek'), /9,99/, 'de prijs staat op de kaart, voordat je iets doet');

    await page.click('#asGrid .asKoop');
    await page.waitForSelector('#asGrid .bonBetaal, #asGrid .bonLand', { timeout: 15000 });
    if (await page.locator('#asGrid .bonLand').count()) {
      await page.selectOption('#asGrid .bonLand', 'NL');
      await page.waitForSelector('#asGrid .bonBetaal', { timeout: 15000 });
    }
    const bon = await page.textContent('#asGrid .asBon');
    assert.match(bon, /Je betaalt/);
    assert.match(bon, /btw 21%/, 'de btw van het land van het LID staat erbij');

    const voor = (await api(base, '/api/pay/overzicht', {}, lid)).body.saldo;
    await page.click('#asGrid .bonBetaal');
    await page.waitForSelector('#asGrid .asZet', { timeout: 20000 });
    assert.equal((await api(base, '/api/pay/overzicht', {}, lid)).body.saldo, voor - 999, 'er is precies een keer afgerekend');
    const gezond = await fetch(base + '/api/pay/gezond').then(async r => r.json());
    assert.equal(gezond.klopt, true, 'en het grootboek sluit nog steeds');
    assert.deepEqual(fouten, [], 'ook na het kopen geen onopgevangen fouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
