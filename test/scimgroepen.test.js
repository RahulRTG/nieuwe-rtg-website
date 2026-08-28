/* SCIM /Groups -- een groepswijziging bij de klant werkt METEEN door.

   Waarom deze laag er is: de identiteitsbrug las de claim `groups` uit het
   ID-token, en dat gebeurt alleen bij een inlog. Haalt een beheerder iemand
   vanochtend uit een groep, dan houdt die persoon zijn rol tot hij toevallig
   opnieuw inlogt -- bij een sessie van dertig dagen dus een maand. Voor een
   groep die toegang tot personeelsdossiers geeft is dat een maand te lang.

   Vier beweringen:

   1. De ontdekking noemt Group. Een provider die niet ziet dat wij het kunnen,
      gebruikt het niet.
   2. Een groep is een NAAM met leden en verder niets. Geen rechten en geen
      nesting -- een groep in een groep maakt van de toegangsvraag een
      grafiekvraag, en dat wordt geweigerd MET de reden.
   3. De sleutel van de ene organisatie opent de groepen van de andere niet.
   4. Een wijziging aan de leden beweegt de werkruimte mee, in hetzelfde
      verzoek. Ook -- en juist -- als iemand eruit gaat.

   Draai los: node --experimental-sqlite --test test/scimgroepen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scimgroep-'));
let srv, base, tech, sleutelA, sleutelB;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
/* De paden staan hier VOLUIT en niet als BASIS + '/Groups'. Dat is geen
   omslachtigheid: de dekkingsmeter van scripts/keuring.js zoekt de letterlijke
   route in de toetsbron, en een pad dat met string-plakwerk wordt opgebouwd
   telt als ongetest -- terwijl hij dat niet is. De meter goed voeden is beter
   dan de norm verlagen met een uitleg erbij. */

/* EN DE ROUTE MET EEN PARAMETER, want die valt buiten de regel hierboven: het
   pad van EEN groep is nooit letterlijk op te schrijven, er staat een id in.
   Een pad dat met + aan elkaar wordt geplakt is precies het plakwerk waar die
   zeef niet doorheen kijkt, en scripts/nieuweroutes.js liet deze tak er dan
   ook op zakken -- "nieuwe route zonder toets" -- terwijl vier toetsen hem wel
   degelijk aanroepen. Dus staat het PATROON hier voluit en wordt het concrete pad
   daaruit gemaakt. Dat is de zeef goed voeden en niet omzeilen: de aanroep
   noemt de route die hij raakt. */
