/* ============================================================================
   DE KANTOORDEUR EN HET ENE ACCOUNT.

   De server laat de eigenaar met zijn EIGEN lid-token door officeAuth
   (server/kern/kantoor/index.js: "de eigenaar komt ook met zijn eigen
   accountlogin binnen"), en kern/eenaccount.js hangt de kantoorsleutel aan zijn
   account zonder dat hij iets hoeft te koppelen. De schermen wisten daar niets
   van: ze lazen `rtg_office_token` uit localStorage en anders niets.

   Wat de eigenaar daardoor zag, gemeten met een echte browser op elf
   kantoorschermen: vier vroegen om de kantoorcode, vier liepen dood op een
   melding zonder deur ("Geen backoffice-sessie", "Log eerst in", "Log in via
   de Kantoren", "Meld u eerst aan bij het kantoor met uw eigen RTG-account" --
   die laatste zei precies wat er moest gebeuren en gaf er geen knop bij).

   De deur staat nu op een plek (shared/kantoorgesprek.js) en probeert de
   sleutelbos voordat hij iets vraagt. Deze toets legt de drie wegen vast, want
   ze kunnen alle drie los sneuvelen:

     1. MET de kantoorsleutel: geen vraag, het scherm gaat open.
     2. ZONDER lid-token: gewoon de kantoorcode -- de deur is geen achterdeur.
     3. MET een lid-token zonder kantoorsleutel: ook gewoon de kantoorcode.

   Nummer 2 en 3 zijn de belangrijkste. Een deur die opengaat is een gemak; een
   deur die opengaat voor wie de sleutel niet heeft, is een gat.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, laadPlaywright, browserOpties, geenBrowser, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoordeur-'));
const CODE = 'RTG-OFFICE-TOETS';
/* De eigenaar bestaat in de teststand al: de opstart zet hem neer op het
   eigenaarsadres met het demo-wachtwoord (server/server.js, DEMO_WACHTWOORD).
   Hem hier registreren zou een 409 opleveren -- en dat is precies wat de
   bootstrap-sleutel hoort te doen zodra het account er is. */
const EIGENAAR = { email: 'roellie.i@gmail.com', wachtwoord: process.env.DEMO_PASS || 'Imran' };

/* De kantoorschermen die op `rtg_office_token` draaien en die een mens
   rechtstreeks kan openen. Per scherm staat er hoe je ZIET dat hij open is --
   een stuk eigen tekst dat er alleen staat als het scherm zijn gegevens heeft
   opgehaald. "Geen foutmelding" zou hier niet volstaan: een leeg scherm heeft
   die ook niet. */
const SCHERMEN = [
  { app: 'concierge', open: /concierge|verzoek/i },
  { app: 'kosten', open: /bijdragen|kostprijs|dekken/i },
  { app: 'service', open: /wachtrij|de rij/i },
  { app: 'appstore-kantoor', open: /wie tekent|keuring|afdracht/i },
  { app: 'websitestudio', open: /opslaan|blok|voorbeeld/i },
  { app: 'platformregister', open: /platformregister|van elk ding/i },
  { app: 'merken', open: /merk|vestiging/i },
  { app: 'redactiekantoor', open: /concepten|schrijftafel|drukkerij/i },
  { app: 'rtgkantoor', open: /rtg ai|leest alleen mee/i }
];

/* WAT TELT ALS "HIJ VRAAGT DE CODE", EN WAAROM DAT UIT DE DOM KOMT.

   Eerst stond hier /kantoorcode/i op de paginatekst, en dat gaf een valse
   treffer: service.html LEGT UIT dat de gedeelde kantoorcode niemand aanwijst,
   en dat woord staat dus in gewone lopende tekst. Een toets die op zo'n woord
   afgaat, keurt straks een scherm goed dat de vraag helemaal niet stelt.

   De vraag zelf is een element: de gedeelde deur (shared/kantoorgesprek.js)
   zet een .kg met daarin de zin van Rahul in .kg-zegt. Er wordt dus gemeten of
   DIE er staat en waar hij naar vraagt. */
function vraagtCode(deur) { return !!deur && /kantoorcode/i.test(deur); }

async function opstelling() {
  const browser = await pw.chromium.launch(browserOpties(pw));
  /* De service worker uit: anders haalt hij schermen vooruit op en meet deze
     toets een pagina uit de cache in plaats van een verse. */
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  return { browser, page };
}

