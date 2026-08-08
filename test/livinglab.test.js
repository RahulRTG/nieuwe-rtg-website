/* Het RTF Living Lab: de onderzoekscyclus met haar poorten, de ethieklaag, de
   bewijsmotor, de scheiding van onderzoeksdata, de apparatuurpoort en de
   pijplijn naar echte verandering. Draai los:
   node --experimental-sqlite --test test/livinglab.test.js

   Wat deze toetsen bewaken is niet "werkt de knop" maar "houdt de belofte". Elke
   test hieronder hoort te ZAKKEN als de bijbehorende poort wegvalt; waar dat
   niet vanzelf spreekt, staat de mutatie erbij die is gedaan om het na te gaan
   (regel 2 van de lat). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-livinglab-'));

const api = (pad, body) => fetch(base + '/api/lab2/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
// zonder inlog: de bewonersdeuren
const pub = (pad, body) => fetch(base + '/api/lab2/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

// kort: doe iets en eis dat het lukt, met de foutmelding in de assert-tekst
async function moet(pad, body, wat) {
  const r = await api(pad, body);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || ''));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LIVINGLAB-KEURING-1' } });
  base = srv.base;
  const login = await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'LIVINGLAB-KEURING-1' })
  });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let LAB, SOC, TECH;

test('het lab is dicht zonder inlog, en het kader komt uit één tabel', async () => {
  const dicht = await pub('kader');
  assert.equal(dicht.status, 401, 'zonder kantoorsessie blijft het lab dicht');

  const k = await moet('kader', {}, 'het kader komt door');
  assert.equal(k.cyclus.length, 10, 'tien stappen in de cyclus');
  assert.equal(k.soorten.length, 12, 'twaalf projectsoorten, veel breder dan techniek');
  assert.equal(k.methoden.length, 12, 'twaalf methoden in de bibliotheek');
  assert.equal(k.bewijs.length, 5, 'vijf bewijsgraden');
  assert.equal(k.risico.length, 4, 'vier risicoklassen');
  // de sociale kant is geen tweederangs burger: welzijn en cohesie staan er
  // gewoon in, met dezelfde motor eronder
  for (const s of ['welzijn', 'cohesie', 'gedrag', 'kunst', 'mobiliteit', 'economie'])
    assert.ok(k.soorten.some(x => x.soort === s), s + ' is een projectsoort');

  LAB = (await moet('lab/maak', { stad: 'Haarlem', naam: 'Living Lab Haarlem' }, 'lab aanmaken')).lab.id;
  await moet('lab/tekenaar', { id: LAB, naam: 'Dr. Vermeer', rol: 'professional' }, 'tekenaar');
  await moet('lab/tekenaar', { id: LAB, naam: 'Prof. Aziz', rol: 'reviewer', onafhankelijk: true }, 'onafhankelijke reviewer');
  await moet('lab/tekenaar', { id: LAB, naam: 'M. de Wit', rol: 'toezichthouder' }, 'toezichthouder');

  const geen = await api('lab/tekenaar', { id: LAB, naam: 'Sam Bewoner', rol: 'buurtonderzoeker' });
  assert.equal(geen.status, 400, 'een buurtonderzoeker krijgt geen tekenbevoegdheid');
});

test('een lab kan de RTF-bewaarondergrens niet lokaal onderschrijden', async () => {
  const laag = await api('lab/zet', { id: LAB, bewaarMaanden: 3 });
  assert.equal(laag.status, 400, 'onder de ondergrens weigert hij');
  assert.match(laag.body.error, /ondergrens/i);
  // en hij past hem NIET stil aan: het lab houdt wat het had
  const labs = await moet('labs', {}, 'labs lezen');
  assert.ok(labs.labs.find(l => l.id === LAB).bewaarMaanden >= labs.centraal.bewaarMin,
    'de bewaartermijn blijft op of boven de ondergrens');
  await moet('lab/zet', { id: LAB, bewaarMaanden: 60 }, 'omhoog mag lokaal wel');
});

test('de cyclus slaat geen stap over en gaat nooit terug', async () => {
  SOC = (await moet('studie/maak', { labId: LAB, titel: 'Buurttuin en eenzaamheid', soort: 'cohesie',
    vraagstuk: 'Vermindert een gezamenlijke buurttuin de ervaren eenzaamheid in de Kerkstraat?',
    doel: 'Weten of samen tuinieren helpt' }, 'sociale studie')).studie.id;

  const spring = await api('studie/stap', { id: SOC, stap: 'plan' });
  assert.equal(spring.status, 400, 'van vraagstuk direct naar plan mag niet');

  const wens = await api('plan/hypothese', { id: SOC, tekst: 'Een buurttuin vermindert eenzaamheid' });
  assert.equal(wens.status, 400, 'een hypothese zonder tegendeel is een wens');
  assert.match(wens.body.error, /tegendeel/i);

  await moet('plan/hypothese', { id: SOC, tekst: 'Wekelijks samen tuinieren verlaagt de ervaren eenzaamheid.',
    tegendeel: 'Als de eenzaamheidsscore na drie maanden gelijk of hoger is dan in de vergelijkingsstraat.' }, 'hypothese');
  await moet('studie/stap', { id: SOC, stap: 'hypothese' }, 'naar hypothese');
  await moet('studie/stap', { id: SOC, stap: 'plan' }, 'naar plan');

  const terug = await api('studie/stap', { id: SOC, stap: 'hypothese' });
  assert.equal(terug.status, 409, 'de cyclus gaat niet terug');
  assert.match(terug.body.error, /niet terug/i);
});

test('het plan rekent de steekproef na, en de methode bepaalt wat het kan dragen', async () => {
  const advies = await moet('plan/advies', { methoden: ['enquete', 'interview'] }, 'advies');
  assert.equal(advies.minSteekproef, 30, 'een enquête vraagt minstens 30');
  assert.equal(advies.hoogstBewijs, 'indicatie', 'enquête + interview dragen hoogstens een indicatie');

  const klein = await api('plan/zet', { id: SOC, methoden: ['enquete'], steekproef: 8, meetmomenten: 1,
    doel: 'Eenzaamheid meten voor en na' });
  assert.equal(klein.status, 400, 'acht mensen is geen enquête');
  assert.match(klein.body.error, /kleinste steekproef/i);

  await moet('plan/zet', { id: SOC, methoden: ['enquete', 'interview'], steekproef: 30, meetmomenten: 2,
    doel: 'De eenzaamheidsscore voor en na drie maanden vergelijken' }, 'plan');
});

test('geen deelnemers zonder ethiek, en de poort noemt ALLE gebreken', async () => {
  const dicht = await api('studie/stap', { id: SOC, stap: 'deelnemers' });
  assert.equal(dicht.status, 409, 'zonder ethiek geen deelnemers');
  assert.ok(dicht.body.gebreken.length >= 4, 'de poort geeft alle gebreken, niet alleen de eerste: ' + JSON.stringify(dicht.body.gebreken));

  // en de poort staat OOK op de deelnemersroute zelf, niet alleen op de stap --
  // een poort met een omweg ernaast is geen poort
  const omweg = await api('mens/bij', { id: SOC, rol: 'buurtonderzoeker' });
  assert.equal(omweg.status, 409, 'de ethiekpoort geldt ook op de directe route');

  await moet('ethiek/klasse', { id: SOC, klasse: 'midden', door: 'Dr. Vermeer' }, 'klasse vaststellen');

  const vreemd = await api('ethiek/review', { id: SOC, door: 'Jan Onbekend', oordeel: 'akkoord' });
  assert.equal(vreemd.status, 403, 'een naam die niet in het tekenaarsregister staat, tekent niet');

  await moet('ethiek/review', { id: SOC, door: 'Dr. Vermeer', oordeel: 'akkoord' }, 'review');
  await moet('ethiek/privacy', { id: SOC, velden: ['leeftijdsgroep', 'eenzaamheidsscore'],
    grondslag: 'Toestemming van de deelnemer zelf', weggelaten: 'Geen naam, geen adres, geen inkomen',
    door: 'Dr. Vermeer' }, 'privacytoets');
  await moet('ethiek/toestemming', { id: SOC, regime: 'schriftelijk',
    tekst: 'U doet mee aan een onderzoek naar samen tuinieren. U kunt altijd stoppen.' }, 'toestemming');
  await moet('ethiek/stopcriterium', { id: SOC,
    tekst: 'Bij een deelnemer die aangeeft zich slechter te voelen door deelname stoppen we direct.' }, 'stopcriterium');
  await moet('studie/stap', { id: SOC, stap: 'deelnemers' }, 'nu mag het wel');
});

test('een privacytoets zonder "wat laten we weg" bestaat niet', async () => {
  const zonder = await api('ethiek/privacy', { id: SOC, velden: ['alles'], grondslag: 'Omdat het handig is',
    door: 'Dr. Vermeer' });
  assert.equal(zonder.status, 400, 'gegevensminimalisatie begint bij wat je weglaat');
  assert.match(zonder.body.error, /WEG/i);
});

let PAS, ALIAS;
test('een deelnemer krijgt een studie-eigen pseudoniem en een eigen labpas', async () => {
  const d = await moet('mens/bij', { id: SOC, rol: 'buurtonderzoeker', toestemming: true }, 'deelnemer');
  PAS = d.deelnemer.pas; ALIAS = d.deelnemer.alias;
  assert.match(ALIAS, /^BW-/, 'een alias en geen naam');
  assert.match(PAS, /^LABPAS-/, 'een eigen labpas');

  const mijn = await pub('mijn', { pas: PAS });
  assert.equal(mijn.status, 200, 'de bewoner opent zijn onderzoek zonder account');
  assert.equal(mijn.body.alias, ALIAS);
  assert.ok(mijn.body.watNu, 'hij ziet wat er nu moet gebeuren');

  const fout = await pub('mijn', { pas: 'LABPAS-ZZZZZZZ' });
  assert.equal(fout.status, 404, 'een onbekende pas geeft niets');
});

test('een observatie draagt de alias van de PAS, niet die uit het lijf', async () => {
  // de aanval: iemand die een alias kent (die staat in het teambeeld) stuurt een
  // observatie in op naam van een ander en strijkt diens punten op
  const r = await pub('mijn/observatie', { pas: PAS, wat: 'Nulmeting: gemiddelde eenzaamheidsscore 6,4',
    methode: 'enquete', door: 'BW-IEMANDANDERS' });
  assert.equal(r.status, 200, 'de observatie komt binnen');
  assert.equal(r.body.observatie.door, ALIAS, 'de alias komt uit de pas en niet uit de body');
});

test('een experiment begint niet met een halve steekproef', async () => {
  // het plan gaat uit van dertig deelnemers; er staat er tot nu toe één
  const tekort = await api('studie/stap', { id: SOC, stap: 'experiment' });
  assert.equal(tekort.status, 409, 'met één van de dertig deelnemers begint het experiment niet');
  assert.match(tekort.body.error, /30 deelnemers/, 'en de melding noemt het verschil');

  for (let i = 1; i < 30; i++) {
    const d = await api('mens/bij', { id: SOC, rol: i < 25 ? 'buurtonderzoeker' : 'onderzoeker', toestemming: true });
    assert.equal(d.status, 200, 'deelnemer ' + i + ' -- ' + (d.body.error || ''));
  }
});

test('de bewijsmotor: een verhaal wordt geen feit', async () => {
  await moet('studie/stap', { id: SOC, stap: 'experiment' }, 'naar experiment');
  await moet('studie/stap', { id: SOC, stap: 'observaties' }, 'naar observaties');
  const o1 = (await moet('bewijs/observatie', { id: SOC, wat: 'Bewoner kent nu twee buren bij naam', methode: 'interview' }, 'observatie')).observatie;
  const ds = (await moet('bewijs/dataset', { id: SOC, naam: 'Eenzaamheidsscores meetmoment 1 en 2', rijen: 60 }, 'dataset')).dataset;
  await moet('studie/stap', { id: SOC, stap: 'reflectie' }, 'naar reflectie');
  await moet('bewijs/reflectie', { id: SOC, soort: 'misging', tekst: 'Meetmoment 2 viel in de vakantie; acht deelnemers waren weg.' }, 'reflectie');
  await moet('studie/stap', { id: SOC, stap: 'resultaten' }, 'naar resultaten');

  const c = (await moet('bewijs/conclusie', { id: SOC, tekst: 'Samen tuinieren verlaagt de ervaren eenzaamheid in deze straat.' }, 'conclusie')).conclusie;
  assert.equal(c.graad, 'aanname', 'een conclusie begint als aanname');

  const meteen = await api('bewijs/graad', { id: SOC, conclusieId: c.id, graad: 'bewezen', door: 'Dr. Vermeer' });
  assert.equal(meteen.status, 409, 'zonder dragers is niets bewezen');

  // een bron die niemand heeft nagetrokken draagt niets
  const bron = (await moet('plan/bron', { id: SOC, titel: 'Onderzoek naar buurtgroen en eenzaamheid', herkomst: 'Universiteit X' }, 'bron')).bron;
  const ongecheckt = await api('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'bron', ref: bron.id });
  assert.equal(ongecheckt.status, 409, 'een ongecontroleerde bron draagt geen conclusie');
  await moet('plan/bron-natrek', { id: SOC, bronId: bron.id, door: 'Dr. Vermeer', nagetrokken: true }, 'bron natrekken');

  // verwijzen naar bewijs dat niet bestaat is de stilste manier om het te verzinnen
  const verzonnen = await api('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'dataset', ref: 'bestaatniet' });
  assert.equal(verzonnen.status, 404, 'een verwijzing naar iets dat er niet is, wordt nagetrokken');

  await moet('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'observatie', ref: o1.id }, 'bewijs 1');
  await moet('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'dataset', ref: ds.id }, 'bewijs 2');
  await moet('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'bron', ref: bron.id }, 'bewijs 3');

  // MENSELIJK ONDERWERP: hier ligt de handtekeninggrens een trede lager
  const zonderMens = await api('bewijs/graad', { id: SOC, conclusieId: c.id, graad: 'indicatie' });
  assert.equal(zonderMens.status, 409, 'bij een menselijk onderwerp vraagt een indicatie al een handtekening');
  assert.match(zonderMens.body.error, /handtekening/i);

  const getekend = await moet('bewijs/graad', { id: SOC, conclusieId: c.id, graad: 'indicatie', door: 'Dr. Vermeer' }, 'indicatie met handtekening');
  assert.equal(getekend.conclusie.graad, 'indicatie');

  /* DE REGRESSIE. Bewijs TOEVOEGEN mag een conclusie nooit verlagen. In de
     eerste versie wel: de handtekening werd weggegooid zodra de graad hem niet
     "strikt" nodig had, waarna de herijking het plafond opnieuw verlaagde en de
     conclusie een trede zakte -- juist doordat er bewijs bij kwam. De mutatie
     (c.tekenaar = doel.mens ? tekenaar : null) laat deze toets zakken op
     "waarneming". */
  const o2 = (await moet('bewijs/observatie', { id: SOC, wat: 'Tweede meetronde laat lagere scores zien', methode: 'enquete' }, 'observatie 2')).observatie;
  const na = await moet('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'observatie', ref: o2.id }, 'extra bewijs');
  assert.equal(na.conclusie.graad, 'indicatie', 'extra bewijs mag een conclusie nooit VERLAGEN');

  // en weghalen moet hem wél laten zakken, anders bewijst de vorige regel niets
  await moet('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'dataset', ref: ds.id, weg: true }, 'dataset eraf');
  const eraf = await moet('bewijs/koppel', { id: SOC, conclusieId: c.id, soort: 'bron', ref: bron.id, weg: true }, 'bron eraf');
  assert.equal(eraf.conclusie.graad, 'waarneming', 'bewijs weghalen laat de conclusie wél zakken');
  assert.equal(eraf.conclusie.tekenaar, null, 'en de handtekening vervalt met de graad die hij droeg');
});

