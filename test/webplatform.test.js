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

test('11. de versiegeschiedenis: een weg terug, zonder het adres mee te slepen', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Kaarsen van Nora',
    blokken: [{ type: 'kop', tekst: 'Eerste stand' }] } }, lid);
  const id = mk.body.design.id;

  // een verse site heeft nog geen geschiedenis: er is niets overschreven
  const leeg = await api('/api/site/versies', { id }, lid);
  assert.equal(leeg.body.lijst.length, 0);

  /* De eerste stand wordt weggelegd terwijl de site nog NIET online is en nog
     geen adres heeft. Dat is met opzet: straks herstellen we juist naar die
     stand, en dan moet blijken dat het adres en de online-stand van vandaag
     blijven staan in plaats van mee terug te reizen. */
  await api('/api/site/bewaar', { design: { id, titel: 'Kaarsen van Nora', blokken: [{ type: 'kop', tekst: 'Tweede stand' }] } }, lid);
  assert.equal((await api('/api/site/publiceer', { id, adres: 'kaarsen-nora' }, lid)).status, 200);
  await api('/api/site/bewaar', { design: { id, titel: 'Kaarsen van Nora', blokken: [{ type: 'kop', tekst: 'Derde stand' }] } }, lid);
  const hist = await api('/api/site/versies', { id }, lid);
  assert.equal(hist.body.lijst.length, 2, 'twee overschreven standen');

  // terugzetten naar de oudste stand
  const her = await api('/api/site/herstel', { id, i: 1 }, lid);
  assert.equal(her.status, 200, JSON.stringify(her.body));
  assert.equal(her.body.design.blokken[0].tekst, 'Eerste stand');
  // HET ADRES EN DE ONLINE-STAND REIZEN NIET MEE: herstellen is een
  // ontwerp-handeling, geen publicatie-handeling
  assert.equal(her.body.design.adres, 'kaarsen-nora', 'het adres blijft');
  assert.equal(her.body.design.online, true, 'de site blijft online');
  const bezoek = await api('/api/browser/open', { adres: 'kaarsen-nora' }, lid);
  assert.equal(bezoek.status, 200, 'en is dus gewoon te bezoeken');
  /* Herstellen is een ontwerp-handeling: het zet je CONCEPT terug en laat het
     web met rust. Wie terugkijkt duwt daarmee niet meteen iets naar buiten;
     dat blijft een eigen, bewuste stap. */
  assert.equal(bezoek.body.site.blokken[0].tekst, 'Tweede stand', 'online staat nog wat er gepubliceerd was');
  assert.equal((await api('/api/site/live', { id }, lid)).status, 200);
  const naLive = await api('/api/browser/open', { adres: 'kaarsen-nora' }, lid);
  assert.equal(naLive.body.site.blokken[0].tekst, 'Eerste stand', 'en pas na publiceren staat de herstelde stand buiten');

  // herstellen is zelf ook een bewaring: de derde stand is niet verloren
  const na = await api('/api/site/versies', { id }, lid);
  assert.equal(na.body.lijst[0].reden, 'voor herstel');
  const terug = await api('/api/site/herstel', { id, i: 0 }, lid);
  assert.equal(terug.body.design.blokken[0].tekst, 'Derde stand', 'je kunt ook weer vooruit');

  // en de geschiedenis is van de eigenaar: een ander komt er niet in
  const buur = await api('/api/auth/register', { name: 'Buur Web', email: 'buurweb@voorbeeld.test',
    password: 'webgeheim56', geboortedatum: '1994-04-04', tier: 'rtg', pasApp: 'rtg' });
  const vreemd = await api('/api/site/versies', { id }, buur.body.token);
  assert.equal(vreemd.status, 404);
  assert.equal((await api('/api/site/herstel', { id, i: 0 }, buur.body.token)).status, 404);
});

