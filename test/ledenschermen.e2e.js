/* ============================================================================
   DE LEDENSCHERMEN: WAT HET HUIS OVER ZICHZELF ZEGT.

   Achttien schermen uit de lijst van TAKEN 4.9, en ze hebben iets gemeen dat de
   andere groepen niet hebben: ze staan het dichtst bij het lid, en juist daar
   doet dit huis een reeks beloften over zichzelf die nergens anders staan.

   DE EERLIJKHEIDSMELDING OP HET BUREAUBLAD is de belangrijkste. index.html zegt
   met zoveel woorden dat dit een demo is en WAT er precies uit staat: echte
   betalingen, echte bestellingen en de boardroom. Dat is de zin die voorkomt dat
   iemand denkt dat hij een echte order plaatst. Hij is met een tekstopschoning
   weg, en dan ziet het huis er precies zo uit terwijl de mededeling verdwenen
   is -- de stilste manier om oneerlijk te worden.

   DE PRIVACYBELOFTEN. "Wie ben ik voor Rahul" opent met "alles hier is van u, en
   alles is optioneel"; Vonk en Rendez-vous draaien op codenaam. Dat laatste is
   de privacy-by-design uit CLAUDE.md, op de twee schermen waar het gevoeligst
   ligt: daten.

   DE POORTEN. De Rechterhand en Rendez-vous horen bij de Lifestyle Pass en
   tonen zonder pas de deur. Dat ligt al vast voor de twaalf app-schermen
   (lifestyleschermen.e2e.js); hier gaat het om de twee ingangen ernaartoe.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ledenscherm-'));

/* De schermen die met een ledenpas gewoon opengaan, elk met wat het scherm over
   zichzelf belooft. */
const OPEN = [
  { app: 'home', eist: /lampen|klimaat|gordijnen|een bediening/i },
  { app: 'mall', eist: /alleen voor leden/i },
  { app: 'nieuws', eist: /redactie|nieuws/i },
  { app: 'krant', eist: /kranten|titel/i },
  { app: 'pulse', eist: /volgend|ontdek|mijn plank/i },
  { app: 'thuis', eist: /van lid aan lid|logeren bij leden/i },
  { app: 'stad', eist: /voor bewoners|hoe de stad/i },
  { app: 'horloge', eist: /signatuur|skelet|horloge/i },
  { app: 'uitzicht', eist: /skyline|het huis in de nacht/i },
  { app: 'browser', eist: /browser|rtg:\/\//i },
  { app: 'lesmaker', eist: /les|maker|opdracht/i },
  { app: 'pakketten', eist: /pakket|zending|bezorg/i }
];

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Lid', email: 'ld' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1982-02-02', tier: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

/* `wachtOp` is een stuk tekst dat op het scherm MOET verschijnen voordat we
   gaan kijken. Zonder dat argument blijft dit precies wat het was: even wachten
   en dan lezen.

   WAAROM DAT ERBIJ IS GEKOMEN. De vaste seconde hieronder was een mes op de
   snede: gemeten kwam de demo-melding er op ~1000 ms, dus of de toets slaagde
   hing af van hoe druk de machine was. Hij ging om toen er een domein bijkwam,
   en de melding die je dan krijgt ("het zegt dat dit een demo is: Naar de
   inhoud MEENEMEN ...") wijst naar een scherm dat niets mankeert. Zo'n rood
   kost precies het vertrouwen dat een toets moet leveren, en de volgende
   persoon zoekt het op de verkeerde plek.

   Wachten op een VOORWAARDE lost dat op zonder de bewering te verzwakken:
   verschijnt de tekst niet, dan zakt de toets alsnog -- maar dan met "gewacht
   op ... maar dat verscheen niet", en dat is een uitspraak over het scherm in
   plaats van over de timing. */
async function toon(page, base, app, token, wachtOp) {
  const pad = '/apps/' + app + '.html';
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_member_token', t); else localStorage.removeItem('rtg_member_token');
  }, token || null);
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  if (wachtOp) {
    await page.waitForFunction(
      (naald) => document.body.innerText.replace(/\s+/g, ' ').toLowerCase().includes(naald.toLowerCase()),
      wachtOp, { timeout: 15000 }
    ).catch(() => { throw new Error('gewacht op "' + wachtOp + '" op ' + pad + ', maar dat verscheen niet'); });
  } else {
    await wachtOpRust(page);
  }
  return page.evaluate(() => ({
    pad: location.pathname,
    deur: !!document.querySelector('.rtgdeur'),
    tekst: document.body.innerText.replace(/\s+/g, ' ')
  }));
}

