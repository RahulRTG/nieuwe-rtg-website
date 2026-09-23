#!/usr/bin/env node
/* ============================================================================
   WELKE VELDEN VAN HET EDGE-CONTRACT PUBLICEERT ELK SCHERM -- GEMETEN.

   WAAROM DIT SCRIPT ER IS

   De Edge krijgt een blikveld op de werkelijkheid (public/shared/edge/
   blikveld.js): negen velden -- identiteit, wereld, context, object,
   activiteit, presence, voortzetting, hoofdactie, trust -- plus de handelingen
   met hun stand (public/shared/edge/actiestaat.js). Dat blikveld is een
   PROJECTIE: het leest wat de schermen publiceren en verzint niets. Een veld
   dat leeg is, is dus een scherm dat het niet vertelt.

   "Hoeveel schermen publiceren een object" is daarmee een belofte die je
   alleen kunt METEN en niet kunt aflezen. Een scherm publiceert zijn context
   in JavaScript, na het laden, soms pas na een serverantwoord; de Edge komt
   er langs een keten van zeven laders; en of die keten op een scherm
   aankomt, hangt af van basis.js, randen.js, een data-rtg-world en of het
   scherm in een kader staat. Uit de bron raden wat daar uitkomt is precies de
   fout die LAT.md regel 2 verbiedt. Dit script opent elk scherm in een ECHTE
   browser, met een echte ledensessie, op telefoonformaat, en vraagt het aan
   window.RTGEdgeBlikveld.lees() -- dezelfde functie die de balk leest.

   WAT HET MEET, PER SCHERM

     velden    per veld 'ja' (er staat een waarde), 'nvt' (het scherm
               verklaart met data-rtg-edge-nvt dat dit veld hier niet bestaat,
               MET een niet-lege data-rtg-edge-nvt-reden) of 'nee'. Een
               verklaring zonder reden telt niet: een leeg vak zonder reden
               wordt gevuld met iemands eigen indruk (SERVICE.md par. 12).
     herkomst  per veld waar het blikveld de waarde vandaan haalde. `context`
               valt bijvoorbeeld terug op de documenttitel -- dan staat er
               'ja' met herkomst 'document', en dat is iets anders dan een
               scherm dat zijn context zelf publiceert. Lees de twee samen.
               Welke herkomst als "het scherm zelf" telt, staat per veld in
               ZELF hieronder, en nergens anders.
     acties    tellingen over lees().acties, gesplitst naar het register waar
               ze vandaan komen (RTGAdaptief tegenover edge-compat, de
               registerAction van de balk): standen, gezag, gevolg, herstel,
               gewicht en gebreken.
     gebreken  wat het blikveld en de actiestaat zelf als gebrek melden,
               ontdubbeld.
     http      de status van het document.

   Het tiende veld van het blikveld, `bevoegdheid`, staat er met opzet niet
   bij: dat is per constructie leeg (de Edge verleent zelf niets, EDGE.md), en
   een kolom die altijd 'nee' zegt, meet niets.

   WAT HET NIET DOET, en dat staat er even groot bij

     - Het bewaart GEEN WAARDEN, alleen of er een is. De identiteit is een
       codenaam, en een register in de repo is geen plek voor wat een sessie
       te zien kreeg.
     - Het raadt niet waarom een scherm geen blikveld heeft. Staat het er niet
       na vijftien seconden, dan leest het de keten in de pagina zelf na (body,
       wereld, basis.js, randen.js, elke lader) en noemt de eerste schakel die
       ontbreekt. Wat het niet kan vaststellen, heet zo.
     - Het meet de LEDENSESSIE. Een kantoor- of leveranciersscherm opent hier
       zoals een lid het ziet (vaak een inlog); dat is een meting van die
       sessie en geen oordeel over dat scherm onder zijn eigen rol.
     - Het meet een scherm dat VERS wordt geopend: elk scherm krijgt een eigen
       browsercontext met lege opslag. Zonder dat hangt `voortzetting` af van
       welk scherm dezelfde werker net daarvoor opende, en is de uitslag een
       eigenschap van de volgorde in plaats van het scherm.
     - `nvt` leest het van het body-attribuut en NIET via lees(): het blikveld
       kent data-rtg-edge-nvt nog niet. Dat is een stand die alleen deze meter
       ziet, en een reden dekt elk genoemd veld tegelijk. Vandaag gebruikt geen
       scherm het; wie het gaat gebruiken, zet het eerst in het blikveld.
     - Het klikt niets aan. Een veld dat pas na een handeling verschijnt (een
       object na een selectie) telt hier als 'nee'; dit is de stand bij
       binnenkomst.

   DE RATEL

   Staat er al een EDGEDEKKING.json, dan wordt per scherm vergeleken: een veld
   dat 'ja' was en nu 'nee' is, is ACHTERUIT -- ook als het scherm zijn hele
   blikveld kwijt is. Dan zakt het script, tenzij --aanvaard is meegegeven; dan
   schrijft het toch en staan ze in `aanvaardAchteruit`, zodat een besluit
   zichtbaar blijft in plaats van stil te verdwijnen. `basislijn` is de lijst
   schermen van de EERSTE meting en blijft daarna ongewijzigd staan.

   DRAAIEN

     node scripts/edgedekking.js              (meet, schrijft EDGEDEKKING.json)
     node scripts/edgedekking.js --aanvaard   (schrijft ook bij achteruitgang)
     node scripts/edgedekking.js --naloop     (geen browser: loopt het register
                                               achter op de schermen?)
     node scripts/edgedekking.js --stil       (alleen de eindregel)
     node scripts/edgedekking.js --alleen=/apps/agenda.html,/apps/geld.html
                                              (meet alleen deze, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'EDGEDEKKING.json');
const stil = process.argv.includes('--stil');
const aanvaard = process.argv.includes('--aanvaard');
const naloop = process.argv.includes('--naloop');
const alleenArg = process.argv.find((a) => a.startsWith('--alleen='));
/* Een onbekende vlag is een fout en geen stille volle meting: `--controle` zou
   anders een browserronde starten en het register overschrijven. */
