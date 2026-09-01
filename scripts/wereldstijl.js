#!/usr/bin/env node
/* ============================================================================
   DRAAGT DIT SCHERM DE VORMTAAL VAN ZIJN WERELD?

   De vier huizen (ONTWERP.md, MATERIAAL.md, rtg-worlds-2026.css) beschrijven
   een schil: de os-switcher met de vier werelden, het materiaal van de wereld
   waarin je staat, goud op zwart. De vraag die dit script beantwoordt is niet
   of dat mooi is maar of het ER STAAT -- per scherm, per wereld, geteld.

   WAAROM GETELD EN NIET BEKEKEN. "De meeste schermen zitten wel goed" is de
   soort bewering waar dit huis al eerder op is omgevallen: `Asset` bestond
   niet, `rooms` bestond niet, en twee bestanden droegen een `VERMOGENS` met
   nul gedeelde leden. Een vormtaal die niemand telt, loopt uit elkaar zonder
   dat iets zakt.

   VIER KLASSEN, EN DE MIDDELSTE TWEE ZIJN HET ANTWOORD. De klasse volgt uit
   wat er ontbreekt en zegt daarmee wat het KOST:

     schil        de wereldschil staat er -- niets te doen
     aankleden    de binnenkant klopt (donkere grond, huisletters); alleen de
                  schil ontbreekt. Drie regels in de <head> en een attribuut.
     ombouwen     de schil ontbreekt EN de grond is licht of de huisletters
                  ontbreken. Een stylesheet erbij maakt een wit scherm niet
                  donker; dit is handwerk per scherm.
     onbekend     het bestand staat niet waar de wereldlijst hem verwacht.

   WAT DEZE METING NIET ZIET, en dat hoort er even groot bij te staan:
   of een scherm MOOI is, of de compositie klopt, of de tekst deugt, en of
   een donkere achtergrond ook de juiste donkere achtergrond is. Hij telt
   merkdragers in de bron. Een scherm dat alle vijf de dragers heeft en er
   niettemin uitziet als een ander product, komt hier door.

   Draai: node scripts/wereldstijl.js              (schrijft WERELDSTIJL.json)
          node scripts/wereldstijl.js --wereld=LivingOS
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const INDEX = path.join(WORTEL, 'public', 'shared', 'sprongindex.json');
const UIT = path.join(WORTEL, 'WERELDSTIJL.json');

const alleen = (process.argv.find((a) => a.startsWith('--wereld=')) || '').split('=')[1] || null;

/* DE DRAGERS. Elk is een STRING of een kleine toets op de bron -- geen regex
   over de hele CSS, want dan meet je je eigen regex en niet het scherm.

   DE GROND WAS DE MOEILIJKE. Eerst stond hier een toets op `body{background:#0..}`
   en die zei dat 40 van de 41 LivingOS-schermen geen donkere grond hadden. Dat
   was onzin: die schermen schrijven `body{background:var(--bg)}` en zetten
   `--bg` zelf, boven in hun eigen <style>. Wat de meter toen mat was zijn eigen
   patroon. Nu wordt de WAARDE opgezocht en op helderheid beoordeeld -- en het
   antwoord dat eruit komt is een heel ander en veel duurder antwoord:
   131 van de 200 schermen dragen een EIGEN kopie van de grondkleur. */
const SCHIL = [
  ['wereldschil', 'data-rtg-world'],
  ['wereldcss', 'rtg-worlds-2026.css'],
  ['switcher', 'os-switcher']
];