/* Eén scherm bezoeken met een schone kantoorsleutel, en teruggeven wat er staat.

   HIJ CONTROLEERT NU EERST OF HIJ ER IS AANGEKOMEN, en dat is geen extra
   voorzichtigheid maar een reparatie van een echte misrekening.

   Wat er gebeurde: de navigatie naar het eerste scherm mislukte (de `catch`
   hieronder slikte dat in), waarna deze functie de pagina las die er NOG stond
   -- /apps/app.html, van alsLid(). Die pagina heeft geen `.kg`, dus `deur` was
   null, en de lus eronder schreef dat op als "concierge: vraagt geen code". Dat
   is een aanklacht tegen een scherm dat het gewoon goed doet: in een echte
   browser toont /apps/concierge.html zonder enig token keurig "Welkom bij de
   RTG-Backoffice. Wat is de kantoorcode?".

   Een mislukte METING mag nooit als een bevinding over het ONDERWERP langskomen
   -- dat is dezelfde regel als in TIKKEN.md ("niet gemeten mag nooit als in orde
   langskomen"), hier alleen andersom: niet gemeten kwam langs als "fout". Het
   kost een halve dag om een gat te zoeken dat er niet is, en het ergere is dat
   het omgekeerde net zo goed kon gebeuren: was app.html toevallig een pagina
   MET een `.kg` geweest, dan had deze toets een echt lek groen gekeurd.

   Vandaar `geland`. De aanroeper hoort daarop te splitsen; hij mag hier niet
   stilzwijgend doorlezen. De navigatiefout zelf gaat mee terug in `waarom`,
   zodat de melding zegt wat er misging in plaats van wie het gedaan zou hebben. */
async function bezoek(page, base, app) {
  const doel = '/apps/' + app + '.html';
  await page.evaluate(() => { try { localStorage.removeItem('rtg_office_token'); } catch (e) {} });
  let waarom = null, r = null;
  /* TWEE POGINGEN, en de tweede is geen wegkijken. Een navigatie die afbreekt is
     hier geen uitspraak over het scherm maar over de sprong ernaartoe -- op een
     runner met vier scherven tegelijk is dat een koude start of een afgebroken
     load. Een keer opnieuw beantwoordt de vraag alsnog; blijft hij hangen, dan
     is dat GEEN "vraagt geen code" maar een mislukte meting, en die wordt
     hieronder apart gemeld. Niet in een lus: als de tweede sprong ook strandt,
     is er iets anders aan de hand dan drukte, en dan hoort een mens te kijken. */
  for (let poging = 1; poging <= 2; poging += 1) {
    waarom = null;
    try { await page.goto(base + doel, { waitUntil: 'domcontentloaded' }); }
    catch (e) { waarom = String((e && e.message) || e).split('\n')[0].slice(0, 120); }
    await wachtOpRust(page).catch(() => {});
    r = await page.evaluate(() => {
      const zegt = document.querySelector('.kg .kg-zegt');
      return {
        pad: location.pathname,
        deur: zegt ? zegt.textContent.replace(/\s+/g, ' ').trim() : null,
        tekst: document.body.innerText.replace(/\s+/g, ' ').trim()
      };
    });
    if (r.pad === doel) break;
  }
  /* Een meta-refresh MAG het pad verzetten -- dat is de pagina die iets doet, en
     geen mislukte meting. Daarom telt alleen of we op het gevraagde scherm zijn
     beland; waar we anders zijn, staat in de melding. */
  return Object.assign(r, { geland: r.pad === doel, doel, waarom });
}

/* De drie lussen stellen dezelfde vraag over een andere sleutelbos. Wat ze
   moeten SPLITSEN is ook drie keer hetzelfde, dus staat het hier één keer. */
function nietGemeten(r) {
  return r.doel + ': niet gemeten -- de browser kwam uit op ' + r.pad +
    (r.waarom ? ' (' + r.waarom + ')' : '') +
    '. Dit zegt niets over dat scherm; het zegt dat deze meting niet is gelukt.';
}

// De sleutel van dit toestel zetten (of weghalen met null).
async function alsLid(page, base, token) {
  await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.removeItem('rtg_office_token');
    if (t) localStorage.setItem('rtg_member_token', t); else localStorage.removeItem('rtg_member_token');
  }, token);
}

async function registreer(base, lijf) {
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lijf)
  });
  const d = await r.json();
  assert.ok(d.token, 'registreren lukte niet: ' + JSON.stringify(d).slice(0, 200));
  return d.token;
}

async function inloggen(base, email, password) {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  assert.ok(d.token, 'inloggen lukte niet: ' + JSON.stringify(d).slice(0, 200));
  return d.token;
}

/* De sleutelbos moet de kantoorsleutel ECHT dragen; anders meet de toets
   hieronder iets anders dan hij denkt (een deur die opengaat omdat er niets te
   openen viel). Voor de eigenaar is die sleutel AFGELEID -- hij koppelt niets. */
async function heeftKantoorsleutel(base, token) {
  const d = await (await fetch(base + '/api/account/rollen', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}'
  })).json();
  return (d.rollen || []).some((r) => r && r.rol === 'kantoor');
}

