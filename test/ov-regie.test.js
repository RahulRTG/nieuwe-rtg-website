const test = require('node:test');
const assert = require('node:assert/strict');
const maakRegie = require('../server/kern/ov/regie');

function regie() {
  const db = { data: {} }; let saves = 0;
  return { db, api: maakRegie({ db, save: () => { saves += 1; }, schoon: String }), saves: () => saves };
}

test('RTG, Lifestyle en Business Private hebben server-side andere mogelijkheden', () => {
  const { api } = regie();
  const rtg = api.ovRegie('a', 'rtg');
  const life = api.ovRegie('b', 'lifestyle');
  const priv = api.ovRegie('c', 'business');
  assert.equal(rtg.ervaring.modus, 'everyday');
  assert.equal(life.ervaring.modus, 'lifestyle');
  assert.equal(priv.ervaring.modus, 'private');
  assert.equal(rtg.automaten.comfort, undefined);
  assert.ok(life.automaten.comfort);
  assert.ok(priv.automaten.entourage);
});

test('premiumfuncties zijn niet via een vervalst verzoek te activeren', () => {
  const { api, saves } = regie();
  const fout = api.ovRegieZet('a', 'rtg', { automaat: 'entourage', aan: true });
  assert.equal(fout.status, 403);
  assert.equal(saves(), 0);
  const goed = api.ovRegieZet('b', 'business', { automaat: 'entourage', aan: true });
  assert.equal(goed.automaten.entourage.aan, true);
  assert.equal(saves(), 1);
});

test('privacygrens locatie wissen kan niet worden uitgezet', () => {
  const { api, saves } = regie();
  const r = api.ovRegieZet('a', 'business', { privacy: { discreteMeldingen: false, locatieNaRitWissen: false } });
  assert.equal(r.privacy.discreteMeldingen, false);
  assert.equal(r.privacy.locatieNaRitWissen, true);
  assert.equal(saves(), 1);
  const opnieuw = api.ovRegieZet('a', 'business', { privacy: { discreteMeldingen: false, locatieNaRitWissen: false } });
  assert.equal(opnieuw.privacy.discreteMeldingen, false);
  assert.equal(saves(), 1, 'dezelfde gewenste voorkeur wordt niet opnieuw opgeslagen');
});
