/* De drie gezinsbibliotheken van de RTFoundation over de deur: de
   App-Bibliotheek (/api/rtf/bieb, routes/rtfbieb.js), de Geloof &
   Wijsheid-Bibliotheek (/api/rtf/geloof, routes/geloofbieb.js) en de
   Beroepen-Bibliotheek (/api/rtf/beroepen, routes/rtfschool.js).

   test/rtfschool.test.js beproeft de School-Bibliotheek; deze drie kasten met
   dezelfde poort (gezinscode + profieltoken) riep geen toets aan. De belofte
   is drie keer dezelfde en staat in de kop van elk routebestand:
     - de kast vult het GEZIN: een oppas of familielid (rol 'gast') kijkt mee
       maar installeert en verwijdert niets (403);
     - de leeftijdspoort: een beschermd profiel ziet en installeert nooit iets
       boven zijn groep (403), terwijl de ouder datzelfde item wel krijgt;
     - installeren is zichtbaar in /mijn en verwijderen haalt het er weer uit,
       en wat er niet in staat valt er ook niet uit (404).
   Elke bewering heeft zijn gevulde helft: eerst staat het erin, dan niet meer.

   Draai los: node --test test/rtf-bibliotheken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const post = (pad, body) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
// een bibliotheekvraag als een profiel: { code, token } komt uit de gezinssessie
const als = (pad, wie, body) => post(pad, Object.assign({ code: wie.code, token: wie.token }, body || {}));

let G;
async function gezin(naam) {
  const t = naam + Date.now().toString().slice(-5);
  const g = (await post('/api/foundation/gezin/maak', { gezinsnaam: t, naam: 'Ouder ' + t, pin: '1234' })).body;
  assert.ok(g.code && g.token, 'het gezin bestaat: ' + JSON.stringify(g).slice(0, 160));
  const kind = (await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + t, rol: 'kind', groep: 'kind' })).body;
  const kindToken = (await post('/api/foundation/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: kind.profiel.id })).body.token;
  const oppas = (await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oppas ' + t, rol: 'gast' })).body;
  const gastToken = (await post('/api/foundation/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: oppas.profiel.id })).body.token;
  assert.ok(kindToken && gastToken, 'kind en oppas hebben een profieltoken');
  return { ouder: { code: g.code, token: g.token }, kind: { code: g.code, token: kindToken }, gast: { code: g.code, token: gastToken } };
}

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfbieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  G = await gezin('Kast');
});
test.after(() => stop(srv && srv.child));

/* Een item dat de ouder wel en het kind niet mag zien: de ouder bladert door
   de catalogus tot er een item met een doelgroep buiten het zicht van het kind
   voorbijkomt. Zonder zo'n item kan de leeftijdspoort niet worden beproefd, en
   dan hoort de toets te zakken en niet stil door te gaan. */
async function bovenHetKind(pad, zichtKind) {
  for (let pagina = 1; pagina <= 40; pagina++) {
    const r = await als(pad, G.ouder, { pagina, per: 48 });
    assert.equal(r.status, 200, pad + ' voor de ouder: ' + JSON.stringify(r.body).slice(0, 160));
    const item = r.body.items.find(a => !zichtKind.has(a.doelgroep));
    if (item) return item;
    if (pagina >= r.body.paginas) break;
  }
  assert.fail('de ouder ziet in ' + pad + ' geen enkel item boven de groep van het kind; dan is de leeftijdspoort hier niet te beproeven');
}

/* Welke doelgroepen het kind te zien krijgt: alles wat in zijn eigen catalogus
   voorbijkomt. Twee pagina's zijn genoeg om de set te vullen; de bewering
   hieronder is dat de ouder iets BUITEN die set krijgt. */
async function zichtVan(pad, wie) {
  const zicht = new Set();
  let gezien = 0;
  for (let pagina = 1; pagina <= 3; pagina++) {
    const r = await als(pad, wie, { pagina, per: 48 });
    assert.equal(r.status, 200);
    for (const a of r.body.items) { zicht.add(a.doelgroep); gezien++; }
    if (pagina >= r.body.paginas) break;
  }
  assert.ok(gezien >= 1, pad + ': het kind ziet wel degelijk items');
  return zicht;
}

