'use strict';
/* GARANTIE 3 (release-fase): duurzame auditrijen in PostgreSQL met een anker
   buiten de database. Elke toets draait tegen een ECHTE PostgreSQL in een eigen
   wegwerpdatabase; de aanvallen zijn echte SQL-aanvallen van iemand die de
   database beheert (triggers uit, regels herschrijven, de keten opnieuw
   uitrekenen). Zonder DATABASE_URL slaat dit bestand zichzelf over, net als de
   andere *-pg-toetsen -- CI draait hem met een postgres-service. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BRON = process.env.DATABASE_URL || process.env.PG_URL;
/* Dit bestand staat in scripts/lib/pg-toetslijst.js en draait in de PostgreSQL-draaier
   (npm run test:pg), die DATABASE_URL altijd zet. Een ontbrekende database is hier een
   FOUT en geen overslaan: een toets die zichzelf overslaat bewijst niets. */
assert.ok(BRON, 'DATABASE_URL ontbreekt: draai dit via npm run test:pg');
const DAG = 24 * 3600 * 1000;

const { Pool } = require('../server/pgwire');
const maakDb = require('./lib/living-world-pg-database');
const schema = require('../server/kern/auditboek/schema');
const { maak } = require('../server/kern/auditboek');
const { geheugenSink, mapSink } = require('../server/kern/auditboek/ankersink');
const anker = require('../server/kern/auditboek/anker');
const { hashRegel } = require('../server/kern/auditboek/regel');

const sleutel = () => { const k = crypto.generateKeyPairSync('ed25519'); return { prive: k.privateKey, publiek: k.publicKey }; };
const ACTOR = { soort: 'lid', ref: 'amberen-vos' };
const ev = (extra = {}) => ({ type: 'kritiek.toegestaan', uitkomst: 'toegestaan', actor: ACTOR,
  context: { methode: 'POST', pad: '/api/pay/overboeking' }, ...extra });

let db, pool, aanvaller, sl;
/* Elke toets krijgt een LEGE boekstand: dezelfde database, schone tabellen. */
async function leeg() {
  await aanvaller.query('ALTER TABLE auditboek DISABLE TRIGGER USER; ALTER TABLE auditboek_checkpoint DISABLE TRIGGER USER; ALTER TABLE auditboek_anker DISABLE TRIGGER USER; ALTER TABLE auditboek_meta DISABLE TRIGGER USER');
  await aanvaller.query('DELETE FROM auditboek; DELETE FROM auditboek_checkpoint; DELETE FROM auditboek_anker; DELETE FROM auditboek_meta');
  await aanvaller.query('ALTER TABLE auditboek ENABLE TRIGGER USER; ALTER TABLE auditboek_checkpoint ENABLE TRIGGER USER; ALTER TABLE auditboek_anker ENABLE TRIGGER USER; ALTER TABLE auditboek_meta ENABLE TRIGGER USER');
}
function boek(extra = {}) {
  const sinks = extra.sinks || [geheugenSink('a'), geheugenSink('b')];
  return { sinks, b: maak({ pool, sinks, sleutels: sl, env: { NODE_ENV: 'test' }, ...extra }) };
}
async function vul(b, n, nu0) {
  for (let i = 0; i < n; i++) await b.noteer(ev({ context: { methode: 'POST', pad: '/api/pay/overboeking/' + i } }), nu0 ? { nu: nu0 + i * 1000 } : undefined);
}
const codes = u => u.bevindingen.map(x => x.code);

test.before(async () => {
  db = await maakDb(BRON);
  pool = new Pool({ connectionString: db.url, max: 4 });
  aanvaller = new Pool({ connectionString: db.url, max: 2 });
  await schema.init(pool);
  sl = sleutel();
});
test.after(async () => { await pool.end(); await aanvaller.end(); await db.close(); });
test.beforeEach(async () => { await leeg(); });

test('1. init is idempotent en de boek-id blijft gelijk', async () => {
  const a = await schema.init(pool), b = await schema.init(pool);
  assert.equal(a.boekId, b.boekId);
});

