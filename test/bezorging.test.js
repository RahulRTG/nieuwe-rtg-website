/* DE BEZORGING -- van assortiment tot voordeur, met GPS.

   WAAROM DIT ER IS

   De bezorgketen raakt vier mensen achter elkaar: de manager richt de dienst
   in, een lid bestelt en betaalt, een bezorger neemt de rit aan, en de klant
   volgt hem. Dat zijn vier rollen en drie overgangen, en juist daar gaat zoiets
   stuk. De losse stukken hadden toetsen; de keten niet.

   DE TWEE BEWERINGEN DIE ER ECHT TOE DOEN

   1. DE ROUTE IS EEN ROUTE. Drie leveringen op verschillende afstanden moeten
      in volgorde van nabijheid komen, niet in de volgorde waarin ze zijn
      ingevoerd. Een routeplanner die de invoervolgorde aanhoudt ziet er
      hetzelfde uit en is niets waard -- dat is precies het soort functie dat
      "werkt" tot iemand het natelt.
   2. DE ETA REAGEERT OP DE WERKELIJKHEID. Rijdt de bezorger dichterbij, dan
      moet de verwachte aankomst DALEN. Een ETA die niet meebeweegt is een
      getal dat vertrouwen wekt zonder het te verdienen.

   Allebei worden ze hier met echte coordinaten gemeten (haversine op de
   server), niet met een verzonnen afstand. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bezorg-'));

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Drie adressen ver uit elkaar op Ibiza. Ze dragen bewust GEEN naam als
   "dichtbij" of "ver": de eerste versie van deze toets deed dat wel, en die
   labels waren gebaseerd op MIJN aanname over waar de zaak stond. De route
   klopte en de toets zakte -- op mijn fixture, niet op de code.

   Nu rekent de toets het zelf na, met de echte positie van de zaak zoals de
   server hem geeft. Wie meet, gelooft geen labels. */
const ADRESSEN = [
  { naam: 'Sant Antoni', lat: 38.9800, lng: 1.3000 },
  { naam: 'Jesus', lat: 38.9300, lng: 1.4400 },
  { naam: 'De haven', lat: 38.9100, lng: 1.4300 }
];

/* Dezelfde formule als de server (server/kern -- haversine). Geen kopie van
   het ALGORITME: dit is schoolmeetkunde, en juist daarom kan hij dienen als
   onafhankelijke controle op wat de planner beweert. */
