'use strict';
/* GENOOTSCHAP (server/kern/genootschap/index.js) met een db in het geheugen:
   oprichten, aanpassen (alleen beslotener), uitnodigen, binnentreden,
   vertrekken, mijn overzicht en zoeken -- elke weigering met haar eigen zin.
   Geheim blijft geheim: wie er niet in zit, vindt het niet. Alles op codenaam. */
const test = require('node:test');
const assert = require('node:assert/strict');

const TELEFOON = 'bel 0612345678';
function wereld(o = {}) {
  const db = { data: {} };
  const meldingen = [];
  let saves = 0;
  const g = require('../server/kern/genootschap')({
    db, save() { saves++; }, codenaamVan: (k) => 'cn-' + k,
    keyVanCodenaam: o.zonderZoeker ? undefined : async (c) => {
      if (c === 'cn-stuk') throw new Error('kluis dicht');
      if (c === 'cn-onbekend') return null;
      return { key: String(c).replace(/^cn-/, '') };
    },
    notify: o.zonderMelder ? undefined : (k, m) => { if (o.melderGooit) throw new Error('weg'); meldingen.push({ k, m }); },
    toelating: o.toelating
  });
  return { db, g, meldingen, saves: () => saves };
}
const sess = (key) => ({ key });

test('oprichten: naam verplicht, gekeurde teksten, en een onbekende soort wordt besloten', () => {
  const { g, saves } = wereld();
  assert.equal(g.richtOp(sess('a'), null).error, 'Hoe heet het genootschap?');
  assert.equal(g.richtOp(sess('a'), { naam: '   ' }).error, 'Hoe heet het genootschap?');
  assert.match(g.richtOp(sess('a'), { naam: TELEFOON }).error, /telefoonnummers/);
  assert.match(g.richtOp(sess('a'), { naam: 'Lezers', over: TELEFOON }).error, /telefoonnummers/);
  assert.match(g.richtOp(sess('a'), { naam: 'Lezers', regels: TELEFOON }).error, /telefoonnummers/);
  assert.equal(saves(), 0);
  const r = g.richtOp(sess('a'), { naam: 'x'.repeat(100), soort: 'raar', over: ' Over boeken ', regels: 'Wees aardig' });
  assert.equal(r.ok, true);
  assert.equal(r.groep.naam.length, 70);
  assert.equal(r.groep.soort, 'besloten');
  assert.equal(r.groep.over, 'Over boeken');
  assert.equal(r.groep.mijnRol, 'beheerder');
  assert.deepEqual(r.groep.ledenlijst, [{ codenaam: 'cn-a', rol: 'beheerder', sinds: r.groep.ledenlijst[0].sinds, ikZelf: true }]);
  assert.equal(r.groep.drager, null);
  const kaal = g.richtOp(sess('a'), { naam: 'Kaal', soort: 'openbaar' });
  assert.equal(kaal.groep.over, '');
  assert.equal(kaal.groep.regels, '');
  assert.notEqual(kaal.groep.id, r.groep.id, 'twee groepen krijgen elk een eigen id');
  assert.equal(saves(), 2);
});

test('een lid zit in hoogstens zestig genootschappen', () => {
  const { g } = wereld();
  for (let i = 0; i < 60; i++) assert.equal(g.richtOp(sess('a'), { naam: 'G' + i }).ok, true);
  assert.equal(g.richtOp(sess('a'), { naam: 'Te veel' }).error, 'Je zit in het maximum aantal genootschappen.');
  assert.equal(g.mijne('a').length, 60);
});

test('aanpassen: alleen een beheerder, naam blijft verplicht, teksten gekeurd, en alleen beslotener', () => {
  const { g } = wereld();
  const id = g.richtOp(sess('a'), { naam: 'Club', soort: 'openbaar' }).groep.id;
  assert.equal(g.pasAan(sess('a'), 999, {}).error, 'Dit genootschap bestaat niet.');
  assert.equal(g.pasAan(sess('b'), id, { naam: 'X' }).error, 'Alleen een beheerder past dit aan.');
  assert.equal(g.pasAan(sess('a'), id, { naam: '' }).error, 'Een genootschap zonder naam kan niet.');
  assert.match(g.pasAan(sess('a'), id, { over: TELEFOON }).error, /telefoonnummers/);
  const r = g.pasAan(sess('a'), id, { over: '', regels: 'Nieuwe regels', soort: 'besloten' });
  assert.equal(r.ok, true);
  assert.equal(r.groep.over, '');
  assert.equal(r.groep.regels, 'Nieuwe regels');
  assert.equal(r.groep.soort, 'besloten');
  assert.match(g.pasAan(sess('a'), id, { soort: 'openbaar' }).error, /alleen beslotener worden/);
  /* een onbekende soort wordt genegeerd */
  assert.equal(g.pasAan(sess('a'), id, { soort: 'raar' }).groep.soort, 'besloten');
  assert.equal(g.pasAan(sess('a'), id, { soort: 'geheim' }).groep.soort, 'geheim');
  /* een groep met een onbekende opgeslagen soort telt als besloten */
  g.groepMet(id).soort = 'verzonnen';
  assert.match(g.pasAan(sess('a'), id, { soort: 'openbaar' }).error, /alleen beslotener/);
  assert.equal(g.pasAan(sess('a'), id, { soort: 'besloten' }).groep.soort, 'besloten');
  assert.equal(g.pasAan(sess('a'), id, null).ok, true);
});

