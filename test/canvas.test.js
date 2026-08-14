/* THE COMMAND CANVAS: de regels uit CANVAS.md, machinaal gehandhaafd.

   CANVAS.md beschrijft een opbouw, geen smaak, en precies twee regels daarvan
   zijn hard genoeg om te meten. Het zijn niet toevallig de twee die verwateren
   zodra niemand kijkt:

     1. ALTIJD DRIE KAARTEN, NOOIT ZES. "Is er een vierde die er echt toe doet,
        dan valt er een af -- dat is de hele oefening." Een vierde kaart is geen
        opmaakprobleem maar het overslaan van die oefening.
     2. DE STAND LIEGT NOOIT. Een stand die altijd groen is, is een sierstrook;
        een stand die groen is terwijl een bron zweeg, is erger dan geen stand.

   Waarom dit een toets is en geen afspraak: allebei de regels zijn onzichtbaar
   op de dag dat je ze breekt. Een vierde kaart ziet er prima uit. Een stand die
   'Operationeel' zegt terwijl de helft niet is opgehaald, ziet er zelfs beter
   uit dan de waarheid. Het scherm klaagt nooit; deze toets wel.

   De serverkant van de stand (welk niveau bij welke meting hoort) staat in
   test/wereldkern.test.js. Dit gaat over de schermen en over shared/canvas.js.

   Draai los: node --experimental-sqlite --test test/canvas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');

/* Twee bladen, en met reden: canvas.js TEKENT, canvas-taal.js FORMULEERT. Ze
   worden hier samen geladen, want samen zijn ze RTGCanvas -- en een toets die
   alleen het tekenblad kent, zou de zinnen niet meten. */
const JS = lees('public/shared/canvas.js');
const TAAL = lees('public/shared/canvas-taal.js');
const CSS = lees('public/shared/canvas.css');

/* De acht domeinschermen. Ze staan hier met NAAM en niet als een zoektocht over de
   map: een lijst die zichzelf opbouwt uit wat er ligt, keurt een wereld die
   iemand vergeet aan te sluiten vrolijk goed (LAT.md regel 9). */
const WERELDEN = [
  'public/apps/kantoor.html', 'public/apps/reizen.html', 'public/apps/sociaal.html',
  'public/apps/geld.html', 'public/apps/media.html', 'public/apps/veilig.html',
  'public/apps/lifestyle.html', 'public/apps/foundation/index.html'
];
// de drie die het Canvas al DRAGEN; de andere vijf laden alleen de vorm
const DRAGERS = ['public/apps/kantoor.html', 'public/apps/reizen.html', 'public/apps/sociaal.html'];

/* --------------------------------------------------------------------------
   Een minimale DOM, zodat shared/canvas.js hier ECHT draait.

   Waarom niet met een tekstzoektocht op 'if (l.length > MAX)': omdat zo'n toets
   blijft slagen als de regel er staat maar niet meer werkt. De enige manier om
   te weten dat een vierde kaart gooit, is een vierde kaart aanbieden. */
function maakDom() {
  const kaal = (tag) => {
    const e = {
      tag, kinderen: [], attrs: {}, className: '', eigenTekst: '',
      appendChild(k) { e.kinderen.push(k); return k; },
      removeChild(k) { e.kinderen = e.kinderen.filter((x) => x !== k); return k; },
      setAttribute(n, v) { e.attrs[n] = String(v); },
      removeAttribute(n) { delete e.attrs[n]; },
      getAttribute(n) { return n in e.attrs ? e.attrs[n] : null; },
      classList: {
        toggle(k, aan) {
          const heeft = (' ' + e.className + ' ').indexOf(' ' + k + ' ') >= 0;
          const wil = aan === undefined ? !heeft : !!aan;
          if (wil && !heeft) e.className = (e.className + ' ' + k).trim();
          if (!wil && heeft) e.className = e.className.split(/\s+/).filter((x) => x !== k).join(' ');
          return wil;
        },
        contains(k) { return (' ' + e.className + ' ').indexOf(' ' + k + ' ') >= 0; }
      }
    };
    Object.defineProperty(e, 'firstChild', { get: () => e.kinderen[0] || null });
    Object.defineProperty(e, 'textContent', {
      get: () => e.eigenTekst + e.kinderen.map((k) => k.textContent).join(''),
      set: (v) => { e.kinderen = []; e.eigenTekst = String(v); }
    });
    return e;
  };
  const register = {};
  const d = {
    body: kaal('body'),
    createElement: kaal,
    createTextNode: (t) => ({ textContent: String(t), kinderen: [] }),
    querySelector: (s) => register[s] || null
  };
  const w = {};
  // allebei zijn IIFE's op (window, document); hier krijgen ze de onze. De
  // volgorde is die van de pagina: taal hangt zich aan het tekenblad.
  new Function('window', 'document', JS)(w, d);
  new Function('window', 'document', TAAL)(w, d);
  return { w, d, register, kaal, zet: (sel) => (register[sel] = kaal('div')) };
}
// alle klassen van een element en zijn nazaten, plat
function klassen(el, uit = []) {
  if (el.className) uit.push(el.className);
  (el.kinderen || []).forEach((k) => klassen(k, uit));
  return uit;
}

