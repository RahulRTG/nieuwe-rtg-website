/* EEN KLEINE HTML-LEZER, EN WAAROM HIER GEEN REGEX MEER STAAT.

   Deze module las eerst met reguliere expressies: `<script[\s\S]*?<\/script>`
   eruit, `<[^>]+>` weg, klaar. CodeQL noemde dat op 31 augustus 2026 twee keer
   HIGH (js/bad-tag-filter), en die melding is terecht -- ook al filteren wij
   hier geen vijandige invoer maar onze eigen schermen. Zo'n patroon is namelijk
   te misleiden met iets als `<script/src=x>` of een `>` binnen een attribuut,
   en dan lekt er code de woordenlijst in. Dat is precies de fout die deze
   module elders al een keer maakte: `fromCharCode` en `svgHtml` stonden als
   'woorden op het scherm' in de meting.

   Wat er nu staat is een LOPENDE LEZER: hij loopt de tekst een keer door en
   weet in welke van drie standen hij is -- gewone tekst, binnen een tag, of
   binnen een script/style waarvan de inhoud geen tekst is. Dat is niet alleen
   veiliger maar ook eerlijker: hij kan geen halve tag overslaan.

   Wat hij NIET is: een parser. Hij bouwt geen boom, kent geen nesting en geen
   entiteiten buiten de handvol hieronder. Voor "welke woorden staan er op dit
   scherm" is dat genoeg; wie meer nodig heeft, hoort een echte parser te
   nemen en niet dit bestand uit te bouwen. */
'use strict';

const OVERSLAAN = new Set(['script', 'style', 'svg', 'template']);

/* Leest de naam van een tag die op `i` begint ('<'), en zegt of het een
   sluittag is. Geen naam -> null, en dan is het gewoon een teken. */
function tagNaam(html, i) {
  let j = i + 1;
  const sluit = html[j] === '/';
  if (sluit) j++;
  let naam = '';
  while (j < html.length) {
    const c = html[j];
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) { naam += c; j++; continue; }
    break;
  }
  return naam ? { naam: naam.toLowerCase(), sluit, na: j } : null;
}

/* Het einde van een tag: het eerste '>' dat niet binnen een aanhalingsteken
   staat. Zonder die uitzondering knipt een `title=">"` de tag in tweeen. */
function eindeVanTag(html, i) {
  let quote = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') return j + 1;
  }
  return html.length;
}

/* Loopt de HTML door en roept `opTekst` aan voor elk stuk zichtbare tekst en
   `opTag` voor elke tag. Alles binnen script/style/svg/template wordt
   overgeslagen, commentaar ook. */
function loop(html, opTekst, opTag) {
  let i = 0, tekstStart = 0, negeer = null;
  const spoel = (tot) => { if (!negeer && tot > tekstStart) opTekst(html.slice(tekstStart, tot)); };
  while (i < html.length) {
    if (html[i] !== '<') { i++; continue; }
    if (html.startsWith('<!--', i)) {
      spoel(i);
      const eind = html.indexOf('-->', i + 4);
      i = eind < 0 ? html.length : eind + 3;
      tekstStart = i;
      continue;
    }
    const t = tagNaam(html, i);
    if (!t) { i++; continue; }
    spoel(i);
    const eind = eindeVanTag(html, t.na);
    if (negeer) {
      if (t.sluit && t.naam === negeer) negeer = null;
    } else if (!t.sluit && OVERSLAAN.has(t.naam)) {
      /* Een tag die zichzelf sluit (<svg .../>) opent niets. */
      if (html[eind - 2] !== '/') negeer = t.naam;
    }
    if (opTag) opTag(t.naam, t.sluit, html.slice(i, eind), eind);
    i = eind;
    tekstStart = i;
  }
  spoel(html.length);
}

const ENTITEITEN = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&middot;': ' ' };

/* De zichtbare tekst van een stuk HTML, met de paar entiteiten die in dit huis
   voorkomen. Onbekende entiteiten worden een spatie: ze dragen geen woord. */
function tekst(html) {
  const stukken = [];
  loop(String(html || ''), (s) => stukken.push(s));
  let uit = stukken.join(' ');
  for (const [e, v] of Object.entries(ENTITEITEN)) uit = uit.split(e).join(v);
  return uit.replace(/&[a-zA-Z#0-9]+;/g, ' ');
}

/* De inhoud van het eerste element met deze naam ('title', 'h1'), als tekst. */
function eersteElement(html, naam) {
  let start = -1, diepte = 0, uit = null;
  loop(String(html || ''), () => {}, (tag, sluit, rauw, eind) => {
    if (uit !== null) return;
    if (tag !== naam) return;
    if (!sluit) { if (diepte === 0) start = eind; diepte++; return; }
    diepte--;
    if (diepte === 0 && start >= 0) uit = html.slice(start, eind - rauw.length);
  });
  return uit === null ? '' : tekst(uit);
}

/* Alle elementen met een van deze namen, als losse stukken tekst.

   `mag` krijgt de RAUWE openingstag en beslist of dit element meetelt. Zo kan
   een aanroeper op een attribuut filteren (`class="tab"`) zonder dat deze lezer
   iets van klassen hoeft te weten -- en zonder dat er weer een patroon over
   hele HTML gaat lopen. */
function elementen(html, namen, max, mag) {
  const zoek = new Set(namen);
  const uit = [];
  let start = -1, open = null, diepte = 0;
  loop(String(html || ''), () => {}, (tag, sluit, rauw, eind) => {
    if (uit.length >= (max || 999)) return;
    if (open === null) {
      if (sluit || !zoek.has(tag)) return;
      if (mag && !mag(rauw)) return;
      if (rauw[rauw.length - 2] === '/') return;      // <a/> opent niets
      open = tag; diepte = 1; start = eind;
      return;
    }
    if (tag !== open) return;
    if (!sluit) { diepte++; return; }
    diepte--;
    if (diepte === 0) { uit.push(tekst(html.slice(start, eind - rauw.length))); open = null; }
  });
  return uit;
}

module.exports = { tekst, eersteElement, elementen, loop };
