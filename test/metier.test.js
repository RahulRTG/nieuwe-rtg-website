/* Métier (kern/metier/*, routes/member/metier.js): de beroepsapp.

   Het zwaartepunt van deze toetsen ligt op het ontwerp dat Métier anders maakt
   dan een gewoon netwerk:
   - een profiel toont NOOIT een echte naam, alleen een codenaam;
   - RTG bevestigt alleen wat het echt zag (een rol uit de sleutelbos, waarvoor
     iemand een PIN heeft moeten geven) en een lid kan die bevestiging niet
     verzinnen of weghalen;
   - de echte naam is een sleutel die je per werkgever afgeeft, die je kunt
     intrekken, en waarvan je in je eigen log ziet wie hem bekeek.
   Draai los: node --experimental-sqlite --test test/metier.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-metier-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid(naam) {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: naam || ('Lid ' + t), email: 'm' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1988-04-04', tier: 'rtg' }));
  const ik = await json(await raw('/metier/ik', {}, r.token));
  return { token: r.token, codenaam: ik.profiel.codenaam, naam: naam || ('Lid ' + t) };
}
async function zaak() {
  const l = await json(await raw('/supplier/login', { username: 'rahul', password: 'Imran' }));
  return { token: l.token, code: l.state.supplier.code };
}

test('een profiel draagt een codenaam en nooit een echte naam', async () => {
  const a = await lid('Willemijn de Vries');
  const g = await json(await raw('/metier/kaart', { kop: 'Sommelier, tien jaar aan tafel', over: 'Wijn en gastvrijheid.', plaats: 'Ibiza' }, a.token));
  assert.ok(g.ok, g.error);
  const d = await json(await raw('/metier/ik', {}, a.token));
  assert.equal(d.profiel.kop, 'Sommelier, tien jaar aan tafel');
  const alles = JSON.stringify(d);
  assert.equal(/Willemijn|de Vries/.test(alles), false, 'de echte naam komt niet in het profiel voor');
  assert.ok(d.profiel.codenaam && d.profiel.codenaam.length > 1);
});

test('zelf opgegeven werk staat er eerlijk bij als onbevestigd', async () => {
  const a = await lid();
  const r = await json(await raw('/metier/rol', { wat: 'Chef de rang', waar: 'Een zaak buiten RTG', van: 2016, tot: 2020 }, a.token));
  assert.ok(r.ok, r.error);
  assert.equal(r.rol.bevestigd, false, 'wat wij niet zagen, heet niet bevestigd');
  const d = await json(await raw('/metier/ik', {}, a.token));
  assert.equal(d.profiel.rollen.length, 1);
  assert.equal(d.profiel.rollen[0].bevestigd, false);

  // en zonder wat/waar komt er niets in
  const leeg = await json(await raw('/metier/rol', { wat: '', waar: '' }, a.token));
  assert.ok(leeg.error);
});

test('een bevestigde rol komt uit de sleutelbos en is niet zelf te verzinnen', async () => {
  const a = await lid();
  // een lid kan een rol met bevestigd:true willen opgeven; dat mag nooit landen
  const poging = await json(await raw('/metier/rol', { wat: 'Directeur', waar: 'RTG zelf', bevestigd: true }, a.token));
  assert.ok(poging.ok, poging.error);
  assert.equal(poging.rol.bevestigd, false, 'bevestigd komt van RTG, niet uit het verzoek');
  const d = await json(await raw('/metier/ik', {}, a.token));
  assert.deepEqual(d.profiel.bewezen, [], 'wie niets koppelde, heeft geen bevestigde rollen');

  // en de zelf opgegeven rol mag wel weg
  const weg = await json(await raw('/metier/rol-weg', { id: poging.rol.id }, a.token));
  assert.ok(weg.ok, weg.error);
});

test('de naam is een sleutel: vrijgeven, bekijken, intrekken, en dan is er niets meer', async () => {
  const a = await lid('Bastiaan Koolhaas');
  const z = await zaak();

  // 1. zonder toestemming ziet de werkgever niets, en dat komt in het log
  const zonder = await raw('/supplier/metier/naam', { codenaam: a.codenaam }, z.token);
  assert.equal(zonder.status, 403, 'geen toestemming, geen naam');
  const log1 = await json(await raw('/metier/naam-log', {}, a.token));
  assert.equal(log1.inzage.length, 1, 'ook de geweigerde poging staat in mijn log');
  assert.equal(log1.inzage[0].gelukt, false);

  // 2. het lid geeft zijn naam vrij aan deze ene zaak
  const vrij = await json(await raw('/metier/naam-vrij', { code: z.code, waarvoor: 'Sollicitatie sommelier' }, a.token));
  assert.ok(vrij.ok, vrij.error);
  assert.equal(vrij.toestemming.actief, true);

  // 3. nu leest de werkgever de naam, live uit de kluis
  const met = await raw('/supplier/metier/naam', { codenaam: a.codenaam }, z.token);
  assert.equal(met.status, 200);
  const d = await met.json();
  assert.equal(d.naam, 'Bastiaan Koolhaas', 'de naam komt uit de kluis');
  assert.equal(d.codenaam, a.codenaam);

  // 4. het lid ziet dat er gekeken is
  const log2 = await json(await raw('/metier/naam-log', {}, a.token));
  assert.equal(log2.inzage.filter(l => l.gelukt).length, 1, 'de gelukte inzage staat erbij');

  // 5. intrekken werkt direct, en daarna is er niets te lezen: er lag nergens een kopie
  const intrek = await json(await raw('/metier/naam-intrekken', { code: z.code }, a.token));
  assert.ok(intrek.ok, intrek.error);
  const na = await raw('/supplier/metier/naam', { codenaam: a.codenaam }, z.token);
  assert.equal(na.status, 403, 'na intrekken is de naam weer weg');
});

test('een toestemming geldt voor een zaak, niet voor de wereld', async () => {
  const a = await lid('Ferdinand Aalders');
  const z = await zaak();
  await raw('/metier/naam-vrij', { code: z.code, waarvoor: 'test' }, a.token);
  // een onbekende zaak-code kan niet eens een toestemming krijgen
  const nep = await json(await raw('/metier/naam-vrij', { code: 'BESTAATNIET', waarvoor: 'x' }, a.token));
  assert.ok(nep.error, 'een zaak die we niet kennen krijgt geen toestemming');
  const d = await json(await raw('/metier/naam-log', {}, a.token));
  assert.equal(d.toestemmingen.filter(t => t.actief).length, 1, 'er staat er precies een actief');
});

test('een aanbeveling schrijf je zelf, en alleen over iemand met wie je verbonden bent', async () => {
  const a = await lid(), b = await lid();
  const zonder = await json(await raw('/metier/beveel-aan', { wie: a.codenaam, tekst: 'Een prima vakman, altijd op tijd en scherp.' }, b.token));
  assert.ok(zonder.error, 'zonder connectie geen aanbeveling');

  // verbinden en dan opnieuw
  const mijA = await json(await raw('/member/connections', {}, a.token));
  const mijB = await json(await raw('/member/connections', {}, b.token));
  await raw('/member/connect', { key: mijB.me }, a.token);
  await raw('/member/connect/respond', { key: mijA.me, action: 'accept' }, b.token);

  const kort = await json(await raw('/metier/beveel-aan', { wie: a.codenaam, tekst: 'goed' }, b.token));
  assert.ok(kort.error, 'een half woord is geen aanbeveling');

  const g = await json(await raw('/metier/beveel-aan', { wie: a.codenaam, tekst: 'Een prima vakman, altijd op tijd en scherp op detail.' }, b.token));
  assert.ok(g.ok, g.error);
  const d = await json(await raw('/metier/ik', {}, a.token));
  assert.equal(d.profiel.aanbevelingen.length, 1);
  assert.equal(d.profiel.aanbevelingen[0].van, b.codenaam, 'de schrijver staat er met zijn codenaam onder');

  // de ontvanger mag verbergen, maar de tekst blijft van de schrijver
  const vb = await json(await raw('/metier/aanbeveling-verberg', { id: d.profiel.aanbevelingen[0].id, aan: true }, a.token));
  assert.ok(vb.ok, vb.error);
  const weer = await json(await raw('/metier/aanbeveling-intrekken', { wie: a.codenaam, id: d.profiel.aanbevelingen[0].id }, b.token));
  assert.ok(weer.ok, 'de schrijver mag zijn woorden intrekken');
});

test('onderschrijven kan alleen op een vaardigheid die er al staat', async () => {
  const a = await lid(), b = await lid();
  await raw('/metier/lijst', { veld: 'vaardigheden', waarden: ['Wijnadvies', 'Gastvrijheid'] }, a.token);
  const mijA = await json(await raw('/member/connections', {}, a.token));
  const mijB = await json(await raw('/member/connections', {}, b.token));
  await raw('/member/connect', { key: mijB.me }, a.token);
  await raw('/member/connect/respond', { key: mijA.me, action: 'accept' }, b.token);

  const nep = await json(await raw('/metier/onderschrijf', { wie: a.codenaam, vaardigheid: 'Raketbouw', aan: true }, b.token));
  assert.ok(nep.error, 'je kunt er niets bij verzinnen');

  const g = await json(await raw('/metier/onderschrijf', { wie: a.codenaam, vaardigheid: 'Wijnadvies', aan: true }, b.token));
  assert.ok(g.ok, g.error);
  assert.equal(g.aantal, 1);
  // twee keer dezelfde persoon telt een keer
  const nog = await json(await raw('/metier/onderschrijf', { wie: a.codenaam, vaardigheid: 'Wijnadvies', aan: true }, b.token));
  assert.equal(nog.aantal, 1, 'een persoon, een stem');
  // en op je eigen vaardigheden zegt het niets
  const zelf = await json(await raw('/metier/onderschrijf', { wie: a.codenaam, vaardigheid: 'Wijnadvies', aan: true }, a.token));
  assert.ok(zelf.error);
});

test('het beroepsregister vindt op vak en toont geen lege profielen', async () => {
  const a = await lid(), b = await lid();
  await raw('/metier/kaart', { kop: 'Zeilinstructeur', plaats: 'Formentera', open: true }, a.token);
  await raw('/metier/lijst', { veld: 'vaardigheden', waarden: ['Navigatie'] }, a.token);
  // b vult niets in

  const d = await json(await raw('/metier/zoek', { zoek: 'zeil' }, b.token));
  assert.ok(d.ok, d.error);
  assert.ok(d.leden.some(m => m.codenaam === a.codenaam), 'a is te vinden op zijn vak');
  assert.equal(d.leden.some(m => m.codenaam === b.codenaam), false, 'een leeg profiel staat niet in de etalage');

  const open = await json(await raw('/metier/zoek', { open: true }, b.token));
  assert.ok(open.leden.every(m => m.open), 'alleen wie openstaat voor werk');

  // het profiel van een ander is te bekijken, en toont geen sleutel
  const p = await json(await raw('/metier/lid', { wie: a.codenaam }, b.token));
  assert.ok(p.ok, p.error);
  assert.equal(p.profiel.ikZelf, false);
  assert.equal(/user-\d+/.test(JSON.stringify(p)), false, 'er komt geen sessiesleutel mee naar de client');
});

test('Rahul coacht maar vult niets in, en zonder AI een eerlijke 503', async () => {
  const a = await lid();
  await raw('/metier/kaart', { kop: 'Restaurantmanager', over: 'Twaalf jaar vloer.' }, a.token);
  const voor = await json(await raw('/metier/ik', {}, a.token));

  const r = await raw('/metier/ai/profiel', {}, a.token);
  const d = await r.json();
  if (process.env.ANTHROPIC_API_KEY) { assert.equal(r.status, 200); assert.ok(d.kritiek); }
  else { assert.equal(r.status, 503); assert.ok(d.reden, 'een eerlijke reden, geen verzonnen advies'); }

  const na = await json(await raw('/metier/ik', {}, a.token));
  assert.equal(na.profiel.kop, voor.profiel.kop, 'de coach heeft niets aan je profiel veranderd');
  assert.equal(na.profiel.rollen.length, voor.profiel.rollen.length);

  /* Zonder vacature geen brief, en zonder rol geen oefengesprek -- maar dat is
     een 400 en geen 503.

     Hier stond 503, en die stond er omdat de route ELKE niet-ok van de AI-laag
     als 503 doorgaf. Dat is de verkeerde code voor "je vergat iets in te vullen":
     503 betekent "de dienst is even weg", dus een load balancer probeert het
     opnieuw, en de foutbudget-teller van SLO.md telt het als storing. Gevonden
     met de grens-sweep; de statuscodes komen nu uit de AI-laag zelf (status 503
     alleen als de assistent echt onbereikbaar is, 403 als het niet van jou is,
     anders 400). */
  const leeg = await raw('/metier/ai/brief', { vacature: '' }, a.token);
  assert.equal(leeg.status, 400, 'niets ingevuld is een invoerfout, geen storing');
  const zonderRol = await raw('/metier/ai/oefen', {}, a.token);
  assert.equal(zonderRol.status, 400);
});

