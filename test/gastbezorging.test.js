/* HET GUEST OS BUITEN DE DEUR: bezorgen en afhalen.

   Dit is de TWEEDE naad op dezelfde motor, en dat is precies wat dit bestand
   bewaakt. Aan tafel bewijst de QR dat je er bent; thuis bestaat dat bewijs
   niet en is de ledensessie de poort. Alles daaronder -- de rekening, de
   idempotentie, de audit, het beleid -- hoort identiek te zijn, en als dat
   uiteen gaat lopen hoort een van deze toetsen te zakken.

   De drie beweringen die geld of een rit kosten als ze niet kloppen:

   1. DE VOLGORDE. Eerst de zone, dan het mandje, dan het tijdslot. Wie
      andersom werkt, reserveert keukenminuten voor een rit die nooit gaat
      rijden -- en die minuten knijpen dan een keuken dicht die leegstaat.
   2. DE BEZORGKOSTEN STAAN ALS REGEL OP DE REKENING. Niet als een veld
      ernaast, want dan telt de splitsing en de betaling ze niet mee. En ze
      worden opnieuw berekend NA het mandje, want gratis-vanaf hangt aan het
      bedrag.
   3. EEN LID HEEFT ER HOOGUIT EEN OPEN PER ZAAK EN PER KANAAL. Twee lopende
      bezorgbestellingen bij dezelfde zaak betekent dat de ene de andere
      betaalt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, ZAAK, LID;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gastbez-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  ZAAK = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(ZAAK, 'de zaak-inlog werkt');


  LID = await maakLid('Testlid', true);

  // de zaak zet zijn bezorging op: een zone op postcode en twee tijdsloten
  await post('/api/supplier/horeca/bezorg/zone', { open: true, zones: [
    { id: 'z1', naam: 'Centrum', postcodes: ['1011', '1012'], kosten: 3.5, minimum: 15, gratisVanaf: 40, minuten: 30 }
  ] }, ZAAK);
  await post('/api/supplier/horeca/bezorg/sloten', { sloten: { '18:00': 60, '18:30': 10, '19:00': 60 } }, ZAAK);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});


/* Een lid maken. `metAdres` loopt het echte gegevensgesprek af, want de
   gegevenspoort eist voor een BEZORGING telefoon en adres -- en dat is geen
   formaliteit: een bezorger voor een dichte deur zonder nummer is precies waar
   die poort voor bestaat. De toets hieronder ("bezorgen zonder adres") laat
   zien wat er gebeurt als je hem overslaat. */
