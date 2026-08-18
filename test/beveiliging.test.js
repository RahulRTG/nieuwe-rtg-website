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

test('noodrem: EEN aanvaller met zes deuren telt als EEN bron', () => {
  /* Dit was de fout die het hele platform kon sluiten. De noodrem telde de
     BUCKET van de snelheidsrem, en die is fijnmazig met opzet:
     'auth:<ip>:<inlognaam>'. Een script vanaf een adres dat zes namen probeert
     -- credential stuffing -- leverde daarmee zes "bronnen" op.

     Zes meldingen, zes verschillende buckets, EEN aanvaller. Er hoort niets te
     springen: niet de onderhoudsstand en ook niet de registratie. */
  const { db, bev } = opzet();
  for (const naam of ['aap', 'noot', 'mies', 'wim', 'zus', 'jet']) {
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'auth:10.0.0.9:' + naam, aanvaller: '10.0.0.9' });
  }
  assert.notEqual(zekering(db, 'onderhoud').aan, false, 'een enkele aanvaller sluit het huis niet');
  assert.notEqual(zekering(db, 'registratie').aan, false, 'en zet de registratie ook niet dicht');

  /* TEGENPROEF in hetzelfde huis: zes ECHTE aanvallers, met dezelfde zes
     buckets, doen het wel. Zonder deze helft zou "er springt niets" ook waar
     zijn als de noodrem helemaal stuk is. */
  for (let i = 1; i <= 6; i++) {
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'auth:203.0.113.' + i + ':aap', aanvaller: '203.0.113.' + i });
  }
  assert.equal(zekering(db, 'onderhoud').aan, false, 'zes verdeelde bronnen horen de app wel op slot te zetten');
});

test('noodrem: zonder aanvaller valt hij terug op de oude, schrikachtige maat', () => {
  /* Een aanroep die de bron vergeet mag niet STIL minder gaan tellen -- dan zou
     een vergeten regel de noodrem uitschakelen zonder dat iemand het merkt.
     Hij valt dus terug op de sleutel: te schrikachtig, maar nooit blind.
     server/server.js zegt er hoorbaar bij dat het gebeurde. */
  const { db, bev } = opzet();
  for (let i = 1; i <= 6; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'deur' + i });
  assert.equal(zekering(db, 'onderhoud').aan, false, 'zonder bron telt elke deur nog als aparte bron');
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