test('een gescheiden studie legt geen enkele koppeling vast en toont niets publiek', async () => {
  const g = (await moet('studie/maak', { labId: LAB, titel: 'Schuldhulp en stress bij jongeren', soort: 'welzijn',
    vraagstuk: 'Helpt vroege schuldhulp bij kinderen in gezinnen met geldzorgen tegen stress?' }, 'gevoelige studie')).studie;
  // de bodem uit het onderwerp: kind + schuld tilt hem naar hoog
  assert.equal(g.klasse, 'hoog', 'kinderen en schulden tillen de risicoklasse omhoog');
  assert.equal(g.gescheiden, true, 'en daarmee wordt de data gescheiden gehouden');

  // het publieke beeld verraadt de vraagstelling niet: juist die zegt wie de
  // deelnemers zijn
  const open = await pub('bewoner/studie', { id: g.id });
  assert.equal(open.status, 200);
  assert.equal(open.body.studie.titel, 'Schuldhulp en stress bij jongeren', 'de titel mag');
  assert.equal(open.body.studie.vraagstuk, undefined, 'het vraagstuk niet: dat verraadt de deelnemers');
  assert.equal(open.body.magTeam, false, 'een voorbijganger zit niet op het team');

  // verlagen kan niet zomaar, en al helemaal niet zonder reden
  const stiekem = await api('ethiek/klasse', { id: g.id, klasse: 'laag', door: 'Sam Bewoner' });
  assert.equal(stiekem.status, 403, 'alleen een tekenbevoegde verlaagt een risicoklasse');
  const zonderReden = await api('ethiek/klasse', { id: g.id, klasse: 'laag', door: 'Dr. Vermeer' });
  assert.equal(zonderReden.status, 400, 'verlagen kan alleen met een reden');

  // twee handtekeningen, waarvan één onafhankelijk
  await moet('ethiek/klasse', { id: g.id, klasse: 'hoog', door: 'Dr. Vermeer' }, 'klasse bevestigen');
  await moet('ethiek/privacy', { id: g.id, velden: ['leeftijdsgroep', 'stressscore'], grondslag: 'Toestemming plus ouderlijke toestemming',
    weggelaten: 'Geen naam, geen adres, geen schuldbedrag, geen schoolgegevens', door: 'Dr. Vermeer' }, 'privacytoets');
  await moet('ethiek/toestemming', { id: g.id, regime: 'schriftelijk', ouderlijk: true,
    tekst: 'Uw kind doet mee aan een onderzoek naar stress. U en uw kind kunnen altijd stoppen.' }, 'toestemming');
  await moet('ethiek/stopcriterium', { id: g.id, tekst: 'Bij tekenen van toenemende stress bij een deelnemer stoppen we direct.' }, 'stopcriterium');
  await moet('ethiek/review', { id: g.id, door: 'Dr. Vermeer', oordeel: 'akkoord' }, 'eerste handtekening');

  await moet('plan/hypothese', { id: g.id, tekst: 'Vroege schuldhulp verlaagt de ervaren stress bij kinderen.',
    tegendeel: 'Als de stressscore na een half jaar gelijk blijft aan die van de vergelijkingsgroep.' }, 'hypothese');
  await moet('studie/stap', { id: g.id, stap: 'hypothese' }, 'naar hypothese');
  await moet('studie/stap', { id: g.id, stap: 'plan' }, 'naar plan');
  await moet('plan/zet', { id: g.id, methoden: ['interview'], steekproef: 10, meetmomenten: 1,
    doel: 'De ervaren stress voor en na de hulp in kaart brengen' }, 'plan');

  const eenHandtekening = await api('studie/stap', { id: g.id, stap: 'deelnemers' });
  assert.equal(eenHandtekening.status, 409, 'klasse hoog vraagt twee akkoorden');
  await moet('ethiek/review', { id: g.id, door: 'Prof. Aziz', oordeel: 'akkoord' }, 'onafhankelijke tweede handtekening');
  await moet('studie/stap', { id: g.id, stap: 'deelnemers' }, 'met twee handtekeningen mag het');

  // en nu de kern van de scheiding: een deelnemer MET een Foundation-sleutel
  // levert geen koppeling op die het dossier uit lekt. Dat de koppelTABEL leeg
  // blijft, wordt hieronder in de kern zelf nagerekend -- dat is de enige plek
  // waar je in de opslag kunt kijken zonder er een endpoint voor te openen, en
  // een endpoint dat de koppeltabel toont is precies wat hier niet moet bestaan.
  const d = await moet('mens/bij', { id: g.id, rol: 'ervaringsdeskundige', toestemming: true,
    sleutel: 'foundation-sleutel-van-deze-persoon' }, 'deelnemer met sleutel');
  const dossier = await moet('studie', { id: g.id }, 'het volledige dossier als staf');
  assert.ok(!JSON.stringify(dossier).includes('foundation-sleutel-van-deze-persoon'),
    'de sleutel staat nergens in het dossier, ook niet voor de staf');

  // een labpaspoort zou juist die koppeling maken, en wordt dus geweigerd --
  // met uitleg, niet stil genegeerd
  const pasp = await pub('bewoner/paspoort-maak', { labId: LAB, naam: 'Sam' });
  assert.equal(pasp.status, 200);
  const weiger = await api('mens/bij', { id: g.id, rol: 'buurtonderzoeker', toestemming: true, paspoort: pasp.body.paspoort.code });
  assert.equal(weiger.status, 409, 'een paspoort koppelen kan niet bij een gescheiden studie');
  assert.match(weiger.body.error, /gescheiden/i);

  // terugtrekken werkt op de pas, dus ook zonder dat iemand weet wie het is
  const weg = await pub('mijn/terugtrekken', { pas: d.deelnemer.pas });
  assert.equal(weg.status, 200, 'de deelnemer trekt zich terug met zijn eigen pas');
  const na = await pub('mijn', { pas: d.deelnemer.pas });
  assert.equal(na.status, 404, 'daarna kent het lab de pas niet meer');
});