test('1. de poort: zonder geldig profieltoken gaat geen van de drie kasten open', async () => {
  for (const pad of ['/api/rtf/bieb', '/api/rtf/bieb/catalogus', '/api/rtf/bieb/installeer', '/api/rtf/bieb/weg', '/api/rtf/bieb/mijn',
    '/api/rtf/geloof', '/api/rtf/geloof/catalogus', '/api/rtf/geloof/installeer', '/api/rtf/geloof/weg', '/api/rtf/geloof/mijn',
    '/api/rtf/beroepen', '/api/rtf/beroepen/catalogus', '/api/rtf/beroepen/installeer', '/api/rtf/beroepen/weg', '/api/rtf/beroepen/mijn']) {
    assert.equal((await post(pad, { code: G.ouder.code, token: 'verzonnen' })).status, 403, pad + ' met een verzonnen token');
    assert.equal((await post(pad, {})).status, 403, pad + ' zonder gezin');
  }
  // en met het echte token gaat de deur wel open: anders zegt de 403 niets
  assert.equal((await als('/api/rtf/bieb', G.ouder)).status, 200);
  assert.equal((await als('/api/rtf/geloof', G.ouder)).status, 200);
  assert.equal((await als('/api/rtf/beroepen', G.ouder)).status, 200);
});

test('2. de App-Bibliotheek: de ouder installeert, het kind blijft onder zijn groep, de oppas kijkt alleen', async () => {
  const o = await als('/api/rtf/bieb', G.ouder);
  assert.equal(o.status, 200);
  assert.equal(o.body.gratis, true);
  assert.ok(o.body.totaal > 0 && o.body.categorieen.length >= 1, 'de kast is gevuld en in categorieen verdeeld');
  const kindZicht = await zichtVan('/api/rtf/bieb/catalogus', G.kind);
  const volwassen = await bovenHetKind('/api/rtf/bieb/catalogus', kindZicht);

  // de ouder installeert; het staat in /mijn, en een tweede keer stapelt niet
  const inst = await als('/api/rtf/bieb/installeer', G.ouder, { id: volwassen.id });
  assert.equal(inst.status, 200, JSON.stringify(inst.body).slice(0, 160));
  assert.equal(inst.body.aantal, 1);
  assert.equal((await als('/api/rtf/bieb/installeer', G.ouder, { id: volwassen.id })).body.alGeinstalleerd, true, 'twee keer installeren is een keer');
  const mijn = await als('/api/rtf/bieb/mijn', G.ouder);
  assert.equal(mijn.body.apps.length, 1, 'precies een app in de eigen kast');
  assert.equal(mijn.body.apps[0].id, volwassen.id);

  // het kind krijgt datzelfde item niet: niet in de catalogus en niet te installeren
  const poging = await als('/api/rtf/bieb/installeer', G.kind, { id: volwassen.id });
  assert.equal(poging.status, 403, 'boven de groep van het kind: ' + JSON.stringify(poging.body).slice(0, 120));
  assert.equal((await als('/api/rtf/bieb/mijn', G.kind)).body.apps.length, 0, 'en er is niets bij het kind geland');
  // het kind installeert wel iets uit zijn eigen zicht
  const eigen = (await als('/api/rtf/bieb/catalogus', G.kind, { pagina: 1, per: 5 })).body.items[0];
  assert.equal((await als('/api/rtf/bieb/installeer', G.kind, { id: eigen.id })).status, 200);
  assert.equal((await als('/api/rtf/bieb/mijn', G.kind)).body.apps.length, 1);

  // de oppas kijkt mee maar vult de kast niet
  assert.equal((await als('/api/rtf/bieb/catalogus', G.gast, { pagina: 1 })).status, 200, 'meekijken mag');
  assert.equal((await als('/api/rtf/bieb/installeer', G.gast, { id: eigen.id })).status, 403, 'installeren niet');
  assert.equal((await als('/api/rtf/bieb/weg', G.gast, { id: volwassen.id })).status, 403, 'verwijderen ook niet');
  assert.equal((await als('/api/rtf/bieb/mijn', G.ouder)).body.apps.length, 1, 'en de kast van de ouder is ongemoeid');

  // verwijderen: eerst staat hij erin, daarna niet meer, en nog eens weghalen is 404
  const weg = await als('/api/rtf/bieb/weg', G.ouder, { id: volwassen.id });
  assert.equal(weg.status, 200);
  assert.equal(weg.body.aantal, 0);
  assert.equal((await als('/api/rtf/bieb/mijn', G.ouder)).body.apps.length, 0, 'de kast van de ouder is leeg');
  assert.equal((await als('/api/rtf/bieb/weg', G.ouder, { id: volwassen.id })).status, 404, 'wat er niet in staat valt er niet uit');
  assert.equal((await als('/api/rtf/bieb/installeer', G.ouder, { id: 'bestaat-niet' })).status, 404);
});

