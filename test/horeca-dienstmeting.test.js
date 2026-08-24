/* RTG Horeca: DE DIENSTMETING -- de meetlat, met wat er werkelijk gemeten is.

   Onderaan HORECA.md staat een meetlat met twaalf regels, en naast elke regel
   stond een LAT ("0", "structureel kleiner") en nergens een getal. De laatste
   zin van dat document zegt het zelf: dit is pas waar wanneer er een meting
   naast staat.

   Deze toets bewaakt niet de uitkomst van een dienst -- die vraagt een zaak en
   een avond -- maar het INSTRUMENT, en vooral wat het NIET zegt:

   1. EEN LEGE AVOND GEEFT GEEN NULLEN. Nul complete gangen is niet "spreiding
      0" maar "niet gemeten". Een lege avond is geen perfecte avond, en dit is
      de fout die een meetlat waardeloos maakt.
   2. WAT ER NIET IS, HEET NIET-GEMETEN, met de reden erbij. Zodat iemand kan
      besluiten die bron te bouwen in plaats van te vergeten dat hij ontbreekt.
   3. EEN NUL UIT HET MODEL HEET CONSTRUCTIE. "Dubbel geclaimde uitgiftes" is
      nul omdat een claim per gang in één veld woont -- dat is een eigenschap
      van het ontwerp en geen prestatie van de dienst.
   4. EN WAT WEL TE METEN IS, WORDT GEMETEN. Een echte dienst door het
      instrument heen: de spreiding binnen een gang, de tijd tot het eerste
      glas, en de afwijking van een afgesproken serveertijd komen er als getal
      uit, met de rekensom erbij.
   5. DE REGELS ZIJN DIE VAN HORECA.md, woordelijk. Meet dit iets anders dan
      wat daar beloofd is, dan is de meting een ander plan.

   Draai: node --experimental-sqlite --test test/horeca-dienstmeting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meting-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api(pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tok, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const meet = async () => (await H('/api/supplier/horeca/dienstmeting', {})).body;
const punt = (m, stuk) => m.meetpunten.find(x => x.naam.indexOf(stuk) >= 0);

test('1. een lege avond geeft geen nullen maar "niet gemeten"', async () => {
  const m = await meet();
  assert.equal(m.meetpunten.length, 12, 'twaalf regels, net als in HORECA.md');

  const spreiding = punt(m, 'spreiding tussen gerechten');
  assert.equal(spreiding.soort, 'niet-gemeten', 'nul gangen is geen spreiding van nul');
  assert.equal(spreiding.waarde, null, 'en er staat geen getal');
  assert.match(spreiding.rekensom, /geen spreiding van nul/i, spreiding.rekensom);

  const drank = punt(m, 'tijd tot eerste drank');
  assert.equal(drank.soort, 'niet-gemeten');
  assert.match(drank.rekensom, /geen snelle avond/i, drank.rekensom);
});

test('2. wat er niet is, heet niet-gemeten met de reden erbij', async () => {
  const m = await meet();
  for (const naam of ['verloren orders', 'bedieningshandelingen', 'remakes en misroutes',
    'statische "enterprise"']) {
    const p = punt(m, naam);
    assert.equal(p.soort, 'niet-gemeten', naam + ' is niet te meten');
    assert.ok(p.rekensom.length > 40, 'met een reden die iets zegt: ' + p.rekensom);
  }
  /* En de reden bij bedieningshandelingen is een BESLUIT en geen tekort: een
     systeem dat handelingen per medewerker telt, staat een halve stap van een
     ranglijst (grens 5). */
  assert.match(punt(m, 'bedieningshandelingen').rekensom, /ranglijst/,
    'die reden is een besluit en geen tekort');
});

test('3. een nul uit het model heet constructie en geen prestatie', async () => {
  const m = await meet();
  const p = punt(m, 'dubbel geclaimde uitgiftes');
  assert.equal(p.soort, 'constructie');
  assert.equal(p.waarde, 0);
  assert.match(p.rekensom, /uit het model/, p.rekensom);
  assert.match(p.rekensom, /eigen ontwerp/, 'met de waarschuwing erbij: ' + p.rekensom);
});

