/* Ronde: de bedrijfsontwerper en de Mall-bouwer -- de AI die meedenkt en
   nergens over beslist.

   Zes beweringen:

   1. HET MODEL SCHRIJFT NIETS WEG. De uitkomst is tekst; een AI die zijn eigen
      voorstel opslaat, maakt van een suggestie een feit.
   2. HET MODEL KRIJGT ALLEEN WAT ER ECHT STAAT, en wat ontbreekt heet ONBEKEND
      -- een leeg veld leest een model als "niet van toepassing" en vult het
      vrolijk zelf in.
   3. DE DRIE MERKREGELS STAAN IN DE PROMPT: geen toegang beloven, geen echte
      merken als partner, geen advies als zekerheid.
   4. ZONDER SLEUTEL KOMT ER GEEN LEEG SCHERM, maar een antwoord uit de eigen
      data, met `demo: true` erbij.
   5. DE POORT WORDT NIET NAGEBOUWD. kern/aipoort.js beslist wie er op mag.
   6. EEN KAPOT MODEL BREEKT HET SCHERM NIET: dan geldt dezelfde uitwijk.

   Draai los: node --test test/onderneming-ontwerper.test.js */
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
const ONT = require('../server/kern/onderneming/ontwerper');

/* De intake is GENEST (persoon/idee), precies zoals kern/onderneming/intake.js
   hem leest. Plat aanleveren wordt stil genegeerd -- en dan toetst deze ronde
   een prompt zonder feiten. */
const INTAKE = {
  persoon: { urenPerWeek: 32, ervaringJaren: 8, startkapitaal: 15000 },
  idee: { branche: 'zzp', plaats: 'Haarlem', verkoopmodel: 'abonnement',
    prijs: 120, kostprijs: 30, verwachtPerMaand: 60, vasteLasten: 1800,
    wat: 'Ramen wassen bij bedrijven', doelgroep: 'Kantoren in het centrum',
    onderscheid: 'Vaste ploeg, avondwerk, geen onderaannemers' }
};

function stubKern(opties) {
  const o = opties || {};
  const zaak = { code: 'ZAAK', name: 'Glasheldere Ramen', type: 'zzp', city: 'Haarlem',
    staff: [{ id: 1 }], online: true, salon: { bio: 'Wij wassen ramen.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'K', price: 100 }],
    boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {}, thuisHuizen: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services'] } } };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'ZAAK' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) },
    staffLijst: () => [],
    anthropic: o.anthropic || null,
    magAi: o.magAi || (() => true)
  });
  K._data = data;
  return K;
}

function ond(K, opties) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Glasheldere Ramen' }).onderneming.id);
  const i = (opties || {}).intake;
  if (i) {
    K.ondernemingIntakeZet(o, i);
    /* Nagerekend en niet aangenomen: een genegeerde intake laat elke toets
       hieronder over een prompt zonder feiten gaan. */
    const gezet = (i.idee && Object.keys(i.idee)[0]) || null;
    if (gezet) assert.ok(o.intake.idee[gezet] !== undefined, 'de intake is echt gezet');
  }
  if ((opties || {}).zaak) K.ondernemingKoppel(o, 'ZAAK', MIJN_ZAAK);
  return o;
}

/* Een model dat opschrijft wat het kreeg, zodat de prompt toetsbaar is. */
function vangModel(antwoord) {
  const gezien = {};
  return { gezien, messages: { create: async (p) => { Object.assign(gezien, p);
    return { content: [{ type: 'text', text: antwoord }] }; } } };
}

/* ---------------- er wordt niets weggeschreven ---------------- */

test('de AI schrijft niets weg, en er is geen functie die dat wel doet', async () => {
  const m = vangModel('Een voorstel.');
  const K = stubKern({ anthropic: m });
  const o = ond(K, { intake: INTAKE });
  const voor = JSON.stringify(K._data);
  const r = await K.ondernemingOntwerp({}, o, 'ontwerp', 'Denk mee over mijn idee.');
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(K._data), voor, 'niets opgeslagen');

  const bron = require('fs').readFileSync('server/kern/onderneming/ontwerper.js', 'utf8');
  assert.ok(!/\bsave\s*\(/.test(bron) && !/db\.data/.test(bron),
    'een AI die zijn eigen voorstel opslaat, maakt van een suggestie een feit');
  assert.ok(r.let.includes('geen besluit'));
});

/* ---------------- de prompt ---------------- */

test('de prompt draagt de eigen feiten en noemt wat ontbreekt ONBEKEND', async () => {
  const m = vangModel('Ja.');
  const K = stubKern({ anthropic: m });
  /* Met opzet een halve intake: doelgroep en onderscheid ontbreken. */
  const o = ond(K, { intake: { idee: { wat: 'Ramen wassen bij bedrijven', branche: 'zzp', plaats: 'Haarlem' } } });
  await K.ondernemingOntwerp({}, o, 'ontwerp', 'Denk mee.');

  const sys = m.gezien.system;
  assert.ok(sys.includes('Wat verkoopt hij: Ramen wassen bij bedrijven'));
  assert.ok(sys.includes('Voor wie: ONBEKEND'),
    'een leeg veld leest een model als "niet van toepassing" en vult het zelf in');
  assert.ok(sys.includes('Waarom bij hem: ONBEKEND'));
  assert.ok(sys.includes('vraag ernaar in plaats van invullen'));
});

