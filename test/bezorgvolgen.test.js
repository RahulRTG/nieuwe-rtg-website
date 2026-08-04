/* HET VOLGSCHERM VAN DE KLANT -- waar is mijn bestelling, en hoe lang nog?

   WAAROM DIT ER IS

   Tussen "betaald" en "onderweg" zit de keuken, en dat is precies de tijd
   waarin iemand zich afvraagt of zijn bestelling wel is aangekomen. In die
   stilte zat geen stap, geen tijd en geen woord: het volgscherm gaf pas iets
   zodra de bezorger reed.

   WAT HIER WORDT VASTGELEGD

   1. VIER STAPPEN, en op elk moment precies EEN die bezig is. De stappen
      volgen de echte staat van de bon (betaald, keuken bezig, op de pas,
      onderweg, bezorgd) en niet een apart veld dat naast de werkelijkheid kan
      gaan lopen.
   2. MEERDERE BESTELLINGEN TEGELIJK staan elk in hun EIGEN fase. Dat is de
      valkuil van zo'n scherm: een gedeelde variabele en alle drie de kaarten
      tonen dezelfde stap.
   3. DE VERWACHTING IS GEMETEN OF ZE IS ER NIET. Zonder historie geeft het
      scherm geen getal en zegt het waarom -- liever geen verwachting dan een
      verzonnen. Met historie komt de keukentijd uit de eigen bonnen van de
      zaak, en zodra de bezorger rijdt uit zijn echte afstand.
   4. DE LIVE POSITIE komt alleen als hij ook echt onderweg is. Een kaartje met
      een stilstaande stip die "live" heet, is erger dan geen kaartje. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const bezorgvolg = require('../server/kern/bezorgvolg');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-volg-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const ADRESSEN = [
  { naam: 'Sant Antoni', lat: 38.9800, lng: 1.3000 },
  { naam: 'Jesus', lat: 38.9300, lng: 1.4400 },
  { naam: 'De haven', lat: 38.9100, lng: 1.4300 }
];

async function zaakKlaar(P) {
  const r = await P('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  const lg = await P('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
  const token = lg.body.token;
  const prod = await P('/api/supplier/bezorg/product', { name: 'Omakase-box', price: 48.5 }, token);
  assert.equal(prod.status, 200, 'assortiment gevuld');
  await P('/api/supplier/bezorg/instellingen', { aan: true, bezorgen: true }, token);
  return { token, zaak: ((lg.body.state || {}).supplier || {}).loc, productId: prod.body.producten[0].id };
}

async function nieuwLid(P, naam) {
  const u = String(Date.now()).slice(-7) + Math.floor(Math.random() * 900 + 100);
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld');
  return r.body.token;
}

test('het volgscherm: drie bestellingen tegelijk, elk in zijn eigen fase', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: zaakToken, productId } = await zaakKlaar(P);
    const lid = await nieuwLid(P, 'Volglid');

    // drie bestellingen op drie adressen
    const refs = [];
    for (const a of ADRESSEN) {
      const b = await P('/api/bezorg/bestel', {
        supplierCode: 'KIKUNOI', levering: 'bezorgen',
        items: [{ id: productId, qty: 1 }], adres: a.naam, lat: a.lat, lng: a.lng
      }, lid);
      assert.equal(b.status, 200, 'bestelling naar ' + a.naam);
      refs.push(b.body.ref || b.body.order.ref);
    }

    /* ---- 1. VOOR DE BETALING staat de eerste stap nog niet eens aan. ---- */
    const onbetaald = await P('/api/bezorg/volg', { ref: refs[0] }, lid);
    assert.equal(onbetaald.status, 200, 'het volgscherm opent');
    assert.equal(onbetaald.body.stappen[0].staat, 'bezig', 'stap 1 is bezig: de betaling');
    assert.match(onbetaald.body.wat, /betaling/i, 'en het zegt waar het op wacht: ' + onbetaald.body.wat);

    for (const ref of refs) {
      const p = await P('/api/order/pay', { ref }, lid);
      assert.equal(p.status, 200, 'betaald: ' + ref);
    }

    /* ---- 2. DRIE BESTELLINGEN, DRIE VERSCHILLENDE FASEN. We zetten ze
       bewust uit elkaar: de eerste blijft in de keuken, de tweede gaat op de
       pas, de derde rijdt. ---- */
    await P('/api/supplier/bezorg/neem', { refs }, zaakToken);

    /* #2 is klaar in de keuken en ingepakt -- bij een BEZORGING is het
       inpakmoment het signaal dat de keuken klaar is; die bonnen lopen niet
       langs de keukenlijn van de menukaart. */
    const inpak2 = await P('/api/supplier/bezorg/inpak',
      { ref: refs[1], bon: refs[1], tas: 'Tas 2', items: [productId] }, zaakToken);
    assert.equal(inpak2.status, 200, 'de tweede is ingepakt: ' + JSON.stringify(inpak2.body).slice(0, 140));

    // #3 helemaal tot onderweg
    await P('/api/supplier/bezorg/inpak',
      { ref: refs[2], bon: refs[2], tas: 'Tas 3', items: [productId] }, zaakToken);
    await P('/api/supplier/bezorg/pakcheck', { refs: [refs[2]] }, zaakToken);
    const weg = await P('/api/supplier/bezorg/status', { refs: [refs[2]], status: 'onderweg' }, zaakToken);
    assert.equal(weg.status, 200, 'de derde vertrekt: ' + JSON.stringify(weg.body).slice(0, 140));

    const beelden = [];
    for (const ref of refs) beelden.push((await P('/api/bezorg/volg', { ref }, lid)).body);

    /* Elk beeld heeft precies EEN stap die bezig is -- dat is de bewering die
       zakt als iemand er een gedeelde variabele van maakt. */
    for (const [i, b] of beelden.entries()) {
      const bezig = b.stappen.filter(s => s.staat === 'bezig');
      assert.equal(bezig.length, 1, 'bestelling ' + (i + 1) + ' heeft precies een lopende stap: ' +
        JSON.stringify(b.stappen.map(s => s.naam + '=' + s.staat)));
    }

    const fasen = beelden.map(b => b.stappen.findIndex(s => s.staat === 'bezig'));
    assert.equal(fasen[0], 1, 'de eerste zit in de keuken');
    assert.equal(fasen[1], 2, 'de tweede staat klaar en wacht op vertrek');
    assert.equal(fasen[2], 2, 'de derde is onderweg');
    assert.match(beelden[2].wat, /onderweg/i, 'en dat staat er ook: ' + beelden[2].wat);
    assert.notEqual(beelden[0].wat, beelden[2].wat,
      'de drie kaarten vertellen niet allemaal hetzelfde verhaal');

    /* ---- 3. DE LIVE POSITIE komt alleen bij wie echt rijdt. ---- */
    assert.equal(beelden[0].positie, null, 'de bestelling in de keuken heeft geen bezorgerpositie');
    const rit = await P('/api/supplier/bezorg/gps', { lat: 38.9150, lng: 1.4350 }, zaakToken);
    assert.equal(rit.status, 200, 'de bezorger geeft zijn positie door');

    const onderweg = (await P('/api/bezorg/volg', { ref: refs[2] }, lid)).body;
    assert.ok(onderweg.positie && Number.isFinite(onderweg.positie.lat),
      'nu staat hij live op de kaart: ' + JSON.stringify(onderweg.positie));
    assert.equal(onderweg.etaBron, 'rit', 'en de verwachting komt uit zijn echte afstand');
    assert.ok(onderweg.etaMin >= 1, 'met een aankomsttijd in minuten (' + onderweg.etaMin + ')');

    /* ---- 4. DICHTERBIJ RIJDEN VERKORT DE VERWACHTING. ---- */
    await P('/api/supplier/bezorg/gps', { lat: ADRESSEN[2].lat + 0.0005, lng: ADRESSEN[2].lng }, zaakToken);
    const bijna = (await P('/api/bezorg/volg', { ref: refs[2] }, lid)).body;
    assert.ok(bijna.etaMin <= onderweg.etaMin,
      'de verwachting daalt als hij nadert: ' + onderweg.etaMin + ' -> ' + bijna.etaMin + ' min');

    /* ---- 5. BEZORGD: alle stappen gedaan, geen tijd meer, geen kaartje. ---- */
    await P('/api/supplier/bezorg/status', { refs: [refs[2]], status: 'bezorgd' }, zaakToken);
    const klaar = (await P('/api/bezorg/volg', { ref: refs[2] }, lid)).body;
    assert.equal(klaar.stappen[3].staat, 'bezig', 'de laatste stap is bereikt');
    assert.equal(klaar.etaMin, null, 'er staat geen tijd meer bij een bezorgde bestelling');
    assert.equal(klaar.positie, null, 'en geen live kaartje meer');
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de verwachte tijd is gemeten of ze is er niet', () => {
  /* Deze twee gaan over de rekenkern zelf, zonder server: de vraag is of hij
     zwijgt als hij het niet weet. Een scherm dat "ongeveer 30 minuten" zegt
     omdat dat een redelijk getal lijkt, is precies wat hier niet mag. */
  const nu = Date.now();
  const bon = (min) => ({
    supplierCode: 'KIKUNOI',
    paidAt: new Date(nu - min * 60000 - 60000).toISOString(),
    pasAt: new Date(nu - 60000).toISOString()
  });

  assert.equal(bezorgvolg.keukenMinuten([], 'KIKUNOI'), null, 'zonder historie: geen getal');
  assert.equal(bezorgvolg.keukenMinuten([bon(20), bon(22)], 'KIKUNOI'), null,
    'met twee bonnen nog steeds niet: dat is een toevalstreffer en geen meting');

  const drie = bezorgvolg.keukenMinuten([bon(18), bon(20), bon(22)], 'KIKUNOI');
  assert.equal(drie, 20, 'met drie bonnen de mediaan (kreeg ' + drie + ')');

  /* De mediaan en niet het gemiddelde: een vergeten bon die uren op de pas
     bleef liggen mag de verwachting van alle anderen niet verzieken. */
  const metUitschieter = bezorgvolg.keukenMinuten([bon(18), bon(20), bon(22), bon(200)], 'KIKUNOI');
  assert.ok(metUitschieter <= 25,
    'een uitschieter van 200 minuten trekt de verwachting niet omhoog (kreeg ' + metUitschieter + ')');

  // en bonnen van een andere zaak tellen niet mee
  const anders = bezorgvolg.keukenMinuten(
    [bon(18), bon(20), bon(22)].map(b => Object.assign({}, b, { supplierCode: 'ESVEDRA' })), 'KIKUNOI');
  assert.equal(anders, null, 'de keukentijd van een andere zaak telt niet mee');
});