test('4. een echte dienst komt er als getal uit', async () => {
  /* Een tafel met een drank en een gang van twee borden, met een afgesproken
     serveertijd. Alles wordt echt door de keuken gezet, dus de tijdstempels
     komen van de server. */
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'MEET-1', gasten: 2 })).body.rekening;
  const glas = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: 'Gin-tonic', prijs: 12,
    aantal: 1, gang: 1, station: 'bar' })).body.regel;
  const a = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: 'Tartaar', prijs: 22,
    aantal: 1, gang: 2, station: 'koud' })).body.regel;
  const b = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: 'Zeebaars', prijs: 29,
    aantal: 1, gang: 2, station: 'warm' })).body.regel;

  await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: 1 });
  const straks = new Date(Date.now() + 30 * 60000);
  const serveerOm = String(straks.getHours()).padStart(2, '0') + ':' + String(straks.getMinutes()).padStart(2, '0');
  await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: 2, serveerOm });

  await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: glas.id, stand: 'klaar' });
  await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: glas.id, stand: 'uitgegeven' });
  await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: a.id, stand: 'klaar' });
  await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: b.id, stand: 'klaar' });

  const m = await meet();

  const drank = punt(m, 'tijd tot eerste drank');
  assert.equal(drank.soort, 'gemeten', 'nu is er een glas de deur uit');
  assert.equal(drank.eenheid, 'minuten');
  assert.ok(drank.waarde >= 0 && drank.waarde < 5, 'en het ging snel: ' + drank.waarde);
  assert.match(drank.rekensom, /1 tafel/, drank.rekensom);

  const spreiding = punt(m, 'spreiding tussen gerechten');
  assert.equal(spreiding.soort, 'gemeten', 'de gang van twee borden is compleet');
  assert.match(spreiding.rekensom, /1 complete gang/, spreiding.rekensom);

  const belofte = punt(m, 'beloofde versus werkelijke');
  assert.equal(belofte.soort, 'gemeten', 'er was een serveertijd afgesproken');
  assert.ok(belofte.waarde >= 29 && belofte.waarde <= 31,
    'de gang stond een halfuur te vroeg klaar: ' + belofte.waarde);
  assert.match(belofte.rekensom, /serveertijd meegaf/, belofte.rekensom);
});

test('5. de twaalf regels zijn woordelijk die van HORECA.md', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'HORECA.md'), 'utf8');
  const meetlat = md.slice(md.indexOf('## De meetlat'));
  const { REGELS } = require('../server/kern/horeca/dienstmeting')(
    { horeca: { nu: () => new Date().toISOString() } });
  assert.equal(REGELS.length, 12);
  for (const naam of REGELS) {
    assert.ok(meetlat.indexOf('| ' + naam + ' |') >= 0,
      'staat woordelijk in de meetlat van HORECA.md: "' + naam + '"');
  }
});

test('6. een onbevestigde allergiewijziging die toch doorliep, wordt geteld', async () => {
  const m1 = await meet();
  const voor = punt(m1, 'onbevestigde allergie').waarde;

  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'MEET-2', gasten: 1 })).body.rekening;
  const regel = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: 'Menu', prijs: 40,
    aantal: 1, gang: 1, station: 'warm', allergie: 'noten' })).body.regel;
  await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: 1 });
  await H('/api/supplier/horeca/keuken/stand', { rekeningId: r.id, regelId: regel.id, stand: 'klaar' });

  // Rahul past de allergie aan; dat zet de regel terug op wachten
  const v = await H('/api/supplier/horeca/rahul/doe', { handeling: 'allergie.aanpassen',
    gegevens: { rekeningId: r.id, regelId: regel.id, allergie: 'noten, gluten' } });
  await H('/api/supplier/horeca/rahul/bevestig', { bonId: v.body.bon.id });

  const m2 = await meet();
  assert.equal(punt(m2, 'onbevestigde allergie').waarde, voor + 1,
    'een regel die klaar staat terwijl hij op bevestiging wacht, telt mee');
  assert.match(punt(m2, 'onbevestigde allergie').rekensom, /wachten er/, 'met hoeveel er nu wachten');
});
