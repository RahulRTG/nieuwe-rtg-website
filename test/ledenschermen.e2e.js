/* ============================================================================
   DE LEDENSCHERMEN: WAT HET HUIS OVER ZICHZELF ZEGT.

   Achttien schermen uit de lijst van TAKEN 4.9, en ze hebben iets gemeen dat de
   andere groepen niet hebben: ze staan het dichtst bij het lid, en juist daar
   doet dit huis een reeks beloften over zichzelf die nergens anders staan.

   DE EERLIJKHEIDSMELDING VAN MAGNAAT TEST is de belangrijkste. De echte vier
   werelden kennen geen demo. Alleen de afzonderlijke testwereld benoemt zichzelf
   als Magnaat Test en zegt zichtbaar dat klantdata, geldstromen en
   productieacties buiten bereik blijven. Zo kan een test nooit voor echt worden
   aangezien en draagt productie tegelijk geen proeftekst.

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
const { startServer, letOpFouten } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
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

   WAAROM DAT ERBIJ IS GEKOMEN. Een vaste seconde was een mes op de snede:
   asynchrone schermtekst kwam soms pas daarna, afhankelijk van hoe druk de
   machine was. Dan wees de fout naar een scherm dat niets mankeerde en zocht
   de volgende persoon op de verkeerde plek.

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
    await page.waitForTimeout(1000);
  }
  return page.evaluate(() => ({
    pad: location.pathname,
    deur: !!document.querySelector('.rtgdeur'),
    tekst: document.body.innerText.replace(/\s+/g, ' ')
  }));
}

async function opstelling() {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { browser, page, fouten };
}

test('Magnaat Test benoemt zichzelf en houdt klantdata en productieacties buiten bereik',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const o = await opstelling();
    browser = o.browser;

    const r = await toon(o.page, base, 'magnaat', token, 'Magnaat Test');
    assert.equal(r.pad, '/apps/magnaat.html', 'de afgeschermde testwereld opent');

    /* Magnaat Test is de enige testversie. De melding noemt daarom niet meer
       de brede en verwarrende term "demo", maar wel de harde grens met de
       echte omgeving. */
    assert.match(r.tekst, /Magnaat Test/i, 'het benoemt de testomgeving expliciet');
    assert.match(r.tekst, /afgeschermd van klantdata|klantdata .*buiten bereik/i,
      'en sluit echte klantdata uit');
    assert.match(r.tekst, /afgeschermd van .*productieacties|productieacties .*buiten bereik/i,
      'en sluit productieacties uit');
    assert.deepEqual(o.fouten, [], 'paginafouten: ' + o.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test(OPEN.length + ' ledenschermen tonen waar ze voor zijn',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
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
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
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
