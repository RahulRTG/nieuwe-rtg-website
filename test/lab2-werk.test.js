/* Het KANTOORWERK van het RTF Living Lab: het bestuur van een lab (budget,
   partners), het stafbeeld op een lab, het vraagstuk, "wat nu", de deelnemers en
   hun rollen, de werkplaats (taken, agenda, documenten, logboek, besluitenlog),
   de vragen uit de buurt aan de kantoorkant, en de weg van uitgang naar pijplijn
   en vervolgonderzoek. Draai los:
   node --experimental-sqlite --test test/lab2-werk.test.js

   WAAROM DIT BESTAND BESTAAT. test/livinglab.test.js loopt de onderzoekscyclus
   af en test/lab2-bewoner.test.js de bewonerskant. Daartussen viel een strook
   deuren uit die geen van beide raakt: negentien routes die tijdens de hele
   suite nooit werden aangeroepen. Van die negentien stond dus ook nergens vast
   WAT ze beloven -- en dat zijn juist de deuren waar het dossier langs groeit:
   wie er op een onderzoek staat, wat er nog moet gebeuren, welke versie van welk
   document er ligt, en wat er uiteindelijk uit het onderzoek is gerold.

   WAT DEZE TOETSEN NIET DOEN: een endpoint aantikken om het aangeraakt te
   hebben. Regel 9 van de lat -- een toets die niet kan zakken is erger dan geen
   toets, en een dekkingsmeter die je oppoetst met pings meet alleen nog zichzelf.
   Elke aanroep hieronder draagt daarom een van deze vier:

     de POORT     wat er dichtgaat zonder kantoorsessie, of zonder de juiste rol;
     de FOUT      wat er gebeurt bij een verkeerde of te dunne invoer;
     de VORM      welke velden een antwoord wel en juist niet draagt;
     het GEVOLG   wat een schrijfactie werkelijk heeft veranderd, teruggelezen
                  langs een ANDERE route dan waarlangs het erin ging.

   Dat laatste is waar dit domein zijn bugs kan hebben: een taak die "af" heet en
   toch op de agenda blijft staan, een document dat bij dezelfde naam een tweede
   rij maakt in plaats van een versie, een deelnemer die zich terugtrekt terwijl
   zijn observaties blijven staan (of erger: die van iemand anders meeneemt), een
   pijplijn die rijen telt in plaats van statussen te volgen. Alle vier worden
   hieronder teruggelezen.

   DE STUDIE die deze toetsen opbouwen loopt de hele cyclus af, van vraagstuk tot
   besluit. Dat is geen decor: de meeste van deze routes hebben pas iets te
   zeggen als er ook echt een dossier onder ligt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lab2-werk-'));

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
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LAB2-WERK-1' } });
  base = srv.base;
  const login = await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'LAB2-WERK-1' })
  });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let LAB, BUUR, OPEN, ZIJ, A, B, T1, T2, T3, CONC, UIT, VERVOLG;

/* DE POORT, als eerste -- want alles wat hierna komt gaat mee door die deur.

   Achttien van de negentien routes in dit bestand horen achter `officeAuth` te
   zitten. Een route die per ongeluk zonder die middleware wordt geregistreerd,
   valt nergens op: hij werkt gewoon, en hij werkt ook voor iedereen buiten. Deze
   toets is het enige wat dat ziet. Hij eist 401 en niet "iets anders dan 200":
   een 400 of 404 zou betekenen dat de route het lijf al heeft gelezen en dus
   heeft geantwoord zonder sessie.

   De negentiende, /api/lab2/mijn/reflectie, staat er met opzet niet bij: die
   deur gaat op een LABPAS open en heeft geen kantoorsessie. Zijn eigen poort --
   een pas die niemand heeft, geeft niets -- staat verderop. */
const KANTOORDEUREN = [
  'lab/budget', 'lab/partner', 'mens/rol', 'mens/weg', 'opbrengst', 'overzicht',
  'studie/vraagstuk', 'studie/watnu', 'thema/koppel', 'themas', 'uit/pijplijn',
  'uit/vervolg', 'werk/agenda', 'werk/besluit', 'werk/document', 'werk/log',
  'werk/taak', 'werk/taak-zet'
];
test('geen van deze kantoordeuren gaat open zonder kantoorsessie', async () => {
  assert.equal(KANTOORDEUREN.length, 18, 'de lijst is compleet');
  for (const pad of KANTOORDEUREN) {
    const r = await pub(pad, { id: 'maakt-niet-uit' });
    assert.equal(r.status, 401, pad + ' hoort achter de kantoorinlog te zitten, maar gaf ' + r.status);
    assert.equal(r.body.lab, undefined, pad + ' stuurt zonder sessie geen labgegevens mee');
    assert.equal(r.body.studies, undefined, pad + ' stuurt zonder sessie geen studies mee');
  }
});

/* Budget en partners zijn het bestuurlijke deel van een lab: geen betaalverkeer,
   maar wel wat er is toegekend en met wie er een contract loopt. Twee dingen
   liggen hier vast en ze kunnen los sneuvelen: er kan niet meer BESTEED staan
   dan toegekend (anders klopt geen enkele subsidieverantwoording meer), en een
   partner staat er maar EEN keer in (anders telt hetzelfde contract dubbel mee
   in elk overzicht dat erop leunt). Allebei worden ze daarna teruggelezen langs
   /api/lab2/labs, want een antwoord dat "ok" zegt bewijst nog niet dat het
   register het ook draagt. */
