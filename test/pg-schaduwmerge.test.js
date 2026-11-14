'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { voegBijzonderSamen } = require('../server/pg/verzoekbijzonder');
const { voegVeilig } = require('../server/pg/verzoekmerge');
const { maakSchaduw, VOORBEELDEN } = require('../server/kern/commercie/schaduw');
const kloon = x => JSON.parse(JSON.stringify(x));
const regel = 'lidcontract.ontbreekt';
const conflict = fn => assert.throws(fn, { code: 'PG_REQUEST_CONFLICT' });

function basis(aantal = 0) {
  const db = { data: {} };
  const s = maakSchaduw({ db, save() {}, nu: () => 1000 });
  s.meld(regel);
  for (let i = 0; i < aantal; i++) s.weeg(regel, 'historisch ' + i);
  return kloon(db.data.schaduwregels);
}
function meet(bron, naam, aantal = 1, bezwaar = true) {
  const db = { data: { schaduwregels: kloon(bron) } };
  let at = naam === 'A' ? 2000 : 3000;
  const s = maakSchaduw({ db, save() {}, nu: () => at++ });
  for (let i = 0; i < aantal; i++) s.weeg(regel, bezwaar ? naam + '-' + i : null,
    { wie: null, wat: 'GEEN_CONTRACT' });
  return kloon(db.data.schaduwregels);
}
const voeg = (b, o, h) => voegBijzonderSamen('schaduwregels', b, o, h)
  ?? voegVeilig(b, o, h, 'schaduwregels');

test('twee echte schaduwmetingen tellen beide zonder een autorisatieconflict', () => {
  const b = basis(2), o = meet(b, 'A'), h = meet(b, 'B');
  const voor = [kloon(b), kloon(o), kloon(h)];
  const uit = voeg(b, o, h)[regel];
  assert.equal(uit.waarnemingen, 4);
  assert.equal(uit.zouTegenhouden, 4);
  assert.deepEqual(uit.voorbeelden, [...o[regel].voorbeelden.slice(0, 1), ...h[regel].voorbeelden]);
  assert.deepEqual([b, o, h], voor, 'de merge muteert geen van zijn invoerbeelden');
});

test('gelijke positieve delta zonder bezwaar is tweemaal gemeten, niet eenmaal', () => {
  const b = basis(), o = meet(b, 'A', 1, false), h = meet(b, 'B', 1, false);
  assert.deepEqual(o, h);
  const uit = voeg(b, o, h)[regel];
  assert.equal(uit.waarnemingen, 2);
  assert.equal(uit.zouTegenhouden, 0);
  assert.deepEqual(uit.voorbeelden, []);
});

test('voorbeelden blijven begrensde toevoegingen, ook bij volle retentie', () => {
  const b = basis(VOORBEELDEN), o = meet(b, 'A', 2), h = meet(b, 'B', 3);
  const uit = voeg(b, o, h)[regel];
  assert.equal(uit.waarnemingen, VOORBEELDEN + 5);
  assert.equal(uit.voorbeelden.length, VOORBEELDEN);
  assert.deepEqual(uit.voorbeelden,
    [...o[regel].voorbeelden.slice(0, 2), ...h[regel].voorbeelden].slice(0, VOORBEELDEN));
});

test('een hele nieuwe retentiekop en gelijke voorbeeldinhoud verliezen geen metingen', () => {
  const b = basis(VOORBEELDEN), o = meet(b, 'A', VOORBEELDEN + 1), h = meet(b, 'B');
  const uit = voeg(b, o, h)[regel];
  assert.equal(uit.waarnemingen, VOORBEELDEN * 2 + 2);
  assert.deepEqual(uit.voorbeelden, o[regel].voorbeelden);
  const leeg = basis(), een = meet(leeg, 'A');
  const gelijk = voeg(leeg, een, kloon(een))[regel];
  assert.equal(gelijk.waarnemingen, 2);
  assert.equal(gelijk.voorbeelden.length, 2, 'twee gelijke waarnemingen zijn niet stil één');
});