test('12. concept en online zijn twee dingen: bewaren verandert het web niet, publiceren wel', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Bakkerij Lume',
    blokken: [{ type: 'kop', tekst: 'Zoals het online staat' }] } }, lid);
  const id = mk.body.design.id;
  await api('/api/site/publiceer', { id, adres: 'bakkerij-lume' }, lid);

  // het concept aanpassen -- de bezoeker mag daar nog niets van merken
  await api('/api/site/bewaar', { design: { id, titel: 'Bakkerij Lume', blokken: [{ type: 'kop', tekst: 'Halve zin waar ik nog aan werk' }] } }, lid);
  const tijdens = await api('/api/browser/open', { adres: 'bakkerij-lume' }, lid);
  assert.equal(tijdens.body.site.blokken[0].tekst, 'Zoals het online staat',
    'wat bezoekers zien is de stand van het laatste publiceren');

  // de maker ziet wel zijn eigen concept, met de melding dat er iets klaarstaat
  const mijn = (await api('/api/site/mijn', {}, lid)).body.lijst.find(x => x.id === id);
  assert.equal(mijn.wacht, true, 'de maker weet dat er wijzigingen wachten');
  const concept = await api('/api/site/haal', { id }, lid);
  assert.equal(concept.body.design.blokken[0].tekst, 'Halve zin waar ik nog aan werk');

  // en pas met publiceren gaat het naar buiten
  assert.equal((await api('/api/site/live', { id }, lid)).status, 200);
  const na = await api('/api/browser/open', { adres: 'bakkerij-lume' }, lid);
  assert.equal(na.body.site.blokken[0].tekst, 'Halve zin waar ik nog aan werk');
  const mijn2 = (await api('/api/site/mijn', {}, lid)).body.lijst.find(x => x.id === id);
  assert.equal(mijn2.wacht, false, 'niets meer in de wacht');

  // en een bewaring daarna gooit de online stand niet stiekem weg
  await api('/api/site/bewaar', { design: { id, titel: 'Bakkerij Lume', blokken: [{ type: 'kop', tekst: 'Nog een gedachte' }] } }, lid);
  const daarna = await api('/api/browser/open', { adres: 'bakkerij-lume' }, lid);
  assert.equal(daarna.body.site.blokken[0].tekst, 'Halve zin waar ik nog aan werk',
    'de bevroren stand overleeft een bewaring');
});

test('13. bij een zaak is naar buiten brengen werk van de leiding', async () => {
  const roster = await api('/api/supplier/roster', { code: 'ESVEDRA' });
  const gewoon = (roster.body.staff || []).find(x => x.role !== 'manager');
  assert.ok(gewoon, 'ESVEDRA heeft ook niet-managers');
  const mede = (await api('/api/supplier/login', { code: 'ESVEDRA', staffId: gewoon.id, pin: '5678' })).body.token;
  assert.ok(mede, 'de medewerker kan inloggen');

  const mijn = await api('/api/supplier/site/mijn', {}, mede);
  const id = mijn.body.lijst[0].id;

  // bewerken mag hij wel: dat raakt het concept en niet het web
  const bw = await api('/api/supplier/site/bewaar', { design: { id, titel: 'Es Vedra Cruises', blokken: [{ type: 'kop', tekst: 'Voorstel van de balie' }] } }, mede);
  assert.equal(bw.status, 200, JSON.stringify(bw.body));

  // maar het naar buiten brengen niet -- drie deuren, alle drie dicht
  for (const pad of ['live', 'publiceer', 'offline']) {
    const r = await api('/api/supplier/site/' + pad, { id, adres: 'es-vedra-cruises' }, mede);
    assert.equal(r.status, 403, pad + ' hoort werk van de leiding te zijn');
  }
  // het web is dus ook echt niet veranderd
  const bezoek = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(!/Voorstel van de balie/.test(JSON.stringify(alleBlokken(bezoek.body.site))), 'het voorstel staat niet buiten');

  // de leiding kan het wel, en dan staat het er
  assert.equal((await api('/api/supplier/site/live', { id }, zaak)).status, 200);
  const na = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(/Voorstel van de balie/.test(JSON.stringify(alleBlokken(na.body.site))), 'na akkoord van de leiding wel');
});

