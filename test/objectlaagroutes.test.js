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

/* DE MOMENTLIJN OVER DE ECHTE SERVER (LIFE.md fase 4). De vakindeling is los
   getoetst in test/socialelijn.test.js; wat hier bewezen wordt is dat een echte
   bijeenkomst uit een echt genootschap ook werkelijk in een vak belandt -- de
   hele keten van domein tot route.

   Dit is dezelfde soort toets als de rest van dit bestand, en om dezelfde reden:
   de losse toets maakt het beeld van de graaf na, en kan dus niet zien of dat
   beeld nog op het echte lijkt. */
test('een echte bijeenkomst belandt op de lijn, in een vak met een naam', async () => {
  const r = await api('/api/sociaal/lijn', {}, lidToken);
  assert.equal(r.status, 200);
  const d = await json(r);
  const alle = (d.vakken || []).flatMap(v => v.regels.map(x => x.titel));
  assert.ok(alle.includes('Proefborrel'),
    'de bijeenkomst van over twee weken hoort op de lijn te staan');

  for (const v of d.vakken) {
    assert.ok(v.label, 'elk vak draagt een naam');
    assert.ok(v.regels.length, 'een leeg vak bestaat niet: ' + v.sleutel);
    assert.ok(!/\d/.test(v.label), 'geen afteller in een vaklabel: ' + v.label);
  }
  assert.equal(typeof d.later, 'number', 'later is een telling en geen staart');
});

/* LIFE COMMAND OVER DE ECHTE SERVER (LIFE.md fase 5). Dit is de zwaarste toets
   van deze wereld: hier wordt voor het eerst iets VERANDERD, en het moet langs
   het domein lopen en in het log belanden.

   De losse toets (test/socialecommand.test.js) maakt het domein na en kan dus
   niet zien of een bevestiging echt aankomt. Hier wel: na het bevestigen staat
   het antwoord in het genootschap zelf. */
test('een voorstel bevestigen verandert het antwoord in het domein en komt in het log', async () => {
  const b = await json(await api('/api/genootschap/roep-bijeen',
    { groep: groepId, wat: 'Commandborrel', datum: STRAKS, tijd: '21:00' }, lidToken));
  const nieuwId = (b.bijeenkomst && b.bijeenkomst.id) || b.id;

  const voor = await json(await api('/api/sociaal/command', {}, lidToken));
  const v = (voor.voorstellen || []).find(x => x.titel === 'Commandborrel');
  assert.ok(v, 'een bijeenkomst zonder antwoord hoort een voorstel op te leveren');
  assert.deepEqual(v.keuzes, ['ja', 'misschien', 'nee']);
  assert.ok(v.gevolg, 'wat er gebeurt bij bevestigen staat er vooraf bij');
  assert.equal(voor.rustig, false, 'met een openstaand voorstel is het niet rustig');

  /* Zonder geldige keuze verandert er niets -- klaarzetten wordt nooit vanzelf
     uitvoeren. */
  const weiger = await api('/api/sociaal/voorstel/bevestig', { id: v.id, keuze: 'vast' }, lidToken);
  assert.equal(weiger.status, 400);

  const ok = await api('/api/sociaal/voorstel/bevestig', { id: v.id, keuze: 'misschien' }, lidToken);
  assert.equal(ok.status, 200);
  assert.equal((await json(ok)).keuze, 'misschien');

  /* HET BEWIJS: het genootschap zelf weet het nu. Zou deze laag een eigen
     antwoord hebben bijgehouden, dan stond hier nog 'nog niet geantwoord'. */
  const obj = await json(await api('/api/sociaal/object', { soort: 'event', id: nieuwId }, lidToken));
  assert.equal(obj.caps.find(c => c.id === 'antwoord').waarom, 'u heeft "misschien" geantwoord');

  const na = await json(await api('/api/sociaal/command', {}, lidToken));
  assert.ok(!(na.voorstellen || []).some(x => x.titel === 'Commandborrel'),
    'een beantwoorde bijeenkomst vraagt niets meer');

  const log = await json(await api('/api/sociaal/actielog', {}, lidToken));
  assert.ok(log.log.length >= 1);
  assert.equal(log.log[0].wie, 'lid');
  assert.match(log.log[0].wat, /misschien/);
  assert.ok(log.log[0].gegevens.length, 'de verantwoording reist mee');
});