test('LISTEN herbaseert de lokale kop; de latere commit telt remote niet dubbel', () => {
  const b = basis(VOORBEELDEN), o = meet(b, 'A'), h = meet(b, 'B');
  const naListen = voeg(b, o, h);
  const naCommit = voeg(h, naListen, h);
  assert.deepEqual(naCommit, naListen);
  assert.equal(naCommit[regel].waarnemingen, VOORBEELDEN + 2);
  const nogRemote = meet(h, 'B');
  assert.equal(voeg(h, naListen, nogRemote)[regel].waarnemingen, VOORBEELDEN + 3);
});

test('herbaseren houdt de delta bij lege, gedeeltelijke en volle voorbeeldlijsten', () => {
  for (const oud of [0, 1, VOORBEELDEN - 1, VOORBEELDEN]) {
    for (const lokaal of [0, 1, 2, VOORBEELDEN + 1]) {
      for (const remote of [0, 1, VOORBEELDEN]) {
        const b = basis(oud), o = meet(b, 'A', lokaal), h = meet(b, 'B', remote);
        const herbaseerd = voeg(b, o, h), gecommit = voeg(h, herbaseerd, h);
        assert.equal(gecommit[regel].waarnemingen, oud + lokaal + remote);
        assert.deepEqual(gecommit, herbaseerd);
        assert.equal(gecommit[regel].voorbeelden.length, Math.min(VOORBEELDEN, oud + lokaal + remote));
      }
    }
  }
});

test('gewijzigde controlestand plus een meting blijft een conflict, ook aan één kant', () => {
  const b = basis(2);
  for (const [veld, waarde] of Object.entries({ modus: 'UIT', sinds: 9000, door: 'beheerder',
    vrijstelling: { reden: 'een menselijke vrijstelling', door: 'beheerder', at: 9000 },
    verloop: [{ at: 9000, van: 'SCHADUW', naar: 'UIT', door: 'beheerder' }] })) {
    const o = meet(b, 'A'), h = kloon(b);
    h[regel][veld] = waarde;
    conflict(() => voeg(b, o, h));
    conflict(() => voeg(b, h, o));
  }
  const alleenBeheer = kloon(b); alleenBeheer[regel].modus = 'UIT';
  assert.deepEqual(voeg(b, alleenBeheer, b), alleenBeheer, 'onbetwist beheer blijft mogelijk');
});

test('negatieve, onveilige en inconsistente tellers worden nooit meetdelta', () => {
  const b = basis(2);
  for (const wijzig of [r => { r.waarnemingen--; }, r => { r.zouTegenhouden--; },
    r => { r.waarnemingen = '3'; }, r => { r.waarnemingen = 3.5; },
    r => { r.waarnemingen = Number.MAX_SAFE_INTEGER; },
    r => { r.zouTegenhouden = r.waarnemingen + 1; }]) {
    const o = meet(b, 'A'); wijzig(o[regel]);
    conflict(() => voeg(b, o, meet(b, 'B')));
  }
});

test('een bestaande voorbeeldregel veranderen, wissen of vermommen als toevoeging faalt', () => {
  const b = basis(3), h = meet(b, 'B');
  for (const wijzig of [r => { r.voorbeelden[1].reden = 'herschreven'; },
    r => { r.voorbeelden.pop(); }, r => { r.voorbeelden.reverse(); },
    r => { r.voorbeelden.unshift({ at: 4000, reden: 'niet geteld', wie: null, wat: null }); }]) {
    const o = meet(b, 'A'); wijzig(o[regel]);
    conflict(() => voeg(b, o, h));
  }
});

test('regeldeletie en nieuwe tegenstrijdige regels blijven streng', () => {
  const b = basis(), o = meet(b, 'A');
  conflict(() => voeg(b, o, {}));
  assert.deepEqual(voeg(b, {}, b), {});
  const h = kloon(o); h[regel].sinds++;
  conflict(() => voeg({}, o, h));
  assert.deepEqual(voeg({}, o, {}), o);
});