test('1. drie kaarten. Een vierde GOOIT, en wordt niet stil weggelaten', () => {
  /* DE MUTATIE DIE DEZE TOETS HOORT TE LATEN ZAKKEN: verander in canvas.js de
     worp in `l = l.slice(0, MAX)`. Het scherm ziet er dan nog steeds goed uit
     -- drie nette kaarten -- en de vierde, die iemand belangrijk genoeg vond om
     te bouwen, verdwijnt zonder dat iets het meldt (LAT.md regel 5). */
  const { w, zet } = maakDom();
  const doel = zet('#k');
  const kaart = (n) => ({ kop: 'K' + n, regel: 'iets' });

  w.RTGCanvas.kaarten('#k', [kaart(1), kaart(2), kaart(3)]);
  assert.equal(doel.kinderen.length, 3, 'drie kaarten horen er gewoon te staan');

  assert.throws(() => w.RTGCanvas.kaarten('#k', [kaart(1), kaart(2), kaart(3), kaart(4)]),
    /4 kaarten/, 'een vierde kaart hoort te knallen en niet te verdwijnen');
  // en de melding noemt ze bij naam, zodat de bouwer weet WELKE er af moet
  try { w.RTGCanvas.kaarten('#k', [kaart(1), kaart(2), kaart(3), kaart(4)]); } catch (e) {
    assert.match(e.message, /K1, K2, K3, K4/, 'de melding hoort te zeggen welke kaarten het waren');
  }
  assert.equal(w.RTGCanvas.MAX_KAARTEN, 3, 'drie is de regel, niet het maximum-van-vandaag');
});

test('2. DE STAND LIEGT NOOIT: zonder meting staat er Onbekend, en geen woord van eerder', () => {
  /* Het gevaarlijke geval is niet een leeg scherm maar een scherm dat blijft
     staan: 'Operationeel', tien minuten oud, terwijl er sindsdien niets meer is
     opgehaald. Daarom is de stand zonder gegevens expliciet onbekend. */
  const { w, zet } = maakDom();
  const doel = zet('#s');

  w.RTGCanvas.stand('#s', { app: 'RTG Kantoor' });
  assert.match(doel.textContent, /Onbekend/, 'geen stand betekent Onbekend, niet leeg en niet groen');
  assert.equal(doel.getAttribute('data-niveau'), 'onbekend');
  assert.equal(doel.getAttribute('data-sig'), null,
    'onbekend krijgt GEEN signaalkleur: niet groen, en ook geen alarm');

  // en met een echte stand staat het woord van de wereld er, met zijn signaal
  w.RTGCanvas.stand('#s', { app: 'RTG Kantoor', stand: { niveau: 'gezond', woord: 'Operationeel' } });
  assert.match(doel.textContent, /Operationeel/);
  assert.equal(doel.getAttribute('data-sig'), 'gezond');

  // een verzonnen niveau is geen niveau; dat hoort onbekend te worden en niet
  // stil door te glippen met een woord dat de wereld meestuurde
  w.RTGCanvas.stand('#s', { app: 'X', stand: { niveau: 'prima', woord: 'Prima' } });
  assert.equal(doel.getAttribute('data-niveau'), 'onbekend');
  assert.ok(doel.textContent.indexOf('Prima') < 0, 'een onbekend niveau levert geen mooi woord op');
});

