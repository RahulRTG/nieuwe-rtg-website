/* ============================================================================
   COMMERCIELE COMMUNICATIE -- toestemming, en niet een voorkeur.

   DE BEWERING DIE ERTOE DOET staat in toets 1: alles staat standaard UIT.
   Dit huis had al meldingsvoorkeuren (kern/ervaring.js, MELDING_SCOPES) die
   standaard AAN staan -- dat zijn serviceberichten, en ze uitzetten is een
   gemak. Commerciele post is het omgekeerde, en dat is geen stijlkeuze maar de
   wet: zonder toestemming geen aanbieding. Wie de twee door elkaar haalt, bouwt
   een opt-out waar een opt-in hoort.

   En toets 4: de geschiedenis groeit aan en wordt nooit herschreven. Bij een
   klacht is de vraag niet of het aanstond, maar wanneer iemand ja zei en waar.
   Een stand zonder herkomst is geen bewijs van toestemming.

   Draai los: node --test test/commercieel.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakCommercieel, SOORTEN, KANALEN, ALTIJD } = require('../server/kern/identiteit/commercieel');

const opzet = () => maakCommercieel({ db: { data: {} }, save() {} });

/* ---------------------------------------------------------------------------
   1. DE KERN: afwezigheid is geen toestemming.
   ------------------------------------------------------------------------- */
test('1. alles staat standaard uit', () => {
  const c = opzet();
  for (const s of c.standVan('user-1').soorten) {
    assert.equal(s.aan, false, s.id + ' staat standaard aan; dat is een opt-out waar een opt-in hoort');
    assert.deepEqual(s.kanalen, []);
  }
});

test('1b. en de poort weigert zonder vastgelegde toestemming', () => {
  const c = opzet();
  for (const s of SOORTEN) for (const k of KANALEN) {
    assert.equal(c.mag('user-1', s.id, k.id), false, s.id + ' via ' + k.id);
  }
  assert.equal(c.mag('onbekend-lid', 'aanbiedingen', 'email'), false);
});

test('1c. toestemming geldt PER KANAAL en niet in het algemeen', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 'toets');
  assert.equal(c.mag('user-1', 'aanbiedingen', 'email'), true);
  assert.equal(c.mag('user-1', 'aanbiedingen', 'sms'), false,
    'ja tegen mail is geen ja tegen sms');
  assert.equal(c.mag('user-1', 'onderzoek', 'email'), false,
    'ja tegen aanbiedingen is geen ja tegen enquetes');
});

test('1d. een onbekende soort of een onbekend kanaal komt er niet in', () => {
  const c = opzet();
  assert.equal(c.zet('user-1', 'verzonnen', ['email'], 't').status, 400);
  c.zet('user-1', 'aanbiedingen', ['email', 'duif'], 't');
  assert.deepEqual(c.standVan('user-1').soorten.find(s => s.id === 'aanbiedingen').kanalen, ['email']);
});

/* ---------------------------------------------------------------------------
   2. INTREKKEN IS EEN LEGE KANALENLIJST, en werkt meteen.
   ------------------------------------------------------------------------- */
test('2. intrekken zet de poort meteen dicht', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email', 'push'], 't');
  c.zet('user-1', 'aanbiedingen', [], 'afmeldlink');
  assert.equal(c.mag('user-1', 'aanbiedingen', 'email'), false);
  assert.equal(c.standVan('user-1').soorten.find(s => s.id === 'aanbiedingen').aan, false);
});

test('2b. afmelden kan in EEN handeling', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 't');
  c.zet('user-1', 'onderzoek', ['sms'], 't');
  c.zet('user-1', 'partners', ['push'], 't');
  const r = c.allesUit('user-1', 'afmeldknop');
  assert.equal(r.uitgezet, 3);
  for (const s of c.standVan('user-1').soorten) assert.equal(s.aan, false,
    'wie vier vinkjes moet omzetten om van post af te komen, is niet afgemeld maar afgeschrikt');
});

/* ---------------------------------------------------------------------------
   3. HET RAAKT DE ANDER NIET.
   ------------------------------------------------------------------------- */
test('3. toestemming van het ene lid geldt niet voor het andere', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 't');
  assert.equal(c.mag('user-2', 'aanbiedingen', 'email'), false);
});

/* ---------------------------------------------------------------------------
   4. DE GESCHIEDENIS IS HET BEWIJS.
   ------------------------------------------------------------------------- */