test('zonder aanmelding geen beroepsprofiel', async () => {
  const uitgelogd = await raw('/metier/ik', {});
  assert.equal(uitgelogd.status, 401);
  const zoek = await raw('/metier/zoek', {});
  assert.equal(zoek.status, 401);
  const vrij = await raw('/metier/naam-vrij', { code: 'KIKUNOI' });
  assert.equal(vrij.status, 401);
});

/* ---- de loonspiegel ----
   De module rekenen we los na, met een verzonnen zaakregister: alleen zo is de
   drempel van vijf zaken echt te toetsen (het demo-register heeft er per vak
   minder). De route erna bewijst dat hij op de gewone leden-auth zit. */
const maakLoon = (zaken) => require('../server/kern/metier/loon')({ db: { data: { suppliers: zaken } } });

test('loonspiegel: onder de drempel geen cijfer, erboven een middenband zonder namen', () => {
  const zaak = (code, type, uurloon) => ({ code, name: 'Zaak ' + code, type, country: 'NL', settings: { uurloon } });

  // vier zaken: te weinig, dus geen getal
  const weinig = maakLoon([1, 2, 3, 4].map(i => zaak('A' + i, 'restaurant', 15 + i)));
  const r4 = weinig.vak('restaurant', 'NL');
  assert.equal(r4.genoeg, false, 'vier zaken is te weinig voor een cijfer');
  assert.equal(r4.uur, undefined, 'en dan staat er ook geen band');
  assert.ok(r4.wet && r4.wet.minimum > 0, 'het wettelijk minimum staat er wel, dat hangt van geen zaak af');

  // zes zaken: wel een band, maar nooit de uiteinden
  const genoeg = maakLoon([12, 14, 16, 18, 20, 40].map((u, i) => zaak('B' + i, 'restaurant', u)));
  const r6 = genoeg.vak('restaurant', 'NL');
  assert.equal(r6.genoeg, true);
  assert.equal(r6.zaken, 6);
  assert.ok(r6.uur.laag > 12 && r6.uur.hoog < 40, 'de laagste en hoogste zaak zijn niet af te lezen: ' + JSON.stringify(r6.uur));
  assert.ok(r6.maand.midden > 0);
  const tekst = JSON.stringify(r6);
  assert.equal(/Zaak B|"code"|"name"/.test(tekst), false, 'geen zaaknaam en geen code bij de cijfers');

  // en het land filtert: dezelfde zaken in een ander land halen de drempel niet
  assert.equal(genoeg.vak('restaurant', 'BE').genoeg, false);
});

