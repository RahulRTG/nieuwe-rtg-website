/* De geld-regie van de boardroom: RTG bepaalt de pasprijzen (publiek
   zichtbaar, de voorwaarden volgen live), de interne partnervergoeding per
   genre of per zaak, en het RTG-ledenvoordeel per genre (RTG legt bij; de
   zaak houdt het volle bedrag, dus de nettoprijzen-belofte blijft staan).
   Draai los: node --test test/geldregie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, lid, sup, genre;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geld-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Geldlid', email: 'geld' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  // de demo-zaak KIKUNOI met een vaste kaart, om het ledenvoordeel echt af te rekenen
  const login = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  sup = { token: login.body.token, code: 'KIKUNOI' };
  await api('/api/supplier/menu', { menu: [
    { id: 'ramen', name: 'Tonkotsu Ramen', price: 22, publiekePrijs: 22, cat: 'Warm', station: 'keuken', sectie: 'warm' }
  ] }, sup.token);
  assert.ok(office && lid && sup.token, 'kantoor, lid en zaak zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. pasprijzen: de ladder publiek zichtbaar, met bodems die houden', async () => {
  const p = await api('/api/pasprijzen', {});
  assert.equal(p.status, 200);
  assert.equal(p.body.passen.gratis.maandCenten, 0, 'de gratis app kost niets');
  assert.equal(p.body.passen.gratis.vast, true, 'en dat staat vast');
  assert.equal(p.body.passen.rtg.maandCenten, 6500, 'RTG Pass 65 euro ex btw');
  assert.equal(p.body.passen.rtg.rtfCenten, 1950, '30% naar de RTFoundation');
  /* De twee bovenste treden zijn CONTRACTUEEL: een vanaf, geen prijs. Stond hier
     een maandbedrag, dan zou de voorwaardenpagina een bedrag publiceren dat voor
     geen enkele klant het afgesproken bedrag hoeft te zijn. */
  assert.equal(p.body.passen.business.vanafCenten, 500000, 'Business vanaf 5.000 euro');
  assert.equal(p.body.passen.business.maandCenten, undefined, 'en dus geen maandbedrag');
  assert.equal(p.body.passen.lifestyle.vanafCenten, 2000000, 'Lifestyle vanaf 20.000 euro');
  assert.equal(p.body.passen.lifestyle.maandCenten, undefined, 'en dus geen maandbedrag');

  // de boardroom zet een nieuwe RTG-prijs en het publieke endpoint volgt meteen
  const zet = await api('/api/office/geld/pasprijs', { pas: 'rtg', euro: 70 }, office);
  assert.equal(zet.status, 200);
  const na = await api('/api/pasprijzen', {});
  assert.equal(na.body.passen.rtg.maandCenten, 7000);
  assert.equal(na.body.passen.rtg.rtfCenten, 2100);
  /* EN DE PRIJSLIJST IS OOK MET EEN GEWONE GET OP TE HALEN, want dit is het
     publieke endpoint: een browser, een prijsvergelijker of een link haalt hem
     met GET op en niet met POST + JSON. Die GET stond wel geregistreerd
     (routes/kantoren/geld.js hangt beide werkwoorden op) maar was nooit
     aangeroepen -- de dekkingsmeting telde per PAD, dus de POST hierboven zette
     hem gratis op groen. Haal de GET-regel weg en elke publieke beller krijgt
     404, terwijl de suite groen blijft. */
  const viaGet = await fetch(base + '/api/pasprijzen').then(async r => ({ status: r.status, body: await r.json() }));
  assert.equal(viaGet.status, 200, 'de publieke prijslijst antwoordt op GET');
  assert.deepEqual(viaGet.body, na.body, 'en geeft exact dezelfde prijzen als de POST');

  // de vaste afspraken zijn niet te verzetten
  assert.equal((await api('/api/office/geld/pasprijs', { pas: 'gratis', euro: 5 }, office)).status, 400);
  assert.equal((await api('/api/office/geld/pasprijs', { pas: 'business', euro: 5000 }, office)).status, 400,
    'ook een bedrag BOVEN de bodem gaat niet in de prijslijst: het hoort op het contract');
  // en de bodem van de trede zelf houdt, ook via de API
  assert.equal((await api('/api/office/geld/pasprijs', { pas: 'rtg', euro: 40 }, office)).status, 400,
    'onder de bodem van 65 euro kan de RTG Pass niet');
  await api('/api/office/geld/pasprijs', { pas: 'rtg', euro: 65 }, office);
});

