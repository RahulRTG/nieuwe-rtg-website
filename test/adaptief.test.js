/* DE ADAPTIEVE LAAG, machinaal gehandhaafd. De regels staan in ADAPTIEF.md.

   WAAROM DEZE TOETS BESTAAT. De belofte van die laag is één zin: wat een lid op
   een groot scherm kan, kan hij op zijn telefoon ook -- in een andere vorm, maar
   hij kan het. Die belofte breekt niet met een knal. Hij breekt doordat iemand
   op een drukke dag een capability declareert zonder telefoonvorm, of een
   `display:none` in een mediaquery zet, en dat is op geen enkel scherm te zien:
   het is een handeling die er op één soort apparaat niet is, en die mis je pas
   als je hem nodig hebt.

   Wat deze toets meet zijn precies de dingen die je NIET ziet door te kijken.
   Wat hij niet meet is smaak: of de balk mooi is, of vier knoppen de juiste vier
   zijn. Dat blijft mensenwerk.

   Bij elke toets staat DE MUTATIE die hem hoort te laten zakken (LAT.md regel 2).
   Een toets die je niet hebt zien zakken, is geen toets -- alle mutaties
   hieronder zijn gedraaid en zakten op de genoemde toets, en alleen daarop. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const leer = require('../public/shared/adaptief.js');

const CSS = lees('public/shared/adaptief.css');
const CMDCSS = lees('public/shared/command.css');

/* ============================================================ de maten == */

test('de vormgrens staat op EEN plek: adaptief.js en command.css noemen hetzelfde getal', () => {
  /* DE MUTATIE: zet MAAT.bureau in shared/adaptief.js op 960. Dan is `bureau`
     voor het register iets anders dan voor het blad dat de bank tot rail maakt,
     en tussen 960 en 1000 krijg je een scherm dat volgens de ene laag een
     telefoon is en volgens de andere een desktop. Precies het soort verschil
     dat op niemands scherm optreedt en bij één gebruiker wel. */
  const uitBlad = CMDCSS.match(/@media\s*\(min-width:\s*(\d+)px\)/g) || [];
  const getallen = uitBlad.map((m) => Number(m.match(/(\d+)/)[1]));
  assert.ok(getallen.includes(leer.MAAT.bureau),
    'command.css hoort een mediaquery op ' + leer.MAAT.bureau + 'px te hebben; gevonden: ' + getallen.join(', '));
});

test('elke breedte valt in precies EEN vorm, zonder gat en zonder overlap', () => {
  /* DE MUTATIE: maak van `if (b >= MAAT.tablet)` een `>`. Dan valt 640 tussen
     wal en schip -- geen fout, gewoon een telefoonvorm op een tablet, één pixel
     lang. */
  assert.equal(leer.vormBij(0), 'telefoon');
  assert.equal(leer.vormBij(leer.MAAT.tablet - 1), 'telefoon');
  assert.equal(leer.vormBij(leer.MAAT.tablet), 'tablet');
  assert.equal(leer.vormBij(leer.MAAT.bureau - 1), 'tablet');
  assert.equal(leer.vormBij(leer.MAAT.bureau), 'bureau');
  assert.equal(leer.vormBij(4000), 'bureau');
});

test('de aanraakmaat uit de leer staat als token in het blad', () => {
  /* DE MUTATIE: zet --rtg-raak in adaptief.css op 32px. Dan staat er in de
     documentatie 44 en op het scherm 32, en is er niets wat dat meldt. */
  const m = CSS.match(/--rtg-raak:\s*(\d+)px/);
  assert.ok(m, 'adaptief.css hoort --rtg-raak te zetten');
  assert.equal(Number(m[1]), leer.RAAK);
  assert.ok(leer.RAAK >= 24, 'de harde poort van TOEGANKELIJK.md is 24x24; hieronder is het kapot');
});

/* ======================================================== de kernregel == */

test('een capability die op bureau bestaat maar niet op telefoon, is een GEBREK', () => {
  /* DIT IS DE REGEL WAAR DE HELE LAAG OM DRAAIT, en dus de toets die als eerste
     hoort te zakken als iemand hem opgeeft.

     DE MUTATIE: haal in shared/adaptief.js de `verdwenen`-tak uit keur(). Dan
     keurt een handeling die op een telefoon niet bestaat gewoon goed, en is de
     belofte van ADAPTIEF.md een tekst zonder handhaver. */
  const bev = leer.keur([{ id: 'a.b', naam: 'A', bureau: ['werkbalk'] }]);
  assert.equal(bev.filter((x) => x.soort === 'verdwenen').length, 1);

  // met een telefoonvorm erbij is er niets aan de hand
  assert.deepEqual(leer.keur([{ id: 'a.b', naam: 'A', bureau: ['werkbalk'], telefoon: ['lade'] }]), []);
});