/* DE KOPPELTABEL, in de kern zelf nagerekend.

   Deze ene eigenschap is over HTTP niet te toetsen, en dat is met opzet: er is
   geen endpoint dat db.data.livingLabKoppel toont, want zo'n endpoint is exact
   het lek dat de scheiding moet voorkomen. Daarom draait deze toets de kern
   rechtstreeks, met een eigen db in het geheugen, en kijkt hij in de opslag.

   Hij toetst BEIDE kanten, want anders bewijst hij niets (regel 9): bij een
   gewone studie MOET er een koppelrij komen, bij een gescheiden studie NIET.
   Een toets die alleen de lege kant meet, blijft ook groen als het koppelen
   helemaal kapot is. */
test('de koppeling alias->sleutel bestaat alleen bij een niet-gescheiden studie', () => {
  const crypto = require('crypto');
  const db = { data: {} };
  const L = require('../server/kern/livinglab')({ db, save: () => {}, crypto, anthropic: null, lab: null }).livinglab;
  const lab = L.bestuur.labMaak({ stad: 'Delft', naam: 'Living Lab Delft' }, 'toets').lab;
  L.bestuur.tekenaarZet(lab.id, { naam: 'Dr. K', rol: 'professional' }, 'toets');

  const opzetten = (titel, soort, vraagstuk) => {
    const s = L.studie.studieMaak({ labId: lab.id, titel, soort, vraagstuk }, 'toets').studie;
    L.ethiek.klasseZet(s.id, { klasse: kl(s.id), door: 'Dr. K' });
    return s;
  };
  const kl = id => L.vindStudie(id).dossier.ethiek.klasse;

  // 1. een gewone studie (klasse laag): de koppeling wordt WEL vastgelegd
  const open = opzetten('Bankjes in het park', 'leefomgeving', 'Worden de bankjes in het park genoeg gebruikt?');
  assert.equal(L.vindStudie(open.id).dossier.ethiek.klasse, 'laag');
  const a = L.mensen.deelnemerBij(open.id, { rol: 'buurtonderzoeker', sleutel: 'sleutel-van-anna' }, 'toets');
  assert.ok(!a.error, 'deelnemer op de open studie -- ' + (a.error || ''));
  assert.equal(db.data.livingLabKoppel.filter(k => k.studieId === open.id).length, 1,
    'bij een gewone studie wordt de koppeling wel vastgelegd');

  // 2. een gevoelige studie (klasse hoog -> gescheiden): GEEN koppelrij
  const dicht = opzetten('Schuldhulp bij jongeren', 'welzijn', 'Helpt vroege schuldhulp bij kinderen met geldzorgen?');
  assert.equal(L.vindStudie(dicht.id).dossier.ethiek.klasse, 'hoog', 'kind + schuld tilt de klasse omhoog');
  L.ethiek.privacytoets(dicht.id, { velden: ['leeftijdsgroep'], grondslag: 'Toestemming van de deelnemer',
    weggelaten: 'Geen naam, geen adres, geen bedrag', door: 'Dr. K' });
  L.ethiek.toestemmingZet(dicht.id, { regime: 'schriftelijk', ouderlijk: true, tekst: 'U en uw kind kunnen altijd stoppen met dit onderzoek.' });
  L.ethiek.stopcriteriumZet(dicht.id, { tekst: 'Bij toenemende stress bij een deelnemer stoppen we direct.' });
  L.bestuur.tekenaarZet(lab.id, { naam: 'Rev. L', rol: 'reviewer', onafhankelijk: true }, 'toets');
  L.ethiek.reviewTeken(dicht.id, { door: 'Dr. K', oordeel: 'akkoord' });
  L.ethiek.reviewTeken(dicht.id, { door: 'Rev. L', oordeel: 'akkoord' });
  const b = L.mensen.deelnemerBij(dicht.id, { rol: 'ervaringsdeskundige', toestemming: true, sleutel: 'sleutel-van-bram' }, 'toets');
  assert.ok(!b.error, 'deelnemer op de gescheiden studie -- ' + (b.error || ''));
  assert.equal(db.data.livingLabKoppel.filter(k => k.studieId === dicht.id).length, 0,
    'bij een gescheiden studie bestaat de koppeling NERGENS');
  assert.ok(!JSON.stringify(db.data.livingLab).includes('sleutel-van-bram'),
    'en de sleutel staat ook niet elders in de opslag van het lab');

  // 3. dezelfde persoon krijgt in twee studies twee verschillende aliassen, dus
  //    de dossiers zijn niet naast elkaar te leggen
  assert.notEqual(a.deelnemer.alias, b.deelnemer.alias, 'aliassen zijn per studie en niet per persoon');
});