test('de eigenaar komt op elk kantoorscherm binnen met zijn eigen RTG-account (' + SCHERMEN.length + ')',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  try {
    const eigenaar = await inloggen(base, EIGENAAR.email, EIGENAAR.wachtwoord);
    const lid = await registreer(base, { name: 'Gewoon Lid', email: 'lid@toets.example',
      password: 'ToetsWachtwoord123!', geboortedatum: '1990-01-01' });
    assert.equal(await heeftKantoorsleutel(base, eigenaar), true,
      'de eigenaar hoort de kantoorsleutel afgeleid te dragen (kern/eenaccount/afgeleid.js)');
    assert.equal(await heeftKantoorsleutel(base, lid), false,
      'een gewoon lid hoort GEEN kantoorsleutel te hebben; anders meet stap 3 niets');

    const o = await opstelling();
    browser = o.browser;

    // 1) met de kantoorsleutel: geen vraag, en het scherm staat er echt
    await alsLid(o.page, base, eigenaar);
    const dicht = [], mis1 = [];
    for (const s of SCHERMEN) {
      const r = await bezoek(o.page, base, s.app);
      if (!r.geland) { mis1.push(nietGemeten(r)); continue; }
      if (vraagtCode(r.deur)) { dicht.push(s.app + ': vraagt de kantoorcode aan de eigenaar'); continue; }
      if (!s.open.test(r.tekst)) dicht.push(s.app + ': niet open -- ' + r.tekst.slice(0, 140));
    }
    assert.deepEqual(mis1, [], 'deze schermen zijn niet bezocht, dus er is niets over te zeggen:\n  ' + mis1.join('\n  '));
    assert.deepEqual(dicht, [], 'de eigenaar hoort overal binnen te komen zonder code:\n  ' + dicht.join('\n  '));

    /* 2) zonder lid-token: de code, en niets anders. Zou een scherm hier
       opengaan, dan had de deur iets weggegeven aan wie geen sleutel heeft. */
    await alsLid(o.page, base, null);
    const lek = [], mis = [];
    for (const s of SCHERMEN) {
      const r = await bezoek(o.page, base, s.app);
      if (!r.geland) { mis.push(nietGemeten(r)); continue; }
      if (!vraagtCode(r.deur)) lek.push(s.app + ': vraagt geen code -- ' + (r.deur || r.tekst.slice(0, 140)));
    }
    assert.deepEqual(mis, [], 'deze schermen zijn niet bezocht, dus er is niets over te zeggen:\n  ' + mis.join('\n  '));
    assert.deepEqual(lek, [], 'zonder sleutel hoort elk scherm de kantoorcode te vragen:\n  ' + lek.join('\n  '));

    // 3) een lid ZONDER kantoorsleutel: ook gewoon de code
    await alsLid(o.page, base, lid);
    const lek2 = [], mis2 = [];
    for (const s of SCHERMEN) {
      const r = await bezoek(o.page, base, s.app);
      if (!r.geland) { mis2.push(nietGemeten(r)); continue; }
      if (!vraagtCode(r.deur)) lek2.push(s.app + ': vraagt geen code -- ' + (r.deur || r.tekst.slice(0, 140)));
    }
    assert.deepEqual(mis2, [], 'deze schermen zijn niet bezocht, dus er is niets over te zeggen:\n  ' + mis2.join('\n  '));
    assert.deepEqual(lek2, [], 'een lid zonder kantoorsleutel hoort de kantoorcode te krijgen:\n  ' + lek2.join('\n  '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De algemene pin is de rem op de sleutelbos, en die mag niet stil wegvallen:
   staat er een pin, dan gaat de kantoordeur pas open nadat die is ingetypt --
   gemaskeerd, en zonder dat de kantoorcode eraan te pas komt. */
test('staat er een algemene pin, dan vraagt de kantoordeur die (gemaskeerd)',
  { skip: geenBrowser(pw) }, async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoordeur-pin-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2, OFFICE_CODE: CODE } });
  let browser;
  try {
    const eigenaar = await inloggen(base, EIGENAAR.email, EIGENAAR.wachtwoord);
    const gezet = await (await fetch(base + '/api/pin/zet', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + eigenaar },
      body: JSON.stringify({ pin: '482913' }) })).json();
    assert.equal(gezet.gezet, true, 'de algemene pin moest gezet zijn');

    const o = await opstelling();
    browser = o.browser;
    await alsLid(o.page, base, eigenaar);
    await bezoek(o.page, base, 'concierge');
    await o.page.waitForSelector('.kg-in', { timeout: 15000 });
    const vraag = await o.page.evaluate(() => ({
      tekst: document.querySelector('.kg-zegt').textContent.trim(),
      type: document.querySelector('.kg-in').type
    }));
    assert.match(vraag.tekst, /pin/i, 'de deur hoort om de algemene pin te vragen, niet om iets anders');
    assert.equal(vraag.type, 'password', 'een pin hoort gemaskeerd te worden ingetypt');

    await o.page.fill('.kg-in', '482913');
    await o.page.click('.kg-rij button');
    await wachtOpRust(o.page).catch(() => {});
    const binnen = await o.page.evaluate(() => {
      const zegt = document.querySelector('.kg .kg-zegt');
      return { tok: !!localStorage.getItem('rtg_office_token'),
        deur: zegt ? zegt.textContent.replace(/\s+/g, ' ').trim() : null };
    });
    assert.equal(binnen.tok, true, 'na de juiste pin hoort er een kantoorsessie te staan');
    assert.ok(!vraagtCode(binnen.deur), 'de kantoorcode hoort er niet alsnog bij gevraagd te worden');
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