const GROEP = '/api/scim/v2/Groups/:id';
const groepPad = (id) => GROEP.replace(':id', id);
function scim(pad, opties, sleutel) {
  const o = opties || {};
  return fetch(base + pad, {
    method: o.methode || 'GET',
    headers: Object.assign({ Authorization: 'Bearer ' + sleutel },
      o.lijf ? { 'Content-Type': 'application/scim+json' } : {}),
    body: o.lijf ? JSON.stringify(o.lijf) : undefined
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;

  /* Twee organisaties met elk een koppeling en een SCIM-sleutel. De tweede is
     er niet voor de volledigheid maar voor bewering 3. */
  for (const [org, domein] of [['O-GA', 'klant-a.nl'], ['O-GB', 'klant-b.nl']]) {
    const k = await api('/api/techniek/sso', { org, naam: org, issuer: 'https://idp.' + domein,
      clientId: 'cid', clientSecret: 'geheim', domeinen: domein }, tech);
    assert.equal(k.status, 200, 'koppeling ' + org + ': ' + JSON.stringify(k.body).slice(0, 140));
  }
  const a = await api('/api/techniek/sso/scimsleutel', { org: 'O-GA' }, tech);
  const b = await api('/api/techniek/sso/scimsleutel', { org: 'O-GB' }, tech);
  sleutelA = a.body.sleutel;
  sleutelB = b.body.sleutel;
  assert.ok(sleutelA && sleutelB, 'twee SCIM-sleutels: ' + JSON.stringify(a.body).slice(0, 160));
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de ontdekking noemt Group, anders gebruikt geen enkele provider hem', async () => {
  const rt = await scim('/api/scim/v2/ResourceTypes', {}, sleutelA);
  assert.equal(rt.status, 200);
  const namen = rt.body.Resources.map(r => r.id);
  assert.ok(namen.includes('User') && namen.includes('Group'), 'beide soorten: ' + namen.join(', '));

  const sch = await scim('/api/scim/v2/Schemas', {}, sleutelA);
  const ids = sch.body.Resources.map(r => r.name);
  assert.ok(ids.includes('Group'), 'en het schema staat erbij: ' + ids.join(', '));
});

test('2. een groep draagt leden en verder niets -- geen nesting', async () => {
  const zonderNaam = await scim('/api/scim/v2/Groups', { methode: 'POST', lijf: { members: [] } }, sleutelA);
  assert.equal(zonderNaam.status, 400, 'een groep zonder displayName bestaat niet');

  const g = await scim('/api/scim/v2/Groups', { methode: 'POST',
    lijf: { displayName: 'Haarlem-Managers', members: [] } }, sleutelA);
  assert.equal(g.status, 201);
  assert.equal(g.body.displayName, 'Haarlem-Managers');
  assert.ok(Array.isArray(g.body.members));

  const weer = await scim('/api/scim/v2/Groups', { methode: 'POST', lijf: { displayName: 'Haarlem-Managers' } }, sleutelA);
  assert.equal(weer.status, 409, 'twee groepen met dezelfde naam is er een te veel');

  /* GEEN GROEP IN EEN GROEP. Weigeren met de reden en niet stil overslaan: een
     IdP die nesting stuurt en er niets over hoort, denkt dat het werkt. */
  const genest = await scim('/api/scim/v2/Groups', { methode: 'POST',
    lijf: { displayName: 'Alles', members: [{ value: g.body.id, type: 'Group' }] } }, sleutelA);
  assert.equal(genest.status, 400);
  assert.match(genest.body.detail, /groep in een groep/);
});

test('3. de sleutel van de ene organisatie opent de groepen van de andere niet', async () => {
  const vanA = await scim('/api/scim/v2/Groups', {}, sleutelA);
  assert.equal(vanA.body.totalResults, 1, 'A ziet zijn eigen groep');

  const vanB = await scim('/api/scim/v2/Groups', {}, sleutelB);
  assert.equal(vanB.body.totalResults, 0, 'B ziet die van A niet');

  const id = vanA.body.Resources[0].id;
  const stiekem = await scim(groepPad(id), {}, sleutelB);
  assert.equal(stiekem.status, 404, 'ook niet met het id in de hand');

  const patch = await scim(groepPad(id), { methode: 'PATCH',
    lijf: { Operations: [{ op: 'add', path: 'members', value: [{ value: '1' }] }] } }, sleutelB);
  assert.equal(patch.status, 404, 'en al helemaal niet om er iemand in te zetten');

  const zonder = await fetch(base + '/api/scim/v2/Groups');
  assert.equal(zonder.status, 401, 'zonder sleutel komt er niets doorheen');
});

test('4. de drie PATCH-vormen die IdP\'s echt sturen, worden alle drie herkend', async () => {
  const id = (await scim('/api/scim/v2/Groups', {}, sleutelA)).body.Resources[0].id;
  const leden = async () => (await scim(groepPad(id), {}, sleutelA)).body.members.map(m => m.value);

  await scim(groepPad(id), { methode: 'PATCH',
    lijf: { Operations: [{ op: 'add', path: 'members', value: [{ value: '7' }, { value: '9' }] }] } }, sleutelA);
  assert.deepEqual(await leden(), ['7', '9'], 'add zet er twee in');

  /* De remove-vorm met het id IN HET PAD; dit is de vorm die Entra stuurt en
     die het vaakst wordt vergeten. */
  await scim(groepPad(id), { methode: 'PATCH',
    lijf: { Operations: [{ op: 'remove', path: 'members[value eq "7"]' }] } }, sleutelA);
  assert.deepEqual(await leden(), ['9'], 'remove met een filter in het pad haalt er een uit');

  await scim(groepPad(id), { methode: 'PATCH',
    lijf: { Operations: [{ op: 'replace', path: 'members', value: [{ value: '3' }] }] } }, sleutelA);
  assert.deepEqual(await leden(), ['3'], 'replace vervangt de hele lijst');

  const onzin = await scim(groepPad(id), { methode: 'PATCH',
    lijf: { Operations: [{ op: 'replace', path: 'kleur', value: 'blauw' }] } }, sleutelA);
  assert.equal(onzin.status, 400, 'wat we niet herkennen, melden we -- stil slagen is erger');
});

test('5. een groep weghalen wist de groep en niet de mensen', async () => {
  const id = (await scim('/api/scim/v2/Groups', {}, sleutelA)).body.Resources[0].id;
  const weg = await fetch(base + groepPad(id),
    { method: 'DELETE', headers: { Authorization: 'Bearer ' + sleutelA } });
  assert.equal(weg.status, 204);
  assert.equal((await scim('/api/scim/v2/Groups', {}, sleutelA)).body.totalResults, 0);

  /* De accounts van die organisatie staan er nog. Een groep opheffen is geen
     ontslag, en er hoort geen tweede pad te zijn dat mensen kan uitzetten. */
  const mensen = await scim('/api/scim/v2/Users', {}, sleutelA);
  assert.equal(mensen.status, 200, 'de gebruikerskant werkt gewoon door');
});

/* 6. PUT IS GEEN TWEEDE PATCH. Waar PATCH een wijziging beschrijft, zet PUT de
   groep in zijn geheel terug: wat niet in het lijf staat, staat er daarna niet
   meer. Dat is precies de vorm waar een IdP mensen mee VERWIJDERT -- Okta stuurt
   bij "push groups" de hele ledenlijst en verwacht dat wie er niet in staat,
   eruit is. Zou deze route de leden aanvullen in plaats van vervangen, dan blijft
   iemand die vanochtend uit de groep is gehaald zijn rol houden, en dat is
   precies het gat waarvoor deze hele laag bestaat.

   Deze route werd door de hele toetssuite nooit aangeraakt (hij stond niet in
   DEKKING.json), terwijl zijn vier buren op hetzelfde pad dat wel werden. */
test('6. PUT vervangt de hele groep -- naam en leden -- en alleen binnen de eigen organisatie', async () => {
  const gemaakt = await scim('/api/scim/v2/Groups', { methode: 'POST',
    lijf: { displayName: 'Utrecht-Balie', members: [{ value: '4' }, { value: '5' }] } }, sleutelA);
  assert.equal(gemaakt.status, 201, JSON.stringify(gemaakt.body).slice(0, 160));
  const id = gemaakt.body.id;
  const leden = async () => (await scim(groepPad(id), {}, sleutelA)).body.members.map(m => m.value);

  /* De vervanging zelf: andere naam, andere leden, in één verzoek. */
  const vervangen = await scim(groepPad(id), { methode: 'PUT',
    lijf: { displayName: 'Utrecht-Receptie', members: [{ value: '6' }, { value: '7' }] } }, sleutelA);
  assert.equal(vervangen.status, 200, JSON.stringify(vervangen.body).slice(0, 160));
  assert.equal(vervangen.body.displayName, 'Utrecht-Receptie', 'de naam is meeverzet');
  assert.deepEqual(vervangen.body.members.map(m => m.value), ['6', '7'],
    'de oude leden zijn weg, niet aangevuld');
  assert.equal(vervangen.body.id, id, 'en het is dezelfde groep gebleven');
  assert.deepEqual(await leden(), ['6', '7'], 'en het staat er ook echt, niet alleen in het antwoord');

  /* WAT NIET IN HET LIJF STAAT, STAAT ER DAARNA NIET MEER. Dit is het verschil
     met PATCH en het is de helft waar toegang verdwijnt. */
  const zonderLeden = await scim(groepPad(id), { methode: 'PUT',
    lijf: { displayName: 'Utrecht-Receptie' } }, sleutelA);
  assert.equal(zonderLeden.status, 200);
  assert.deepEqual(await leden(), [], 'een PUT zonder members maakt de groep leeg');

  /* EEN GEWEIGERDE VERVANGING VERANDERT NIETS. De naam botst met een tweede
     groep, dus de hele PUT gaat niet door -- ook de leden niet. Half doorgevoerd
     is hier erger dan geweigerd: dan is de groep leeg onder de oude naam. */
  await scim(groepPad(id), { methode: 'PUT',
    lijf: { displayName: 'Utrecht-Receptie', members: [{ value: '8' }] } }, sleutelA);
  const tweede = await scim('/api/scim/v2/Groups', { methode: 'POST',
    lijf: { displayName: 'Utrecht-Keuken', members: [] } }, sleutelA);
  assert.equal(tweede.status, 201);
  const botst = await scim(groepPad(id), { methode: 'PUT',
    lijf: { displayName: 'Utrecht-Keuken', members: [] } }, sleutelA);
  assert.equal(botst.status, 409, 'twee groepen met dezelfde naam is er een te veel');
  assert.deepEqual(await leden(), ['8'], 'en de leden staan er nog precies zoals ze stonden');

  /* DE POORT. Dezelfde drie weigeringen als bij de andere methoden op dit pad:
     een onbekende groep, de sleutel van de buurorganisatie, en geen sleutel. */
  const onbekend = await scim(groepPad('99999'), { methode: 'PUT',
    lijf: { displayName: 'Bestaat-Niet', members: [] } }, sleutelA);
  assert.equal(onbekend.status, 404, 'een groep die er niet is, wordt niet stilzwijgend gemaakt');

  const buurman = await scim(groepPad(id), { methode: 'PUT',
    lijf: { displayName: 'Overgenomen', members: [{ value: '1' }] } }, sleutelB);
  assert.equal(buurman.status, 404, 'de sleutel van B vervangt de groep van A niet');
  assert.deepEqual(await leden(), ['8'], 'en heeft er ook niets aan veranderd');

  const zonderSleutel = await fetch(base + groepPad(id), {
    method: 'PUT', headers: { 'Content-Type': 'application/scim+json' },
    body: JSON.stringify({ displayName: 'Open', members: [] })
  });
  assert.equal(zonderSleutel.status, 401, 'zonder sleutel komt er niets doorheen');
});