/* GEEN TWEE MODULES DIE HETZELFDE data-ATTRIBUUT TEKENEN.

   Deze toets komt uit twee echte fouten in dezelfde ronde. Het dossierblad wordt
   door zes modules samen opgebouwd, en twee ervan gebruikten per ongeluk dezelfde
   naam voor iets anders:

     data-conc  het INVOERVELD voor een nieuwe conclusie (vormen.js) én de RIJ
                van een bestaande conclusie (bewijs.js)
     data-rzet  de knop "leg een reflectie vast" (vormen.js) én de knop
                "reserveer een apparaat" (apparatuur.js)

   De tweede was geen schoonheidsfoutje: beide blokken staan in hetzelfde blad,
   dus bij de stap `reflectie` haakte de reserveringsbedrading zich aan de
   reflectieknop. Eén klik op "Leg vast" zocht daarna een apparaat dat er niet
   was -- "Cannot read properties of null". Zelfde naam, twee betekenissen, in
   één document: regel 4 van de lat, en hij bijt direct.

   De scan strip COMMENTAAR voordat hij telt. Zonder dat sloeg hij aan op de
   uitleg hierboven, waarin die namen letterlijk staan -- de vierde keer in dit
   huis dat een meter tekst voor code aanzag. */
test('geen twee schermmodules tekenen hetzelfde data-attribuut', () => {
  const zonderCommentaar = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* Getekend = `data-x` in een HTML-string. Bevraagd = `[data-x]` in een
     selector, en dat mag juist wel in meerdere modules: vormen.js tekent en
     studie.js bedraadt. De negatieve lookbehind scheidt die twee. */
  const getekend = new Map();
  const map = path.join(__dirname, '..', 'public', 'apps');
  for (const naam of fs.readdirSync(map).filter(n => /^(livinglab|labpas).*\.js$/.test(n))) {
    const src = zonderCommentaar(fs.readFileSync(path.join(map, naam), 'utf8'));
    for (const m of src.matchAll(/(?<!\[)data-([a-z0-9]+)/g)) {
      if (!getekend.has(m[1])) getekend.set(m[1], new Set());
      getekend.get(m[1]).add(naam);
    }
  }

  /* Toegestaan met reden: twee modules die elkaar nooit in één document
     tegenkomen. labpas-buurt.js draait alleen op /apps/labpas.html en
     livinglab-beeld.js alleen op /apps/livinglab.html. */
  const MAG = new Map([['thema', 'labpas-buurt en livinglab-beeld staan op verschillende pagina\'s']]);

  const botsend = [...getekend.entries()]
    .filter(([a, fs2]) => fs2.size > 1 && !MAG.has(a))
    .map(([a, fs2]) => 'data-' + a + ' in ' + [...fs2].sort().join(' + '));
  assert.deepEqual(botsend, [], 'deze attributen worden door meer dan één module getekend:\n  ' + botsend.join('\n  '));

  // en de meter moet zelf kunnen uitslaan: een verzonnen botsing hoort hij te zien
  const proef = new Map(getekend);
  proef.set('verzonnenbotsing', new Set(['a.js', 'b.js']));
  assert.equal([...proef.entries()].filter(([a, fs2]) => fs2.size > 1 && !MAG.has(a)).length, 1,
    'de scan ziet een botsing als er een is (anders meet hij niets)');
});

test('het spel beloont kwaliteit en niet volume', async () => {
  const k = await moet('kader', {}, 'kader');
  const p = k.spel.punten;
  assert.ok(p.herzien > p.stap && p.gestopt > p.stap, 'herzien en stoppen leveren het meest op');
  assert.equal(p.observatie, undefined, 'er bestaat geen punt per observatie');
  assert.ok(k.spel.nietBeloond.includes('aantal observaties'), 'en dat staat er met zoveel woorden bij');
});

test('apparatuur: bevoegdheid verloopt en een ongekalibreerd apparaat meet niet', async () => {
  const a = (await moet('app/maak', { labId: LAB, naam: 'Regensensor RS-4', soort: 'sensor', geldigMaanden: 6 }, 'apparaat')).apparaat;

  const onbevoegd = await api('app/reserveer', { id: a.id, studieId: SOC, van: '2026-09-01', tot: '2026-09-03', door: 'Dr. Vermeer' });
  assert.equal(onbevoegd.status, 403, 'zonder bevoegdheid geen reservering');

  const eeuwig = await api('app/bevoegd', { id: a.id, wie: 'Dr. Vermeer' });
  assert.equal(eeuwig.status, 400, 'een bevoegdheid zonder einddatum kijkt niemand meer na');

  await moet('app/bevoegd', { id: a.id, wie: 'Dr. Vermeer', tot: '2099-01-01' }, 'bevoegdheid');
  const ongekalibreerd = await api('app/reserveer', { id: a.id, studieId: SOC, van: '2026-09-01', tot: '2026-09-03', door: 'Dr. Vermeer' });
  assert.equal(ongekalibreerd.status, 409, 'een nooit gekalibreerde sensor levert geen te verantwoorden metingen');

  await moet('app/kalibratie', { id: a.id, door: 'Dr. Vermeer', op: '2026-08-01', stand: '0,2 mm afwijking' }, 'kalibratie');
  const r = await moet('app/reserveer', { id: a.id, studieId: SOC, van: '2026-09-01', tot: '2026-09-03', door: 'Dr. Vermeer' }, 'reservering');
  assert.equal(r.reservering.kalibratie.op, '2026-08-01', 'de kalibratiestand gaat MEE in de reservering');
  assert.equal(r.reservering.kalibratie.stand, '0,2 mm afwijking', 'inclusief de gemeten afwijking van dat moment');

  const dubbel = await api('app/reserveer', { id: a.id, studieId: SOC, van: '2026-09-02', tot: '2026-09-04', door: 'Dr. Vermeer' });
  assert.equal(dubbel.status, 409, 'twee reserveringen op dezelfde dagen kan niet');

  // een open storing haalt het apparaat uit de roulatie
  await moet('app/onderhoud', { id: a.id, wat: 'Sensor geeft sprongen na regen', soort: 'storing' }, 'storing');
  const kapot = await api('app/reserveer', { id: a.id, studieId: SOC, van: '2026-10-01', tot: '2026-10-02', door: 'Dr. Vermeer' });
  assert.equal(kapot.status, 409, 'een apparaat met een open storing is niet te reserveren');
});

test('van onderzoek naar verandering: de uitgang volgt het bewijs', async () => {
  await moet('studie/stap', { id: SOC, stap: 'besluit' }, 'naar besluit');
  const c = (await moet('studie', { id: SOC }, 'studie')).studie.conclusies[0];
  assert.equal(c.graad, 'waarneming', 'de conclusie staat na het weghalen van bewijs op waarneming');

  const teVroeg = await api('uit/maak', { id: SOC, uitgang: 'beleid', conclusieId: c.id, titel: 'Buurttuinen opnemen in het wijkplan' });
  assert.equal(teVroeg.status, 409, 'een beleidsvoorstel vraagt minstens een indicatie');
  assert.match(teVroeg.body.error, /minstens/i);

  // nieuw onderzoek mag juist wél uit een zwakke conclusie komen -- daar is
  // onderzoek voor
  const nieuw = (await moet('uit/maak', { id: SOC, uitgang: 'onderzoek', conclusieId: c.id,
    titel: 'Herhaling met een vergelijkingsstraat' }, 'nieuw onderzoek als uitgang')).uitgang;

  // "uitgevoerd" is de enige status die iets over de wereld beweert, en die
  // vraagt dus een bewijs van uitvoering in plaats van een vinkje
  const vinkje = await api('uit/status', { id: SOC, uitgangId: nieuw.id, status: 'uitgevoerd', door: 'Dr. Vermeer' });
  assert.equal(vinkje.status, 400, '"uitgevoerd" zonder onderbouwing is een vinkje');
  await moet('uit/status', { id: SOC, uitgangId: nieuw.id, status: 'ingediend', door: 'Dr. Vermeer' }, 'ingediend');
  await moet('uit/status', { id: SOC, uitgangId: nieuw.id, status: 'uitgevoerd', door: 'Dr. Vermeer',
    notitie: 'Vervolgstudie gestart in de Lindelaan, met vergelijkingsstraat.' }, 'uitgevoerd met onderbouwing');

  // alleen een pilot gaat door naar het RTG Onderzoekslab; de rest loopt langs
  // zijn eigen weg, en er ontstaat dus geen tweede projectenlijst
  const geenPilot = await api('uit/naar-lab', { id: SOC, uitgangId: nieuw.id, veld: 'dorp' });
  assert.equal(geenPilot.status, 400, 'alleen een pilotvoorstel gaat door naar het Onderzoekslab');

  await moet('studie/besluit', { id: SOC, soort: 'gestopt', door: 'Dr. Vermeer',
    reden: 'Het bewijs bleef bij een waarneming; we herhalen het met een vergelijkingsstraat.' }, 'bewust gestopt');
});

test('impact telt een gestopt onderzoek als opbrengst', async () => {
  const i = await moet('impact', { id: LAB }, 'impact');
  assert.ok(i.onderzoek.gestopt >= 1, 'er staat een gestopt onderzoek');
  assert.equal(typeof i.onderzoek.stoppercentage, 'number', 'het stoppercentage is een eigen getal');
  assert.ok(i.kennis.foutenVastgelegd >= 1, 'vastgelegde fouten tellen mee als kennis');
  assert.ok(i.voorbehoud, 'en er staat bij wat deze cijfers NIET zeggen');
  // het aantal wordt eerlijk `deelnames` genoemd, want aliassen zijn per studie
  assert.ok('deelnames' in i.mensen, 'deelnames en niet "unieke personen": aliassen zijn per studie');
});

test('het auditspoor houdt de geweigerde en de getekende handelingen vast', async () => {
  const a = await moet('lab/audit', { id: LAB, max: 500 }, 'auditspoor');
  assert.ok(a.totaal > 10, 'er staat een spoor');
  const soorten = new Set(a.regels.map(r => r.wat));
  for (const w of ['studie.maak', 'ethiek.review', 'ethiek.privacy', 'bewijs.graad', 'cyclus.stap'])
    assert.ok(soorten.has(w), w + ' staat in het auditspoor');
  assert.ok(a.regels.every(r => r.wie && r.at), 'elke regel draagt een wie en een wanneer');
});

test('de coach werkt zonder AI-sleutel en tekent nooit iets af', async () => {
  const r = await moet('coach', { id: SOC, vraag: 'Hoe zet ik een eerlijke nulmeting op?' }, 'coach');
  assert.ok(r.antwoord.length > 20, 'zonder sleutel geeft hij het advies dat bij deze stap hoort, geen foutmelding');
  assert.equal(r.demo, true, 'en hij zegt erbij dat het de demostand is');

  const m = await moet('coach/methoden', { soort: 'welzijn', ambitie: 'bewezen' }, 'methodeadvies');
  assert.equal(m.menselijk, true, 'welzijn is een menselijk onderwerp');
  assert.ok(m.passend.every(x => ['abtest', 'veldexperiment'].includes(x.methode)),
    'alleen een vergelijkende opzet kan "bewezen" dragen');
  assert.ok(m.teLicht.some(x => x.methode === 'interview'), 'en interviews staan bij wat daarvoor te licht is');
});