const onbekend = process.argv.slice(2).filter((a) => !['--stil', '--aanvaard', '--naloop'].includes(a) && !a.startsWith('--alleen='));
if (require.main === module && onbekend.length) {
  console.error('edgedekking: onbekende vlag ' + onbekend.join(' ') + '. Bekend: --naloop, --aanvaard, --stil, --alleen=pad,pad');
  process.exit(2);
}
const ALLEEN = alleenArg ? alleenArg.slice('--alleen='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;

/* De negen velden van het contract, in de volgorde van het blikveld. */
const VELDEN = ['identiteit', 'wereld', 'context', 'object', 'activiteit', 'presence',
  'voortzetting', 'hoofdactie', 'trust'];
const STANDEN = ['AFWEZIG', 'GEBLOKKEERD', 'BESCHIKBAAR', 'LOPEND'];
const WERELDEN = ['living', 'travel', 'work', 'foundation'];
/* Vier werkers tegelijk: genoeg om een ronde binnen een kwartier te houden,
   weinig genoeg om de server niet de meting te laten worden. */
const WERKERS = 4;
const VIEWPORT = { width: 390, height: 844 };

/* Bij --alleen is stdout de JSON van de deelmeting; de voortgang gaat dan naar
   stderr, anders is die uitvoer niet te ontleden. */
function log(...a) { if (!stil) (ALLEEN ? console.error : console.log)(...a); }

/* De bevolking: elk scherm onder public/apps, ook foundation/ en juridisch/.
   Dezelfde vindwijze als scripts/tikken.js, zodat twee meters over dezelfde
   schermen praten. */
function alleSchermen() {
  const wortel = path.join(WORTEL, 'public', 'apps');
  const uit = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) loop(p);
      else if (naam.endsWith('.html')) uit.push('/' + path.relative(path.join(WORTEL, 'public'), p).split(path.sep).join('/'));
    }
  })(wortel);
  return uit.sort();
}

/* ZEGT HET SCHERM HET ZELF? Een `ja` zegt dat er een waarde is, niet wie hem
   leverde: de context is op bijna elk los scherm de titel die het casco uit
   document.title haalt, en de wereld komt uit de centrale wereldkaart.

   Daarom een GESLOTEN LIJST PER VELD, en geen patroon over alle velden. Het
   patroon (`^scherm`, plus het pagina-attribuut) liet twee dingen door die geen
   publicatie van het scherm zijn: `data-rtg-world` is een gebakken kopie van het
   MANIFEST (heritage-uitrol.js), en elke herkomst die toevallig met "scherm"
   begint telde mee, ook een die er morgen bij komt. Nu telt alleen wat hier
   staat, en een veld dat hier niet staat is een fout en geen stille nee.

   - identiteit, wereld, presence en voortzetting: nooit. De wereld komt uit de
     route, het blad of die kopie (K-reikwijdte: wereld telt nooit als zelf), en
     de andere drie komen uit de Edge-kern of het toestel.
   - context, object en activiteit: alleen `scherm`. In de schil heet wat uit een
     blad komt `blad` (edge/blikveld.js), en dat is de brug die publiceert, niet
     het scherm dat hier gemeten wordt.
   - hoofdactie: alleen `scherm:data-hoofdactie`, niet de padtabel.
   - trust: alleen `scherm:rail`; offline is een toestand van het TOESTEL. */
const ZELF = Object.freeze({
  identiteit: Object.freeze([]), wereld: Object.freeze([]),
  context: Object.freeze(['scherm']), object: Object.freeze(['scherm']), activiteit: Object.freeze(['scherm']),
  presence: Object.freeze([]), voortzetting: Object.freeze([]),
  hoofdactie: Object.freeze(['scherm:data-hoofdactie']), trust: Object.freeze(['scherm:rail'])
});
function zelf(veld, herkomst) {
  if (!Object.prototype.hasOwnProperty.call(ZELF, veld)) throw new Error('edgedekking: veld "' + veld + '" staat niet in ZELF');
  return ZELF[veld].indexOf(String(herkomst || '')) >= 0;
}

/* Schermen die een lid met opzet doorsturen en daarom niet als lid te meten
   zijn, MET de reden. Een nieuw scherm dat doorstuurt en hier niet staat, zakt:
   een nieuw kantoor- of zaakscherm stuurt een lid naar de inlog en zou anders
   het contract halen zonder ooit gemeten te zijn onder zijn eigen rol. */
const DOORVERWIJZING_MET_REDEN = {};

/* HET HARDE CONTRACT VOOR EEN NIEUW SCHERM (EDGE.md par. 7, besluit 4). Een
   scherm dat niet in de basislijn staat, moet gemeten zijn en de Edge laden,
   een wereld en een context hebben, een hoofdactie ZELF aanwijzen
   (data-hoofdactie) of met reden verklaren dat die er niet is, en geen enkele
   geblokkeerde handeling zonder reden dragen. Wie een eigen hoofdactie heeft,
   publiceert ook zijn context zelf (besluit 11); een scherm zonder hoofdactie
   mag bij de titel van het casco blijven. Het woont hier, bij de meter, en
   test/edgenieuwscherm.test.js roept het aan. */
