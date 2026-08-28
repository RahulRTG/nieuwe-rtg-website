/* Ronde: het Mall-profiel -- hoe de pagina van een zaak is opgebouwd.

   Drie beweringen:

   1. DE BRANCHE BEPAALT DE ONDERDELEN, VIA DE CAPS. Een restaurant krijgt een
      kaart en reserveren, een kapper diensten en een agenda, een winkel een
      catalogus. Dat komt uit werkvormen.js en niet uit een tabel per genre --
      anders is dit de zoveelste genre-lijst die bij genre 32 vergeten wordt.
   2. DRIE ONDERDELEN HOREN BIJ ELKE ZAAK: waar u zit, hoe het eruitziet, en uw
      verhaal. Die hangen aan geen enkele cap.
   3. DIT ZEGT NIETS OVER ZICHTBAARHEID. Dat blijft aan de ondernemerspoort en
      de salonregel; twee antwoorden op die vraag is er een te veel.

   Draai los: node --test test/onderneming-mallprofiel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const maakOnderneming = require('../server/kern/onderneming');
const MP = require('../server/kern/onderneming/mallprofiel');
const MALL = require('../server/kern/mall');

function stubKern(zaken) {
  const lijst = zaken || [];
  const data = { ondernemingen: [], suppliers: lijst, posts: [],
    supplierTypes: {
      zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] },
      restaurant: { label: 'Restaurant', caps: ['menu', 'orders', 'reservations'] },
      retail: { label: 'Winkel', caps: ['retail'] },
      hotel: { label: 'Hotel', caps: ['bookings', 'doors'] }
    }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => lijst.find(z => z.code === code) || null,
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
}

function zaak(over) {
  return Object.assign({
    code: 'Z1', name: 'Zaak', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij doen dit al vijftien jaar in Haarlem.', foto: 'f.jpg' },
    photos: ['a.jpg'], services: [{ id: 's', name: 'Iets', price: 100, duurMin: 60 }]
  }, over || {});
}

function ondMet(K, z) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (z) K.ondernemingKoppel(o, z.code, MIJN_ZAAK);
  return o;
}

/* ---------------- de onderdelen volgen de caps ---------------- */

test('een restaurant krijgt een kaart en reserveren, een winkel een catalogus', () => {
  const eten = zaak({ code: 'ETEN', type: 'restaurant', staff: [{ id: 1 }, { id: 2 }],
    services: undefined, menu: [{ id: 'm', name: 'Dagschotel', price: 24 }] });
  const K1 = stubKern([eten]);
  const a = K1.ondernemingMallProfiel(ondMet(K1, eten)).onderdelen.map(o => o.id);
  assert.ok(a.includes('kaart') && a.includes('reserveren') && a.includes('bestellen'));
  assert.ok(!a.includes('catalogus'), 'een restaurant heeft geen collectie');

  const winkel = zaak({ code: 'WIN', type: 'retail', staff: [{ id: 1 }, { id: 2 }],
    services: undefined, collecties: [{ id: 'c', naam: 'Najaar' }] });
  const K2 = stubKern([winkel]);
  const b = K2.ondernemingMallProfiel(ondMet(K2, winkel)).onderdelen.map(o => o.id);
  assert.ok(b.includes('catalogus'));
  assert.ok(!b.includes('kaart'), 'een winkel heeft geen menukaart');
});

test('een dienstverlener krijgt diensten en een agenda', () => {
  const z = zaak();
  const K = stubKern([z]);
  const ids = K.ondernemingMallProfiel(ondMet(K, z)).onderdelen.map(o => o.id);
  assert.ok(ids.includes('diensten') && ids.includes('afspraak'));
  assert.ok(!ids.includes('kamers'));
});

test('een hotel krijgt kamers, en zet het er een busje bij dan komt het ritblok erbij', () => {
  const h = zaak({ code: 'HOT', type: 'hotel', staff: [{ id: 1 }, { id: 2 }],
    services: undefined, rooms: [{ id: 'k1' }] });
  const K = stubKern([h]);
  const o = ondMet(K, h);
  assert.ok(K.ondernemingMallProfiel(o).onderdelen.some(x => x.id === 'kamers'));
  assert.ok(!K.ondernemingMallProfiel(o).onderdelen.some(x => x.id === 'ritten'));

  h.fleet = [{ id: 'a', kenteken: 'XX-01-XX' }];
  assert.ok(K.ondernemingMallProfiel(o).onderdelen.some(x => x.id === 'ritten'),
    'de opbouw leest live mee: er is geen schakelaar en geen genre-tabel');
});

