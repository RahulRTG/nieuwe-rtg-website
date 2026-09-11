/* RTG VERTEGENWOORDIGING (server/kern/vertegenwoordiging/, CARRIERE.md par. 6
   nummer 5 en 6).

   De dragende regel van deze laag is dezelfde als die van het AI-mandaat, en
   moet hier afgedwongen zijn en niet beloofd:

     EEN MACHTIGING VERLEENT NOOIT VERMOGEN. Zij versmalt bestaand vermogen.

   Daaruit volgen de toetsen. De uitkomst van `versmal` is een DOORSNEDE, dus
   wat eruit komt zat er al in. De lijst is GESLOTEN, dus wat er niet in staat
   valt niet te vragen. En de eigen grens van de cliënt raakt ook wat AL loopt --
   een grens die alleen nieuwe machtigingen tegenhoudt, beschermt precies de
   mens niet die er al een heeft.

   DE STILSTE FOUT die deze suite vangt: leeg lezen als open. Een machtiging
   zonder bevoegdheden, of een die nog niet is aanvaard, hoort NIETS te mogen --
   niet alles. Dat is de klassieke omkering in dit soort lagen, en zij is van
   buiten niet te zien omdat er gewoon iets gebeurt.

   EN DE LAATSTE TOETS IS EEN HANDHAVER EN GEEN GEDRAGSTOETS. CAR-05 zegt dat er
   geen cijfer op een mens komt, ook niet intern als sorteersleutel. Die grens
   stond in vier documenten en in nul toetsen; hier staat hij voor deze laag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { zonderCommentaar } = require('../scripts/lib/bron');

const { maakVertegenwoordiging } = require('../server/kern/vertegenwoordiging');
const M = require('../server/kern/vertegenwoordiging/machtiging');
const { SLEUTELS, NOOIT, BEVOEGDHEDEN } = require('../server/kern/vertegenwoordiging/bevoegdheden');
const { simuleer } = require('../server/kern/vertegenwoordiging/simulatie');

const MAP = path.join(__dirname, '..', 'server', 'kern', 'vertegenwoordiging');
const TOT = () => new Date(Date.now() + 200 * 86400000).toISOString();

function huis(volwassenAlles) {
  const db = { data: {} };
  const namen = { ka: 'Cliënt', kb: 'Agent', kc: 'Kind' };
  const V = maakVertegenwoordiging({
    db, save: () => {}, bijeen: async (f) => f(), inBundel: () => true, crypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    /* DE FIXTURE HOUDT ZICH AAN DE ECHTE VORM: kern/gids.js levert
       keyVanCodenaam ASYNC en met een OBJECT. Hier stond een synchrone functie
       die een sleutel teruggaf; die vorm bestond alleen in deze toets, en hij
       verborg een fout die pas over HTTP zichtbaar werd. Een fixture die
       vriendelijker is dan de werkelijkheid, toetst de werkelijkheid niet. */
    keyVanCodenaam: async (c) => {
      const k = Object.keys(namen).find(x => namen[x] === c);
      return k ? { key: k, tier: 'rtg', codename: c } : null;
    },
    codenaamVan: (k) => namen[k] || null,
    volwassen: (k) => (volwassenAlles === true ? true : k !== 'kc')
  });
  return { db, V };
}
const lijf = (extra) => Object.assign({ client: 'Cliënt', hoedanigheid: 'zaakwaarnemer',
  bevoegdheden: ['aanbod.ontvangen', 'aanbod.bespreken'], tot: TOT(), plafondCenten: 5000000 }, extra || {});

/* ---------- 1. de grammatica ---------- */

test('1. leeg is dicht: een machtiging zonder bevoegdheden bestaat niet', () => {
  const r = M.vorm(lijf({ bevoegdheden: [] }));
  assert.ok(r.error, 'een lege machtiging hoort geweigerd te worden');
  assert.match(r.error, /leeg is hier dicht/i);
});

test('2. de lijst is gesloten: een verzonnen bevoegdheid bestaat niet', () => {
  const r = M.vorm(lijf({ bevoegdheden: ['contract.tekenen'] }));
  assert.ok(r.error, 'een bevoegdheid buiten de lijst hoort geweigerd te worden');
  assert.match(r.error, /bestaat niet/i);
});

test('3. een machtiging zonder einddatum bestaat niet, en niet langer dan het maximum', () => {
  assert.match(M.vorm(lijf({ tot: null })).error, /einddatum/i);
  const ver = new Date(Date.now() + (M.MAX_MAANDEN + 12) * 31 * 86400000).toISOString();
  assert.match(M.vorm(lijf({ tot: ver })).error, /maximaal/i);
});

