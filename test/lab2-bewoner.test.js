/* De BEWONERSKANT van het RTF Living Lab, plus het kantoorwerk eromheen dat
   nergens anders in de suite langskomt: het apparatuurregister (uitgifte,
   storing sluiten, reservering intrekken), de klachtenprocedure van allebei de
   kanten, het stilleggen door de toezichthouder en de conclusie die de coach
   voorstelt. Draai los:
   node --experimental-sqlite --test test/lab2-bewoner.test.js

   WAAROM DIT BESTAND BESTAAT. test/livinglab.test.js loopt de onderzoekscyclus
   af en raakt daarbij vooral de kantoordeuren. De deuren die een BEWONER ZONDER
   ACCOUNT gebruikt -- het kader, de lijst met labs, het publieke overzicht, de
   vragen uit de buurt, het labpaspoort en de klacht -- werden nergens
   aangeroepen. Daarmee stond ook nergens vast WAT ze mogen tonen, en juist die
   routes zijn de enige in dit domein die zonder inlog antwoorden. Een publieke
   route die niemand toetst, is een route waarvan pas buiten blijkt dat hij het
   hele dossier meestuurt.

   WAT DEZE TOETSEN NIET DOEN: een endpoint aantikken om het aangeraakt te
   hebben. Regel 9 van de lat -- een toets die niet kan zakken is erger dan geen
   toets. Elke aanroep hieronder draagt daarom een van deze vier:

     de VORM      welke velden een voorbijganger juist NIET krijgt (budget,
                  tekenaars, het vraagstuk van een gescheiden studie);
     de POORT     wat er dichtgaat zonder de juiste naam of rol;
     de FOUT      wat er gebeurt bij een verkeerde of te dunne invoer;
     het GEVOLG   wat een schrijfactie werkelijk heeft veranderd, teruggelezen
                  langs een ANDERE route dan waarlangs het erin ging.

   Dat laatste is waar de meeste bugs zaten die dit huis eerder heeft gehad: een
   reservering die "weg" heet maar in het dossier van de studie gewoon blijft
   staan, een storing die dicht gaat zonder het apparaat terug in de roulatie te
   zetten. Beide worden hieronder teruggelezen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lab2-bewoner-'));

// met kantoorsessie
const api = (pad, body) => fetch(base + '/api/lab2/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
// zonder enige inlog: precies wat een voorbijganger stuurt
const pub = (pad, body) => fetch(base + '/api/lab2/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

// doe iets en eis dat het lukt, met de foutmelding van de server in de assert
async function moet(pad, body, wat) {
  const r = await api(pad, body);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || ''));
  return r.body;
}
async function moetPub(pad, body, wat) {
  const r = await pub(pad, body);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || ''));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LAB2-BEWONER-1' } });
  base = srv.base;
  const login = await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'LAB2-BEWONER-1' })
  });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let LAB, SLAAP, OPEN, DICHT, THEMA, PASPOORT, PAS, ALIAS, KLACHT, APP, MELDING, PUNTEN;

/* Het kader is de tabel waaruit ZOWEL het bewonersscherm als het kantoorscherm
   zijn keuzelijsten bouwt. Staan daar twee kopieen van, dan biedt het ene scherm
   een stap of methode aan die de server bij het andere weigert (regel 4). Deze
   toets legt vast dat het letterlijk hetzelfde antwoord is -- en meet daarnaast
   de inhoud, want twee lege antwoorden zijn ook aan elkaar gelijk. */
test('het kader staat open voor een bewoner, en het is exact het kantoorkader', async () => {
  const p = await moetPub('bewoner/kader', {}, 'het publieke kader komt door');
  const k = await moet('kader', {}, 'het kantoorkader komt door');

  assert.equal(p.cyclus.length, 10, 'tien stappen in de cyclus');
  assert.equal(p.risico.length, 4, 'vier risicoklassen');
  assert.equal(p.methoden.length, 12, 'twaalf methoden');
  assert.ok(p.spel.punten.herzien > p.spel.punten.stap, 'herzien levert meer op dan een stap zetten');
  assert.deepEqual(p, k, 'bewoner en kantoor lezen EEN tabel, niet twee kopieen');
});

/* De lijst met labs is de buitenste ring. Wat een voorbijganger hier wel mag
   zien (waar staat een lab, is het open of op uitnodiging) en wat niet (budget,
   tekenbevoegden, bewaartermijn) is een uitdrukkelijke keuze in de route. Zonder
   deze toets is die keuze een regel code die niemand mist als hij sneuvelt: geef
   de labs ongefilterd terug en alles blijft "werken". */
