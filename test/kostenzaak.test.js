/* RTG KOSTPRIJS VOOR EEN ZAAK: wat het gebruik van deze zaak ons kost.

   Er stond geen enkele toets op /api/supplier/kosten, terwijl dat de route is
   waarop de rekening van een ONDERNEMER wordt gebouwd. Deze drie routes zijn de
   zakelijke tegenhanger van de ledenroutes in kosten.test.js, en de vraag die
   ze allemaal moeten overleven is dezelfde: kan een zaak het verbruik van een
   ander te zien krijgen?

   Elke toets hieronder is tegen een tijdelijk kapotgemaakte kern gezien zakken
   (LAT.md regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kostenzaak.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor, zaak;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer();
  base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier geen tarief te zetten');
  const lg = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  zaak = lg.body.token;
  assert.ok(zaak, 'geen zaak-sessie: ' + JSON.stringify(lg.body).slice(0, 160));
});
test.after(() => stop(srv));

test('een zaak ziet zijn EIGEN verbruik, en de drager komt uit de sessie', async () => {
  /* DE MUTATIE: laat de route de drager uit req.body halen
     (`kosten.drager('zaak', req.body.code || req.supplier.code)`). Dan leest
     deze toets het beeld van een andere zaak terug, en is elke zaakcode een
     sleutel tot andermans verbruik. */
  const eigen = await api('/api/supplier/kosten', {}, zaak);
  assert.equal(eigen.status, 200, JSON.stringify(eigen.body).slice(0, 200));
  assert.match(eigen.body.overzicht.drager, /^zaak:/, 'een zaak hoort als zaak geteld te worden');
  const mijn = eigen.body.overzicht.drager;

  const gestolen = await api('/api/supplier/kosten', { drager: 'zaak:ANDERS', code: 'ANDERS' }, zaak);
  assert.equal(gestolen.body.overzicht.drager, mijn,
    'de drager komt uit het lichaam van het verzoek; dan is elke zaakcode een sleutel tot andermans verbruik');

  // en zonder sessie helemaal niets
  const zonder = await api('/api/supplier/kosten', {});
  assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder zaak-sessie hoort dit dicht te zitten');
});

test('zonder tarief staat er geen bedrag, met tarief wel -- en met zijn bewijsgraad', async () => {
  /* Dit is dezelfde grens als op het ledenscherm en de belangrijkste van de
     hele laag: geen tarief betekent GEEN bedrag, en niet nul. Nul leest als
     gratis, en dat is een andere bewering (KOSTEN.md par. 1).

     DE MUTATIE: laat regelVan() bij een ontbrekend tarief `millicenten: 0`
     teruggeven in plaats van null. Elke rekening in dit huis wordt dan stil te
     laag, en niets meldt het. */
  const voor = await api('/api/supplier/kosten', {}, zaak);
  const soortVoor = (voor.body.overzicht.regels || []).find(r => r.soort === 'verzoek');
  assert.ok(soortVoor, 'de zaak hoort serververzoeken te maken; die worden op de poort geteld');
  assert.equal(soortVoor.millicenten, null, 'zonder tarief hoort er geen bedrag te staan');
  assert.equal(soortVoor.graad, 'onbekend');

  const gezet = await api('/api/office/kosten/tarief/zet',
    { soort: 'verzoek', perEenheid: 400000, bron: 'Contract hoster, zaaktoets' }, kantoor);
  assert.ok(gezet.body.ok, JSON.stringify(gezet.body).slice(0, 160));

  const na = await api('/api/supplier/kosten', {}, zaak);
  const soortNa = na.body.overzicht.regels.find(r => r.soort === 'verzoek');
  assert.ok(soortNa.millicenten > 0, 'met een tarief hoort er wel een bedrag te staan');
  assert.equal(soortNa.graad, 'gemeten', 'een teller komt tot gemeten en niet hoger');
  assert.ok(na.body.overzicht.totaal.centen >= 0 && na.body.overzicht.totaal.graad !== 'onbekend');
});

test('de herkomst van een zaakbedrag eindigt eerlijk bij de bron', async () => {
  /* DE MUTATIE: laat de factuurschakel weg uit de keten in kern/kosten/herkomst.js.
     De keten ziet er dan compleet uit en houdt stilletjes op bij het tarief --
     precies de keten die zich voordoet als bewijs tot aan de bron. */
  const r = await api('/api/supplier/kosten/herkomst', { soort: 'verzoek' }, zaak);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const stappen = r.body.keten.map(s => s.stap);
  assert.deepEqual(stappen, ['bedrag', 'verbruik', 'tarief', 'leveranciersfactuur'],
    'de keten hoort van bedrag tot leveranciersfactuur te lopen: ' + stappen.join(', '));
  const tarief = r.body.keten.find(s => s.stap === 'tarief');
  assert.match(tarief.bron, /Contract hoster/, 'het tarief hoort zijn bron mee te dragen');
  const factuur = r.body.keten.find(s => s.stap === 'leveranciersfactuur');
  assert.equal(factuur.gevonden, false);
  assert.ok(factuur.waarom, 'de keten hoort te zeggen waar hij ophoudt in plaats van stil te eindigen');
});

test('de vooruitblik van een zaak: een verwachting, en geen band die niet gemeten is', async () => {
  /* DE MUTATIE: geef in kern/kosten/vooruitblik.js altijd een band terug met
     een vaste marge van tien procent. Er staat dan een bandbreedte op het
     scherm die op niets berust -- een verzinsel met een decimaal. */
  const r = await api('/api/supplier/kosten/vooruitblik', {}, zaak);
  assert.equal(r.status, 200);
  assert.equal(r.body.lopend, true, 'de huidige maand loopt nog');
  assert.ok(r.body.verwachtCenten >= r.body.totNuCenten,
    'een projectie over een lopende maand ligt niet onder wat er nu al staat');
  assert.equal(r.body.band, null,
    'er staat een bandbreedte terwijl de trefzekerheid nog niet gemeten is');
  assert.match(r.body.zegtNiet, /doorgetrokken/, 'een projectie hoort te zeggen wat ze niet weet');
});
