'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const maakZicht = require('../server/kern/salon/zichtbaarheid');
const maakWereld = require('../server/kern/wereld/feed');

function omgeving() {
  const db = { data: { posts: [], salon: { verborgen: { lezer: [2] } }, stories: [] } };
  const sess = { key: 'lezer', tier: 'rtg' };
  const zicht = maakZicht({ db, zijnVrienden: () => false });
  const salon = require('../server/kern/salon')({ db, save() {}, media: {}, magLezen: zicht.magLezen });
  const wereld = maakWereld({ db, salonToegang: zicht.magLezen || zicht.magZien });
  const reacties = require('../server/kern/salon/reacties')({ db, save() {}, salon });
  for (let id = 1; id <= 4; id++) db.data.posts.push({ id, authorKey: 'maker', author: 'Maker',
    partner: true, publiek: id === 1 ? 'alleenik' : 'iedereen', text: 'Publicatie',
    onderwerpen: ['geheim' + id], comments: [{ id: 10, text: 'Privé antwoord' }], weg: id === 3,
    archief: id === 4, at: new Date().toISOString() });
  return { db, sess, salon, wereld, reacties };
}

test('de samengestelde wereld sluit verborgen en gemodereerde posts uit', () => {
  const { wereld, sess } = omgeving();
  assert.deepEqual(wereld.feed({ ...sess, modus: 'lifestyle' }).items, []);
});
test('reacties en onderwerpen kunnen de publicatiepoort niet omzeilen', async () => {
  const { reacties, salon, sess } = omgeving();
  assert.ok(reacties.reacties(sess, 1).error);
  assert.ok((await reacties.reageer(sess, 1, 'Ongeoorloofd antwoord')).error);
  assert.deepEqual(salon.onderwerpen(12, sess), []);
});
test('een verlopen verhaal verdwijnt zonder dat eerst de verhaalapp open moet', () => {
  const { db, wereld, sess } = omgeving();
  db.data.stories.push({ id: 'oud', van: sess.key, at: new Date(Date.now() - 86400001).toISOString() });
  assert.deepEqual(wereld.feed({ ...sess, modus: 'prive' }).items, []);
});