test('een presentatie die niet bestaat of niet op die vorm hoort, wordt gemeld', () => {
  /* DE MUTATIE: laat keur() onbekende presentaties overslaan in plaats van
     melden. Een typefout ("selectiebar") levert dan een lege balk op, en een
     lege balk leest als "deze app heeft geen handelingen" in plaats van als een
     fout. */
  const onbekend = leer.keur([{ id: 'a.b', naam: 'A', telefoon: ['selectiebar'] }]);
  assert.equal(onbekend.filter((x) => x.soort === 'onbekend').length, 1);

  const mis = leer.keur([{ id: 'a.b', naam: 'A', telefoon: ['sneltoets'] }]);
  assert.equal(mis.filter((x) => x.soort === 'misplaatst').length, 1,
    'een sneltoets op een telefoon hoort te worden gemeld');
});

test('twee dominante lagen op dezelfde vorm worden bij de declaratie al tegengehouden', () => {
  /* "Maximaal één dominante sheet/modal tegelijk" is een gedragsregel, en die
     wordt in shared/adaptief/lagen.js afgedwongen. Maar een declaratie die er
     twee VRAAGT is al fout voordat er iemand op tikt.

     DE MUTATIE: haal de `dom > 1`-tak uit keur(). Een capability mag dan
     tegelijk een lade en een taakmodus vragen, en welke van de twee je krijgt
     hangt af van de volgorde in een lijst. */
  const bev = leer.keur([{ id: 'a.b', naam: 'A', telefoon: ['lade', 'taakmodus'] }]);
  assert.equal(bev.filter((x) => x.soort === 'dubbeldominant').length, 1);
});

test('geen enkele presentatie ligt dieper dan drie handelingen', () => {
  /* DE MUTATIE: zet de diepte van `lade` in PRESENTATIES op 4. Dan is elke
     handeling die alleen in de lade staat te diep, en dat hoort deze toets te
     melden in plaats van het stil te laten. */
  for (const [naam, p] of Object.entries(leer.PRESENTATIES)) {
    assert.ok(p.diepte >= 1 && p.diepte <= 3, naam + ' ligt ' + p.diepte + ' diep');
  }
});

test('de diepte van een capability is de KORTSTE weg, niet de langste', () => {
  /* Een handeling die zowel in de selectiebalk als in de lade staat, is één tik
     diep: de lade is dan de uitgebreide vorm en niet de enige weg.

     DE MUTATIE: laat diepte() de grootste in plaats van de kleinste nemen. Dan
     rekent het huis zichzelf armer dan het is, en gaat een balkknop tellen als
     iets wat achter twee tikken zit. */
  const c = { id: 'a.b', naam: 'A', telefoon: ['selectiebalk', 'lade'] };
  assert.equal(leer.diepte(leer.normaliseer(c), 'telefoon'), 1);
});

/* ================================================= over de hele broncode == */

/* Alle declaraties in de bron, als tekstblok. Een declaratie is een
   objectliteral achter `declareer({`; we lopen de accolades af tot hij sluit,
   zodat een geneste functie in de declaratie hem niet halverwege afkapt. */
function declaraties() {
  const uit = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      let i = 0;
      for (;;) {
        const start = bron.indexOf('declareer({', i);
        if (start < 0) break;
        let diep = 0, eind = -1;
        for (let k = start + 'declareer('.length; k < bron.length; k++) {
          if (bron[k] === '{') diep++;
          else if (bron[k] === '}') { diep--; if (!diep) { eind = k; break; } }
        }
        if (eind < 0) break;
        uit.push({ bestand: path.relative(WORTEL, p), tekst: bron.slice(start, eind + 1) });
        i = eind;
      }
    }
  };
  loop(path.join(WORTEL, 'public'));
  return uit;
}

test('ELKE declaratie in de bron noemt een telefoonvorm', () => {
  /* DIT IS DE POORT DIE HET PLATFORMBREED MAAKT. keur() vangt wat er langskomt;
     deze toets vangt wat er GESCHREVEN is, ook als dat stuk code vandaag op geen
     enkel scherm wordt uitgevoerd.

     DE MUTATIE: haal `telefoon:` weg uit één declaratie in
     public/apps/office/adaptief.js. Die handeling bestaat dan alleen nog op een
     bureau -- de fout waar deze hele laag tegen is -- en deze toets hoort hem bij
     naam te noemen. Gedraaid: zakt, en noemt het bestand.

     De uitzondering is de brug: die declareert wat een frame hem AANREIKT, en
     geeft de vormen als variabele door. Wat daar binnenkomt is al gekeurd door
     het register aan de andere kant. */
  const lijst = declaraties().filter((x) => !/adaptief\/brug\.js$/.test(x.bestand));
  assert.ok(lijst.length >= 3, 'er horen declaraties in de bron te staan; gevonden: ' + lijst.length);
  const zonder = lijst.filter((x) => !/\btelefoon\s*:/.test(x.tekst));
  assert.deepEqual(zonder.map((x) => x.bestand + ': ' + x.tekst.slice(0, 70)), [],
    'elke capability hoort een vorm op telefoon te hebben');
});