function contractNieuw(reg, opSchijf) {
  const basis = new Set(reg.basislijn || []);
  const uit = [];
  for (const pad of opSchijf) {
    if (basis.has(pad)) continue;
    const s = (reg.schermen || {})[pad];
    if (!s) { uit.push(pad + ': nieuw scherm, niet gemeten (npm run edgedekking)'); continue; }
    if (s.status === 'omgeleid') {
      if (!DOORVERWIJZING_MET_REDEN[pad]) uit.push(pad + ': nieuw scherm stuurt een lid door' + (s.naar ? ' naar ' + s.naar : '') +
        ' en is dus niet gemeten; meet het onder zijn eigen rol of zet het met reden in DOORVERWIJZING_MET_REDEN');
      continue;
    }
    if (s.status !== 'gemeten') { uit.push(pad + ': nieuw scherm zonder Edge (' + s.status + ')'); continue; }
    for (const veld of ['wereld', 'context']) if (s.velden[veld] !== 'ja') uit.push(pad + ': publiceert geen ' + veld);
    const hoofd = s.velden.hoofdactie === 'nvt' || (s.velden.hoofdactie === 'ja' && zelf('hoofdactie', (s.herkomst || {}).hoofdactie));
    if (!hoofd) uit.push(pad + ': wijst zelf geen hoofdactie aan (data-hoofdactie) en verklaart ook niet waarom niet');
    /* Besluit 11 (EDGE.md par. 8): wie handelingen heeft, zegt ook zelf waar je
       bent. Een scherm dat met reden geen hoofdactie heeft, mag bij de titel
       van het casco blijven. */
    else if (s.velden.hoofdactie === 'ja' && !zelf('context', (s.herkomst || {}).context)) {
      uit.push(pad + ': heeft een eigen hoofdactie maar publiceert zijn context niet zelf (RTGAdaptief.context)');
    }
    for (const [bron, a] of Object.entries(s.acties || {})) {
      if (a.geblokkeerdZonderWaarom) uit.push(pad + ': ' + a.geblokkeerdZonderWaarom + ' geblokkeerde handeling(en) zonder reden (' + bron + ')');
    }
  }
  return uit;
}
module.exports = { alleSchermen, contractNieuw, zelf, ZELF, achteruitgang, VELDEN, DOORVERWIJZING_MET_REDEN };

/* ---------------------------------------------------------------------------
   DE NALOOP draait vóór alles: geen server, geen browser. Hij meet niet; hij
   kijkt of de laatste meting nog over dezelfde schermen gaat als de boom. */
