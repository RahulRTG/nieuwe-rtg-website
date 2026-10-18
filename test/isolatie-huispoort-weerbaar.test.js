/* DE HUISPOORT EN HET STAPBEWIJS -- een ceremonie dekt precies EEN overgang.

   server/kern/isolatie/huisceremonie.js is de poort die de incidentcontrole
   meekrijgt om het platform te ontsluiten; stapbewijs.js bindt een passkey-
   ceremonie aan verzoek en stap; sessiedragers.js vertaalt een verzoek naar
   sleutels; opslag.js weigert een beschadigd register als leeg te lezen.

   Wat hier niet mag sneuvelen:
   1. Zonder ceremonie, met een onbekende, met een ceremonie voor een andere
      drager of een andere overgang: de poort gooit (400/404/403/409).
   2. Een voltooide ceremonie wordt EEN keer gebruikt; een tweede verlaging met
      hetzelfde nummer is 409. Een noodontsluiting meldt zich als kritiek.
   3. Het stapbewijs weigert een stap die het verzoek niet vraagt of geen bewijs
      vraagt VOOR er crypto draait, eist een eigen account, en een mislukte
      verificatie levert nooit een aftekening op.
   4. Zonder centrale sessieoplosser gooit het oplossen van een token luid in
      plaats van "geen identiteit" te raden.
   5. Een opslagwortel of tak met de verkeerde vorm leest nooit als leeg.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - huisceremonie.js: de `v.drager !== 'huis'`-regel weg -> toets 1 zakt.
   - huisceremonie.js: de `van`-vergelijking weg -> toets 1 zakt.
   - stapbewijs.js controleer(): `!r.ok` uit de voorwaarde -> toets 3 zakt.

   Draai los: node --test test/isolatie-huispoort-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const functies = require('../server/functies');
const maakIsolatie = require('../server/kern/isolatie');
const maakStapbewijs = require('../server/kern/isolatie/stapbewijs');
const sessiedragers = require('../server/kern/isolatie/sessiedragers');
const maakOpslag = require('../server/kern/isolatie/opslag');

const fout = (status, tekst) => (e) => e.status === status && (!tekst || tekst.test(e.message));
function laag() {
  const meldingen = [];
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'isolatie',
    beveilig: { meld: (bron, ernst, tekst) => meldingen.push([ernst, tekst]) } });
  return { iso, meldingen };
}
function rond(iso, v, tweede) {
  for (const soort of v.vereisten.filter(s => s !== 'reden')) {
    iso.ontsluiting.stap(v.id, { soort, door: soort === 'tweedePaarOgen' ? tweede : v.aangevraagdDoor });
  }
}

test('1. de poort weigert zonder, met onbekende, vreemde of verkeerde ceremonie', () => {
  const { iso } = laag();
  const P = iso.huisCeremoniePoort;
  assert.throws(() => P({}), fout(400, /voltooide ontsluitceremonie/));
  assert.throws(() => P({ id: 'onbekend' }), fout(404));
  iso.zet({ drager: 'sessie', sleutel: 's', naar: 'isolatie' });
  const sessie = iso.vraagOntsluiting({ drager: 'sessie', sleutel: 's', naar: 'normaal', door: 'u-1',
    reden: 'mijn eigen sessie', passkeyMogelijk: false });
  rond(iso, sessie);
  assert.throws(() => P({ id: sessie.id }), fout(403, /sessie/), 'een sessieceremonie ontsluit het platform niet');

  const v = iso.vraagHuisOntsluiting({ door: 'user-1', reden: 'vals alarm voorbij', tweedeMens: true });
  assert.equal(v.van, 'isolatie');
  assert.equal(v.naar, 'normaal');
  rond(iso, v, 'user-2');
  assert.throws(() => P({ id: v.id, naar: 'waakzaam' }), fout(409, /aangevraagd voor/));
  assert.throws(() => P({ id: v.id, van: 'beperkt', naar: 'normaal' }), fout(409, /nu in "beperkt"/));
  assert.equal(iso.ontsluiting.vind(v.id).status, 'open', 'een geweigerde poging verbruikt de ceremonie niet');
});

test('2. een voltooide ceremonie dekt een keer; nood meldt zich als kritiek', () => {
  const { iso, meldingen } = laag();
  const v = iso.vraagHuisOntsluiting({ door: 'user-1', reden: 'vals alarm voorbij', tweedeMens: true });
  rond(iso, v, 'user-2');
  const uit = iso.huisCeremoniePoort({ id: v.id, actor: { id: 7 }, van: 'isolatie', naar: 'normaal' });
  assert.equal(uit.voltooidDoor, 'user-7');
  assert.equal(uit.noodontsluiting, false);
  assert.equal(uit.noodWaarom, null);
  assert.equal(meldingen.pop()[0], 'waarschuwing');
  assert.equal(iso.overzicht().spoor[0].richting, 'verlaagd');
  assert.throws(() => iso.huisCeremoniePoort({ id: v.id, van: 'isolatie', naar: 'normaal' }), fout(409));

  const nood = iso.vraagHuisOntsluiting({ van: 'beperkt', naar: 'waakzaam', door: 'user-1',
    reden: 'alleen eigenaar over', tweedeMens: false, passkeyMogelijk: false });
  rond(iso, nood);
  const n = iso.huisCeremoniePoort({ id: nood.id });
  assert.equal(n.voltooidDoor, 'eigenaar');
  assert.equal(n.noodontsluiting, true);
  assert.match(n.noodWaarom, /niemand met de bevoegdheid/);
  const [ernst, tekst] = meldingen.pop();
  assert.equal(ernst, 'kritiek');
  assert.match(tekst, /NOODONTSLUITING/);
  assert.equal(iso.overzicht().spoor[0].richting, 'verlaagd-nood');
});

test('3. het stapbewijs: eerst of de stap erbij hoort, dan wie, dan pas de crypto', async () => {
  const roepen = [];
  let antwoord = { status: 200, ok: true, credentialId: 'cred-1' };
  const sb = maakStapbewijs({
    stapOpOpties: async (u, h, doel) => { roepen.push(doel); return { status: 200 }; },
    stapOpMaak: async (u, c, a, o, h, doel) => { roepen.push(doel); return antwoord; }
  });
  const verzoek = { id: 'v9', vereisten: ['reden', 'passkey', 'apparaat'] };
  const user = { id: 3 };
  await assert.rejects(sb.opties({ user, verzoek, soort: 'tweedePaarOgen' }), fout(400, /vraagt geen stap/));
  await assert.rejects(sb.opties({ user, verzoek: null, soort: 'passkey' }), fout(400));
  await assert.rejects(sb.opties({ user, verzoek, soort: 'apparaat' }), fout(400, /geen register van vertrouwde toestellen/));
  await assert.rejects(sb.opties({ user, verzoek, soort: 'reden' }), fout(400, /door de aanvrager zelf geleverd/));
  await assert.rejects(sb.opties({ user: null, verzoek, soort: 'passkey' }), fout(403));
  await assert.rejects(sb.controleer({ user: null, verzoek, soort: 'passkey' }), fout(403));
  assert.deepEqual(roepen, [], 'geen enkele weigering raakte de crypto');

  await sb.opties({ user, verzoek, soort: 'passkey' });
  assert.equal(await sb.controleer({ user, verzoek, soort: 'passkey' }), 'passkey cred-1');
  assert.deepEqual(roepen, ['isolatie:ontsluiting:v9:passkey', 'isolatie:ontsluiting:v9:passkey']);
  for (const [r, status] of [[{ status: 200, ok: false }, 200], [{ status: 403, error: 'ander doel' }, 403], [null, 401]]) {
    antwoord = r;
    await assert.rejects(sb.controleer({ user, verzoek, soort: 'passkey' }), (e) => e.status === status);
  }
  antwoord = { status: 200, ok: true };
  assert.equal(await sb.controleer({ user, verzoek, soort: 'passkey' }), 'passkey onbekend');
  assert.equal(sb.vraagtBewijs('passkey'), true);
  assert.equal(sb.vraagtBewijs('wachttijd'), false, 'uitgevoerd door de klok is geen sleutelbewijs');
});

test('4. zonder centrale sessieoplosser gooit het oplossen luid', () => {
  assert.equal(sessiedragers.sessieOplosserGereed(), false, "in dit proces is er geen gemonteerd");
  try {
    sessiedragers.zetSessieOplosser(null);
    assert.equal(sessiedragers.losSessie(''), null);
    assert.throws(() => sessiedragers.losSessie('tok'), /niet gemonteerd/);
    assert.throws(() => sessiedragers.dragersVanVerzoek({ get: () => 'Bearer tok' }), /niet gemonteerd/);
    const leeg = sessiedragers.dragersVanVerzoek({ get: () => 'Basic x' });
    assert.deepEqual(leeg.sleutels, { identiteit: null, sessie: null, apparaat: null, organisatie: null });
    assert.match(leeg.ontbreekt.sessie, /bearer/);
    sessiedragers.zetSessieOplosser(() => null);
    const zonder = sessiedragers.dragersVanVerzoek({ get: () => 'Bearer tok' });
    assert.equal(zonder.sleutels.identiteit, null, 'een onbekend token is geen identiteit');
    assert.ok(zonder.sleutels.sessie, 'maar wel deze sessie');
  } finally { sessiedragers.zetSessieOplosser(null); }
});

test('5. een register met de verkeerde vorm leest nooit als leeg', () => {
  assert.throws(() => maakOpslag({ db: {} }), /zonder db.data/);
  const db = { data: { isolatie: [] } };
  const o = maakOpslag({ db });
  assert.throws(() => o.leesTak('sessie'), /wortel is geen kaart/);
  assert.throws(() => o.tak('sessie'), /wortel is geen kaart/);
  db.data.isolatie = { sessie: [], spoor: {} };
  assert.throws(() => o.tak('sessie'), /geen kaart/);
  assert.throws(() => o.leesTak('spoor'), /geen lijst/);
  assert.throws(() => o.tak('geheim'), /niet in het register/);
  assert.throws(() => o.zetTak('spoor', {}), /hoort een lijst/);
  assert.deepEqual(o.zetTak('spoor', []), []);
  assert.deepEqual(o.leesTak('apparaat'), {}, 'alleen AFWEZIG leest als leeg');
});