/* HET BELEID OVER DE ECHTE ROUTE (LIFE.md par. 6). Wat hier bewezen wordt is
   dat een instelling ook echt DOORWERKT -- een instelling die niets doet is
   erger dan geen instelling -- en dat er geen veld bestaat waarmee iets vanzelf
   gaat. Dat laatste is het verschil met geldbeleid, en het hoort niet alleen in
   een document te staan. */
test('beleid versmalt wat er klaarstaat, en kent geen automatische stand', async () => {
  const b = await json(await api('/api/genootschap/roep-bijeen',
    { groep: groepId, wat: 'Beleidsborrel', datum: STRAKS, tijd: '18:00' }, lidToken));
  assert.ok((b.bijeenkomst && b.bijeenkomst.id) || b.id);

  const staat = await json(await api('/api/sociaal/beleid', {}, lidToken));
  assert.equal(staat.automatischMogelijk, false);
  assert.deepEqual(staat.soorten, [{ soort: 'antwoord', aan: true }]);

  const voor = await json(await api('/api/sociaal/command', {}, lidToken));
  assert.ok((voor.voorstellen || []).some(x => x.titel === 'Beleidsborrel'));

  /* Uitzetten: dan staat er niets meer klaar. */
  const uit = await api('/api/sociaal/beleid/zet', { soort: 'antwoord', aan: false }, lidToken);
  assert.equal(uit.status, 200);
  const na = await json(await api('/api/sociaal/command', {}, lidToken));
  assert.deepEqual(na.voorstellen, [], 'uitgezet is uitgezet');
  /* MAAR HET VERBERGT NIETS. Beleid stopt wat Rahul KLAARZET; het maakt niet
     onwaar dat er iets op u wacht. De stand blijft dus melden dat er een
     onbeantwoorde bijeenkomst ligt -- een instelling die de werkelijkheid
     wegpoetst in plaats van het systeem stiller te maken, zou een instelling
     zijn die liegt. */
  assert.ok(na.stand.wachtOpMij >= 1,
    'de stand blijft eerlijk over wat er ligt, ook als Rahul niets meer klaarzet');

  /* En de wijziging staat in het log -- een besluit over wat er namens u mag
     gebeuren hoort in hetzelfde geheugen als een handeling. */
  const log = await json(await api('/api/sociaal/actielog', {}, lidToken));
  assert.match(log.log[0].wat, /beleid gewijzigd/);
  assert.equal(log.log[0].wie, 'lid');

  /* Weer aan, zodat de rest van dit bestand niet aan deze toets hangt. */
  await api('/api/sociaal/beleid/zet', { soort: 'antwoord', aan: true }, lidToken);
  const weer = await json(await api('/api/sociaal/command', {}, lidToken));
  assert.ok((weer.voorstellen || []).some(x => x.titel === 'Beleidsborrel'));

  /* Een onbekend veld verandert niets: het beleid kan alleen versmallen. */
  await api('/api/sociaal/beleid/zet', { automatisch: true, niveau: 'automatisch' }, lidToken);
  const nogsteeds = await json(await api('/api/sociaal/beleid', {}, lidToken));
  assert.equal(nogsteeds.automatischMogelijk, false);
  assert.deepEqual(Object.keys(nogsteeds).sort(),
    ['automatischMogelijk', 'horizon', 'horizonGrens', 'knoppen', 'ok', 'soorten']);

  /* De schakelaars komen over de route mee, met hun uitleg, en staan standaard
     aan: beleid haalt af en voegt niet toe. Een knop die een lid omzet moet
     bovendien echt doorwerken -- dat is los getoetst in test/socialegraaf.test.js
     en test/socialebeleid.test.js; hier gaat het om de weg erheen. */
  assert.deepEqual(nogsteeds.knoppen.map(k => k.knop), ['bereik', 'vonk', 'stilte']);
  for (const k of nogsteeds.knoppen) {
    assert.equal(k.aan, true);
    assert.ok(k.naam && k.uitleg, 'een schakelaar zonder uitleg is een knop waarvan niemand weet wat hij doet');
  }
  const omzet = await api('/api/sociaal/beleid/zet', { knop: 'vonk', aan: false }, lidToken);
  assert.equal(omzet.status, 200);
  assert.equal((await json(omzet)).beleid.knoppen.find(k => k.knop === 'vonk').aan, false);
  await api('/api/sociaal/beleid/zet', { knop: 'vonk', aan: true }, lidToken);
});