async function maakLid(naam, metAdres) {
  const u = String(Date.now()) + Math.floor(Math.random() * 1000);
  const reg = await post('/api/auth/register', { name: naam, email: 'g' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const token = reg.body.token;
  assert.ok(token, 'een lid kan zich registreren: ' + JSON.stringify(reg.body).slice(0, 200));
  if (metAdres) {
    const start = await post('/api/gegevens/start', { soort: 'bezorging' }, token);
    if (start.body && start.body.id) {
      await post('/api/gegevens/zeg', { id: start.body.id, tekst: 'Damstraat 1, 1011AB Amsterdam' }, token);
    }
    const rest = await post('/api/gegevens/nodig', { soort: 'bezorging' }, token);
    assert.deepEqual(rest.body.ontbreekt, [],
      'na het gegevensgesprek hoort er niets meer te ontbreken voor een bezorging');
  }
  return token;
}

const kaartVan = async () => (await post('/api/gast/bezorg/kaart', { zaak: 'KIKUNOI' }, LID)).body.kaart;

test('de klant krijgt in een veilige, begrensde respons kaart en zaakprofiel tegelijk', async () => {
  const uit = await post('/api/gast/bezorg/kaart', { zaak: 'KIKUNOI' }, LID);
  assert.equal(uit.status, 200);
  assert.ok(Array.isArray(uit.body.kaart) && uit.body.kaart.length, 'de kaart zit in dezelfde respons');
  assert.ok(uit.body.zaak && Array.isArray(uit.body.zaak.categorieen), 'het klantprofiel bevat menucategorieen');
  assert.equal(uit.body.zaak.bezorging.minutenVanaf, 30);
  assert.equal(uit.body.zaak.bezorging.kostenVanafCenten, 350);
  assert.ok(uit.body.zaak.reviews.length <= 5, 'reviews blijven begrensd');
  assert.equal(uit.body.zaak.staff, undefined, 'interne zaakgegevens lekken niet naar de klant');
});

test('de zone antwoordt met een reden, en de zaak en de gast rekenen hetzelfde', async () => {
  const binnen = await post('/api/gast/bezorg/check', { zaak: 'KIKUNOI', postcode: '1011AB', bedragCenten: 2000 }, LID);
  assert.equal(binnen.status, 200);
  assert.equal(binnen.body.bezorgbaar, true);
  assert.equal(binnen.body.kostenCenten, 350);
  assert.equal(binnen.body.haaltMinimum, true);

  const buiten = await post('/api/gast/bezorg/check', { zaak: 'KIKUNOI', postcode: '9999ZZ', bedragCenten: 2000 }, LID);
  assert.equal(buiten.body.bezorgbaar, false);
  assert.match(buiten.body.reden, /9999ZZ|buiten onze bezorgzones/);

  /* Dezelfde vraag langs de LEVERANCIERSROUTE. Twee antwoorden hier zou
     betekenen dat de zaak een bestelling aanneemt die hij niet kan rijden. */
  const zaakKant = await post('/api/supplier/horeca/bezorg/check', { postcode: '1011AB', centen: 2000 }, ZAAK);
  assert.equal(zaakKant.body.kostenCenten, binnen.body.kostenCenten);
  assert.equal(zaakKant.body.minimumCenten, binnen.body.minimumCenten);
});

test('de checkout rekent opnieuw op de server en laat geen lege rekening achter', async () => {
  const lid = await maakLid('Controle', true);
  const kaart = await kaartVan();
  const item = kaart.filter(k => !k.alcohol && !k.uitverkocht).sort((a, b) => b.centen - a.centen)[0];
  const voor = await post('/api/gast/bezorg/mijn', {}, lid);
  const bestellingIdsVoor = voor.body.bestellingen.map(b => b.id);

  const uit = await post('/api/gast/bezorg/checkout', { zaak: 'KIKUNOI', kanaal: 'bezorging',
    postcode: '1011AB', adres: 'Damstraat 8', tijd: '18:00',
    items: [{ itemId: item.id, aantal: 2, centen: 1 }] }, lid);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 240));
  assert.equal(uit.body.regels[0].centen, item.centen,
    'een meegestuurde nepprijs wordt genegeerd; de kaart van de zaak is leidend');
  assert.equal(uit.body.subtotaalCenten, item.centen * 2);
  assert.equal(uit.body.totaalCenten, uit.body.subtotaalCenten + uit.body.bezorgkostenCenten);
  assert.equal(uit.body.betaling.onlineAfschrijving, false,
    'de checkout mag niet doen alsof er al online is betaald');
  assert.ok(uit.body.betaling.keuzes.some(x => x.id === 'ontvangst'),
    'betalen bij ontvangst blijft een expliciete keuze');
  assert.ok(uit.body.betaling.keuzes.some(x => x.provider === 'magnaat-test'),
    'alleen Magnaat toont de synthetische provider en nooit als echt geld');
  assert.ok(uit.body.geldschild && uit.body.geldschild.titel,
    'de klant krijgt een eigen Geldschild-oordeel, zonder dat het de keuze overneemt');

  const goedkoop = kaart.filter(k => !k.alcohol && !k.uitverkocht).sort((a, b) => a.centen - b.centen)[0];
  const onderMinimum = await post('/api/gast/bezorg/checkout', { zaak: 'KIKUNOI', kanaal: 'bezorging',
    postcode: '1011AB', adres: 'Damstraat 8', items: [{ itemId: goedkoop.id, aantal: 1 }] }, lid);
  assert.equal(onderMinimum.body.bevestigbaar, false);
  assert.equal(onderMinimum.body.blokkadeCode, 'minimum');

  const na = await post('/api/gast/bezorg/mijn', {}, lid);
  assert.deepEqual(na.body.bestellingen.map(b => b.id), bestellingIdsVoor,
    'controleren opent geen rekening en reserveert niets: de lijst blijft exact gelijk');
});