test('14. nieuwe live bronnen, en een pagina die niets te zeggen heeft verdwijnt', async () => {
  /* De gegenereerde site draagt een pagina "Werken bij ons" met alleen een
     live vacatureblok. Heeft de zaak geen vacatures, dan hoort die pagina NIET
     in de navigatie te staan: een deur naar een lege kamer is erger dan geen
     deur. */
  await api('/api/supplier/site/genereer', { opnieuw: true }, zaak);
  const zonder = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(!(zonder.body.site.paginas || []).some(p => p.slug === 'werken-bij-ons'),
    'zonder vacatures geen vacaturepagina');

  // een openstaande vacature -- die stond toch al in de publieke vacaturelijst
  const vac = await api('/api/supplier/vacature', { func: 'Schipper', uren: '32 uur', plaats: 'Ibiza',
    omschrijving: 'Varen met gasten langs Es Vedra.' }, zaak);
  assert.equal(vac.status, 200, JSON.stringify(vac.body));

  // en nu staat de pagina er, met de vacature erop -- zonder de site aan te raken
  const met = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  const werk = (met.body.site.paginas || []).find(p => p.slug === 'werken-bij-ons');
  assert.ok(werk, 'met een vacature verschijnt de pagina');
  assert.match(JSON.stringify(werk.blokken), /Schipper/);

  // een pagina die de maker zelf vulde blijft altijd staan, ook zonder live blok
  const eigen = await api('/api/site/bewaar', { design: { titel: 'Eigen Hand', blokken: [{ type: 'kop', tekst: 'Hoi' }],
    paginas: [{ naam: 'Leeg maar van mij', blokken: [{ type: 'ruimte', hoogte: 40 }] }] } }, lid);
  await api('/api/site/publiceer', { id: eigen.body.design.id, adres: 'eigen-hand' }, lid);
  const eig = await api('/api/browser/open', { adres: 'eigen-hand' }, lid);
  assert.equal((eig.body.site.paginas || []).length, 1, 'eigen pagina\'s verdwijnen niet onder je handen');
});

test('15. de blokken met rijen (faq en prijzen) worden per rij geschoond en begrensd', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Studio Rij', blokken: [
    { type: 'faq', kop: 'Vragen', vragen: [
      { v: 'Wat kost het?', a: '<b>Vanaf</b> vijftig euro.' },
      { v: '', a: '' },                                        // lege rij valt weg
      ...Array.from({ length: 15 }, (_, i) => ({ v: 'v' + i, a: 'a' + i }))
    ] },
    { type: 'prijzen', regels: [{ naam: 'Sessie', prijs: '€ 45', wat: 'Een uur' }] }
  ] } }, lid);
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  const faq = mk.body.design.blokken[0];
  assert.equal(faq.vragen.length, 12, 'begrensd op twaalf rijen');
  assert.ok(!/[<>]/.test(faq.vragen[0].a), 'ook binnen een rij wordt de tekst geschoond');
  assert.ok(!faq.vragen.some(x => !x.v && !x.a), 'lege rijen vallen weg');
  const prijs = mk.body.design.blokken[1];
  assert.equal(prijs.kop, 'Wat het kost', 'een ontbrekende kop krijgt een nette standaard');
  assert.deepEqual(prijs.regels, [{ naam: 'Sessie', prijs: '€ 45', wat: 'Een uur' }]);
});

test('16. het team-blok: niemand staat er vanzelf op, en er gaat niet meer naar buiten dan naam en functie', async () => {
  await api('/api/supplier/site/genereer', { opnieuw: true }, zaak);

  /* NIEMAND STAAT ER VANZELF OP. Dat een zaak personeel heeft en een site
     maakt, is geen besluit om dat personeel op het web te zetten. */
  const zonder = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(!/Ons team/.test(JSON.stringify(alleBlokken(zonder.body.site))), 'zonder aanwijzing geen team op de site');

  const lijst = await api('/api/supplier/site/team', {}, zaak);
  assert.equal(lijst.status, 200, JSON.stringify(lijst.body));
  assert.ok(lijst.body.lijst.length >= 2, 'de leiding ziet wie er werkt');
  assert.ok(lijst.body.lijst.every(m => m.op === false), 'en iedereen staat standaard uit');

  // de leiding wijst een iemand aan
  const wie = lijst.body.lijst[0];
  assert.equal((await api('/api/supplier/site/team/zet', { id: wie.id, aan: true }, zaak)).status, 200);

  const met = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  const alles = JSON.stringify(alleBlokken(met.body.site));
  assert.match(alles, new RegExp(wie.naam), 'de aangewezen medewerker staat erop');
  // ER GAAT NIET MEER NAAR BUITEN DAN NAAM EN FUNCTIE
  const ander = lijst.body.lijst.find(m => m.id !== wie.id);
  assert.ok(!new RegExp(ander.naam).test(alles), 'en de collega die niet is aangewezen niet');
  assert.ok(!/manager|"lid"|staffId/.test(alles), 'geen rol, geen lidmaatschap, geen interne velden');

  // een medewerker mag dit niet zetten: het is een besluit over een mens
  const gewoon = (await api('/api/supplier/roster', { code: 'ESVEDRA' })).body.staff.find(x => x.role !== 'manager');
  const mede = (await api('/api/supplier/login', { code: 'ESVEDRA', staffId: gewoon.id, pin: '5678' })).body.token;
  assert.equal((await api('/api/supplier/site/team', {}, mede)).status, 403);
  assert.equal((await api('/api/supplier/site/team/zet', { id: wie.id, aan: false }, mede)).status, 403);

  // en een vreemd id komt er niet in
  assert.equal((await api('/api/supplier/site/team/zet', { id: 999999, aan: true }, zaak)).status, 404);

  // weer van de site halen kan, en dan is hij ook echt weg
  assert.equal((await api('/api/supplier/site/team/zet', { id: wie.id, aan: false }, zaak)).status, 200);
  const weg = await api('/api/browser/open', { adres: 'es-vedra-cruises' }, lid);
  assert.ok(!new RegExp(wie.naam).test(JSON.stringify(alleBlokken(weg.body.site))), 'van de site gehaald is van de site af');
});