test('de lijst met labs verzwijgt het bestuurlijke deel en slapende labs', async () => {
  LAB = (await moet('lab/maak', { stad: 'Bewonersstad', naam: 'Living Lab Bewonersstad' }, 'lab aanmaken')).lab.id;
  await moet('lab/tekenaar', { id: LAB, naam: 'Dr. Vermeer', rol: 'professional' }, 'tekenaar');
  await moet('lab/tekenaar', { id: LAB, naam: 'M. de Wit', rol: 'toezichthouder' }, 'toezichthouder');
  await moet('lab/budget', { id: LAB, toegekend: 25000, besteed: 1000, bron: 'Gemeente Bewonersstad' }, 'budget');

  // een tweede lab dat NIET actief is: het hoort wel in het kantoorbeeld en niet
  // in het publieke. Zonder dit tweede lab bewijst de filterregel niets.
  SLAAP = (await moet('lab/maak', { stad: 'Slaapstad', naam: 'Living Lab Slaapstad' }, 'tweede lab')).lab.id;
  await moet('lab/zet', { id: SLAAP, actief: false }, 'tweede lab slapend zetten');

  const kantoor = await moet('labs', {}, 'labs achter de kantoordeur');
  assert.equal(kantoor.labs.find(l => l.id === LAB).budget.toegekend, 25000,
    'het kantoor ziet het budget wel (anders zegt de regel hieronder niets)');
  assert.ok(kantoor.labs.some(l => l.id === SLAAP), 'het slapende lab staat in het kantoorbeeld');

  const open = await moetPub('bewoner/labs', {}, 'de publieke lablijst');
  const rij = open.labs.find(l => l.id === LAB);
  assert.ok(rij, 'het lab staat in de publieke lijst');
  assert.deepEqual(Object.keys(rij).sort(), ['id', 'land', 'naam', 'stad', 'toegang'],
    'een voorbijganger krijgt precies deze vijf velden: geen budget, geen tekenaars, geen bewaartermijn');
  assert.equal(rij.stad, 'Bewonersstad');
  assert.ok(!open.labs.some(l => l.id === SLAAP), 'een slapend lab staat niet in de publieke lijst');
});

/* Het publieke overzicht is de plek waar de ringen uit kern/livinglab/studie.js
   zich moeten bewijzen. De route geeft `null` als kijker mee; wie daar per
   ongeluk `staf()` neerzet, opent het hele dossier voor iedereen zonder dat er
   ook maar iets stukgaat. Daarom staan hier twee studies naast elkaar: een
   gewone en een gescheiden, met verschillende antwoorden. */
test('het publieke overzicht toont een gewone studie, en van een gescheiden studie niet meer dan de titel', async () => {
  OPEN = (await moet('studie/maak', { labId: LAB, titel: 'Bankjes bij de vijver', soort: 'leefomgeving',
    vraagstuk: 'Worden de bankjes bij de vijver in de Lindelaan genoeg gebruikt, en door wie?',
    doel: 'Weten of er meer of juist andere zitplekken nodig zijn' }, 'gewone studie')).studie.id;
  const g = (await moet('studie/maak', { labId: LAB, titel: 'Schuldhulp en stress bij jongeren', soort: 'welzijn',
    vraagstuk: 'Helpt vroege schuldhulp bij kinderen in gezinnen met geldzorgen tegen stress?' }, 'gevoelige studie')).studie;
  DICHT = g.id;
  assert.equal(g.gescheiden, true, 'schulden en kinderen maken deze studie gescheiden');

  const o = await moetPub('bewoner/overzicht', { labId: LAB }, 'publiek overzicht');
  assert.equal(o.totaal, 2, 'beide studies tellen mee');
  assert.equal(o.perStap.vraagstuk, 2, 'ze staan allebei bij het vraagstuk');
  assert.equal(o.lab.stad, 'Bewonersstad', 'het overzicht noemt het lab waar het over gaat');

  const open = o.studies.find(s => s.id === OPEN);
  assert.equal(open.vraagstuk, 'Worden de bankjes bij de vijver in de Lindelaan genoeg gebruikt, en door wie?',
    'bij een gewone studie mag het vraagstuk publiek zijn');
  assert.equal(open.deelnemers, undefined, 'maar het dossier niet: geen deelnemers in het publieke beeld');
  assert.equal(open.observaties, undefined, 'en geen observaties');

  const dicht = o.studies.find(s => s.id === DICHT);
  assert.equal(dicht.titel, 'Schuldhulp en stress bij jongeren', 'de titel mag');
  assert.equal(dicht.vraagstuk, undefined, 'het vraagstuk niet: dat verraadt wie de deelnemers zijn');
  assert.equal(dicht.gescheiden, true, 'en het staat er met zoveel woorden bij');

  const weg = await pub('bewoner/overzicht', { labId: 'bestaatniet' });
  assert.equal(weg.status, 404, 'een lab dat niet bestaat geeft geen leeg overzicht maar een 404');
});