test('uitnodigen: lid en beheerder vereist, een bekende codenaam, en de melding', async () => {
  const { g, meldingen } = wereld();
  const id = g.richtOp(sess('a'), { naam: 'Besloten club' }).groep.id;
  assert.equal((await g.nodigUit(sess('a'), 999, 'cn-b')).error, 'Dit genootschap bestaat niet.');
  assert.equal((await g.nodigUit(sess('z'), id, 'cn-b')).error, 'Je bent hier geen lid van.');
  assert.equal((await g.nodigUit(sess('a'), id, '')).error, 'Dit lid ken ik niet.');
  assert.equal((await g.nodigUit(sess('a'), id, 'cn-onbekend')).error, 'Dit lid ken ik niet.');
  assert.equal((await g.nodigUit(sess('a'), id, 'cn-stuk')).error, 'Dit lid ken ik niet.');
  assert.equal((await g.nodigUit(sess('a'), id, 'cn-a')).error, 'Dit lid zit er al in.');
  const r = await g.nodigUit(sess('a'), id, ' cn-b ');
  assert.deepEqual(r, { ok: true, uitgenodigd: 'cn-b' });
  await g.nodigUit(sess('a'), id, 'cn-b');
  assert.deepEqual(g.groepMet(id).uitnodigingen, ['b'], 'twee keer uitnodigen is een naam op de lijst');
  assert.equal(meldingen.length, 2);
  assert.match(meldingen[0].m.body, /Besloten club/);
  /* b zit er nog niet in en is geen beheerder */
  assert.equal(g.tredBinnen(sess('b'), id).ok, true);
  assert.equal((await g.nodigUit(sess('b'), id, 'cn-c')).error, 'In dit genootschap nodigt een beheerder uit.');
});

test('uitnodigen in een openbaar genootschap mag elk lid, ook zonder melder of met een melder die faalt', async () => {
  for (const o of [{ zonderMelder: true }, { melderGooit: true }]) {
    const { g } = wereld(o);
    const id = g.richtOp(sess('a'), { naam: 'Open', soort: 'openbaar' }).groep.id;
    g.tredBinnen(sess('b'), id);
    const r = await g.nodigUit(sess('b'), id, 'cn-c');
    assert.equal(r.ok, true);
    assert.deepEqual(g.groepMet(id).uitnodigingen, ['c'], 'de uitnodiging staat, ook als de melding niet aankomt');
  }
});

test('zonder codenaamzoeker is niemand uit te nodigen', async () => {
  const { g } = wereld({ zonderZoeker: true });
  const id = g.richtOp(sess('a'), { naam: 'Club' }).groep.id;
  assert.equal((await g.nodigUit(sess('a'), id, 'cn-b')).error, 'Dit lid ken ik niet.');
});

test('de toelating weigert met haar eigen zin, bij uitnodigen en bij binnentreden', async () => {
  const gezien = [];
  const toelating = (gr, key, ander) => { gezien.push([key, !!ander]); return key === 'kind' ? 'Minderjarigen komen hier niet in.' : null; };
  const { g } = wereld({ toelating });
  const id = g.richtOp(sess('a'), { naam: 'Gedragen', soort: 'openbaar' }).groep.id;
  assert.equal((await g.nodigUit(sess('a'), id, 'cn-kind')).error, 'Minderjarigen komen hier niet in.');
  assert.equal(g.tredBinnen(sess('kind'), id).error, 'Minderjarigen komen hier niet in.');
  assert.deepEqual(gezien, [['kind', true], ['kind', false]]);
  assert.equal(g.tredBinnen(sess('b'), id).ok, true);
});

test('binnentreden: op uitnodiging, al lid, en vol is vol', async () => {
  const { g } = wereld();
  const id = g.richtOp(sess('a'), { naam: 'Club' }).groep.id;
  assert.equal(g.tredBinnen(sess('b'), 999).error, 'Dit genootschap bestaat niet.');
  assert.equal(g.tredBinnen(sess('b'), id).error, 'Dit genootschap is op uitnodiging.');
  assert.deepEqual(g.tredBinnen(sess('a'), id), { ok: true, al: true });
  await g.nodigUit(sess('a'), id, 'cn-b');
  assert.equal(g.groepMet(id).uitnodigingen.length, 1);
  const r = g.tredBinnen(sess('b'), id);
  assert.equal(r.groep.ikBenLid, true);
  assert.equal(r.groep.mijnRol, 'lid');
  assert.equal(g.groepMet(id).uitnodigingen.length, 0, 'de uitnodiging is ingelost');
  const gr = g.groepMet(id);
  gr.soort = 'openbaar';
  while (gr.leden.length < g.MAX_LEDEN) gr.leden.push({ key: 'v' + gr.leden.length, rol: 'lid' });
  assert.equal(g.tredBinnen(sess('nieuw'), id).error, 'Dit genootschap is vol.');
  assert.equal((await g.nodigUit(sess('a'), id, 'cn-nieuw')).error, 'Dit genootschap is vol.');
});