/* ================================================== de vorm van de balk == */

test('elk raakvlak in de adaptieve laag draagt de aanraakmaat', () => {
  /* DE MUTATIE: haal min-height:var(--rtg-raak) van .cmd-actie af. De knoppen
     krimpen dan naar hun tekst, en op een telefoon is dat een rij van 18px hoog
     -- te raken met een muis, niet met een duim. */
  for (const kiezer of ['.cmd-actie', '.cmd-meer', '.lg-rij', '.lg-sluit', '.lg-klaar']) {
    const blok = blokVan(kiezer);
    assert.ok(blok, kiezer + ' hoort in adaptief.css te staan');
    assert.ok(/--rtg-raak/.test(blok), kiezer + ' hoort de aanraakmaat te dragen');
  }
});

test('de balk kan nooit breder worden dan het scherm', () => {
  /* GEMETEN, EN HET GING ECHT MIS: met eenentwintig handelingen werd de balk op
     een scherm van 390 precies 1099px breed. Niet de rij liep over -- de rij
     duwde het raster open, want een grid-item heeft standaard min-width:auto.
     Gevolg: Rahul stond buiten beeld en de overloop naar de lade sprong nooit
     aan, want in een balk van 1099px past alles.

     DE MUTATIE: haal `.cmd-balk{min-width:0;...}` uit adaptief.css. */
  const balk = blokVan('.cmd-balk');
  assert.ok(balk && /min-width:\s*0/.test(balk), '.cmd-balk hoort min-width:0 te hebben');
  const werk = blokVan('body.rtg-command .cmd-werk');
  assert.ok(werk && /min-width:\s*0/.test(werk), '.cmd-werk hoort min-width:0 te hebben');
  for (const kiezer of ['.cmd-acties', '.cmd-actierij']) {
    assert.ok(/min-width:\s*0/.test(blokVan(kiezer) || ''), kiezer + ' hoort min-width:0 te hebben');
  }
});

test('een zone die verborgen wordt, is ook echt weg', () => {
  /* EEN KLASSE MET display WINT VAN [hidden]. Dat is hier al eens misgegaan
     (command.css, de kaart "Nu speelt" die altijd leeg bovenaan stond) en het
     ging in deze laag meteen weer mis: het anker en de ⋯-knop stonden op het
     beginscherm allebei zichtbaar terwijl de code ze verborg.

     DE MUTATIE: haal `.cmd-anker[hidden]{display:none}` weg. */
  for (const kiezer of ['.cmd-anker', '.cmd-meer']) {
    assert.ok(blokVan(kiezer + '[hidden]'), kiezer + '[hidden] hoort display:none te zetten');
  }
});

test('de adaptieve laag respecteert prefers-reduced-motion', () => {
  /* ONTWERP.md par. 12: elke animatie respecteert die voorkeur. Een lade die van
     onderen inschuift is precies het soort beweging dat iemand met
     bewegingsgevoeligheid ziekmakend vindt.

     DE MUTATIE: haal het @media-blok onderaan adaptief.css weg. */
  assert.ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(CSS));
  const blok = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
  assert.ok(/\.lg-vak/.test(blok) && /transition:\s*none/.test(blok),
    'de lagen horen hun overgang te laten vallen');
});

/* De regels uit het blad, als (kiezers, inhoud). Commentaar eerst weg: dit blad
   legt per component uit waarom hij bestaat, en in die zinnen staan accolades en
   komma's die anders als kiezer worden gelezen -- dezelfde stap als in
   test/ontwerp.test.js, waar de eerste versie daar precies op zakte. */
const REGELS = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}')
  .map((brok) => {
    const i = brok.indexOf('{');
    if (i < 0) return null;
    return { kiezers: brok.slice(0, i).split(',').map((s) => s.trim()).filter(Boolean), inhoud: brok.slice(i + 1) };
  })
  .filter(Boolean);
function blokVan(kies) {
  const t = REGELS.filter((r) => r.kiezers.includes(kies));
  return t.length ? t.map((r) => r.inhoud).join('\n') : null;
}