/* De vragen uit de buurt. De scherpste regel hier is dat de teller aan het
   THEMA hangt en niet aan de stemmer (regel 7 van de lat): wie tien aliassen
   verzint, koopt daar geen tien stemmen mee. Die regel is alleen te zien door NA
   de dubbele stem opnieuw te tellen -- de 409 zelf zegt nog niets over wat er
   in de opslag staat. */
test('een vraag uit de buurt: de stem hangt aan het thema, niet aan de stemmer', async () => {
  const dun = await pub('bewoner/thema', { labId: LAB, vraag: 'te kort' });
  assert.equal(dun.status, 400, 'een half zinnetje is geen vraag');

  const geenLab = await pub('bewoner/thema', { labId: 'bestaatniet', vraag: 'Kan de speeltuin aan de Lindelaan opgeknapt worden?' });
  assert.equal(geenLab.status, 404, 'een thema hangt altijd aan een bestaand lab');

  THEMA = (await moetPub('bewoner/thema', { labId: LAB, alias: 'BW-AANDRAGER',
    vraag: 'Kan de verlichting langs het vijverpad aan?' }, 'thema aandragen')).thema.id;

  const eerst = await moetPub('bewoner/themas', { labId: LAB }, 'themalijst');
  assert.equal(eerst.totaal, 1, 'dit lab heeft precies dit ene thema');
  assert.equal(eerst.themas[0].id, THEMA);
  assert.equal(eerst.themas[0].stemmen, 0, 'een vers thema heeft nul stemmen');
  assert.equal(eerst.themas[0].studieId, null, 'en hangt nog aan geen enkel onderzoek');

  const naamloos = await pub('bewoner/stem', { id: THEMA });
  assert.equal(naamloos.status, 400, 'een stem draagt een naam of alias');

  const stem = await moetPub('bewoner/stem', { id: THEMA, alias: 'BW-STEMMER' }, 'stemmen');
  assert.equal(stem.thema.stemmen, 1, 'de stem telt');

  const weer = await pub('bewoner/stem', { id: THEMA, alias: 'BW-STEMMER' });
  assert.equal(weer.status, 409, 'twee keer stemmen kan niet');

  const na = await moetPub('bewoner/themas', { labId: LAB }, 'themalijst opnieuw');
  assert.equal(na.themas[0].stemmen, 1, 'en de teller staat daarna nog steeds op een');

  const geenLijst = await pub('bewoner/themas', { labId: 'bestaatniet' });
  assert.equal(geenLijst.status, 404, 'themas van een lab dat niet bestaat');
});

/* Het labpaspoort. Een paspoort dat altijd nul teruggeeft is niet van een echt
   paspoort te onderscheiden, dus deze toets VERDIENT er eerst punten mee: een
   deelnemer brengt zijn paspoort mee, stuurt met zijn labpas een interview in,
   en pas daarna wordt het paspoort opnieuw gelezen. Het bedrag komt uit het
   kader en niet uit deze toets -- anders staat de puntentabel op twee plekken.

   De code gaat er de tweede keer met opzet in KLEINE letters in. Wat dat
   vasthoudt is de uitkomst -- een drager die zijn code overtypt komt binnen --
   en niet WAAR die normalisatie gebeurt: hij staat nu zowel in de route
   (codeUit) als in de kern (spel.opCode), en die twee dekken elkaar af. Deze
   bewering zakt dus pas als ze allebei verdwijnen. Dat is met opzet zo
   opgeschreven in plaats van op een van de twee plekken vastgepind, want welke
   van de twee het doet, is een keuze die mag veranderen.

   Onderweg liggen nog twee poorten die hier hun enige toets hebben: de
   risicoklasse die eerst door een mens vastgesteld moet zijn voordat er een
   deelnemer bij mag, en de alias die uit de labpas komt en niet uit het lijf van
   het verzoek. */
