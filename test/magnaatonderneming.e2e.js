/* MAGNAAT V2 ONDERNEMING IN EEN ECHTE BROWSER. Het leven wordt eerst via de
   gewone route tot een ingeschreven onderneming gespeeld (dezelfde handelingen
   die een speler doet); daarna gaat het in de browser verder: iemand aannemen,
   inkopen bij de groothandel, en kijken wat Mijn bedrijf en Geld daarvan zeggen.

   Wat geen unittoets kon zien: het invulveld van een nieuwe handeling (wie je
   aanneemt, hoeveel stuks) komt uit de invoer die de server meestuurt, en Mijn
   bedrijf en de prognose worden door een eigen script getekend. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

/* Speel via de route tot het spel vaststelt dat je onderneemt, en schrijf in. */
async function totOnderneming(base, token) {
  const doe = async (b) => {
    const r = await fetch(base + '/api/member/magnaat/leven/actie', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(b) });
    return r.json();
  };
  let s = await doe({ actie: 'kies', aanbod: 'websites' });
  const vind = (f) => s.netwerk.contacten.filter(d => d.fase === f);
  for (let i = 0; i < 150 && !s.vandaag.volgende.some(a => a.actie === 'onderneming'); i++) {
    for (const k of vind('kans')) s = await doe({ actie: 'gesprek', deal: k.id });
    for (const o of vind('onderhandeling')) {
      const l = o.rondes[o.rondes.length - 1];
      s = await doe(o.vervolg || (l && l.van === 'klant' && o.rondes.length >= 2) ? { actie: 'neem', deal: o.id } : { actie: 'voorstel', deal: o.id, bedrag: 1000, voorschot: 25 });
    }
    for (const f of vind('gefactureerd')) if (s.dag > f.factuur.vervaldag && !f.factuur.herinnerd) s = await doe({ actie: 'herinnering', deal: f.id });
    for (const d of vind('overeenkomst')) if (d.gedaan >= d.afspraak.minuten) s = await doe({ actie: 'lever', deal: d.id });
    for (const g of vind('geleverd')) s = await doe({ actie: 'factuur', deal: g.id });
    const open = vind('overeenkomst').find(d => d.gedaan < d.afspraak.minuten), vrij = s.vrijVandaag - (s.vrijVandaag % 30);
    if (vrij) {
      const r = await doe({ actie: 'plan', wat: open ? 'opdracht' : 'project', deal: open && open.id, dag: s.dag, minuten: vrij });
      if (!r.error) s = r;
    }
    s = await doe({ actie: 'slaap' });
  }
  s = await doe({ actie: 'onderneming', naam: 'Webwerk Oudwijk' });
  assert.equal(s.bedrijf && s.bedrijf.naam, 'Webwerk Oudwijk', 'de onderneming staat ingeschreven');
  return s;
}

test('V2: iemand aannemen en inkopen via de Edge, en Mijn bedrijf en de prognose laten zien wat dat betekent', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onderneming-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Twee Speler', email: 'twee@x.nl', phone: '0612345679', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
    assert.ok(r.token);
    await totOnderneming(base, r.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 950 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, r.token);
    await page.goto(base + '/apps/magnaat.html', { waitUntil: 'domcontentloaded' });
    await page.click('[data-mv-diep="vandaag"]');
    await page.waitForFunction(() => /Neem iemand aan/.test(document.getElementById('vnWaarom').textContent), null, { timeout: 20000 });

    await page.locator('#vnActies button', { hasText: 'Neem iemand aan' }).click();
    await page.selectOption('#vnF-kandidaat', 'kim');
    await page.click('[data-vn-doe]');
    await page.waitForFunction(() => /Kim .*komt bij je in dienst/.test(document.getElementById('vnMeldingen').textContent), null, { timeout: 10000 });

    await page.locator('#vnActies button', { hasText: /^Bestel / }).click();
    await page.fill('#vnF-aantal', '3');
    await page.click('[data-vn-doe]');
    await page.waitForFunction(() => /Besteld bij Groothandel Techniek Oudwijk/.test(document.getElementById('vnMeldingen').textContent), null, { timeout: 10000 });

    await page.click('[data-screen="bedrijf"]');
    const bedrijf = await page.textContent('#vnBedrijf');
    assert.match(bedrijf, /Je team.*Kim · junior.*in dienst/);
    assert.match(bedrijf, /Handel: Kassatablet met je site erop.*3 onderweg/);
    assert.match(bedrijf, /Kosten per soort.*Werkplekken/);
    assert.match(bedrijf, /Balans.*Voorraad.*Aan leveranciers/);

    await page.click('[data-screen="geld"]');
    const geld = await page.textContent('#vnGeld');
    assert.match(geld, /De komende vier weken.*Week 1/);
    assert.match(geld, /Niet meegeteld: .*te laat betaalt/);
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
