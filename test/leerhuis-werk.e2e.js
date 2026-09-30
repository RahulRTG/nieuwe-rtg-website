/* LEERHUIS: AAN HET WERK, IN EEN ECHTE BROWSER (ACADEMY.md, fase B-UI).

   test/leerhuis-routes.test.js toets 11 bewijst dat het werk over de deur komt;
   deze toets bewijst dat het scherm er iets mee DOET, met de weigering van de
   server in woorden en zonder dat het scherm zelf beslist:

   1. WIE GEEN ROL HEEFT, ziet geen werk en een zin die zegt waarom -- geen
      lege vakken en geen knoppen die toch geweigerd worden.
   2. EEN KENNISEIGENAAR ziet het concept uit het startpakket, zet het ter
      review, en ziet dan dat HIJ het niet activeert als hij het zelf laadde:
      daar staat een zin, geen knop.
   3. EEN TWEEDE KENNISEIGENAAR activeert het. Zonder eigen bron weigert de
      server, en die weigering staat op het scherm; met bron wordt het
      officiele kennis en verdwijnt het uit het werk.
   4. DE EIGENAAR wijst een nieuwe collega aan op codenaam, met een reden, en
      de collega ziet die opzoeking op zijn eigen inzagekaart.
   5. DE EIGENAAR trekt een rol in (zonder reden geweigerd) en meldt iemand
      uit dienst -- pas na een vinkje dat zegt wat er vervalt.

   Draai los: node --test test/leerhuis-werk.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, kantoorAlsPersoon } = require('./helper');

const pw = laadPlaywright();

test('Leerhuis aan het werk: geen rol geen werk, en een startpakketconcept wordt pas officieel met de eigen bron',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerhuis-werk-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const lid = async (n, mail, tel) => (await post('/api/auth/register', { name: n, email: mail, phone: tel,
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
    const idVan = async (tok) => (await post('/api/state', {}, tok)).body.state.user.id;
    const ORG = 'RTG-WERK';

    let browser;
    try {
      const E = await lid('Werk Eigenaar', 'lhw-e@x.nl', '0612349801');
      const K = await lid('Werk Kennis', 'lhw-k@x.nl', '0612349802');
      const L = await lid('Werk Lader', 'lhw-l@x.nl', '0612349803');
      const G = await lid('Werk Geen', 'lhw-g@x.nl', '0612349804');
      const [eId, kId, lId, gId] = [await idVan(E), await idVan(K), await idVan(L), await idVan(G)];

      const login = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body;
      const vz = (await post('/api/techniek/functie', { id: 'leerhuis', aan: true }, login.token)).body;
      if (vz.status === 'wacht') await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, login.token);
      const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
      assert.equal((await post('/api/office/leerhuis/open', { id: ORG, soort: 'RTG', naam: 'Werk', eigenaar: 'user-' + eId }, office)).status, 200);
      const doe = (tok, actie, invoer, sleutel) => post('/api/leerhuis/doe', { org: ORG, actie, invoer, sleutel }, tok);
      for (const [id, s] of [[kId, 'k'], [lId, 'l'], [gId, 'g']])
        assert.equal((await doe(E, 'relatieZet', { persoon: 'lid:' + id, soort: 'EMPLOYEE' }, 'rel-' + s)).status, 200);
      assert.equal((await doe(E, 'bestuurZet', { persoon: 'lid:' + lId, rol: 'CURRICULUM_OWNER' }, 'b-l-co')).status, 200);
      assert.equal((await doe(E, 'bestuurZet', { persoon: 'lid:' + lId, rol: 'KNOWLEDGE_OWNER' }, 'b-l-ko')).status, 200);
      assert.equal((await doe(E, 'bestuurZet', { persoon: 'lid:' + kId, rol: 'KNOWLEDGE_OWNER' }, 'b-k-ko')).status, 200);
      assert.equal((await doe(L, 'startpakketLaden', {}, 'pakket')).status, 200);

      browser = await pw.chromium.launch(browserOpties());
      const opScherm = async (token, adres) => {
        const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
        await ctx.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} }, token);
        const page = await ctx.newPage();
        letOpFouten(page);
        await page.goto(base + (adres || '/apps/leerhuis-werk.html') + '?org=' + ORG, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !/wordt geladen/.test(document.getElementById('melding').textContent));
        return page;
      };
      const kaart = (page, titel) => page.locator('#kennis .kaart', { hasText: titel });

      /* 1. Geen rol, geen werk. */
      const g = await opScherm(G);
      assert.equal(await g.isVisible('#geenRol'), true, 'wie geen rol heeft, krijgt een zin en geen lege vakken');
      for (const blok of ['#trainerBlok', '#assessorBlok', '#kennisBlok']) assert.equal(await g.isVisible(blok), false, blok);

      /* 2. De lader zet het concept ter review, en activeert het niet zelf. */
      const l = await opScherm(L);
      assert.equal(await l.isVisible('#kennisBlok'), true);
      await kaart(l, 'Werken met codenamen').getByRole('button', { name: 'Ter review' }).click();
      await l.waitForFunction(() => /Ter review gezet/.test(document.getElementById('melding').textContent));
      await kaart(l, 'Werken met codenamen').getByText('U schreef dit concept').waitFor();
      assert.equal(await kaart(l, 'Werken met codenamen').getByRole('button', { name: 'Activeren' }).count(), 0,
        'wie het concept laadde, krijgt geen knop om het zelf te activeren');

      /* 3. Een tweede kenniseigenaar: zonder bron weigert de server, met bron wordt het officieel. */
      const k = await opScherm(K);
      const c = kaart(k, 'Werken met codenamen');
      await c.getByRole('button', { name: 'Activeren' }).click();
      await k.waitForFunction(() => /Niet gelukt: .*eigen bron/.test(document.getElementById('melding').textContent));
      await c.getByLabel('Bron van uw organisatie').fill('privacyprotocol RTG Operations 2026');
      await c.getByRole('button', { name: 'Activeren' }).click();
      await k.waitForFunction(() => /Geactiveerd/.test(document.getElementById('melding').textContent));
      assert.equal(await kaart(k, 'Werken met codenamen').count(), 0, 'geactiveerde kennis wacht niet meer');
      const st = (await post('/api/leerhuis/lees', { org: ORG, vraag: 'grond', tekst: 'codenamen' }, K)).body.antwoord;
      assert.ok(JSON.stringify(st).includes('privacyprotocol RTG Operations 2026'), 'de eigen bron staat bij de officiele kennis: ' + JSON.stringify(st));
      assert.doesNotMatch(await k.textContent('main'), /\d+\s*%|score/i, 'geen cijfer op een mens');

      /* 3b. Een voorstel uit de praktijk: G (geen rol) dient in op Mijn leerhuis, K
         behandelt het zonder te zien wie het was, schrijft de nieuwe versie, L
         activeert die, en pas dan staat het voorstel op uitgevoerd. */
      const melding = (page, re) => page.waitForFunction((b) => { const t = document.getElementById('melding').textContent;
        return !/^Bezig/.test(t) && new RegExp(b).test(t); }, re.source);
      const gm = await opScherm(G, '/apps/leerhuis.html');
      const vf = gm.locator('#voorstellen .kaart', { hasText: 'Een voorstel doen' });
      await vf.getByLabel('Over welk kennisitem').selectOption({ label: 'Werken met codenamen' });
      await vf.getByLabel('Wat gaat er mis').fill('de uitleg noemt de kluis niet');
      await vf.getByLabel('Wat u voorstelt').fill('noem de kluis bij naam');
      await vf.getByRole('button', { name: 'Voorstel indienen' }).click();
      await melding(gm, /Niet gelukt: een voorstel noemt reden/);
      await vf.getByLabel('Waarom dat beter is').fill('nieuwe collega zoeken de echte naam');
      await vf.getByRole('button', { name: 'Voorstel indienen' }).click();
      await melding(gm, /Voorstel ingediend/);
      const gv = gm.locator('#voorstellen .kaart', { hasText: 'Voorstel: Werken met codenamen' });
      await gv.getByText('ingediend').waitFor();

      await k.reload({ waitUntil: 'domcontentloaded' });
      const kv = k.locator('#voorstellen .kaart', { hasText: 'Voorstel: Werken met codenamen' });
      await kv.getByText('Probleem: de uitleg noemt de kluis niet').waitFor();
      const gCode = (await post('/api/state', {}, G)).body.state.user.codename;
      assert.ok(!(await kv.textContent()).includes(gCode), 'wie indiende staat er niet bij');
      for (const [knop, re] of [['Oppakken', /Oppakken: voorstel/], ['In review nemen', /In review nemen: voorstel/]]) {
        await kv.getByRole('button', { name: knop }).click(); await melding(k, re);
      }
      await kv.getByLabel('Toelichting voor de indiener').fill('goed punt, we passen de tekst aan');
      await kv.getByRole('button', { name: 'Goedkeuren' }).click();
      await melding(k, /Goedkeuren: voorstel/);
      await kv.getByLabel('Nieuwe tekst van Werken met codenamen').fill('Echte namen staan in de kluis; hier werk je op codenaam.');
      await kv.getByLabel('Bron van de nieuwe versie').fill('privacyprotocol RTG Operations 2026, par. 2');
      await kv.getByRole('button', { name: 'Nieuwe versie schrijven' }).click();
      await melding(k, /Nieuwe versie geschreven van Werken met codenamen/);
      await kv.getByRole('button', { name: 'Uitgevoerd' }).click();
      await melding(k, /Niet gelukt: een voorstel is pas uitgevoerd als er een ACTIVE kennisversie naar verwijst/);

      await l.reload({ waitUntil: 'domcontentloaded' });
      await kaart(l, 'Werken met codenamen').getByRole('button', { name: 'Ter review' }).click();
      await melding(l, /Ter review gezet/);
      await kaart(l, 'Werken met codenamen').getByLabel('Impact op wie de vorige versie leerde').selectOption('INFORMATION_ONLY');
      await kaart(l, 'Werken met codenamen').getByRole('button', { name: 'Activeren' }).click();
      await melding(l, /Geactiveerd/);

      await k.reload({ waitUntil: 'domcontentloaded' });
      await kv.getByRole('button', { name: 'Uitgevoerd' }).click();
      await melding(k, /Uitgevoerd: voorstel/);
      await kv.getByLabel('Wat de meting liet zien').fill('geen vragen meer over echte namen in de eerste week');
      await kv.getByRole('button', { name: 'Meting vastleggen' }).click();
      await melding(k, /Meting vastleggen: voorstel/);
      assert.equal(await kv.count(), 0, 'een gemeten voorstel wacht niet meer');
      await gm.reload({ waitUntil: 'domcontentloaded' });
      await gv.getByText('gemeten').waitFor();

      /* 4. De eigenaar wijst een nieuwe collega aan op codenaam: een onbekende
         codenaam en een ontbrekende reden weigert de server met de reden op het
         scherm; daarna staan relatie en bestuursrol, en de collega ziet de
         opzoeking op zijn inzagekaart. */
      const V = await lid('Werk Nieuw', 'lhw-v@x.nl', '0612349805');
      const vCode = (await post('/api/state', {}, V)).body.state.user.codename;
      const e = await opScherm(E);
      const rel = e.locator('#eigenaar .kaart', { hasText: 'Relatie vastleggen' });
      const bst = e.locator('#eigenaar .kaart', { hasText: 'Bestuursrol toekennen' });
      await rel.getByLabel('Codenaam', { exact: true }).fill('Bestaat Niet 0000');
      await rel.getByLabel('Reden van de opzoeking').fill('nieuwe collega bij Werk');
      await rel.getByRole('button', { name: 'Relatie vastleggen' }).click();
      await e.waitForFunction(() => /Niet gelukt: Er is geen lid met codenaam/.test(document.getElementById('melding').textContent));
      await rel.getByLabel('Codenaam', { exact: true }).fill(vCode);
      await rel.getByLabel('Reden van de opzoeking').fill('');
      await rel.getByRole('button', { name: 'Relatie vastleggen' }).click();
      await e.waitForFunction(() => /Niet gelukt: .*reden/.test(document.getElementById('melding').textContent));
      await rel.getByLabel('Reden van de opzoeking').fill('nieuwe collega bij Werk');
      await rel.getByRole('button', { name: 'Relatie vastleggen' }).click();
      await e.waitForFunction(() => /^Relatie vastgelegd/.test(document.getElementById('melding').textContent));
      await bst.getByLabel('Codenaam', { exact: true }).fill(vCode);
      await bst.getByLabel('Bestuursrol').selectOption('KNOWLEDGE_OWNER');
      await bst.getByLabel('Reden van de opzoeking').fill('tweede kenniseigenaar voor Werk');
      await bst.getByRole('button', { name: 'Bestuursrol toekennen' }).click();
      await e.waitForFunction(() => /^Bestuursrol toegekend: kenniseigenaar/.test(document.getElementById('melding').textContent));
      await e.locator('#eigenaar .kaart', { hasText: vCode }).getByText('kenniseigenaar').waitFor();
      assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'kennisWerk' }, V)).body.antwoord.ok, true,
        'de aangewezen collega is kenniseigenaar, op de sleutel die de server erbij zocht');
      const kaartV = JSON.stringify((await post('/api/inzagekaart', {}, V)).body);
      assert.ok(kaartV.includes('nieuwe collega bij Werk') && kaartV.includes('tweede kenniseigenaar voor Werk'),
        'beide opzoekingen staan op de inzagekaart van de collega');
      assert.doesNotMatch(await e.textContent('main'), /Werk Nieuw/, 'de echte naam staat nergens op het scherm');

      /* 5. De eigenaar trekt een rol in (met reden) en meldt iemand uit dienst
         (pas na het vinkje dat zegt wat er vervalt). */

      assert.equal((await doe(E, 'rolToewijzen', { persoon: 'lid:' + gId, rol: 'pakket-rol-start' }, 'rol-g')).status, 200);
      await e.reload({ waitUntil: 'domcontentloaded' });
      await e.waitForFunction(() => !/wordt geladen/.test(document.getElementById('melding').textContent));
      const gk = () => e.locator('#eigenaar .kaart', { hasText: gCode }).filter({ hasText: 'Uit dienst melden' });
      await gk().getByRole('button', { name: 'Rol Medewerker RTG Operations intrekken' }).click();
      await e.waitForFunction(() => /^Niet gelukt: .*reden/.test(document.getElementById('melding').textContent));
      await gk().getByLabel('Reden (bij intrekken verplicht)').fill('andere functie');
      await gk().getByRole('button', { name: 'Rol Medewerker RTG Operations intrekken' }).click();
      await e.waitForFunction(() => /^Rol ingetrokken: Medewerker RTG Operations/.test(document.getElementById('melding').textContent));
      await gk().getByText('Nog geen rol.').waitFor();
      const vk = () => e.locator('#eigenaar .kaart', { hasText: vCode }).filter({ hasText: 'Uit dienst melden' });
      await vk().getByRole('button', { name: 'Uit dienst melden' }).click();
      await e.waitForFunction(() => /Vink eerst aan/.test(document.getElementById('melding').textContent));
      assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'kennisWerk' }, V)).body.antwoord.ok, true, 'zonder vinkje is er niets gebeurd');
      await vk().getByText('Ik weet dat rollen').click();
      await vk().getByRole('button', { name: 'Uit dienst melden' }).click();
      await e.waitForFunction(() => /^Uit dienst gemeld/.test(document.getElementById('melding').textContent));
      assert.notEqual((await post('/api/leerhuis/lees', { org: ORG, vraag: 'kennisWerk' }, V)).status, 200,
        'wie uit dienst is, heeft geen relatie en leest hier niets meer');
      assert.equal(await e.locator('#eigenaar .kaart', { hasText: vCode }).filter({ hasText: 'Uit dienst melden' }).count(), 0);
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