test('2b. zonder meting ook geen cijfers -- drie nullen zijn ook een bewering', () => {
  /* Dit stond er echt, en het viel pas op op een uitgelogd scherm: onder
     'Onbekend' stond keurig "0 reizen gepland - 0 vraagt actie - 0 wacht op
     bevestiging". Niets daarvan was gemeten. Een nul die eruitziet als een
     telling is dezelfde leugen als een groen woord, alleen kleiner gedrukt. */
  const { w, zet } = maakDom();
  const doel = zet('#s');
  const cijfers = [[0, 'reizen gepland'], [0, 'vraagt actie']];

  w.RTGCanvas.stand('#s', { app: 'RTG Reizen', cijfers });
  assert.ok(doel.textContent.indexOf('reizen gepland') < 0,
    'zonder stand horen er geen cijfers te staan: ' + doel.textContent);

  // met een echte meting mag een nul er juist wel staan: dat IS dan het nieuws
  w.RTGCanvas.stand('#s', { app: 'RTG Reizen', stand: { niveau: 'gezond', woord: 'Rustig' }, cijfers });
  assert.match(doel.textContent, /0 reizen gepland/, 'een gemeten nul is een uitkomst en hoort er wel te staan');
});

test('3. de stand draagt een teken, want kleur alleen is geen status', () => {
  /* ONTWERP.md par. 5. Wie kleur niet ziet, leest hier het verschil tussen ✓ en
     !. De rail draagt de kleur, het teken draagt de betekenis. */
  const { w, zet } = maakDom();
  const doel = zet('#s');
  const teken = (niveau) => {
    w.RTGCanvas.stand('#s', { stand: { niveau, woord: 'W' } });
    const t = doel.kinderen.map((k) => k.kinderen || []).flat().find((k) => k.className === 'cv-teken');
    return t ? t.textContent : null;
  };
  assert.equal(teken('gezond'), '✓');
  assert.equal(teken('verstoord'), '!');
  assert.equal(teken('onbekend'), '?', 'niet weten heeft een eigen teken, en is geen vinkje');
});

test('4. de zin bij de stand noemt de stille bron BIJ NAAM', () => {
  /* "Er ging iets mis" laat iemand zoeken; "de agenda is niet opgehaald" laat
     iemand kijken. Dit is de client-helft van dezelfde belofte als in
     kern/wereldkern.js: eerlijk over wat er niet gemeten is. */
  const { w } = maakDom();
  const z = w.RTGCanvas.zin({ niveau: 'onbekend', reden: 'bron' }, { stil: ['agenda', 'taken'] });
  assert.match(z, /agenda, taken/, 'de bron hoort met naam in de zin te staan');
  assert.match(z, /niet compleet/);

  assert.match(w.RTGCanvas.zin({ niveau: 'gezond' }), /rustig/i);
  assert.match(w.RTGCanvas.zin({ niveau: 'aandacht', aandacht: 3 }), /3 zaken/);
  assert.match(w.RTGCanvas.zin({ niveau: 'aandacht', aandacht: 1 }), /1 zaak /);
  assert.match(w.RTGCanvas.zin({ niveau: 'verstoord', incident: 2 }), /2 zaken/);
  // helemaal geen stand is niet hetzelfde als een rustige dag
  assert.match(w.RTGCanvas.zin(null), /niet opgehaald/);
});

test('5. Focus Mode laat vervagen en verdwijnen niet -- dat verschil is het punt', () => {
  const { w, d } = maakDom();
  assert.equal(w.RTGCanvas.focus(true), true);
  assert.ok(d.body.classList.contains('cv-focus'));
  assert.equal(w.RTGCanvas.focus(false), false);
  /* De opmaak hoort het met opacity te doen en niet met display of visibility:
     verdwijnen maakt onrustig (waar is het heen?), vervagen geeft rust. */
  const blok = /\.cv-focus \.cv-vervaagt\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(blok, 'canvas.css hoort te zeggen wat vervagen betekent');
  assert.match(blok[1], /opacity/);
  assert.ok(!/display\s*:\s*none|visibility\s*:\s*hidden/.test(blok[1]),
    'vervagen is geen verdwijnen: ' + blok[1].trim());
});

