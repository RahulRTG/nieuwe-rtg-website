/* Aanmeldingen (kern/aanmeldingen.js): de aanmelding per pas is geheel
   geautomatiseerd, behalve de menselijke ja/nee. De AI kent NOOIT zelf
   Lifestyle/Business toe. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);

function maak() {
  const db = { data: {} };
  const geldPasprijzen = () => ({ passen: { rtg: { maandCenten: 6500 }, lifestyle: { maandCenten: 2000000 } } });
  return require('../server/kern/aanmeldingen')({ db, save: () => {}, crypto, schoon, geldPasprijzen }).aanmeldingen;
}

test('een aanmelding krijgt automatisch de hele reis en wacht op de mens', () => {
  const a = maak();
  const r = a.aanvraag({ pas: 'rtg', naam: 'Amber', contact: 'amber@example.com' });
  assert.equal(r.ok, true);
  assert.equal(r.aanmelding.status, 'in behandeling');
  // de zes geautomatiseerde stappen staan er en zijn allemaal door de AI gedaan
  const ids = r.aanmelding.reis.map(s => s.id);
  for (const stap of ['welkom', 'onboarding', 'rondleiding', 'rtf', 'security', 'privacy'])
    assert.ok(ids.includes(stap), stap + ' zit in de reis');
  assert.ok(r.aanmelding.reis.every(s => s.auto === true), 'elke stap is geautomatiseerd');
});

test('de toon draait mee met de pas (je voor RTG, u voor Business)', () => {
  const a = maak();
  const rtg = a.aanvraag({ pas: 'rtg', naam: 'Sam' }).aanmelding;
  const biz = a.aanvraag({ pas: 'business', naam: 'Dr. Vos' }).aanmelding;
  assert.match(rtg.reis.find(s => s.id === 'security').tekst, /\bje\b/);
  assert.match(biz.reis.find(s => s.id === 'security').tekst, /\bu\b/);
});

test('alleen een mens (met naam) beslist; de AI kan Lifestyle/Business nooit toekennen', () => {
  const a = maak();
  assert.equal(a.magAutomatischToekennen('lifestyle'), false);
  assert.equal(a.magAutomatischToekennen('business'), false);
  assert.equal(a.magAutomatischToekennen('rtg'), false);

  const life = a.aanvraag({ pas: 'lifestyle', naam: 'Gast' }).aanmelding;
  // zonder naam geen besluit
  assert.equal(a.beslis(life.id, 'geaccepteerd', '').status, 400);
  // met naam wel
  const ok = a.beslis(life.id, 'geaccepteerd', 'Rahul Imran Ismail', 'Op uitnodiging');
  assert.equal(ok.aanmelding.status, 'geaccepteerd');
  assert.equal(ok.aanmelding.besluit.door, 'Rahul Imran Ismail');
  // en niet twee keer
  assert.equal(a.beslis(life.id, 'afgewezen', 'Iemand').status, 409);
});

test('na accepteren loopt de betaling 12 maanden automatisch met de 30%-split', () => {
  const a = maak();
  const life = a.aanvraag({ pas: 'lifestyle', naam: 'Gast' }).aanmelding;
  const r = a.beslis(life.id, 'geaccepteerd', 'Rahul Imran Ismail');
  assert.equal(r.betaalschema, true);
  const bet = a.betalingen();
  assert.equal(bet.aantalLeden, 1);
  const lid = bet.lidmaatschappen[0];
  assert.equal(lid.termijnen.length, 12, '12 maandtermijnen');
  const t1 = lid.termijnen[0];
  assert.equal(t1.bedrag, 20000);        // Lifestyle 20.000 ex btw p/m
  assert.equal(t1.foundation, 6000);     // 30%
  assert.equal(t1.lokaal, 4000);         // 20%
  assert.equal(t1.rtf, 2000);            // 10%
  // het jaartotaal naar de foundation = 12 x 6000 = 72000
  assert.equal(bet.totaal.foundation, 72000);
  assert.equal(bet.totaal.lokaal, 48000);
  assert.equal(bet.totaal.rtf, 24000);
});

test('afwijzen start geen betaling; Business staat als op maat in het schema', () => {
  const a = maak();
  const afw = a.aanvraag({ pas: 'rtg', naam: 'Nee' }).aanmelding;
  a.beslis(afw.id, 'afgewezen', 'Beoordelaar');
  assert.equal(a.betalingen().aantalLeden, 0, 'een afwijzing maakt geen betaalschema');
  const biz = a.aanvraag({ pas: 'business', naam: 'Zaak' }).aanmelding;
  a.beslis(biz.id, 'geaccepteerd', 'Beoordelaar');
  const t = a.betalingen().lidmaatschappen[0].termijnen[0];
  assert.equal(t.opMaat, true);
  assert.equal(t.bedrag, null, 'Business is prijs op maat: bedrag nog leeg');
});

test('de wachtrij telt de openstaande aanmeldingen', () => {
  const a = maak();
  a.aanvraag({ pas: 'rtg', naam: 'Een' });
  a.aanvraag({ pas: 'rtg', naam: 'Twee' });
  const l = a.lijst();
  assert.equal(l.openstaand, 2);
  assert.equal(a.lijst('in behandeling').aanmeldingen.length, 2);
});