test('2. regels vormen een keten met volledige SHA-256, en een verse verankering verifieert', async () => {
  const { b, sinks } = boek();
  await vul(b, 5);
  const r = await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: (await b.klaar()), minSinks: 2 });
  assert.equal(r.gelukt, 2);
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, true, JSON.stringify(u.bevindingen));
  assert.equal(u.stats.regels, 5); assert.equal(u.stats.laatsteAnkerNr, 1);
  const rij = (await pool.query('SELECT hash, vorige FROM auditboek ORDER BY nr')).rows;
  assert.ok(rij.every(x => /^[a-f0-9]{64}$/.test(x.hash)), 'volle SHA-256');
  for (let i = 1; i < rij.length; i++) assert.equal(rij[i].vorige, rij[i - 1].hash);
});

test('3. de catalogus weigert onbekende types, vrije tekst, geheimen, e-mailadressen en querystrings -- en er komt niets in de tabel', async () => {
  const { b } = boek();
  const slecht = [
    ev({ type: 'iets.verzonnen' }),
    ev({ actor: { soort: 'lid', ref: 'iemand@voorbeeld.nl' } }),
    ev({ context: { methode: 'POST', pad: '/api/pay/x?token=geheim' } }),
    ev({ context: { methode: 'POST', pad: '/api/pay/x', wachtwoord: 'hunter2' } }),
    ev({ context: { methode: 'POST', pad: '/api/pay/x', status: 'Bearer eyJhbGciOiJIUzI1NiJ9.x.y' } }),
    ev({ type: 'beheer.config.gewijzigd', context: { instelling: 'RTG_SECRET', waardeSha256: '-----BEGIN PRIVATE KEY-----' } }),
    ev({ uitkomst: 'wel-uitgevoerd-ofzo' }),
    ev({ correlatie: 'spatie in correlatie' })
  ];
  for (const s of slecht) await assert.rejects(b.noteer(s), e => e.code === 'AUDIT_ONGELDIG', JSON.stringify(s).slice(0, 80));
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM auditboek')).rows[0].n), 0);
});

test('4. een wijziging, verwijdering of truncate door de applicatie wordt door de database zelf geweigerd', async () => {
  const { b, sinks } = boek();
  await vul(b, 3);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: await b.klaar(), minSinks: 2 });
  await assert.rejects(pool.query("UPDATE auditboek SET actor = 'lid:ander' WHERE nr = 1"), /append-only/);
  await assert.rejects(pool.query('DELETE FROM auditboek WHERE nr = 3'), /append-only/);
  await assert.rejects(pool.query('TRUNCATE auditboek'), /append-only/);
  await assert.rejects(pool.query('DELETE FROM auditboek_anker'), /append-only/);
  await assert.rejects(pool.query("UPDATE auditboek_meta SET waarde = 'x'"), /append-only/);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM auditboek')).rows[0].n), 3);
});

test('5. NEGATIEF: een beheerder die triggers uitzet en een regel herschrijft EN de keten opnieuw uitrekent, wordt door het anker betrapt', async () => {
  const { b, sinks } = boek();
  await vul(b, 6);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: await b.klaar(), minSinks: 2 });
  await aanvaller.query('ALTER TABLE auditboek DISABLE TRIGGER USER');
  const rijen = (await aanvaller.query('SELECT nr, regel FROM auditboek ORDER BY nr')).rows;
  let vorige = null;
  for (const r of rijen) {
    const x = JSON.parse(r.regel);
    if (x.nr === 2) x.context.pad = '/api/pay/onschuldig';
    x.vorige = vorige; x.hash = hashRegel(x); vorige = x.hash;
    await aanvaller.query('UPDATE auditboek SET regel = $1, hash = $2, vorige = $3 WHERE nr = $4', [JSON.stringify(x), x.hash, x.vorige, x.nr]);
  }
  await aanvaller.query('ALTER TABLE auditboek ENABLE TRIGGER USER');
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false);
  assert.ok(codes(u).includes('herschreven'), 'lokaal klopt alles (de keten is opnieuw uitgerekend), alleen het anker ziet het: ' + JSON.stringify(codes(u)));
  assert.equal(u.bevindingen.filter(x => x.code === 'ketenGebroken').length, 0, 'bewijs dat de LOKALE controle het niet zag');
});