if (naloop) {
  if (!fs.existsSync(DOEL)) {
    console.error('EDGEDEKKING.json bestaat niet. Draai: npm run edgedekking');
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  const gemeten = Object.keys(j.schermen || {});
  const nu = alleSchermen();
  const nietGemeten = nu.filter((p) => !(p in (j.schermen || {})));
  const verdwenen = gemeten.filter((p) => !fs.existsSync(path.join(WORTEL, 'public', p))).sort();
  if (nietGemeten.length || verdwenen.length) {
    if (nietGemeten.length) console.error('niet gemeten (' + nietGemeten.length + '): ' + nietGemeten.join(', '));
    if (verdwenen.length) console.error('gemeten maar het bestand bestaat niet meer (' + verdwenen.length + '): ' + verdwenen.join(', '));
    console.error('EDGEDEKKING.json loopt achter op de schermen. Draai: npm run edgedekking');
    process.exit(1);
  }
  console.log('edgedekking (naloop): ' + gemeten.length + ' schermen in het register, en dat zijn precies de schermen onder public/apps.');
  process.exit(0);
}

/* De wacht: dit script schrijft een register, dus het start niet bij het
   requiren (scripts/meetkeuring.js houdt dit vast). */
if (require.main !== module) return;

/* ---------------------------------------------------------------------------
   DE SESSIE: een vers lid met een RTG Pass dat de ledenovereenkomst ECHT heeft
   getekend -- langs dezelfde routes als test/rtg-adaptive-edge.e2e.js, en niet
   met een nagebootst antwoord. Een meter die de intake wegfaket, meet een huis
   dat een lid nooit ziet. */
async function maakLid(base) {
  const post = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(pad + ' gaf ' + r.status + ': ' + (j && j.error || ''));
    return j;
  };
  const u = Date.now().toString(36);
  const naam = 'Edgemeter Lid';
  const acc = await post('/api/auth/register', { name: naam, email: 'edgedekking' + u + '@voorbeeld.test',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  if (!acc || !acc.token) throw new Error('registreren gaf geen token');
  const status = await post('/api/onboarding/status', {}, acc.token);
  const versie = status && status.contract && status.contract.versie;
  if (!Number.isSafeInteger(versie)) throw new Error('de onboardingstatus noemt geen contractversie');
  await post('/api/onboarding/teken', { naam, akkoord: true, contractVersion: versie }, acc.token);
  return acc.token;
}

/* ---------------------------------------------------------------------------
   IN DE PAGINA. Deze functies draaien in de browser en geven alleen gewone
   gegevens terug. */

/* De keten naar het blikveld, schakel voor schakel. Wordt alleen gelezen als
   het blikveld niet verschijnt, om de reden te METEN in plaats van te raden.

   Per schakel twee vragen: staat zijn globale naam er (geladen), en is het
   bestand ooit OPGEVRAAGD -- als script-element in het document of als
   bron in de resource timing, met de http-status erbij waar de browser die
   kent. Beide bronnen, want elk van de twee mist iets: een script dat een
   lader weer uit de DOM haalt staat alleen in de timing, en de timingbuffer
   (standaard 250 regels) liep op zware schermen VOL -- de eerste versie van
   deze meter meldde daardoor "nooit opgevraagd" over een bestand dat gewoon
   geladen was. De buffer wordt daarom bij het openen vergroot (addInitScript
   in meetScherm), en het document telt mee. */
const SCHAKELS = [
  { code: 'edge-systeem', pad: '/shared/rtg-edge-system.js', naam: 'RTGEdge' },
  { code: 'edge2-lader', pad: '/shared/rtg-edge-2-loader.js', naam: '__RTGEdge2Loader' },
  { code: 'edge2', pad: '/shared/rtg-edge-2.js', naam: 'RTGEdge2' },
  { code: 'adaptieve-lader', pad: '/shared/rtg-adaptive-edge-loader.js', naam: 'RTGAdaptiveEdgeLoader' },
  { code: 'kern', pad: '/shared/rtg-adaptive-edge-core.js', naam: 'RTGAdaptiveEdgeCore' },
  { code: 'actiestaat', pad: '/shared/edge/actiestaat.js', naam: 'RTGEdgeActiestaat' },
  { code: 'hoofdactie', pad: '/shared/edge/blikveld-hoofdactie.js', naam: 'RTGEdgeBlikveldHoofdactie' },
  { code: 'blikveld', pad: '/shared/edge/blikveld.js', naam: 'RTGEdgeBlikveld' }
];
function ketenInPagina(schakels) {
  const b = document.body;
  const padVan = (src) => { try { return new URL(src, location.href).pathname; } catch (e) { return ''; } };
  const scripts = Array.from(document.scripts).map((s) => ({ pad: padVan(s.getAttribute('src') || ''),
    inHead: !!(s.parentNode && s.closest && s.closest('head')), defer: !!s.defer, async: !!s.async,
    module: s.type === 'module' }));
  const vind = (pad) => scripts.find((s) => s.pad === pad) || null;
  let kader = false;
  try { kader = window.self !== window.top; } catch (e) { kader = true; }
  const timing = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
  const bron = (pad) => {
    const e = timing.filter((x) => { try { return new URL(x.name).pathname === pad; } catch (y) { return false; } }).pop();
    return { gevraagd: !!(e || vind(pad)), status: e && typeof e.responseStatus === 'number' && e.responseStatus ? e.responseStatus : null };
  };
  return {
    pad: location.pathname,
    body: !!b,
    wereld: b ? b.getAttribute('data-rtg-world') : null,
    projectie: !!(b && b.hasAttribute('data-rtg-projectie')),
    embedKlasse: !!(b && b.classList.contains('rtg-edge-embed')),
    embedParam: new URLSearchParams(location.search).get('embed') === '1',
    kader,
    basis: vind('/shared/basis.js'),
    randenScript: !!vind('/shared/randen.js'),
    randenBoot: !!(window.__RTGRandenBoot || window.RTGRanden),
    edgeActief: !!(window.RTGEdge && window.RTGEdge.active),
    schakels: schakels.map((s) => Object.assign({ code: s.code, pad: s.pad, geladen: !!window[s.naam] }, bron(s.pad)))
  };
}

/* De meting zelf: lees() een keer, teruggebracht tot WAT er is en niet wat
   het is. Waarden gaan de pagina niet uit. */
function leesInPagina(velden) {
  const l = window.RTGEdgeBlikveld.lees();
  const b = document.body;
  const nvt = String((b && b.getAttribute('data-rtg-edge-nvt')) || '').split(/\s+/).filter(Boolean);
  const nvtReden = String((b && b.getAttribute('data-rtg-edge-nvt-reden')) || '').trim();
  const v = {};
  for (const naam of velden) {
    const veld = l.velden && l.velden[naam];
    v[naam] = { er: !!(veld && veld.waarde != null), herkomst: veld ? String(veld.herkomst || '') : '' };
  }
  const acties = (l.acties || []).map((a) => ({
    id: String(a.id || ''),
    herkomst: String(a.herkomst || ''),
    staat: a.staat || null,
    waaromReden: !!(a.waarom && typeof a.waarom.reden === 'string' && a.waarom.reden.trim()),
    gezag: a.gezag || null,
    gevolg: a.gevolg && a.gevolg.klasse ? String(a.gevolg.klasse) : null,
    herstel: a.herstel || null,
    gewicht: a.gewicht || null,
    gebreken: Array.isArray(a.gebreken) ? a.gebreken.map(String) : []
  }));
  return { pad: location.pathname, velden: v, acties,
    gebreken: Array.isArray(l.gebreken) ? l.gebreken.map(String) : [], nvt, nvtReden };
}

/* ---------------------------------------------------------------------------
   DE REDEN VAN EEN ONTBREKEND BLIKVELD, uit de keten die in de pagina is
   nagelezen. De volgorde is de volgorde waarin de keten zelf loopt
   (basis.js -> randen.js -> rtg-edge-system -> rtg-edge-2 -> de adaptieve
   lader -> de kern -> actiestaat -> het blikveld); de EERSTE schakel die
   ontbreekt is de reden, en wat daarna komt kon niet eens beginnen.

   "Opgevraagd maar niet geladen" en "nooit opgevraagd" zijn twee standen en
   geen een: de eerste is een keten die nog liep of een bestand dat faalde (de
   http-status staat erbij als de browser hem kent), de tweede een schakel die
   nooit aan de beurt kwam. */
function redenZonderBlikveld(k) {
  if (!k) return { code: 'niet-te-lezen', reden: 'de pagina liet zich niet nalezen' };
  if (!k.body) return { code: 'geen-body', reden: 'het document heeft geen body' };
  const projectie = k.projectie ? ' (de body draagt data-rtg-projectie: een projectiescherm)' : '';
  if (k.kader || k.embedParam || k.embedKlasse) {
    return { code: 'ingebed', reden: 'het scherm staat ingebed (' + [k.embedKlasse ? 'rtg-edge-embed op de body' : '',
      k.embedParam ? '?embed=1' : '', k.kader ? 'in een kader' : ''].filter(Boolean).join(', ') +
      '): de Edge hoort bij het bovenliggende scherm' + projectie };
  }
  const wereldGeldig = WERELDEN.includes(k.wereld);
  if (!k.randenBoot) {
    if (!k.basis && !k.randenScript) {
      return { code: 'geen-basis', reden: 'het scherm laadt shared/basis.js noch shared/randen.js, dus niets start de Edge' + projectie };
    }
    if (k.basis && !k.randenScript && k.basis.inHead && !k.basis.defer && !k.basis.async && !k.basis.module) {
      return { code: 'basis-in-head', reden: 'shared/basis.js laadt synchroon in de head en het scherm laadt randen.js niet zelf: ' +
        'de Edge-aanvulling (basis-01ac-edge.js) draait voordat er een body is en doet dan niets' +
        (wereldGeldig ? '' : '; bovendien draagt de body geen data-rtg-world') + projectie };
    }
    if (!wereldGeldig && !k.randenScript) {
      return { code: 'geen-wereld', reden: 'de body draagt geen data-rtg-world (living, travel, work of foundation); ' +
        'basis.js vult de Edge alleen aan op een scherm met een wereld' + (k.wereld ? ' (hier staat "' + k.wereld + '")' : '') + projectie };
    }
    return { code: 'randen-niet-gestart', reden: 'randen.js is niet gestart, en uit de pagina valt niet vast te stellen waarom' + projectie };
  }
  const s = {};
  for (const x of k.schakels) s[x.code] = x;
  const niet = (x, vorige) => x.gevraagd
    ? { code: x.code + '-niet-geladen', reden: x.pad + ' is opgevraagd' + (x.status ? ' (http ' + x.status + ')' : '') +
        ' maar zette geen globale naam: het laden faalde, of de keten liep nog toen de meter keek' }
    : { code: x.code + '-niet-gevraagd', reden: x.pad + ' is nooit opgevraagd' + (vorige ? '; de schakel ervoor (' + vorige + ') staat er wel' : '') };
  if (!s['edge-systeem'].geladen) {
    if (!s['edge-systeem'].gevraagd) {
      return { code: 'randen-zonder-wereld', reden: 'randen.js draaide maar laadde het Edge-casco nooit: geen geldige ' +
        'data-rtg-world en niet in zijn uitwijklijst' + (k.wereld ? ' (hier staat "' + k.wereld + '")' : '') + projectie };
    }
    return niet(s['edge-systeem'], 'randen.js');
  }
  if (!k.edgeActief) {
    return { code: 'edge-niet-gestart', reden: 'RTGEdge is geladen maar niet gestart (geen wereldcatalogus, of een fout bij het tekenen van het casco)' };
  }
  const volgorde = ['edge2-lader', 'edge2', 'adaptieve-lader', 'kern'];
  let vorige = 'rtg-edge-system.js';
  for (const c of volgorde) {
    if (!s[c].geladen) return niet(s[c], vorige);
    vorige = s[c].pad.split('/').pop();
  }
  /* actiestaat is ZACHT: faalt hij, dan gaat de lader toch door naar het
     blikveld. Hij is dus alleen de reden als het blikveld nog niet eens is
     opgevraagd. */
  if (!s.blikveld.gevraagd && !s.actiestaat.geladen) return niet(s.actiestaat, vorige);
  /* Tussen het einde van de wachttijd en het nalezen kan het blikveld alsnog
     binnenkomen. Dan is er geen ontbrekende schakel, alleen een trage, en dat
     heet zo -- niet "laadde niet". */
  if (s.blikveld.geladen) {
    return { code: 'blikveld-te-laat', reden: 'het blikveld stond er wel toen de keten werd nagelezen: het kwam pas na de wachttijd van vijftien seconden' };
  }
  return niet(s.blikveld, s.actiestaat.geladen ? 'actiestaat.js' : vorige);
}

/* ---------------------------------------------------------------------------
   TELLEN. Een vaste vorm, ook waar alles nul is: een sleutel die alleen
   verschijnt als hij iets telt, leest als "nooit gemeten". */
function leegActies() {
  return { totaal: 0, perStaat: { AFWEZIG: 0, GEBLOKKEERD: 0, BESCHIKBAAR: 0, LOPEND: 0 },
    /* zonderStaat: een handeling zonder stand. Kan alleen als actiestaat.js niet
       laadde (het blikveld is ZACHT en leest dan toch); weglaten zou zo'n
       handeling stil uit de telling laten vallen. */
    zonderStaat: 0,
    gezagBekend: 0,
    /* GEBLOKKEERD zonder reden kan per constructie niet (actiestaat.js vult een
       reden in en meldt 'redenloos'). Staat hier iets anders dan nul, dan is dat
       een bevinding en geen telling. */
    geblokkeerdZonderWaarom: 0,
    gevolg: { bekend: 0, onvolledig: 0, onbekend: 0, zonder: 0 },
    herstelBekend: 0,
    /* metGewicht: een gewicht dat er IS en niet licht is. Een ontbrekend
       gewicht is onbekend, niet zwaar. */
    metGewicht: 0,
    metGebreken: 0 };
}
function telActie(t, a) {
  t.totaal++;
  if (STANDEN.includes(a.staat)) t.perStaat[a.staat]++; else t.zonderStaat++;
  if (a.gezag && a.gezag !== 'onbekend') t.gezagBekend++;
  if (a.staat === 'GEBLOKKEERD' && !a.waaromReden) t.geblokkeerdZonderWaarom++;
  if (a.gevolg && Object.prototype.hasOwnProperty.call(t.gevolg, a.gevolg) && a.gevolg !== 'zonder') t.gevolg[a.gevolg]++;
  else t.gevolg.zonder++;
  if (a.herstel && a.herstel !== 'onbekend') t.herstelBekend++;
  if (a.gewicht && a.gewicht !== 'licht') t.metGewicht++;
  if (a.gebreken.length) t.metGebreken++;
}
function telOp(doel, bron) {
  for (const k of Object.keys(bron)) {
    if (typeof bron[k] === 'number') doel[k] += bron[k];
    else for (const s of Object.keys(bron[k])) doel[k][s] += bron[k][s];
  }
}
/* De twee registers die het blikveld kent, altijd allebei, in vaste volgorde.
   Een onverwachte herkomst krijgt een eigen bak en wordt niet bijgeteld bij een
   bestaande -- dat zou raden zijn. */
const HERKOMSTEN = ['RTGAdaptief', 'edge-compat'];
function actieTelling(acties) {
  const uit = {};
  for (const h of HERKOMSTEN) uit[h] = leegActies();
  for (const a of acties) {
    if (!uit[a.herkomst]) uit[a.herkomst] = leegActies();
    telActie(uit[a.herkomst], a);
  }
  const vast = {};
  for (const h of Object.keys(uit).sort((x, y) => (HERKOMSTEN.indexOf(x) + 1 || 99) - (HERKOMSTEN.indexOf(y) + 1 || 99) || x.localeCompare(y))) vast[h] = uit[h];
  return vast;
}

/* Van een ruwe lezing naar de regel van een scherm. */
function regelVan(r, http, stabiel) {
  const velden = {}, herkomst = {};
  for (const naam of VELDEN) {
    const v = r.velden[naam];
    herkomst[naam] = v.herkomst;
    if (v.er) velden[naam] = 'ja';
    else if (r.nvt.includes(naam) && r.nvtReden) velden[naam] = 'nvt';
    else velden[naam] = 'nee';
  }
  const gebreken = new Set(r.gebreken);
  for (const a of r.acties) for (const g of a.gebreken) gebreken.add(g);
  return { status: 'gemeten', http, velden, herkomst, acties: actieTelling(r.acties),
    gebreken: Array.from(gebreken).sort(), stabiel };
}

/* ---------------------------------------------------------------------------
   EEN SCHERM METEN. */
const kort = (s) => String(s || '').split('\n')[0].slice(0, 200);
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
/* Een scherm dat zichzelf doorstuurt vernietigt de context waarin evaluate
   draaide. Dat is geen meetfout maar een waarneming; dus opnieuw proberen na
   het laden, en daarna kijken WAAR de pagina staat. */
async function veilig(page, fn, arg) {
  for (let i = 0; i < 3; i++) {
    try { return await page.evaluate(fn, arg); }
    catch (e) {
      if (!/context was destroyed|navigat/i.test(e.message) || i === 2) throw e;
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    }
  }
  return null;
}
async function wachtOp(page, fn, ms) {
  const tot = Date.now() + ms;
  while (Date.now() < tot) {
    const ja = await page.evaluate(fn).catch(() => false);
    if (ja) return true;
    await wacht(250);
  }
  return false;
}

async function meetScherm(browser, base, token, pad) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: VIEWPORT,
    isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  let http = null;
  try {
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      /* Zie ketenInPagina: met 250 regels liep de buffer op zware schermen vol. */
      try { performance.setResourceTimingBufferSize(5000); } catch (e) {}
    }, token);
    const page = await ctx.newPage();
    /* Een alert of confirm zou de pagina bevriezen; wegklikken is hier de
       enige neutrale keuze (bevestigen zou een handeling uitvoeren). */
    page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
    try {
      const resp = await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 30000 });
      http = resp ? resp.status() : null;
    } catch (e) {
      return { status: 'fout', http, reden: 'laden mislukte: ' + kort(e.message) };
    }
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    const heeftBlik = await wachtOp(page, () => !!window.RTGEdgeBlikveld, 15000);
    const waar = (() => { try { return new URL(page.url()).pathname; } catch (e) { return ''; } })();
    if (waar !== pad) {
      return { status: 'omgeleid', http, naar: waar, reden: 'het scherm stuurde door naar ' + waar +
        '; wat daar staat is een ander scherm en telt hier niet' };
    }
    if (!heeftBlik) {
      const keten = await veilig(page, ketenInPagina, SCHAKELS).catch(() => null);
      const r = http != null && http !== 200
        ? { code: 'http-' + http, reden: 'het document gaf http ' + http }
        : redenZonderBlikveld(keten);
      return { status: 'geen-blikveld', http, redenCode: r.code, reden: r.reden };
    }
    /* Het blikveld staat er; de rest van de keten (invoer, balk, bediening,
       signalen) kan nog onderweg zijn en vult de momentopname van de kern.
       Daarom: wachten op de laatste schakel, en daarna lezen tot twee lezingen
       op rij gelijk zijn. Een scherm dat niet tot rust komt, staat er als
       `stabiel: false` -- zijn uitslag is dan de laatste lezing, niet een
       gekozen mooie. */
    await wachtOp(page, () => !!window.RTGAdaptiveEdgeSignals, 5000);
    await wacht(400);
    let vorige = null, lezing = null, stabiel = false;
    for (let i = 0; i < 8; i++) {
      lezing = await veilig(page, leesInPagina, VELDEN);
      const sleutel = JSON.stringify(lezing);
      if (sleutel === vorige) { stabiel = true; break; }
      vorige = sleutel;
      await wacht(600);
    }
    if (!lezing || lezing.pad !== pad) {
      return { status: 'omgeleid', http, naar: lezing ? lezing.pad : '', reden: 'het scherm stuurde door tijdens het lezen' };
    }
    return regelVan(lezing, http, stabiel);
  } catch (e) {
    return { status: 'fout', http, reden: kort(e.message) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* Vaste vorm voor elke regel, ook als er niets gemeten is. */
function vorm(r) {
  const uit = { status: r.status, http: r.http == null ? null : r.http,
    velden: r.velden || null, herkomst: r.herkomst || null, acties: r.acties || null,
    gebreken: r.gebreken || [] };
  if (r.status === 'gemeten') uit.stabiel = r.stabiel;
  if (r.redenCode) uit.redenCode = r.redenCode;
  if (r.naar !== undefined) uit.naar = r.naar;
  if (r.reden) uit.reden = r.reden;
  if (r.herhaald) uit.herhaald = true;
  if (r.eersteRonde) uit.eersteRonde = r.eersteRonde;
  return uit;
}
/* Wat de eerste ronde over een scherm zei, in een regel: genoeg om te zien
   DAT hij anders uitviel en hoe, zonder een tweede volledige regel. */
function samenvat(r) {
  if (r.status !== 'gemeten') return r.status + (r.redenCode ? ' (' + r.redenCode + ')' : '') + (r.naar ? ' -> ' + r.naar : '');
  const ja = VELDEN.filter((v) => r.velden[v] === 'ja');
  return 'gemeten' + (r.stabiel ? '' : ', niet tot rust') + '; ja: ' + (ja.join(', ') || 'geen');
}

async function meet(schermen, verdacht) {
  const { laadPlaywright, browserOpties, geenBrowser, startServer, stop, _poort } = require(path.join(WORTEL, 'test', 'helper.js'));
  const pw = laadPlaywright({ eigenDriver: false });
  const opties = pw ? browserOpties(pw) : null;
  if (!pw || !opties) {
    console.error('Geen browser: ' + (geenBrowser(pw) || 'onbekend') + '. Dit script meet in een echte browser.');
    process.exit(2);
  }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-edgedekking-'));
  /* De stderr van de server lezen we zelf. De strenge poort van de helper zou
     een 5xx van de server omzetten in exitcode 1 van DIT script, en dat is een
     andere vraag dan de dekking van de Edge. Weggooien doen we ze ook niet: ze
     worden geteld en staan in het register. */
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP }, stderr: 'pipe' });
  let serverfouten = 0, rest = '';
  srv.child.stderr.on('data', (buf) => {
    rest += buf.toString();
    const regels = rest.split('\n'); rest = regels.pop();
    for (const r of regels) if (_poort.isFataal(r)) serverfouten++;
  });
  let browser;
  const uit = {};
  try {
    const token = await maakLid(srv.base);
    browser = await pw.chromium.launch(opties);
    const rij = schermen.slice();
    let klaar = 0;
    const werker = async () => {
      while (rij.length) {
        const pad = rij.shift();
        uit[pad] = await meetScherm(browser, srv.base, token, pad);
        klaar++;
        if (klaar % 25 === 0 || klaar === schermen.length) log('  ' + klaar + '/' + schermen.length + ' schermen gemeten');
      }
    };
    await Promise.all(Array.from({ length: Math.min(WERKERS, schermen.length) }, werker));

    /* DE TWEEDE RONDE, EEN VOOR EEN. Vier schermen tegelijk op een volle
       machine is een andere meting dan een lid dat een scherm opent: in de
       eerste volle ronde van 23 september 2026 kwam op acht zware schermen het
       blikveld niet binnen vijftien seconden, en los gemeten stond het er op
       alle acht gewoon. Een scherm dat in de volle ronde geen blikveld had, niet
       tot rust kwam, faalde of een veld verloor, wordt daarom nog een keer
       gemeten zonder dat er iets naast draait -- en DIE uitslag telt. Viel de
       eerste ronde anders uit, dan staat dat erbij (`eersteRonde`): drukgevoelig
       is een eigenschap van het scherm die niemand hoort weg te poetsen, en een
       verschil dat alleen onder druk ontstaat, is geen achteruitgang van het
       scherm. Dezelfde vorm als de herstelproef (EXECUTIE.md: wat in de volle
       ronde niet lukt, draait nog een keer alleen). */
    const opnieuw = verdacht ? schermen.filter((p) => verdacht(p, vorm(uit[p]))) : [];
    if (opnieuw.length) {
      log('  tweede ronde, een voor een: ' + opnieuw.length + ' schermen');
      for (const p of opnieuw) {
        const eerste = vorm(uit[p]);
        const tweede = await meetScherm(browser, srv.base, token, p);
        if (JSON.stringify(vorm(tweede)) !== JSON.stringify(eerste)) tweede.eersteRonde = samenvat(eerste);
        tweede.herhaald = true;
        uit[p] = tweede;
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  }
  return { uitslag: uit, serverfouten };
}

/* ---------------------------------------------------------------------------
   DE TELLING over alle schermen. */
function telling(schermen) {
  const paden = Object.keys(schermen);
  const perStatus = { gemeten: 0, 'geen-blikveld': 0, omgeleid: 0, fout: 0 };
  const geenBlikveld = {};
  const perVeld = {};
  for (const v of VELDEN) perVeld[v] = { ja: 0, zelf: 0, nee: 0, nvt: 0, zonderMeting: 0 };
  const acties = {};
  for (const h of HERKOMSTEN) acties[h] = leegActies();
  const gebreken = {};
  let onrustig = 0, herhaald = 0, andersInEersteRonde = 0;
  for (const p of paden) {
    const s = schermen[p];
    if (s.herhaald) herhaald++;
    if (s.eersteRonde) andersInEersteRonde++;
    perStatus[s.status] = (perStatus[s.status] || 0) + 1;
    if (s.status === 'geen-blikveld') geenBlikveld[s.redenCode] = (geenBlikveld[s.redenCode] || 0) + 1;
    if (s.status !== 'gemeten') { for (const v of VELDEN) perVeld[v].zonderMeting++; continue; }
    if (!s.stabiel) onrustig++;
    for (const v of VELDEN) {
      perVeld[v][s.velden[v]]++;
      if (s.velden[v] === 'ja' && zelf(v, (s.herkomst || {})[v])) perVeld[v].zelf++;
    }
    for (const h of Object.keys(s.acties)) {
      if (!acties[h]) acties[h] = leegActies();
      telOp(acties[h], s.acties[h]);
    }
    for (const g of s.gebreken) gebreken[g] = (gebreken[g] || 0) + 1;
  }
  const gesorteerd = (o) => Object.keys(o).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {});
  return { schermen: paden.length, metBlikveld: perStatus.gemeten, perStatus,
    geenBlikveld: gesorteerd(geenBlikveld), onrustig, herhaald, andersInEersteRonde, perVeld, acties,
    /* per gebrek: op HOEVEEL SCHERMEN het voorkomt (per scherm ontdubbeld) */
    gebreken: gesorteerd(gebreken) };
}