test('bezorgkosten staan als regel op de rekening en verdwijnen boven gratis-vanaf', async () => {
  const kaart = await kaartVan();
  const goedkoop = kaart.filter(k => !k.alcohol).sort((a, b) => a.centen - b.centen)[0];

  /* Twee stuks halen ook bij de goedkoopste kaartregel het ingestelde minimum.
     De server hoort een bestelling onder dat minimum nu vóór elke mutatie te
     stoppen; vroeger bleef hij staan met alleen een waarschuwing. */
  const b1 = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1011AB',
    adres: 'Damstraat 1', items: [{ itemId: goedkoop.id, aantal: 2 }] }, LID);
  assert.equal(b1.status, 200, JSON.stringify(b1.body).slice(0, 200));
  const kostenregel = b1.body.rekening.regels.find(r => /Bezorging/.test(r.naam));
  assert.ok(kostenregel, 'de bezorgkosten horen als regel op de rekening te staan');
  assert.equal(kostenregel.centen, 350);
  assert.equal(b1.body.rekening.totalen.teBetalen, goedkoop.centen * 2 + 350);

  // erbij bestellen tot boven de gratis-vanaf: de kostenregel hoort te verdwijnen
  const duur = kaart.filter(k => !k.alcohol).sort((a, b) => b.centen - a.centen)[0];
  const b2 = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1011AB',
    adres: 'Damstraat 1', items: [{ itemId: duur.id, aantal: 2 }] }, LID);
  assert.equal(b2.status, 200);
  const nog = b2.body.rekening.regels.find(r => /Bezorging/.test(r.naam));
  assert.ok(!nog || nog.centen === 0,
    'boven gratis-vanaf horen de bezorgkosten van de rekening af of op nul te staan');
  assert.equal(b2.body.bezorg.kostenCenten, 0);
});

test('een lid heeft hooguit een lopende bestelling per zaak en per kanaal', async () => {
  const mijn = await post('/api/gast/bezorg/mijn', {}, LID);
  const open = mijn.body.bestellingen.filter(x => x.kanaal === 'bezorging' && x.status === 'open');
  assert.equal(open.length, 1, 'twee keer bestellen hoort op EEN lopende rekening te komen');
  assert.ok(open[0].bezorg, 'het bezorgadres hangt aan de rekening');
});

test('een vol tijdslot noemt het eerstvolgende, en de bestelling gaat niet verloren', async () => {
  const kaart = await kaartVan();
  const item = kaart.find(k => !k.alcohol);
  // 18:30 heeft maar 10 keukenminuten; een tweede lid vult hem
  const lid2 = await maakLid('Tweede', true);
  await post('/api/supplier/horeca/bezorg/reserveer-slot', { tijd: '18:30', minuten: 10 }, ZAAK);

  const uit = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1012CD',
    adres: 'Kalverstraat 2', tijd: '18:30', items: [{ itemId: item.id, aantal: 1 }] }, lid2);
  assert.equal(uit.status, 409);
  assert.equal(uit.body.code, 'slot-vol');
  assert.equal(uit.body.eerstvolgende, '19:00', 'een vol slot hoort het eerstvolgende te noemen');
  assert.equal(uit.body.bestellingStaat, true,
    'de bestelling blijft staan; alleen de tijd ontbreekt nog');

  // en hij staat er echt, zonder tijd
  const rek = await post('/api/gast/bezorg/rekening', { zaak: 'KIKUNOI', kanaal: 'bezorging' }, lid2);
  assert.equal(rek.status, 200);
  assert.ok(rek.body.rekening.regels.length >= 1);
});