const cssKas = new Map();
function cssTekst(rel) {
  if (!cssKas.has(rel)) cssKas.set(rel, lees(path.join(WORTEL, 'public', rel.replace(/^\//, ''))) || '');
  return cssKas.get(rel);
}

/* LICHT IS GEEN GEBREK.

   De eerste versie van deze meter zette elk licht scherm op "ombouwen", en dat
   was een oordeel dat hij niet mocht vellen. De sociale schermen -- Sociaal,
   Vonk, Cercle, Entourage, Rendez-vous, Attenties, Vandaag -- zijn met opzet
   licht, en het huis heeft daar al een materiaal voor: Pearl. Vonk en
   Rendez-vous meten exact `--pearl-basis`, dus dat is geen toeval maar een
   bestaande keuze die nergens stond opgeschreven.

   De vraag is daarom niet donker-of-licht maar: staat dit scherm op een grond
   van HET HUIS? De twee gronden komen uit rtg-materiaal.css en worden hier niet
   overgetypt maar gelezen, zodat een wijziging daar deze meter meeneemt in
   plaats van hem stil te laten liegen. */
function huisgronden() {
  const mat = cssTekst('/shared/rtg-materiaal.css');
  const pak = (naam) => {
    const m = new RegExp('--' + naam + ':\\s*(#[0-9a-fA-F]{6})').exec(mat);
    return m ? m[1].toLowerCase() : null;
  };
  return [
    { naam: 'onyx', kleur: pak('onyx-basis') },
    { naam: 'pearl', kleur: pak('pearl-basis') },
    { naam: 'bordeaux', kleur: pak('bordeaux-diep') },
    { naam: 'royal', kleur: pak('royal-diep') }
  ].filter((g) => g.kleur);
}
/* Een grond hoeft niet exact te zijn: over de basis ligt een glans (een
   gradient) en de pixel die je meet zit daar ergens in. Vandaar een marge, en
   die staat hier met een getal in plaats van als gevoel. */
function naastLangs(kleur, gronden) {
  let beste = null;
  for (const g of gronden) {
    const n = parseInt(g.kleur.slice(1), 16);
    const d = Math.max(Math.abs(((n >> 16) & 255) - kleur.r),
      Math.abs(((n >> 8) & 255) - kleur.g), Math.abs((n & 255) - kleur.b));
    if (!beste || d < beste.d) beste = { naam: g.naam, d };
  }
  return beste ? beste.naam + ' op ' + beste.d : '?';
}
const MARGE = 26;
function bijHuis(kleur, gronden) {
  if (!kleur) return null;
  let beste = null;
  for (const g of gronden) {
    const n = parseInt(g.kleur.slice(1), 16);
    const d = Math.max(Math.abs(((n >> 16) & 255) - kleur.r),
      Math.abs(((n >> 8) & 255) - kleur.g), Math.abs((n & 255) - kleur.b));
    if (!beste || d < beste.afstand) beste = { naam: g.naam, afstand: d, kleur: g.kleur };
  }
  return beste && beste.afstand <= MARGE ? beste : null;
}

/* DE PIXEL, WANT DE EIGENSCHAP LOOG.

   Derde en laatste correctie van deze meter. `getComputedStyle(body)
   .backgroundColor` gaf rgba(0,0,0,0) voor 28 schermen, en dat leek eerst
   zwart en daarna onbekend. Geen van beide: rtg-themas.css schildert de grond
   met een GRADIENT (`background:` als verkorte vorm), en dan is de
   achtergrondKLEUR per definitie doorzichtig terwijl het scherm gewoon donker
   is. Wie een kleureigenschap uitleest, meet dus de verkeerde vraag.

   Daarom wordt hier een schermafdruk van een paar pixels genomen en de kleur
   daaruit gelezen. Dat is wat een mens ziet: gradient, afbeelding, ::before of
   platte kleur, het maakt niet meer uit. */
const zlib = require('zlib');
function pngPixel(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let i = 8, w = 0, h = 0, diepte = 0, soort = 0;
  const brokken = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const naam = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (naam === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); diepte = data[8]; soort = data[9]; }
    else if (naam === 'IDAT') brokken.push(data);
    else if (naam === 'IEND') break;
    i += 12 + len;
  }
  if (diepte !== 8 || !(soort === 2 || soort === 6) || !w || !h) return null;
  const kanalen = soort === 6 ? 4 : 3;
  const rauw = zlib.inflateSync(Buffer.concat(brokken));
  /* ALLEEN DE EERSTE PIXEL, en die is bij elk filter letterlijk te lezen.
     Chromium schrijft hier filter 4 (Paeth); een eerdere versie liet alleen 0
     en 1 door en gaf daardoor overal null -- wat er als "niet vast te stellen"
     uitzag terwijl de plaat gewoon klopte. Voor de eerste pixel van de eerste
     scanlijn zijn links, boven en linksboven alle drie nul, dus voorspellen
     Sub, Up, Average en Paeth alle vier nul en is de opgeslagen byte de
     werkelijke waarde. Er hoeft dus niets ontfilterd te worden. */
  const r = rauw[1], g = rauw[2], b = rauw[3];
  return { r, g, b, kanalen, w, h };
}

/* WAAROM DIT IN EEN ECHTE BROWSER GEBEURT.

   Deze meter heeft de grond twee keer verkeerd gemeten voordat hij hem goed
   mat, en allebei de keren omdat hij CSS las in plaats van CSS uit te voeren.
   Eerst zocht hij `body{background:#0..}` en noemde 40 van de 41 schermen
   ziek; dat waren juist de gezonde, want die schrijven `background:var(--bg)`.
   Toen loste hij de variabele op maar negeerde de SELECTORS eromheen, en las
   een waarde uit een blok dat op dit scherm helemaal niet geldt.

   Een derde poging met een slimmere regex zou dezelfde soort fout maken. Wat
   een lezer ziet is de UITKOMST van de cascade, en die kent alleen een
   browser. Dus wordt hier hetzelfde gedaan als in scripts/a11y.js: de pagina
   openen en `getComputedStyle(body)` vragen.

   Dat kost een draaiende server, en dat is een eigenschap en geen ongemak:
   zonder server wordt hier niet geraden maar geweigerd. NIET GEMETEN mag nooit
   als IN ORDE langskomen (BESTUUR.md). */
function helderheid(kleur) {
  if (kleur && typeof kleur === 'object') {
    return (0.2126 * kleur.r + 0.7152 * kleur.g + 0.0722 * kleur.b) / 255;
  }
  const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(String(kleur || ''));
  if (!m) return null;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
const hex = (k) => k ? '#' + [k.r, k.g, k.b].map((n) => n.toString(16).padStart(2, '0')).join('') : null;

/* `fonts.css` staat hier nog als NOTITIE en niet meer als oordeel. De meter
   zocht die link in de HTML en zette drie schermen op "ombouwen" omdat hij hem
   niet vond -- terwijl public/apps/foundation/stijl.css hem op regel 2 gewoon
   @import't. Vierde keer dezelfde fout in dit bestand: de bron gelezen waar de
   uitkomst geteld moest worden. Wat telt is of er een huisletter RENDERT, en
   dat wordt gemeten. */
const BINNEN = [
  ['huisletters', (s) => s.includes('fonts/fonts.css')],
  ['bodoni', (s) => s.includes('Bodoni Moda')],
  ['inter', (s) => /font-family:[^;}]*Inter|family=Inter/.test(s)],
  ['uniform', (s) => s.includes('rtg-uniform.css')]
];

function lees(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function meet(url, gemeten) {
  const rel = url.split('#')[0].split('?')[0];
  const p = path.join(WORTEL, 'public', rel.replace(/^\//, ''));
  const s = lees(p);
  if (s == null) return { bestand: rel, klasse: 'onbekend', reden: 'bestand niet gevonden' };

  const schil = {};
  for (const [naam, naald] of SCHIL) schil[naam] = s.includes(naald);
  const binnen = {};
  for (const [naam, toets] of BINNEN) binnen[naam] = toets(s);
  const grond = gemeten && gemeten[rel] ? gemeten[rel] : { herkomst: 'niet gemeten', waarde: null, licht: null };

  const heeftSchil = SCHIL.every(([n]) => schil[n]);
  /* De grond wordt tegen het PALET gehouden en niet tegen een helderheid.
     Zo blijft licht toegestaan waar het huis licht kent (Pearl), en valt een
     zelfbedachte kleur op -- ook als die toevallig donker is. */
  const gronden = huisgronden();
  const thuis = bijHuis(grond.pixel, gronden);
  const donker = !!thuis;
  /* De LETTER wordt ook gemeten en niet gelezen: een scherm kan Inter in zijn
     bron hebben staan in een regel die nergens geldt, en een scherm zonder het
     woord "Inter" kan hem via een gedeelde stylesheet toch dragen. */
  const gemetenLetter = String((grond && grond.letter) || '');
  const draagtHuisletter = /Inter|Bodoni/i.test(gemetenLetter);
  /* twee vragen, want ze gaan mis op twee manieren: vraagt het scherm om een
     huisletter, en is die letter er ook echt (een @font-face die niet laadt,
     valt stil terug op Georgia en niemand ziet het). */
  const lettersOk = draagtHuisletter && grond && grond.letterEr !== false;

  let klasse, reden;
  if (grond.herkomst === 'niet gemeten') { klasse = 'niet gemeten'; reden = 'de pagina is niet geopend'; }
  else if (heeftSchil) { klasse = 'schil'; reden = 'de wereldschil staat er'; }
  else if (donker && lettersOk) {
    klasse = 'aankleden';
    reden = 'grond ' + grond.waarde + ' = ' + thuis.naam
      + (thuis.afstand ? ' (' + thuis.afstand + ' naast de basis)' : ' precies')
      + ', huisletter staat er';
  } else {
    klasse = 'ombouwen';
    const mist = [];
    if (grond.licht == null) mist.push('grond niet vast te stellen');
    else if (!thuis) {
      const dichtst = bijHuis(grond.pixel, gronden.map((g) => ({ ...g }))) || null;
      mist.push('grond ' + grond.waarde + ' staat niet in het palet'
        + (dichtst ? '' : ' (dichtstbij: ' + naastLangs(grond.pixel, gronden) + ')'));
    }
    if (!draagtHuisletter) mist.push('vraagt geen huisletter (' + (gemetenLetter.split(',')[0] || '?') + ')');
    else if (grond && grond.letterEr === false) mist.push('vraagt ' + gemetenLetter.split(',')[0] + ' maar die letter laadt niet');
    reden = mist.join(', ');
  }
  return {
    bestand: rel, klasse, reden, grond,
    regels: s.split('\n').length,
    bytes: Buffer.byteLength(s, 'utf8'),
    dragers: Object.assign({}, schil, binnen)
  };
}

/* ---------------------------------------------------------- de browserstap */
async function open(urls) {
  const basis = process.env.RTG_BASIS || 'http://localhost:3000';
  let pw; try { pw = require('playwright'); } catch (e) { return null; }
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.RTG_CHROMIUM || undefined });
  } catch (e) { return null; }
  const uit = {};
  const page = await browser.newPage();
  for (const u of urls) {
    try {
      const a = await page.goto(basis + u, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!a || a.status() >= 400) continue;
      /* even laten bezinken: sommige schermen zetten hun materiaal in een
         script (shared/basis.js, data-rtg-thema) en niet in de HTML. */
      await page.waitForTimeout(350);
      /* TWEE MONSTERS, want bovenin zit op de meeste schermen een balk en die
         is de grond niet. Onderaan het beeld staat de pagina zelf; als beide
         het eens zijn is het antwoord zeker, en anders telt de onderste en
         zegt de uitslag dat ze verschilden. */
      const maat = page.viewportSize() || { width: 1280, height: 720 };
      const boven = pngPixel(await page.screenshot({ clip: { x: 4, y: 4, width: 4, height: 4 } }));
      const onder = pngPixel(await page.screenshot({ clip: { x: 4, y: maat.height - 8, width: 4, height: 4 } }));
      const kleur = onder || boven;
      const eens = boven && onder && hex(boven) === hex(onder);
      const g = await page.evaluate(async () => {
        /* wachten tot de letters klaar zijn, anders meet je de terugval */
        try { await document.fonts.ready; } catch (e) { /* oude browser */ }
        /* EEN DOORZICHTIGE BODY IS GEEN ZWARTE BODY. getComputedStyle geeft
           rgba(0,0,0,0) voor "niet geschilderd", en die vier nullen zien er
           precies uit als zwart -- de meter noemde 25 schermen daardoor
           donker zonder ook maar iets te weten. Wat de lezer dan ziet komt van
           <html>, dus wordt daar doorgevraagd, en pas als die ook doorzichtig
           is blijft het onbekend. */
        const leeg = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(c);
        const b = getComputedStyle(document.body);
        const h = getComputedStyle(document.documentElement);
        const grond = !leeg(b.backgroundColor) ? b.backgroundColor
          : (!leeg(h.backgroundColor) ? h.backgroundColor : null);
        /* IS DE GEVRAAGDE LETTER ER OOK ECHT? Een scherm dat Bodoni vraagt
           terwijl het @font-face nooit laadt, rendert Georgia -- en dat ziet er
           van een afstandje uit als een keuze.

           NIET met document.fonts.check(): die gaf `true` voor "Kaas Van Niks",
           dus die toets kon niet zakken en was er dus geen. Wel door dezelfde
           tekst twee keer te meten -- een keer met de gevraagde letter voor
           monospace, een keer met monospace alleen. Zijn de breedtes gelijk,
           dan is er teruggevallen en is de letter er niet. Nagerekend: onzin
           en Georgia geven false, Inter en Bodoni true. */
        const eerste = (b.fontFamily.split(',')[0] || '').replace(/^["']|["']$/g, '').trim();
        let letterEr = null;
        try {
          const c = document.createElement('canvas').getContext('2d');
          const breed = (f) => { c.font = '40px ' + f; return c.measureText('Handgloves 123 WMil').width; };
          letterEr = eerste ? Math.abs(breed('"' + eerste + '", monospace') - breed('monospace')) > 0.5 : null;
        } catch (e) { letterEr = null; }
        return { grond, waar: !leeg(b.backgroundColor) ? 'body' : (grond ? 'html' : null),
          letter: b.fontFamily, letterEr,
          thema: document.documentElement.getAttribute('data-rtg-thema') || null };
      });
      uit[u] = {
        herkomst: (g.thema ? 'materiaal ' + g.thema : 'zonder materiaal') + (eens ? '' : ', boven ' + (hex(boven) || '?')),
        waarde: hex(kleur), pixel: kleur, licht: helderheid(kleur),
        letter: g.letter, letterEr: g.letterEr,
        eigenschap: g.grond   /* wat backgroundColor zei -- bewaard, want het VERSCHIL is de les */
      };
    } catch (e) { /* een scherm dat niet opengaat blijft NIET GEMETEN */ }
  }
  await browser.close();
  return uit;
}

/* De wacht: dit script schrijft een register, dus het start niet bij het
   requiren (een laadcontrole schreef zo ooit ROLPROEF.json terug naar 292
   routes; scripts/meetkeuring.js houdt dit vast). */
if (require.main !== module) return;

(async () => {
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const urls = [];
  for (const it of index.items) {
    if (!it.url || !it.url.startsWith('/apps/')) continue;
    if (alleen && it.wereld !== alleen) continue;
    const u = it.url.split('#')[0].split('?')[0];
    if (!urls.includes(u)) urls.push(u);
  }

  const gemeten = await open(urls);
  if (!gemeten) {
    console.error('Geen browser of geen server op ' + (process.env.RTG_BASIS || 'http://localhost:3000') + '.');
    console.error('Deze meter raadt niet: zonder meting is er geen uitslag. Start de server en draai opnieuw.');
    process.exit(1);
  }

  const perWereld = new Map();
  for (const it of index.items) {
    if (!it.url || !it.url.startsWith('/apps/')) continue;
    if (alleen && it.wereld !== alleen) continue;
    if (!perWereld.has(it.wereld)) perWereld.set(it.wereld, new Map());
    const kaart = perWereld.get(it.wereld);
    const sleutel = it.url.split('#')[0].split('?')[0];
    if (!kaart.has(sleutel)) kaart.set(sleutel, { namen: [], ...meet(it.url, gemeten) });
    kaart.get(sleutel).namen.push(it.naam);
  }

  const werelden = [];
  for (const [naam, kaart] of perWereld) {
    const schermen = [...kaart.values()].sort((a, b) =>
      a.klasse.localeCompare(b.klasse) || a.bestand.localeCompare(b.bestand));
    const tel = {};
    for (const s of schermen) tel[s.klasse] = (tel[s.klasse] || 0) + 1;
    werelden.push({ wereld: naam, schermen: schermen.length, telling: tel, lijst: schermen });
  }
  werelden.sort((a, b) => b.schermen - a.schermen);

  const uit = {
    stempel: stempel(),
    uitleg: 'Per scherm van een wereld: draagt het de vormtaal van die wereld? '
      + 'De grond en de letter zijn GEMETEN in een echte browser (getComputedStyle), '
      + 'niet uit de CSS gelezen -- twee eerdere versies van deze meter lazen de '
      + 'cascade verkeerd. Vier klassen: schil (klaar), aankleden (alleen de schil '
      + 'ontbreekt), ombouwen (de binnenkant moet mee), niet gemeten (pagina ging niet open). '
      + 'Ziet niet of een scherm mooi is.',
    bron: 'public/shared/sprongindex.json (afgeleid van MAPPEN) + een browsermeting',
    werelden
  };
  if (!alleen) fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n');

  for (const w of werelden) {
    const t = w.telling;
    console.log(`\n${w.wereld} -- ${w.schermen} schermen: `
      + ['schil', 'aankleden', 'ombouwen', 'niet gemeten'].map((k) => `${k} ${t[k] || 0}`).join(' \u00b7 '));
    for (const s of w.lijst) {
      console.log(`  ${s.klasse.padEnd(12)} ${s.bestand.replace('/apps/', '').padEnd(28)} ${s.reden}`);
    }
  }
  if (!alleen) console.log('\nWERELDSTIJL.json geschreven.');
})();