test('het bestuur van een lab: het budget klopt met zichzelf en een partner staat er maar een keer in', async () => {
  LAB = (await moet('lab/maak', { stad: 'Lab2Werkstad', naam: 'Living Lab Lab2Werkstad' }, 'lab aanmaken')).lab.id;
  BUUR = (await moet('lab/maak', { stad: 'Lab2Buurstad', naam: 'Living Lab Lab2Buurstad' }, 'tweede lab')).lab.id;
  await moet('lab/tekenaar', { id: LAB, naam: 'Dr. Vermeer', rol: 'professional' }, 'tekenaar');

  const geenLab = await api('lab/budget', { id: 'bestaatniet', toegekend: 1000 });
  assert.equal(geenLab.status, 404, 'een budget hangt aan een bestaand lab');

  const scheef = await api('lab/budget', { id: LAB, toegekend: 1000, besteed: 5000 });
  assert.equal(scheef.status, 400, 'er kan niet meer besteed staan dan toegekend');
  assert.match(scheef.body.error, /besteed/i, 'en de melding zegt waarom');

  await moet('lab/budget', { id: LAB, toegekend: 40000, besteed: 12500,
    bron: 'Gemeente Lab2Werkstad' }, 'budget vastleggen');
  const na = await moet('labs', {}, 'labs lezen');
  assert.deepEqual(na.labs.find(l => l.id === LAB).budget,
    { toegekend: 40000, besteed: 12500, bron: 'Gemeente Lab2Werkstad' },
    'het register draagt het budget zoals het is vastgelegd');

  const geenPartnerLab = await api('lab/partner', { id: 'bestaatniet', naam: 'Hogeschool Lab2' });
  assert.equal(geenPartnerLab.status, 404, 'een partner hangt aan een bestaand lab');
  const naamloos = await api('lab/partner', { id: LAB, naam: 'X' });
  assert.equal(naamloos.status, 400, 'een letter is geen partnernaam');
  assert.match(naamloos.body.error, /partner/i);

  await moet('lab/partner', { id: LAB, naam: 'Hogeschool Lab2', soort: 'kennisinstelling',
    contract: 'Samenwerkingsovereenkomst 2026-2029' }, 'partner toevoegen');
  const dubbel = await api('lab/partner', { id: LAB, naam: 'Hogeschool Lab2' });
  assert.equal(dubbel.status, 409, 'dezelfde partner komt er niet twee keer in');

  const met = (await moet('labs', {}, 'labs opnieuw')).labs.find(l => l.id === LAB);
  assert.equal(met.partners.length, 1, 'precies een partner in het register');
  assert.equal(met.partners[0].soort, 'kennisinstelling');
  assert.equal(met.partners[0].contract, 'Samenwerkingsovereenkomst 2026-2029',
    'met het contract erbij, want daar draait een partnerschap op');

  await moet('lab/partner', { id: LAB, naam: 'Hogeschool Lab2', weg: true }, 'partner weghalen');
  const leeg = (await moet('labs', {}, 'labs na het weghalen')).labs.find(l => l.id === LAB);
  assert.deepEqual(leeg.partners, [], 'weghalen is echt weghalen');
});

/* Het kantooroverzicht en het bewonersoverzicht lopen langs DEZELFDE functie
   (studie.overzicht); het enige verschil is de kijker die de route meegeeft --
   `staf()` hier, `null` in routes/livinglab/bewoner.js. Dat ene argument is de
   hele afscherming. Wie het per ongeluk gelijktrekt, merkt niets: beide schermen
   blijven werken, alleen ziet de buitenwereld er dan het dossier bij.

   Daarom meet deze toets de twee ringen NAAST elkaar op hetzelfde lab, en niet
   alleen dat het kantoorbeeld er is. */
test('het kantooroverzicht draagt het dossier, het publieke overzicht van hetzelfde lab niet', async () => {
  OPEN = (await moet('studie/maak', { labId: LAB, titel: 'Zitplekken langs het pad achter de school',
    soort: 'leefomgeving',
    vraagstuk: 'Worden de bankjes langs het pad achter de school genoeg gebruikt, en door wie?',
    doel: 'Weten of er meer of juist andere zitplekken nodig zijn' }, 'studie aanmaken')).studie.id;

  const weg = await api('overzicht', { id: 'bestaatniet' });
  assert.equal(weg.status, 404, 'een lab dat niet bestaat geeft geen leeg overzicht maar een 404');

  const k = await moet('overzicht', { id: LAB }, 'kantooroverzicht');
  assert.equal(k.totaal, 1, 'dit lab heeft precies dit ene onderzoek');
  assert.equal(k.perStap.vraagstuk, 1, 'en het staat bij het vraagstuk');
  assert.equal(k.lab.stad, 'Lab2Werkstad', 'het overzicht noemt het lab waar het over gaat');
  assert.equal(k.perSoort.find(s => s.soort === 'leefomgeving').aantal, 1,
    'de telling per soort komt uit dezelfde tabel als de keuzelijst van het scherm');

  const kantoor = k.studies.find(s => s.id === OPEN);
  assert.ok(Array.isArray(kantoor.deelnemers), 'de staf ziet het teambeeld: het deelnemersveld staat erin');
  assert.ok(Array.isArray(kantoor.klachtenLijst), 'en de stafring: de klachtteksten horen alleen hier');
  assert.equal(kantoor.ethiek.klasse, 'laag', 'met de ethiekstand erbij');

  const p = await moetPub('bewoner/overzicht', { labId: LAB }, 'publiek overzicht van hetzelfde lab');
  const bewoner = p.studies.find(s => s.id === OPEN);
  assert.equal(bewoner.vraagstuk, kantoor.vraagstuk, 'een gewone studie mag haar vraag publiek tonen');
  assert.equal(bewoner.deelnemers, undefined, 'maar het dossier niet: geen deelnemers in het publieke beeld');
  assert.equal(bewoner.klachtenLijst, undefined, 'en zeker geen klachtteksten');
  assert.equal(bewoner.ethiek, undefined, 'en geen ethiekdossier');
});

/* Het vraagstuk mag scherper worden zolang de studie er nog bij staat, en niet
   meer daarna -- een vraag bijstellen nadat je de uitkomst kent is de oudste
   manier om jezelf gelijk te geven. De 409 daarvoor staat verderop, zodra de
   studie de stap uit is.

   Wat hier WEL wordt gemeten is de tweede helft van dezelfde functie, en die is
   makkelijker stil te verliezen: een bijgesteld vraagstuk laat de RISICOKLASSE
   opnieuw bepalen. Wie een studie over paden herschrijft tot een studie over
   kinderen met geldzorgen, verandert daarmee wat het lab moet waarborgen. De
   bodem gaat dan omhoog EN de eerder gezette vaststelling gaat weer open --
   anders draagt de studie een handtekening die over een andere vraag ging. */