test('6. NEGATIEF: de nieuwste regels afknippen (kopafknipping) valt op tegen het anker', async () => {
  const { b, sinks } = boek();
  await vul(b, 8);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: await b.klaar(), minSinks: 2 });
  await aanvaller.query('ALTER TABLE auditboek DISABLE TRIGGER USER');
  await aanvaller.query('DELETE FROM auditboek WHERE nr > 5');
  await aanvaller.query('ALTER TABLE auditboek ENABLE TRIGGER USER');
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false); assert.ok(codes(u).includes('ingekort'), JSON.stringify(codes(u)));
});

test('7. NEGATIEF: een regel uit het midden verwijderen, of alleen een kolom bijstellen, breekt de lokale controle', async () => {
  const { b, sinks } = boek();
  await vul(b, 6);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: await b.klaar(), minSinks: 2 });
  await aanvaller.query('ALTER TABLE auditboek DISABLE TRIGGER USER');
  await aanvaller.query('DELETE FROM auditboek WHERE nr = 3');
  let u = await b.verifieer({ strikt: true });
  assert.ok(codes(u).includes('ketenGebroken'));
  await aanvaller.query("UPDATE auditboek SET actor = 'lid:iemand-anders' WHERE nr = 4");
  u = await b.verifieer({ strikt: true });
  assert.ok(codes(u).includes('kolommenAfwijkend'));
  await aanvaller.query('ALTER TABLE auditboek ENABLE TRIGGER USER');
});

test('8. NEGATIEF: een vervalst anker (andere sleutel) in een sink wordt als ongeldig gezien', async () => {
  const { b, sinks } = boek();
  await vul(b, 3);
  const id = await b.klaar();
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  const vals = sleutel();
  const echt = sinks[0].opslag.get(1);
  const nep = anker.teken({ ...JSON.parse(echt), kop: { nr: 3, hash: 'f'.repeat(64) } }, vals.prive);
  sinks[0].opslag.set(1, require('../server/kern/auditboek/regel').kanoniek(nep));
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false); assert.ok(codes(u).includes('ankerOngeldig'));
});

test('9. NEGATIEF: ankers uit een sink gooien: achterstand (strikt: fataal), en het volgende anker trekt de sink weer gelijk', async () => {
  const { b, sinks } = boek();
  const id = await b.klaar();
  await vul(b, 2); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  await vul(b, 2); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  sinks[1].opslag.delete(2);
  let u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false); assert.ok(codes(u).includes('sinkAchterstand'));
  u = await b.verifieer({ strikt: false });
  assert.equal(u.ok, true, 'niet-strikt: alleen een waarschuwing');
  await vul(b, 1); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  assert.equal(sinks[1].opslag.size, 3, 'het herstel heeft het ontbrekende anker teruggezet');
  assert.equal((await b.verifieer({ strikt: true })).ok, true);
});

test('10. NEGATIEF: alle sinks raken hun nieuwste anker kwijt maar de database houdt zijn ankerrecord: ankerVerdwenen', async () => {
  const { b, sinks } = boek();
  const id = await b.klaar();
  await vul(b, 2); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  await vul(b, 2); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  for (const s of sinks) s.opslag.delete(2);
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false); assert.ok(codes(u).includes('ankerVerdwenen'), JSON.stringify(codes(u)));
});

test('11. FAILURE MODE: een sink valt uit -> verificatie is `niet vast te stellen` (niet in orde), schrijven blijft werken, minSinks bewaakt het anker, herstel loopt vanzelf', async () => {
  const { b, sinks } = boek();
  const id = await b.klaar();
  await vul(b, 2); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  sinks[1].kapot = true;
  await vul(b, 1);                                                       // schrijven werkt gewoon
  let u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false); assert.equal(u.uitslag, 'niet-vast-te-stellen');
  await assert.rejects(anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 }), e => e.code === 'ANKER_NIET_WEGGEZET');
  await b.noteerEnAnker; // bestaat als voordeur
  const deels = await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 1, force: true });
  assert.equal(deels.gelukt, 1, 'met minSinks 1 mag het, en de uitslag zegt dat er maar een ontving');
  sinks[1].kapot = false;
  await vul(b, 1); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  assert.equal((await b.verifieer({ strikt: true })).ok, true, 'na herstel van de sink is alles gelijkgetrokken');
});

