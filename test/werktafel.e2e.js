/* DE WERKTAFEL: wanneer hij er WEL mag staan, en wanneer niet.

   Deze toets bestaat om twee fouten die alleen op een breed venster bestonden,
   en die daarom niemand zag: de app wordt op een telefoon ontwikkeld en op een
   telefoon bekeken.

   1) DE ONDERTEKENING WERD OVERGESLAGEN. Een vers lid moet eerst de RTG-
      lidmaatschaps- en reisovereenkomst tekenen; die staat in #onbGate, modaal
      over de app. shared/command.js keek alleen of #app de klasse `active`
      droeg -- die zet de sessie, niet de intake -- en bouwde zijn werktafel er
      op z-index 210 overheen (#onbGate zit op 130). Zelfde account, zelfde
      token: bij 999px stond je voor de overeenkomst, bij 1001px erachter.

   2) HET BEGINSCHERM KOOS VOOR JE. bouw() opende zichzelf twee vaste apps
      (Reizen & Veilig en Geld). De werktafel IS inmiddels het beginscherm -- op
      elke breedte -- maar hij begint leeg: welke apps er opengaan is een keuze
      van een mens. De klok blijft bestaan als ingang bovenaan de bank, want
      daar hangen de werelden op hun bezel (WERELD.md); hem kiezen vouwt de
      werktafel op.

   Wat deze toets NIET doet, is meten of de onboarding zelf klopt (daar zijn de
   aanmeldtoetsen voor). Hij meet alleen wie er bovenop mag liggen.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, wachtTot, wachtOpRust, volgVerzoeken } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function opzet() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werktafel-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const u = Date.now().toString(36);
  const r = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Werktafel Proef', email: 'werktafel' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  });
  const d = await r.json();
  assert.ok(d.token, 'registratie hoort een token te geven, kreeg: ' + JSON.stringify(d).slice(0, 200));
  return { srv, token: d.token, dataDir };
}

async function tekenOnboarding(base, token) {
  const r = await fetch(base + '/api/onboarding/teken', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ naam: 'Werktafel Proef', akkoord: true })
  });
  const d = await r.json().catch(() => ({}));
  assert.equal(r.status, 200, 'onboarding tekenen: ' + JSON.stringify(d).slice(0, 200));
  assert.equal(d.klaar, true, 'de proefgebruiker hoort na tekenen binnen te mogen');
}

/* De stand van het scherm in EEN oogopslag. `bovenop` is de kern van geval 1:
   niet "staat de deur in de DOM" maar "wie raakt de muis in het midden van de
   deur" -- want de bug was juist dat de deur er wel stond en onbereikbaar was. */
