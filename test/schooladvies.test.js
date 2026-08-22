/* De adviesgrens: wat dit systeem over het pad van een kind mag zeggen.

   De beloftes die hier hard worden gemaakt:

   - er is geen manier om uit deze module een BESLUIT te halen: geen parameter
     zet besluitDoorMens uit;
   - er staat altijd bij WIE beslist, met naam -- en dat is nooit RTG, het
     systeem of de AI;
   - een tekst die iets vaststelt in plaats van voorlegt, wordt gemeld en niet
     stil bijgeschaafd;
   - en de grens staat op EEN plek: elke uitspraak over het pad van een kind
     hangt eraan. Wat geen paduitspraak is (de aanmoediging in een oefensessie)
     staat hieronder met naam en met de reden, zodat een nieuwe uitspraak een
     keuze afdwingt in plaats van stil te passeren.
   Draai los: node --experimental-sqlite --test test/schooladvies.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { SOORTEN, keur, uitspraak, volledig } = require('../server/kern/schooladvies');

const WORTEL = path.join(__dirname, '..');

/* Wie een uitspraak doet over het PAD van een kind, hangt aan kern/schooladvies.js.
   Deze lijst is de dekking: elk bestand hier moet de module echt gebruiken. */
const HANGT_ERAAN = [
  'server/kern/leerstof-vervolg.js',   // het niveau-advies
  'server/school/analyse-signalen.js', // de signalen rond een leerling
  'server/school/rapport-tekst.js'     // de AI-conceptrapporttekst
];

/* En dit is met opzet GEEN paduitspraak: feedback binnen een oefensessie gaat
   over de volgende vijf minuten, niet over een schoolloopbaan. Zou dit aan de
   adviesgrens hangen, dan zou elke "bijna, probeer het nog eens" een zin over
   de rapportvergadering meedragen -- en dan leest niemand die zin meer. */
const GEEN_PADUITSPRAAK = {
  'server/kern/leerstof.js': 'het advies na een niet-behaalde oefensessie: welke uitleg nu te lezen',
  'server/school/verbonden.js': 'de aanmoediging na een opgave in de online les'
};

test('er is geen manier om uit deze module een besluit te halen', () => {
  for (const soort of Object.keys(SOORTEN)) {
    const u = uitspraak(soort, 'Een tekst over dit kind.');
    assert.equal(u.besluitDoorMens, true, soort + ' levert iets op dat geen mens meer hoeft te bevestigen');
    assert.ok(u.bijschrift.includes('advies en geen besluit'), soort + ' zegt niet dat het een advies is');
  }
  /* Een onbekende soort levert geen uitspraak op, want dan zou een tikfout een
     ongedekte categorie openen. En een lege tekst is geen advies. */
  assert.equal(uitspraak('promotie', 'x').status, 400);
  assert.equal(uitspraak('niveau', '   ').status, 400);
  assert.equal(uitspraak('niveau', null).status, 400);
});

test('er staat bij wie beslist, en dat is nooit dit systeem', () => {
  for (const [soort, s] of Object.entries(SOORTEN)) {
    assert.ok(s.beslist && s.beslist.length > 15, soort + ' zegt niet wie beslist');
    /* "een mens beslist" is geen adres. Er hoort een school, een gezin, een
       mentor of een instelling te staan. */
    assert.match(s.beslist, /school|gezin|leerling|mentor|directie|instelling|zorgcoordinator|rapportvergadering/i,
      soort + ' noemt geen partij die je kunt aanspreken');
    /* Op de ACTOR letten en niet op het woord: "in een gesprek en niet in het
       systeem" is precies goed, en een verbod op het woord "systeem" zou juist
       die zin afkeuren. */
    assert.doesNotMatch(s.beslist, /(RTG|de AI|het systeem|dit systeem|de computer)\s+(beslist|bepaalt|stelt|kiest)/i,
      soort + ' laat dit systeem over een kind beslissen');
    assert.ok(uitspraak(soort, 'x').beslist === s.beslist);
  }
});

