/* De objectlaag over de echte route en de echte domeinen (LIFE.md fase 2).

   WAAROM DEZE TOETS NAAST test/objectlaag.test.js STAAT. Die maakt de domeinen
   NA -- genootschap, bijeenkomst, vonk -- en toetst daarmee de logica van de
   laag. Wat hij per definitie niet kan zien, is of de nagemaakte vorm nog op de
   echte lijkt. Precies daar ging het in deze wereld al een keer mis: de
   samenhanglaag las `bijeenkomst.titel` terwijl het domein `wat` levert, en de
   toets zag het niet omdat zijn namaakbron ook `titel` teruggaf (LAT.md regel 2,
   en de uitleg in test/socialewereld.test.js).

   Deze toets praat dus met de echte server: een lid registreren, een genootschap
   oprichten, een bijeenkomst uitschrijven, en dan het object opvragen zoals het
   scherm dat doet. Zakt hij terwijl objectlaag.test.js groen blijft, dan is een
   domein van vorm veranderd -- en dat is exact het signaal dat hier hoort te
   staan.

   Draai: node --experimental-sqlite --test test/objectlaagroutes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, lidToken, tweedeToken, tweedeCodenaam, groepId, bijeenkomstId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-obj-'));
const STRAKS = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const een = await json(await api('/api/auth/register', { name: 'Object Lid', email: 'obj1@x.nl',
    phone: '0612345601', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' }));
  lidToken = een.token;
  const twee = await json(await api('/api/auth/register', { name: 'Tweede Lid', email: 'obj2@x.nl',
    phone: '0612345602', password: 'geheim123', geboortedatum: '1990-02-02', pasApp: 'rtg' }));
  tweedeToken = twee.token;
  tweedeCodenaam = twee.codename || twee.codenaam || (twee.member && twee.member.codename);

  const g = await json(await api('/api/genootschap/richt-op',
    { naam: 'De Objectkring', soort: 'besloten', over: 'voor de toets' }, lidToken));
  groepId = (g.groep && g.groep.id) || g.id;
  const b = await json(await api('/api/genootschap/roep-bijeen',
    { groep: groepId, wat: 'Proefborrel', datum: STRAKS, tijd: '20:00', waar: 'De Salon' }, lidToken));
  bijeenkomstId = (b.bijeenkomst && b.bijeenkomst.id) || b.id;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een groep waar ik in zit levert caps, met de reden erbij', async () => {
  const r = await api('/api/sociaal/object', { soort: 'groep', id: groepId }, lidToken);
  assert.equal(r.status, 200);
  const d = await json(r);
  assert.equal(d.titel, 'De Objectkring', 'de naam komt uit het domein zelf');
  const ids = d.caps.map(c => c.id).sort();
  assert.deepEqual(ids, ['beheer', 'bijeenkomst', 'peiling', 'prikbord', 'uitvoer'],
    'wie een groep opricht is beheerder en krijgt de beheer-cap erbij');
  for (const c of d.caps) {
    assert.ok(c.naam && c.app && c.link, 'cap ' + c.id + ' is niet compleet');
    assert.ok(c.waarom, 'cap ' + c.id + ' staat er zonder reden');
  }
});

/* DE TOETS DIE DE ECHTE VORM VASTPINT. `titel` komt hier uit bijeenkomst.wat --
   het veld waar deze wereld eerder op struikelde. Zou het domein die naam ooit
   veranderen, dan zakt deze toets en niet het scherm. */
test('een bijeenkomst levert zijn echte titel en de antwoord-cap', async () => {
  const d = await json(await api('/api/sociaal/object', { soort: 'event', id: bijeenkomstId }, lidToken));
  assert.equal(d.titel, 'Proefborrel', 'de titel komt uit het veld dat het domein echt levert');
  assert.equal(d.over.datum, STRAKS);
  assert.equal(d.over.waar, 'De Salon');
  const ids = d.caps.map(c => c.id).sort();
  assert.deepEqual(ids, ['antwoord', 'gastheer', 'vandegroep']);
  assert.equal(d.caps.find(c => c.id === 'antwoord').waarom, 'u heeft nog niet geantwoord');
  assert.equal(d.caps.find(c => c.id === 'vandegroep').waarom, 'De Objectkring');
});

test('na het antwoord verandert de reden mee', async () => {
  await api('/api/genootschap/antwoord', { groep: groepId, id: bijeenkomstId, antwoord: 'ja' }, lidToken);
  const d = await json(await api('/api/sociaal/object', { soort: 'event', id: bijeenkomstId }, lidToken));
  assert.equal(d.caps.find(c => c.id === 'antwoord').waarom, 'u heeft "ja" geantwoord');
});

/* De grens van deze laag, over de echte route: een tweede lid dat niets met deze
   groep te maken heeft, hoort niet te kunnen zien dat hij bestaat. */
test('een ander lid krijgt dezelfde 404 als bij iets dat niet bestaat', async () => {
  const vreemd = await api('/api/sociaal/object', { soort: 'groep', id: groepId }, tweedeToken);
  const onzin = await api('/api/sociaal/object', { soort: 'groep', id: 'bestaat-niet' }, tweedeToken);
  assert.equal(vreemd.status, 404);
  assert.equal(onzin.status, 404);
  assert.deepEqual(await json(vreemd), await json(onzin),
    'de twee antwoorden horen woordelijk gelijk te zijn');
});

test('een codenaam waar niets mee gedeeld wordt, levert nul caps en geen fout', async () => {
  if (!tweedeCodenaam) return; // de registratie gaf geen codenaam terug; dan valt er niets te toetsen
  const r = await api('/api/sociaal/object', { soort: 'persoon', id: tweedeCodenaam }, lidToken);
  assert.equal(r.status, 200);
  const d = await json(r);
  assert.deepEqual(d.caps, []);
  assert.deepEqual(d.stil, [], 'geen enkele proef hoort hier stuk te gaan');
});

/* Een gast mag deze laag niet: hij leest de vriendenlaag, matches en groepen.
   De route weigert hem, en dat hoort een toets te bewaken en geen afspraak. */
test('een onbekende soort en een sessie zonder pas komen er niet in', async () => {
  const gek = await api('/api/sociaal/object', { soort: 'reis', id: 'x' }, lidToken);
  assert.equal(gek.status, 404, 'een type dat nog niet bestaat is geen halve uitkomst');
  const zonder = await api('/api/sociaal/object', { soort: 'groep', id: groepId });
  assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder inlog geen object');
});
