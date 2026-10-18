/* ISOLATIE -- naar beneden alleen langs een voltooide ceremonie.

   server/kern/isolatie (index, zetten, ontsluiting, ceremonie-eisen) bewaakt
   dat een stand op een organisatie, identiteit, sessie of apparaat alleen
   omhoog vrij gaat, en omlaag alleen na een ceremonie met reden, passkey, vier
   ogen en (bij een identiteit) een wachttijd. Deze toets duwt op de randen.

   Wat hier niet mag sneuvelen:
   1. Verlagen via zet() is 409; een lager-gelegen drager zet niets op een
      hogere (403); het huis gaat niet via deze laag.
   2. De ceremonie weigert wat niet klopt: onbekende doelstand, verstrengen als
      "ontsluiting", een te korte reden, een onbekend of voltooid verzoek, een
      stap die het verzoek niet vraagt, en een wachttijd "aftekenen".
   3. De wachttijd van een identiteit loopt op de klok: eerder committen is 409.
   4. Een opslag die faalt of een Promise geeft, maakt de hele laag onleesbaar
      (fail-closed); een kapotte standrij leest nooit als normaal; een onleesbaar
      huis leest als onbekend en niet als normaal.
   5. Verstrengen en verlagen melden zich bij de beveiliging, verlagen als kritiek.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - zetten.js: `if (zetter && !dragers.magZetten(...))` -> `if (false)` -> toets 1 zakt.
   - ontsluiting.js stap(): de wachttijd-weigering weg -> toets 3 zakt.
   - index.js bewaar(): de `uit.then`-controle weg -> toets 4 zakt.

   Draai los: node --test test/isolatie-ceremonie-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const functies = require('../server/functies');
const maakIsolatie = require('../server/kern/isolatie');
const { eisenVoor, doelVoor } = require('../server/kern/isolatie/ceremonie-eisen');

let t = Date.parse('2026-10-14T10:00:00Z');
const klok = { datum: () => new Date(t) };
function laag(opties = {}) {
  const meldingen = [];
  const db = { data: {} };
  const iso = maakIsolatie({ db, save: opties.save || (() => {}), functies, klok,
    huisStand: 'huisStand' in opties ? opties.huisStand : () => 'normaal',
    beveilig: { meld: (bron, ernst, tekst) => meldingen.push([ernst, tekst]) } });
  return { iso, db, meldingen };
}
const fout = (status, tekst) => (e) => e.status === status && (!tekst || tekst.test(e.message));

test('1. verlagen via zet is 409, een lagere drager zet niets op een hogere, het huis gaat elders', () => {
  const { iso, meldingen } = laag();
  assert.throws(() => iso.zet({ drager: 'huis', sleutel: 'x', naar: 'isolatie' }), fout(400, /incidentcontrole/));
  assert.throws(() => iso.zet({ drager: 'planeet', sleutel: 'x', naar: 'isolatie' }), fout(400, /Onbekende drager/));
  assert.throws(() => iso.zet({ drager: 'sessie', naar: 'isolatie' }), fout(400, /zonder sleutel/));
  assert.throws(() => iso.zet({ drager: 'sessie', sleutel: 's', naar: 'dicht' }), fout(400, /Onbekende stand/));
  assert.throws(() => iso.zet({ drager: 'organisatie', sleutel: 'org-1', naar: 'isolatie', zetter: 'sessie' }), fout(403));
  assert.equal(iso.standVan('organisatie', 'org-1'), null, 'de weigering zette niets');

  assert.equal(iso.zet({ drager: 'organisatie', sleutel: 'org-1', naar: 'isolatie', zetter: 'organisatie',
    door: 'beheer', reden: 'lek' }).richting, 'verstrengd');
  assert.deepEqual(meldingen.pop(), ['waarschuwing', 'Isolatiestand verstrengd op organisatie naar isolatie. Reden: lek']);
  assert.throws(() => iso.zet({ drager: 'organisatie', sleutel: 'org-1', naar: 'waakzaam' }), fout(409, /ontsluitceremonie/));
  assert.equal(iso.standVan('organisatie', 'org-1'), 'isolatie');
  assert.equal(iso.standVan('organisatie', 'org-2'), null, 'de stand van org-1 lekt niet naar org-2');
  assert.equal(iso.standVan('workload', 'w'), null);
  assert.equal(iso.standVan('sessie', ''), null);
  assert.throws(() => iso.vraagOntsluiting({ drager: 'huis', naar: 'normaal' }), fout(400, /ontsluit alleen/));
  assert.deepEqual(iso.overzicht().perDrager.organisatie, { aantal: 1, perStand: { isolatie: 1 } });
});

test('2. de ceremonie weigert wat niet klopt', () => {
  const { iso, meldingen } = laag();
  iso.zet({ drager: 'organisatie', sleutel: 'o', naar: 'isolatie' });
  const vraag = (x) => iso.vraagOntsluiting(Object.assign({ drager: 'organisatie', sleutel: 'o', naar: 'beperkt',
    door: 'a', reden: 'storing voorbij', tweedeMens: true }, x));
  assert.throws(() => vraag({ naar: 'open' }), fout(400, /bekende doelstand/));
  assert.throws(() => vraag({ naar: 9 }), fout(400, /bekende doelstand/));
  assert.throws(() => vraag({ naar: 'isolatie' }), fout(400, /verlaagt niets/));
  assert.throws(() => vraag({ reden: '  kort  ' }), fout(400, /minimaal 8/));
  assert.equal(iso.ontsluiting.open().length, 0, 'geweigerde aanvragen laten geen verzoek achter');

  const v = vraag();
  assert.deepEqual(v.vereisten, ['reden', 'passkey', 'apparaat', 'tweedePaarOgen']);
  const O = iso.ontsluiting;
  assert.throws(() => O.stap('bestaat-niet', { soort: 'passkey' }), fout(404));
  assert.throws(() => O.stap(v.id, { soort: 'raden', door: 'a' }), fout(400, /Onbekende stap/));
  assert.throws(() => O.stap(v.id, { soort: 'wachttijd', door: 'a' }), fout(400, /vraagt geen stap/));
  O.stap(v.id, { soort: 'passkey', door: 'a', bewijs: 'passkey k1' });
  O.stap(v.id, { soort: 'apparaat', door: 'a' });
  O.stap(v.id, { soort: 'tweedePaarOgen', door: 'b' });
  assert.throws(() => iso.voltooiOntsluiting('nee', { door: 'a' }), fout(404));
  const uit = iso.voltooiOntsluiting(v.id, { door: 'a' });
  assert.equal(uit.nieuweStand, 'beperkt');
  assert.equal(iso.standVan('organisatie', 'o'), 'beperkt', 'een verlaging naar een tussenstand blijft een rij');
  assert.equal(meldingen.pop()[0], 'kritiek');
  assert.throws(() => O.stap(v.id, { soort: 'passkey', door: 'a' }), fout(409, /voltooid/));
  assert.throws(() => iso.voltooiOntsluiting(v.id, { door: 'a' }), fout(409));
  assert.throws(() => O.afbreken(v.id, { door: 'a' }), fout(409));
  assert.throws(() => O.afbreken('nee', { door: 'a' }), fout(404));
  const w = vraag({ naar: 'normaal' });
  const af = O.afbreken(w.id, {});
  assert.equal(af.afgebroken.door, 'onbekend');
  assert.deepEqual(af.ontbreekt, [], 'een afgebroken verzoek vraagt niets meer');
  assert.equal(O.vind(w.id).status, 'afgebroken');
  assert.equal(O.vind('nee'), null);
});

test('3. de wachttijd van een identiteit loopt op de klok', () => {
  const { iso } = laag();
  iso.zet({ drager: 'identiteit', sleutel: 'c1', naar: 'isolatie' });
  const v = iso.vraagOntsluiting({ drager: 'identiteit', sleutel: 'c1', naar: 'normaal', door: 'c1',
    reden: 'telefoon terug', passkeyMogelijk: false });
  assert.deepEqual(v.vereisten, ['reden', 'apparaat', 'wachttijd']);
  assert.equal(v.noodontsluiting, true);
  assert.deepEqual(v.noodGronden.map(g => g.grond), ['geenPasskey']);
  assert.throws(() => iso.ontsluiting.stap(v.id, { soort: 'wachttijd', door: 'c1' }), fout(400, /klok/));
  iso.ontsluiting.stap(v.id, { soort: 'apparaat', door: 'c1' });
  t += 9 * 60000;
  assert.throws(() => iso.voltooiOntsluiting(v.id, { door: 'c1' }), fout(409, /wachttijd/));
  t += 60000;
  assert.equal(iso.voltooiOntsluiting(v.id, {}).nieuweStand, 'normaal');
  assert.equal(iso.standVan('identiteit', 'c1'), null, 'terug naar normaal wist de rij');
  assert.equal(iso.overzicht().spoor[0].door, 'onbekend');
});

test('4. een onzekere opslag maakt de laag onleesbaar; kapotte rijen lezen nooit als normaal', () => {
  for (const save of [() => Promise.resolve(), () => { throw new Error('schijf vol'); }]) {
    const { iso } = laag({ save });
    assert.throws(() => iso.zet({ drager: 'sessie', sleutel: 's', naar: 'isolatie' }));
    for (const f of [() => iso.context({ sessie: 's' }), () => iso.standVan('sessie', 's'), () => iso.overzicht(),
      () => iso.besluit({ pad: '/api/x', methode: 'GET', context: {} }), () => iso.controleerOpslag()]) {
      assert.throws(f, (e) => e.code === 'ISOLATIE_OPSLAG_ONZEKER');
    }
  }
  const { iso, db } = laag();
  iso.zet({ drager: 'sessie', sleutel: 's', naar: 'isolatie' });
  db.data.isolatie.sessie.s = { stand: 'half-open' };
  assert.throws(() => iso.standVan('sessie', 's'), /weigeren om hem als normaal te lezen/);
  assert.throws(() => iso.controleerOpslag(), /productiestart weigert/);
  db.data.isolatie.sessie.s = { stand: 'isolatie' };
  db.data.isolatie.spoor.push(null);
  assert.throws(() => iso.controleerOpslag(), /ongeldige rij in spoor/);

  assert.match(laag({ huisStand: () => { throw new Error('kapot'); } }).iso.context().standen.huis, /^onbekend:kapot/);
  assert.equal(laag({ huisStand: null }).iso.context().standen.huis, 'normaal');
  assert.equal(laag({ huisStand: 'isolatie' }).iso.standVan('huis'), 'isolatie');
  const zonderSave = maakIsolatie({ db: { data: {} }, functies, klok });
  assert.equal(zonderSave.zet({ drager: 'apparaat', sleutel: 'a', naar: 'waakzaam' }).richting, 'verstrengd');
});

test('5. de eisen zelf: noodontsluiting draagt beide gronden, het doel bindt verzoek en stap', () => {
  const e = eisenVoor({ drager: 'huis', van: 'isolatie', naar: 'normaal', tweedeMens: false, passkeyMogelijk: false });
  assert.deepEqual(e.eisen, ['reden', 'apparaat']);
  assert.deepEqual(e.gronden.map(g => g.grond), ['geenTweedeMens', 'geenPasskey']);
  assert.match(e.alleenWaarom, /NOODONTSLUITING/);
  const onord = eisenVoor({ drager: 'sessie', van: 'beschermd', naar: 'waakzaam' });
  assert.equal(onord.zeker, false);
  assert.match(onord.waarom, /niet te ordenen/);
  assert.equal(eisenVoor({ drager: 'sessie', van: 'normaal', naar: 'isolatie' }).verlaagt, false);
  assert.equal(doelVoor('v1', 'passkey'), 'isolatie:ontsluiting:v1:passkey');
  assert.equal(doelVoor(), 'isolatie:ontsluiting::');
});