/* WAT HIER STOND was een toets op een knop die niet had moeten bestaan: een
   partnervergoeding per genre, met een eigen afspraak per zaak die voorging, tot
   30 procent. Ondertussen beloofden de partnervoorwaarden 0% commissie en
   printten twee schermen hard "RTG-commissie EUR 0,00".

   De toets was dus groen op gedrag dat in strijd was met het contract -- en dat
   is de reden dat hij hier vervangen is in plaats van aangepast. De invarianten
   zelf staan in test/commercie.test.js; dit is de weg erheen via de API. */
test('2. partnervergoeding: nul, en er valt niets te zetten', async () => {
  const o = await api('/api/office/geld', {}, office);
  assert.equal(o.status, 200);
  const zaak = o.body.zaken.find(z => z.code === 'KIKUNOI');
  genre = zaak.genre;
  assert.equal(zaak.rate, 0, 'elke zaak staat op nul, wat er ook in haar rij is opgeslagen');
  assert.equal(o.body.partnervergoeding.overOmzet, 0);

  // en de knop is weg: zetten wordt geweigerd, met de reden en met wat het wel kan zijn
  const g = await api('/api/office/geld/commissie', { genre, pct: 10 }, office);
  assert.equal(g.status, 400, 'een commissie zetten hoort niet te kunnen');
  assert.match(g.body.error, /geen commissie/);
  const per = await api('/api/office/geld/commissie', { code: 'KIKUNOI', pct: 12.5 }, office);
  assert.equal(per.status, 400, 'ook niet per zaak');

  // en na twee geweigerde pogingen staat alles nog steeds op nul
  const na = await api('/api/office/geld', {}, office);
  assert.equal(na.body.zaken.find(z => z.code === 'KIKUNOI').rate, 0);

  // wat RTG wel in rekening kan brengen, staat er benoemd bij
  assert.ok(na.body.vergoedingssoorten.length >= 4, 'de benoemde diensten staan op het bord');
  assert.ok(na.body.vergoedingssoorten.every(v => v.overOmzet === false),
    'en geen ervan neemt een aandeel in de omzet van de partner');
});

test('3. ledenvoordeel per genre: RTG legt bij; het lid ziet het, de zaak houdt het volle bedrag', async () => {
  const zet = await api('/api/office/geld/korting', { genre, pct: 10 }, office);
  assert.equal(zet.status, 200);
  const plaats = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'ramen', qty: 1 }] }, lid);
  assert.equal(plaats.status, 200, JSON.stringify(plaats.body));
  const betaal = await api('/api/order/pay', { ref: plaats.body.order.ref }, lid);
  assert.equal(betaal.status, 200);
  assert.equal(betaal.body.order.total, 22, 'de zaak houdt het volle bedrag (nettoprijzen-belofte)');
  assert.equal(betaal.body.order.regieKorting, 2.2, 'het lid krijgt 10% RTG-ledenvoordeel');
  // voordeel op nul zetten haalt de regel weg
  await api('/api/office/geld/korting', { genre, pct: 0 }, office);
  const o2 = await api('/api/office/geld', {}, office);
  assert.equal(o2.body.kortingen[genre], undefined);
  // grenzen: meer dan 50% kan niet
  assert.equal((await api('/api/office/geld/korting', { genre, pct: 60 }, office)).status, 400);
});

/* DE COMMERCIELE CLAIMS, EN DAN DE PUBLIEKE INGANG ERVAN.

   test/claims-btw.test.js keurt de claims al als MODULE: elke bewering heeft een
   waarde, een bron en een dekking, en wie zich AFGEDWONGEN noemt zonder toets
   laat de poort zakken. Wat daar niet gebeurt, is de weg erheen: `GET
   /api/claims`. Dat is precies het endpoint waar een voorwaardenpagina zijn
   bedragen vandaan haalt in plaats van ze zelf op te schrijven -- de reparatie
   van "0% commissie naast een commissieknop die op 12 stond".

   Diezelfde GET was door de hele suite nooit aangeroepen. Dat is dezelfde fout
   als bij /api/pasprijzen in toets 1: routes/kantoren/geld.js hangt GET en POST
   allebei op, en zolang alleen de POST wordt beproefd kan de GET-regel weg
   zonder dat er iets rood wordt -- terwijl elke publieke beller dan 404 krijgt.

   En de kant die er hier bij hoort: de lijst is publiek, de RELEASE-POORT
   erover niet. Die zegt of er een bewering tussen zit die zich harder voordoet
   dan hij is, en dat is intern werk. */