test('loonspiegel: een bod tegen de wet, ook als de markt nog leeg is', () => {
  const leeg = maakLoon([]);
  const onder = leeg.toets('restaurant', 'NL', 9);
  assert.ok(onder.ok);
  assert.ok(onder.punten.some(p => /onder het wettelijk minimum/i.test(p)), 'een te laag bod wordt benoemd: ' + JSON.stringify(onder.punten));
  assert.ok(onder.perMaand > 0, 'het maandbedrag staat er ook zonder markt');

  const boven = leeg.toets('restaurant', 'NL', 22);
  assert.ok(boven.punten.some(p => /Boven het wettelijk minimum/.test(p)));
  assert.ok(boven.punten.some(p => /te weinig zaken/.test(p)), 'en het is eerlijk over wat het niet weet');

  assert.ok(leeg.toets('restaurant', 'NL', 0).error, 'zonder bedrag geen oordeel');
});

test('de loonspiegel is voor elk lid, niet voor de uitgelogde', async () => {
  const a = await lid();
  const d = await json(await raw('/metier/loon', { land: 'NL' }, a.token));
  assert.equal(d.ok, true);
  assert.equal(d.drempel, 5);
  assert.ok(d.wet && d.wet.minimum > 0, 'het wettelijk minimum komt mee');
  assert.ok(Array.isArray(d.alleVakken) && d.alleVakken.length > 5, 'alle vakken zijn kiesbaar voor de toets');
  assert.ok(Array.isArray(d.vakken), 'en de vakken met genoeg zaken staan apart');

  const t = await json(await raw('/metier/loon-toets', { vak: 'restaurant', land: 'NL', uurloon: 11 }, a.token));
  assert.ok(t.ok && t.punten.length, 'de toets geeft een oordeel terug');

  const uitgelogd = await raw('/metier/loon', { land: 'NL' });
  assert.equal(uitgelogd.status, 401);
});