/* Een gast mag deze laag niet: hij leest de vriendenlaag, matches en groepen.
   De route weigert hem, en dat hoort een toets te bewaken en geen afspraak. */
test('een onbekende soort en een sessie zonder pas komen er niet in', async () => {
  const gek = await api('/api/sociaal/object', { soort: 'reis', id: 'x' }, lidToken);
  assert.equal(gek.status, 404, 'een type dat nog niet bestaat is geen halve uitkomst');
  const zonder = await api('/api/sociaal/object', { soort: 'groep', id: groepId });
  assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder inlog geen object');
});

/* DE GEGRONDE RAHUL VAN DEZE WERELD (LIFE.md par. 6, vierde laag).

   Twee dingen bewaken deze toets, en ze zijn allebei harder dan "er komt tekst
   uit":

     1. HIJ NOEMT ZIJN BRONNEN, ook zonder AI-sleutel. Een antwoord dat zichzelf
        niet verantwoordt is een orakel (GELD.md par. 5, LEVEN.md par. 2.10) --
        en juist het vaste antwoord zonder sleutel lijkt zekerder dan het is.
     2. HIJ VERANDERT NIETS. De grens van deze wereld is een ander mens; deze
        route heeft geen enkele weg naar klaarzetten of bevestigen.

   DE MUTATIE: haal `gegevens` uit het antwoord, of laat de route iets uitvoeren.
   Het tweede is bovendien in de systeemcontext verboden, maar een verbod in een
   prompt is geen grens -- daarom staat hij ook in de route zelf. */
test('Rahul antwoordt met zijn bronnen erbij en verandert niets', async () => {
  const voor = await json(await api('/api/sociaal/command', {}, lidToken));
  const r = await api('/api/sociaal/rahul', { vraag: 'wat speelt er?' }, lidToken);
  assert.equal(r.status, 200);
  const d = await json(r);
  assert.ok(d.antwoord, 'er komt een antwoord');
  assert.ok(Array.isArray(d.gegevens) && d.gegevens.length,
    'en de gegevens waarop het rust reizen mee');
  assert.match(d.gegevens[0], /wacht op u/);

  /* NIETS VERANDERD: dezelfde stand als ervoor. */
  const na = await json(await api('/api/sociaal/command', {}, lidToken));
  assert.deepEqual(na.stand, voor.stand, 'Rahul leest; hij handelt niet');
  assert.deepEqual((na.voorstellen || []).map(v => v.id), (voor.voorstellen || []).map(v => v.id));

  /* En hij staat achter dezelfde deur als de rest van deze wereld. */
  const zonder = await api('/api/sociaal/rahul', { vraag: 'x' });
  assert.ok(zonder.status === 401 || zonder.status === 403);
});

/* DE WERELD OM EEN EVENT HEEN, over de echte route (LIFE.md fase 6). De vorm is
   los getoetst in test/objectlaag.test.js; hier gaat het om de keten: een echte
   bijeenkomst, het echte genre-register, en een weg naar een app die bestaat. */
test('een echt event weet wat erbij hoort, en boekt niets', async () => {
  const d = await json(await api('/api/sociaal/object', { soort: 'event', id: bijeenkomstId }, lidToken));
  assert.ok(Array.isArray(d.eromheen) && d.eromheen.length, 'een avondbijeenkomst kent zijn wereld');
  const caps = d.eromheen.map(x => x.cap);
  assert.ok(caps.includes('reservations') && caps.includes('rides'));
  for (const e of d.eromheen) {
    assert.ok(e.genres > 0, 'de cap "' + e.cap + '" wordt door geen enkel genre gedragen');
    assert.match(e.link, /^\/apps\/[a-z]+\.html/);
    assert.ok(e.waarom, 'elke regel zegt waarom hij er staat');
    assert.ok(!('gereserveerd' in e) && !('aangevraagd' in e),
      'er wordt niets geboekt en niets beloofd');
  }
});
