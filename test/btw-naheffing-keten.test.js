/* DE HELE KETEN VAN EEN NAHEFFING OVER ECHTE ROUTES, met echte ambtenaren.

   test/btw-naheffing.test.js toetst het gedrag op de laag zelf, met een
   verzetbare klok. Wat daar niet in zit is of de vier ogen ook over HTTP
   overeind blijven: daar hangen ze aan `wie(req)` -- de naam uit de
   personeelslogin op de persoonlijke pincode -- en dat is precies het soort
   koppeling dat je alleen ziet als je hem draait. Een unittoets die drie namen
   doorgeeft bewijst niets over een route die die namen uit een token haalt.

   DE HORDE, EN HOE HIJ IS GENOMEN. Naheffen kan alleen over een AFGESLOTEN
   tijdvak, en elke factuur die deze server boekt is van vandaag. Er is geen
   route die een factuur terugdateert, en die hoort er ook niet te komen: een
   backdate-knop in de facturatiemotor is precies het gereedschap waarmee je een
   btw-fraude pleegt. Dus gaat het hier zoals een beheerder het zou doen: de
   server draait, boekt een factuur, gaat UIT, de datum wordt in de opslag
   (db.json) gezet, en de server komt terug. De motor blijft ongemoeid.
   Draai: node --experimental-sqlite --test test/btw-naheffing-keten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const api = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

/* Het kwartaal VOOR het lopende: gegarandeerd voorbij, en de enige periode
   waarover naheffen mag. Zelfde rekensom als vorigeBtwPeriode() op de server;
   die staat hier los omdat een toets die zijn verwachting uit de code haalt
   twee keer dezelfde fout maakt. */
function vorigKwartaal() {
  const d = new Date();
  let jaar = d.getUTCFullYear(), kw = Math.floor(d.getUTCMonth() / 3) + 1;
  kw -= 1; if (kw === 0) { kw = 4; jaar -= 1; }
  return { periode: jaar + 'K' + kw, datum: jaar + '-' + String((kw - 1) * 3 + 2).padStart(2, '0') + '-15' };
}