async function opstelling() {
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await volgVerzoeken(page);
  const fouten = [];
  letOpFouten(page, fouten);
  return { browser, page, fouten };
}

test('het bureaublad zegt eerlijk dat dit een demo is, en wat er precies uit staat',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    const r = await toon(o.page, base, 'index', token, 'demo');
    assert.equal(r.pad, '/apps/index.html', 'het bureaublad opent');

    /* DE MELDING ZELF. Niet alleen "demo" -- dat kan van alles betekenen -- maar
       ook WAT er uit staat. Een demo-melding zonder die opsomming laat een lid
       gissen of zijn bestelling nu wel of niet is doorgegaan. */
    assert.match(r.tekst, /demo/i, 'het zegt dat dit een demo is: ' + r.tekst.slice(0, 200));
    assert.match(r.tekst, /betaling|payment/i, 'en noemt de betalingen');
    assert.match(r.tekst, /bestelling|order/i, 'en de bestellingen');
    assert.match(r.tekst, /boardroom/i, 'en de boardroom');

    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test(OPEN.length + ' ledenschermen tonen waar ze voor zijn',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    const stuk = [];
    for (const s of OPEN) {
      const r = await toon(o.page, base, s.app, token);
      if (r.pad !== '/apps/' + s.app + '.html') { stuk.push(s.app + ': stuurt weg naar ' + r.pad); continue; }
      if (r.tekst.trim().length < 60) { stuk.push(s.app + ': bijna leeg (' + r.tekst.trim().length + ' tekens)'); continue; }
      if (!s.eist.test(r.tekst)) stuk.push(s.app + ': zegt niet waar het voor is -- ' + r.tekst.slice(0, 130));
    }
    assert.deepEqual(stuk, [], 'de ' + OPEN.length + ' ledenschermen staan er:\n  ' + stuk.join('\n  '));
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('daten gaat op codenaam, en "wie ben ik" vraagt niets verplicht',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    /* VONK draait op codenaam. Dat is de privacy-by-design uit CLAUDE.md op het
       scherm waar hij het gevoeligst ligt: wie hier zijn echte naam toont, kan
       dat nooit meer terugnemen. */
    const vonk = await toon(o.page, base, 'vonk', token);
    assert.equal(vonk.pad, '/apps/vonk.html', 'Vonk opent');
    assert.match(vonk.tekst, /codenaam/i, 'en daten gaat op codenaam: ' + vonk.tekst.slice(0, 180));

    /* "WIE BEN IK VOOR RAHUL" is het profiel dat de AI gebruikt. De belofte
       staat er letterlijk: alles is van u, en alles is optioneel. Een veld dat
       hier verplicht wordt, is een vraag die een lid niet kan weigeren. */
    const ik = await toon(o.page, base, 'ik', token);
    assert.match(ik.tekst, /alles is optioneel|vult u niets in/i,
      'invullen is optioneel: ' + ik.tekst.slice(0, 200));
    const verplicht = await o.page.evaluate(() =>
      document.querySelectorAll('#main [required], #main [aria-required="true"]').length);
    assert.equal(verplicht, 0, 'en er staat geen enkel verplicht veld (' + verplicht + ')');

    /* DE TWEE LIFESTYLE-INGANGEN tonen zonder pas hun deur. */
    for (const app of ['lifestyle', 'rendezvous']) {
      const r = await toon(o.page, base, app, token);
      assert.equal(r.pad, '/apps/' + app + '.html', app + ' blijft op zijn eigen adres');
      assert.ok(r.deur || /Lifestyle Pass/i.test(r.tekst),
        app + ' toont de Lifestyle-poort: ' + r.tekst.slice(0, 160));
    }

    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
