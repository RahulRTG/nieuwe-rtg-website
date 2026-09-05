/* DE BLINDE VLEK.

   Dit bestand toetst geen functie. Het gaat op zoek naar de fouten die de rest
   van de suite STRUCTUREEL niet kan zien, en het bestaat omdat er twee van dat
   soort fouten maandenlang zijn meegelopen terwijl alles groen stond:

     - kantoren.html: een ingeplakte scriptregel stond midden in een JS-string.
       Het sluitende scripttag-teken erin beeindigde het inline script van de
       pagina, waarna de halve pagina als platte tekst in beeld kwam.
     - hangar.html: een ternair zonder dubbele punt. Het hele script van die
       pagina draaide nooit; hij bleef eeuwig op "Laden...".

   Waarom niets dat zag: de 1800 toetsen draaien op de SERVER. Ze bewijzen dat
   de endpoints kloppen, en dat is precies wat ze bewijzen -- niet dat de pagina
   die ze gebruikt ook maar een regel JS uitvoert. Dat is de blinde vlek.

   De regel voor dit bestand: elke toets hier zoekt naar een KLASSE van fout,
   niet naar een geval. Vind je een nieuw soort stille fout, dan komt er hier
   een scanner bij, zodat dezelfde soort nooit twee keer kan gebeuren.

   Draai los: node --test test/blindevlek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const rel = (p) => path.relative(ROOT, p);

function loop(map, filter, uit = []) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    const s = fs.statSync(p);
    if (s.isDirectory()) loop(p, filter, uit);
    else if (filter.test(naam)) uit.push(p);
  }
  return uit;
}
const paginas = loop(PUB, /\.html$/);

/* De inline scriptblokken van een pagina, geknipt zoals een HTML-lezer dat
   doet: tot het EERSTE sluitende scripttag-teken, ook als dat in een string
   staat. Precies dat maakte kantoren.html stuk. */
function inlineBlokken(html) {
  const uit = [];
  const laag = html.toLowerCase();
  const open = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const start = m.index + m[0].length;
    const eind = laag.indexOf('</scr' + 'ipt>', start);
    if (eind < 0) { uit.push({ code: html.slice(start), regel: html.slice(0, start).split('\n').length, open: true }); break; }
    uit.push({ code: html.slice(start, eind), regel: html.slice(0, start).split('\n').length, open: false });
    open.lastIndex = eind;
  }
  return uit;
}

/* De pagina zonder zijn inline scripts. Let op de aanpak: dit knipt op
   dezelfde plek als inlineBlokken() en gebruikt GEEN losse reguliere expressie
   met een niet-happige staart. Die eerste opzet was zelf stuk -- er stond
   `/re/gi + ''` in, en dat maakt van de expressie een STRING, waarna replace()
   niets meer wegknipt. Het gevolg: de scanner keek toch in de scripts en meldde
   id's uit print-exports als dubbel. Een scanner die zelf fout meet is erger
   dan geen scanner, dus hij deelt nu de knipfunctie. */
function zonderInline(html) {
  let uit = '', vorige = 0;
  const laag = html.toLowerCase();
  const open = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    uit += html.slice(vorige, m.index);
    const eind = laag.indexOf('</scr' + 'ipt>', m.index + m[0].length);
    if (eind < 0) return uit;                        // rest is script
    vorige = eind + 9;
    open.lastIndex = vorige;
  }
  return uit + html.slice(vorige);
}

/* De routekaart van de server: alle paden die hij ECHT registreert.

   Waarom niet uit de broncode: routes hangen op drie manieren in de router, en de
   derde is een hulpje dat het pad zelf samenstelt --

     app.post('/api/ik/zet', ...)                  letterlijk, leesbaar
     app.use('/api/foundation', router)            router met een voorvoegsel
     mount('/api/supplier/kantoorpakket', ...)     een hulpje dat pad + auth doet
     p('/notitie', ...)                            een hulpje in dat hulpje

   Van de laatste twee kan geen enkele broncode-scanner weten waar ze uitkomen.
   Toets 4 vroeg eerst 40 en daarna nog 7 kloppende paden als "kapot" -- en een
   scanner die roept bij dingen die goed zijn, leert je hem te negeren. Dus
   vragen we het aan de server zelf: scripts/routekaart.js start de app en leest
   app._routes() uit (server/web/routing.js).

   Eenmalig: het starten kost een paar seconden en twee toetsen hebben de kaart
   nodig. */