const stand = () => {
  const g = document.getElementById('onbGate'), S = document.getElementById('shell');
  const r = g ? g.getBoundingClientRect() : null;
  const midden = r && r.width ? document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)) : null;
  return {
    werktafel: !!document.getElementById('rtgCommand'),
    bladen: document.querySelectorAll('.cmd-pane').length,
    poortOpen: g ? !g.hidden : null,
    poortBovenop: !!(midden && g && g.contains(midden)),
    appActief: !!(document.getElementById('app') || {}).classList?.contains('active'),
    shellZichtbaar: !!(S && getComputedStyle(S).display !== 'none' && S.getBoundingClientRect().width > 0),
    /* DE SCHIL BESTAAT NOG, EN DAT IS DE BEDOELING -- maar als LA en niet als
       scherm (WERELD.md). De panelen wonen erin (bedieningspaneel, Zegel,
       meldingen), dus "de schil is weg" is niet meer de vraag. De vraag is of
       hij de werktafel afvangt: ligt er een onzichtbaar vel overheen, dan
       reageert er niets meer en zie je daar niets van. Dat is hier al een keer
       gebeurd -- shared/levendekleur.js schilderde de schil met !important --
       en een meting op zichtbaarheid zag dat niet. Deze wel: wie raakt de muis
       in het midden van de werkvloer? */
    schilVangt: (() => {
      const w = document.querySelector('.cmd-werk'); if (!w || !S) return null;
      const b = w.getBoundingClientRect();
      const t = document.elementFromPoint(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
      return !!(t && S.contains(t));
    })(),
    klok: document.querySelectorAll('.os-app').length,
    commandActief: !!(window.RTGCommand && window.RTGCommand.actief()),
    // de lade: `inBeeld` is de echte vraag, want dicht staat hij onder de rand
    // en niet op display:none -- hij schuift, dus meten we waar hij staat
    lade: (() => {
      const bank = document.querySelector('.cmd-bank'); if (!bank) return null;
      const r = bank.getBoundingClientRect();
      return { inBeeld: r.top < window.innerHeight - 40, werelden: document.querySelectorAll('.cmd-nav button[data-url]').length };
    })(),
    // #gate is de INLOG. Wordt hij bij het opruimen niet teruggezet, dan gaat
    // hij met de werktafel mee en kan er niemand meer naar binnen.
    gateBestaat: !!document.getElementById('gate'),
    gateInShell: !!(S && S.contains(document.getElementById('gate'))),
    greep: !!document.querySelector('.cmd-lade'),
    /* De ingang naar het systeem. Dit was `.cmd-klok`, de knop die de werktafel
       opvouwde naar het klokscherm; dat scherm bestaat niet meer (WERELD.md) en
       die knop dus ook niet. Wat de belofte eronder was -- er is vanaf de
       werktafel altijd een zichtbare weg naar uitloggen, de pin, je Zegel --
       leeft door in de voet van de bank. */
    paneelIngang: [...document.querySelectorAll('.cmd-bankvoet button')]
      .some(b => /Bedieningspaneel/i.test(b.textContent)),
    // de tabstrip en of de greep op een blad ligt: zie de mobiele stap hieronder
    tabstrip: (() => { const t = document.querySelector('.cmd-tabs'); return t ? getComputedStyle(t).display : null; })(),
    // hoeveel er onder het blad overblijft: dat hoort precies de schilbalk te
    // zijn -- geen gat, geen overlap
    bladTotOnder: (() => {
      const f = document.querySelector('.cmd-pane.actief iframe');
      return f ? Math.round(window.innerHeight - f.getBoundingClientRect().bottom) : null;
    })(),
    // de schilbalk: de bank, waar je bent, en weg hier
    balk: (() => { const b = document.querySelector('.cmd-balk');
      return b ? Math.round(b.getBoundingClientRect().height) : null; })(),
    chips: [...document.querySelectorAll('.cmd-balkblad')]
      .map(x => x.textContent + (x.classList.contains('actief') ? '*' : '')),
    sluitknop: (() => { const k = document.querySelector('.cmd-balksluit'); return !!k && !k.hidden; })(),
    // begint de wereld bovenaan? Zo niet, dan staat er weer schil-chroom boven
    bladVanaf: (() => { const f = document.querySelector('.cmd-pane.actief iframe');
      return f ? Math.round(f.getBoundingClientRect().top) : null; })(),
    leegstaat: !!document.querySelector('.cmd-leeg'),
  };
};