/* DE RATEL: welk veld was 'ja' en is nu 'nee'? Een scherm dat zijn blikveld
   kwijt is, verliest al zijn velden tegelijk -- dat is de grootste
   achteruitgang, niet een die buiten de vergelijking valt. 'nvt' met een reden
   is geen achteruitgang: dat is een verklaring. */
function achteruitgang(oud, nieuw) {
  const uit = [];
  for (const pad of Object.keys(oud.schermen || {}).sort()) {
    const o = oud.schermen[pad], n = nieuw[pad];
    if (!o || !o.velden || !n) continue;
    for (const v of VELDEN) {
      if (o.velden[v] !== 'ja') continue;
      const nu = n.velden ? n.velden[v] : 'nee';
      if (nu === 'nee') { uit.push({ pad, veld: v, was: 'ja', nu: 'nee', status: n.status }); continue; }
      /* Ook achteruit: het scherm zei het ZELF en nu komt het uit een terugval
         (casco, route, padtabel). Dan blijft het 'ja' terwijl er iets verdween. */
      const hOud = (o.herkomst || {})[v], hNu = (n.herkomst || {})[v];
      if (nu === 'ja' && zelf(v, hOud) && !zelf(v, hNu)) uit.push({ pad, veld: v, was: 'ja (' + hOud + ')', nu: 'ja (' + hNu + ')', status: n.status });
    }
  }
  return uit;
}

