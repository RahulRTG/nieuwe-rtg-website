/* Aanmeldingen (kern/aanmeldingen.js): de aanmelding per pas is geheel
   geautomatiseerd, behalve de menselijke ja/nee. De AI kent NOOIT zelf
   Lifestyle/Business toe. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);

function maak() {
  const db = { data: {} };
  return require('../server/kern/aanmeldingen')({ db, save: () => {}, crypto, schoon }).aanmeldingen;
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

test('de wachtrij telt de openstaande aanmeldingen', () => {
  const a = maak();
  a.aanvraag({ pas: 'rtg', naam: 'Een' });
  a.aanvraag({ pas: 'rtg', naam: 'Twee' });
  const l = a.lijst();
  assert.equal(l.openstaand, 2);
  assert.equal(a.lijst('in behandeling').aanmeldingen.length, 2);
});
