/* DE OVERGANGSVORM-METER: kan hij nog vinden wat hij beweert niet te vinden?

   VERDER.md par. 2 rust op GEEN: er is geen universele overgang onder werk,
   leren, bevoegdheid, de buurt, kennis en blauwdrukken. Op een negatief een
   architectuurbesluit bouwen mag alleen als de meter op dezelfde code ook
   een positief kan geven -- anders staat hij "geen" om dezelfde reden als een
   meter die kapot is. Toets 1 versmalt daarom de echte overgangen tot twee die
   wel samengaan, precies zoals test/carrierevorm.test.js dat doet.

   De rekening zelf staat in test/overgangsrekening.test.js; dit is de meting
   op de boom: de citaten, de proeven op de echte modules en de ijking. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../scripts/overgangsvorm');

const u = M.meet();

test('1. zelfijking: versmald tot twee overgangen die samengaan, zegt de meter UNIVERSEEL', () => {
  assert.equal(u.uitkomst, 'GEEN', 'over alle overgangen is er geen universele vorm');
  const smal = M.meet({ overgangen: M.OVERGANGEN.filter(o => ['werk', 'buurtidee'].includes(o.id)) });
  assert.equal(smal.uitkomst, 'UNIVERSEEL',
    'werk en buurtidee delen al hun poorten; vindt de meter daar niets, dan zegt GEEN iets over de meter');
  assert.ok(smal.kern.includes('bevoegdheid') && smal.kern.includes('menselijke_bevestiging'));
});

test('2. elk citaat staat in de code, en een citaat in een commentaar telt niet', () => {
  assert.equal(u.citaten.rot, 0, JSON.stringify(u.citaten.rotLijst));
  assert.equal(u.wetten.rot, 0, JSON.stringify(u.wetten.rotLijst));
  // deze zin staat in netwerk.js, maar alleen in de kop: een belofte, geen handhaving
  assert.equal(M.natrek({ stand: 'poort', bestand: 'server/kern/rtfos/netwerk.js', citaat: 'EEN BLAUWDRUK IS GEEN KOPIE VAN EEN PROJECT' }),
    'citaat staat niet (meer) in de code');
  // een weigerzin staat in een tekenreeks, en die telt WEL
  assert.equal(M.natrek({ stand: 'poort', bestand: 'server/kern/rtfos/netwerk.js', citaat: 'Zonder cijfers is dit een idee en geen blauwdruk.' }), null);
  // een stand die iets beweert, zonder citaat, is rot en niet vrijgesteld
  assert.ok(M.natrek({ stand: 'poort' }));
  assert.equal(M.natrek({ stand: 'afwezig' }), null);
});

test('3. een rot citaat verlaagt de kern en verzint hem nooit', () => {
  const werk = M.OVERGANGEN.find(o => o.id === 'werk');
  const rot = JSON.parse(JSON.stringify(werk));
  rot.dimensies.actor.citaat = 'deze zin staat nergens';
  const r = M.meet({ overgangen: [rot, M.OVERGANGEN.find(o => o.id === 'buurtidee')] });
  assert.equal(r.citaten.rot, 1);
  assert.ok(!r.kern.includes('actor'), 'een rot citaat telt als afwezig');
});

test('4. de woordenas is verklaard: geen onenigheid zonder reden, en geen verklaring zonder onenigheid', () => {
  assert.equal(u.woorden.onverklaard, 0, JSON.stringify(u.woorden.lijst.filter(x => !x.nagekeken)));
  assert.deepEqual(u.woorden.verouderd, []);
});

test('5. de invariant op de echte code: een gestopt project wordt nooit een blauwdruk, een actief wel', () => {
  const p = u.proeven.gestoptGeenBlauwdrukbron;
  assert.match(p.gestopt, /^geweigerd/);
  assert.equal(p.besturing, 'geslaagd', 'de besturing moet slagen, anders bewijst de weigering niets');
  assert.equal(p.houdt, true);
});

test('6. de mutatieproef: zonder bewijs of bevoegdheid slaagt een universele motor waar de drager weigert', () => {
  const b = u.proeven.mutatieBewijs;
  assert.equal(b.besturingHoudt, true);
  assert.match(b.blauwdrukZonderIndicator.drager, /^geweigerd/);
  assert.match(b.koppelingZonderVog.drager, /VOG/);
  assert.equal(b.tenOnrechte, 2);
  const v = u.proeven.mutatieBevoegdheid;
  assert.match(v.drager, /^geweigerd/);
  assert.equal(v.tenOnrechte, 1);
  // en de motor zelf: wat hij niet kent, kan hij niet weigeren
  assert.deepEqual(M.universeleMotor(['actor'], { actor: 1 }), { ok: true });
  assert.equal(M.universeleMotor(['actor', 'bewijs'], { actor: 1 }).ok, false);
});

test('7. queryveiligheid: EEN kleine buurt lekt haar exacte aantal, twee niet', () => {
  const q = u.proeven.buurtenQueryveilig;
  assert.equal(q.lekt, true, 'de bevinding: "overige buurten (1)" draagt het aantal van precies een buurt');
  assert.equal(q.besturing, true);
});

test('8. elke overgang met een drager draagt alle veertien dimensies, en elke zonder drager een reden', () => {
  for (const o of u.overgangen) assert.deepEqual(Object.keys(o.dimensies).sort(), M.DIMS.slice().sort(), o.id);
  for (const z of u.zonderDrager) assert.ok(z.reden && z.reden.length > 40, z.id);
  assert.deepEqual(u.zonderDrager.map(z => z.id).sort(), ['les-voorstel', 'upstream']);
});

test('9. elke wet en elk besluit heeft een stand uit de gesloten lijst, en een reden', () => {
  const STANDEN = ['gehandhaafd', 'deels', 'document', 'eigenaarbesluit', 'te-bouwen'];
  assert.equal(u.wetten.lijst.filter(w => typeof w.nr === 'number').length, 20);
  assert.equal(u.wetten.lijst.filter(w => typeof w.nr === 'string').length, 8);
  for (const w of u.wetten.lijst) {
    assert.ok(STANDEN.includes(w.stand), w.nr + ': ' + w.stand);
    assert.ok(w.reden && w.reden.length > 10, String(w.nr));
  }
  // vergeten tegenover aangenomen kennis is geen technische keuze
  assert.equal(u.wetten.lijst.find(w => w.nr === 'B7').stand, 'eigenaarbesluit');
  assert.equal(u.wetten.lijst.find(w => w.nr === 19).stand, 'eigenaarbesluit');
});

test('10. VERDER.md zegt hetzelfde als het register: de matrix, de wetten en de besluiten', () => {
  /* Een document dat een tabel uit een meting overneemt, is een tweede
     waarheid naast die meting (LAT-regel 4). Deze toets leest de tabellen uit
     VERDER.md en legt ze naast een VERSE meting, zodat een verschoven cel of
     een wet die van stand wisselt de bouw laat zakken in plaats van stil
     verkeerd te blijven staan. */
  const fs = require('fs');
  const path = require('path');
  const doc = fs.readFileSync(path.join(__dirname, '..', 'VERDER.md'), 'utf8');
  const K = { poort: 'P', draagt: 'd', afwezig: '.' };
  for (const o of u.overgangen) {
    const rij = doc.split('\n').find(r => new RegExp('^  ' + o.id.replace('-', '\\-') + '\\s{2,}[Pd.]').test(r));
    assert.ok(rij, 'de matrix in VERDER.md mist ' + o.id);
    const cellen = rij.trim().split(/\s+/).slice(1);
    assert.deepEqual(cellen, M.DIMS.map(d => K[o.dimensies[d].stand]), 'matrixrij ' + o.id);
  }
  for (const w of u.wetten.lijst) {
    const re = typeof w.nr === 'number' ? new RegExp('^\\| ' + w.nr + ' \\|.*\\| ([a-z-]+) \\|[^|]*\\|$', 'm')
      : new RegExp('^\\| ' + w.nr + ' \\|.*\\| \\**([a-z-]+)\\**[:\\s|]', 'm');
    const m = doc.match(re);
    assert.ok(m, 'VERDER.md noemt ' + w.nr + ' niet in zijn tabel');
    assert.equal(m[1], w.stand, 'stand van ' + w.nr + ' in VERDER.md');
  }
});