let _kaart = null;
function routekaart() {
  if (_kaart) return _kaart;
  const uit = require('child_process').execFileSync(
    process.execPath, [path.join(ROOT, 'scripts', 'routekaart.js'), '--json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } });
  _kaart = JSON.parse(uit);
  return _kaart;
}

/* ---------------- 1. draait de pagina uberhaupt? ---------------- */
test('BLINDE VLEK: elk inline script op een pagina is geldige JS', () => {
  const stuk = [];
  for (const f of paginas) {
    for (const blok of inlineBlokken(fs.readFileSync(f, 'utf8'))) {
      if (blok.open) { stuk.push(rel(f) + ':' + blok.regel + ' script wordt nooit gesloten'); continue; }
      try { new Function(blok.code); }
      catch (e) { stuk.push(rel(f) + ':' + blok.regel + ' ' + e.message.slice(0, 70)); }
    }
  }
  assert.deepEqual(stuk, [], 'pagina met een script dat niet draait:\n  ' + stuk.join('\n  '));
});

/* ---------------- 1b. een verwijzend script dat zijn buurman opeet ----------------
   Toets 1 kijkt met opzet alleen naar INLINE scripts: zijn expressie slaat via
   `(?![^>]*\bsrc=)` elk script met een src over. Precies daar zat de vlek.

   De regel van de HTML-lezer: de inhoud van een script is RUWE TEKST tot het
   eerste sluitteken. Vergeet je dat sluitteken bij een <script src=...>, dan
   wordt alles wat erachter staat de TEKST van dat element -- inclusief de
   scripttags die erop volgen. En omdat het element een src heeft, gooit de
   browser die tekst weg: die scripts bestaan niet als element, worden nooit
   opgehaald en draaien nooit. Geen foutmelding, geen 404, niets in de console.

   Zo werd in public/apps/app.html /shared/pinherstel.js opgeslokt door een
   ios.js-tag zonder sluitteken. Niet cosmetisch: window.RTGPinHerstel bestond
   daardoor niet, dus de knop "Pin vergeten?" verscheen nooit en de herstellink
   uit de mail (?pinherstel=...) deed niets. Beide aanroepen in app-main.js
   staan achter `if (window.RTGPinHerstel)` en zwegen dus keurig -- de vangnetten
   maakten de fout onzichtbaar in plaats van luid.

   Toets 2 zag het evenmin: die zoekt src="..." in de TEKST, en het bestand
   /shared/pinherstel.js bestaat wel degelijk. Alleen niet als element.

   Wat we hier toetsen is de regel van de lezer zelf: een script met een src
   heeft geen inhoud. Staat er toch iets in, dan is er iets opgeslokt. */
function scriptElementen(html) {
  const uit = [];
  const laag = html.toLowerCase();
  const open = /<script\b[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const tag = m[0];
    const start = m.index + tag.length;
    const eind = laag.indexOf('</scr' + 'ipt>', start);
    uit.push({
      regel: html.slice(0, m.index).split('\n').length,
      src: (/\bsrc\s*=\s*"([^"]*)"/i.exec(tag) || [])[1] || null,
      inhoud: eind < 0 ? html.slice(start) : html.slice(start, eind),
      gesloten: eind >= 0
    });
    if (eind < 0) break;
    open.lastIndex = eind + 9;   // '</script>'.length
  }
  return uit;
}

test('BLINDE VLEK: een script met een src heeft geen inhoud, en sluit', () => {
  const stuk = [];
  for (const f of paginas) {
    for (const s of scriptElementen(fs.readFileSync(f, 'utf8'))) {
      if (!s.gesloten) { stuk.push(rel(f) + ':' + s.regel + ' scripttag wordt nooit gesloten'); continue; }
      if (!s.src || !s.inhoud.trim()) continue;   // inline hoort bij toets 1; leeg is goed
      stuk.push(rel(f) + ':' + s.regel + ' src="' + s.src + '" slokt op: '
        + s.inhoud.trim().replace(/\s+/g, ' ').slice(0, 70));
    }
  }
  assert.deepEqual(stuk, [], 'script dat stil een ander script opeet:\n  ' + stuk.join('\n  '));
});

/* ---------------- 2. verwijst de pagina naar bestanden die bestaan? ----------------
   Een verkeerd pad geeft een 404 die niemand ziet: de pagina laadt, alleen die
   ene laag doet niets. Alleen eigen paden (beginnend met /), want extern
   controleren we niet vanuit een toets. */
test('BLINDE VLEK: elk eigen script-, stijl- en beeldpad bestaat echt', () => {
  const mist = [];
  const re = /\b(?:src|href)\s*=\s*"(\/[^"?#]+)/g;
  for (const f of paginas) {
    const kop = zonderInline(fs.readFileSync(f, 'utf8'));
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(kop))) {
      const p = m[1];
      if (!/\.(js|css|svg|png|jpg|jpeg|webp|webmanifest|ico|woff2?|mp4|webm)$/i.test(p)) continue;
      if (!fs.existsSync(path.join(PUB, p.replace(/^\//, '')))) mist.push(rel(f) + ' -> ' + p);
    }
  }
  assert.deepEqual(mist, [], 'pagina verwijst naar iets dat niet bestaat:\n  ' + mist.join('\n  '));
});

/* ---------------- 2b. verwijst de app naar pagina's die bestaan? ----------------
   Hetzelfde, maar voor de .html-adressen die in JS staan: een lijst met schermen,
   een knop die iets opent, een omleiding. Dat gaat langs toets 2 heen, want daar
   staat geen src of href bij -- en het is precies zo stil: je kiest een scherm en
   krijgt een 404 in een vlak. Zo stond hier '/apps/kantoorpakket.html' in de
   schermenlijst van RTG Kantoren; die pagina bestaat niet.

   Een adres mag ook een ROUTE zijn in plaats van een bestand: /apps/bureau.html
   bestaat niet op schijf maar wordt door de voordeur intern omgeschreven naar het
   bureaublad. Daarom kijken we ook in de echte routekaart. */
test('BLINDE VLEK: elk .html-adres in de app bestaat als bestand of als route', () => {
  const routes = new Set(routekaart().routes.map(r => r.pad));
  const bestanden = loop(PUB, /\.(js|html)$/).filter(f => !rel(f).startsWith('public/dist'));
  const mist = new Map();
  const re = /['"](\/[a-z0-9/_.-]*\.html)(?:[?#][^'"]*)?['"]/gi;
  for (const f of bestanden) {
    const bron = fs.readFileSync(f, 'utf8');
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(bron))) {
      const p = m[1];
      if (fs.existsSync(path.join(PUB, p.replace(/^\//, '')))) continue;
      if (routes.has(p)) continue;
      if (!mist.has(p)) mist.set(p, rel(f));
    }
  }
  const lijst = [...mist].map(([p, f]) => p + '  (' + f + ')');
  assert.deepEqual(lijst, [], 'de app verwijst naar een pagina die niet bestaat:\n  ' + lijst.join('\n  '));
});

/* ---------------- 3. dubbele id's ----------------
   Twee elementen met dezelfde id: getElementById pakt de eerste en de tweede
   doet stil niets meer. Dit is de klassieke stille breker bij samengevoegde
   schermen, en geen enkele servertoets ziet het. */
test('BLINDE VLEK: geen dubbele id op een pagina', () => {
  const dubbel = [];
  for (const f of paginas) {
    /* Alleen de HTML-kant. Id's die JS in een string opbouwt tellen niet mee:
       die horen bij een ANDER document (een print-export) of bij een andere
       weergave van hetzelfde scherm, en dan bestaan ze nooit tegelijk. */
    const zonderScript = zonderInline(fs.readFileSync(f, 'utf8'));
    const gezien = new Map();
    const re = /\sid\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(zonderScript))) {
      const id = m[1];
      if (gezien.has(id)) dubbel.push(rel(f) + ' id="' + id + '"');
      else gezien.set(id, true);
    }
  }
  assert.deepEqual(dubbel, [], 'dubbele id (de tweede doet stil niets):\n  ' + dubbel.join('\n  '));
});

/* ---------------- 4. praat de app tegen endpoints die bestaan? ----------------

   Dit is de grootste blinde vlek van allemaal. De servertoetsen roepen de paden
   aan die ze KENNEN. Tikt een pagina /api/member/berichtn aan, dan is dat een
   404 die niemand ooit ziet -- behalve de gebruiker, bij wie dat ene scherm
   leeg blijft.

   De lijst komt uit de echte router (zie routekaart() bovenaan), niet uit de
   broncode: dat laatste kan niet eerlijk, en het gaf eerst 40 en daarna nog 7
   valse meldingen. */
test('BLINDE VLEK: elk /api-pad dat de app aanroept, bestaat op de server', () => {
  const kaart = routekaart();
  assert.ok(kaart.routes.length > 500, 'de routekaart is verdacht kort: ' + kaart.routes.length);

  const bekend = new Set(kaart.routes.map(r => r.pad));
  // paden met een parameter (/api/foto/:id) matchen we op hun vaste voorstuk
  const patronen = [...bekend].filter(p => p.includes(':')).map(p => p.split('/:')[0]);
  /* Een literal mag ook een VOORSTUK zijn. Schermen zetten bovenaan iets als
     basis: '/api/werkplek/kantoorpakket/' en plakken daar het laatste stuk aan;
     in de code staat dan alleen het voorstuk. Zo'n voorstuk is goed zodra er
     echt routes onder hangen. Dit kost een beetje strengheid -- '/api/bank' als
     volledig adres gebruiken wordt niet meer gemeld -- en het levert op dat de
     toets alleen nog roept bij namen die NERGENS op uitkomen, en dat is precies
     de tikfout waar hij voor bedoeld is. */
  const alle = [...bekend];
  const kent = (p) => bekend.has(p) ||
    patronen.some(v => p === v || p.startsWith(v + '/')) ||
    alle.some(v => v.startsWith(p + '/'));

  /* public/dist is BOUWUITVOER (geminificeerd). Die scannen we niet: het is
     dezelfde code twee keer, en een melding daar wijst naar een bestand dat
     niemand bewerkt. */
  const clientBestanden = loop(PUB, /\.(js|html)$/).filter(f => !rel(f).startsWith('public/dist'));
  const onbekend = new Map();
  const gebruik = /['"`](\/api\/[a-z0-9/_.-]+)['"`]/gi;
  for (const f of clientBestanden) {
    const bron = fs.readFileSync(f, 'utf8');
    let m;
    gebruik.lastIndex = 0;
    while ((m = gebruik.exec(bron))) {
      const p = m[1].replace(/\/$/, '');
      /* Een STUK van een pad overslaan. Heel veel schermen hebben bovenaan
         iets als api = (pad) => fetch('/api/foundation' + '/' + pad); dan is
         '/api/foundation' geen adres maar een voorvoegsel, en klagen dat het
         niet bestaat is gewoon fout. We kijken naar wat er direct voor en na
         het aanhalingsteken staat: een plus aan een van de kanten betekent dat
         het pad verder wordt opgebouwd. */
      const na = bron.slice(m.index + m[0].length, m.index + m[0].length + 24).trim();
      const voor = bron.slice(Math.max(0, m.index - 24), m.index).trimEnd();
      if (na.startsWith('+') || voor.endsWith('+')) continue;
      if (kent(p)) continue;
      if (!onbekend.has(p)) onbekend.set(p, rel(f));
    }
  }
  const lijst = [...onbekend].map(([p, f]) => p + '  (' + f + ')');
  assert.deepEqual(lijst, [], 'de app roept een pad aan dat de server niet kent:\n  ' + lijst.join('\n  '));
});

/* ---------------- 5. tokens die niemand ooit zet ----------------
   Een pagina die localStorage.getItem('rtg_iets_token') leest terwijl niets in
   het hele systeem die sleutel ooit ZET, is een pagina die altijd uitgelogd
   lijkt. Dat is een naamdrift-fout, en die glipt overal langs. */
test('BLINDE VLEK: elke gelezen opslagsleutel wordt ook ergens gezet', () => {
  /* public/dist is bouwuitvoer: dezelfde code nog een keer, met alle namen
     ingekort. Een melding daar wijst naar een bestand dat niemand bewerkt. */
  const alles = loop(PUB, /\.(js|html)$/).filter(f => !rel(f).startsWith('public/dist'));
  const gelezen = new Map(), gezet = new Set();
  for (const f of alles) {
    const bron = fs.readFileSync(f, 'utf8');
    let m;
    const rl = /(?:localStorage|sessionStorage)\.getItem\(\s*['"]([^'"]+)['"]/g;
    while ((m = rl.exec(bron))) if (!gelezen.has(m[1])) gelezen.set(m[1], rel(f));
    const rz = /(?:localStorage|sessionStorage)\.setItem\(\s*['"]([^'"]+)['"]/g;
    while ((m = rz.exec(bron))) gezet.add(m[1]);
    /* Heel veel bestanden zetten de naam eerst in een constante:
         var KEY = 'rtf_sessie';  ...  localStorage.setItem(KEY, ...)
       Een scanner die alleen setItem('...') leest, ziet dat niet en meldt de
       sleutel als wees. Dus: welke NAMEN gaan er via een variabele in setItem,
       en welke letterlijke waarde krijgen die variabelen in dit bestand? */
    const viaVar = new Set();
    const rv = /(?:localStorage|sessionStorage)\.setItem\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
    while ((m = rv.exec(bron))) viaVar.add(m[1]);
    for (const naam of viaVar) {
      const rw = new RegExp('\\b' + naam + '\\s*[:=]\\s*[\'"]([^\'"]+)[\'"]', 'g');
      while ((m = rw.exec(bron))) gezet.add(m[1]);
    }
  }
  // de server kan een sleutel ook via een inline script of een andere weg
  // zetten; die tellen mee, dus scannen we ook de serverbron
  for (const f of loop(path.join(ROOT, 'server'), /\.js$/)) {
    const bron = fs.readFileSync(f, 'utf8');
    let m;
    const rz = /setItem\(\s*['"]([^'"]+)['"]/g;
    while ((m = rz.exec(bron))) gezet.add(m[1]);
  }
  const wees = [...gelezen].filter(([k]) => !gezet.has(k)).map(([k, f]) => k + '  (' + f + ')');
  assert.deepEqual(wees, [], 'sleutel wordt gelezen maar nergens gezet:\n  ' + wees.join('\n  '));
});

/* ---------------- 6. knoppen die de CSP tegenhoudt ----------------

   Elke pagina wordt geserveerd met een nonce-CSP (middleware/voordeur.js):
   script-src 'self' + nonce, ZONDER 'unsafe-inline'. Dat betekent dat een
   handler in het HTML-attribuut -- onclick="..." -- door de browser geweigerd
   wordt. De knop staat er, hij ziet er goed uit, en hij doet niets. In de
   console staat een CSP-melding die niemand leest.

   Ook gebouwde HTML valt eronder, inclusief een venster uit window.open(''):
   zo'n leeg document erft de CSP van de pagina die het opende. Dat is hier
   nagemeten in een echte browser, niet aangenomen -- en het was mis: de knop
   "Printen" op het tafel-QR-blad zat op een onclick en deed dus nooit iets.

   De hele frontend werkt met addEventListener. Deze toets houdt dat zo, en gaat
   verder dan keuringsregel 2 in scripts/check.js: die kijkt alleen in .html. */
test('BLINDE VLEK: geen handler in een HTML-attribuut (die weigert de CSP)', () => {
  const bestanden = loop(PUB, /\.(js|html)$/).filter(f => !rel(f).startsWith('public/dist'));
  /* Alleen echte gebeurtenis-attributen. Niet elk woord dat met "on" begint:
     "onbeperkt=" of een sleutel "onder:" is geen handler. */
  const re = /\son(?:click|dblclick|change|input|submit|reset|focus|blur|load|error|keydown|keyup|keypress|mousedown|mouseup|mouseover|mouseout|mousemove|touchstart|touchend|touchmove|scroll|wheel|paste|drop|dragstart|dragover|contextmenu|toggle)\s*=/gi;
  const gevonden = [];
  for (const f of bestanden) {
    const bron = fs.readFileSync(f, 'utf8');
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(bron))) {
      const regel = bron.slice(0, m.index).split('\n').length;
      gevonden.push(rel(f) + ':' + regel + ' ' + m[0].trim());
    }
  }
  assert.deepEqual(gevonden, [], 'handler in een attribuut; de CSP weigert hem en de knop doet niets:\n  ' + gevonden.join('\n  '));
});

/* ---------------- 7. naar een element zoeken dat niet bestaat ----------------

   getElementById('typfout') geeft null. De code eromheen is meestal netjes met
   een `if (el)` afgeschermd, en dan gebeurt er precies niets: de knop opent wel
   het tabblad, maar zet de cursor niet in het veld; het paneel verschijnt wel,
   maar wordt niet gevuld. Geen foutmelding, geen rode toets, alleen een functie
   die stil de helft doet. Dat is de zuiverste vorm van een blinde vlek, en het
   was hier ook zo: de coach-vraagbalk op de PDA had geen id.

   Hoe we "bestaat" bepalen: de naam moet ELDERS in de frontend voorkomen als
   tekst -- in HTML, in gebouwde HTML, of als waarde die aan een hulpje wordt
   meegegeven. Dat laatste kan niet strenger: heel veel schermen bouwen hun
   velden met wvInput('wvZoek', ...) of E('input', { id: 'coachVraag' }), en wie
   alleen op id="..." kijkt meldt die allemaal als kapot (dat deed de eerste
   opzet: negen meldingen, waarvan vijf onzin). Wat overblijft is precies de
   drift: een naam die NERGENS anders staat dan bij het opzoeken zelf. */
test('BLINDE VLEK: er wordt niet gezocht naar een element dat nergens bestaat', () => {
  /* Geen uitzonderingen meer. Hier stonden vier resten van de oude
     inlogformulieren van de leden-app (regForm, toReg, toLogin, resetForm); die
     poort is vervangen door het gesprek met Rahul en die dode afhandeling is
     opgeruimd. Laat deze verzameling leeg: elke naam die hier bij zou moeten,
     is in principe code die weg mag. */
  const BEKEND = new Set();

  /* De GitHub Pages-voordeur staat bewust in de repositoryroot. Zijn gedrag
     staat in public/site/start/start.js; zonder index.html mee te lezen zag de
     scanner de echte DOM van dat script niet. */
  const bestanden = [path.join(ROOT, 'index.html'), ...loop(PUB, /\.(js|html)$/)]
    .filter(f => !rel(f).startsWith('public/dist'));
  const OPZOEK = /(?:getElementById\(\s*['"]([A-Za-z][\w-]*)['"]\s*\)|querySelector(?:All)?\(\s*['"]#([A-Za-z][\w-]*)['"]\s*\))/g;
  const bestaat = new Set(), verwezen = new Map();
  for (const f of bestanden) {
    const bron = fs.readFileSync(f, 'utf8');
    let m;
    OPZOEK.lastIndex = 0;
    while ((m = OPZOEK.exec(bron))) {
      const id = m[1] || m[2];
      if (!verwezen.has(id)) verwezen.set(id, rel(f) + ':' + bron.slice(0, m.index).split('\n').length);
    }
    // alles BEHALVE de opzoekingen: daar mag de naam vandaan komen
    const rest = bron.replace(OPZOEK, ' ');
    const lit = /['"]([A-Za-z][\w-]*)['"]/g;
    while ((m = lit.exec(rest))) bestaat.add(m[1]);
  }
  const wees = [...verwezen]
    .filter(([id]) => !bestaat.has(id) && !BEKEND.has(id))
    .map(([id, waar]) => '#' + id + '  (' + waar + ')');
  assert.deepEqual(wees, [], 'er wordt gezocht naar een element dat nergens bestaat:\n  ' + wees.join('\n  '));
});
