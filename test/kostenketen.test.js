/* DE HELE KETEN IN EEN KEER -- en de bewering die eronder ligt: er raakt geen
   euro zoek en er komt er geen bij.

   De andere kostentoetsen kijken elk naar een schakel: de meters, de herkomst,
   de maandafsluiting, de vooruitblik, de grens. Deze kijkt naar het GEHEEL, en
   hij toetst iets wat geen van de andere kan zien: dat de som van wat alle
   gebruikers dragen exact gelijk is aan wat het huis heeft uitgegeven.

   Dat is de belofte van deze laag in een som. Elke schakel afzonderlijk kan
   kloppen terwijl er tussen twee schakels een cent verdwijnt -- bij een
   verdeling over vier werelden en daarna over gebruikers binnen elke wereld zijn
   dat twee afrondingen achter elkaar, en dat is precies waar zoiets gebeurt.

   MUTATIE: in toerekening.js de restverdeling in verdeelCenten weghalen -- deze
   toets zakt dan, want dan telt de som van de delen niet meer op tot de nota.

   EN EEN MUTATIE DIE HIJ NIET VANGT, want dat hoort er ook te staan: de tweede
   verdeelstap over ALLE dragers laten lopen in plaats van over die van een
   wereld, bleef hier GROEN. Logisch achteraf -- dan krijgt elke gebruiker vier
   regels in plaats van een, maar de SOM blijft de nota. Een optelling ziet
   vermenging niet. Daarom staat er hieronder ook een telling per gebruiker, en
   toetst test/economie.test.js dezelfde mutatie nog eens van de andere kant.

   Draai los: node --experimental-sqlite --test test/kostenketen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zien');
});
test.after(() => stop(srv));

test('van leveranciersfactuur tot gebruikersrekening raakt er geen cent zoek', async () => {
  const P = (await api('/api/office/kosten/overzicht', {}, kantoor)).body.periode;

  // ---- 1. de facturen van onze leveranciers, en de tarieven eruit ----
  const fac = await api('/api/office/kosten/leveranciersfactuur/zet',
    { leverancier: 'Hoster BV', nummer: 'KETEN-1', centen: 2000000 }, kantoor);
  assert.equal(fac.status, 200);
  const fid = fac.body.factuur.id;
  const tar = await api('/api/office/kosten/tarief/zet', { soort: 'verzoek', perEenheid: 20000, factuurId: fid }, kantoor);
  assert.equal(tar.status, 200);

  // ---- 2. drie economieen die verbruiken ----
  const lidToken = async () => (await api('/api/auth/register', {
    name: 'Keten Lid', email: 'keten-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' })).body.token;
  const a = await lidToken(), b = await lidToken();
  for (let i = 0; i < 7; i++) await api('/api/kosten/mij', {}, a);
  for (let i = 0; i < 3; i++) await api('/api/kosten/mij', {}, b);
  const gezin = await api('/api/foundation/gezin/maak', { gezinsnaam: 'Keten', naam: 'Ouder', pin: '1234' });
  for (let i = 0; i < 5; i++) await api('/api/foundation/gezin/inloggen', { code: gezin.body.code });

  // ---- 3. de nota's erin, met dezelfde factuur als bron ----
  const NOTA_STROOM = 87401, NOTA_HOSTING = 176181;
  assert.equal((await api('/api/office/kosten/nota/zet',
    { periode: P, soort: 'stroom', centen: NOTA_STROOM, factuurId: fid }, kantoor)).status, 200);
  assert.equal((await api('/api/office/kosten/nota/zet',
    { periode: P, soort: 'hosting', centen: NOTA_HOSTING, factuurId: fid }, kantoor)).status, 200);

  /* Vanaf hier alleen nog kantoorroutes: die lopen niet langs de ledenpoort en
     verschuiven de verdeelsleutel dus niet tijdens het meten. */
  const overzicht = (await api('/api/office/kosten/overzicht', { periode: P }, kantoor)).body;
  const dragers = overzicht.gebruikers.map(g => g.drager);
  assert.ok(dragers.length >= 3, 'er zijn minder dan drie dragers; dan bewijst de optelling weinig');

  // ---- 4. DE SOM. Elke gebruiker opgeteld, per toegerekende soort ----
  const perSoort = {};
  let directTotaal = 0;
  for (const drager of dragers) {
    const beeld = (await api('/api/office/kosten/gebruiker', { periode: P, drager }, kantoor)).body;
    /* EEN REGEL PER SOORT PER GEBRUIKER, en dat is een andere bewering dan de
       optelling hieronder. Een som ziet vermenging niet: als elke gebruiker het
       deel van ALLE werelden zou krijgen, blijft het totaal de nota en klopt er
       toch niets van. */
    const aantalPer = {};
    for (const r of beeld.overzicht.toegerekend) aantalPer[r.soort] = (aantalPer[r.soort] || 0) + 1;
    for (const soort of Object.keys(aantalPer)) {
      assert.equal(aantalPer[soort], 1,
        drager + ' kreeg ' + aantalPer[soort] + ' regels voor ' + soort + '; dan deelt hij mee in het deel van een andere economie');
    }
    for (const r of beeld.overzicht.toegerekend) {
      assert.equal(r.wereld, beeld.overzicht.wie.soort === 'gezin' ? 'rtfoundation'
        : beeld.overzicht.wie.soort === 'lid' ? 'consument'
        : beeld.overzicht.wie.soort === 'zaak' ? 'commercieel' : 'rtg-intern',
        drager + ' kreeg een regel uit de wereld ' + r.wereld);
      perSoort[r.soort] = (perSoort[r.soort] || 0) + r.centen;
    }
    directTotaal += beeld.overzicht.regels.reduce((s, r) => s + (r.millicenten || 0), 0);
  }
  assert.equal(perSoort.stroom, NOTA_STROOM,
    'de verdeelde stroom telt niet op tot de nota; er raakte een cent zoek tussen de twee verdeelstappen');
  assert.equal(perSoort.hosting, NOTA_HOSTING,
    'de verdeelde serverhuur telt niet op tot de nota');

  /* EN DE ANDERE KANT OP: de werelddelen tellen ook op tot de nota. Twee wegen
     naar hetzelfde bedrag, want een verdeling kan per wereld kloppen en over de
     werelden heen toch niet. */
  const werelden = (await api('/api/office/economie/werelden', { periode: P }, kantoor)).body;
  const perWereld = {};
  for (const post of werelden.wereldposten) perWereld[post.soort] = (perWereld[post.soort] || 0) + post.centen;
  assert.equal(perWereld.stroom, NOTA_STROOM, 'de werelddelen tellen niet op tot de stroomnota');
  assert.equal(perWereld.hosting, NOTA_HOSTING, 'de werelddelen tellen niet op tot de hostingnota');

  /* En het huisbeeld zegt hetzelfde: de kosten per wereld opgeteld zijn de
     kosten van het huis. Een derde weg naar hetzelfde getal. */
  const perWereldTotaal = overzicht.dekking.werelden.reduce((s, w) => s + w.kostenCenten, 0);
  assert.equal(perWereldTotaal, overzicht.dekking.kostenCenten,
    'de kosten per economie tellen niet op tot het huistotaal');

  /* ---- 5. En het directe deel is geen nul: anders toetst het bovenstaande een
     verdeling over gebruikers die niets doen. ---- */
  assert.ok(directTotaal > 0, 'er is geen enkele gemeten kost; dan is er ook geen sleutel om iets over te verdelen');

  // ---- 6. de herkomst van dat bedrag loopt terug tot dezelfde factuur ----
  const h = (await api('/api/office/kosten/herkomst',
    { periode: P, drager: dragers.find(d => d.startsWith('lid:')), soort: 'verzoek' }, kantoor)).body;
  const laatste = h.keten[h.keten.length - 1];
  assert.equal(laatste.gevonden, true, 'de keten eindigt niet bij een factuur');
  assert.equal(laatste.nummer, 'KETEN-1',
    'de herkomst wijst een andere factuur aan dan die waar het tarief uit kwam');
});