test('buiten de zone wordt er geen rekening geopend en geen slot bezet', async () => {
  const kaart = await kaartVan();
  const item = kaart.find(k => !k.alcohol);
  const lid3 = await maakLid('Verweg', true);

  const voor = (await post('/api/supplier/horeca/bezorg/sloten', {}, ZAAK)).body.sloten
    .reduce((t, s) => t + s.gebruiktMinuten, 0);
  const uit = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '9999ZZ',
    adres: 'Verweg 9', tijd: '19:00', items: [{ itemId: item.id, aantal: 1 }] }, lid3);
  assert.equal(uit.status, 409);
  assert.equal(uit.body.code, 'buiten-zone');

  const na = (await post('/api/supplier/horeca/bezorg/sloten', {}, ZAAK)).body.sloten
    .reduce((t, s) => t + s.gebruiktMinuten, 0);
  assert.equal(na, voor, 'een geweigerde bestelling mag geen keukenminuten vasthouden');
  const mijn = await post('/api/gast/bezorg/mijn', {}, lid3);
  assert.equal(mijn.body.bestellingen.length, 0, 'en er hoort geen lege rekening te blijven staan');
});

test('afhalen geeft een uitspreekbare code, en de zaak ziet dezelfde rekening', async () => {
  const kaart = await kaartVan();
  const item = kaart.find(k => !k.alcohol);
  const lid4 = await maakLid('Afhaler', true);

  const uit = await post('/api/gast/afhaal/bestel', { zaak: 'KIKUNOI', tijd: '19:00',
    items: [{ itemId: item.id, aantal: 1 }] }, lid4);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 200));
  assert.match(uit.body.afhaal.code, /^[A-HJ-NP-Z]\d{2}$/,
    'de afhaalcode is een letter en twee cijfers, zonder I en O');
  assert.ok(!uit.body.rekening.regels.some(r => /Bezorging/.test(r.naam)),
    'afhalen kent geen bezorgkosten');

  const lijst = await post('/api/supplier/horeca/rekeningen', { status: 'open', kanaal: 'afhaal' }, ZAAK);
  assert.ok(lijst.body.rekeningen.length >= 1, 'de zaak ziet de afhaalbestelling in zijn eigen lijst');
});

test('dubbel tikken bij bezorging levert een bestelling, net als aan tafel', async () => {
  const kaart = await kaartVan();
  const item = kaart.find(k => !k.alcohol);
  const lid5 = await maakLid('Dubbel', true);
  const zelfde = { zaak: 'KIKUNOI', postcode: '1011AB', adres: 'Damstraat 3',
    idem: 'bez-1', items: [{ itemId: item.id, aantal: 1 }] };

  const een = await post('/api/gast/bezorg/bestel', zelfde, lid5);
  const twee = await post('/api/gast/bezorg/bestel', zelfde, lid5);
  assert.equal(een.status, 200);
  assert.equal(twee.body.herhaald, true, 'dezelfde sleutel is dezelfde handeling');

  const rek = await post('/api/gast/bezorg/rekening', { zaak: 'KIKUNOI', kanaal: 'bezorging' }, lid5);
  const echte = rek.body.rekening.regels.filter(r => !/Bezorging/.test(r.naam));
  assert.equal(echte.length, 1, 'er hoort een besteld product te staan, niet twee');
});