test('4. versmallen is een DOORSNEDE: wat eruit komt zat er al in', () => {
  const m = M.vorm(lijf()).machtiging;
  for (const eigen of [[], ['aanbod.ontvangen'], SLEUTELS]) {
    const r = M.versmal(eigen, m);
    for (const k of r.bevoegdheden) {
      assert.ok(eigen.includes(k), k + ' kwam uit de versmalling maar zat niet in wat de cliënt zelf heeft');
      assert.ok(m.bevoegdheden.includes(k), k + ' kwam uit de versmalling maar stond niet in de machtiging');
    }
  }
});

test('5. versmallen kan NIETS toevoegen, ook niet als de cliënt meer heeft', () => {
  const m = M.vorm(lijf({ bevoegdheden: ['aanbod.ontvangen'] })).machtiging;
  const r = M.versmal(SLEUTELS, m);
  assert.deepStrictEqual(r.bevoegdheden, ['aanbod.ontvangen']);
});

test('6. verval is een berekende toestand en geen opruimactie', () => {
  const m = M.vorm(lijf()).machtiging;
  m.aanvaard = { door: 'Cliënt', at: new Date().toISOString() };
  assert.strictEqual(M.stand(m), 'actief');
  const na = Date.parse(m.tot) + 1000;
  assert.strictEqual(M.stand(m, na), 'verlopen', 'een stilstaande server mag niemands bevoegdheid verruimen');
  m.ingetrokken = { door: 'Cliënt', at: new Date().toISOString() };
  assert.strictEqual(M.stand(m), 'ingetrokken', 'intrekken gaat vóór verlopen');
});

test('7. niet aanvaard is niets: een voorstel geeft geen enkele bevoegdheid', () => {
  const m = M.vorm(lijf()).machtiging;
  assert.strictEqual(M.stand(m), 'voorgesteld');
  const r = M.magHandelen(m, 'aanbod.ontvangen', {});
  assert.strictEqual(r.mag, false);
  assert.match(r.reden, /nog niet aanvaard/i);
});

test('8. het plafond is een grens: zonder plafond wordt er niet over bedragen gesproken', () => {
  const m = M.vorm(lijf({ plafondCenten: null })).machtiging;
  m.aanvaard = { door: 'Cliënt', at: new Date().toISOString() };
  assert.strictEqual(M.magHandelen(m, 'aanbod.bespreken', { bedragCenten: 1 }).mag, false);
  assert.strictEqual(M.magHandelen(m, 'aanbod.bespreken', {}).mag, true);
});

/* ---------- 2. de NOOIT-lijst ---------- */

test('9. geen enkele NOOIT-regel is als bevoegdheid te vragen', () => {
  assert.ok(NOOIT.length >= 5, 'de NOOIT-lijst hoort de helft van het verhaal te zijn');
  for (const n of NOOIT) {
    assert.ok(n.wat && n.waar, 'elke NOOIT-regel zegt WAT en WAAR die grens woont');
    /* Delegatie is de scherpste: een machtiging die zichzelf kan doorgeven is
       geen machtiging maar een sleutel. */
  }
  assert.ok(NOOIT.some(n => /machtigen/i.test(n.wat)), 'delegatie hoort expliciet in NOOIT te staan');
  assert.ok(!SLEUTELS.some(k => /teken|betaal|bank|machtig|medisch|gezondheid/i.test(k)),
    'wat in NOOIT staat, mag niet als sleutel in de gesloten lijst voorkomen');
});

test('10. elke bevoegdheid draagt een grond en zegt wat zij raakt', () => {
  for (const k of SLEUTELS) {
    const b = BEVOEGDHEDEN[k];
    assert.ok(b.grond && b.grond.length > 40, k + ' heeft geen uitgeschreven grond');
    assert.ok(b.raakt, k + ' zegt niet wat hij raakt');
    assert.strictEqual(typeof b.klaarzetten, 'boolean', k + ' zegt niet of hij alleen mag klaarzetten');
  }
});

/* ---------- 3. de simulatie ---------- */

test('11. de simulatie toont wat er NIET opengaat, en geeft geen cijfer', () => {
  const m = M.vorm(lijf()).machtiging;
  const s = simuleer({ voorstel: m, huidig: null, magClient: SLEUTELS });
  assert.ok(s.kan.length, 'de simulatie hoort te tonen wat er wel kan');
  assert.strictEqual(s.kanNiet.length, NOOIT.length, 'de NOOIT-lijst hoort er compleet in te staan');
  assert.ok(s.nietGewogen.length, 'wat niet is gewogen hoort er even groot bij te staan');
  assert.ok(!('score' in s) && !('risico' in s), 'er komt geen cijfer op wat een mens weggeeft');
});

test('12. de simulatie is een VERSCHIL zodra er al iets loopt', () => {
  const huidig = M.vorm(lijf({ bevoegdheden: ['aanbod.ontvangen'] })).machtiging;
  huidig.aanvaard = { door: 'Cliënt', at: new Date().toISOString() };
  const nieuw = M.vorm(lijf({ bevoegdheden: ['aanbod.ontvangen', 'reis.voorbereiden'] })).machtiging;
  const s = simuleer({ voorstel: nieuw, huidig, magClient: SLEUTELS });
  assert.deepStrictEqual(s.verandering.erbij.map(x => x.sleutel), ['reis.voorbereiden']);
  assert.deepStrictEqual(s.verandering.gelijk.map(x => x.sleutel), ['aanbod.ontvangen']);
  assert.strictEqual(s.eersteMachtiging, false);
});

