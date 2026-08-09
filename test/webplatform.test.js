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

// alle blokken van een site: de voorpagina plus alle extra pagina's
const alleBlokken = site => (site.blokken || []).concat(...(site.paginas || []).map(p => p.blokken || []));

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
  // de site draagt meerdere pagina's: Aanbod en Contact naast de voorpagina
  assert.deepEqual((site.paginas || []).map(p => p.slug), ['aanbod', 'contact'], 'de vaste pagina-indeling');
  // de activiteiten uit het profiel staan live op de aanbodpagina, met prijs en tijden
  const aanbod = site.paginas.find(p => p.slug === 'aanbod');
  const teksten = aanbod.blokken.filter(b => b.type === 'tekst').map(b => b.tekst).join(' | ');
  assert.match(teksten, /Sunset cruise met cava/);
  assert.match(teksten, /€ 79/);
  // en er is nergens een onopgelost zaakdata-blok naar de bezoeker gelekt
  assert.ok(!alleBlokken(site).some(b => b.type === 'zaakdata'), 'alle live blokken zijn opgelost, ook op de extra pagina\'s');
  // de browser weet dat dit een bedrijf is, met de acties die de zaak echt kan
  assert.ok(open.body.zaak, 'de zaak-info zit erbij');
  assert.equal(open.body.zaak.naam, 'Es Vedra Cruises');
  assert.ok(open.body.zaak.acties.includes('boeken'), 'activiteiten geven de actie "boeken"');
});

test('2. de site is live: een nieuwe menukaart staat erop zonder de site aan te raken', async () => {
  const voor = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(!/Tapasplank/.test(JSON.stringify(alleBlokken(voor.body.site))), 'het gerecht bestaat nog niet');

  const m = await api('/api/supplier/menu', { menu: [{ name: 'Tapasplank aan boord', desc: 'Voor twee', price: 24 }] }, zaak);
  assert.equal(m.status, 200, JSON.stringify(m.body));

  const na = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  const teksten = alleBlokken(na.body.site).filter(b => b.type === 'tekst').map(b => b.tekst).join(' | ');
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

test('7. de sjabloon-etalage: alleen wat het Atelier vrijgeeft, komt bij leden', async () => {
  const office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const mk = await api('/api/office/atelierweb/bewaar', { design: { titel: 'Restaurant Luxury 04',
    blokken: [{ type: 'hero', kop: 'Welkom' }, { type: 'tekst', tekst: 'Een sjabloon van het huis.' }] } }, office);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const sjabloonId = mk.body.design.id;

  // werk in uitvoering blijft binnen: zonder etalage ziet een lid niets
  const leeg = await api('/api/site/sjablonen', {}, lid);
  assert.ok(!(leeg.body.lijst || []).some(x => x.id === sjabloonId), 'niet vrijgegeven is niet zichtbaar');
  const dicht = await api('/api/site/sjabloon', { id: sjabloonId }, lid);
  assert.equal(dicht.status, 404, 'ook niet met het id in de hand');

  // vrijgeven is een uitdrukkelijke handeling van het kantoor
  const vrij = await api('/api/office/atelierweb/etalage', { id: sjabloonId, aan: true }, office);
  assert.equal(vrij.status, 200, JSON.stringify(vrij.body));
  const zicht = await api('/api/site/sjablonen', {}, lid);
  assert.ok((zicht.body.lijst || []).some(x => x.id === sjabloonId), 'nu wel zichtbaar');
  const s = await api('/api/site/sjabloon', { id: sjabloonId }, lid);
  assert.equal(s.status, 200);
  assert.equal(s.body.sjabloon.titel, 'Restaurant Luxury 04');
  assert.equal(s.body.sjabloon.blokken.length, 2, 'het hele ontwerp komt mee als startpunt');
});

test('6. het formulier op de bedrijfssite landt als klus bij de zaak, op codenaam', async () => {
  // op de bedrijfssite staat het formulier; op een ledensite zonder zaak niet
  const open = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(alleBlokken(open.body.site).some(b => b.type === 'formulier'), 'de bedrijfssite draagt het formulier (op de contactpagina)');

  const stuur = await api('/api/browser/bericht', { adres: 'es-vedra-cruises', tekst: 'Is de sunset cruise rolstoeltoegankelijk?' }, lid);
  assert.equal(stuur.status, 200, JSON.stringify(stuur.body));
  // en het bericht staat in de werklijst van de zaak, niet in een los postvak
  const st = await api('/api/supplier/state', {}, zaak);
  const klus = (st.body.state.tickets || []).find(t => /rolstoeltoegankelijk/.test(t.text));
  assert.ok(klus, 'de klus staat bij de zaak');
  assert.match(klus.by, /^RTG-web · /, 'op codenaam, niet op naam');
  assert.ok(!/Web Lid/.test(klus.by), 'de echte naam van het lid reist niet mee');

  // je eigen site aanschrijven is geen gesprek
  const mis = await api('/api/browser/bericht', { adres: 'nep-vedra', tekst: 'Hallo daar' }, lid);
  assert.equal(mis.status, 400);
});

test('10. de persoonlijke site: op codenaam, en het formulier wordt een gesprek -- alleen tussen verbonden leden', async () => {
  const reg = await api('/api/auth/register', { name: 'Persoon Twee', email: 'persoon2@voorbeeld.test',
    password: 'webgeheim34', geboortedatum: '1993-03-03', tier: 'rtg', pasApp: 'rtg' });
  const lid2 = reg.body.token;

  const g = await api('/api/site/persoonlijk', {}, lid2);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  const codenaam = g.body.design.titel;
  assert.equal(g.body.adres, codenaam.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'het adres is de codenaam');
  assert.ok(!/Persoon Twee/.test(JSON.stringify(g.body.design)), 'de echte naam komt nergens in het ontwerp');
  // nog eens vragen geeft dezelfde site terug, geen tweede
  const g2 = await api('/api/site/persoonlijk', {}, lid2);
  assert.equal(g2.body.bestond, true);

  // de browser begrijpt dat dit een persoon is en geeft de codenaam mee
  const open = await api('/api/browser/open', { adres: g.body.adres }, lid);
  assert.equal(open.status, 200);
  assert.equal((open.body.persoon || {}).codenaam, codenaam);
  assert.equal(open.body.zaak, null);
  assert.ok(alleBlokken(open.body.site).some(b => b.type === 'formulier'), 'de contactpagina draagt het formulier');

  // een vreemde bereikt het lid niet: eerst verbinden, zoals overal in dit huis
  const koud = await api('/api/browser/bericht', { adres: g.body.adres, tekst: 'Hallo, mooi werk hier.' }, lid);
  assert.equal(koud.status, 403);
  assert.match(koud.body.error, /verbonden/i);

  // verbinden: lid 1 vraagt, lid 2 aanvaardt
  const mijnKey = (await api('/api/member/connections', {}, lid)).body.me;
  const zoek = await api('/api/member/find', { q: codenaam }, lid);
  const gevonden = (zoek.body.results || []).find(x => x.codename === codenaam);
  assert.ok(gevonden, 'de codenaam is vindbaar');
  assert.equal((await api('/api/member/connect', { key: gevonden.key }, lid)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: mijnKey, action: 'accept' }, lid2)).status, 200);

  // en nu wordt het formulier een gesprek, op codenaam
  const warm = await api('/api/browser/bericht', { adres: g.body.adres, tekst: 'Hallo, mooi werk hier.' }, lid);
  assert.equal(warm.status, 200, JSON.stringify(warm.body));
  assert.equal(warm.body.via, 'chat');
  const dm = await api('/api/member/dm', { withKey: mijnKey }, lid2);
  assert.ok((dm.body.messages || []).some(m => /Via jouw site: Hallo, mooi werk hier\./.test(m.text)),
    'het bericht staat in het gesprek van de ontvanger');
});