test('5b. laag 3: de lijn draagt het uur, en verzint er nooit een', () => {
  /* Een tijdlijn is een BELOFTE over volgorde. Een punt zonder tijd dat op
     09:00 belandt, of onderaan, is allebei verzonnen -- en dan is de lijn geen
     lijn meer maar een lijst die doet alsof. Vandaar de streep. */
  const { w, zet } = maakDom();
  const doel = zet('#l');
  w.RTGCanvas.lijn('#l', [
    { uur: '09:00', titel: 'Contract', toe: 'Agenda · vandaag', sig: 'aandacht', href: '/apps/agenda.html' },
    { titel: 'Zonder tijd' }
  ]);
  assert.equal(doel.kinderen.length, 2);
  const uren = doel.kinderen.map((k) => k.kinderen[0].textContent);
  assert.deepEqual(uren, ['09:00', '-'], 'geen tijd is een streep, geen verzonnen uur');

  /* Een punt met een weg erheen is een LINK; zonder weg juist niet. Een
     tijdlijn waar je niet op kunt tikken is een plaatje van uw dag, en iets dat
     klikbaar oogt maar nergens heen gaat is erger. */
  const eerste = doel.kinderen[0].kinderen[1];
  assert.equal(eerste.tag, 'a');
  assert.equal(eerste.getAttribute('href'), '/apps/agenda.html');
  assert.equal(eerste.getAttribute('data-sig'), 'aandacht', 'het signaal hoort mee, want de stip draagt het');
  assert.equal(doel.kinderen[1].kinderen[1].tag, 'span', 'zonder href geen link');
});

test('5c. de apprij is een regel tekst, geen rij doosjes', () => {
  /* CLAUDE.md par. 3: geen ronde hoeken of gouden randjes. Deze rij overtrad
     zijn eigen huisregel -- vijfendertig knopjes met een radius en een rand,
     boven een scherm dat verder alleen uit typografie en lucht bestaat -- en
     niets hield dat tegen. Nu wel.

     Wat hier NIET gemeten wordt is of het mooi is. Wel of het een doos is. */
  const blok = /\.wereldapps a \{([^}]*)\}/.exec(CSS);
  assert.ok(blok, 'de apprij hoort in canvas.css te staan');
  assert.ok(!/border-radius/.test(blok[1]), 'ronde hoeken: ' + blok[1].trim());
  assert.ok(!/border\s*:\s*[^;]*(solid|1px)/.test(blok[1]),
    'een rand rondom maakt er weer een knop van: ' + blok[1].trim());
  // en de hele rij mag ook nergens anders een radius op die links zetten
  assert.ok(!/\.wereldapps[^{]*\{[^}]*border-radius/.test(CSS), 'ergens anders alsnog ronde hoeken');
});

test('6. elke klasse die canvas.js tekent, bestaat in canvas.css', () => {
  /* Een element zonder opmaak valt niet op in code en wel op het scherm: hij
     staat er, maar als kale tekst. Dit is de goedkoopste manier om te merken
     dat het blad en de motor uit elkaar lopen. */
  const gebruikt = new Set();
  for (const m of JS.matchAll(/'(cv-[a-z-]+)'/g)) gebruikt.add(m[1]);
  assert.ok(gebruikt.size >= 8, 'er horen er meer dan een handvol te zijn, anders meet dit niets');
  for (const k of gebruikt) {
    assert.ok(CSS.indexOf('.' + k) >= 0, 'canvas.js tekent .' + k + ', en canvas.css kent hem niet');
  }
});

test('7. de acht domeinschermen dragen dezelfde opbouw: allemaal canvas.css', () => {
  /* CANVAS.md: "Een eigen variant bedenken is de duurste manier om het geheel
     goedkoop te laten voelen." */
  for (const p of WERELDEN) {
    assert.match(lees(p), /\/shared\/canvas\.css/, p + ' hoort het Canvas-blad te laden');
  }
});

