/* De AI-ingang-scanner toetsen.

   Poort 21 in check.js leunt op scan(): die vindt elke plek die het model
   aanroept en zegt of de gedeelde toegangsregel eronder ligt. Een scanner die
   de basis niet herkent, zou geldige ingangen als fout aanmerken (en de poort
   onbruikbaar maken); een scanner die te veel herkent, laat een echte ontbrekende
   regel door. Beide kanten staan hieronder. */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { scan, draagtRegel } = require('../scripts/ai-oproepen');

const ROOT = path.join(__dirname, '..');

test('herkent de gedeelde basis in al zijn vormen', () => {
  assert.equal(draagtRegel("system: RAHUL_LEAD + 'je bent...'"), true);
  assert.equal(draagtRegel("system: require('../rahul').rahulLeadVoor(key) + '...'"), true);
  assert.equal(draagtRegel("system: RAHUL_BASIS + extra"), true);
  assert.equal(draagtRegel("const sys = aiSystemPrompt(tier, lang, key)"), true);
});

test('herkent de regel ook als hij letterlijk in het bestand staat', () => {
  assert.equal(draagtRegel('Beloof nooit toegang tot de Lifestyle of Business Pass.'), true);
  assert.equal(draagtRegel('je belooft niets (geen toegang, geen goedkeuring)'), true);
});

test('ziet geen regel waar er geen is', () => {
  assert.equal(draagtRegel("system: 'Je bent een chef-kok die recepten schrijft.'"), false);
  assert.equal(draagtRegel("system: 'You are a translation engine.'"), false);
});

test('scan vindt aanroepplekken en laat de transportlaag weg', () => {
  const sites = scan(ROOT);
  assert.ok(sites.length > 40, 'verwacht tientallen AI-ingangen, kreeg ' + sites.length);
  const namen = sites.map(s => s.bestand);
  for (const transport of ['ai.js', 'anthropic.js', 'openai.js', 'gemini.js', 'local-ai.js']) {
    assert.ok(!namen.includes(transport), transport + ' is transport en hoort niet in de lijst');
  }
});

test('elke gescande ingang is uniek en heeft een duidelijke uitkomst', () => {
  const sites = scan(ROOT);
  const namen = sites.map(s => s.bestand);
  assert.equal(namen.length, new Set(namen).size, 'geen dubbele bestanden');
  for (const s of sites) assert.equal(typeof s.draagtRegel, 'boolean');
});