test('drie onderdelen horen bij elke zaak, ongeacht wat zij doet', () => {
  for (const t of ['zzp', 'restaurant', 'retail', 'hotel']) {
    const z = zaak({ code: 'X' + t, type: t, staff: [{ id: 1 }, { id: 2 }], services: undefined });
    const K = stubKern([z]);
    const ids = K.ondernemingMallProfiel(ondMet(K, z)).onderdelen.map(o => o.id);
    for (const vast of ['vindplaats', 'beeld', 'verhaal']) {
      assert.ok(ids.includes(vast), t + ' mist het vaste onderdeel ' + vast);
    }
  }
});

/* ---------------- gevuld of niet ---------------- */

test('elk onderdeel leest zijn eigen gegevens uit de zaak', () => {
  const z = zaak();
  const K = stubKern([z]);
  const o = ondMet(K, z);
  const vind = (id) => K.ondernemingMallProfiel(o).onderdelen.find(x => x.id === id);

  assert.equal(vind('diensten').gevuld, true, 'er staat een dienst in');
  assert.equal(vind('verhaal').gevuld, true, 'de bio is lang genoeg');
  assert.equal(vind('vindplaats').gevuld, true, 'de plaats staat er');

  z.services = [];
  assert.equal(vind('diensten').gevuld, false, 'weg is weg, zonder migratie');
  z.salon.bio = 'kort';
  assert.equal(vind('verhaal').gevuld, false, 'een bio van vier tekens is geen verhaal');
  z.city = ''; z.loc = null;
  assert.equal(vind('vindplaats').gevuld, false);
});

test('het percentage is een exacte telling, en open bevat precies de rest', () => {
  const z = zaak({ salon: { bio: 'kort' }, photos: [], city: '' });
  const K = stubKern([z]);
  const p = K.ondernemingMallProfiel(ondMet(K, z));
  assert.equal(p.gevuld + p.open.length, p.totaal);
  assert.equal(p.percentage, Math.round((p.gevuld / p.totaal) * 100));
  assert.ok(p.open.some(o => o.id === 'verhaal') && p.open.some(o => o.id === 'beeld'));
});

test('zonder zaak is er geen profiel, en geen leeg profiel', () => {
  const K = stubKern();
  assert.equal(K.ondernemingMallProfiel(ondMet(K)), null,
    'een leeg profiel leest als "een zaak zonder onderdelen" in plaats van "geen zaak"');
});

/* ---------------- de grenzen ---------------- */

test('het profiel zegt zelf dat het niets over zichtbaarheid zegt', () => {
  const dicht = zaak({ online: false });
  const K = stubKern([dicht]);
  const p = K.ondernemingMallProfiel(ondMet(K, dicht));
  assert.ok(p.voorbehoud.includes('ondernemerspoort'),
    'zichtbaarheid blijft aan de poort; twee antwoorden op die vraag is er een te veel');
  assert.ok(p.percentage > 0,
    'en een zaak die offline staat kan wel degelijk een ingevulde pagina hebben');
});

test('de paginakaart komt uit kern/mall en wordt niet overgetypt', () => {
  const eten = zaak({ code: 'ETEN', type: 'restaurant', staff: [{ id: 1 }, { id: 2 }],
    services: undefined, menu: [{ id: 'm', name: 'X', price: 1 }] });
  const K = stubKern([eten]);
  assert.equal(K.ondernemingMallProfiel(ondMet(K, eten)).pagina, MALL.MALL_GENRE_PAGINA.restaurant);

  const raar = zaak({ code: 'RAAR', type: 'ithulp', staff: [{ id: 1 }, { id: 2 }] });
  const K2 = stubKern([raar]);
  assert.equal(K2.ondernemingMallProfiel(ondMet(K2, raar)).pagina, '/apps/mall.html',
    'een genre zonder eigen pagina landt in de gids van de Mall zelf');
});

/* ---------------- het dagbeeld pakt het op ---------------- */

test('het dagbeeld noemt de Mall-pagina pas na de etalage-check', () => {
  const z = zaak({ online: false, salon: { bio: 'kort' }, photos: [] });
  const K = stubKern([z]);
  const d = K.ondernemingDagbeeld(ondMet(K, z));
  const iEerste = d.acties.findIndex(a => a.id === 'eersteklant');
  const iMall = d.acties.findIndex(a => a.id === 'mallprofiel');
  assert.ok(iEerste >= 0 && iMall >= 0, 'allebei staan er');
  assert.ok(iEerste < iMall, 'online staan gaat voor: een pagina die niemand ziet is geen pagina');
  assert.ok(d.mall, 'en het profiel hangt aan het dagbeeld');
});