test('8. wie het Canvas TEKENT, laadt de motor -- en niet uitgesteld', () => {
  for (const p of DRAGERS) {
    const html = lees(p);
    assert.match(html, /<script src="\/shared\/canvas\.js"><\/script>/,
      p + ' roept RTGCanvas aan; dan hoort canvas.js er te staan');
    /* En het taalblad, NA het tekenblad. Zonder canvas-taal.js bestaat
       RTGCanvas wel en RTGCanvas.zin niet: het scherm tekent dan een stand met
       een lege rustregel eronder. Dat is de stilste manier om laag 1 kwijt te
       raken -- er staat immers gewoon iets. */
    assert.ok(html.indexOf('/shared/canvas-taal.js') > html.indexOf('/shared/canvas.js"'),
      p + ' laadt canvas-taal.js niet, of niet NA canvas.js; dan is RTGCanvas.zin er niet');
    /* Zonder defer, en dat is geen detail: het scherm-script tekent de stand
       meteen bij het laden. Met defer is RTGCanvas op dat moment nog niet
       gedefinieerd en breekt het hele blok. */
    assert.ok(!/canvas\.js"\s+defer/.test(html), p + ' laadt canvas.js uitgesteld; ' +
      'dan bestaat RTGCanvas nog niet als het scherm zijn stand tekent');
    assert.match(html, /RTGCanvas\.stand\(/, p + ' hoort met laag 0 te openen');
    assert.match(html, /tekenStand\(\{\}\)/, p + ' hoort de stand al te tekenen VOOR het antwoord ' +
      'binnen is; een leeg gat waar het oordeel hoort te staan leest als "niets aan de hand"');

    /* LAAG 3, en op alle drie dezelfde constructie. Een tijdlijn die maar op
       een van de drie werelden bestaat is geen laag maar een uitzondering --
       precies de "eigen variant" waar CANVAS.md voor waarschuwt. */
    assert.match(html, /id="vandaagVak" hidden/, p + ' mist de tijdlijn van vandaag (laag 3), ' +
      'of laat hem niet leeg beginnen');
    assert.match(html, /RTGCanvas\.lijn\(/, p + ' vult zijn tijdlijn niet met het Canvas');
    /* En de andere helft van dezelfde regel: wat op de lijn staat, hoort NIET
       ook in het register. Zonder deze filter staat hetzelfde overleg twee keer
       op een scherm dat zijn bestaan aan weglaten ontleent. */
    assert.match(html, /filter\(x => !opDeKlok\(x\)\)/,
      p + ' laat het register ook tonen wat al op de tijdlijn staat');
  }
});

test('9. geen enkel standwoord staat hard in de HTML van zijn eigen wereld', () => {
  /* DE STILLE VARIANT VAN LIEGEN. Een woord dat in de HTML staat, staat er ook
     als er niets is opgehaald -- en het staat er dan met de autoriteit van een
     meting. Vandaar dat de stand alleen via canvas.js binnenkomt.

     De woorden worden UIT DE WERELD GELEZEN en niet hier overgetikt: een lijst
     in deze toets zou verouderen op de dag dat iemand 'Druk' hernoemt, en dan
     bewaakt hij een woord dat nergens meer staat (LAT.md regel 4).

     Commentaar, scripts en stijl gaan er eerst af. In het commentaar op het
     scherm STAAT 'Operationeel', als uitleg van waarom het er niet mag staan,
     en dat is precies waar het hoort. Wat overblijft is wat de browser toont.

     Eerst zakte deze toets op 'Gezondheidsmaatje' in de RTFoundation-hub -- een
     losse woordenlijst pakte de kop van een heel andere functie. Vandaar per
     wereld zijn eigen woorden, en op hele woorden. */
  const KERN = {
    'public/apps/kantoor.html': 'kantoorwereld', 'public/apps/reizen.html': 'reiswereld',
    'public/apps/sociaal.html': 'socialewereld'
  };
  for (const p of DRAGERS) {
    const kern = lees('server/kern/' + KERN[p] + '.js');
    const m = /standVan\(\{([^}]*)\}\)/.exec(kern);
    assert.ok(m, KERN[p] + ' hoort zijn standwoorden via standVan te zetten');
    const woorden = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).concat('Onbekend');
    assert.ok(woorden.length >= 4, 'drie eigen woorden plus Onbekend, gevonden: ' + woorden.join('/'));

    const kaal = lees(p)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '');
    for (const woord of woorden) {
      assert.ok(!new RegExp('(^|[>\\s])' + woord + '($|[<\\s.,])').test(kaal),
        p + ' heeft "' + woord + '" hard in de opmaak staan; dan staat dat oordeel er ook ' +
        'op een dag dat er niets is gemeten');
    }
  }
});