test('bezorgen zonder adres wordt geweigerd, met wat er ontbreekt erbij', async () => {
  /* De gegevenspoort, en waarom hij hier bijt: bij een bezorging komt er
     iemand langs. Zonder adres en telefoonnummer is dat geen bestelling maar
     een belofte. De 428 zegt "dit mag, maar er moet eerst iets gebeuren" en
     noemt WAT -- de app opent daarop het gegevensgesprek en probeert het
     daarna gewoon opnieuw. */
  const kaart = await kaartVan();
  const item = kaart.find(k => !k.alcohol && !k.uitverkocht);
  const kaal = await maakLid('Zonder adres', false);

  const uit = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1011AB',
    adres: 'Damstraat 5', items: [{ itemId: item.id, aantal: 1 }] }, kaal);
  assert.equal(uit.status, 428, 'de gegevenspoort hoort te bijten voor een bezorging');
  assert.ok((uit.body.ontbreekt || []).some(x => (x.veld || x) === 'adres'),
    'en te zeggen dat het adres ontbreekt: ' + JSON.stringify(uit.body).slice(0, 160));

  // afhalen kan wel: daar hoeft niemand langs te komen
  const afhaal = await post('/api/gast/afhaal/bestel', { zaak: 'KIKUNOI',
    items: [{ itemId: item.id, aantal: 1 }] }, kaal);
  assert.equal(afhaal.status, 200,
    'afhalen vraagt geen adres; de tas ligt klaar op een code');
});

test('online bestellen blijft uit de keuken tot de betaalwaarheid definitief is', async () => {
  const lid = await maakLid('Online betaler', true);
  const kaart = await kaartVan();
  const item = kaart.filter(k => !k.alcohol && !k.uitverkocht).sort((a, b) => b.centen - a.centen)[0];
  const bestel = await post('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1011AB',
    adres: 'Damstraat 12', idem: 'online-order-1', betalingWijze: 'online',
    items: [{ itemId: item.id, aantal: 2 }] }, lid);
  assert.equal(bestel.status, 200, JSON.stringify(bestel.body).slice(0, 200));
  const rekeningId = bestel.body.rekening.rekeningId;
  const voor = await post('/api/supplier/horeca/keuken/bord', {}, ZAAK);
  assert.ok(!voor.body.bonnen.some(x => x.rekeningId === rekeningId),
    'zonder providerbevestiging mag geen bon in de keuken staan');

  const betaal = await post('/api/gast/bezorg/betaling/start', { zaak: 'KIKUNOI',
    rekeningId, idem: 'online-betaling-1', aanbieder: 'magnaat-test' }, lid);
  assert.equal(betaal.status, 200, JSON.stringify(betaal.body).slice(0, 220));
  assert.equal(betaal.body.betaling.status, 'BEVESTIGD');
  assert.equal(betaal.body.betaling.afgehandeld, true);
  assert.match(betaal.body.betaling.bewijs, /^[A-F0-9]{16}$/);

  const status = await post('/api/gast/bezorg/betaling/status',
    { betalingId: betaal.body.betaling.id }, lid);
  assert.equal(status.status, 200, JSON.stringify(status.body));
  assert.equal(status.body.betaling.id, betaal.body.betaling.id);
  assert.equal(status.body.betaling.status, 'BEVESTIGD',
    'de statusroute leest de duurzame betaalwaarheid en niet een clientcallback');
  const vreemd = await maakLid('Andere online betaler', true);
  const verboden = await post('/api/gast/bezorg/betaling/status',
    { betalingId: betaal.body.betaling.id }, vreemd);
  assert.equal(verboden.status, 404, 'een andere klant kan de bekende betaling niet opvragen');
  assert.equal((await post('/api/gast/bezorg/betaling/status',
    { betalingId: betaal.body.betaling.id })).status, 401, 'zonder sessie blijft de betaalstatus dicht');

  const na = await post('/api/supplier/horeca/keuken/bord', {}, ZAAK);
  assert.ok(na.body.bonnen.some(x => x.rekeningId === rekeningId),
    'na de definitieve terugmelding wordt exact dezelfde rekening vrijgegeven');
  const mijn = await post('/api/gast/bezorg/mijn', {}, lid);
  const b = mijn.body.bestellingen.find(x => x.rekeningId === rekeningId);
  assert.equal(b.status, 'betaald');
  assert.equal(b.openstaand, 0);
});

