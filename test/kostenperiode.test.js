/* EEN MAAND SLUITEN, EN WAAROM DAT NIET ZOMAAR KAN.

   "RTG accepteert geen onverklaarde kosten" was een zin. Deze toetsen leggen
   vast dat het een grens is: een maand gaat pas dicht als elk verschil een
   verklaring draagt, een gesloten maand verandert niet meer, en een maand in
   onderzoek gaat niet naar de rekening van een lid.

   DE SCHERPSTE BEWERING STAAT IN TOETS 2: een nota in een maand waarin niemand
   iets verbruikte, is geld dat het huis heeft uitgegeven zonder dat er iemand
   tegenover staat. Dat is geen afrondingsverschil maar een gat, en precies het
   soort post dat anders in "overige kosten" verdwijnt.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kostenperiode.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor, vorigeMaand, dezeMaand;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* De maand VOOR de huidige, gerekend vanuit wat de server zelf zegt dat het nu
   is. Zelf een datum uitrekenen zou op de eerste van de maand een andere maand
   opleveren dan de server telt. */
function maandVoor(p) {
  const jaar = Number(p.slice(0, 4));
  const maand = Number(p.slice(5, 7));
  return maand === 1 ? (jaar - 1) + '-12' : jaar + '-' + String(maand - 1).padStart(2, '0');
}

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zien');
  dezeMaand = (await api('/api/office/kosten/overzicht', {}, kantoor)).body.periode;
  vorigeMaand = maandVoor(dezeMaand);
});
test.after(() => stop(srv));

/* MUTATIE: in periode.js de voorbij()-controle weggehaald uit kanSluiten --
   deze toets zakt dan, want dan gaat een maand dicht die nog loopt. */
test('een maand die nog loopt gaat niet dicht', async () => {
  const st = await api('/api/office/kosten/periode', { periode: dezeMaand }, kantoor);
  assert.equal(st.status, 200);
  assert.equal(st.body.stand, 'open');
  assert.equal(st.body.voorbij, false);
  assert.equal(st.body.kanSluiten, false);
  assert.match(st.body.waarom, /loopt nog/i);

  const dicht = await api('/api/office/kosten/periode/sluit', { periode: dezeMaand }, kantoor);
  assert.equal(dicht.status, 409, 'een lopende maand werd gesloten');
});

/* MUTATIE: in periode.js de 'onverdeeld'-lus weggehaald -- deze toets zakt dan,
   want dan is een nota zonder verbruik geen verschil en gaat de maand zo dicht. */
test('een nota zonder verbruik houdt de maand open tot iemand hem verklaart', async () => {
  /* Een stroomnota in een maand waarin niets is gemeten. Er is dus geen sleutel
     om hem over gebruikers te verdelen, en dat is geld zonder eigenaar. */
  const nota = await api('/api/office/kosten/nota/zet',
    { periode: vorigeMaand, soort: 'stroom', centen: 14863, bron: 'Nota energieleverancier, vorige maand' }, kantoor);
  assert.equal(nota.status, 200);

  const st = await api('/api/office/kosten/periode', { periode: vorigeMaand }, kantoor);
  assert.equal(st.body.voorbij, true, 'de vorige maand hoort voorbij te zijn');
  assert.ok(st.body.onverklaard >= 1, 'een nota zonder verbruik telt niet als verschil');
  assert.equal(st.body.kanSluiten, false);
  const gat = st.body.verschillen.find(v => v.sleutel === 'onverdeeld:stroom');
  assert.ok(gat, 'het onverdeelde deel staat niet in de lijst');
  assert.equal(gat.verschilCenten, 14863);
  assert.match(gat.wat, /niet over gebruikers verdeeld/i);

  const dicht = await api('/api/office/kosten/periode/sluit', { periode: vorigeMaand }, kantoor);
  assert.equal(dicht.status, 409);
  assert.match(dicht.body.error, /verklaring/i);
});

/* MUTATIE: in periode.js de lengte-eis op de verklaring weggehaald -- deze toets
   zakt dan op de eerste helft, want dan gaat een leeg vinkje door voor een
   verklaring. */