test('17. publiceren op een gekozen moment brengt naar buiten wat er DAN klaarstaat', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Kaarshuis',
    blokken: [{ type: 'kop', tekst: 'Wat er online staat' }] } }, lid);
  const id = mk.body.design.id;

  // plannen kan niet zolang de site niet online is: online gaan is een eigen besluit
  const tevroeg = await api('/api/site/plan', { id, moment: new Date(Date.now() + 60000).toISOString() }, lid);
  assert.equal(tevroeg.status, 400);

  await api('/api/site/publiceer', { id, adres: 'kaarshuis' }, lid);
  // een moment dat al geweest is, is geen planning
  assert.equal((await api('/api/site/plan', { id, moment: '2020-01-01T00:00:00Z' }, lid)).status, 400);

  // plannen op een moment vlak vooruit, en daarna NOG iets wijzigen
  const moment = new Date(Date.now() + 1500).toISOString();
  assert.equal((await api('/api/site/plan', { id, moment }, lid)).status, 200);
  await api('/api/site/bewaar', { design: { id, titel: 'Kaarshuis', blokken: [{ type: 'kop', tekst: 'Latere gedachte' }] } }, lid);

  // zolang het moment niet is aangebroken, verandert er buiten niets
  const voor = await api('/api/browser/open', { adres: 'kaarshuis' }, lid);
  assert.equal(voor.body.site.blokken[0].tekst, 'Wat er online staat');

  await new Promise(r => setTimeout(r, 1700));
  const na = await api('/api/browser/open', { adres: 'kaarshuis' }, lid);
  /* De belofte: wat er op het geplande moment klaarstond gaat naar buiten --
     niet de stand van toen er gepland werd. Anders verdwijnt alles wat je er
     na het plannen nog aan deed, en merk je dat pas als het buiten staat. */
  assert.equal(na.body.site.blokken[0].tekst, 'Latere gedachte');

  // en de planning is daarna op: hij vuurt niet nog eens
  const spoor = await api('/api/site/spoor', { id }, lid);
  assert.equal(spoor.body.lijst.filter(x => /volgens planning/.test(x.wat)).length, 1);
});

test('18. het spoor: wie deed wat, wanneer -- en bij een zaak staat de naam erbij', async () => {
  const mijn = await api('/api/supplier/site/mijn', {}, zaak);
  const id = mijn.body.lijst[0].id;

  const voor = (await api('/api/supplier/site/spoor', { id }, zaak)).body.lijst.length;
  assert.equal((await api('/api/supplier/site/live', { id }, zaak)).status, 200);
  const na = await api('/api/supplier/site/spoor', { id }, zaak);
  assert.ok(na.body.lijst.length > voor, 'publiceren laat een spoor na');

  const laatste = na.body.lijst[0];
  assert.match(laatste.wat, /gepubliceerd/);
  assert.ok(laatste.wie, 'bij een zaak staat erbij wie het deed');
  assert.ok(laatste.op, 'en wanneer');

  // het spoor is werk van de leiding: een medewerker leest het niet
  const gewoon = (await api('/api/supplier/roster', { code: 'ESVEDRA' })).body.staff.find(x => x.role !== 'manager');
  const mede = (await api('/api/supplier/login', { code: 'ESVEDRA', staffId: gewoon.id, pin: '5678' })).body.token;
  assert.equal((await api('/api/supplier/site/spoor', { id }, mede)).status, 403);
  assert.equal((await api('/api/supplier/site/plan', { id, moment: new Date(Date.now() + 60000).toISOString() }, mede)).status, 403);

  // en het spoor van andermans site bestaat niet
  assert.equal((await api('/api/site/spoor', { id }, lid)).status, 404);
});

