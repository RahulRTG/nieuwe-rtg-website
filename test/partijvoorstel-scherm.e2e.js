/* DE POLITICAL CONNECTOR IN EEN ECHTE BROWSER: het partijenregister op
   /apps/foundation/kwestiekantoor.html, en de voorstellen bij een kwestie op
   /apps/foundation/kwesties.html.

   test/democratie-partij.test.js bewijst de regels op de routes. Dit bewijst
   dat een mens ze kan volgen zonder de API te kennen:

     1  INSCHRIJVEN. Een kantoormens op naam schrijft een partij in met de bron
        van haar registratie en ziet de sleutel een keer.
     2  PLAATSEN. De partij plaatst met die sleutel een voorstel bij een kwestie
        die de inbrenger openbaar maakte (een actie), en vult een veld van de
        aannamelijst in.
     3  LEZEN. De inbrenger ziet het voorstel bij zijn kwestie met de rest van de
        aannamelijst op onbekend; een ander lid ziet het via de actie; het
        kantoor ziet het bij de kwestie.

   Draai los: node --test test/partijvoorstel-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const OFFICE_CODE = 'PARTIJVOORSTEL-SCHERM';
const TITEL = 'Een verlicht zebrapad bij de basisschool';

test('Partijvoorstel: inschrijven op naam, plaatsen met de sleutel, lezen bij de kwestie',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-partijvoorstel-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
    const post = async (pad, body, token, kop) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, kop || {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const lid = async (naam, n) => {
      const u = String(Date.now()).slice(-8) + n + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: naam, email: 'p' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1988-04-04', tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      return reg.body.token;
    };
    let browser;
    try {
      const A = await lid('Anna Inbreng', 1);
      const B = await lid('Bram Buur', 2);
      const k = (await post('/api/member/democratie/kwestie/inbreng', { onderwerp: 'De oversteek bij de basisschool is onveilig', gebied: 'Kerkbuurt' }, A)).body.kwestie;
      assert.equal((await post('/api/member/democratie/actie/start', { kwestie: k.id, wat: 'Met ouders klaar-overs regelen', zichtbaar: true }, A)).status, 200);
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoormens op naam');

      browser = await pw.chromium.launch(browserOpties(pw));
      const fouten = [];
      const pagina = async (zet) => {
        const c = await browser.newContext({ viewport: { width: 900, height: 1000 } });
        await c.addInitScript((z) => {
          localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl');
          for (const x of Object.keys(z)) localStorage.setItem(x, z[x]);
        }, zet);
        const p = await c.newPage();
        letOpFouten(p, fouten);
        return p;
      };

      /* 1. Inschrijven, eerst zonder bron. */
      const kp = await pagina({ rtg_office_token: kantoor });
      await kp.goto(base + '/apps/foundation/kwestiekantoor.html', { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(kp, /nog geen partij in het register/, { in: '#partijen' });
      await kp.locator('#pAanduiding').fill('Partij Noord');
      await kp.locator('#pNiveau').selectOption('gemeente');
      await kp.locator('#pGecontroleerd').fill('2026-09-29');
      await kp.locator('#pRegistreer').click();
      await wachtOpTekst(kp, /Zeg waar de officiele registratie staat/, { in: '#melding' });
      await kp.locator('#pBron').fill('Register gemeentelijke aanduidingen 2026');
      await kp.locator('#pRegistreer').click();
      await wachtOpTekst(kp, /Ingeschreven/, { in: '#melding' });
      const sleutel = (await kp.locator('#pSleutel code').textContent()).trim();
      assert.match(sleutel, /^PP\.[0-9A-F]{32}$/, 'de sleutel staat een keer op het scherm');
      await wachtOpTekst(kp, /Partij Noord/, { in: '#partijen' });

      /* 2. De partij plaatst met haar sleutel. */
      const kop = { 'x-partij-sleutel': sleutel };
      const pl = await post('/api/democratie/partij/voorstel/plaats', { kwestie: k.id, titel: TITEL,
        tekst: 'Een zebrapad met verlichting en een klaarover in de ochtendspits.', bron: 'Verkiezingsprogramma 2026, par. 4' }, null, kop);
      assert.equal(pl.status, 200, JSON.stringify(pl.body));
      assert.equal((await post('/api/democratie/partij/voorstel/aanname', { id: pl.body.voorstel.id, veld: 'kosten',
        waarde: '40.000 euro', bron: 'Raming wegbeheer 2026' }, null, kop)).status, 200);

      /* 3. De inbrenger leest het bij zijn eigen kwestie. */
      const ap = await pagina({ rtg_member_token: A });
      await ap.goto(base + '/apps/foundation/kwesties.html', { waitUntil: 'domcontentloaded' });
      await ap.locator('details[data-id="' + k.id + '"] summary').first().click();
      await ap.locator('details[data-id="' + k.id + '"] details.voorstellen summary').click();
      const bijKwestie = await tekstVan(ap, 'details[data-id="' + k.id + '"] details.voorstellen');
      assert.match(bijKwestie, new RegExp(TITEL));
      assert.match(bijKwestie, /40\.000 euro/);
      assert.match(bijKwestie, /Wie betaalt het\? onbekend/, 'de rest van de aannamelijst staat op onbekend');
      assert.match(bijKwestie, /voor iedereen gelijk/);

      /* Een ander lid via de actie. */
      const bp = await pagina({ rtg_member_token: B });
      await bp.goto(base + '/apps/foundation/kwesties.html', { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(bp, /Met ouders klaar-overs regelen/, { in: '#acties' });
      await bp.locator('[data-voorstellen="' + k.id + '"]').click();
      await wachtOpTekst(bp, new RegExp(TITEL), { in: '#acties' });

      /* Het kantoor bij de kwestie. */
      await kp.reload({ waitUntil: 'domcontentloaded' });
      await wachtOpTekst(kp, /Kerkbuurt/, { in: '#lijst' });
      await kp.locator('#lijst details.voorstellen summary').first().click();
      assert.match(await tekstVan(kp, '#lijst'), new RegExp(TITEL));
      assert.deepEqual(fouten, [], 'fouten in de browser: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      stop(child);
    }
  });