test('een bijgesteld vraagstuk tilt de risicoklasse mee, en zet de vaststelling weer open', async () => {
  const geenStudie = await api('studie/vraagstuk', { id: 'bestaatniet',
    vraagstuk: 'Wordt het pad achter de school ook in de winter gebruikt?' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');

  const dun = await api('studie/vraagstuk', { id: OPEN, vraagstuk: 'te kort' });
  assert.equal(dun.status, 400, 'een half zinnetje is geen vraagstuk');

  const scherper = 'Worden de bankjes langs het pad achter de school genoeg gebruikt, op welke dagdelen, en door wie?';
  const r = await moet('studie/vraagstuk', { id: OPEN, vraagstuk: scherper,
    doel: 'Weten of er meer, minder of andere zitplekken nodig zijn' }, 'vraagstuk aanscherpen');
  assert.equal(r.studie.vraagstuk, scherper);
  const terug = await moet('studie', { id: OPEN }, 'dossier lezen');
  assert.equal(terug.studie.vraagstuk, scherper, 'en zo staat het ook in het dossier');
  assert.equal(terug.studie.klasse, 'laag', 'een pad met bankjes blijft een lichte studie');

  // een tweede studie, die halverwege een heel ander onderwerp blijkt te zijn
  ZIJ = (await moet('studie/maak', { labId: LAB, titel: 'Verlichting langs het pad', soort: 'leefomgeving',
    vraagstuk: 'Is de verlichting langs het pad achter de school voldoende in de winter?' }, 'tweede studie')).studie.id;
  await moet('ethiek/klasse', { id: ZIJ, klasse: 'laag', door: 'Dr. Vermeer' }, 'klasse vaststellen');
  const voor = await moet('studie', { id: ZIJ }, 'stand voor het bijstellen');
  assert.equal(voor.studie.ethiek.vastgesteld, true, 'een mens heeft de klasse vastgesteld');
  assert.equal(voor.studie.gescheiden, false, 'en de data staat niet gescheiden');

  const zwaar = await moet('studie/vraagstuk', { id: ZIJ,
    vraagstuk: 'Durven kinderen uit gezinnen met schulden het pad in de winter te gebruiken, of mijden zij het?' },
    'vraagstuk verzwaren');
  assert.equal(zwaar.studie.klasse, 'hoog', 'kinderen en schulden tillen de risicoklasse omhoog');
  assert.equal(zwaar.studie.gescheiden, true, 'en daarmee wordt de data gescheiden gehouden');
  assert.equal(zwaar.studie.ethiek.vastgesteld, false,
    'de eerdere vaststelling ging over een andere vraag en staat dus weer open');
  assert.match(zwaar.studie.logboek[0].tekst, /Risicoklasse verhoogd/,
    'en het logboek zegt waardoor het kwam');
});

/* "Wat nu" is het lijstje dat het scherm toont, en de stappoort is wat de stap
   daarna toelaat. De kop van kern/livinglab/cyclus.js belooft met zoveel woorden
   dat dat EEN functie is en geen tweede lijst die uit de pas kan lopen (regel 4).
   Die belofte is alleen te toetsen door de twee antwoorden LETTERLIJK naast
   elkaar te leggen -- daarom deepEqual en niet "allebei niet leeg".

   En daarna de andere kant op: repareer wat er in dat lijstje staat, en de stap
   moet ook echt opengaan. Een watNu die altijd hetzelfde zegt, zou de eerste
   helft van deze toets ook halen. */
test('"wat nu" en de stappoort lezen dezelfde lijst gebreken', async () => {
  const geenStudie = await api('studie/watnu', { id: 'bestaatniet' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');

  await moet('plan/hypothese', { id: OPEN,
    tekst: 'Een extra zitplek halverwege het pad verlengt de tijd die bewoners er doorbrengen.',
    tegendeel: 'Als de gemiddelde verblijfsduur na plaatsing gelijk blijft aan die van de nulmeting.' }, 'hypothese');
  await moet('studie/stap', { id: OPEN, stap: 'hypothese' }, 'naar hypothese');
  await moet('studie/stap', { id: OPEN, stap: 'plan' }, 'naar plan');

  const vast = await api('studie/vraagstuk', { id: OPEN,
    vraagstuk: 'Toch maar iets heel anders onderzoeken langs ditzelfde pad achter de school.' });
  assert.equal(vast.status, 409, 'het vraagstuk staat vast zodra de hypothese er is');
  assert.match(vast.body.error, /vast/i, 'en de melding wijst naar de reflectie');

  const w1 = await moet('studie/watnu', { id: OPEN }, 'wat nu, bij het plan');
  assert.equal(w1.stap, 'plan');
  assert.equal(w1.volgende, 'deelnemers', 'de volgende stap is deelnemers');
  assert.equal(w1.volgendeNaam, 'Deelnemers', 'met de naam die het scherm toont');
  assert.equal(w1.klaar, false, 'en die stap kan nog niet');
  assert.equal(w1.gebreken.length, 2, 'er ontbreken een plan en een vastgestelde risicoklasse');

  const poort = await api('studie/stap', { id: OPEN, stap: 'deelnemers' });
  assert.equal(poort.status, 409, 'de stap gaat dan ook niet open');
  assert.deepEqual(poort.body.gebreken, w1.gebreken,
    'het scherm en de poort lezen EEN lijst, niet twee die uiteen kunnen lopen');

  await moet('plan/zet', { id: OPEN, methoden: ['literatuur', 'prototype'], steekproef: 1, meetmomenten: 2,
    doel: 'De verblijfsduur bij een proefbankje vergelijken met de nulmeting' }, 'plan');
  await moet('ethiek/klasse', { id: OPEN, klasse: 'laag', door: 'Dr. Vermeer' }, 'klasse vaststellen');

  const w2 = await moet('studie/watnu', { id: OPEN }, 'wat nu, na het repareren');
  assert.deepEqual(w2.gebreken, [], 'er staat niets meer open');
  assert.equal(w2.klaar, true, 'en dat zegt hij ook met zoveel woorden');
  await moet('studie/stap', { id: OPEN, stap: 'deelnemers' }, 'nu mag de stap wel');
});

/* Een rol IS geen bevoegdheid. Dat staat als commentaar in kern/livinglab/mensen.js
   en het is precies het soort regel dat stil verdwijnt: wie in rolZet ook even de
   tekenaarslijst zou bijwerken, "werkt" beter -- tot een deelnemer zichzelf tot
   toezichthouder maakt en zijn eigen onderzoek stillegt of vrijgeeft.

   Deze toets zet die rol daarom echt op `toezichthouder`, leest hem terug uit het
   dossier zodat vaststaat dat de wijziging is aangekomen, en probeert er dan mee
   te tekenen. De 403 zegt alleen iets omdat de rol er aantoonbaar staat. */
test('een rol op een onderzoek is geen tekenbevoegdheid in het lab', async () => {
  A = (await moet('mens/bij', { id: OPEN, rol: 'buurtonderzoeker' }, 'eerste deelnemer')).deelnemer;
  B = (await moet('mens/bij', { id: OPEN, rol: 'buurtonderzoeker' }, 'tweede deelnemer')).deelnemer;
  assert.match(A.alias, /^BW-/, 'een alias en geen naam');
  assert.notEqual(A.alias, B.alias, 'twee deelnemers, twee pseudoniemen');

  const geenStudie = await api('mens/rol', { id: 'bestaatniet', alias: A.alias, rol: 'onderzoeker' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');
  const geenMens = await api('mens/rol', { id: OPEN, alias: 'BW-BESTAATNIET', rol: 'onderzoeker' });
  assert.equal(geenMens.status, 404, 'een deelnemer die niet op dit onderzoek staat');
  const geenRol = await api('mens/rol', { id: OPEN, alias: A.alias, rol: 'opperhoofd' });
  assert.equal(geenRol.status, 400, 'een rol die het kader niet kent');
  assert.match(geenRol.body.error, /rol/i);

  const gezet = await moet('mens/rol', { id: OPEN, alias: A.alias, rol: 'toezichthouder' }, 'rol zetten');
  assert.equal(gezet.deelnemer.rol, 'toezichthouder');
  const dossier = await moet('studie', { id: OPEN }, 'dossier lezen');
  assert.equal(dossier.studie.deelnemers.find(d => d.alias === A.alias).rol, 'toezichthouder',
    'de rol staat echt in het dossier en niet alleen in het antwoord');

  const tekenen = await api('ethiek/stilleggen', { id: OPEN, door: A.alias,
    reden: 'Ik vind als toezichthouder van dit onderzoek dat we moeten stoppen.' });
  assert.equal(tekenen.status, 403, 'de rol op de studie levert geen tekenbevoegdheid in het lab op');
  assert.match(tekenen.body.error, /toezichthouder/i, 'en de melding wijst naar het labregister');

  const weer = await moet('mens/rol', { id: OPEN, alias: A.alias, rol: 'onderzoeker' }, 'rol terugzetten');
  assert.equal(weer.deelnemer.rol, 'onderzoeker');
});

/* De reflectie is het zwaarst beloonde gedrag van dit hele domein (zie de kop
   van kern/livinglab/spel.js): een eigen fout vastleggen levert meer op dan een
   stap zetten. Dat maakt hem ook de aantrekkelijkste route om op naam van een
   ander in te sturen -- aliassen staan gewoon in het teambeeld.

   Daarom drie dingen naast elkaar: de deur kent alleen een echte labpas, de
   alias komt uit die PAS en niet uit het lijf van het verzoek (regel 8), en de
   punten die eraan hangen komen uit het kader en niet uit deze toets. Het bedrag
   hardcoderen zou de puntentabel op twee plekken zetten. */
test('een reflectie via de labpas draagt de alias van de pas, en de punten uit het kader', async () => {
  await moetPub('mijn/observatie', { pas: A.pas, methode: 'observatie',
    wat: 'Woensdagmiddag zaten er vier mensen op het bankje bij de bocht; zaterdag niemand.' }, 'observatie via de labpas');

  const onbekend = await pub('mijn/reflectie', { pas: 'LABPAS-BESTAATNIET', soort: 'misging',
    tekst: 'Wij hebben alleen op woensdag geteld en dat vertekent het beeld.' });
  assert.equal(onbekend.status, 404, 'een pas die niemand heeft, geeft niets');

  const geenSoort = await pub('mijn/reflectie', { pas: A.pas, soort: 'balen',
    tekst: 'Wij hebben alleen op woensdag geteld en dat vertekent het beeld.' });
  assert.equal(geenSoort.status, 400, 'de reflectie is geen vrij tekstveld: er hoort een soort bij');
  assert.match(geenSoort.body.error, /tegenviel|misging|onverwacht|herzien/,
    'en de melding noemt de vier soorten die er zijn');

  const kort = await pub('mijn/reflectie', { pas: A.pas, soort: 'misging', tekst: 'oeps' });
  assert.equal(kort.status, 400, '"oeps" is geen vastgelegde fout');

  const kader = await moet('kader', {}, 'kader voor de puntentabel');
  const PUNT = kader.spel.punten.misging;
  assert.ok(PUNT > 0, 'een vastgelegde fout levert punten op');

  const voor = await moetPub('mijn', { pas: A.pas }, 'eigen stand voor de reflectie');

  // de aanval: iemand die een alias kent, schrijft een reflectie op naam van een
  // ander en strijkt diens punten op
  const r = await moetPub('mijn/reflectie', { pas: A.pas, soort: 'misging', door: 'BW-IEMANDANDERS',
    tekst: 'Wij telden alleen op woensdagmiddag; het weekend viel daardoor helemaal buiten beeld.' },
    'reflectie insturen');
  assert.equal(r.reflectie[0].soort, 'misging');
  assert.equal(r.reflectie[0].door, A.alias, 'de alias komt uit de pas en niet uit de body');

  const na = await moetPub('mijn', { pas: A.pas }, 'eigen stand na de reflectie');
  assert.equal(na.ik.punten, voor.ik.punten + PUNT, 'de punten uit het kader staan op de deelnemer');

  const dossier = await moet('studie', { id: OPEN }, 'dossier lezen');
  const rij = dossier.studie.reflectie.find(x => x.id === r.reflectie[0].id);
  assert.ok(rij, 'de reflectie staat echt in het dossier en niet alleen in het antwoord');
  assert.equal(rij.door, A.alias, 'ook daar op de alias van de pas');
});

/* De werkplaats, deel taken. Wat hier vastligt is niet dat een taak wordt
   opgeslagen maar wat een taak IS: hij hangt aan een deelnemer die er echt op
   staat, en een deadline is een DATUM of niets -- "eind van de maand" in een
   tekstveld valt niet te sorteren en er wordt niemand aan herinnerd.

   De agenda is de enige lijst van dit domein die over studies heen gaat, en hij
   toont met opzet alleen wat nog open staat en een datum draagt. Die twee
   filters kunnen los sneuvelen, dus er staan drie taken klaar: een verlopen, een
   toekomstige en een zonder datum. Daarna gaat er een af en moet hij van de
   agenda verdwijnen -- een taak die "af" heet en toch blijft staan, is precies
   hoe zo'n lijst zijn geloofwaardigheid verliest. */
test('de agenda toont alleen taken die nog open staan en een echte datum dragen', async () => {
  const geenStudie = await api('werk/taak', { id: 'bestaatniet', tekst: 'De telling uitwerken' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');
  const leeg = await api('werk/taak', { id: OPEN, tekst: 'x' });
  assert.equal(leeg.status, 400, 'wat moet er gebeuren?');
  const vreemd = await api('werk/taak', { id: OPEN, tekst: 'De telling uitwerken', voor: 'BW-BESTAATNIET' });
  assert.equal(vreemd.status, 400, 'een taak gaat niet naar iemand die niet op dit onderzoek staat');
  assert.match(vreemd.body.error, /deelnemer/i);

  const oud = (await moet('werk/taak', { id: OPEN, tekst: 'De ruwe telling van het pad uitwerken',
    voor: A.alias, deadline: '2020-03-01' }, 'verlopen taak')).taak;
  const komt = (await moet('werk/taak', { id: OPEN, tekst: 'Het proefbankje bij de bocht plaatsen',
    deadline: '2099-12-31' }, 'toekomstige taak')).taak;
  const vaag = (await moet('werk/taak', { id: OPEN, tekst: 'Ooit de fotoreeks van het pad ordenen',
    deadline: 'eind van de maand' }, 'taak zonder echte datum')).taak;
  assert.equal(vaag.deadline, null, '"eind van de maand" is geen deadline');
  assert.equal(oud.voor, A.alias, 'een taak draagt de alias en geen naam');
  assert.equal(oud.af, false, 'een verse taak staat open');

  const geenLab = await api('werk/agenda', { id: 'bestaatniet' });
  assert.equal(geenLab.status, 404, 'een agenda hangt aan een bestaand lab');

  const a1 = await moet('werk/agenda', { id: LAB }, 'agenda');
  assert.equal(a1.taken.length, 2, 'de taak zonder datum staat niet op de agenda');
  assert.equal(a1.taken[0].taak, oud.tekst, 'op deadline gesorteerd, dus het verlopen werk bovenaan');
  assert.equal(a1.taken[0].verlopen, true);
  assert.equal(a1.taken[0].studieId, OPEN, 'met het onderzoek erbij, want de agenda gaat over studies heen');
  assert.equal(a1.taken[1].taak, komt.tekst);
  assert.equal(a1.taken[1].verlopen, false);
  assert.equal(a1.verlopen, 1, 'en het aantal verlopen taken staat er als eigen getal bij');

  const geenTaakStudie = await api('werk/taak-zet', { id: 'bestaatniet', taakId: oud.id, af: true });
  assert.equal(geenTaakStudie.status, 404, 'een onderzoek dat niet bestaat');
  const geenTaak = await api('werk/taak-zet', { id: OPEN, taakId: 'bestaatniet', af: true });
  assert.equal(geenTaak.status, 404, 'een taak die niet bestaat');
  const vreemdeVoor = await api('werk/taak-zet', { id: OPEN, taakId: komt.id, voor: 'BW-BESTAATNIET' });
  assert.equal(vreemdeVoor.status, 400, 'toewijzen aan iemand van buiten het team kan ook achteraf niet');

  await moet('werk/taak-zet', { id: OPEN, taakId: komt.id, voor: A.alias }, 'taak toewijzen');
  const af = await moet('werk/taak-zet', { id: OPEN, taakId: oud.id, af: true }, 'taak afvinken');
  assert.equal(af.taak.af, true);
  assert.ok(af.taak.afAt, 'met het moment waarop hij afging');

  const a2 = await moet('werk/agenda', { id: LAB }, 'agenda opnieuw');
  assert.equal(a2.taken.length, 1, 'een afgevinkte taak verdwijnt van de agenda');
  assert.equal(a2.verlopen, 0, 'en telt niet meer als verlopen');
  assert.equal(a2.taken[0].voor, A.alias, 'de toewijzing van zojuist staat er wel');

  const weg = await moet('werk/taak-zet', { id: OPEN, taakId: vaag.id, weg: true }, 'taak weghalen');
  assert.equal(weg.weg, true);
  const dossier = await moet('studie', { id: OPEN }, 'dossier lezen');
  assert.equal(dossier.studie.taken.length, 2, 'er staan nog twee taken in het dossier');
  assert.ok(!dossier.studie.taken.some(t => t.id === vaag.id), 'en de weggehaalde staat er niet meer bij');
});

/* De rest van de werkplaats: documenten, het experimentlogboek en het
   besluitenlog.

   Het scherpste stuk zit bij de documenten. Twee keer dezelfde naam hoort EEN
   document met versie 2 op te leveren en geen tweede rij -- anders staat er na
   een half jaar drie keer "Meetprotocol" in het register en weet niemand meer
   welke gold. Deze toets leest dat terug uit het dossier en telt de rijen, want
   het antwoord van de tweede aanroep ziet er in beide gevallen hetzelfde uit.

   Het logboek moet vasthouden MET welk meetmoment en welke apparatuur er is
   gewerkt; dat is precies wat het onderscheidt van een notitieblok. En een
   besluit draagt een naam en een waarom, want een besluitenlog zonder reden
   verklaart achteraf niets. */
test('een document krijgt een versie in plaats van een tweede rij, en het logboek houdt het meetmoment vast', async () => {
  const geenStudie = await api('werk/document', { id: 'bestaatniet', naam: 'Meetprotocol paden' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');
  const naamloos = await api('werk/document', { id: OPEN, naam: 'Ja' });
  assert.equal(naamloos.status, 400, 'hoe heet dit document?');

  const v1 = await moet('werk/document', { id: OPEN, naam: 'Meetprotocol paden',
    samenvatting: 'Hoe en wanneer wij tellen.', verwijzing: 'bestanden/meetprotocol-v1' }, 'eerste versie');
  assert.equal(v1.document.versie, 1);
  assert.equal(v1.nieuweVersie, undefined, 'de eerste keer is geen nieuwe versie maar een nieuw document');
  assert.equal(v1.document.versies.length, 1);

  const v2 = await moet('werk/document', { id: OPEN, naam: 'Meetprotocol paden',
    samenvatting: 'Telmomenten uitgebreid naar het weekend.' }, 'tweede versie');
  assert.equal(v2.nieuweVersie, true, 'dezelfde naam levert een versie op');
  assert.equal(v2.document.id, v1.document.id, 'op hetzelfde document');
  assert.equal(v2.document.versie, 2);
  assert.equal(v2.document.samenvatting, 'Telmomenten uitgebreid naar het weekend.');
  assert.equal(v2.document.verwijzing, 'bestanden/meetprotocol-v1',
    'wat niet wordt meegestuurd blijft staan in plaats van leeg te lopen');

  const na = await moet('studie', { id: OPEN }, 'dossier lezen');
  const rijen = na.studie.documenten.filter(d => d.naam === 'Meetprotocol paden');
  assert.equal(rijen.length, 1, 'er staat EEN document met deze naam in het register, niet twee');
  assert.equal(rijen[0].versie, 2);
  assert.equal(rijen[0].versies.length, 2, 'met allebei de versies in de historie');

  const geenLogStudie = await api('werk/log', { id: 'bestaatniet', tekst: 'Proefbankje geplaatst' });
  assert.equal(geenLogStudie.status, 404, 'een onderzoek dat niet bestaat');
  const leegLog = await api('werk/log', { id: OPEN, tekst: 'x' });
  assert.equal(leegLog.status, 400, 'wat is er gebeurd?');

  const l = await moet('werk/log', { id: OPEN,
    tekst: 'Proefbankje bij de bocht geplaatst; de teller vooraf nagelopen op zijn nulstand.',
    meetmoment: 2, apparatuur: ['Teller T-1'] }, 'logregel');
  assert.equal(l.regel.meetmoment, 2);
  assert.deepEqual(l.regel.apparatuur, ['Teller T-1']);

  const naLog = await moet('studie', { id: OPEN }, 'dossier opnieuw lezen');
  const regel = naLog.studie.logboek.find(x => x.id === l.regel.id);
  assert.ok(regel, 'de logregel staat in het dossier');
  assert.equal(regel.meetmoment, 2, 'met het meetmoment, want daar zit het verschil met een notitieblok');
  assert.deepEqual(regel.apparatuur, ['Teller T-1'], 'en met waarmee er is gemeten');

  const geenBesluitStudie = await api('werk/besluit', { id: 'bestaatniet', tekst: 'Meetmoment 3 valt af' });
  assert.equal(geenBesluitStudie.status, 404, 'een onderzoek dat niet bestaat');
  const leegBesluit = await api('werk/besluit', { id: OPEN, tekst: 'ja' });
  assert.equal(leegBesluit.status, 400, 'wat is er besloten?');

  const bs = await moet('werk/besluit', { id: OPEN, tekst: 'Meetmoment 3 valt af', door: 'Dr. Vermeer',
    waarom: 'De school is dan dicht en het pad wordt in die week nauwelijks gebruikt.' }, 'besluit');
  assert.equal(bs.besluit.wie, 'Dr. Vermeer', 'een besluit draagt de naam van wie het nam');
  const naBesluit = await moet('studie', { id: OPEN }, 'dossier na het besluit');
  const bRij = naBesluit.studie.besluitenlog.find(x => x.id === bs.besluit.id);
  assert.ok(bRij, 'het besluit staat in het besluitenlog');
  assert.match(bRij.waarom, /school/, 'met de reden erbij, want zonder reden verklaart een log niets');
});

/* De vragen uit de buurt, van de KANTOORkant. De bewonerskant hiervan staat in
   test/lab2-bewoner.test.js; wat hier wordt gemeten is wat het kantoor ermee
   doet: de lijst per lab, en het koppelen van een vraag aan een onderzoek.

   Twee dingen liggen daarbij vast. Een thema en een onderzoek horen bij hetzelfde
   lab -- anders komt een vraag uit de ene stad terecht op een onderzoek in de
   andere, en klopt het draagvlakverhaal van allebei niet meer. En de HERKOMST
   blijft staan: het onderzoek houdt vast dat het uit een vraag van de buurt komt,
   MET het aantal stemmen. Zonder die tweede kant is "bewoners mogen meedenken"
   een formulier dat in een la verdwijnt. */
test('een vraag uit de buurt wordt aan een onderzoek van hetzelfde lab gekoppeld, met haar draagvlak', async () => {
  T1 = (await moetPub('bewoner/thema', { labId: LAB, alias: 'BW-VRAAG1',
    vraag: 'Kan er een bankje bij de bocht van het pad komen?' }, 'eerste thema')).thema.id;
  T2 = (await moetPub('bewoner/thema', { labId: LAB, alias: 'BW-VRAAG2',
    vraag: 'Kan het pad achter de school beter verlicht worden?' }, 'tweede thema')).thema.id;
  T3 = (await moetPub('bewoner/thema', { labId: BUUR, alias: 'BW-VRAAG3',
    vraag: 'Kan de bushalte in de buurstad een luifel krijgen?' }, 'thema in het andere lab')).thema.id;
  await moetPub('bewoner/stem', { id: T2, alias: 'BW-STEMMER' }, 'stemmen');

  const geenLab = await api('themas', { id: 'bestaatniet' });
  assert.equal(geenLab.status, 404, 'themas van een lab dat niet bestaat');

  const t = await moet('themas', { id: LAB }, 'themalijst van het kantoor');
  assert.equal(t.totaal, 2, 'het thema van het andere lab telt hier niet mee');
  assert.equal(t.themas[0].id, T2, 'op stemmen gesorteerd, dus de vraag met draagvlak bovenaan');
  assert.equal(t.themas[0].stemmen, 1);
  assert.equal(t.themas[1].stemmen, 0);
  assert.ok(t.themas.every(x => x.studieId === null), 'nog geen van beide hangt aan een onderzoek');

  const geenThema = await api('thema/koppel', { themaId: 'bestaatniet', studieId: OPEN });
  assert.equal(geenThema.status, 404, 'een thema dat niet bestaat');
  const geenStudie = await api('thema/koppel', { themaId: T2, studieId: 'bestaatniet' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');
  const anderLab = await api('thema/koppel', { themaId: T3, studieId: OPEN });
  assert.equal(anderLab.status, 400, 'een vraag uit de ene stad hoort niet op een onderzoek in de andere');
  assert.match(anderLab.body.error, /lab/i);

  const k = await moet('thema/koppel', { themaId: T2, studieId: OPEN }, 'koppelen');
  assert.equal(k.thema.studieId, OPEN);
  const weer = await api('thema/koppel', { themaId: T2, studieId: OPEN });
  assert.equal(weer.status, 409, 'een thema hangt aan hoogstens een onderzoek');

  const na = await moet('themas', { id: LAB }, 'themalijst opnieuw');
  assert.equal(na.themas.find(x => x.id === T2).studieId, OPEN, 'de koppeling staat in het themaregister');
  assert.equal(na.themas.find(x => x.id === T1).studieId, null, 'en het andere thema hangt nergens aan');

  const dossier = await moet('studie', { id: OPEN }, 'dossier lezen');
  assert.ok(dossier.studie.logboek.some(x => /\(1 stemmen\)/.test(x.tekst)),
    'het onderzoek houdt vast met hoeveel draagvlak de vraag binnenkwam');
});

/* De pijplijn is het beeld waar een gemeente of subsidiegever naar vraagt: wat
   is er uit het onderzoek gerold en waar staat het. Het gevaar van zo'n overzicht
   is dat het RIJEN telt in plaats van statussen te volgen -- dan blijft het getal
   staan terwijl er niets beweegt, en dat is precies het dashboard waar dit
   domein tegen is.

   Daarom wordt hij hier drie keer gelezen: leeg, na het voorstel, en na elke
   statuswissel. Alleen zo bewijst een telling dat hij meeloopt. De baseline is
   niet gratis: zonder de lezing op nul zou een pijplijn die alles op "voorstel"
   zet er ook doorheen komen.

   Om er te komen loopt het onderzoek de rest van de cyclus af. Dat is geen
   opsmuk: een uitgang MAG alleen ontstaan uit een conclusie, bij het besluit. */
test('de pijplijn volgt de status van een uitgang in plaats van rijen te tellen', async () => {
  const geenLab = await api('uit/pijplijn', { id: 'bestaatniet' });
  assert.equal(geenLab.status, 404, 'een pijplijn hangt aan een bestaand lab');

  const p0 = await moet('uit/pijplijn', { id: LAB }, 'lege pijplijn');
  assert.equal(p0.totaal, 0, 'er is nog niets uit dit lab gerold');
  assert.equal(p0.perUitgang.length, 7, 'alle zeven uitgangen staan er, ook de lege');
  assert.ok(p0.perUitgang.every(u => u.aantal === 0), 'en allemaal op nul');
  assert.equal(p0.perStatus.voorstel, 0);

  await moet('ethiek/stopcriterium', { id: OPEN,
    tekst: 'Bij een bewoner die zich onveilig voelt bij het proefbankje halen wij het direct weg.' }, 'stopcriterium');
  await moet('studie/stap', { id: OPEN, stap: 'experiment' }, 'naar experiment');
  await moet('studie/stap', { id: OPEN, stap: 'observaties' }, 'naar observaties');
  await moet('studie/stap', { id: OPEN, stap: 'reflectie' }, 'naar reflectie');
  await moet('studie/stap', { id: OPEN, stap: 'resultaten' }, 'naar resultaten');
  CONC = (await moet('bewijs/conclusie', { id: OPEN,
    tekst: 'Het pad wordt vooral op woensdagmiddag gebruikt en in het weekend nauwelijks.' }, 'conclusie')).conclusie;
  assert.equal(CONC.graad, 'aanname', 'een conclusie begint als aanname');
  await moet('studie/stap', { id: OPEN, stap: 'besluit' }, 'naar besluit');

  UIT = (await moet('uit/maak', { id: OPEN, uitgang: 'onderzoek', conclusieId: CONC.id,
    titel: 'Herhaling met een tweede pad als vergelijking' }, 'uitgang')).uitgang;

  const p1 = await moet('uit/pijplijn', { id: LAB }, 'pijplijn na het voorstel');
  assert.equal(p1.totaal, 1);
  assert.equal(p1.perStatus.voorstel, 1, 'het staat als voorstel');
  assert.equal(p1.perStatus.ingediend, 0, 'en nog niet als ingediend');
  assert.equal(p1.perUitgang.find(u => u.uitgang === 'onderzoek').aantal, 1);
  assert.equal(p1.rijen[0].studieId, OPEN, 'de rij wijst terug naar het onderzoek');
  assert.equal(p1.rijen[0].graad, 'aanname', 'met de bewijsgraad waarop het voorstel rust');

  await moet('uit/status', { id: OPEN, uitgangId: UIT.id, status: 'ingediend', door: 'Dr. Vermeer' }, 'ingediend');
  const p2 = await moet('uit/pijplijn', { id: LAB }, 'pijplijn na het indienen');
  assert.equal(p2.totaal, 1, 'er komt geen rij bij van een statuswissel');
  assert.equal(p2.perStatus.voorstel, 0, 'maar de vorige status is wel leeggelopen');
  assert.equal(p2.perStatus.ingediend, 1);

  await moet('uit/status', { id: OPEN, uitgangId: UIT.id, status: 'uitgevoerd', door: 'Dr. Vermeer',
    notitie: 'Vervolgstudie gestart op het pad langs de sportvelden, met vergelijking.' }, 'uitgevoerd');
  const p3 = await moet('uit/pijplijn', { id: LAB }, 'pijplijn na het uitvoeren');
  assert.equal(p3.perStatus.ingediend, 0);
  assert.equal(p3.perStatus.uitgevoerd, 1, 'en pas hier telt hij als uitgevoerd');
});

/* Een vervolgonderzoek is wat een Living Lab onderscheidt van een reeks losse
   projecten: je ziet waar een vraag vandaan kwam. Die keten hangt aan twee
   regels die allebei kunnen sneuvelen zonder dat er iets stukgaat -- er ontstaat
   ECHT een nieuwe studie in hetzelfde lab (en niet alleen een verwijzing), en
   allebei de dossiers houden de verwijzing vast, elk vanaf hun eigen kant.

   Het aantal studies wordt daarom vlak ervoor en vlak erna geteld: "er is een
   studie bijgekomen" is iets anders dan "het antwoord noemde een studie". */
test('een vervolgonderzoek ontstaat echt, en allebei de dossiers houden de keten vast', async () => {
  const geenStudie = await api('uit/vervolg', { id: 'bestaatniet', titel: 'Tweede pad',
    vraagstuk: 'Gebruiken bewoners het pad langs de sportvelden anders dan het pad achter de school?' });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');

  const dun = await api('uit/vervolg', { id: OPEN, titel: 'Tweede pad', vraagstuk: 'te kort' });
  assert.equal(dun.status, 400, 'een vervolg begint met een echt vraagstuk, niet met een verwijzing');
  assert.match(dun.body.error, /vraagstuk/i);

  const voor = (await moet('overzicht', { id: LAB }, 'aantal studies voor het vervolg')).totaal;
  const v = (await moet('uit/vervolg', { id: OPEN, titel: 'Zitplekken langs het pad bij de sportvelden',
    vraagstuk: 'Gebruiken bewoners het pad langs de sportvelden anders dan het pad achter de school?',
    doel: 'Weten of de telling van het eerste pad ook ergens anders standhoudt' }, 'vervolgonderzoek')).studie;
  VERVOLG = v.id;
  assert.equal(v.labId, LAB, 'het vervolg staat in hetzelfde lab');
  assert.equal(v.soort, 'leefomgeving', 'en erft de soort van het onderzoek waar het uit voortkomt');
  assert.equal(v.stap, 'vraagstuk', 'een vervolg begint gewoon bij het begin van de cyclus');

  const na = (await moet('overzicht', { id: LAB }, 'aantal studies na het vervolg')).totaal;
  assert.equal(na, voor + 1, 'er is echt een studie bijgekomen');

  const nieuw = await moet('studie', { id: VERVOLG }, 'dossier van het vervolg');
  assert.ok(nieuw.studie.logboek.some(x => /Vervolg op /.test(x.tekst)),
    'het vervolg weet waar het uit voortkomt');
  const oud = await moet('studie', { id: OPEN }, 'dossier van het oorspronkelijke onderzoek');
  assert.ok(oud.studie.logboek.some(x => /Vervolgonderzoek gestart/.test(x.tekst)),
    'en het oorspronkelijke onderzoek weet dat er een vervolg op loopt');
});

/* Zich terugtrekken is de kant waarop de scheiding uit kern/livinglab/mensen.js
   zich moet bewijzen, en waar een filter het makkelijkst te ruim of te krap
   staat. Twee kanten, want elk ervan kan los sneuvelen: de observaties van DEZE
   deelnemer gaan mee weg (anders is intrekken een vinkje), en die van de ander
   blijven staan (anders wist een enkele intrekking het halve dossier).

   Het aantal komt uit het antwoord van de server en wordt daarnaast in het
   dossier nageteld -- een teller die zichzelf bevestigt, telt niets. */
test('wie zich terugtrekt neemt zijn eigen observaties mee, en die van een ander blijven staan', async () => {
  await moetPub('mijn/observatie', { pas: B.pas,
    wat: 'Zaterdagochtend stonden er drie fietsen bij de ingang van het pad.' }, 'observatie van de tweede deelnemer');

  const voor = await moet('studie', { id: OPEN }, 'dossier voor het terugtrekken');
  const aantalVoor = voor.studie.observaties.length;
  assert.ok(voor.studie.observaties.some(o => o.door === B.alias), 'de tweede deelnemer heeft iets waargenomen');
  assert.ok(voor.studie.observaties.some(o => o.door === A.alias), 'de eerste ook');

  const geenStudie = await api('mens/weg', { id: 'bestaatniet', alias: B.alias });
  assert.equal(geenStudie.status, 404, 'een onderzoek dat niet bestaat');
  const geenMens = await api('mens/weg', { id: OPEN, alias: 'BW-BESTAATNIET' });
  assert.equal(geenMens.status, 404, 'een deelnemer die niet op dit onderzoek staat');

  const w = await moet('mens/weg', { id: OPEN, alias: B.alias }, 'terugtrekken');
  assert.equal(w.gewist, 1, 'de server meldt hoeveel observaties er mee weg zijn gegaan');

  const na = await moet('studie', { id: OPEN }, 'dossier na het terugtrekken');
  assert.ok(!na.studie.deelnemers.some(d => d.alias === B.alias), 'de deelnemer staat er niet meer op');
  assert.ok(na.studie.deelnemers.some(d => d.alias === A.alias), 'de ander wel');
  assert.ok(!na.studie.observaties.some(o => o.door === B.alias), 'zijn observaties zijn gewist');
  assert.ok(na.studie.observaties.some(o => o.door === A.alias), 'en die van de ander staan er nog');
  assert.equal(na.studie.observaties.length, aantalVoor - 1, 'precies een observatie minder, niet meer');
  assert.ok(na.studie.logboek.some(x => /trok zich terug/.test(x.tekst)),
    'er blijft een spoor dat er iets weg is, zonder de inhoud ervan');

  const pas = await pub('mijn', { pas: B.pas });
  assert.equal(pas.status, 404, 'en het lab kent zijn labpas daarna niet meer');
});

/* De opbrengst is de ranglijst die er WEL mag zijn: niet wie de meeste data
   leverde, maar welke studies het meeste hebben teruggegeven. De sortering is
   daarmee de bewering, en die is alleen te meten als er iets te sorteren VALT --
   vandaar dat dit onderzoek eerst een uitgevoerde uitgang op zijn naam heeft en
   de andere studies van dit lab niets.

   Het gestopte onderzoek staat hier bewust bovenaan en niet onderaan: stoppen
   omdat het bewijs tegenviel is een uitkomst en geen mislukking. Wie die regel
   omdraait, laat deze toets zakken. */
test('de opbrengst zet de studies op volgorde van wat ze hebben teruggegeven', async () => {
  await moet('studie/besluit', { id: OPEN, soort: 'gestopt', door: 'Dr. Vermeer',
    reden: 'Het bewijs bleef bij een aanname; wij herhalen het langs een tweede pad.' }, 'bewust gestopt');

  const geenLab = await api('opbrengst', { id: 'bestaatniet' });
  assert.equal(geenLab.status, 404, 'een opbrengst hangt aan een bestaand lab');

  const o = await moet('opbrengst', { id: LAB }, 'opbrengst');
  assert.equal(o.studies.length, 3, 'alle drie de studies van dit lab staan erin');

  const rij = o.studies.find(s => s.id === OPEN);
  assert.equal(rij.uitgevoerd, 1, 'dit onderzoek leverde een uitgevoerde uitgang op');
  assert.equal(rij.conclusies, 1);
  assert.equal(rij.besluit, 'gestopt', 'en werd bewust gestopt');
  assert.equal(rij.stap, 'besluit');
  assert.equal(rij.deelnames, 1, 'er staat nog een deelnemer op, want de ander trok zich terug');
  assert.ok(rij.punten > 0, 'het onderzoek heeft punten verdiend met de cyclus die het aflegde');

  assert.equal(o.studies[0].id, OPEN, 'wie het meeste teruggaf staat bovenaan, ook als hij gestopt is');
  const stil = o.studies.find(s => s.id === VERVOLG);
  assert.equal(stil.uitgevoerd, 0, 'een onderzoek dat net begint gaf nog niets terug');
  assert.equal(stil.besluit, null, 'en heeft nog geen besluit');

  const een = await moet('opbrengst', { id: LAB, max: 1 }, 'opbrengst met een grens');
  assert.equal(een.studies.length, 1, 'de grens knijpt');
  assert.equal(een.studies[0].id, OPEN, 'en houdt de bovenste over');
});