function meters(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

async function managerVan(P, code) {
  const r = await P('/api/supplier/roster', { code });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  assert.ok(man, code + ' heeft een manager');
  const lg = await P('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, 'de manager logt in');
  const zaak = ((lg.body.state || {}).supplier || {}).loc;
  assert.ok(zaak && Number.isFinite(zaak.lat), 'de zaak staat op de kaart: ' + JSON.stringify(zaak));
  return { token: lg.body.token, zaak };
}

test('de bezorging: de manager richt in, een lid bestelt, de bezorger krijgt een echte route', async () => {
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const P = post(base);
    const { token: manager, zaak } = await managerVan(P, 'KIKUNOI');

    /* ---- 1. DE DIENST KAN NIET AAN ZONDER ASSORTIMENT. Zonder deze
       tegenproef zegt "de dienst staat aan" niets. ---- */
    const teVroeg = await P('/api/supplier/bezorg/instellingen', { aan: true }, manager);
    assert.equal(teVroeg.status, 400, 'zonder producten gaat de dienst niet aan');

    /* ---- 2. ASSORTIMENT EN DIENST. ---- */
    for (const [naam, prijs] of [['Omakase-box', 48.5], ['Sashimi-schaal', 32], ['Miso-soep', 7.5]]) {
      const p = await P('/api/supplier/bezorg/product', { name: naam, price: prijs, desc: 'vers bereid' }, manager);
      assert.equal(p.status, 200, 'product "' + naam + '" staat in het assortiment: ' + JSON.stringify(p.body).slice(0, 140));
    }
    const aan = await P('/api/supplier/bezorg/instellingen', { aan: true, bezorgen: true, ophalen: true }, manager);
    assert.equal(aan.status, 200, 'de dienst gaat aan');
    assert.equal(aan.body.bezorg.aan, true, 'en staat ook echt aan');

    /* ---- 3. DE ZAAK IS NU VINDBAAR VOOR LEDEN. ---- */
    const u = String(Date.now()).slice(-8);
    const reg = await P('/api/auth/register', {
      name: 'Bestel Lid', email: 'bz' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
    });
    const lid = reg.body.token;
    const partners = await P('/api/bezorg/partners', {}, lid);
    assert.ok((partners.body.partners || []).some(p => p.code === 'KIKUNOI'),
      'KIKUNOI staat nu tussen de bezorgpartners: ' + JSON.stringify(partners.body).slice(0, 200));

    const kaart = partners.body.partners.find(p => p.code === 'KIKUNOI');
    const product = (kaart.producten || kaart.bezorg && kaart.bezorg.producten || [])[0];
    assert.ok(product, 'het assortiment staat erbij: ' + JSON.stringify(kaart).slice(0, 200));

    /* ---- 4. DRIE BESTELLINGEN, DE VERSTE EERST BESTELD. ---- */
    const refs = [];
    for (const a of ADRESSEN) {
      const bestel = await P('/api/bezorg/bestel', {
        supplierCode: 'KIKUNOI', levering: 'bezorgen',
        items: [{ id: product.id, qty: 1 }],
        adres: a.naam, lat: a.lat, lng: a.lng
      }, lid);
      assert.equal(bestel.status, 200, 'bestelling naar ' + a.naam + ': ' + JSON.stringify(bestel.body).slice(0, 180));
      const ref = bestel.body.ref || (bestel.body.order && bestel.body.order.ref);
      assert.ok(ref, 'de bestelling heeft een referentie: ' + JSON.stringify(bestel.body).slice(0, 180));
      refs.push(ref);

      const betaald = await P('/api/order/pay', { ref }, lid);
      assert.equal(betaald.status, 200, 'en is betaald: ' + JSON.stringify(betaald.body).slice(0, 160));
    }
    assert.equal(refs.length, 3, 'drie leveringen klaar');

    /* ---- 5. DE BEZORGER NEEMT ZE AAN. ---- */
    const neem = await P('/api/supplier/bezorg/neem', { refs }, manager);
    assert.equal(neem.status, 200, 'de bezorger neemt de rit aan: ' + JSON.stringify(neem.body).slice(0, 160));
    assert.equal((neem.body.genomen || []).length, 3, 'alle drie');

    /* ---- 6. DE ROUTE. Dit is de kern: dichtstbijzijnd eerst, en dus NIET de
       volgorde waarin ze zijn besteld. ---- */
    const route = await P('/api/supplier/bezorg/route', { refs, voertuig: 'scooter' }, manager);
    assert.equal(route.status, 200, 'er komt een route uit: ' + JSON.stringify(route.body).slice(0, 200));
    const stops = route.body.stops || [];
    assert.equal(stops.length, 3, 'met drie stops');

    const volgorde = stops.map(s => s.adres);
    assert.notDeepEqual(volgorde, ADRESSEN.map(a => a.naam),
      'de route houdt NIET de bestelvolgorde aan (dan zou hij geen planner zijn)');

    /* DE EIGENLIJKE BEWERING, nagerekend in plaats van geloofd: elke stop is
       de dichtstbijzijnde van wat er nog over is, gerekend vanaf de vorige
       plek -- te beginnen bij de zaak zelf. Dat is de definitie van de route
       die hier beloofd wordt, en hij is met plein meetkunde te controleren. */
    let hier = zaak;
    let over = ADRESSEN.slice();
    for (const stop of stops) {
      const dichtst = over.reduce((a, b) => (meters(hier, a) <= meters(hier, b) ? a : b));
      assert.equal(stop.adres, dichtst.naam,
        'vanaf ' + (hier.label || 'de vorige stop') + ' is "' + dichtst.naam + '" het dichtst bij, maar de route koos "' +
        stop.adres + '". Volledige route: ' + volgorde.join(' -> '));

      /* En de afstand die hij MELDT klopt ook met de werkelijkheid. Een route
         met de juiste volgorde maar verzonnen kilometers is nog steeds fout. */
      const echt = meters(hier, dichtst);
      assert.ok(Math.abs(stop.meters - echt) <= 2,
        'de gemelde afstand naar ' + stop.adres + ' (' + stop.meters + ' m) klopt met de gemeten ' + Math.round(echt) + ' m');
      assert.ok(stop.minuten >= 1, 'en er staat een rijtijd bij (' + stop.minuten + ' min)');
      assert.match(String(stop.nav), /^geo:-?\d+\.\d+,-?\d+\.\d+/, 'met een navigatielink die klopt: ' + stop.nav);

      hier = dichtst;
      over = over.filter(a => a.naam !== dichtst.naam);
    }
    assert.ok(route.body.totaal.meters > 0, 'en er staat een totaal onder de rit');

    /* ---- 6b. DE INPAKKETEN. Vertrekken kan pas als de INPAKKER (juiste bon,
       tas, alles afgevinkt) en de BEZORGER het allebei hebben bevestigd. Twee
       paar ogen op een tas eten, en het is geen vinkje voor de vorm: een
       verkeerd bonnummer of een vergeten gerecht hoort te stuiten. ---- */
    const eersteRef = refs[0];
    const verkeerdeBon = await P('/api/supplier/bezorg/inpak',
      { ref: eersteRef, bon: 'XX000', tas: 'Tas 1', items: [product.id] }, manager);
    assert.equal(verkeerdeBon.status, 400, 'een verkeerd bonnummer stuit');

    const nietAlles = await P('/api/supplier/bezorg/inpak',
      { ref: eersteRef, bon: eersteRef, tas: 'Tas 1', items: [] }, manager);
    assert.equal(nietAlles.status, 400, 'een niet-afgevinkt gerecht stuit ook');

    for (const ref of refs) {
      const inpak = await P('/api/supplier/bezorg/inpak',
        { ref, bon: ref, tas: 'Tas ' + ref.slice(-2), items: [product.id] }, manager);
      assert.equal(inpak.status, 200, 'ingepakt: ' + ref + ' -- ' + JSON.stringify(inpak.body).slice(0, 140));
    }
    const teVroegWeg = await P('/api/supplier/bezorg/status', { refs, status: 'onderweg' }, manager);
    assert.equal(teVroegWeg.status, 409, 'zonder de check van de bezorger vertrekt de rit niet');

    const pakcheck = await P('/api/supplier/bezorg/pakcheck', { refs }, manager);
    assert.equal(pakcheck.status, 200, 'de bezorger vinkt af dat alles gepakt is');

    /* ---- 7. DE ETA REAGEERT OP DE WERKELIJKHEID. Eerst vanaf de zaak, dan
       vanaf vlakbij het dichtstbijzijnde adres: de verwachting hoort te
       DALEN. Een ETA die niet meebeweegt is geen ETA. ---- */
    const vertrek = await P('/api/supplier/bezorg/status', { refs, status: 'onderweg' }, manager);
    assert.equal(vertrek.status, 200, 'nu vertrekt de rit wel: ' + JSON.stringify(vertrek.body).slice(0, 160));
    const ver = await P('/api/supplier/bezorg/gps', { lat: zaak.lat, lng: zaak.lng }, manager);
    assert.equal(ver.status, 200, 'de eerste positie komt binnen: ' + JSON.stringify(ver.body).slice(0, 200));
    const dichtbij = ADRESSEN[2];
    const dicht = await P('/api/supplier/bezorg/gps', { lat: dichtbij.lat + 0.001, lng: dichtbij.lng }, manager);
    assert.equal(dicht.status, 200, 'de tweede positie ook');

    const etaVan = (r, ref) => (r.body.eta || []).find(e => e.ref === ref);
    const refDichtbij = refs[2];
    const e1 = etaVan(ver, refDichtbij), e2 = etaVan(dicht, refDichtbij);
    assert.ok(e1 && e2, 'er is voor en na een ETA voor dezelfde levering: ' +
      JSON.stringify({ voor: ver.body.eta, na: dicht.body.eta }).slice(0, 240));
    assert.ok(e2.meters < e1.meters,
      'dichterbij rijden verkleint de afstand: ' + e1.meters + ' m -> ' + e2.meters + ' m');
    assert.ok(e2.etaMin <= e1.etaMin,
      'en de verwachte aankomst daalt mee: ' + e1.etaMin + ' min -> ' + e2.etaMin + ' min');
  } finally {
    child.kill('SIGKILL');
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