test('de hele keten: opleggen, vier ogen, bezwaar en derde ogen -- over de echte routes', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nhketen-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_STORE: 'json' };
  const K = vorigKwartaal();
  let srv = await startServer({ env });
  let inspecteurs = [];
  try {
    // ---- 1. een factuur, en drie ambtenaren op het rijkskantoor ----
    const zaak = (await api(srv.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    assert.ok(zaak, 'de zaak is ingelogd');
    const f = await api(srv.base, '/api/supplier/facturen/maak',
      { omschrijving: 'Diner', aantal: 1, bedrag: 242, koperNaam: 'Gast' }, zaak);
    assert.equal(f.status, 200);
    const btwCenten = Math.round(f.body.factuur.btwBedrag * 100);
    assert.ok(btwCenten > 0);

    const roster = await api(srv.base, '/api/supplier/roster', { code: 'RIJK' });
    const chef = roster.body.staff.find(m => m.role === 'manager');
    const chefTok = (await api(srv.base, '/api/supplier/login', { code: 'RIJK', staffId: chef.id, pin: '1234' })).body.token;
    assert.ok(chefTok, 'de chef-inspecteur is ingelogd');
    for (const naam of ['Inspecteur Bakker', 'Inspecteur Yilmaz']) {
      const r = await api(srv.base, '/api/supplier/staff/add', { name: naam, role: 'manager' }, chefTok);
      assert.equal(r.status, 200, naam + ' toegevoegd');
      inspecteurs.push({ naam, id: r.body.staff.id, pin: r.body.pin });
    }

    // ---- 2. de factuur naar een afgesloten kwartaal, buiten de server om ----
    await wacht(1500);
    stop(srv.child);
    await wacht(2500);
    const pad = path.join(TMP, 'db.json');
    const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
    assert.equal(db.facturen.length, 1, 'de factuur staat in de opslag');
    db.facturen[0].datum = K.datum;
    db.facturen[0].at = K.datum + 'T10:00:00.000Z';
    fs.writeFileSync(pad, JSON.stringify(db));
    srv = await startServer({ env });

    const tok = {};
    tok.chef = (await api(srv.base, '/api/supplier/login', { code: 'RIJK', staffId: chef.id, pin: '1234' })).body.token;
    for (const i of inspecteurs) {
      tok[i.naam] = (await api(srv.base, '/api/supplier/login', { code: 'RIJK', staffId: i.id, pin: i.pin })).body.token;
      assert.ok(tok[i.naam], i.naam + ' kan inloggen');
    }
    const zaakTok = (await api(srv.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;

    // de aansluiting ziet nu een zaak die niets aangaf over een afgesloten kwartaal
    const aansl = await api(srv.base, '/api/overheid/bd/btw/aansluiting', { periode: K.periode }, tok.chef);
    assert.equal(aansl.status, 200);
    assert.equal(aansl.body.periodeLoopt, false, K.periode + ' is voorbij');
    const z = aansl.body.zaken.find(x => x.code === 'KIKUNOI');
    assert.ok(z, 'de zaak staat in de aansluiting');
    assert.equal(z.stand, 'niet_aangegeven');
    assert.equal(z.geteldBtwCenten, btwCenten, 'en het bedrag is dat van de factuur');

    // ---- 3. opmaken, met een boete die op naam en met een grond staat ----
    const zonderGrond = await api(srv.base, '/api/overheid/bd/naheffing/maak',
      { periode: K.periode, code: 'KIKUNOI', boetePct: 10 }, tok.chef);
    assert.equal(zonderGrond.status, 400, 'een boete zonder grond komt er ook over HTTP niet door');

    const maak = await api(srv.base, '/api/overheid/bd/naheffing/maak',
      { periode: K.periode, code: 'KIKUNOI', boetePct: 10, boeteGrond: 'niets aangegeven over dit tijdvak' }, tok.chef);
    assert.equal(maak.status, 200);
    const nh = maak.body.naheffing;
    assert.equal(nh.naheffingCenten, btwCenten, 'het bedrag komt uit de aansluiting');
    assert.equal(nh.boeteCenten, Math.round(btwCenten * 0.1));
    assert.equal(nh.status, 'concept');
    assert.equal(nh.opgemaaktDoor, chef.name, 'op naam van wie is ingelogd, niet uit het verzoek');

    // een concept is nog geen besluit: de zaak ziet hem niet
    const nogNiet = await api(srv.base, '/api/supplier/btw/naheffingen', {}, zaakTok);
    assert.deepEqual(nogNiet.body.naheffingen, [], 'een concept blijft binnen het kantoor');

    // ---- 4. DE VIER OGEN, over HTTP ----
    const zelf = await api(srv.base, '/api/overheid/bd/naheffing/stelvast', { id: nh.id }, tok.chef);
    assert.equal(zelf.status, 409, 'wie hem opmaakte stelt hem niet vast');
    assert.match(zelf.body.error, /ANDERE inspecteur/);

    /* EN DE AANVAL DIE ERBIJ HOORT. Vier ogen die aan een naam hangen, zijn
       precies zo veel waard als de vraag waar die naam vandaan komt. Deze
       inspecteur probeert zijn eigen naheffing af te tekenen door de naam van
       een collega mee te sturen -- in elk veld waarin een route hem zou kunnen
       zoeken. Komt hij daarmee door, dan zijn het twee ogen met een tweede naam
       ernaast en heeft de hele regel geen betekenis.

       Deze toets komt uit een mutatie die AFSLOEG: een `alsNaam`-veld in de
       route veranderde niets aan de uitslag zolang niemand het meestuurde. Een
       grendel die alleen dichtblijft omdat er niet aan wordt geduwd, is niet
       getoetst. */
    for (const veld of ['door', 'wie', 'naam', 'alsNaam', 'actor', 'vastgesteldDoor']) {
      const poging = await api(srv.base, '/api/overheid/bd/naheffing/stelvast',
        Object.assign({ id: nh.id }, { [veld]: 'Inspecteur Bakker' }), tok.chef);
      assert.equal(poging.status, 409, 'met "' + veld + '" in het lijf komt hij er ook niet door');
      assert.match(poging.body.error, /ANDERE inspecteur/);
    }
    // en de naheffing staat nog steeds op concept: er is niets stiekem getekend
    const tussen = await api(srv.base, '/api/overheid/bd/naheffingen', {}, tok.chef);
    assert.equal(tussen.body.naheffingen[0].status, 'concept');
    assert.equal(tussen.body.naheffingen[0].vastgesteldDoor, null);

    const vast = await api(srv.base, '/api/overheid/bd/naheffing/stelvast', { id: nh.id }, tok['Inspecteur Bakker']);
    assert.equal(vast.status, 200);
    assert.equal(vast.body.naheffing.status, 'vastgesteld');
    assert.equal(vast.body.naheffing.vastgesteldDoor, 'Inspecteur Bakker');
    assert.match(vast.body.let, /niets geind/, 'er is niets geind');

    // ---- 5. nu ziet de zaak hem, en maakt bezwaar ----
    const bijZaak = await api(srv.base, '/api/supplier/btw/naheffingen', {}, zaakTok);
    assert.equal(bijZaak.body.naheffingen.length, 1);
    assert.equal(bijZaak.body.naheffingen[0].kenmerk, nh.kenmerk);
    assert.equal(bijZaak.body.naheffingen[0].totaalCenten, nh.totaalCenten);

    const bez = await api(srv.base, '/api/supplier/btw/naheffing/bezwaar',
      { id: nh.id, reden: 'De omzet van dit kwartaal is al in het volgende tijdvak aangegeven.' }, zaakTok);
    assert.equal(bez.status, 200);
    assert.equal(bez.body.naheffing.status, 'bezwaar');

    // ---- 6. DE DERDE OGEN ----
    for (const [wie, t] of [['de opsteller', tok.chef], ['de vaststeller', tok['Inspecteur Bakker']]]) {
      const r = await api(srv.base, '/api/overheid/bd/naheffing/bezwaar/beslis',
        { id: nh.id, toewijzen: true, motivering: 'akkoord' }, t);
      assert.equal(r.status, 409, wie + ' beslist niet op zijn eigen besluit');
      assert.match(r.body.error, /geen heroverweging/);
    }
    const besluit = await api(srv.base, '/api/overheid/bd/naheffing/bezwaar/beslis',
      { id: nh.id, toewijzen: true, motivering: 'De aangifte over het volgende tijdvak dekt deze omzet.' },
      tok['Inspecteur Yilmaz']);
    assert.equal(besluit.status, 200);
    assert.equal(besluit.body.naheffing.status, 'vernietigd');
    assert.equal(besluit.body.naheffing.totaalCenten, 0, 'een toegewezen bezwaar laat niets staan');
    assert.equal(besluit.body.naheffing.bezwaar.door, 'Inspecteur Yilmaz');

    // en de zaak leest het besluit terug
    const na = await api(srv.base, '/api/supplier/btw/naheffingen', {}, zaakTok);
    assert.equal(na.body.naheffingen[0].status, 'vernietigd');
    assert.match(na.body.naheffingen[0].bezwaar.motivering, /volgende tijdvak/);
  } finally {
    if (srv && srv.child) stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