test('vertrekken: de enige beheerder blijft tot er een ander is, en de laatste ruimt de groep op', () => {
  const { g } = wereld();
  const id = g.richtOp(sess('a'), { naam: 'Open', soort: 'openbaar' }).groep.id;
  assert.equal(g.vertrek(sess('a'), 999).error, 'Dit genootschap bestaat niet.');
  assert.equal(g.vertrek(sess('z'), id).error, 'Je bent hier geen lid van.');
  g.tredBinnen(sess('b'), id);
  assert.match(g.vertrek(sess('a'), id).error, /enige beheerder/);
  assert.equal(g.vertrek(sess('b'), id).ok, true);
  assert.equal(g.groepMet(id).leden.length, 1);
  g.S().prikbord[id] = [{ tekst: 'hallo' }];
  g.S().bijeenkomst[id] = [{ wat: 'borrel' }];
  assert.equal(g.vertrek(sess('a'), id).ok, true);
  assert.equal(g.groepMet(id), null);
  assert.equal(g.S().prikbord[id], undefined);
  assert.equal(g.S().bijeenkomst[id], undefined);
});

test('mijn overzicht: mijn groepen en wat er voor mij klaarligt, zonder ledenlijst voor een niet-lid', async () => {
  const { g } = wereld();
  const id = g.richtOp(sess('a'), { naam: 'Club' }).groep.id;
  g.richtOp(sess('c'), { naam: 'Ander' });
  await g.nodigUit(sess('a'), id, 'cn-b');
  const b = g.mijn(sess('b'));
  assert.equal(b.groepen.length, 0);
  assert.equal(b.uitnodigingen.length, 1);
  assert.equal(b.uitnodigingen[0].uitgenodigd, true);
  assert.deepEqual(b.uitnodigingen[0].ledenlijst, []);
  const a = g.mijn(sess('a'));
  assert.equal(a.groepen.length, 1);
  assert.equal(a.groepen[0].ledenlijst.length, 1);
  assert.equal(a.groepen[0].uitgenodigd, false);
  /* een drager toont alleen soort en stand */
  g.groepMet(id).draagOrg = { soort: 'stichting', stand: 'erkend', geheim: 'x' };
  assert.deepEqual(g.publiek(g.groepMet(id), 'a').drager, { soort: 'stichting', stand: 'erkend' });
});

test('zoeken: geheim alleen voor leden, filter op naam en over, en hoogstens veertig', () => {
  const { g } = wereld();
  g.richtOp(sess('a'), { naam: 'Geheime kring', soort: 'geheim' });
  g.richtOp(sess('a'), { naam: 'Wijnclub', soort: 'besloten', over: 'Bourgogne en meer' });
  g.richtOp(sess('a'), { naam: 'Leesclub', soort: 'openbaar' });
  const buiten = g.zoek(sess('b'), null);
  assert.deepEqual(buiten.groepen.map(x => x.naam).sort(), ['Leesclub', 'Wijnclub']);
  assert.ok(!buiten.groepen.some(x => x.soort === 'geheim'));
  assert.equal(g.zoek(sess('a'), {}).groepen.length, 3);
  assert.deepEqual(g.zoek(sess('b'), { zoek: '  BOURGOGNE ' }).groepen.map(x => x.naam), ['Wijnclub']);
  assert.equal(g.zoek(sess('b'), { zoek: 'geheime' }).groepen.length, 0);
  assert.equal(g.zoek(sess('a'), { zoek: 'geheime' }).groepen.length, 1);
  for (let i = 0; i < 45; i++) g.richtOp(sess('c'), { naam: 'Kring ' + i, soort: 'openbaar' });
  assert.equal(g.zoek(sess('b'), {}).groepen.length, 40);
});

test('een opslag met kapotte vorm wordt hersteld bij het lezen', () => {
  const { g, db } = wereld();
  g.S();
  db.data.genootschap.groepen = 'kapot';
  db.data.genootschap.prikbord = null;
  db.data.genootschap.bijeenkomst = 5;
  const s = g.S();
  assert.ok(Array.isArray(s.groepen));
  assert.deepEqual(s.prikbord, {});
  assert.deepEqual(s.bijeenkomst, {});
  assert.deepEqual(g.SOORTEN, ['openbaar', 'besloten', 'geheim']);
  assert.equal(g.isBeheer({}, 'a'), false, 'een groep zonder ledenlijst heeft geen beheerder');
  assert.equal(g.isLid({ leden: [{ key: 'a', rol: 'lid' }] }, 'a'), true);
});