/* ---------- 4. de keten ---------- */

test('13. aanvaarden doet de cliënt, en niemand anders', async () => {
  const { V } = huis();
  const v = await V.voorstel('kb', lijf());
  assert.strictEqual(v.status, 200);
  const zelf = await V.aanvaard('kb', v.machtiging.id);
  assert.notStrictEqual(zelf.status, 200, 'een vertegenwoordiger mag zijn eigen machtiging niet aanzetten');
  assert.strictEqual((await V.handel('kb', v.machtiging.id, 'aanbod.ontvangen', {})).status, 403);
  assert.strictEqual((await V.aanvaard('ka', v.machtiging.id)).status, 200);
  assert.strictEqual((await V.handel('kb', v.machtiging.id, 'aanbod.ontvangen', {})).status, 200);
});

test('14. een minderjarige cliënt wordt geweigerd, met de reden', async () => {
  const { V } = huis();
  const r = await V.voorstel('kb', lijf({ client: 'Kind' }));
  assert.strictEqual(r.status, 403);
  assert.match(r.error, /18 of ouder/i);
  assert.match(r.error, /jeugdbestuur/i, 'een weigering zegt wat er ontbreekt en niet alleen dat het niet mag');
});

test('15. de eigen grens van de cliënt raakt ook een machtiging die AL loopt', async () => {
  const { V } = huis();
  const v = await V.voorstel('kb', lijf({ bevoegdheden: ['aanbod.ontvangen', 'reis.voorbereiden'] }));
  await V.aanvaard('ka', v.machtiging.id);
  assert.strictEqual((await V.handel('kb', v.machtiging.id, 'reis.voorbereiden', {})).status, 200);
  await V.grensZet('ka', ['reis.voorbereiden']);
  assert.strictEqual((await V.handel('kb', v.machtiging.id, 'reis.voorbereiden', {})).status, 403,
    'een grens die alleen NIEUWE machtigingen raakt, beschermt de mens niet die er al een heeft');
  assert.strictEqual((await V.handel('kb', v.machtiging.id, 'aanbod.ontvangen', {})).status, 200);
});

test('16. een geweigerde poging laat een spoor na, en intrekken wist het verleden niet', async () => {
  const { V } = huis();
  const v = await V.voorstel('kb', lijf());
  await V.aanvaard('ka', v.machtiging.id);
  await V.handel('kb', v.machtiging.id, 'contract.opstellen', {});   // buiten het mandaat
  const voor = V.mijn('ka').log.filter(r => r.gelukt === false).length;
  assert.ok(voor >= 1, 'een poging buiten het mandaat hoort zichtbaar te zijn voor de cliënt');
  const n = V.mijn('ka').log.length;
  await V.intrek('ka', v.machtiging.id);
  assert.ok(V.mijn('ka').log.length >= n, 'intrekken stopt de toekomst en niet het verleden');
});

/* ---------- 5. de handhaver van CAR-05 ---------- */

test('17. CAR-05: er komt geen cijfer op een mens in deze laag', () => {
  /* Commentaar telt niet mee -- dit bestand en de laag zelf MOGEN de woorden
     noemen om uit te leggen waarom ze er niet zijn. Wat verboden is, is code.
     Dezelfde vorm als keuringsregel 53: tokens, geen tekst. */
  const verboden = /\b(score|rating|ranking|ranglijst|puntenaantal|beoordelingscijfer)\b/i;
  const gevonden = [];
  for (const naam of fs.readdirSync(MAP).filter(n => n.endsWith('.js'))) {
    const code = zonderCommentaar(fs.readFileSync(path.join(MAP, naam), 'utf8'));
    const treffer = code.match(verboden);
    if (treffer) gevonden.push(naam + ': ' + treffer[0]);
  }
  assert.deepStrictEqual(gevonden, [],
    'CAR-05 (CARRIERE.md): een score op een mens wordt nooit een veld en nooit een sorteersleutel');
});

test('18. CAR-05: de laag sorteert mensen nergens op een getal', async () => {
  const { V } = huis();
  const v1 = await V.voorstel('kb', lijf());
  await V.aanvaard('ka', v1.machtiging.id);
  const mijn = V.mijn('ka');
  for (const m of mijn.team.concat(mijn.ikSta)) {
    for (const [veld, waarde] of Object.entries(m)) {
      if (veld === 'plafondCenten') continue;   // een grens op een BEDRAG, niet op een mens
      assert.notStrictEqual(typeof waarde, 'number',
        'het veld ' + veld + ' is een getal op een mens; dat is precies wat CAR-05 verbiedt');
    }
  }
});
