/* Browsercomponentproef: echte Geld-bediening, Express-routes en bestaande
   aanvraag-/aanbodkern. De accountsession en betaalprovider zijn fixtures;
   deze proef claimt geen live Stripe-koppeling of volledige servervrijgave. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), crypto = require('node:crypto'), express = require('../server/web');
const { fixture } = require('./abonnementsaanbod-fixture.cjs');
const { laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), BASIS = '/api/mijn/abonnement/automatisch/';

async function omgeving(t, { aan = true, onzeker = false } = {}) {
  const f = fixture(), calls = [], fouten = [], app = express();
  f.stand.at = new Date().toISOString();
  Object.assign(f.accounts, { sleutelVoor: () => Buffer.alloc(32, 8), emailOf: () => 'amber@fixture.test',
    verifyToken: tok => tok === 'fixture-1' ? f.users.get(1) : null });
  const intake = require('../server/kern/aanmeldingen')({ db: f.db, accounts: f.accounts,
    bewerkCollectie: f.opties.bewerkCollectie, crypto, save() {},
    schoon: (x, n) => String(x ?? '').replace(/[<>]/g, '').trim().slice(0, n) }).aanmeldingen;
  const betaald = new Set();
  const automatisch = { ...f.motor,
    mijn(id) {
      const r = f.motor.mijn(id);
      return { ...r, contracten: r.contracten.map(c => ({ ...c,
        betaalstand: betaald.has(c.id) ? { status: 'WACHT_OP_KLANT', checkoutUrl: 'https://checkout.stripe.com/c/fixture' } : {},
        ...(f.stand.projectie || {}) })) };
    },
    betaal(id, input) { betaald.add(input.contractId); return { ok: true, status: 'WACHT_OP_KLANT' }; },
    herstel() { return { ok: true, status: 'WACHT_OP_KLANT' }; } };
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) calls.push({ pad: req.path, body: req.body });
    if (onzeker && req.path === BASIS + 'aanbod') {
      onzeker = false;
      const json = res.json.bind(res);
      res.json = r => {
        if (r.ok) { res.status(503); return json({ error: 'Fixture: antwoord na commit weggevallen.' }); }
        return json(r);
      };
    }
    next();
  });
  const aanvragerVan = require('../server/routes/aanmeldingen/aanvraag')({ app, accounts: f.accounts, aanmeldingen: intake });
  const auth = (req, res, next) => aanvragerVan(req) ? next() : res.status(401).json({ error: 'Geen fixturesessie' });
  require('../server/routes/aanmeldingen/automatisch')({ app, auth, aanvragerVan, aanmeldingen: { automatisch },
    env: { RTG_ABONNEMENTEN_ZELFSERVICE: aan ? '1' : '0' } });
  app.use('/apps/geld', express.static(path.join(__dirname, '../public/apps/geld')));
  app.get('/', (req, res) => res.type('html').send('<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Aanbodproef</title></head><body>' +
    '<main id="lmAutomatisch"></main>' + ['hulp', 'lidmaatschap-aanbod-intake', 'lidmaatschap-aanbod-beeld', 'lidmaatschap-aanbod']
      .map(n => '<script src="/apps/geld/' + n + '.js"></script>').join('') +
    '<script>RTGGeldAbonnement.start(document.getElementById("lmAutomatisch"));</script></body></html>'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const browser = await pw.chromium.launch(browserOpties()); t.after(() => browser.close());
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await ctx.addInitScript(() => localStorage.setItem('rtg_member_token', 'fixture-1'));
  const page = await ctx.newPage(); letOpFouten(page, fouten);
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'domcontentloaded' });
  return { ...f, page, calls, fouten, betaald };
}
const bericht = (page, patroon) => page.waitForFunction(s => new RegExp(s).test(document.getElementById('lmAutoMelding')?.textContent || ''), patroon);

test('browser: onzeker aanbod blijft dezelfde UUID, expliciete handtekening en betaalstap activeren niets',
  { skip: geenBrowser(pw), timeout: 45000 }, async t => {
    const f = await omgeving(t, { onzeker: true }), p = f.page;
    assert.equal(await p.locator('#lmAanbodPas option[value=business]').textContent(), 'Business · hele organisatie');
    assert.equal(await p.locator('#lmAanbodPas option[value=business-lite]').textContent(), 'Business Lite · één zaak');
    assert.match(await p.locator('#lmAanbodAanvraagUitleg').textContent(), /RTG bij de menselijke toelating vastlegt/);
    await p.locator('#lmAanbodVraag button').click(); await bericht(p, 'antwoord na commit');
    assert.equal(f.db.data.contracten.length, 1);
    await p.reload(); await p.locator('#lmAanbodVraag button').click(); await bericht(p, 'aanbod staat klaar');
    const requests = f.calls.filter(c => c.pad === BASIS + 'aanbod');
    assert.equal(requests.length, 2); assert.deepEqual(requests[1].body, requests[0].body);
    assert.equal(f.db.data.contracten.length, 1);
    assert.equal(await p.locator('[data-abo-teken] input:checked').count(), 0);
    await p.locator('[data-abo-teken] input[name=naam]').fill('Amber Ondertekenaar');
    await p.locator('[data-abo-teken] input[name=akkoord]').check();
    await p.locator('[data-abo-teken] button').click();
    assert.equal(f.calls.filter(c => c.pad === BASIS + 'teken').length, 0, 'mandaat is afzonderlijk vereist');
    await p.locator('[data-abo-teken] input[name=mandaat]').check();
    await p.locator('[data-abo-teken] button').click(); await bericht(p, 'ondertekening is vastgelegd');
    assert.equal(f.db.data.contracten[0].status, 'GEACCEPTEERD');
    assert.equal(f.calls.filter(c => c.pad === BASIS + 'betalen').length, 0);
    await p.locator('[data-abo-actie=betalen]').click(); await bericht(p, 'actuele stand');
    assert.equal(await p.locator('a[href="https://checkout.stripe.com/c/fixture"]').count(), 1);
    assert.equal(f.db.data.contracten[0].status, 'GEACCEPTEERD');
    const betaalCalls = f.calls.filter(c => [BASIS + 'betalen', BASIS + 'herstel'].includes(c.pad)).length;
    await p.goto(p.url().split('?')[0] + '?abonnement=herstel#lidmaatschap');
    await p.locator('a[href="https://checkout.stripe.com/c/fixture"]').waitFor();
    assert.equal(f.calls.filter(c => [BASIS + 'betalen', BASIS + 'herstel'].includes(c.pad)).length, betaalCalls,
      'terugkeerparameter leest alleen stand en begint geen betaalopdracht');
    assert.deepEqual(f.fouten, []);
  });

test('browser: Lite gebruikt bestaande intake en eigen ontvangst; intrekken wist geen bestaande overeenkomst',
  { skip: geenBrowser(pw), timeout: 45000 }, async t => {
    const f = await omgeving(t), p = f.page;
    await p.locator('summary').click();
    for (const [id, value] of Object.entries({ lmLiteNaam: 'Amber Ondernemer', lmLiteContact: 'amber@fixture.test',
      lmLiteBedrijf: 'Fixture Atelier', lmLitePlaats: 'Utrecht' })) await p.locator('#' + id).fill(value);
    await p.locator('#lmLiteType').selectOption('vakwerk');
    await p.locator('#lmLiteIntake button').click(); await bericht(p, 'bedrijfsaanvraag is ontvangen');
    const a = f.db.data.aanmeldingen[0]; assert.equal(a.pas, 'business-lite'); assert.equal(a.accountId, 1);
    assert.equal(await p.locator('#lmAanbodAanvraag').inputValue(), a.id);
    assert.equal((f.db.data.contracten || []).length, 0);
    await p.locator('#lmAanbodVraag button').click(); await bericht(p, 'aanbod staat klaar');
    const c = f.db.data.contracten[0]; assert.equal(c.aanbod.prijs.maand.nettoCenten, 40000);
    assert.equal(c.aanbod.scope.soort, 'zaak'); assert.equal(c.status, 'AANGEBODEN');
    p.once('dialog', d => d.accept());
    await p.locator('[data-abo-actie=intrekken]').click(); await bericht(p, 'actuele stand');
    assert.equal(f.db.data.contracten[0].status, 'GEEINDIGD');
    assert.equal(f.db.data.contracten[0].verrekening.status, 'VRIJGEGEVEN');
    assert.deepEqual(f.fouten, []);
  });

test('browser: veilige links en echte herstelmededeling; standaard uit biedt geen nieuwe bediening',
  { skip: geenBrowser(pw), timeout: 45000 }, async t => {
    const f = await omgeving(t), p = f.page;
    f.stand.projectie = { betaalstand: { status: 'WACHT_OP_KLANT', checkoutUrl: 'javascript:alert(1)', error: '<img src=x onerror=alert(1)>' },
      herstel: { tekst: 'U heeft 31 kalenderdagen voor herstel. Facturen, betalen en opzeggen blijven bereikbaar.',
        herstelTot: '2026-12-14T10:00:00.000Z', aankondiging: { kanaal: 'rtg-inbox' } },
      herstelstand: { reden: 'Alleen bewezen achterstand telt.' } };
    await p.locator('#lmAanbodVraag button').click(); await bericht(p, 'aanbod staat klaar');
    assert.equal(await p.locator('a').count(), 0); assert.equal(await p.locator('img').count(), 0);
    const text = await p.locator('#lmAutoContracten').textContent();
    assert.match(text, /31 kalenderdagen/); assert.match(text, /2026-12-14/); assert.match(text, /persoonlijke RTG-inbox/);
    assert.doesNotMatch(text, /e-mail.*verstuurd/);
    assert.deepEqual(f.fouten, []);
    const dicht = await omgeving(t, { aan: false });
    await dicht.page.waitForFunction(() => document.getElementById('lmAutomatisch').children.length === 0);
    assert.equal(await dicht.page.locator('form').count(), 0);
    assert.deepEqual(dicht.db.data, {});
  });
