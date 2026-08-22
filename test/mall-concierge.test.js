/* De Mall-concierge: een zin in, een zoekopdracht uit.

   Dit is het enige stuk van de Mall waar een taalmodel bij komt, en dus het
   enige stuk waar een fout niet terug te draaien is. Waar deze toetsen op
   mikken, in volgorde van hoe erg het is:

     1. EEN MODEL DAT DE ANTWOORDTEKST SCHRIJFT. Dan verzint het vroeg of laat
        een restaurant, een prijs of een beschikbaarheid. De tekst hoort te
        worden opgeteld uit de echte treffers.
     2. EEN PAS DIE DOOR DE AI WORDT BELOOFD. CLAUDE.md verbiedt dat; de
        veiligste garantie is de vraag niet aan het model te stellen. Dat moet
        dus in CODE staan, niet in de prompt (LAT-regel 6).
     3. EEN HALF BEGREPEN VRAAG DIE ER GOED BEGREPEN UITZIET. Een verzonnen
        verdieping of type hoort te worden weggegooid EN gemeld.
     4. EEN VERZONNEN ANTWOORD ZONDER SLEUTEL. Zonder AI valt de concierge
        terug op gewoon zoeken -- en zegt dat erbij.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2).
   Draai los: node --test test/mall-concierge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { PASVRAAG, schoonFilters, leesJson } = require('../server/kern/mall/concierge');
const { VERDIEPINGEN, TYPEN } = require('../server/kern/mall/aanbodvorm');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallconc-'));
  // met opzet ZONDER sleutel: dit is de stand waarin de terugval moet werken
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Conc Lid', email: 'conc@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. een vraag over een pas gaat NIET naar het model en verwijst naar een mens', async () => {
  for (const zin of [
    'hoe krijg ik een Lifestyle Pass',
    'ik wil een business pass aanvragen',
    'kun je mij toegang geven tot de Salon',
    'wanneer is mijn ballotage'
  ]) {
    assert.ok(PASVRAAG.test(zin), 'de vraag "' + zin + '" wordt herkend als pasvraag');
    const r = await api(base, '/api/mall/concierge', { vraag: zin }, lid);
    assert.equal(r.status, 200);
    assert.equal(r.body.soort, 'doorverwijzing', zin);
    assert.equal(r.body.naarMens, true);
    assert.equal(r.body.gebruikteAI, false, 'er is geen model bij betrokken geweest');
    assert.ok(/RTG zelf, in een gesprek/i.test(r.body.antwoord), r.body.antwoord);
    assert.ok(!/ja|geregeld|toegekend|u krijgt/i.test(r.body.antwoord.replace(/gesprek/gi, '')),
      'er wordt niets toegezegd: ' + r.body.antwoord);
  }
});

test('1b. een gewone zoekvraag met "toegang" erin wordt NIET naar een mens gestuurd', async () => {
  // anders slokt de pasvraag-regel de halve Mall op
  for (const zin of ['beachclub met toegang tot het strand', 'hotel met toegang tot een zwembad']) {
    assert.ok(!PASVRAAG.test(zin), '"' + zin + '" is een gewone zoekvraag');
    const r = await api(base, '/api/mall/concierge', { vraag: zin }, lid);
    assert.equal(r.body.soort, 'zoekopdracht', zin + ' hoort gewoon gezocht te worden');
  }
});

test('2. een gewone vraag levert echte treffers, geen geschreven verhaal', async () => {
  const r = await api(base, '/api/mall/concierge', { vraag: 'iets te eten op Ibiza' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.soort, 'zoekopdracht');
  assert.ok(Array.isArray(r.body.treffers), 'er komen treffers mee');
  // en elke treffer is een echt aanbod-object uit de Mall
  for (const a of r.body.treffers) {
    assert.ok(a.id && a.titel && a.pagina, 'treffer heeft id, titel en een pagina');
    assert.ok(TYPEN[a.type], a.titel + ' heeft een bekend type');
  }
  assert.ok(/resultaten|resultaat|niets/i.test(r.body.antwoord), 'de tekst is opgeteld: ' + r.body.antwoord);
});

test('3. het antwoord belooft nooit een boeking of een bevestiging', async () => {
  for (const zin of ['boek een tafel voor vier vanavond', 'reserveer die villa voor mij', 'koop dit voor me']) {
    const r = await api(base, '/api/mall/concierge', { vraag: zin }, lid);
    const alles = JSON.stringify({ a: r.body.antwoord, o: r.body.opmerking, h: r.body.hoe });
    assert.ok(!/\b(geboekt|gereserveerd|bevestigd|besteld|betaald)\b/i.test(alles),
      'er staat geen voltooide handeling in het antwoord op "' + zin + '": ' + alles);
    assert.ok(/boeken en betalen doet u bij de partij zelf/i.test(r.body.opmerking),
      'en er staat expliciet bij waar het wel gebeurt');
  }
});

test('4. het antwoord zegt zelf dat het niet door een tekstmodel is geschreven', async () => {
  const r = await api(base, '/api/mall/concierge', { vraag: 'kapper in de buurt' }, lid);
  assert.ok(/komt uit de Mall en niet uit een tekstmodel/i.test(r.body.hoe), r.body.hoe);
});

test('5. zonder sleutel valt de concierge terug op gewoon zoeken, en zegt dat', async () => {
  const r = await api(base, '/api/mall/concierge', { vraag: 'scooter huren' }, lid);
  assert.equal(r.body.gebruikteAI, false, 'deze server draait zonder sleutel');
  assert.ok(/gewone zoekopdracht/i.test(r.body.antwoord),
    'en dat staat in het antwoord in plaats van te doen alsof: ' + r.body.antwoord);
  assert.equal(r.body.filters.q, 'scooter huren', 'de zin is als zoektekst gebruikt');
});

/* ---------------------------------------------------------------------------
   6-9. Wat er uit het model komt is INVOER, geen waarheid.
   --------------------------------------------------------------------------- */