test('een verklaring is tekst met een naam eronder, en daarna gaat de maand dicht', async () => {
  const leeg = await api('/api/office/kosten/periode/verklaar',
    { periode: vorigeMaand, sleutel: 'onverdeeld:stroom', tekst: 'ok' }, kantoor);
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /schrijf op/i);

  const goed = await api('/api/office/kosten/periode/verklaar',
    { periode: vorigeMaand, sleutel: 'onverdeeld:stroom',
      tekst: 'Deze maand draaide alleen de proefopstelling; er waren geen gebruikers. De stroom is een huiskost.' }, kantoor);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));
  assert.equal(goed.body.stand.stand, 'in-onderzoek', 'een verklaarde maand hoort in onderzoek te staan tot hij gesloten is');
  const v = goed.body.stand.verschillen.find(x => x.sleutel === 'onverdeeld:stroom');
  assert.match(v.verklaring.tekst, /proefopstelling/);
  assert.ok(v.verklaring.door, 'er staat niet bij WIE het verklaarde');

  const dicht = await api('/api/office/kosten/periode/sluit', { periode: vorigeMaand }, kantoor);
  assert.equal(dicht.status, 200, JSON.stringify(dicht.body).slice(0, 200));
  assert.equal(dicht.body.stand.stand, 'gesloten');
  assert.ok(dicht.body.stand.geslotenDoor, 'er staat niet bij wie sloot');
});

/* MUTATIE: in index.js postZetGeslotenControle vervangen door
   huisrekening.postZet -- deze toets zakt dan, want dan verandert een gesloten
   maand alsnog. */
test('een gesloten maand verandert niet meer, tenzij iemand hem heropent met een reden', async () => {
  const poging = await api('/api/office/kosten/nota/zet',
    { periode: vorigeMaand, soort: 'hosting', centen: 9999, bron: 'Late nota' }, kantoor);
  assert.equal(poging.status, 409, 'een gesloten maand nam een nieuwe nota aan');
  assert.match(poging.body.error, /gesloten/i);

  const zonderReden = await api('/api/office/kosten/periode/heropen', { periode: vorigeMaand }, kantoor);
  assert.equal(zonderReden.status, 400);
  assert.match(zonderReden.body.error, /reden/i);

  const open = await api('/api/office/kosten/periode/heropen',
    { periode: vorigeMaand, reden: 'Er kwam alsnog een creditnota van de hoster binnen.' }, kantoor);
  assert.equal(open.status, 200);
  assert.equal(open.body.stand.stand, 'in-onderzoek', 'een heropende maand hoort niet stilzwijgend open te staan');

  const nu = await api('/api/office/kosten/nota/zet',
    { periode: vorigeMaand, soort: 'hosting', centen: 9999, bron: 'Late nota' }, kantoor);
  assert.equal(nu.status, 200, 'na heropenen hoort het weer te kunnen');

  /* EN HET STAAT IN HET JOURNAAL. Op een gesloten maand kunnen facturen zijn
     gebaseerd; dat hij open is geweest hoort na te lezen te zijn. */
  const st = await api('/api/office/kosten/periode', { periode: vorigeMaand }, kantoor);
  assert.ok(st.body.journaal.some(j => j.wat === 'heropend' && /creditnota/.test(j.reden || '')),
    'het heropenen staat niet in het journaal');
  assert.ok(st.body.journaal.some(j => j.wat === 'gesloten'), 'het sluiten staat niet in het journaal');
});

/* MUTATIE: in doorbelasting.js de isOnderzoek-tak weggehaald -- deze toets zakt
   dan, want dan gaat er gefactureerd worden op cijfers waarvan dit huis zelf
   zegt dat ze niet kloppen. */
test('een maand in onderzoek gaat niet naar de rekening van een lid', async () => {
  const st = await api('/api/office/kosten/periode', { periode: vorigeMaand }, kantoor);
  assert.equal(st.body.stand, 'in-onderzoek', 'de opzet van deze toets klopt niet meer');

  const vrij = await api('/api/office/kosten/vrijgeven', { periode: vorigeMaand }, kantoor);
  assert.equal(vrij.status, 409, 'er werd vrijgegeven op een maand in onderzoek');
  assert.match(vrij.body.error, /onderzoek/i);
});