test('het labpaspoort draagt de punten die in een onderzoek zijn verdiend', async () => {
  // De risicoklasse staat hier niet als opwarmertje maar als poort: zolang geen
  // mens hem heeft vastgesteld komt er geen deelnemer bij. Eerst dus de dichte
  // deur, dan het vaststellen, en dan pas de rest -- anders is die regel alleen
  // een stap in de opbouw en niet iets wat deze toets bewaakt.
  const zonderKlasse = await api('mens/bij', { id: OPEN, rol: 'buurtonderzoeker' });
  assert.equal(zonderKlasse.status, 409, 'zonder vastgestelde risicoklasse komt er niemand bij');
  assert.match(zonderKlasse.body.error, /risicoklasse/i, 'en de melding zegt welk gebrek eerst weg moet');

  const klasse = await moet('ethiek/klasse', { id: OPEN, klasse: 'laag', door: 'Dr. Vermeer' }, 'risicoklasse vaststellen');
  assert.equal(klasse.ethiek.klasse, 'laag', 'de klasse staat vast op wat er is gekozen');
  assert.equal(klasse.ethiek.vastgesteld, true, 'en is als door-een-mens-vastgesteld gemerkt');

  const kader = await moetPub('bewoner/kader', {}, 'kader voor de puntentabel');
  PUNTEN = kader.spel.punten.interview;
  assert.ok(PUNTEN > 0, 'een interview levert punten op');

  PASPOORT = (await moetPub('bewoner/paspoort-maak', { labId: LAB, naam: 'Sam' }, 'paspoort maken')).paspoort.code;

  const leeg = await moetPub('bewoner/paspoort', { pas: PASPOORT }, 'vers paspoort lezen');
  assert.equal(leeg.paspoort.naam, 'Sam', 'het paspoort draagt de roepnaam en geen echte naam');
  assert.equal(leeg.paspoort.punten, 0, 'een vers paspoort begint op nul');
  assert.equal(leeg.paspoort.niveau, 1);
  assert.deepEqual(leeg.paspoort.badges, [], 'en zonder badges');
  assert.ok(leeg.missies.length, 'de missies staan erbij, anders weet de drager niet wat er te halen valt');

  const d = (await moet('mens/bij', { id: OPEN, rol: 'buurtonderzoeker', paspoort: PASPOORT }, 'deelnemer met paspoort')).deelnemer;
  PAS = d.pas; ALIAS = d.alias;

  /* De observatie gaat met opzet de deur in met een VREEMDE naam in het lijf.
     De kop van routes/livinglab/bewoner.js zegt dat de alias uit de pas komt en
     nooit uit de body (regel 8 van de lat): aliassen staan in het teambeeld, dus
     wie er een raadt zou anders op andermans naam kunnen insturen en diens
     punten opstrijken. Die regel is een enkele Object.assign in de route; zonder
     deze bewering mist niemand hem als hij sneuvelt. */
  const obs = await moetPub('mijn/observatie', { pas: PAS, methode: 'interview',
    door: 'BW-VREEMDE', alias: 'BW-VREEMDE',
    wat: 'Twee wandelaars zeggen dat ze het pad na zonsondergang mijden.' }, 'observatie via de labpas');
  assert.equal(obs.observatie.door, ALIAS,
    'de observatie staat op de alias van de pas en niet op de naam die de inzender zelf meestuurde');

  const na = await moetPub('bewoner/paspoort', { pas: PASPOORT.toLowerCase() }, 'paspoort in kleine letters');
  assert.equal(na.paspoort.punten, PUNTEN, 'de punten uit de studie staan op het paspoort');
  assert.equal(na.paspoort.volgende.teGaan, leeg.paspoort.volgende.teGaan - PUNTEN,
    'en het volgende niveau is precies die punten dichterbij');

  const onbekend = await pub('bewoner/paspoort', { pas: 'LABPAS-BESTAATNIET' });
  assert.equal(onbekend.status, 404, 'een code die niemand heeft, geeft niets');
});

/* De klachtenprocedure, van allebei de kanten. Het punt van deze laag is niet
   dat er een klacht wordt opgeslagen maar dat hij BIJT: zolang hij open staat
   komt er geen deelnemer meer bij, en hij is niet weg te klikken -- afsluiten
   vraagt een tekenbevoegde EN een antwoord. Alle drie de eigenschappen worden
   hier los nagegaan, want elk ervan kan sneuvelen zonder de andere. */
