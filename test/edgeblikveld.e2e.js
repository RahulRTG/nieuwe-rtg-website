/* HET EDGE BLIKVELD IN EEN ECHTE BROWSER, OP EEN ECHTE SERVER.

   test/edgeblikveld.test.js houdt de vorm vast met een nagemaakt venster. Wat
   alleen een echte schil kan laten zien, staat hier:

   1. de LAADKETEN: shared/rtg-adaptive-edge-loader.js brengt actiestaat.js en
      blikveld.js mee, dus het blikveld bestaat waar de Edge bestaat;
   2. de WERELD volgt het open blad van de schil (en zegt op de lege tafel met
      reden dat er nog geen wereld is gekozen);
   3. de BRUG: wat een scherm in zijn blad als context publiceert -- ook het
      nieuwe object en de activiteit -- komt in het blikveld van de schil aan,
      met de herkomst `blad`: in de schil is het de brug die doorgeeft wat het
      blad zei, en niet een scherm dat het zelf publiceert (ronde 2);
   4. het ENE LEESPAD: de balk tekent de handelingen die acties() geeft, en elke
      handeling draagt een Edge-stand;
   5. lees() SCHRIJFT NIETS, ook niet in een echte pagina met alle lagen geladen;
   6. een scherm op zichzelf: de hoofdactie die het aanwijst, en het gebrek als
      de Edge een ANDERE hoofdactie toont (agenda: "+ Afspraak" tegenover
      "Nieuwe afspraak").

   7. de GEWICHTLAAG reist mee met de balk: op een los scherm met een register
      (Office) opent een `bewust`-handeling in het Edge-blad de lade en gaat pas
      na bevestigen door, en een verhinderde knop zegt waarom.
   4b. de HOOFDACTIE VAN HET ACTIEVE BLAD (ronde 1): de schil leest hem uit het
      blad dat open is, en onthoudt niets; stap 5 verklikt ook in dat blad.
   8. het TWEEDE REGISTER kent alleen licht (ronde 1): een zware handeling via
      registerAction wordt geweigerd, en een tik op een lichte gaat precies een
      keer langs RTGGewicht.voer -- niet meer langs window.confirm.

   DE MUTATIES, elk nagetrokken: laat de loader blikveld.js niet laden (1 zakt),
   haal object uit zendContext in brug.js (3 zakt), laat de controls weer zelf
   RTGAdaptief.voorNu() lezen (4 zakt: de balk tekent dan een handeling die
   acties() als AFWEZIG weglaat), laat de agendahoofdactie wegvallen (6 zakt),
   laat de loader de gewichtlaag overslaan (7 zakt), haal '.actief' uit de
   selector van de hoofdactielezer (4b zakt: hij blijft op 'blad'), laat hem het
   laatste label onthouden (4b zakt bij de terugkeer naar reizen), zet een
   setAttribute in zijn tekstVan (5 zakt: de verklikker in het blad slaat aan), en zet in
   rtg-adaptive-edge.js de oude execute met custom.run() terug (8 zakt: de
   spion op RTGGewicht.voer blijft op nul).

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Blikveld Proef', email: 'blikveld' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then((x) => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then((x) => x.json());
  const t = await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Blikveld Proef', akkoord: true, contractVersion: status.contract.versie }) });
  assert.equal(t.status, 200, 'de proefgebruiker hoort de overeenkomst te kunnen tekenen');
  return r.token;
}

test('het blikveld in de schil en op een los scherm: wereld, brug, leespad, hoofdactie -- en het schrijft niets',
  { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-blikveld-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const token = await lid(srv.base);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg', { timeout: 20000 });

    // 1) De laadketen brengt het blikveld mee.
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGEdgeActiestaat, null, { timeout: 20000 });
    const leeg = await page.evaluate(() => RTGEdgeBlikveld.lees().velden.wereld);
    // 2) Op de lege tafel is er nog geen wereld, en dat staat er met reden.
    assert.equal(leeg.waarde, null);
    assert.equal(leeg.herkomst, 'blad');
    assert.match(leeg.reden, /geen blad/);

    await page.locator('.cmd-leeg button[data-url="/apps/reizen.html"]').click();
    const blad = () => page.frames().find((f) => /\/apps\/reizen\.html/.test(f.url()));
    await page.waitForFunction(() => document.body.getAttribute('data-rtg-blad-wereld') === 'travel', null, { timeout: 20000 });
    await page.waitForFunction(() => RTGEdgeBlikveld.lees().velden.context.herkomst === 'blad', null, { timeout: 20000 });
    let l = await page.evaluate(() => RTGEdgeBlikveld.lees());
    assert.deepEqual([l.velden.wereld.waarde, l.velden.wereld.herkomst], ['travel', 'blad']);
    assert.equal(l.velden.context.waarde.bron, 'reizen.tabs', 'de context van het blad komt via de brug in de schil');

    // 3) Object en activiteit gaan mee over de brug.
    await blad().evaluate(() => {
      const c = RTGAdaptief.context();
      RTGAdaptief.context({ bron: c.bron, titel: c.titel, acties: c.acties, selectie: c.selectie, staat: c.staat,
        rail: c.rail, object: { soort: 'reis', id: 'proef-1' }, activiteit: 'plannen' });
    });
    await page.waitForFunction(() => RTGEdgeBlikveld.lees().velden.activiteit.waarde === 'plannen', null, { timeout: 10000 });
    l = await page.evaluate(() => RTGEdgeBlikveld.lees());
    assert.deepEqual(l.velden.object.waarde, { soort: 'reis', id: 'proef-1', label: '', velden: {} }, 'een object is een verwijzing (shared/objectverwijzing.js)');
    assert.deepEqual([l.velden.object.herkomst, l.velden.activiteit.herkomst], ['blad', 'blad'],
      'in de schil komt het object uit het blad, niet van een scherm dat hier zelf publiceert');

    // 4) De balk tekent wat acties() geeft, en elke handeling draagt een stand.
    /* De handelingen staan in het blad van de Edge, en dat tekent alleen als het
       open is -- zoals een mens het opent. */
    await page.evaluate(() => RTGAdaptiveEdge.setState('expanded'));
    await page.waitForFunction(() => [...document.querySelectorAll('.rtg-adaptive-controls [data-cap]')]
      .some((b) => /^reizen\./.test(b.dataset.cap)), null, { timeout: 10000 });
    const beeld = await page.evaluate(() => ({
      acties: RTGEdgeBlikveld.acties().map((a) => ({ id: a.id, staat: a.edge && a.edge.staat })),
      balk: [...document.querySelectorAll('.rtg-adaptive-controls [data-cap]')].map((b) => b.dataset.cap)
    }));
    assert.ok(beeld.acties.length >= 2, 'TravelOS hoort handelingen te publiceren');
    assert.ok(beeld.acties.every((a) => ['BESCHIKBAAR', 'GEBLOKKEERD', 'LOPEND'].includes(a.staat)), JSON.stringify(beeld.acties));
    for (const id of beeld.balk) assert.ok(beeld.acties.some((a) => a.id === id), 'de balk tekent ' + id + ' buiten het leespad om');
    /* Het leespad is bindend: een handeling die het blikveld AFWEZIG noemt, verdwijnt
       van de balk. Een serveroordeel dat dat zegt bestaat nog niet (EDGE.md), dus
       zet de proef de stand zelf en laat de context een keer veranderen. */
    const weg = beeld.acties[0].id;
    await page.evaluate((id) => {
      const oud = RTGEdgeActiestaat.bepaal;
      window.RTGEdgeActiestaat = Object.assign({}, RTGEdgeActiestaat, {
        bepaal(i, g) { const u = oud(i, g); if (i.id === id) u.staat = 'AFWEZIG'; return u; } });
      RTGAdaptief.context(Object.assign({}, RTGAdaptief.context(), { titel: RTGAdaptief.context().titel + ' ' }));
    }, weg);
    await page.waitForFunction((id) => document.querySelector('.rtg-adaptive-controls [data-cap]') &&
      ![...document.querySelectorAll('.rtg-adaptive-controls [data-cap]')].some((b) => b.dataset.cap === id), weg, { timeout: 10000 });

    /* 4b) De hoofdactie van het ACTIEVE blad (ronde 1, stap 5). Reizen wijst er
       geen aan: dan zegt het blikveld 'blad' met de reden, en leent het de knop
       van de schil NIET. De agenda wijst '+ Afspraak' aan, en die komt uit het
       blad. Terug naar reizen: weer 'blad' -- er wordt niets onthouden. */
    l = await page.evaluate(() => RTGEdgeBlikveld.lees());
    assert.equal(l.velden.hoofdactie.herkomst, 'blad', 'reizen wijst geen hoofdactie aan');
    assert.match(l.velden.hoofdactie.reden, /padtabel/);
    const agendaBlad = async () => {
      await page.evaluate(() => RTGCommand.open('/apps/agenda.html'));
      await page.waitForFunction(() => RTGEdgeBlikveld.lees().velden.hoofdactie.herkomst === 'blad:data-hoofdactie', null, { timeout: 20000 });
    };
    await agendaBlad();
    l = await page.evaluate(() => RTGEdgeBlikveld.lees());
    assert.equal(l.velden.hoofdactie.waarde.label, '+ Afspraak', 'de hoofdactie komt uit het actieve blad');
    assert.ok(!l.gebreken.includes('hoofdactie-dubbel'), 'de schil toont geen eigen primary die iets anders zegt');
    await page.evaluate(() => RTGCommand.open('/apps/reizen.html'));
    await page.waitForFunction(() => RTGEdgeBlikveld.lees().velden.hoofdactie.herkomst === 'blad', null, { timeout: 20000 });
    await agendaBlad();

    // 5) lees() schrijft niets: geen opslag, geen attribuut, geen bericht -- ook niet in het blad.
    const schrijfsels = await page.evaluate(() => {
      const log = [], frame = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const vensters = [window, frame && frame.contentWindow].filter(Boolean);
      const bewaar = vensters.map((v) => [v.Storage.prototype.setItem, v.Element.prototype.setAttribute, v.postMessage, v.fetch]);
      vensters.forEach((v, i) => {
        v.Storage.prototype.setItem = function () { log.push(i + ':setItem'); };
        v.Element.prototype.setAttribute = function () { log.push(i + ':setAttribute'); };
        v.postMessage = function () { log.push(i + ':postMessage'); };
        v.fetch = function () { log.push(i + ':fetch'); return Promise.reject(new Error('x')); };
      });
      let herkomst = null;
      try { RTGEdgeBlikveld.lees(); herkomst = RTGEdgeBlikveld.lees().velden.hoofdactie.herkomst; }
      finally {
        vensters.forEach((v, i) => { [v.Storage.prototype.setItem, v.Element.prototype.setAttribute, v.postMessage, v.fetch] = bewaar[i]; });
      }
      return { log, vensters: vensters.length, herkomst };
    });
    /* De verklikker beproeft alleen een weg die in deze run echt gelopen is. */
    assert.equal(schrijfsels.vensters, 2, 'de verklikker hoort ook in het blad te staan');
    assert.equal(schrijfsels.herkomst, 'blad:data-hoofdactie', 'de lezing hoort echt in het blad te kijken');
    assert.deepEqual(schrijfsels.log, [], 'het blikveld schreef iets');

    // 6) Een los scherm: de hoofdactie die het aanwijst, en de dubbele hoofdactie als gebrek.
    await page.goto(srv.base + '/apps/agenda.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.RTGEdgeBlikveld && RTGEdgeBlikveld.lees().velden.hoofdactie.waarde, null, { timeout: 20000 });
    l = await page.evaluate(() => RTGEdgeBlikveld.lees());
    assert.equal(l.velden.hoofdactie.herkomst, 'scherm:data-hoofdactie');
    assert.equal(l.velden.hoofdactie.waarde.label, '+ Afspraak');
    assert.deepEqual([l.velden.wereld.waarde, l.velden.wereld.herkomst], ['living', 'route']);
    await page.waitForFunction(() => RTGEdgeBlikveld.lees().gebreken.includes('hoofdactie-dubbel'), null, { timeout: 10000 });

    /* 7) De gewichtlaag reist mee met de balk. Op een los scherm met een register
       (Office buiten de schil) deed een `bewust`-handeling in het Edge-blad
       niets, en een verhinderde knop zei alleen zijn naam: de lader bracht de
       knoppen mee maar niet gewicht.js en waarom.js. */
    const office = async () => {
      await page.goto(srv.base + '/apps/office.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction(() => window.RTGAdaptief && window.RTGAdaptiveEdge && window.RTGGewicht && window.RTGWaarom,
        null, { timeout: 20000 });
    };
    await office();
    const zet = (acties, staat) => page.evaluate(([a, st]) => {
      const vorm = { telefoon: ['balk'], tablet: ['balk'], bureau: ['werkbalk'] };
      window.gedaan = window.gedaan || [];
      RTGAdaptief.declareer(Object.assign({ id: 'proef.deel', naam: 'Proef delen', gewicht: 'bewust',
        doe: () => window.gedaan.push('deel') }, vorm));
      RTGAdaptief.declareer(Object.assign({ id: 'proef.nee', naam: 'Proef nee', doe: () => window.gedaan.push('nee') }, vorm));
      RTGAdaptief.context({ bron: 'proef', titel: 'Proef', acties: a, staat: st });
      RTGAdaptiveEdge.setState('expanded');
    }, [acties, staat]);
    await zet(['proef.deel'], {});
    await page.locator('.rtg-adaptive-controls [data-cap="proef.deel"]').click();
    await page.waitForSelector('.gw-ga', { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => window.gedaan), [], 'een bewuste handeling gaat niet door voordat de lade is bevestigd');
    await page.locator('.gw-ga').click();
    await page.waitForFunction(() => window.gedaan.length === 1, null, { timeout: 10000 });
    await office();
    await zet(['proef.nee'], { 'proef.nee': { verhinderd: { reden: 'Dit document is Strikt geclassificeerd.', bron: 'classificatie' } } });
    await page.locator('.rtg-adaptive-controls [data-cap="proef.nee"]').click();
    await page.waitForFunction(() => document.body.innerText.includes('Strikt geclassificeerd'), null, { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => window.gedaan), [], 'een verhinderde handeling legt uit en voert niets uit');

    // 8) Het tweede register kent alleen licht, en een tik gaat langs de gewichtlaag.
    await office();
    const zwaar = await page.evaluate(() => {
      window.tweede = { gedraaid: 0, gewogen: [] };
      const echt = RTGGewicht.voer;
      RTGGewicht.voer = function (it) { window.tweede.gewogen.push(it.gewicht); return echt.apply(this, arguments); };
      return RTGAdaptiveEdge.registerAction({ id: 'proef-zwaar', label: 'Proef zwaar', gewicht: 'zwaar', run: () => { window.tweede.gedraaid++; } });
    });
    assert.equal(zwaar, false, 'een zware handeling hoort het tweede register niet in te komen');
    await page.evaluate(() => {
      RTGAdaptiveEdge.registerAction({ id: 'proef-licht', label: 'Proef licht', run: () => { window.tweede.gedraaid++; } });
      RTGAdaptiveEdge.setProjection({ deck: 'actions', actions: ['proef-zwaar', 'proef-licht'], open: true });
    });
    assert.equal(await page.locator('.rtg-adaptive-sheet-list [data-rtg-adaptive-action="proef-zwaar"]').count(), 0,
      'een geweigerde handeling staat niet in het blad');
    await page.locator('.rtg-adaptive-sheet-list [data-rtg-adaptive-action="proef-licht"]').click();
    await page.waitForFunction(() => window.tweede.gedraaid === 1, null, { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => window.tweede.gewogen), ['licht'],
      'een tik op het tweede register gaat precies een keer langs RTGGewicht.voer, als licht');

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