test('12. FAILURE MODE: PostgreSQL onbereikbaar -> geen regel, een duidelijke fout, en de releasevariant gaat niet verder', async () => {
  const dood = maak({ env: { DATABASE_URL: 'postgresql://rtg:rtg@127.0.0.1:1/geen', NODE_ENV: 'test', PG_CONNECT_MS: '500' }, sinks: [geheugenSink()], sleutels: sl });
  await assert.rejects(dood.noteer(ev()), e => e.code === 'AUDIT_NIET_VASTGELEGD');
  await assert.rejects(dood.noteerEnAnker(ev()), e => e.code === 'AUDIT_NIET_VASTGELEGD');
  await dood.sluit();
});

test('13. releasestap: noteerEnAnker legt de regel vast EN verankert hem in een write-once map; zonder sleutel of sink faalt hij', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-anker-'));
  try {
    const sinks = [mapSink(path.join(dir, 'een')), mapSink(path.join(dir, 'twee'))];
    const b = maak({ pool, sinks, sleutels: sl, env: { NODE_ENV: 'test', RTG_AUDIT_ANKER_MIN_SINKS: '2' } });
    const r = await b.noteerEnAnker(ev({ type: 'release.gate', uitkomst: 'vastgelegd', actor: { soort: 'ci', ref: 'run-1' },
      context: { commit: 'a'.repeat(40), uitslag: 'groen', blokkers: 0 } }));
    assert.equal(r.ankerNr, 1);
    const bestand = path.join(dir, 'een', 'anker-000000000001.json');
    assert.ok(fs.existsSync(bestand));
    assert.equal((fs.statSync(bestand).mode & 0o222), 0, 'het ankerbestand is alleen-lezen');
    assert.equal((await b.verifieer({ strikt: true })).ok, true);
    // write-once: een tweede, andere inhoud op hetzelfde volgnummer wordt geweigerd
    await assert.rejects(sinks[0].append({ ankerNr: 1, formaat: 'rtg-auditanker-v1', anders: true }), e => e.code === 'ANKER_BOTSING');
    const zonderSleutel = maak({ pool, sinks, sleutels: { prive: null, publiek: sl.publiek }, env: { NODE_ENV: 'test' } });
    await assert.rejects(zonderSleutel.noteerEnAnker(ev()), e => e.code === 'ANKER_GEEN_SLEUTEL');
    const teWeinig = maak({ pool, sinks: [sinks[0]], sleutels: sl, env: { NODE_ENV: 'test', RTG_AUDIT_ANKER_MIN_SINKS: '2' } });
    await assert.rejects(teWeinig.noteerEnAnker(ev()), e => e.code === 'ANKER_TE_WEINIG_SINKS');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('14. BEWARING: verjaarde regels gaan weg achter een checkpoint, de keten blijft kloppen en het boek schrijft door', async () => {
  const { b, sinks } = boek();
  const id = await b.klaar();
  const nu = Date.now(), oud = nu - 800 * DAG;
  await vul(b, 4, oud);                                                   // vier regels van 800 dagen geleden
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2, nu: oud + 60000 });   // toen al verankerd
  await vul(b, 3, nu - 10 * DAG);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2, nu: nu - 10 * DAG + 60000 });
  await vul(b, 1);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  const r = await b.snoei({ nu });
  assert.equal(r.verwijderd, 4); assert.equal(r.totNr, 4);
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, true, JSON.stringify(u.bevindingen));
  assert.equal((await pool.query('SELECT count(*) AS n FROM auditboek_checkpoint')).rows[0].n, '1');
  assert.equal((await pool.query("SELECT count(*) AS n FROM auditboek WHERE type = 'auditboek.retentie'")).rows[0].n, '1');
  await vul(b, 1);                                                        // het boek schrijft gewoon door
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  assert.equal((await b.verifieer({ strikt: true })).ok, true);
  assert.equal((await b.snoei({ nu })).verwijderd, 0, 'tweede keer: niets verjaard');
});

test('15. NEGATIEF: bewaring weigert zonder oud anker, en weigert op een boek dat niet strikt verifieert', async () => {
  const { b, sinks } = boek();
  const id = await b.klaar();
  const nu = Date.now();
  await vul(b, 4, nu - 800 * DAG);
  await vul(b, 2);
  await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });                  // anker is VERS, dekt de oude regels niet bewijsbaar
  await assert.rejects(b.snoei({ nu }), e => e.code === 'BEWARING_GEWEIGERD' && /ouder is dan de termijn/.test(e.message));
  sinks[0].kapot = true;
  await assert.rejects(b.snoei({ nu }), e => e.code === 'BEWARING_GEWEIGERD' && /verifieert niet/.test(e.message));
});