test('6. een verzonnen verdieping of type wordt weggegooid EN gemeld', () => {
  const s = schoonFilters({ woorden: 'tafel', verdieping: 'zwembadafdeling', type: 'teleportatie' });
  assert.equal(s.filters.verdieping, undefined, 'een verdieping die niet bestaat komt er niet in');
  assert.equal(s.filters.type, undefined);
  assert.equal(s.genegeerd.length, 2, 'en allebei worden gemeld: ' + JSON.stringify(s.genegeerd));
  assert.ok(s.genegeerd.every(g => g.reden === 'bestaat niet'));
  // een echte verdieping komt er wel door
  const goed = schoonFilters({ verdieping: VERDIEPINGEN[0].id, type: Object.keys(TYPEN)[0] });
  assert.equal(goed.filters.verdieping, VERDIEPINGEN[0].id);
  assert.deepEqual(goed.genegeerd, []);
});

test('7. een datum die geen datum is, wordt geweigerd in plaats van geraden', () => {
  const s = schoonFilters({ van: 'morgen', tot: '2026-09-01' });
  assert.equal(s.filters.van, undefined, '"morgen" is geen datum en wordt niet gegokt');
  assert.equal(s.filters.tot, '2026-09-01');
  assert.equal(s.genegeerd.filter(g => g.veld === 'van').length, 1, 'en het wordt gemeld');
});

test('8. een onzinnige afstand komt er niet in', () => {
  assert.equal(schoonFilters({ binnenKm: 5 }).filters.binnenKm, 5);
  assert.equal(schoonFilters({ binnenKm: -3 }).filters.binnenKm, undefined);
  assert.equal(schoonFilters({ binnenKm: 99999 }).filters.binnenKm, undefined);
  assert.equal(schoonFilters({ binnenKm: 'ver weg' }).filters.binnenKm, undefined);
  assert.equal(schoonFilters({ binnenKm: 'ver weg' }).genegeerd.length, 1, 'en het wordt gemeld');
});

test('9. rommel uit het model laat de concierge niet omvallen', () => {
  assert.equal(leesJson(null), null);
  assert.equal(leesJson('sorry, dat kan ik niet'), null, 'geen JSON is geen filters');
  assert.deepEqual(leesJson('```json\n{"woorden":"tafel"}\n```'), { woorden: 'tafel' },
    'JSON in een codeblok wordt er wel uit gepeuterd');
  assert.equal(leesJson('{kapot'), null);
  // en een leeg object levert geen filters op, geen crash
  assert.deepEqual(schoonFilters({}).filters, {});
  assert.deepEqual(schoonFilters(null).filters, {});
});

test('10. een te korte vraag wordt geweigerd met uitleg', async () => {
  const r = await api(base, '/api/mall/concierge', { vraag: 'ja' }, lid);
  assert.equal(r.status, 400);
  assert.ok(/korte zin/i.test(r.body.error), r.body.error);
});