test('werktafel: niet over de ondertekening heen, en hij begint leeg',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, token, dataDir } = await opzet();
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    await page.addInitScript(t => { try { localStorage.setItem('rtg_member_token', t); } catch (e) {} }, token);
    /* Zelfde reden als hierboven. Deze had geen eigen wacht erna, dus die staat
       er nu: het stijlblad is binnen -- de beweringen meten gestapelde lagen. */
    await page.goto(srv.base + '/apps/app.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => document.styleSheets.length > 0, null, { timeout: 20000 });

    // 1) de intake staat open en hoort BOVENOP te liggen, ook op 1440px
    await page.waitForFunction(() => {
      const g = document.getElementById('onbGate');
      return g && !g.hidden && g.getBoundingClientRect().width > 0;
    }, { timeout: 20000 });
    /* PROBEER ER LANGS TE KOMEN. Zonder deze poging kan de bewering hieronder
       niet zakken: er bouwt uit zichzelf toch niets meer, dus "geen werktafel"
       zou ook groen zijn met de grendel eruit (LAT.md regel 9). Dit is de weg
       die het gat had: een app openen terwijl de overeenkomst nog openstaat. */
    await page.evaluate(() => { try { window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'); } catch (e) {} });
    await wachtOpRust(page);
    const dicht = await page.evaluate(stand);
    // op het PAD toetsen: de app draagt een querystring (?pas=rtg) en die hoort er te mogen zijn
    assert.equal(new URL(page.url()).pathname, '/apps/app.html',
      'openen mag ook geen paginasprong worden: /apps/vandaag.html draagt de deur niet, dus dat is de deur omzeilen');
    /* Zonder deze bewering kan de rest niet zakken: is #app niet `active`, dan
       weigert de werktafel sowieso en bewijst "geen werktafel" niets. Precies de
       vorm uit LAT.md regel 9. */
    assert.equal(dicht.appActief, true, 'voorwaarde: de sessie staat, anders toetst de rest hieronder niets');
    assert.equal(dicht.poortOpen, true, 'een vers lid hoort de overeenkomst nog te moeten tekenen');
    assert.equal(dicht.werktafel, false, 'de werktafel mag niet bestaan zolang er niet getekend is');
    assert.equal(dicht.poortBovenop, true, 'de overeenkomst hoort aanklikbaar te zijn en niet overdekt');
    assert.equal(dicht.commandActief, false, 'en een app hoort hier niet als blad te openen');
    /* De werktafel stond hier even in de gesloten stand (het token wordt pas na
       het laden hersteld) en is daarna opgeruimd voor de ondertekening. Het
       inloggesprek hoort die opruiming te hebben overleefd. */
    assert.equal(dicht.gateBestaat, true, 'het inloggesprek mag niet met de werktafel zijn meegenomen');
    assert.equal(dicht.gateInShell, true, 'en hoort terug te staan waar hij vandaan kwam');

    /* 2) getekend: dan is de WERKTAFEL het beginscherm, en hij staat leeg.
       Leeg is hier de bedoeling: welke apps er opengaan is een keuze van een
       mens. Eerder stonden Reizen & Veilig en Geld hier vanzelf open. */
    await page.evaluate(() => { document.getElementById('onbGate').hidden = true; });
    await page.waitForSelector('#rtgCommand .cmd-leeg', { timeout: 10000 });
    const thuis = await page.evaluate(stand);
    assert.equal(thuis.bladen, 0, 'de werktafel hoort leeg te beginnen, niet met apps die het huis koos');
    assert.equal(thuis.schilVangt, false, 'de schil ligt als een vel over de werktafel; dan reageert er niets meer');
    assert.equal(thuis.paneelIngang, true, 'de voet van de bank hoort de weg naar het bedieningspaneel te dragen');
    assert.equal(thuis.commandActief, true, 'en een app opent hier als blad');

    // 3) een app openen vult de werkvloer; de lege staat maakt plaats
    await page.evaluate(() => window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'));
    await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 10000 });
    const werk = await page.evaluate(stand);
    assert.equal(werk.bladen, 1, 'een geopende app is een blad, en alleen die ene');
    assert.equal(werk.leegstaat, false, 'en de uitnodiging hoort dan weg te zijn');

    // 4) het laatste blad sluiten laat de werktafel LEEG staan, en breekt hem niet af
    await page.evaluate(() => window.RTGCommand.sluitAlles());
    await page.waitForSelector('#rtgCommand .cmd-leeg', { timeout: 10000 });
    const terug = await page.evaluate(stand);
    assert.equal(terug.werktafel, true, 'het laatste blad sluiten hoort niet de hele werktafel op te ruimen');
    assert.equal(terug.bladen, 0, 'maar hem leeg achter te laten');

    /* 4b) EN ER IS GEEN WEG MEER TERUG NAAR EEN ANDER BEGINSCHERM.

       Hier stond het spiegelbeeld van deze toets: klik .cmd-klok, de werktafel
       vouwt zich op en de klok komt terug. Dat was toen juist -- de klok WAS
       het beginscherm en de werktafel klapte ervoor. Nu is de werktafel het
       beginscherm (WERELD.md), en een knop die hem opvouwt zou je op een leeg
       scherm achterlaten zonder iets om naar terug te keren.

       Wat ervoor in de plaats komt is de andere helft van dezelfde belofte, en
       hij hoort net zo hard te zakken: er is GEEN knop meer die de werktafel
       weghaalt, en de weg naar het systeem staat in de voet van de bank. */
    assert.equal(await page.evaluate(() => !!document.querySelector('.cmd-klok')), false,
      'de opvouwknop is terug; die laat je achter op een scherm dat er niet meer is');
    assert.equal(terug.paneelIngang, true,
      'en de weg naar het bedieningspaneel is uit de bank verdwenen -- dan is uitloggen onbereikbaar');


    /* 5) EN ANDERSOM. checkOnboarding is asynchroon: de deur kan opengaan NADAT
       de werktafel er al staat. Dan is wegnemen de enige juiste uitkomst -- een
       weigering bij het bouwen alleen zou dit gat open laten. */
    await page.evaluate(() => window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'));
    await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 10000 });
    await page.evaluate(() => { document.getElementById('onbGate').hidden = false; });
    /* De werktafel hoort te wijken zodra de poort weer open staat; dat is een
       schermreactie op een DOM-wijziging en niet op een verzoek, dus wachten we
       op precies die reactie. */
    await wachtTot(page, () => !document.querySelector('#rtgCommand .cmd-pane'),
      null, { wat: 'een werktafel die wijkt voor de openstaande intake' });
    const opnieuw = await page.evaluate(stand);
    assert.equal(opnieuw.werktafel, false, 'gaat de intake alsnog open, dan hoort de werktafel te wijken');
    assert.equal(opnieuw.poortBovenop, true, 'en ligt de overeenkomst weer bovenop');

    /* 6) EN OP EEN TELEFOON, waar deze werktafel niet bestaat.

       Deze stap staat er omdat een mutatie AFSLOEG: de grendel uit open()
       halen veranderde op 1440px niets, want bouw() weigert daar zelf al via
       mag(). Alleen: onder 1000px komt open() nooit bij bouw() -- daar doet hij
       location.href, en dan is een openstaande intake met een paginasprong te
       passeren. Dat is precies de smalle stand, en dus hoort hij hier gemeten
       te worden en niet alleen op een breed venster. */
    await page.setViewportSize({ width: 390, height: 844 });
    await wachtOpRust(page);
    const smal = await page.evaluate(stand);
    assert.equal(smal.poortOpen, true, 'voorwaarde: de intake staat nog open, anders toetst het hieronder niets');
    assert.equal(smal.werktafel, false, 'op een telefoon bestaat deze werktafel sowieso niet');
    await page.evaluate(() => { try { window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'); } catch (e) {} });
    await wachtOpRust(page);
    assert.equal(new URL(page.url()).pathname, '/apps/app.html',
      'ook op een telefoon mag een openstaande overeenkomst niet met een paginasprong te passeren zijn');

    /* 7) DEZELFDE WERKTAFEL OP EEN TELEFOON, in zijn eigen vorm.

       De bank is hier geen rail maar een lade, en er staat een blad tegelijk in
       beeld. Wat NIET verandert: het beginscherm blijft de klok, een app wordt
       een blad in plaats van een paginasprong, en het laatste blad sluiten
       brengt je thuis. */
    await page.evaluate(() => { document.getElementById('onbGate').hidden = true; });
    await page.waitForSelector('#rtgCommand .cmd-leeg', { timeout: 10000 });
    const smalThuis = await page.evaluate(stand);
    assert.equal(smalThuis.bladen, 0, 'ook op een telefoon begint de werktafel leeg');
    assert.equal(smalThuis.schilVangt, false, 'en de schil vangt hem ook op een telefoon niet af');

    await page.evaluate(() => window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'));
    await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 10000 });
    const smalBlad = await page.evaluate(stand);
    assert.equal(new URL(page.url()).pathname, '/apps/app.html',
      'een app hoort op een telefoon nu een BLAD te zijn en geen paginasprong meer');
    assert.equal(smalBlad.bladen, 1, 'en er staat er een');
    assert.equal(smalBlad.greep, true, 'met een greep voor de lade, want de bank is hier geen vaste rail');
    assert.equal(smalBlad.lade.inBeeld, false, 'die lade ligt dicht tot je hem haalt');

    /* GEEN TABSTRIP BIJ EEN BLAD. Gemeten op 390x844: acht van de twaalf
       werelden dragen een eigen bovenbalk en vijf een eigen onderbalk; met de
       strip erbovenop was 21% van het scherm navigatie, in drie lagen. De
       bovenste had niets te kiezen -- er is geen tweede tabblad. En de greep
       mag niet op het blad komen te liggen: hij hoort in de band die de schil
       onderaan toch al vrijhoudt. */
    assert.equal(smalBlad.tabstrip, 'none', 'met een blad valt er niets te kiezen; de strip hoort weg te zijn');
    /* En het blad loopt door tot de onderrand. Hieronder zat 82px ruimte voor de
       glasconsole, die al niet zichtbaar is -- lege ruimte in de haarlijnkleur,
       zichtbaar als een grijze balk. De greep ligt nu IN de onderbalk van de
       wereld, op dezelfde hoogte als de iconen daar. */
    /* De schilbalk is op een telefoon het enige wat de schil laat zien: de wereld
       begint bovenaan, en onder het blad staat precies die balk -- geen gat, geen
       overlap, en geen tweede navigatielaag boven de kop van de wereld zelf. */
    assert.equal(smalBlad.bladVanaf, 0, 'de wereld hoort bovenaan te beginnen; daar hoort geen schil-chroom meer');
    assert.equal(smalBlad.balk, 48, 'de schilbalk hoort 48px te zijn, kreeg ' + smalBlad.balk);
    assert.equal(smalBlad.bladTotOnder, 48, 'en het blad hoort er precies op te eindigen');
    assert.deepEqual(smalBlad.chips, ['Vandaag*'], 'de balk hoort te tonen waar je bent');
    assert.equal(smalBlad.sluitknop, true, 'met een weg-hier ernaast');

    // de lade halen: dezelfde vijftien deuren als in de rail op een computer
    // (drie werelden boven, twaalf stukken software eronder)
    await page.click('.cmd-lade');
    /* `inBeeld` is de echte vraag en niet display:none -- de bank SCHUIFT, dus
       we wachten tot hij werkelijk in beeld staat, met dezelfde meting die de
       bewering hieronder gebruikt. */
    await wachtTot(page, () => {
      const bank = document.querySelector('.cmd-bank');
      return !!bank && bank.getBoundingClientRect().top < window.innerHeight - 40;
    }, null, { wat: 'de bank die in beeld schuift' });
    const laOpen = await page.evaluate(stand);
    assert.equal(laOpen.lade.inBeeld, true, 'de greep hoort de lade te openen');
    assert.equal(laOpen.lade.werelden, 15, 'met alle deuren erin, net als de rail; er stonden er ' + laOpen.lade.werelden);
    assert.equal(await page.getAttribute('.cmd-lade', 'aria-expanded'), 'true', 'en dat hoort een schermlezer ook te horen');

    /* Escape sluit hem. Zonder dit is de greep de enige uitweg, en dat is het
       soort scherm waar je op een telefoon in vast komt te zitten. */
    await page.keyboard.press('Escape');
    await wachtTot(page, () => {
      const bank = document.querySelector('.cmd-bank');
      return !bank || bank.getBoundingClientRect().top >= window.innerHeight - 40;
    }, null, { wat: 'de bank die weer onder de rand zakt' });
    const laDicht = await page.evaluate(stand);
    assert.equal(laDicht.lade.inBeeld, false, 'Escape hoort de lade te sluiten');
    assert.equal(await page.getAttribute('.cmd-lade', 'aria-expanded'), 'false', 'en de stand hoort mee te gaan');

    // een TWEEDE blad geeft de strip zijn werk terug
    await page.evaluate(() => window.RTGCommand.open('/apps/geld-command.html', 'Geld'));
    await wachtTot(page, () => document.querySelectorAll('.cmd-pane').length === 2,
      null, { wat: 'het tweede blad' });
    const twee = await page.evaluate(stand);
    assert.equal(twee.bladen, 2, 'twee bladen open');
    assert.deepEqual(twee.chips, ['Vandaag', 'Geld*'], 'en de balk toont ze allebei, met de actieve gemarkeerd');

    // en ook hier: het laatste blad dicht = de lege werktafel, niet de klok
    await page.evaluate(() => window.RTGCommand.sluitAlles());
    await page.waitForSelector('#rtgCommand .cmd-leeg', { timeout: 10000 });
    const smalTerug = await page.evaluate(stand);
    assert.equal(smalTerug.bladen, 0, 'het laatste blad sluiten laat de werktafel ook hier leeg staan');
    assert.equal(smalTerug.paneelIngang, true, 'met het bedieningspaneel als ingang in de lade');

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);   // stop() wil het KINDPROCES; srv meegeven doet stil niets
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* HET INLOGSCHERM IS DEZELFDE WERKTAFEL.

   Voor het inloggen staat de bank er al, en de werkvloer draagt Rahuls
   inloggesprek (#gate, hierheen VERPLAATST door shared/command/werktafel.js --
   niet nagebouwd, want twee inlogschermen is er een te veel).

   De reden dat dit een eigen toets heeft: deze verplaatsing zit op de kritieke
   weg. Gaat #gate mee als de werktafel wordt opgeruimd, dan kan er niemand meer
   naar binnen, en dat is geen fout die je pas in productie wilt zien. */
test('inlogscherm: de werktafel is de deur, en een wereld erin opent hem niet',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, dataDir } = await opzet();
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    // Een voorspelbare virtuele voordeur: de passkeyvraag blijft open totdat
    // "Andere manier" hem afbreekt. Zo toetst dit schermgedrag, niet het
    // passkeymagazijn van de machine waarop de toets toevallig draait.
    await page.addInitScript(() => {
      try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: class {} });
      Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get: ({ signal }) => new Promise((resolve, reject) => {
        if (signal) signal.addEventListener('abort', () => reject(new DOMException('afgebroken', 'AbortError')), { once: true });
      }) } });
    });
    // géén token: dit is een bezoeker die nog niets is
    /* Zelfde reden als hierboven: het teken waarop gewacht moet worden staat op
       de volgende regel, niet in het laatste plaatje. */
    await page.goto(srv.base + '/apps/app.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#agPasskey', { timeout: 20000 });
    await page.waitForFunction(() => document.styleSheets.length > 0, null, { timeout: 20000 });

    const uit = await page.evaluate(() => {
      const r = document.getElementById('rtgCommand'), g = document.getElementById('gate');
      const tabs = document.querySelector('.cmd-tabs');
      return {
        stand: r && r.dataset.stand,
        gateInWerkvloer: !!(r && r.querySelector('#gate')),
        gateZichtbaar: !!(g && g.getBoundingClientRect().width > 0),
        veldBestaat: !!document.getElementById('agIn'),
        veldZichtbaar: !!document.getElementById('agIn')?.getBoundingClientRect().width,
        passkeyZichtbaar: !!document.getElementById('agPasskey')?.getBoundingClientRect().width,
        andereManier: !!document.getElementById('agAnders')?.getBoundingClientRect().width,
        werelden: document.querySelectorAll('.cmd-nav button').length,
        paneelIngang: [...document.querySelectorAll('.cmd-bankvoet button')]
          .some(b => /Bedieningspaneel/i.test(b.textContent)),
        tabs: tabs ? getComputedStyle(tabs).display : null,
      };
    });
    assert.equal(uit.stand, 'gesloten', 'voor het inloggen hoort de werktafel in de gesloten stand te staan');
    assert.equal(uit.gateInWerkvloer, true, 'met het inloggesprek IN de werkvloer');
    assert.equal(uit.gateZichtbaar, true, 'en zichtbaar -- verplaatsen mag hem niet verstoppen');
    assert.equal(uit.veldBestaat, true, 'het terugvalveld van Rahul hoort klaar te staan');
    assert.equal(uit.veldZichtbaar, false, 'maar vraagt niet eerst om informatie van de bezoeker');
    assert.equal(uit.passkeyZichtbaar, true, 'de passkey hoort de zichtbare eerste deur te zijn');
    assert.equal(uit.andereManier, true, 'met een veilige terugval voor bestaande accounts');
    /* Twaalf stukken software plus de drie werelden die er sinds WERELD.md
       bovenaan staan. Het getal is geen doel op zich -- wat het bewaakt is dat
       de bank in de gesloten stand LAAT ZIEN wat er achter de deur zit, en dus
       niet stilletjes leegloopt. */
    assert.equal(uit.werelden, 15, 'de bank toont wat er achter de deur zit; er stonden er ' + uit.werelden);
    assert.equal(uit.paneelIngang, false, 'voor het inloggen valt er niets te bedienen: geen systeemdeur in de bank');
    assert.equal(uit.tabs, 'none', 'en geen tabbalk zonder tabbladen: een bediening die niets doet leest als kapot');

    /* EEN WERELD AANRAKEN OPENT GEEN DEUR. Dit is de kern van de keuze: de bank
       is voor het inloggen een uitnodiging, geen menu. Zonder deze stap zou een
       gesloten werktafel met werkende knoppen erdoorheen glippen. */
    await page.click('.cmd-nav button');
    /* Hij hoort GEEN blad te openen maar de cursor op de deur te zetten; dat is
       de toestand om op te wachten -- en die komt, of de bewering zakt. */
    await wachtTot(page, () => document.activeElement && document.activeElement.id === 'agPasskey',
      null, { wat: 'de cursor op de passkeydeur' });
    const na = await page.evaluate(() => ({
      bladen: document.querySelectorAll('.cmd-pane').length,
      pad: location.pathname,
      cursorOpDeur: document.activeElement && document.activeElement.id === 'agPasskey',
    }));
    assert.equal(na.bladen, 0, 'een wereld aanraken mag voor het inloggen geen blad openen');
    assert.equal(na.pad, '/apps/app.html', 'en geen paginasprong worden');
    assert.equal(na.cursorOpDeur, true, 'hij hoort de cursor op de passkeydeur te zetten');

    // De terugval verschijnt pas na de uitdrukkelijke keuze van de bezoeker.
    await page.click('#agAnders');
    await page.waitForSelector('#agIn', { state: 'visible', timeout: 10000 });
    const anders = await page.evaluate(() => ({
      veldZichtbaar: !!document.getElementById('agIn').getBoundingClientRect().width,
      veldActief: document.activeElement && document.activeElement.id === 'agIn',
      passkeyZichtbaar: !!document.getElementById('agPasskey').getBoundingClientRect().width,
      andereZichtbaar: !!document.getElementById('agAnders').getBoundingClientRect().width,
    }));
    assert.equal(anders.veldZichtbaar, true, 'Andere manier opent het bestaande aanmeld- en herstelgesprek');
    assert.equal(anders.veldActief, true, 'met de cursor meteen waar iemand zelf informatie kan geven');
    assert.equal(anders.passkeyZichtbaar, false, 'de eerste deur wijkt dan voor de gekozen terugval');
    assert.equal(anders.andereZichtbaar, false, 'de keuze staat niet dubbel op het scherm');

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE SNELLE DEUR VRAAGT GEEN IDENTITEIT VOORAF.

   De cryptografische ceremonie zelf wordt met een echte P-256-sleutel getoetst
   in webauthn-ceremonie.test.js. Hier gaat het om de browserbedrading: opties
   zonder login ophalen, de eenmalige ceremonie terugsturen en daarna precies
   op de lege wereldkiezer landen. */