test('een klacht blokkeert het onderzoek tot een tekenbevoegde hem beantwoordt', async () => {
  const dun = await pub('bewoner/klacht', { id: OPEN, tekst: 'slecht' });
  assert.equal(dun.status, 400, 'een klacht zonder inhoud is niet te behandelen');

  const geenStudie = await pub('bewoner/klacht', { id: 'bestaatniet', tekst: 'Er werd niet uitgelegd waarom ik meedeed.' });
  assert.equal(geenStudie.status, 404, 'een klacht hangt aan een bestaand onderzoek');

  const k = await moetPub('bewoner/klacht', { id: OPEN, alias: 'BW-KLAGER',
    tekst: 'Er stond iemand met een klembord bij mijn deur die niet zei dat dit onderzoek was.' }, 'klacht indienen');
  KLACHT = k.klacht.id;
  assert.equal(k.klacht.status, 'open', 'een klacht komt binnen als open');

  const dicht = await api('mens/bij', { id: OPEN, rol: 'buurtonderzoeker' });
  assert.equal(dicht.status, 409, 'met een open klacht komt er niemand meer bij');
  assert.match(dicht.body.error, /klacht/i, 'en de melding zegt waarom');

  const vreemd = await api('ethiek/klacht-af', { id: OPEN, klachtId: KLACHT, door: 'Sam Bewoner',
    antwoord: 'Wij hebben dit intern besproken en het is opgelost.' });
  assert.equal(vreemd.status, 403, 'wie niet in het tekenaarsregister staat, handelt geen klacht af');

  const zoek = await api('ethiek/klacht-af', { id: OPEN, klachtId: 'bestaatniet', door: 'Dr. Vermeer',
    antwoord: 'Wij hebben dit besproken met de betrokken onderzoeker.' });
  assert.equal(zoek.status, 404, 'een klacht die niet bestaat');

  const wegklik = await api('ethiek/klacht-af', { id: OPEN, klachtId: KLACHT, door: 'Dr. Vermeer', antwoord: 'ok' });
  assert.equal(wegklik.status, 400, 'afsluiten zonder antwoord is wegklikken');

  const af = await moet('ethiek/klacht-af', { id: OPEN, klachtId: KLACHT, door: 'Dr. Vermeer',
    antwoord: 'De onderzoeker is erop aangesproken; bij elke deur wordt nu eerst de onderzoeksbrief gegeven.' }, 'klacht afhandelen');
  assert.equal(af.klacht.status, 'afgehandeld');

  // het gevolg, langs twee andere routes teruggelezen
  await moet('mens/bij', { id: OPEN, rol: 'buurtonderzoeker' }, 'met de klacht afgehandeld mag het weer');
  const dossier = await moet('studie', { id: OPEN }, 'het dossier als staf');
  const rij = dossier.studie.klachtenLijst.find(x => x.id === KLACHT);
  assert.equal(rij.status, 'afgehandeld', 'de klacht staat afgehandeld in het dossier');
  assert.match(rij.antwoord, /onderzoeksbrief/, 'met het antwoord dat er is gegeven');
});

/* Stilleggen is de knop die bij een stopcriterium hoort, en hij is met opzet aan
   EEN rol gebonden. Twee dingen die deze toets vasthoudt: een professional is
   geen toezichthouder (de rolcheck staat in de kern, niet in de route), en een
   stilgelegd onderzoek VERZAMELT NIETS MEER. Dat laatste wordt via de labpas van
   de bewoner nagegaan, en na het hervatten nog een keer -- anders bewijst de 409
   niet dat hij van het stilleggen kwam. */