test('de meetuitzondering aanvaardt geen kapotte vorm of verborgen voorbeeldvelden', () => {
  const b = basis(), h = meet(b, 'B');
  for (const wijzig of [r => { r.id = 'andere-regel'; },
    r => { r.voorbeelden = {}; }, r => { r.voorbeelden[0].at = 'geen tijd'; },
    r => { r.voorbeelden[0].identiteit = 'verboden-extra'; }]) {
    const o = meet(b, 'A'); wijzig(o[regel]); conflict(() => voeg(b, o, h));
  }
  conflict(() => voeg(b, [], h));
  conflict(() => voeg(b, null, h));
  const vervuild = JSON.parse('{"__proto__":{}}');
  conflict(() => voeg({}, vervuild, {}));
});

test('een eenzijdig nieuwe regel mag geen ongetelde voorbeeldkop bevatten', () => {
  const nieuw = basis();
  nieuw[regel].voorbeelden.push({ at: 1000, reden: 'niet geteld', wie: null, wat: null });
  conflict(() => voeg({}, nieuw, {}));
  conflict(() => voeg({}, {}, nieuw));
  const zonderKop = basis(1); zonderKop[regel].voorbeelden = [];
  conflict(() => voeg({}, zonderKop, {}));
  conflict(() => voeg({}, {}, zonderKop));
});

test('verplichte schaduwbesturing en geneste beheervelden volgen exact de bronvorm', () => {
  const b = basis(1);
  for (const veld of ['modus', 'sinds', 'door', 'vrijstelling', 'verloop']) {
    const o = kloon(b); delete o[regel][veld];
    conflict(() => voeg(b, o, b));
    conflict(() => voeg({}, o, {}));
  }
  for (const wijzig of [r => { r.modus = 'ONBEKEND'; }, r => { r.sinds = '1000'; },
    r => { r.door = {}; }, r => { r.onbekendeBesturing = true; },
    r => { r.vrijstelling = { reden: 'een menselijke vrijstelling' }; },
    r => { r.vrijstelling = { reden: 'kort', door: null, at: 1000 }; },
    r => { r.vrijstelling = { reden: 'een menselijke vrijstelling', door: null, at: 1000, geheim: true }; },
    r => { r.verloop = [{ at: 1000, van: 'SCHADUW', naar: 'ONGELDIG', door: null }]; },
    r => { r.verloop = Array.from({ length: 41 }, () => ({ at: 1000, van: 'UIT', naar: 'SCHADUW', door: null })); },
    r => { Object.defineProperty(r, '__proto__', { value: { verboden: true }, enumerable: true }); }]) {
    const o = kloon(b); wijzig(o[regel]);
    conflict(() => voeg(b, o, b));
    conflict(() => voeg({}, o, {}));
  }
});

test('echte onbetwiste beheerstanden en nieuwe regels blijven geldig, inclusief volle retentie', () => {
  const db = { data: { schaduwregels: basis(VOORBEELDEN + 2) } };
  const s = maakSchaduw({ db, save() {}, nu: () => 9000 });
  for (const wijzig of [() => s.stelVrij(regel, 'Deze regel ontneemt niemand rechten.', 'beheerder'),
    // stelVrij trimt vóór afkappen; een afgekapt stuk mag dus op spaties eindigen.
    () => s.stelVrij(regel, 'A' + ' '.repeat(300) + 'bronreden', 'beheerder'),
    () => s.zetModus(regel, 'AFDWINGEN', 'beheerder'),
    () => s.zetModus(regel, 'UIT', 'beheerder'),
    () => s.zetModus(regel, 'SCHADUW', '')]) {
    const b = kloon(db.data.schaduwregels);
    assert.equal(wijzig().status, 200);
    const o = kloon(db.data.schaduwregels);
    assert.deepEqual(voeg(b, o, b), o);
    assert.deepEqual(voeg(b, b, o), o);
    assert.deepEqual(voeg({}, o, {}), o);
    assert.deepEqual(voeg({}, {}, o), o);
  }
});