test('de drie merkregels staan letterlijk in de prompt', async () => {
  const m = vangModel('Ja.');
  const K = stubKern({ anthropic: m });
  await K.ondernemingOntwerp({}, ond(K, { intake: INTAKE }), 'ontwerp', 'Hoi.');
  const sys = m.gezien.system;
  assert.equal(ONT.GRENZEN.length, 3);
  for (const g of ONT.GRENZEN) assert.ok(sys.includes(g), g.slice(0, 40));
  assert.ok(/Lifestyle Pass en Business Pass gaan uitsluitend na goedkeuring door een mens/.test(sys));
  assert.ok(/nooit dat een boeking of betaling is verwerkt/.test(sys));
});

test('onze eigen kansverkenning en stress test reizen mee', async () => {
  const m = vangModel('Ja.');
  const K = stubKern({ anthropic: m });
  /* Een plan dat onder de kostprijs verkoopt: de stress test hoort dat te
     blokkeren, en het model hoort dat te weten. */
  const laag = { persoon: INTAKE.persoon,
    idee: Object.assign({}, INTAKE.idee, { prijs: 10 }) };
  await K.ondernemingOntwerp({}, ond(K, { intake: laag }), 'ontwerp', 'Wat vind je?');
  assert.ok(m.gezien.system.includes('Blokkerende bevindingen uit onze stress test'));
  assert.ok(!m.gezien.system.includes(': geen\nBlokkerende'),
    'er staat een echte bevinding, niet "geen"');
});

test('de Mall-bouwer krijgt het mallprofiel en niet de intake-cijfers', async () => {
  const m = vangModel('Tekst voor de pagina.');
  const K = stubKern({ anthropic: m });
  await K.ondernemingOntwerp({}, ond(K, { intake: INTAKE, zaak: true }), 'mall', 'Schrijf mijn pagina.');
  const sys = m.gezien.system;
  assert.ok(sys.includes('Pagina ingevuld (procent)'));
  assert.ok(sys.includes('Naam van de zaak: Glasheldere Ramen'));
  assert.ok(!sys.includes('Kostprijs'), 'de kostprijs hoort niet in een Mall-tekst');
  assert.ok(sys.includes('nooit wervend'));
});

/* ---------------- zonder sleutel ---------------- */

test('zonder sleutel komt er een antwoord uit de eigen data, met demo erbij', async () => {
  const K = stubKern({ anthropic: null });
  const r = await K.ondernemingOntwerp({}, ond(K, { intake: { idee: { wat: 'Ramen wassen' } } }),
    'ontwerp', 'Denk mee.');
  assert.equal(r.ok, true);
  assert.equal(r.demo, true);
  assert.ok(r.antwoord.includes('geen AI-sleutel'),
    'een demostand die doet alsof er een model meekeek, is erger dan geen demostand');
  assert.ok(/Voor wie|Waarom bij hem|Branche/.test(r.antwoord), 'en hij noemt wat er echt ontbreekt');
  assert.deepEqual(r.grenzen, ONT.GRENZEN, 'de grenzen gelden ook in de uitwijk');
});

test('een kapot model breekt het scherm niet', async () => {
  const stuk = { messages: { create: async () => { throw new Error('geen netwerk'); } } };
  const K = stubKern({ anthropic: stuk });
  const r = await K.ondernemingOntwerp({}, ond(K, { intake: INTAKE }), 'ontwerp', 'Denk mee.');
  assert.equal(r.ok, true);
  assert.equal(r.demo, true, 'dezelfde uitwijk als zonder sleutel');
});

test('een leeg antwoord van het model telt als geen antwoord', async () => {
  const leeg = { messages: { create: async () => ({ content: [{ type: 'text', text: '   ' }] }) } };
  const K = stubKern({ anthropic: leeg });
  const r = await K.ondernemingOntwerp({}, ond(K, { intake: INTAKE }), 'ontwerp', 'Denk mee.');
  assert.equal(r.demo, true, 'liever de eerlijke uitwijk dan een lege bel');
});

/* ---------------- de poort ---------------- */

test('de bestaande AI-poort beslist wie er op mag, en wordt niet nagebouwd', async () => {
  const K = stubKern({ anthropic: vangModel('Ja.'), magAi: () => false });
  const r = await K.ondernemingOntwerp({}, ond(K, { intake: INTAKE }), 'ontwerp', 'Denk mee.');
  assert.equal(r.status, 403);

  const bron = require('fs').readFileSync('server/kern/onderneming/ontwerper.js', 'utf8');
  assert.ok(!/tier|guest|gast/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
    'geen eigen oordeel over wie er op mag: dat staat in kern/aipoort.js');
});

test('een onbekende opdracht en een lege vraag worden geweigerd', async () => {
  const K = stubKern({ anthropic: vangModel('Ja.') });
  const o = ond(K, { intake: INTAKE });
  const r = await K.ondernemingOntwerp({}, o, 'verzinsel', 'Hoi.');
  assert.equal(r.status, 400);
  assert.deepEqual(r.opdrachten, Object.keys(ONT.OPDRACHTEN));
  assert.equal((await K.ondernemingOntwerp({}, o, 'ontwerp', '   ')).status, 400);
});

test('de vraag wordt afgekapt en niet ongelimiteerd doorgegeven', async () => {
  const m = vangModel('Ja.');
  const K = stubKern({ anthropic: m });
  await K.ondernemingOntwerp({}, ond(K, { intake: INTAKE }), 'ontwerp', 'x'.repeat(5000));
  assert.ok(m.gezien.messages[0].content.length <= 500);
  assert.ok(m.gezien.max_tokens <= 700, 'en het antwoord is begrensd');
});