test('4. claims: publiek met GET, zonder het interne toetsveld, en de poort erover blijft binnen', async () => {
  const r = await fetch(base + '/api/claims').then(async x => ({ status: x.status, body: await x.json() }));
  assert.equal(r.status, 200, 'de claimlijst antwoordt op een gewone GET');
  assert.ok(Array.isArray(r.body.claims) && r.body.claims.length >= 10,
    'er staat een lijst beweringen in, geen leeg omhulsel');

  const DEKKINGEN = ['AFGEDWONGEN', 'GEBOUWD', 'BELOFTE'];
  for (const c of r.body.claims) {
    for (const veld of ['id', 'onderwerp', 'waarde', 'tekst', 'bron']) {
      assert.ok(c[veld], JSON.stringify(c.id) + ' mist ' + veld + ': een bewering zonder ' + veld + ' is geen claim');
    }
    assert.ok(DEKKINGEN.includes(c.dekking), c.id + ' heeft een onbekende dekking: ' + c.dekking);
    /* Welke TOETS een claim bewaakt, is interne verantwoording: die hoort bij de
       poort en niet in een publiek antwoord. Gaat de route ooit claims.claims()
       teruggeven in plaats van claims.publiek(), dan lekt dat mee. */
    assert.equal('toets' in c, false, c.id + ' draagt het interne toetsveld naar buiten');
  }

  /* De bewering waar dit endpoint voor bestaat, en hij sluit aan op toets 2: de
     boardroom kan geen commissie zetten, en publiek staat er ZERO. */
  const commissie = r.body.claims.find(c => c.id === 'claim.partner.commission');
  assert.ok(commissie, 'de partnervergoeding staat in de publieke claims');
  assert.equal(commissie.waarde, 'ZERO', 'RTG rekent geen commissie over partneromzet');
  assert.equal(commissie.dekking, 'AFGEDWONGEN');
  assert.equal(commissie.bron, 'kern/commercie/vergoeding.js', 'met de laag erbij die hem waarmaakt');

  // GET en POST zijn hetzelfde publieke antwoord (dezelfde reden als bij de prijslijst)
  const viaPost = await api('/api/claims', {});
  assert.equal(viaPost.status, 200);
  assert.deepEqual(viaPost.body, r.body, 'de POST geeft exact dezelfde claims als de GET');

  // en de release-poort erover is intern: anoniem komt daar niemand langs
  const anoniem = await api('/api/office/claims/poort', {});
  /* 401 en niet "iets boven de 400": een 500 zou hier ook slagen, en dan
     leest een STORING als een geweigerde toegang. CONTROLPLANE.md is daar
     uitdrukkelijk over -- ONBEKEND is met opzet geen synoniem van WEIGEREN. */
  assert.equal(anoniem.status, 401, 'de claimpoort hoort achter de kantoordeur te zitten');
  const keuring = await api('/api/office/claims/poort', {}, office);
  assert.equal(keuring.status, 200);
  assert.equal(keuring.body.ok, true,
    'geen bewering doet zich harder voor dan hij is: ' + (keuring.body.problemen || []).join('; '));
});

/* DE SOCIALE VERDEELREGELS, EN DAN DE PUBLIEKE INGANG ERVAN.

   test/allocatie.test.js keurt de verdeling al als MODULE: 30% ex btw, gesplitst
   in 20 lokaal en 10 foundation, met per deel waaróm dat geld daarheen gaat en
   met een versie zodat een nieuwe regel het verleden niet herschrijft. Wat daar
   niet gebeurt, is de weg erheen: `GET /api/sociaalbeleid`.

   Diezelfde GET was door de hele suite nooit aangeroepen -- exact de fout uit
   toets 1 en toets 4 hierboven. routes/kantoren/geld.js hangt GET en POST
   allebei op, en test/nieuwe-endpoints.test.js beproeft alleen de POST; zolang
   het daarbij blijft kan de GET-regel weg zonder dat er iets rood wordt,
   terwijl elke publieke beller dan 404 krijgt. En publiek is hij met reden: de
   verdeelregels zijn een belofte aan leden en staan in de voorwaarden, dus die
   pagina hoort ze hier op te halen in plaats van ze zelf op te schrijven
   (COMMERCIE.md par. 9).

   En de kant die er hier bij hoort, want het is de scherpste grens van dit
   endpoint: de REGELS zijn publiek, de BEDRAGEN niet. Wie wat heeft bijgedragen
   staat op codenaam achter de kantoorpoort (/api/office/sociaal). Wordt deze
   route ooit aan socialeStand() geknoopt in plaats van aan de regeltabel, dan
   liggen die sommen zonder inlog op straat. */