(async () => {
  const alle = alleSchermen();
  const schermen = ALLEEN ? ALLEEN : alle;
  if (ALLEEN) {
    const vreemd = ALLEEN.filter((p) => !alle.includes(p));
    if (vreemd.length) { console.error('Geen scherm onder public/apps: ' + vreemd.join(', ')); process.exit(2); }
  }
  log('Edgedekking: ' + schermen.length + ' schermen in een echte browser, als lid, op ' + VIEWPORT.width + 'x' + VIEWPORT.height + '.');
  /* Het vorige register is er vóór de meting, want de tweede ronde moet weten
     welk scherm een veld verloor. Een deelmeting vergelijkt niet. */
  const oud = !ALLEEN && fs.existsSync(DOEL) ? JSON.parse(fs.readFileSync(DOEL, 'utf8')) : null;
  const verdacht = (pad, r) => r.status === 'geen-blikveld' || r.status === 'fout' ||
    (r.status === 'gemeten' && !r.stabiel) ||
    (!!oud && achteruitgang({ schermen: { [pad]: (oud.schermen || {})[pad] } }, { [pad]: r }).length > 0);
  const { uitslag, serverfouten } = await meet(schermen, verdacht);
  const regels = {};
  for (const p of Object.keys(uitslag).sort()) regels[p] = vorm(uitslag[p]);
  const t = telling(regels);

  if (ALLEEN) {
    /* Een deelmeting schrijft niets: een register over een handvol schermen zou
       de basislijn en de ratel van de volle meting ondermijnen. */
    console.log(JSON.stringify({ schermen: regels, telling: t }, null, 2));
    return;
  }

  const achteruit = oud ? achteruitgang(oud, regels) : [];
  const basislijn = oud && Array.isArray(oud.basislijn) ? oud.basislijn : Object.keys(regels).sort();

  const samenvatting = VELDEN.map((v) => t.perVeld[v].ja + '/' + t.schermen + ' schermen hebben ' + v +
    ', waarvan ' + t.perVeld[v].zelf + ' door het scherm zelf' + (t.perVeld[v].nvt ? ' (+' + t.perVeld[v].nvt + ' nvt)' : ''));
  const eindregel = 'edgedekking: ' + t.metBlikveld + '/' + t.schermen + ' schermen met een blikveld; ' +
    VELDEN.map((v) => v + ' ' + t.perVeld[v].ja).join(', ') +
    (achteruit.length ? '; ' + achteruit.length + ' velden achteruit' : '');

  if (achteruit.length && !aanvaard) {
    for (const a of achteruit) console.error('ACHTERUIT: ' + a.pad + ' ' + a.veld + ': ' + a.was + ' -> ' + a.nu +
      (a.status !== 'gemeten' ? ' (status ' + a.status + ')' : ''));
    console.error(achteruit.length + ' velden gingen achteruit. EDGEDEKKING.json is NIET bijgewerkt. ' +
      'Is dit bedoeld, draai dan: node scripts/edgedekking.js --aanvaard');
    console.log(eindregel);
    process.exit(1);
  }

  const register = {
    stempel: stempel(),
    uitleg: 'Per scherm onder public/apps: welke velden van het Edge-contract het scherm publiceert, gemeten in een echte ' +
      'browser via window.RTGEdgeBlikveld.lees(), als vers lid met een RTG Pass en getekende overeenkomst, op ' +
      VIEWPORT.width + 'x' + VIEWPORT.height + ' (touch), elk scherm in een eigen lege browsercontext. ' +
      "'ja' = er staat een waarde (lees herkomst erbij: context valt terug op de documenttitel); 'nvt' = de body verklaart " +
      "het veld met data-rtg-edge-nvt EN een niet-lege data-rtg-edge-nvt-reden; anders 'nee'. De stand bij binnenkomst: " +
      'er wordt niets aangeklikt. Waarden worden niet bewaard, alleen of er een is. geen-blikveld draagt de eerste ' +
      'ontbrekende schakel van de laadketen, in de pagina nagelezen. Wat in de volle ronde (vier tegelijk) geen blikveld had, ' +
      'niet tot rust kwam of een veld verloor, is daarna los herhaald en die uitslag telt; eersteRonde zegt wat de volle ' +
      'ronde zag als dat anders was. gebreken in de telling = op hoeveel schermen.',
    sessie: 'lid',
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height, isMobile: true, hasTouch: true },
    serverfouten,
    basislijn,
    aanvaardAchteruit: aanvaard ? achteruit : [],
    schermen: regels,
    telling: t
  };
  fs.writeFileSync(DOEL, JSON.stringify(register, null, 2) + '\n');

  if (!stil) {
    for (const r of samenvatting) console.log(r);
    console.log('Status: ' + Object.entries(t.perStatus).map(([k, n]) => k + ' ' + n).join(', ') +
      (t.onrustig ? '; ' + t.onrustig + ' schermen kwamen niet tot rust' : ''));
    if (t.herhaald) console.log('Tweede ronde: ' + t.herhaald + ' schermen los herhaald, ' + t.andersInEersteRonde +
      ' vielen in de volle ronde anders uit (eersteRonde staat erbij).');
    if (Object.keys(t.geenBlikveld).length) console.log('Zonder blikveld, per reden: ' +
      Object.entries(t.geenBlikveld).map(([k, n]) => k + ' ' + n).join(', '));
    for (const h of Object.keys(t.acties)) {
      const a = t.acties[h];
      console.log('Acties ' + h + ': ' + a.totaal + ' (' + STANDEN.map((s) => s + ' ' + a.perStaat[s]).join(', ') +
        '), gezag bekend ' + a.gezagBekend + ', gevolg bekend ' + a.gevolg.bekend + ', herstel bekend ' + a.herstelBekend);
      if (a.geblokkeerdZonderWaarom) console.log('BEVINDING: ' + a.geblokkeerdZonderWaarom + ' ' + h +
        '-handelingen staan GEBLOKKEERD zonder reden; dat kan per constructie niet (actiestaat.js).');
    }
    if (Object.keys(t.gebreken).length) console.log('Gebreken (schermen): ' +
      Object.entries(t.gebreken).map(([k, n]) => k + ' ' + n).join(', '));
    if (serverfouten) console.log('Let op: de server logde ' + serverfouten + ' echte fout(en) tijdens deze ronde.');
    if (achteruit.length) console.log('AANVAARD achteruit (' + achteruit.length + '): ' +
      achteruit.map((a) => a.pad + ' ' + a.veld).join(', '));
  }
  console.log(eindregel);
})().catch((e) => { console.error(e); process.exit(2); });