test('19. een site lezen in je eigen taal: wel de tekst, niet de naam', async () => {
  /* Dezelfde zin staat in velden die WEL en velden die NIET vertaald mogen
     worden. Zo toetsen we onze eigen regel en niet de kwaliteit van het
     woordenboek: wat overblijft moet verschillen van wat verandert. */
  const Z = 'Neem contact op';
  const mk = await api('/api/site/bewaar', { design: { titel: 'Atelier Nora Vertaal',
    blokken: [
      { type: 'hero', kop: Z, sub: Z, knop: 'Contact' },
      { type: 'tekst', tekst: Z },
      { type: 'citaat', tekst: Z, bron: Z },
      { type: 'prijzen', regels: [{ naam: 'Sessie', prijs: Z, wat: Z }] }
    ] } }, lid);
  const id = mk.body.design.id;
  await api('/api/site/publiceer', { id, adres: 'atelier-nora-vertaal' }, lid);

  // zonder taalkeuze verandert er niets
  const kaal = await api('/api/browser/open', { adres: 'atelier-nora-vertaal' }, lid);
  assert.equal(kaal.body.vertaald, null);
  assert.equal(kaal.body.site.blokken[1].tekst, Z);

  // een tweede lid dat Engels leest
  const reg = await api('/api/auth/register', { name: 'Taal Lid', email: 'taallid@voorbeeld.test',
    password: 'webgeheim78', geboortedatum: '1995-05-05', tier: 'rtg', pasApp: 'rtg' });
  const eng = reg.body.token;
  assert.equal((await api('/api/member/taal/zet', { code: 'en' }, eng)).status, 200);

  const v = await api('/api/browser/open', { adres: 'atelier-nora-vertaal' }, eng);
  assert.equal(v.status, 200);
  assert.ok(v.body.vertaald, 'het antwoord zegt dat het vertaald is');
  assert.equal(v.body.vertaald.naar, 'en');

  const b = v.body.site.blokken;
  assert.notEqual(b[1].tekst, Z, 'lopende tekst wordt vertaald');
  assert.notEqual(b[2].tekst, Z, 'de tekst van een citaat ook');
  assert.notEqual(b[3].regels[0].wat, Z, 'en de omschrijving bij een prijs');
  // EEN NAAM IS GEEN ZIN: identiteit, bronvermelding en prijs blijven staan
  assert.equal(b[0].kop, Z, 'de hero-kop is de naam en blijft staan');
  assert.equal(b[2].bron, Z, 'de bron van een citaat is een mens');
  assert.equal(b[3].regels[0].prijs, Z, 'een prijs is geen zin');
  // en het origineel is niet aangetast: de maker leest zijn eigen tekst nog
  const eigen = await api('/api/site/haal', { id }, lid);
  assert.equal(eigen.body.design.blokken[1].tekst, Z);
});

