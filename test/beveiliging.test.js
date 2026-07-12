/* Tests voor de beveiligingsmeldingen (server/beveiliging.js): melden,
   samenvoegen, samenvatting, afhandelen en escalatie naar de eigenaar. Zuiver,
   met een nagemaakte db. Draai: node --test test/beveiliging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/beveiliging');

function opzet() {
  const db = { data: {} };
  const meldingen = [];
  const bev = maak({ db, save: () => {}, notifyOwner: (n) => meldingen.push(n) });
  return { db, bev, meldingen };
}

test('beveiliging: een melding komt in de lijst en telt als open', () => {
  const { bev } = opzet();
  bev.meld('tech-login-mislukt', 'waarschuwing', 'Mislukte poging', { bron: '1.2.3.4' });
  const s = bev.samenvatting();
  assert.equal(s.open, 1);
  assert.equal(s.recent[0].type, 'tech-login-mislukt');
  assert.equal(s.recent[0].aantal, 1);
});

test('beveiliging: zelfde soort + bron binnen 2 min telt op i.p.v. nieuwe regel', () => {
  const { bev } = opzet();
  bev.meld('brute-force', 'kritiek', 'poging 1', { bron: 'office:1.2.3.4' });
  bev.meld('brute-force', 'kritiek', 'poging 2', { bron: 'office:1.2.3.4' });
  bev.meld('brute-force', 'kritiek', 'poging 3', { bron: 'office:1.2.3.4' });
  const s = bev.samenvatting();
  assert.equal(s.recent.length, 1, 'samengevoegd tot één regel');
  assert.equal(s.recent[0].aantal, 3);
});

test('beveiliging: andere bron is een aparte regel', () => {
  const { bev } = opzet();
  bev.meld('brute-force', 'kritiek', 'a', { bron: 'x' });
  bev.meld('brute-force', 'kritiek', 'b', { bron: 'y' });
  assert.equal(bev.samenvatting().recent.length, 2);
});

test('beveiliging: kritiek escaleert naar de eigenaar, met een rem per soort', () => {
  const { bev, meldingen } = opzet();
  bev.meld('tech-toegang-geweigerd', 'kritiek', 'iemand morrelt', { bron: 'user:9' });
  bev.meld('tech-toegang-geweigerd', 'kritiek', 'nog een keer', { bron: 'user:9' });
  assert.equal(meldingen.length, 1, 'binnen de rem maar één push/e-mail');
  assert.match(meldingen[0].title, /Beveiligingsalarm/);
});

test('beveiliging: waarschuwing escaleert niet', () => {
  const { bev, meldingen } = opzet();
  bev.meld('tech-login-mislukt', 'waarschuwing', 'x', { bron: 'ip' });
  assert.equal(meldingen.length, 0);
});

test('beveiliging: afhandelen sluit de meldingen en leegt de tellers', () => {
  const { bev } = opzet();
  bev.meld('brute-force', 'kritiek', 'a', { bron: 'x' });
  bev.meld('tech-login-mislukt', 'waarschuwing', 'b', { bron: 'y' });
  assert.equal(bev.openTotaal(), 2);
  assert.equal(bev.openKritiek(), 1);
  const n = bev.handelAf(); // alles
  assert.equal(n, 2);
  assert.equal(bev.openTotaal(), 0);
  assert.equal(bev.openKritiek(), 0);
  // de meldingen blijven zichtbaar als audit-spoor, maar gemarkeerd
  assert.equal(bev.samenvatting().recent.every(m => m.afgehandeld), true);
});

test('beveiliging: één melding gericht afhandelen laat de rest open', () => {
  const { bev } = opzet();
  const a = bev.meld('brute-force', 'kritiek', 'a', { bron: 'x' });
  bev.meld('tech-login-mislukt', 'waarschuwing', 'b', { bron: 'y' });
  assert.equal(bev.handelAf(a.id), 1);
  assert.equal(bev.openTotaal(), 1);
});

/* ---------- de automatische noodrem ---------- */
const zekering = (db, id) => (db.data.techniek.zekeringen || {})[id] || { aan: true };

test('noodrem: brute force vanaf 3 bronnen laat de registratie-zekering springen', () => {
  const { db, bev } = opzet();
  bev.meld('brute-force', 'kritiek', 'a', { bron: 'ip1' });
  bev.meld('brute-force', 'kritiek', 'b', { bron: 'ip2' });
  assert.notEqual(zekering(db, 'registratie').aan, false, 'onder de drempel gebeurt er niets');
  bev.meld('brute-force', 'kritiek', 'c', { bron: 'ip3' });
  assert.equal(zekering(db, 'registratie').aan, false, 'derde bron: registratie eraf');
  assert.match(zekering(db, 'registratie').reden, /noodrem/);
  assert.notEqual(zekering(db, 'onderhoud').aan, false, 'de onderhoudsstand blijft nog aan');
  // en er staat een eigen kritieke melding over de ingreep op het bord
  assert.ok(bev.samenvatting().recent.some(m => m.type === 'auto-reactie'));
});

test('noodrem: vanaf 6 bronnen gaat ook de onderhouds-zekering eruit', () => {
  const { db, bev } = opzet();
  for (let i = 1; i <= 6; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'ip' + i });
  assert.equal(zekering(db, 'registratie').aan, false);
  assert.equal(zekering(db, 'onderhoud').aan, false, 'brede aanval: hele app op slot');
});

test('noodrem: uitgezet door de eigenaar -> er springt niets', () => {
  const { db, bev } = opzet();
  bev.zetAuto(false);
  for (let i = 1; i <= 6; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'ip' + i });
  assert.notEqual(zekering(db, 'registratie').aan, false);
  assert.notEqual(zekering(db, 'onderhoud').aan, false);
  assert.equal(bev.autoAan(), false);
  bev.zetAuto(true);
  assert.equal(bev.autoAan(), true);
});

test('noodrem: springt niet dubbel en de melding erover escaleert naar de eigenaar', () => {
  const { bev, meldingen } = opzet();
  for (let i = 1; i <= 4; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'ip' + i });
  const ingrepen = bev.samenvatting().recent.filter(m => m.type === 'auto-reactie');
  assert.equal(ingrepen.length, 1, 'de registratie-zekering springt maar één keer');
  assert.ok(meldingen.some(n => /noodrem/i.test(n.body)), 'de eigenaar hoort van de ingreep');
});