test('passkey-first opent zonder e-mailadres en landt op de lege wereldkiezer',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, token, dataDir } = await opzet();
  await tekenOnboarding(srv.base, token);
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  let optiesBody = null, loginBody = null;
  letOpFouten(page, fouten);
  try {
    await page.addInitScript(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: class {} });
      const bytes = () => new Uint8Array([1, 2, 3]).buffer;
      Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get: async () => ({
        id: 'sleutel-uit-toestel', rawId: bytes(), type: 'public-key', getClientExtensionResults: () => ({}),
        response: { authenticatorData: bytes(), clientDataJSON: bytes(), signature: bytes(), userHandle: null }
      }) } });
    });
    await page.route('**/api/webauthn/opties', async route => {
      optiesBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ceremonie: '12345678901234567890123456789012',
        opties: { challenge: 'AQID', rpId: '127.0.0.1', userVerification: 'required', allowCredentials: [] }
      }) });
    });
    await page.route('**/api/webauthn/login', async route => {
      loginBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token }) });
    });

    /* `waitUntil: 'load'` wacht op ELK subverzoek -- elk plaatje, elk lettertype
       -- terwijl de regel eronder al op het echte teken wacht. Dat is meer
       wachten dan de beweringen nodig hebben, en onder belasting viel het om op
       zijn 45 seconden: een rode uitslag zonder dat er iets stuk was. Dezelfde
       vorm als wachten op de klok (TAKEN.md 6.5), met een ander teken ernaast.

       Wat er WEL nodig is: de wereldkiezer staat er, het stijlblad is binnen en
       de balk heeft een echte hoogte -- want er wordt opmaak gemeten (een hoogte
       en een ::after). Precies dat, en niets meer. */
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg', { timeout: 20000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.cmd-balk');
      return document.styleSheets.length > 0 && b && b.getBoundingClientRect().height > 0;
    }, null, { timeout: 20000 });

    assert.equal(optiesBody.login, undefined, 'de eerste optiesvraag bevat geen login');
    assert.equal(optiesBody.email, undefined, 'de eerste optiesvraag bevat geen e-mailadres');
    assert.equal(optiesBody.username, undefined, 'de eerste optiesvraag bevat geen gebruikersnaam');
    assert.deepEqual(Object.keys(optiesBody).filter(k => k !== 'lang'), [],
      'alleen de niet-identificerende taalkeuze mag naast de naamloze optiesvraag meereizen');
    assert.equal(loginBody.login, undefined, 'ook na lokale verificatie wordt geen ingevulde login verzonnen');
    assert.equal(loginBody.ceremonie, '12345678901234567890123456789012', 'de eenmalige serverceremonie gaat ongewijzigd terug');
    assert.equal(loginBody.antwoord.id, 'sleutel-uit-toestel', 'het toestel wijst de passkey aan');
    assert.equal(loginBody.pasApp, 'rtg', 'de pasgrens blijft ook op de snelle deur staan');
    const geland = await page.evaluate(() => ({
      tekst: document.querySelector('.cmd-leeg')?.textContent.trim(),
      bladen: document.querySelectorAll('.cmd-pane').length,
      poortVerborgen: getComputedStyle(document.getElementById('gate')).display === 'none',
    }));
    assert.equal(geland.poortVerborgen, true, 'de passkey sluit de inlogpoort na de echte sessie');
    assert.equal(geland.bladen, 0, 'de snelle deur opent geen demo-activiteit');
    assert.equal(geland.tekst, 'Kies een wereld om te beginnen.');
    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE INLOGROUTE ZELF MOET LANDEN.

   De algemene MutationObserver is hieronder expres inert. Zonder die ingreep
   zou een indirecte class-mutatie dezelfde uitkomst tekenen en kon deze toets
   groen blijven terwijl de inlogroute zelf niets deed. Dit is dus het scherm
   uit de productbeslissing: een terugkerend lid, op telefoonformaat, nul
   geopende bladen en alleen de uitnodiging om zelf een wereld te kiezen. */