test('20. cijfers tellen gebeurtenissen, geen mensen -- en je eigen bezoek telt niet mee', async () => {
  const mk = await api('/api/site/bewaar', { design: { titel: 'Meethuis', blokken: [{ type: 'kop', tekst: 'Hoi' }],
    paginas: [{ naam: 'Contact', blokken: [{ type: 'kop', tekst: 'Schrijf' }] }] } }, lid);
  const id = mk.body.design.id;
  await api('/api/site/publiceer', { id, adres: 'meethuis' }, lid);

  // de maker kijkt zelf: dat hoort niet mee te tellen
  await api('/api/browser/open', { adres: 'meethuis' }, lid);
  await api('/api/browser/open', { adres: 'meethuis' }, lid);
  const eigen = await api('/api/site/cijfers', { id }, lid);
  assert.equal(eigen.status, 200, JSON.stringify(eigen.body));
  assert.equal(eigen.body.cijfers.totaal, 0, 'je eigen site nakijken blaast je cijfers niet op');

  // een echte bezoeker, op twee pagina's
  const reg = await api('/api/auth/register', { name: 'Kijk Lid', email: 'kijklid@voorbeeld.test',
    password: 'webgeheim90', geboortedatum: '1996-06-06', tier: 'rtg', pasApp: 'rtg' });
  const kijker = reg.body.token;
  await api('/api/browser/open', { adres: 'meethuis' }, kijker);
  await api('/api/browser/open', { adres: 'meethuis', pad: 'contact' }, kijker);
  await api('/api/browser/open', { adres: 'meethuis', pad: 'contact' }, kijker);

  const c = (await api('/api/site/cijfers', { id }, lid)).body.cijfers;
  assert.equal(c.totaal, 3, 'drie bezoeken van buiten');
  const perPagina = Object.fromEntries(c.paginas.map(p => [p.slug, p.aantal]));
  assert.equal(perPagina.home, 1);
  assert.equal(perPagina.contact, 2, 'per pagina geteld');
  assert.equal(c.dagen.length, 1, 'en per dag, niet per moment');
  assert.ok(c.dagen[0].dag.length === 10, 'een dag is een datum, geen tijdstip');

  /* GEEN MENSEN. Er mag nergens een sleutel, codenaam of tijdstip in de
     cijfers opduiken -- anders is dit geen teller maar een lijst van wie waar
     heeft gekeken. */
  const rauw = JSON.stringify(c);
  assert.ok(!/Kijk Lid/.test(rauw), 'geen naam');
  assert.ok(!/[0-9]{2}:[0-9]{2}/.test(rauw), 'geen tijdstippen');
  assert.ok(Array.isArray(c.nietGemeten) && c.nietGemeten.length, 'er staat bij wat er NIET gemeten wordt');

  // de cijfers zijn van de eigenaar
  assert.equal((await api('/api/site/cijfers', { id }, kijker)).status, 404);
});

test('21. het beeld voor RTG: tellingen over het web heen, en alleen voor het kantoor', async () => {
  const office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const o = await api('/api/office/web/overzicht', {}, office);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.ok(o.body.sites > 0 && o.body.online > 0, 'RTG ziet hoe groot het eigen web is');
  assert.ok(o.body.zakelijk >= 1, 'en hoeveel daarvan bedrijfssites zijn');
  assert.ok(Array.isArray(o.body.top) && o.body.top.length, 'met de best bezochte sites');
  // ook hier geen mensen: alleen adres, titel en aantallen
  assert.deepEqual(Object.keys(o.body.top[0]).sort(), ['adres', 'bezoeken', 'titel', 'zaak']);

  // een gewoon lid komt hier niet
  assert.equal((await api('/api/office/web/overzicht', {}, lid)).status, 401);
});

