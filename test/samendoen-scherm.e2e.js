/* HET DOENETWERK IN EEN ECHTE BROWSER: de kaart "Samen doen" op
   /apps/foundation/kwesties.html, en wat het kantoor ervan ziet.

   test/democratie-doe.test.js bewijst de regels op de routes. Dit bewijst dat
   een lid ze kan volgen zonder de API te kennen, met twee leden in twee
   browsers en het kantoor op naam in een derde:

     1  STARTEN. Zonder het vinkje "mag het onderwerp zien" komt de weigering
        van de server op het scherm; met het vinkje staat de actie open.
     2  AANSLUITEN. Een ander lid ziet de actie met een AANTAL en zonder de naam
        van de starter, en sluit zelf aan.
     3  DE BIJEENKOMST. De starter plant, het andere lid antwoordt "Ik kom".
     4  HET RESULTAAT. De starter legt vast wat er is bereikt, en het kantoor
        leest het bij de kwestie, zonder wie er meededen.

   Draai los: node --test test/samendoen-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const BURGER = '/apps/foundation/kwesties.html';
const KANTOOR = '/apps/foundation/kwestiekantoor.html';
const OFFICE_CODE = 'SAMENDOEN-SCHERM';
const WAT = 'Met ouders klaar-overs regelen voor de ochtendspits';
const BEREIKT = 'Twaalf ouders staan nu elke ochtend bij de oversteek, het rooster loopt tot de zomer.';

test('Samen doen: starten met toestemming, zelf aansluiten, samenkomen en het resultaat bij het kantoor',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samendoen-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const lid = async (naam, n) => {
      const u = String(Date.now()).slice(-8) + n + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: naam, email: 's' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1988-04-04', tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      return { token: reg.body.token, naam };
    };
    const A = await lid('Anna Actie', 1);
    const B = await lid('Bram Buur', 2);
    let browser;
    try {
      const ib = await post('/api/member/democratie/kwestie/inbreng',
        { onderwerp: 'De oversteek bij de basisschool is onveilig in de ochtend', gebied: 'Kerkbuurt' }, A.token);
      const id = ib.body.kwestie && ib.body.kwestie.id;
      assert.match(String(id), /^KW-/, 'de kwestie is ingebracht: ' + JSON.stringify(ib.body).slice(0, 160));
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoormens op naam');

      browser = await pw.chromium.launch(browserOpties(pw));
      const fouten = [];
      const pagina = async (zet) => {
        const c = await browser.newContext({ viewport: { width: 900, height: 1000 } });
        await c.addInitScript((z) => {
          localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl');
          for (const k of Object.keys(z)) localStorage.setItem(k, z[k]);
        }, zet);
        const p = await c.newPage();
        letOpFouten(p, fouten);
        return p;
      };

      /* 1. Starten, eerst zonder toestemming. */
      const ap = await pagina({ rtg_member_token: A.token });
      await ap.goto(base + BURGER, { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(ap, /Er loopt nog geen actie/, { in: '#acties' });
      await ap.locator('details[data-id="' + id + '"] summary').click();
      await ap.locator('[data-samen="' + id + '"]').click();
      await ap.locator('#samenWat').fill(WAT);
      await ap.locator('#samenRollen').fill('ouders, iemand met een hesje');
      await ap.locator('#samenBegin').click();
      await wachtOpTekst(ap, /Bevestig dat eerst/, { in: '#samenMelding' });
      await ap.locator('#samenZichtbaar').check();
      await ap.locator('#samenBegin').click();
      await wachtOpTekst(ap, /De actie staat open/, { in: '#samenMelding' });
      await wachtOpTekst(ap, new RegExp(WAT), { in: '#acties' });
      assert.ok(await ap.locator('#samenStart').evaluate((el) => el.classList.contains('verborgen')), 'het startformulier bleef open staan');

      /* 2. Een ander lid ziet een aantal, geen naam, en sluit zelf aan. */
      const bp = await pagina({ rtg_member_token: B.token });
      await bp.goto(base + BURGER, { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(bp, new RegExp(WAT), { in: '#acties' });
      const gezienDoorB = await tekstVan(bp, '#acties');
      assert.match(gezienDoorB, /1 doet mee/, 'het aantal staat er niet');
      assert.match(gezienDoorB, /Nodig: ouders, iemand met een hesje/, 'de rollen staan er niet');
      assert.ok(!gezienDoorB.includes(A.naam), 'een ander lid ziet wie de actie begon');
      assert.ok(!/ib-[0-9a-f]{6,}|user-/.test(gezienDoorB), 'er staat een nummer of sleutel op het scherm');
      await bp.locator('[data-aansluit]').click();
      await wachtOpTekst(bp, /Je doet mee\. De uitkomst/, { in: '#samenMelding' });
      await wachtOpTekst(bp, /2 doen mee/, { in: '#acties' });

      /* 3. De starter plant, het andere lid komt. */
      await ap.reload({ waitUntil: 'domcontentloaded' });
      await wachtOpTekst(ap, /2 doen mee/, { in: '#acties' });
      await ap.locator('#acties details summary').click();
      await ap.locator('[data-plan-datum]').fill('2026-10-14');
      await ap.locator('[data-plan-tijd]').fill('19:30');
      await ap.locator('[data-plan-waar]').fill('Het buurthuis aan de Kerkstraat');
      await ap.locator('[data-plan-plaatsen]').fill('20');
      await ap.locator('[data-plan]').click();
      await wachtOpTekst(ap, /De bijeenkomst staat in de lijst/, { in: '#samenMelding' });

      await bp.reload({ waitUntil: 'domcontentloaded' });
      await wachtOpTekst(bp, /Het buurthuis aan de Kerkstraat/, { in: '#acties' });
      await bp.locator('[data-antwoord="ja"]').click();
      await wachtOpTekst(bp, /Je antwoord staat erbij/, { in: '#samenMelding' });
      await wachtOpTekst(bp, /1 komen van 20 plaatsen/, { in: '#acties' });
      assert.equal(await bp.locator('[data-antwoord="ja"]').getAttribute('aria-pressed'), 'true', 'het eigen antwoord staat niet aan');

      /* 4. Het resultaat, en wat het kantoor ervan leest. */
      await ap.reload({ waitUntil: 'domcontentloaded' });
      await wachtOpTekst(ap, /1 komen/, { in: '#acties' });
      await ap.locator('#acties details summary').click();
      await ap.locator('#acties textarea').fill(BEREIKT);
      await ap.locator('[data-resultaat]').click();
      await wachtOpTekst(ap, /Het resultaat staat bij je kwestie/, { in: '#samenMelding' });
      await wachtOpTekst(ap, /Resultaat vastgelegd/i, { in: '#acties' });

      const kp = await pagina({ rtg_office_token: kantoor });
      await kp.goto(base + KANTOOR, { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(kp, new RegExp(BEREIKT.slice(0, 30)), { in: '#lijst' });
      const kantoorTekst = await tekstVan(kp, '#lijst');
      assert.match(kantoorTekst, /2 doen mee/, 'het kantoor ziet niet hoeveel mensen meededen');
      assert.ok(!kantoorTekst.includes(A.naam) && !kantoorTekst.includes(B.naam), 'het kantoor ziet wie er meededen');
      assert.deepEqual(fouten, [], 'fouten in de browser: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      stop(child);
    }
  });
