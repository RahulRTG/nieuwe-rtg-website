/* ============================================================================
   RTG WEB PLATFORM -- de automatische bedrijfssite en de browser die
   bedrijven begrijpt.

   Het principe onder deze laag is "automatic first, customizable forever":
   een partner krijgt uit zijn zaakprofiel in een keer een complete site op
   naam.rtg, en past hem daarna zelf aan. De blokken die uit het profiel
   komen zijn VERWIJZINGEN, geen kopieen -- er bestaat een Business Master
   Record. Dat moet op vier punten vastliggen:

   - LIVE IS ECHT LIVE. Wijzigt de zaak zijn menukaart, dan staat het op de
     site zonder dat iemand de site aanraakt. Een blok dat een kopie bewaart
     is precies de vijf-keer-je-adres-aanpassen-fout die deze laag bestrijdt.
   - DE KOPPELING KOMT UIT DE INLOG. Dat een site bij een bedrijf hoort is
     een feit uit supplierAuth, geen veld in het verzoek: een lid dat
     zaakCode in zijn ontwerp zet, krijgt niet de actiebalk en niet de data
     van andermans zaak.
   - GENEREREN OVERSCHRIJFT GEEN HANDWERK. Wie zijn site heeft aangepast en
     nog eens op genereren drukt, krijgt zijn eigen site terug -- opnieuw
     beginnen is een aparte, uitdrukkelijke keuze (opnieuw: true).
   - ZOEKEN VINDT SITES EN BEDRIJVEN, maar lekt niets: alleen wat toch al
     publiek is (naam, stad, type) en alleen online sites.

   Draai los: node --experimental-sqlite --test test/webplatform.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, zaak;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-webplatform-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Web Lid', email: 'weblid@voorbeeld.test',
    password: 'webgeheim12', geboortedatum: '1992-02-02', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200, 'lid registreren: ' + JSON.stringify(reg.body));
  lid = reg.body.token;
  const roster = await api('/api/supplier/roster', { code: 'ESVEDRA' });
  const man = (roster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(man, 'ESVEDRA heeft een manager in de seed');
  const lg = await api('/api/supplier/login', { code: 'ESVEDRA', staffId: man.id, pin: '1234' });
  assert.equal(lg.status, 200, 'zaak-login: ' + JSON.stringify(lg.body));
  zaak = lg.body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. genereren zet in een keer een complete bedrijfssite online', async () => {
  const g = await api('/api/supplier/site/genereer', {}, zaak);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.adres, 'es-vedra-cruises', 'het adres is de bedrijfsnaam');

  const open = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.equal(open.status, 200);
  const site = open.body.site;
  assert.equal(site.titel, 'Es Vedra Cruises');
  const hero = site.blokken.find(b => b.type === 'hero');
  assert.equal(hero.kop, 'Es Vedra Cruises');
  // de activiteiten uit het profiel staan live op de site, met prijs en tijden
  const teksten = site.blokken.filter(b => b.type === 'tekst').map(b => b.tekst).join(' | ');
  assert.match(teksten, /Sunset cruise met cava/);
  assert.match(teksten, /€ 79/);
  // en er is geen onopgelost zaakdata-blok naar de bezoeker gelekt
  assert.ok(!site.blokken.some(b => b.type === 'zaakdata'), 'alle live blokken zijn opgelost');
  // de browser weet dat dit een bedrijf is, met de acties die de zaak echt kan
  assert.ok(open.body.zaak, 'de zaak-info zit erbij');
  assert.equal(open.body.zaak.naam, 'Es Vedra Cruises');
  assert.ok(open.body.zaak.acties.includes('boeken'), 'activiteiten geven de actie "boeken"');
});

test('2. de site is live: een nieuwe menukaart staat erop zonder de site aan te raken', async () => {
  const voor = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(!/Tapasplank/.test(JSON.stringify(voor.body.site.blokken)), 'het gerecht bestaat nog niet');

  const m = await api('/api/supplier/menu', { menu: [{ name: 'Tapasplank aan boord', desc: 'Voor twee', price: 24 }] }, zaak);
  assert.equal(m.status, 200, JSON.stringify(m.body));

  const na = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  const teksten = na.body.site.blokken.filter(b => b.type === 'tekst').map(b => b.tekst).join(' | ');
  assert.match(teksten, /Tapasplank aan boord/, 'de kaart staat live op de site');
});

test('3. nog eens genereren overschrijft het handwerk van de ondernemer niet', async () => {
  const mijn = await api('/api/supplier/site/mijn', {}, zaak);
  const id = mijn.body.lijst[0].id;
  const d = (await api('/api/supplier/site/haal', { id }, zaak)).body.design;
  d.titel = 'Es Vedra -- met de hand bijgeslepen';
  const bw = await api('/api/supplier/site/bewaar', { design: d }, zaak);
  assert.equal(bw.status, 200, JSON.stringify(bw.body));

  const g2 = await api('/api/supplier/site/genereer', {}, zaak);
  assert.equal(g2.status, 200);
  assert.equal(g2.body.bestond, true, 'de bestaande site wordt teruggegeven, niet vervangen');
  assert.equal(g2.body.design.titel, 'Es Vedra -- met de hand bijgeslepen');

  // opnieuw is een uitdrukkelijke keuze, en die werkt wel
  const g3 = await api('/api/supplier/site/genereer', { opnieuw: true }, zaak);
  assert.equal(g3.status, 200);
  assert.equal(g3.body.design.titel, 'Es Vedra Cruises');
});

test('4. een lid kan zich niet aan andermans zaak koppelen', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Nep Vedra', zaakCode: 'ESVEDRA',
    blokken: [{ type: 'zaakdata', bron: 'agenda' }, { type: 'tekst', tekst: 'Gewoon mijn pagina.' }] } }, lid);
  assert.equal(mk.status, 200);
  const id = mk.body.design.id;
  const pub = await api('/api/site/publiceer', { id, adres: 'nep-vedra' }, lid);
  assert.equal(pub.status, 200);

  const open = await api('/api/browser/open', { adres: 'nep-vedra' }, lid);
  assert.equal(open.status, 200);
  assert.equal(open.body.zaak, null, 'geen actiebalk van andermans bedrijf');
  const alles = JSON.stringify(open.body.site.blokken);
  assert.ok(!/Sunset cruise/.test(alles), 'geen data van andermans zaak');
});

test('6. het formulier op de bedrijfssite landt als klus bij de zaak, op codenaam', async () => {
  // op de bedrijfssite staat het formulier; op een ledensite zonder zaak niet
  const open = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(open.body.site.blokken.some(b => b.type === 'formulier'), 'de bedrijfssite draagt het formulier');
  const ledensite = await api('/api/browser/open', { adres: 'nep-vedra' }, lid);
  assert.ok(!ledensite.body.site.blokken.some(b => b.type === 'formulier'),
    'zonder ontvanger geen formulier -- een knop die niets doet is erger dan geen knop');

  const stuur = await api('/api/browser/bericht', { adres: 'es-vedra-cruises', tekst: 'Is de sunset cruise rolstoeltoegankelijk?' }, lid);
  assert.equal(stuur.status, 200, JSON.stringify(stuur.body));
  // en het bericht staat in de werklijst van de zaak, niet in een los postvak
  const st = await api('/api/supplier/state', {}, zaak);
  const klus = (st.body.state.tickets || []).find(t => /rolstoeltoegankelijk/.test(t.text));
  assert.ok(klus, 'de klus staat bij de zaak');
  assert.match(klus.by, /^RTG-web · /, 'op codenaam, niet op naam');
  assert.ok(!/Web Lid/.test(klus.by), 'de echte naam van het lid reist niet mee');

  // naar een ledensite zonder zaak kan geen bericht
  const mis = await api('/api/browser/bericht', { adres: 'nep-vedra', tekst: 'Hallo daar' }, lid);
  assert.equal(mis.status, 404);
});

test('5. zoeken vindt sites en bedrijven in een adem', async () => {
  const z = await api('/api/browser/zoek', { q: 'vedra' }, lid);
  assert.equal(z.status, 200);
  assert.ok(z.body.sites.some(s => s.adres === 'es-vedra-cruises'), 'de site is vindbaar');
  const bedrijf = z.body.zaken.find(x => x.code === 'ESVEDRA');
  assert.ok(bedrijf, 'het bedrijf is vindbaar');
  assert.equal(bedrijf.adres, 'es-vedra-cruises', 'met de weg naar zijn site erbij');
  // alleen wat al publiek is: naam, stad, type en het adres -- niets uit het profiel
  assert.deepEqual(Object.keys(bedrijf).sort(), ['adres', 'code', 'naam', 'stad', 'typeLabel']);

  // een offline site is ook uit het zoeken weg
  const mijn = await api('/api/supplier/site/mijn', {}, zaak);
  await api('/api/supplier/site/offline', { id: mijn.body.lijst[0].id }, zaak);
  const z2 = await api('/api/browser/zoek', { q: 'vedra' }, lid);
  assert.ok(!z2.body.sites.some(s => s.adres === 'es-vedra-cruises'), 'offline is echt offline');
  assert.equal((z2.body.zaken.find(x => x.code === 'ESVEDRA') || {}).adres, '', 'ook het bedrijf wijst er niet meer heen');
});