test('5. sociaalbeleid: de verdeelregels publiek met GET, en zonder één bedrag erin', async () => {
  const r = await fetch(base + '/api/sociaalbeleid').then(async x => ({ status: x.status, body: await x.json() }));
  assert.equal(r.status, 200, 'de verdeelregels antwoorden op een gewone GET, zonder inlog');
  assert.ok(Array.isArray(r.body.regels) && r.body.regels.length >= 1,
    'er staat een regeltabel in, geen leeg omhulsel');
  assert.ok(r.body.huidig, 'het antwoord zegt welke versie nu geldt');

  const nu = r.body.regels.find(x => x.versie === r.body.huidig);
  assert.ok(nu, 'de geldende versie ' + r.body.huidig + ' staat zelf ook in de lijst');
  assert.equal(nu.totaalDeel, 0.30, '30% van elke bijdrage -- de belofte uit de voorwaarden');
  assert.equal(nu.exBtw, true, 'ex btw: btw is geld van de Belastingdienst, geen omzet van RTG');
  assert.ok(nu.vanaf, 'een regel zonder ingangsdatum kan het verleden niet met rust laten');

  const deel = id => nu.delen.find(d => d.id === id);
  assert.equal(deel('lokaal').deel, 0.20, '20% blijft lokaal');
  assert.equal(deel('foundation').deel, 0.10, '10% naar de stichting');
  for (const d of nu.delen) {
    assert.ok(d.label, d.id + ' mist een label');
    assert.ok(d.waarom && d.waarom.length > 20,
      d.id + ' hoort publiek uit te leggen waar dat geld heen gaat; anders is 30% een kaal getal');
  }
  /* In TIENDUIZENDSTEN, niet in drijvende komma: 0.20 + 0.10 is in JavaScript
     0.30000000000000004, en een toets die daarop struikelt keurt een kloppende
     verdeling af (kern/commercie/allocatie/regels.js zegt hetzelfde). */
  const som = Math.round(nu.delen.reduce((s, d) => s + d.deel, 0) * 10000);
  assert.equal(som, Math.round(nu.totaalDeel * 10000),
    'de delen tellen niet op tot het totaal dat publiek beloofd wordt');

  /* GEEN BEDRAGEN. /api/office/sociaal geeft per deel gereserveerd, betaalbaar
     en afgewikkeld in centen; dat hoort achter de kantoordeur en niet hier. */
  const rauw = JSON.stringify(r.body);
  assert.equal(/centen/i.test(rauw), false, 'het publieke beleid draagt een bedrag mee: ' + rauw.slice(0, 200));
  assert.equal('perDeel' in r.body, false, 'de stand per deel is kantoorwerk, geen publiek antwoord');

  // GET en POST zijn hetzelfde publieke antwoord (dezelfde reden als bij de prijslijst)
  const viaPost = await api('/api/sociaalbeleid', {});
  assert.equal(viaPost.status, 200);
  assert.deepEqual(viaPost.body, r.body, 'de POST geeft exact dezelfde regels als de GET');

  // en de stand met de bedragen erin blijft binnen
  const anoniem = await api('/api/office/sociaal', {});
  assert.equal(anoniem.status, 401, 'de sociale stand hoort achter de kantoordeur te zitten');

  /* HET PERCENTAGE MAG NIET UIT ELKAAR LOPEN met wat RTG publiek beweert. Dit
     is dezelfde fout als "0% commissie naast een commissieknop op 12": twee
     publieke endpoints die hetzelfde getal apart opschrijven. */
  const claims = await fetch(base + '/api/claims').then(x => x.json());
  const sociaal = claims.claims.find(c => c.id === 'claim.social.share');
  assert.ok(sociaal, 'de sociale afdracht staat in de publieke claims');
  assert.equal(sociaal.waarde, Math.round(nu.totaalDeel * 100) + '%',
    'de claim en de verdeelregels noemen een ander percentage');
});