test('een tekst die iets vaststelt wordt gemeld, niet bijgeschaafd', () => {
  const u = uitspraak('overgang', 'Deze leerling gaat over naar havo 4.');
  assert.equal(u.besluitend, true);
  assert.deepEqual(u.zinsdelen, undefined, 'de zinsdelen horen in de waarschuwing te staan');
  assert.match(u.waarschuwing, /stelt iets vast/i);
  /* NIET bijgeschaafd: de tekst komt er onveranderd uit. Stil herschrijven zou
     de enige plek weghalen waar een mens het nog kan zien. */
  assert.equal(u.tekst, 'Deze leerling gaat over naar havo 4.');

  const g = uitspraak('overgang', 'Bespreek met de mentor of de volgende stap in beeld komt.');
  assert.equal(g.besluitend, false);
  assert.equal(g.waarschuwing, null);

  /* De keuring kijkt naar de zin en niet naar hoofdletters. */
  assert.equal(keur('De leerling IS TOEGELATEN.').besluitend, true);
  assert.equal(keur('').besluitend, false);
  assert.equal(keur(null).besluitend, false);
});

test('het bijschrift raakt niet kwijt wanneer een scherm alleen de tekst toont', () => {
  const u = uitspraak('niveau', 'Je ligt goed op koers.');
  const heel = volledig(u);
  assert.ok(heel.startsWith('Je ligt goed op koers.'));
  assert.ok(heel.includes('advies en geen besluit'),
    'volledig() levert een tekst waaruit de grens is verdwenen');
  assert.ok(heel.includes(u.beslist), 'en zonder wie erover beslist');
  assert.equal(volledig({ status: 400 }), '');
});

test('de grens staat op een plek, en elke paduitspraak hangt eraan', () => {
  for (const rel of HANGT_ERAAN) {
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    assert.match(bron, /require\((?:'|")[./a-z-]*schooladvies(?:'|")\)/,
      rel + ' doet een uitspraak over het pad van een kind zonder aan de adviesgrens te hangen');
    assert.match(bron, /uitspraak\(/, rel + ' laadt de grens wel maar gebruikt hem niet');
  }
  /* En de uitzonderingen staan met een reden, niet als lege lijst. */
  for (const [rel, reden] of Object.entries(GEEN_PADUITSPRAAK)) {
    assert.ok(fs.existsSync(path.join(WORTEL, rel)), rel + ' bestaat niet meer; haal hem uit de lijst');
    assert.ok(reden.length > 20, rel + ' staat als uitzondering zonder reden');
  }
});

test('geen enkele schoolmodule maakt een eigen kopie van de grens', () => {
  /* DE FOUT DIE HIER IS GEMAAKT. De regel stond als losse zin in vijf
     antwoorden. Vijf kopieen van een grens is geen grens: er hoeft er maar een
     te sneuvelen en niemand ziet het. Wie de zin schrijft zonder de module te
     laden, zakt hier. */
  const mappen = ['server/school', 'server/kern'];
  const fout = [];
  for (const map of mappen) {
    const vol = path.join(WORTEL, map);
    for (const naam of fs.readdirSync(vol)) {
      if (!naam.endsWith('.js')) continue;
      const rel = map + '/' + naam;
      const bron = fs.readFileSync(path.join(vol, naam), 'utf8');
      /* Alleen de CODE telt: de kop van schooladvies.js legt de zin uit, en een
         toelichting mag hem noemen. */
      const code = bron.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
      if (!/advies,?\s*(en\s*)?geen besluit/i.test(code)) continue;
      /* Op de CODE kijken en niet op de bron: een commentaarregel die
         schooladvies.js noemt is geen require. Anders ontsnapt elk bestand aan
         deze toets door het woord in een toelichting te zetten. */
      if (/schooladvies/.test(code)) continue;
      fout.push(rel);
    }
  }
  assert.deepEqual(fout, [],
    'deze bestanden schrijven de adviesgrens zelf op in plaats van hem uit kern/schooladvies.js te halen: ' + fout.join(', '));
});