test('8. een lid bouwt een site met meerdere pagina\'s, met dezelfde schoonmaak en grenzen', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Atelier Blad', blokken: [{ type: 'kop', tekst: 'Voorpagina' }],
    paginas: [
      { naam: 'Over ons', blokken: [{ type: 'tekst', tekst: '<script>alert(1)</script>Over het atelier.' }] },
      { naam: 'Contact!', blokken: [{ type: 'kop', tekst: 'Schrijf ons' }] },
      { naam: 'Over ons', blokken: [] }   // zelfde naam -> zelfde slug -> valt weg
    ] } }, lid);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const d = mk.body.design;
  assert.deepEqual(d.paginas.map(p => p.slug), ['over-ons', 'contact'], 'nette slugs, en de dubbele is weg');
  assert.ok(!/</.test(d.paginas[0].blokken[0].tekst), 'ook op een extra pagina wordt de tekst geschoond');

  const pub = await api('/api/site/publiceer', { id: d.id, adres: 'atelier-blad' }, lid);
  assert.equal(pub.status, 200);
  const open = await api('/api/browser/open', { adres: 'atelier-blad' }, lid);
  assert.deepEqual(open.body.site.paginas.map(p => [p.naam, p.slug]),
    [['Over ons', 'over-ons'], ['Contact!', 'contact']], 'de bezoeker krijgt de pagina\'s met naam en slug');
});

test('9. de AI-assistent past aan maar bewaart niets; de demostand is eerlijk over wat hij kan', async () => {
  const ontwerp = { titel: 'Trattoria Sole', thema: 'licht', accent: '#7F1634',
    blokken: [{ id: 'b1', type: 'hero', kop: 'Trattoria Sole' }] };

  // de demostand kan "luxer": thema en accent, met uitleg -- en het ontwerp
  // komt terug in plaats van te worden opgeslagen
  const lux = await api('/api/site/ai', { design: ontwerp, opdracht: 'Maak het luxer.' }, lid);
  assert.equal(lux.status, 200);
  assert.equal(lux.body.gedaan, true);
  assert.equal(lux.body.design.thema, 'donker');
  assert.equal(lux.body.design.accent, '#857007', 'goud uit het eigen palet, geen verzonnen kleur');
  const mijnVoor = await api('/api/site/mijn', {}, lid);

  // en een nieuwe pagina op verzoek
  const pag = await api('/api/site/ai', { design: ontwerp, opdracht: 'Maak een pagina voor bruiloften.' }, lid);
  assert.equal(pag.body.gedaan, true);
  assert.equal(pag.body.design.paginas.length, 1);
  assert.match(pag.body.design.paginas[0].naam, /bruiloften/i);

  // wat de demostand niet kan, zegt hij eerlijk -- geen gedaan-vinkje zonder daad
  const nee = await api('/api/site/ai', { design: ontwerp, opdracht: 'Vertaal alles naar het Spaans.' }, lid);
  assert.equal(nee.body.gedaan, false);
  assert.equal(nee.body.design, null);
  assert.match(nee.body.antwoord, /demostand|sleutel/i);

  // niets van dit alles heeft iets opgeslagen
  const mijnNa = await api('/api/site/mijn', {}, lid);
  assert.equal(mijnNa.body.lijst.length, mijnVoor.body.lijst.length, 'de assistent bewaart niet zelf');
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