test('4. elke beweging komt in de geschiedenis, met herkomst', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 'scherm:meldingen');
  c.zet('user-1', 'aanbiedingen', [], 'afmeldlink');
  const g = c.geschiedenisVan('user-1').geschiedenis;
  assert.equal(g.length, 2);
  assert.equal(g[0].handeling, 'ingetrokken');
  assert.equal(g[1].handeling, 'gegeven');
  assert.equal(g[1].bron, 'scherm:meldingen',
    'een stand zonder herkomst is geen bewijs van toestemming maar een bewering dat er ooit toestemming was');
  assert.ok(g[0].op && g[1].op);
});

test('4b. intrekken wordt net zo goed vastgelegd als geven', () => {
  const c = opzet();
  c.zet('user-1', 'onderzoek', ['email'], 't');
  c.allesUit('user-1', 'afmeldknop');
  const g = c.geschiedenisVan('user-1').geschiedenis;
  assert.equal(g[0].handeling, 'ingetrokken');
  assert.equal(g[0].bron, 'afmeldknop',
    'een intrekking die je niet kunt aantonen, is een intrekking die je niet hebt');
});

test('4c. niets veranderen is geen gebeurtenis', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 't');
  c.zet('user-1', 'aanbiedingen', ['email'], 't');
  assert.equal(c.geschiedenisVan('user-1').geschiedenis.length, 1,
    'anders staat de lijst vol regels waarin niets gebeurde, en dan is hij als bewijs onleesbaar');
});

test('4d. het lid ziet zelf waar hij het gaf', () => {
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 'scherm:aanmelding');
  const s = c.standVan('user-1').soorten.find(x => x.id === 'aanbiedingen');
  assert.equal(s.gegevenVia, 'scherm:aanmelding');
  assert.ok(s.sinds);
});

/* ---------------------------------------------------------------------------
   5. WAT HIER NOOIT ONDER VALT.
   ------------------------------------------------------------------------- */
test('5. de altijd-lijst staat er, met een reden per regel', () => {
  assert.ok(ALTIJD.length >= 4);
  for (const a of ALTIJD) {
    assert.ok(a.naam && a.reden && a.reden.length > 40,
      a.naam + ' staat er zonder reden bij; een scherm dat alleen toont wat je KUNT uitzetten, laat denken dat de rest ook uit kan');
  }
  assert.ok(ALTIJD.some(a => /beveiliging/i.test(a.naam)), 'beveiligingswaarschuwingen horen hier expliciet te staan');
  assert.ok(ALTIJD.some(a => /factu|betaling/i.test(a.naam)));
});

test('5b. en hij reist mee naar het scherm', () => {
  assert.ok(opzet().standVan('user-1').altijd.length >= 4);
});

/* ---------------------------------------------------------------------------
   6. HET STAAT OP HET CONSENT-SCHERM, en niet op een eigen eilandje.
   ------------------------------------------------------------------------- */
test('6. de laag staat in het consentregister', () => {
  const { LAGEN } = require('../server/kern/consent-register');
  const l = LAGEN.find(x => x.id === 'commercieel');
  assert.ok(l, 'een lid hoort niet te moeten weten dat "wie mag mij benaderen" ergens anders woont dan "wie mag iets van mij zien"');
  assert.equal(l.gedekt, true);
});

test('6b. consentVan leest hem, en alleen wat AAN staat', () => {
  const maakConsent = require('../server/kern/consent');
  const c = opzet();
  c.zet('user-1', 'aanbiedingen', ['email'], 't');
  const kern = { commercieelStand: (k) => c.standVan(k) };
  const rijen = maakConsent({ kern }).consentVan('user-1').toestemmingen.filter(r => r.laag === 'commercieel');
  assert.equal(rijen.length, 1, 'alleen wat openstaat; de andere drie soorten staan uit');
  assert.equal(rijen[0].partij, 'rtg', 'hier verstuurt RTG zelf, dus de partij is dit huis en geen derde');
  assert.match(rijen[0].wat, /email/);
  assert.equal(rijen[0].intrekbaar, true);
});

test('6c. en intrekken loopt langs dezelfde weg als het scherm', () => {
  const maakConsent = require('../server/kern/consent');
  const geraakt = [];
  const kern = { commercieelStand: () => ({ soorten: [] }),
    commercieelZet: (k, s, kan, bron) => { geraakt.push([k, s, kan, bron]); return { ok: true }; } };
  maakConsent({ kern }).consentIntrek('user-1', { laag: 'commercieel', id: 'aanbiedingen' });
  assert.deepEqual(geraakt, [['user-1', 'aanbiedingen', [], 'consentcentrum']],
    'een eigen vlaggetje hier zou een tweede manier zijn om hetzelfde uit te zetten');
});
