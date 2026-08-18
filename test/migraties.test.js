/* ============================================================================
   Schemamigraties: genummerd, precies een keer, en met een weigering om te
   starten op een database die nieuwer is dan de code.

   Draai los: node --test test/migraties.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mig-'));
process.env.RTG_DATA_DIR = TMP;

const migraties = require('../server/migraties');
const { MIGRATIES } = require('../server/migraties/lijst');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let teller = 0;
function verseDb() {
  return new DatabaseSync(path.join(TMP, 'proef-' + (++teller) + '.db'));
}
const tabellen = (db) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
const kolommen = (db, tabel) =>
  db.prepare('PRAGMA table_info(' + tabel + ')').all().map(c => c.name);

test('1. een verse database komt op de hoogste versie en heeft alle tabellen', () => {
  const db = verseDb();
  assert.equal(migraties.stand(db), 0, 'nog niets gedraaid');
  const r = migraties.draai(db);
  assert.equal(r.stand, migraties.hoogsteBekend());
  assert.equal(r.gedraaid.length, MIGRATIES.length);
  const t = tabellen(db);
  for (const naam of ['users', 'ingetrokken_tokens', 'supplier_staff', 'sso_koppelingen',
    'sso_identiteiten', 'scim_sleutels', 'schema_versie'])
    assert.ok(t.includes(naam), 'tabel ontbreekt: ' + naam);
  assert.ok(kolommen(db, 'users').includes('actief'), 'migratie 4 heeft gedraaid');
  db.close();
});

test('2. nog een keer draaien doet niets -- geen dubbele regels, geen fout', () => {
  const db = verseDb();
  migraties.draai(db);
  const eerste = migraties.gedraaid(db);
  const r = migraties.draai(db);
  assert.equal(r.gedraaid.length, 0, 'er valt niets meer te doen');
  assert.deepEqual(migraties.gedraaid(db), eerste, 'het grootboek is niet veranderd');
  db.close();
});

test('3. het grootboek zegt WAT er wanneer is gedraaid', () => {
  const db = verseDb();
  migraties.draai(db);
  const rijen = migraties.gedraaid(db);
  assert.equal(rijen.length, MIGRATIES.length);
  assert.deepEqual(rijen.map(r => r.n), MIGRATIES.map(m => m.n).sort((a, b) => a - b));
  for (const r of rijen) {
    assert.ok(r.naam, 'elke regel heeft een naam');
    assert.ok(!Number.isNaN(Date.parse(r.gedraaid_op)), 'en een leesbaar tijdstip');
  }
  db.close();
});

test('4. EEN DATABASE VAN DE TOEKOMST BLOKKEERT DE START', () => {
  /* Dit is het geval waarvoor deze laag bestaat. Rol je de code terug naar
     gisteren, dan draait die op het schema van vandaag: hij schrijft dan in een
     database die hij niet kent. Doorgaan maakt stille schade; stoppen niet. */
  const db = verseDb();
  migraties.draai(db);
  db.prepare('INSERT INTO schema_versie (n, naam, gedraaid_op) VALUES (?, ?, ?)')
    .run(9999, 'uit-de-toekomst', new Date().toISOString());

  assert.throws(() => migraties.controleer(db), /oudere versie van de software/);
  assert.throws(() => migraties.draai(db), /oudere versie van de software/,
    'draai() moet ook weigeren, niet alleen controleer()');
  db.close();
});

test('5. een database die achterloopt is geen fout maar werk', () => {
  const db = verseDb();
  migraties.draai(db);
  /* Doe alsof de LAATSTE migratie nog niet gedraaid was. Hier stond een vaste 4,
     en dat brak zodra er een vijfde bijkwam: het verwijderde nummer was dan niet
     meer de hoogste, dus liep de database helemaal niet achter en zakte de toets
     op iets wat niemand had aangeraakt. Een toets over "de laatste" hoort de
     laatste te vragen, niet een nummer te onthouden. */
  const laatste = migraties.MIGRATIES[migraties.MIGRATIES.length - 1].n;
  db.prepare('DELETE FROM schema_versie WHERE n = ?').run(laatste);
  const c = migraties.controleer(db);
  assert.equal(c.achter, 1);
  const r = migraties.draai(db);
  assert.equal(r.gedraaid.length, 1);
  assert.equal(r.gedraaid[0].n, laatste);
  db.close();
});

test('6. een mislukte migratie wordt teruggedraaid en stopt de rij', () => {
  /* Half doorgaan na een mislukking is hoe je een schema krijgt dat nergens
     meer op lijkt. De transactie moet dus echt terug. */
  const db = verseDb();
  const echte = migraties.MIGRATIES.slice();
  const stuk = { n: 9998, naam: 'gaat-stuk', op: (d) => {
    d.exec('CREATE TABLE halverwege (x INTEGER)');
    throw new Error('opzettelijk stuk');
  } };
  migraties.MIGRATIES.push(stuk);
  try {
    assert.throws(() => migraties.draai(db), /Migratie 9998 \(gaat-stuk\) is mislukt en is teruggedraaid/);
    assert.ok(!tabellen(db).includes('halverwege'), 'wat de migratie al deed, is teruggedraaid');
    assert.ok(!migraties.gedraaid(db).some(r => r.n === 9998), 'en hij staat niet in het grootboek');
    // de migraties ervoor zijn wel blijven staan: die hadden hun eigen transactie
    assert.ok(tabellen(db).includes('users'));
  } finally {
    migraties.MIGRATIES.length = 0;
    for (const m of echte) migraties.MIGRATIES.push(m);
  }
  db.close();
});

test('7. de nummers zijn uniek en de lijst is op volgorde bruikbaar', () => {
  const nummers = MIGRATIES.map(m => m.n);
  assert.equal(new Set(nummers).size, nummers.length, 'geen dubbele nummers');
  for (const m of MIGRATIES) {
    assert.ok(Number.isInteger(m.n) && m.n > 0, 'nummer is een positief geheel getal');
    assert.ok(m.naam && typeof m.naam === 'string', 'migratie ' + m.n + ' heeft een naam');
    assert.equal(typeof m.op, 'function');
  }
});

test('8. een BESTAANDE database van voor deze laag migreert zonder gegevensverlies', () => {
  /* De echte situatie bij het uitrollen: er staat al een database met leden in,
     aangemaakt door de oude inline-DDL. Die moet migratie 1 kunnen "draaien"
     zonder dat er iets gebeurt, en daarna gewoon de nieuwe stappen krijgen. */
  const db = verseDb();
  const { accountsBasis } = require('../server/migraties/lijst');
  accountsBasis(db); // zoals de oude code het deed, zonder grootboek
  db.prepare(`INSERT INTO users (email_hash, username, password_hash, tier, codename, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run('hash1', 'oudlid', 'x:y', 'business', 'Zilveren Valk AB', '2020-01-01T00:00:00Z');
  assert.equal(migraties.stand(db), 0, 'zo\'n database kent nog geen versie');

  const r = migraties.draai(db);
  assert.equal(r.stand, migraties.hoogsteBekend());
  const lid = db.prepare('SELECT * FROM users WHERE username = ?').get('oudlid');
  assert.ok(lid, 'het bestaande lid staat er nog');
  assert.equal(lid.tier, 'business', 'met zijn pas');
  assert.equal(lid.codename, 'Zilveren Valk AB', 'en zijn codenaam');
  assert.equal(lid.actief, 1, 'en de nieuwe kolom staat standaard op actief');
  db.close();
});