test('16. NEGATIEF: een beheerder die zelf jonge regels "verjaart" (vlag + checkpoint + retentieregel) wordt betrapt: retentieTeVroeg; zonder retentieregel: retentieZonderSpoor', async () => {
  const { b, sinks } = boek();
  const id = await b.klaar();
  await vul(b, 6); await anker.maakAnker({ pool, sinks, sleutels: sl, boekId: id, minSinks: 2 });
  // variant A: weg + checkpoint, geen gebeurtenis
  const r3 = (await pool.query('SELECT hash, tijd FROM auditboek WHERE nr = 3')).rows[0];
  await aanvaller.query('ALTER TABLE auditboek DISABLE TRIGGER USER');
  await aanvaller.query('DELETE FROM auditboek WHERE nr <= 3');
  await aanvaller.query('INSERT INTO auditboek_checkpoint(nr, hash, tijd, reden, anker_nr) VALUES(3,$1,$2,$3,1)', [r3.hash, r3.tijd, 'bewaartermijn 730 dagen']);
  let u = await b.verifieer({ strikt: true });
  assert.ok(codes(u).includes('retentieZonderSpoor'), JSON.stringify(codes(u)));
  // variant B: ook de retentiegebeurtenis netjes in de keten, maar het anker toont dat regel 3 jong is
  await b.noteer({ type: 'auditboek.retentie', uitkomst: 'uitgevoerd', actor: { soort: 'systeem', ref: 'auditboek-bewaring' },
    context: { totNr: 3, aantal: 3, dagen: 730, checkpointHash: r3.hash } });
  u = await b.verifieer({ strikt: true });
  assert.ok(codes(u).includes('retentieTeVroeg'), JSON.stringify(codes(u)));
  await aanvaller.query('ALTER TABLE auditboek ENABLE TRIGGER USER');
});

test('17. de sleutellader weigert een private sleutel die niet bij de vaste publieke hoort, en een verifieerder heeft geen private sleutel nodig', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sl-'));
  try {
    const een = crypto.generateKeyPairSync('ed25519'), twee = crypto.generateKeyPairSync('ed25519');
    const pub = path.join(dir, 'audit-anker.pub');
    fs.writeFileSync(pub, een.publicKey.export({ type: 'spki', format: 'pem' }));
    const prive = k => k.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    assert.throws(() => anker.laadSleutels({ RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: pub, RTG_AUDIT_ANKER_SIGN_KEY: prive(twee) }), /hoort niet bij/);
    const goed = anker.laadSleutels({ RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: pub, RTG_AUDIT_ANKER_SIGN_KEY: prive(een) });
    assert.ok(goed.prive && goed.publiek);
    const alleenLezer = anker.laadSleutels({ RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: pub });
    assert.equal(alleenLezer.prive, null); assert.ok(alleenLezer.publiek);
    assert.throws(() => anker.laadSleutels({ RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: path.join(dir, 'weg.pub'), RTG_AUDIT_ANKER_SIGN_KEY: prive(een) }), /publieke ankersleutel ontbreekt/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('18. een boek zonder enig anker is NIET in orde (onbekend), ook al klopt de keten lokaal', async () => {
  const { b } = boek();
  await vul(b, 3);
  const u = await b.verifieer({ strikt: true });
  assert.equal(u.ok, false); assert.ok(codes(u).includes('geenAnker'));
  assert.equal(codes(u).includes('ketenGebroken'), false);
});

test('AUDITBOEK.md noemt elk gebeurtenistype van de gesloten lijst (document en code lopen niet uiteen)', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const { GEBEURTENISSEN } = require('../server/kern/auditboek/gebeurtenissen');
  const doc = fs.readFileSync(path.join(__dirname, '..', 'AUDITBOEK.md'), 'utf8');
  const ontbrekend = Object.keys(GEBEURTENISSEN).filter(t => !doc.includes('`' + t + '`'));
  assert.deepEqual(ontbrekend, []);
});