test('alleen de toezichthouder legt een onderzoek stil, en dan wordt er niets meer verzameld', async () => {
  const prof = await api('ethiek/stilleggen', { id: OPEN, door: 'Dr. Vermeer',
    reden: 'Ik vind dat we hier even mee moeten stoppen.' });
  assert.equal(prof.status, 403, 'een professional legt niet stil; dat doet de toezichthouder');

  const zonderReden = await api('ethiek/stilleggen', { id: OPEN, door: 'M. de Wit', reden: 'nee' });
  assert.equal(zonderReden.status, 400, 'stilleggen zonder reden staat nergens in het spoor');

  const geenStudie = await api('ethiek/stilleggen', { id: 'bestaatniet', door: 'M. de Wit',
    reden: 'Er is een melding binnengekomen over de werving.' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');

  const stil = await moet('ethiek/stilleggen', { id: OPEN, door: 'M. de Wit',
    reden: 'Melding over de werving aan de deur; eerst uitzoeken voordat er verder wordt gemeten.' }, 'stilleggen');
  assert.equal(stil.stilgelegd.door, 'M. de Wit');
  assert.match(stil.stilgelegd.reden, /werving/);

  const tijdens = await pub('mijn/observatie', { pas: PAS, wat: 'Vanavond liepen er weer twee mensen om het pad heen.' });
  assert.equal(tijdens.status, 409, 'een stilgelegd onderzoek verzamelt niets meer');
  assert.match(tijdens.body.error, /stilgelegd/i);

  const weer = await moet('ethiek/stilleggen', { id: OPEN, door: 'M. de Wit', hervat: true,
    reden: 'De werving is aangepast en met de melder besproken.' }, 'hervatten');
  assert.equal(weer.stilgelegd, null, 'na hervatten staat er geen stilstand meer');

  const nogeens = await api('ethiek/stilleggen', { id: OPEN, door: 'M. de Wit', hervat: true,
    reden: 'De werving is aangepast en met de melder besproken.' });
  assert.equal(nogeens.status, 409, 'een onderzoek dat loopt, valt niet te hervatten');

  await moetPub('mijn/observatie', { pas: PAS, wat: 'Na het hervatten weer twee wandelaars op het pad gezien.' },
    'na hervatten mag er weer verzameld worden');
});

/* De coach mag meedenken over WAT er te concluderen valt, maar niet over hoe
   hard het is. Deze toets legt allebei de kanten vast: er komt echt een conclusie
   in het dossier (teruggelezen langs /api/lab2/studie), en die conclusie is een
   VOORSTEL op de laagste graad die nog geen millimeter opgetild kan worden
   zolang er niets onder ligt. Zonder AI-sleutel loopt dit langs het vaste advies
   van de coach, en dat hoort net zo goed te werken. */
test('de coach stelt een conclusie voor, maar tilt hem niet op', async () => {
  const geenStudie = await api('coach/conclusie', { id: 'bestaatniet', vraag: 'Wat kunnen we hieruit zeggen?' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');

  const v = await moet('coach/conclusie', { id: OPEN, vraag: 'Wat kunnen we voorzichtig zeggen over het pad?' }, 'conclusievoorstel');
  assert.equal(v.conclusie.voorstel, true, 'hij komt binnen als voorstel en niet als vaststelling');
  assert.equal(v.conclusie.graad, 'aanname', 'op de laagste graad');
  assert.deepEqual(v.conclusie.bewijs, [], 'zonder dragers');
  assert.equal(v.conclusie.tekenaar, null, 'en zonder handtekening');
  assert.match(v.conclusie.door, /^coach \(voorstel van /, 'in het dossier staat dat de coach hem voorstelde');
  assert.equal(v.plafond, 'aanname', 'en het plafond staat er eerlijk bij');

  const optillen = await api('bewijs/graad', { id: OPEN, conclusieId: v.conclusie.id, graad: 'waarneming' });
  assert.equal(optillen.status, 409, 'zonder een enkele drager komt een voorstel niet hoger');
  assert.match(optillen.body.error, /hoogstens/i);
  assert.equal(optillen.body.plafond, 'aanname');

  const dossier = await moet('studie', { id: OPEN }, 'dossier lezen');
  const c = dossier.studie.conclusies.find(x => x.id === v.conclusie.id);
  assert.ok(c, 'het voorstel staat echt in het dossier en niet alleen in het antwoord');
  assert.equal(c.voorstel, true, 'ook daar als voorstel gemerkt');
});

/* Het apparatuurregister. De lijst is de enige route die toont wat er in een lab
   staat, en hij loopt langs een projectie (pub() in kern/livinglab/apparatuur.js)
   die met opzet minder teruggeeft dan de opslag heeft: van een bevoegdheid gaan
   alleen `wie` en `tot` mee, niet wanneer iemand zijn instructie kreeg en wie
   hem verleende. Wie hier de rij ongefilterd teruggeeft, merkt niets -- behalve
   deze toets. */
test('het apparatuurregister toont wat er staat, en niet wie wanneer instructie kreeg', async () => {
  APP = (await moet('app/maak', { labId: LAB, naam: 'Werkbank W-2', soort: 'werkbank', plek: 'Achterzaal' }, 'apparaat')).apparaat.id;

  const geenLab = await api('app/lijst', { id: 'bestaatniet' });
  assert.equal(geenLab.status, 404, 'apparatuur van een lab dat niet bestaat');

  const l1 = await moet('app/lijst', { id: LAB }, 'apparatuurlijst');
  assert.ok(l1.soorten.includes('werkbank'), 'de soortenlijst komt mee, zodat het scherm niets kan aanbieden dat de server weigert');
  const a1 = l1.apparatuur.find(a => a.id === APP);
  assert.equal(a1.naam, 'Werkbank W-2');
  assert.equal(a1.actief, true, 'een vers apparaat staat in de roulatie');
  assert.equal(a1.uit, null, 'en is niet uitgegeven');
  assert.deepEqual(a1.bevoegd, [], 'er is nog niemand bevoegd op');

  await moet('app/bevoegd', { id: APP, wie: 'Dr. Vermeer', tot: '2099-01-01', instructieOp: '2026-08-01' }, 'bevoegdheid');
  const l2 = await moet('app/lijst', { id: LAB }, 'apparatuurlijst opnieuw');
  const b = l2.apparatuur.find(a => a.id === APP).bevoegd[0];
  assert.equal(b.wie, 'Dr. Vermeer');
  assert.equal(b.tot, '2099-01-01', 'met de einddatum, want daar draait de bevoegdheid op');
  assert.deepEqual(Object.keys(b).sort(), ['tot', 'wie'],
    'en verder niets: instructiedatum en verlener blijven binnen het register');
});

/* Intrekken is hier iets anders dan wissen: de reservering BLIJFT in het
   dossier van de studie staan (de kalibratiestand van toen hoort bij het
   experiment dat eraan hing) en wordt alleen gemerkt als ingetrokken. Deze
   toets houdt allebei die kanten vast -- de rij is er nog, en hij staat als weg
   gemerkt -- en reserveert daarna dezelfde dagen opnieuw, want vrijgeven dat
   niet vrijgeeft is geen vrijgeven.

   Wat hij NIET aantoont, en dat hoort erbij: in het geheugen is de rij bij het
   apparaat hetzelfde object als de rij in het dossier, dus dat allebei de kanten
   het merkje dragen is hier geen twee keer schrijven maar een keer. Pas na een
   herstart, als de opslag weer twee losse objecten oplevert, is dat een echte
   tweede plek. Deze toets meet dus dat er GEMERKT wordt, niet dat het op twee
   plekken gebeurt. */
test('een ingetrokken reservering verdwijnt ook uit het dossier en geeft de dagen echt vrij', async () => {
  const r = await moet('app/reserveer', { id: APP, studieId: OPEN, van: '2026-11-02', tot: '2026-11-04',
    door: 'Dr. Vermeer' }, 'reservering');
  const RES = r.reservering.id;

  const bezet = await api('app/reserveer', { id: APP, studieId: OPEN, van: '2026-11-03', tot: '2026-11-05', door: 'Dr. Vermeer' });
  assert.equal(bezet.status, 409, 'dezelfde dagen zijn nu bezet');

  const geenApparaat = await api('app/reservering-weg', { id: 'bestaatniet', reserveringId: RES });
  assert.equal(geenApparaat.status, 404, 'een apparaat dat niet bestaat');
  const geenRes = await api('app/reservering-weg', { id: APP, reserveringId: 'bestaatniet' });
  assert.equal(geenRes.status, 404, 'een reservering die niet bestaat');

  await moet('app/reservering-weg', { id: APP, reserveringId: RES }, 'reservering intrekken');

  const dossier = await moet('studie', { id: OPEN }, 'dossier lezen');
  const kopie = dossier.studie.reserveringen.find(x => x.id === RES);
  assert.ok(kopie, 'de reservering blijft als historie in het dossier staan');
  assert.ok(kopie.weg, 'maar staat daar ook als ingetrokken gemerkt');

  await moet('app/reserveer', { id: APP, studieId: OPEN, van: '2026-11-02', tot: '2026-11-04',
    door: 'Dr. Vermeer' }, 'dezelfde dagen zijn weer vrij');
});

/* Uitgifte is een ander feit dan een reservering: dit gaat over wie het ding
   fysiek in handen heeft. De twee poorten die hier gelden -- alleen aan iemand
   die bevoegd is, en maar aan een tegelijk -- worden allebei aangeraakt, en de
   stand wordt teruggelezen via de lijst en niet via het antwoord van de
   uitgifte zelf. */
test('uitgifte volgt de bevoegdheid, en een apparaat gaat maar aan een tegelijk mee', async () => {
  const naamloos = await api('app/uitgifte', { id: APP });
  assert.equal(naamloos.status, 400, 'aan wie wordt dit uitgegeven?');

  const onbevoegd = await api('app/uitgifte', { id: APP, aan: 'Piet Passant' });
  assert.equal(onbevoegd.status, 403, 'wie niet bevoegd is, krijgt het apparaat niet mee');

  const uit = await moet('app/uitgifte', { id: APP, aan: 'Dr. Vermeer' }, 'uitgifte');
  assert.equal(uit.apparaat.uit.aan, 'Dr. Vermeer');

  const nogeens = await api('app/uitgifte', { id: APP, aan: 'Dr. Vermeer' });
  assert.equal(nogeens.status, 409, 'een apparaat dat al uit is, gaat niet nog een keer de deur uit');

  const lijst = await moet('app/lijst', { id: LAB }, 'apparatuurlijst');
  assert.equal(lijst.apparatuur.find(a => a.id === APP).uit.aan, 'Dr. Vermeer',
    'het register laat zien wie het nu heeft');

  const terug = await moet('app/uitgifte', { id: APP, terug: true }, 'innemen');
  assert.equal(terug.apparaat.uit, null, 'ingenomen is echt ingenomen');

  const weer = await api('app/uitgifte', { id: APP, terug: true });
  assert.equal(weer.status, 409, 'wat al binnen is, kan niet nog eens terugkomen');
});

/* Een open storing haalt het apparaat uit de roulatie, en het sluiten van die
   melding zet hem terug. Dat "terugzetten" is de regel die stil kan sneuvelen:
   de melding gaat dicht, het apparaat blijft op inactief staan en niemand kan
   nog reserveren zonder te begrijpen waarom. Daarom staat er aan beide kanten
   een reservering: een die moet stranden en een die moet lukken. */
test('een open storing haalt het apparaat uit de roulatie tot de melding dicht is', async () => {
  const st = await moet('app/onderhoud', { id: APP, wat: 'De klem van de werkbank slipt onder belasting',
    soort: 'storing' }, 'storing melden');
  MELDING = st.apparaat.onderhoud[0].id;
  assert.equal(st.apparaat.actief, false, 'een open storing zet het apparaat uit de roulatie');

  const l1 = await moet('app/lijst', { id: LAB }, 'apparatuurlijst');
  assert.equal(l1.apparatuur.find(a => a.id === APP).actief, false, 'en dat is in het register te zien');

  const kapot = await api('app/reserveer', { id: APP, studieId: OPEN, van: '2026-12-01', tot: '2026-12-02', door: 'Dr. Vermeer' });
  assert.equal(kapot.status, 409, 'met een open storing valt er niets te reserveren');
  assert.match(kapot.body.error, /storing|roulatie/i);

  const geenMelding = await api('app/storing-op', { id: APP, meldingId: 'bestaatniet' });
  assert.equal(geenMelding.status, 404, 'een melding die niet bestaat');
  const geenApparaat = await api('app/storing-op', { id: 'bestaatniet', meldingId: MELDING });
  assert.equal(geenApparaat.status, 404, 'een apparaat dat niet bestaat');

  const op = await moet('app/storing-op', { id: APP, meldingId: MELDING, hoe: 'Klem vervangen en nagetrokken' }, 'storing sluiten');
  assert.equal(op.apparaat.actief, true, 'het apparaat gaat terug in de roulatie');
  const melding = op.apparaat.onderhoud.find(x => x.id === MELDING);
  assert.equal(melding.open, false, 'de melding staat dicht');
  assert.equal(melding.hoe, 'Klem vervangen en nagetrokken', 'met hoe hij is opgelost, want dat is de waarde van de regel');

  const dubbel = await api('app/storing-op', { id: APP, meldingId: MELDING, hoe: 'Nog een keer' });
  assert.equal(dubbel.status, 409, 'een melding die al dicht staat, gaat niet nog eens dicht');

  await moet('app/reserveer', { id: APP, studieId: OPEN, van: '2026-12-01', tot: '2026-12-02',
    door: 'Dr. Vermeer' }, 'na de reparatie kan er weer gereserveerd worden');
});

/* DE REM OP DE SCHRIJFDEUREN, als laatste -- want hij vult zijn eigen bak.

   De bewonersdeuren gaan open zonder account, en de vier waarlangs INHOUD
   binnenkomt (een thema, een stem, een klacht, een paspoort) delen een rem van
   tien per minuut per bron. Dat is de enige grendel die daar staat: valt hij
   weg, dan kan een mens met een toetsenbord het themaregister van een lab
   volschrijven. De leesdeuren hebben een eigen, ruimere rem, en die hoort NIET
   mee dicht te gaan -- anders legt een enkele spammer het publieke beeld van het
   hele lab plat. Vandaar dat deze toets allebei meet.

   En hij telt na. Een rem die 429 antwoordt maar de vraag ondertussen toch
   wegschrijft, remt niets; daarom staat de eis op een exact aantal (het thema
   uit de vorige toets plus wat er voor de rem langskwam) en niet op "er staat
   nog wel iets". */
test('de schrijfrem knijpt, en de leesdeur blijft daarna gewoon open', async () => {
  let laatste = null, gelukt = 0, n = 0;
  for (; n < 20; n++) {
    laatste = await pub('bewoner/thema', { labId: LAB, vraag: 'Kan er een extra prullenbak bij het pad, nummer ' + n + '?' });
    if (laatste.status === 429) break;
    assert.equal(laatste.status, 200,
      'een nette vraag komt door of wordt geremd, iets anders hoort er niet te gebeuren -- ' + (laatste.body.error || ''));
    gelukt++;
  }
  assert.equal(laatste.status, 429, 'de schrijfrem knijpt binnen twintig pogingen');
  assert.match(laatste.body.error, /rustig|verzoeken/i, 'en zegt wat er aan de hand is');

  const lezen = await moetPub('bewoner/themas', { labId: LAB }, 'de leesdeur blijft open');
  assert.equal(lezen.totaal, 1 + gelukt,
    'het register bevat precies het eerste thema plus wat er voor de rem langs kwam: een geremde vraag is ook echt niet opgeslagen');
});