test('na inloggen landt een lid rechtstreeks op de lege wereldkiezer',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, token, dataDir } = await opzet();
  await tekenOnboarding(srv.base, token);
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    await page.addInitScript(t => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      window.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
    }, token);
    /* `waitUntil: 'load'` wacht op ELK subverzoek -- elk plaatje, elk lettertype
       -- terwijl de regel eronder al op het echte teken wacht. Dat is meer
       wachten dan de beweringen nodig hebben, en onder belasting viel het om op
       zijn 45 seconden: een rode uitslag zonder dat er iets stuk was. Dezelfde
       vorm als wachten op de klok (TAKEN.md 6.5), met een ander teken ernaast.

       Wat er WEL nodig is: de wereldkiezer staat er, het stijlblad is binnen en
       de balk heeft een echte hoogte -- want er wordt opmaak gemeten (een hoogte
       en een ::after). Precies dat, en niets meer. */
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg', { timeout: 20000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.cmd-balk');
      return document.styleSheets.length > 0 && b && b.getBoundingClientRect().height > 0;
    }, null, { timeout: 20000 });

    const geland = await page.evaluate(() => ({
      tekst: document.querySelector('.cmd-leeg')?.textContent.trim(),
      bladen: document.querySelectorAll('.cmd-pane').length,
      gateVerborgen: getComputedStyle(document.getElementById('gate')).display === 'none',
      appActief: document.getElementById('app').classList.contains('active'),
      balk: Math.round(document.querySelector('.cmd-balk').getBoundingClientRect().height),
      uitnodiging: getComputedStyle(document.querySelector('.cmd-balkbladen'), '::after').content,
    }));
    assert.equal(geland.appActief, true, 'voorwaarde: de sessie is werkelijk hersteld');
    assert.equal(geland.gateVerborgen, true, 'de inlogpoort hoort na de sessie weg te zijn');
    assert.equal(geland.bladen, 0, 'de inlog mag geen wereld of activiteit vooraf openen');
    assert.equal(geland.tekst, 'Kies een wereld om te beginnen.');
    assert.equal(geland.balk, 48, 'onderaan hoort alleen de wereldbalk te staan');
    assert.match(geland.uitnodiging, /Kies een wereld/);
    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