test('RTG Eten brengt zoeken, ontdekken, Concierge en partnersturing op echte routes samen', async () => {
  const ontdek = await post('/api/gast/eten/ontdekken', { filters:{ bezorgen:true } }, LID);
  assert.equal(ontdek.status, 200, JSON.stringify(ontdek.body).slice(0, 200));
  assert.ok(Array.isArray(ontdek.body.restaurants));
  const doel = ontdek.body.restaurants.find(x => x.code === 'KIKUNOI') || ontdek.body.restaurants[0];
  assert.ok(doel, 'ontdekken levert ten minste een bezorgende zaak');

  const zoeken = await post('/api/gast/eten/zoeken', { zoek:doel.naam }, LID);
  assert.equal(zoeken.status, 200);
  assert.ok(zoeken.body.restaurants.some(x => x.code === doel.code));

  const concierge = await post('/api/gast/eten/concierge', {
    vraag:'Japans voor twee, maximaal €80 en zonder noten'
  }, LID);
  assert.equal(concierge.status, 200);
  assert.equal(concierge.body.concierge.filters.personen, 2);
  assert.equal(concierge.body.concierge.filters.budgetCenten, 8000);

  const werkblad = await post('/api/supplier/eten/werkblad', { rol:'management' }, ZAAK);
  assert.equal(werkblad.status, 200);
  assert.ok(Array.isArray(werkblad.body.orders));

  const cap = await post('/api/supplier/eten/capaciteit', {
    wijzig:true, auto:false, open:true, extraMinuten:12, limietMinuten:40, kokken:2
  }, ZAAK);
  assert.equal(cap.status, 200);
  assert.equal(cap.body.capaciteit.extraMinuten, 12);

  const korting = await post('/api/supplier/eten/instellingen', {
    actie:'bewaar-korting', code:'THUIS10', procent:10, actief:true
  }, ZAAK);
  assert.equal(korting.status, 200);
  assert.ok(korting.body.kortingscodes.some(x => x.code === 'THUIS10'));
});

test('klant en partner doorlopen dezelfde RTG Eten-order tot hulp en beoordeling', async () => {
  const lid = await maakLid('Eten keten', true);
  const kaart = await kaartVan();
  const item = kaart.filter(x => !x.alcohol && !x.uitverkocht)
    .sort((a, b) => b.centen - a.centen)[0];
  const bestel = await post('/api/gast/bezorg/bestel', {
    zaak:'KIKUNOI', postcode:'1011AB', adres:'Damstraat 18', idem:'eten-keten-1',
    items:[{ itemId:item.id, aantal:2 }]
  }, lid);
  assert.equal(bestel.status, 200, JSON.stringify(bestel.body).slice(0, 220));
  const rekeningId = bestel.body.rekening.rekeningId;

  const probleem = await post('/api/gast/eten/probleem', {
    zaak:'KIKUNOI', rekeningId, tekst:'Controleer alstublieft de verpakking.'
  }, lid);
  assert.equal(probleem.status, 200, JSON.stringify(probleem.body).slice(0, 180));

  for (const status of ['geaccepteerd','in-bereiding','klaar','overgedragen','onderweg','geleverd']) {
    const stap = await post('/api/supplier/eten/status', { rekeningId, status }, ZAAK);
    assert.equal(stap.status, 200, status + ': ' + JSON.stringify(stap.body).slice(0, 180));
    assert.equal(stap.body.order.fase, status === 'geaccepteerd' ? 'bevestigd'
      : status === 'in-bereiding' ? 'keuken'
        : status === 'overgedragen' ? 'klaar'
          : status === 'geleverd' ? 'geleverd' : status);
  }

  const beoordeling = await post('/api/gast/eten/beoordeel', {
    zaak:'KIKUNOI', rekeningId, score:5, tekst:'Netjes en warm aangekomen.'
  }, lid);
  assert.equal(beoordeling.status, 200, JSON.stringify(beoordeling.body).slice(0, 180));
  assert.equal(beoordeling.body.review.score, 5);
});