test('3. de Geloof & Wijsheid-Bibliotheek: alle tradities naast elkaar, dezelfde poorten', async () => {
  const o = await als('/api/rtf/geloof', G.ouder);
  assert.equal(o.status, 200);
  assert.ok(o.body.tradities.length >= 2, 'meer dan een traditie, als gelijken naast elkaar');
  assert.ok(o.body.themas.length >= 1 && o.body.totaal > 0);
  const kindZicht = await zichtVan('/api/rtf/geloof/catalogus', G.kind);
  const volwassen = await bovenHetKind('/api/rtf/geloof/catalogus', kindZicht);

  const inst = await als('/api/rtf/geloof/installeer', G.ouder, { id: volwassen.id });
  assert.equal(inst.status, 200, JSON.stringify(inst.body).slice(0, 160));
  assert.equal(inst.body.aantal, 1);
  assert.equal(inst.body.app.gratis, true);
  assert.equal((await als('/api/rtf/geloof/mijn', G.ouder)).body.boeken.length, 1, 'het boek staat in de kast van de ouder');

  assert.equal((await als('/api/rtf/geloof/installeer', G.kind, { id: volwassen.id })).status, 403, 'boven de groep van het kind');
  assert.equal((await als('/api/rtf/geloof/mijn', G.kind)).body.boeken.length, 0);
  assert.equal((await als('/api/rtf/geloof/installeer', G.gast, { id: volwassen.id })).status, 403, 'de oppas vult de kast niet');
  assert.equal((await als('/api/rtf/geloof/weg', G.gast, { id: volwassen.id })).status, 403);
  assert.equal((await als('/api/rtf/geloof/mijn', G.ouder)).body.boeken.length, 1, 'ongemoeid');

  const weg = await als('/api/rtf/geloof/weg', G.ouder, { id: volwassen.id });
  assert.equal(weg.status, 200);
  assert.equal((await als('/api/rtf/geloof/mijn', G.ouder)).body.boeken.length, 0);
  assert.equal((await als('/api/rtf/geloof/weg', G.ouder, { id: volwassen.id })).status, 404);
  assert.equal((await als('/api/rtf/geloof/installeer', G.ouder, { id: 'bestaat-niet' })).status, 404);
});

test('4. de Beroepen-Bibliotheek: twee werelden, zoeken op beroep, en de kast is van het gezin', async () => {
  const o = await als('/api/rtf/beroepen', G.ouder);
  assert.equal(o.status, 200);
  assert.deepEqual(o.body.werelden.map(w => w.id).sort(), ['techniek', 'zaken']);
  assert.equal((await als('/api/rtf/beroepen/catalogus', G.ouder, { wereld: 'kunst' })).status, 404, 'een wereld die niet bestaat');
  const las = await als('/api/rtf/beroepen/catalogus', G.ouder, { wereld: 'techniek', zoek: 'lasser', per: 10 });
  assert.equal(las.status, 200);
  assert.ok(las.body.items.length >= 1 && las.body.items.every(a => /lasser/i.test(a.naam)), 'zoeken op beroep geeft dat beroep');
  const onzin = await als('/api/rtf/beroepen/catalogus', G.ouder, { wereld: 'zaken', zoek: 'zzzqqq' });
  assert.equal(onzin.body.totaal, 0);
  assert.ok(onzin.body.hint, 'en zegt waarop je wel kunt zoeken');

  const app = las.body.items[0];
  // het kind mag hier wel installeren: de Beroepen-Bibliotheek kent geen leeftijdspoort, alleen de gastpoort
  const inst = await als('/api/rtf/beroepen/installeer', G.kind, { id: app.id });
  assert.equal(inst.status, 200, JSON.stringify(inst.body).slice(0, 160));
  assert.equal(inst.body.aantal, 1);
  assert.equal((await als('/api/rtf/beroepen/mijn', G.kind)).body.apps.length, 1);
  assert.equal((await als('/api/rtf/beroepen/mijn', G.kind)).body.apps[0].id, app.id);
  assert.equal((await als('/api/rtf/beroepen/installeer', G.gast, { id: app.id })).status, 403, 'de oppas niet');
  assert.equal((await als('/api/rtf/beroepen/weg', G.gast, { id: app.id })).status, 403);
  assert.equal((await als('/api/rtf/beroepen/mijn', G.kind)).body.apps.length, 1, 'ongemoeid');

  assert.equal((await als('/api/rtf/beroepen/weg', G.kind, { id: app.id })).status, 200);
  assert.equal((await als('/api/rtf/beroepen/mijn', G.kind)).body.apps.length, 0);
  assert.equal((await als('/api/rtf/beroepen/weg', G.kind, { id: app.id })).status, 404);
  assert.equal((await als('/api/rtf/beroepen/installeer', G.kind, { id: 'techniek-99999999' })).status, 404, 'buiten de wereld bestaat niets');
});