test('22. een merk met vestigingen: een sjabloon, en toch per vestiging een eigen site', async () => {
  const office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;

  assert.equal((await api('/api/office/merk/maak', { code: 'ZEILHUIS', naam: 'Zeilhuis' }, office)).status, 200);
  assert.equal((await api('/api/office/merk/maak', { code: 'ZEILHUIS', naam: 'Zeilhuis' }, office)).status, 409, 'niet twee keer');

  // twee bestaande zaken als vestiging; een verzonnen code komt er niet in
  assert.equal((await api('/api/office/merk/vestiging', { code: 'ZEILHUIS', zaak: 'ESVEDRA' }, office)).status, 200);
  assert.equal((await api('/api/office/merk/vestiging', { code: 'ZEILHUIS', zaak: 'SAKURA' }, office)).status, 200);
  assert.equal((await api('/api/office/merk/vestiging', { code: 'ZEILHUIS', zaak: 'BESTAATNIET' }, office)).status, 404);

  // een zaak hoort bij hooguit een merk
  assert.equal((await api('/api/office/merk/maak', { code: 'ANDERMERK', naam: 'Ander' }, office)).status, 200);
  const dubbel = await api('/api/office/merk/vestiging', { code: 'ANDERMERK', zaak: 'ESVEDRA' }, office);
  assert.equal(dubbel.status, 409, 'twee merken die dezelfde vestiging opeisen kan niet');

  // het hoofdontwerp: vaste tekst plus LIVE blokken
  const sj = await api('/api/office/merk/sjabloon', { code: 'ZEILHUIS', ontwerp: {
    titel: 'Zeilhuis', thema: 'licht', accent: '#857007',
    blokken: [
      { type: 'hero', kop: 'Zeilhuis', sub: 'Een merk, overal thuis' },
      { type: 'zaakdata', bron: 'contact' },
      { type: 'zaakdata', bron: 'menu' }
    ] } }, office);
  assert.equal(sj.status, 200, JSON.stringify(sj.body));

  const rol = await api('/api/office/merk/uitrol', { code: 'ZEILHUIS' }, office);
  assert.equal(rol.status, 200, JSON.stringify(rol.body));
  assert.equal(rol.body.uitgerold.length, 2, 'beide vestigingen hebben nu een site');

  /* HET PUNT: een sjabloon, maar geen twee gelijke sites. De live blokken
     lossen per vestiging op uit HAAR profiel. */
  const a = await api('/api/browser/open', { adres: rol.body.uitgerold[0].adres }, lid);
  const bb = await api('/api/browser/open', { adres: rol.body.uitgerold[1].adres }, lid);
  assert.equal(a.status, 200); assert.equal(bb.status, 200);
  assert.equal(a.body.site.blokken[0].sub, 'Een merk, overal thuis', 'de merktekst staat op beide');
  assert.equal(bb.body.site.blokken[0].sub, 'Een merk, overal thuis');
  const tekstA = JSON.stringify(a.body.site.blokken);
  const tekstB = JSON.stringify(bb.body.site.blokken);
  assert.notEqual(tekstA, tekstB, 'en toch verschillen de sites: de live blokken zijn lokaal');
  assert.match(tekstA + tekstB, /Tapasplank aan boord/, 'de kaart van Es Vedra staat op haar eigen site');

  // de huisstijl van het merk staat op beide
  assert.equal(a.body.site.thema, 'licht');
  assert.equal(a.body.site.accent, '#857007');
});

test('23. een vestiging beheert haar inhoud, maar kan de huisstijl van het merk niet omverven', async () => {
  const mijn = await api('/api/supplier/site/mijn', {}, zaak);
  const id = mijn.body.lijst[0].id;

  // de vestiging probeert eigen kleuren te zetten
  const bw = await api('/api/supplier/site/bewaar', { design: { id, titel: 'Es Vedra Cruises',
    thema: 'donker', accent: '#00FF00', kleuren: { bg: '#123456' },
    blokken: [{ type: 'kop', tekst: 'Eigen tekst mag wel' }] } }, zaak);
  assert.equal(bw.status, 200, JSON.stringify(bw.body));

  // de huisstijl komt van het merk, bij elke bewaring opnieuw
  assert.equal(bw.body.design.thema, 'licht', 'het thema van het merk wint');
  assert.equal(bw.body.design.accent, '#857007', 'en de accentkleur ook');
  assert.equal(bw.body.design.kleuren, null, 'eigen vrije kleuren komen er niet in');
  assert.equal(bw.body.design.merk, 'ZEILHUIS', 'de site weet bij welk merk hij hoort');
  // maar de eigen INHOUD is gewoon van de vestiging
  assert.equal(bw.body.design.blokken[0].tekst, 'Eigen tekst mag wel');
  /* En het scherm van de vestiging krijgt het merk mee: anders zet een
     vestiging kleuren die bij het bewaren stilletjes terugspringen, en een
     stille weigering is geen weigering. */
  const lijst = await api('/api/supplier/site/mijn', {}, zaak);
  assert.equal(lijst.body.lijst[0].merk, 'ZEILHUIS', 'de vestiging ziet bij welk merk zij hoort');

  // en een zaak zonder merk houdt haar eigen huisstijl
  const vrij = await api('/api/site/bewaar', { design: { titel: 'Vrije Site', accent: '#00FF00',
    blokken: [{ type: 'kop', tekst: 'Hoi' }] } }, lid);
  assert.equal(vrij.body.design.accent, '#00FF00', 'wie bij geen merk hoort kiest zelf');
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
