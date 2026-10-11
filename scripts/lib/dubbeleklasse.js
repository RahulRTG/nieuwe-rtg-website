/* TWEE CLASS-ATTRIBUTEN OP EEN ELEMENT.

   Een browser leest van een dubbel attribuut alleen het EERSTE en gooit het
   tweede stil weg. `<input class="veld" id="x" class="vol">` krijgt dus
   `veld` en niet `vol` -- geen fout in de console, geen afwijkende validatie,
   alleen een veld dat ineens niet meer de volle breedte heeft. Op 6 oktober
   2026 stonden er 188 van in 38 bronbestanden onder public/: opmaak die een
   eerdere ronde uit `style="..."` naar een hulpklasse
   (public/shared/rtg-hulpklassen.css) had verhuisd, kwam zo nooit aan.

   Deze module is de ENE plek die die vraag beantwoordt. scripts/check.js regel
   76 leunt erop, en test/dubbeleklasse.test.js houdt de goede en de valse
   treffers vast. Een tweede regex ergens anders zou uiteenlopen (LAT.md regel 4).

   HOE HIJ LEEST. Een element in markup is makkelijk; het lastige deel is HTML
   die in JavaScript wordt samengesteld:

     '<input class="veld" id="' + esc(id) + '" class="vol">'
     `<div class="a" ${open ? 'hidden' : ''} class="b">`

   Daarom wordt een script eerst tot een STROOM teruggebracht: de inhoud van
   elke tekenreeks en elk template-stuk achter elkaar, met de code ertussen als
   een enkel merkteken. Code die alleen een waarde invult (`+ esc(id) +`, een
   `${...}`) wordt DYN: binnen een attribuutwaarde is dat gewoon inhoud, buiten
   een waarde een dynamisch stuk dat geen class-attribuut kan zijn. Code met een
   `;`, `{` of `}` erin is een statementgrens (BREEK): een element dat daar nog
   openstaat wordt losgelaten in plaats van aan de volgende tekenreeks geplakt
   -- anders zou hij twee losse strings uit verschillende statements als een
   tag lezen.

   Over die stroom loopt een kleine attribuutlezer die NAMEN leest en geen
   tekst zoekt: `data-class="x"` heet `data-class`, en `class=` in de tekst
   tussen twee tags is geen attribuut. Commentaar telt niet mee (de posities
   blijven kloppen via zonderCommentaar met `regelsHeel`).

   WAT HIJ NIET KAN, eerlijk: een tagnaam die zelf uit code komt
   (`'<' + tag + ' class="a">'`) wordt niet als element herkend, en een
   voorwaardelijke tak die in BEIDE takken een class zet (`c ? ' class="a"' :
   ' class="b"'`) telt als twee. Dat laatste is de veilige kant: zo'n element
   heeft op het scherm een class, en de schrijfwijze met een class-attribuut en
   een voorwaardelijke WAARDE is korter en leest net zo goed. */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar, stukken } = require('./bron');

const DYN = '\u0000';
const BREEK = '\u0001';

/* Een script terugbrengen tot de stroom hierboven. `pos[k]` is de plek in de
   bron van teken k van de stroom, zodat een treffer als bestand:regel kan
   worden gemeld. */
function stroom(src, basis) {
  const tekens = [];
  const pos = [];
  let i = 0;
  const n = src.length;
  let codeVanaf = -1, codeBreekt = false;
  const codeTeken = (c, p) => {
    if (codeVanaf < 0) codeVanaf = p;
    if (c === ';' || c === '{' || c === '}') codeBreekt = true;
  };
  const sluitCode = () => {
    if (codeVanaf < 0) return;
    tekens.push(codeBreekt ? BREEK : DYN); pos.push(basis + codeVanaf);
    codeVanaf = -1; codeBreekt = false;
  };
  const zet = (c, p) => { tekens.push(c); pos.push(basis + p); };

  /* Leest code tot het einde, of -- binnen ${...} -- tot de sluitende accolade
     op diepte nul. Geeft de plek na die accolade terug. */
  /* Het laatste niet-witte codeteken voor plek i (een string ervoor telt als
     waarde, dus dan volgt een deling en geen regex). */
  const vorigeCode = () => {
    let k = i - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    return k < 0 ? '' : (/['"`)\]\w$]/.test(src[k]) ? 'w' : src[k]);
  };
  function code(inExpr) {
    let diepte = 0;
    while (i < n) {
      const c = src[i];
      if (c === '"' || c === "'") {
        /* Een quote sluit op dezelfde regel, anders is het geen string (een
           apostrof in een regex of proza) en gaat het teken mee als code. */
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
        if (j < n && src[j] === c) {
          sluitCode();
          for (let k = i + 1; k < j; k++) {
            if (src[k] === '\\' && k + 1 < j) { k++; zet(src[k], k); continue; }
            zet(src[k], k);
          }
          i = j + 1;
          continue;
        }
        codeTeken(c, i); i++; continue;
      }
      /* Een regex-literal is code en geen string: `histQ.replace(/"/g, ...)`
         stond in een attribuutwaarde en liet de quote erin een string openen
         die de rest van de regel opat. Een `/` is een regex waar een waarde
         begint (na een operator of haakje), en hij sluit op dezelfde regel. */
      if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]/.test(vorigeCode() || ';')) {
        let j = i + 1, klasse = false;
        while (j < n && src[j] !== '\n' && (klasse || src[j] !== '/')) {
          if (src[j] === '\\') j++;
          else if (src[j] === '[') klasse = true;
          else if (src[j] === ']') klasse = false;
          j++;
        }
        if (j < n && src[j] === '/') {
          for (let k = i; k <= j; k++) codeTeken(src[k], k);
          i = j + 1;
          continue;
        }
      }
      if (c === '`') { sluitCode(); i++; template(); continue; }
      if (c === '{') { diepte++; codeTeken(c, i); i++; continue; }
      if (c === '}') {
        if (inExpr && diepte === 0) { i++; return; }
        diepte--; codeTeken(c, i); i++; continue;
      }
      codeTeken(c, i); i++;
    }
  }

  function template() {
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) { zet(src[i + 1], i + 1); i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && src[i + 1] === '{') {
        const begin = i;
        i += 2;
        code(true);
        /* De expressie zelf is een waarde, ook als er een nested template in
           stond: die heeft zijn eigen tekens al in de stroom gezet. */
        codeVanaf = codeVanaf < 0 ? begin : codeVanaf;
        sluitCode();
        continue;
      }
      zet(c, i); i++;
    }
  }

  code(false);
  sluitCode();
  return { tekst: tekens.join(''), pos };
}

const NAAMTEKEN = /[^\s"'>\/=<\u0000\u0001]/;

/* De attribuutlezer, over markup of over een stroom. */
function elementen(tekst, pos, basis) {
  const uit = [];
  const n = tekst.length;
  for (let i = 0; i < n; i++) {
    if (tekst[i] !== '<' || !/[a-zA-Z]/.test(tekst[i + 1] || '')) continue;
    let j = i + 1;
    while (j < n && /[a-zA-Z0-9-]/.test(tekst[j])) j++;
    const tag = tekst.slice(i + 1, j).toLowerCase();
    const namen = [];
    let dicht = false;
    while (j < n) {
      const c = tekst[j];
      if (/\s/.test(c) || c === DYN || c === '/') { j++; continue; }
      if (c === BREEK || c === '<') break;            // geen element, of het stopte
      if (c === '>') { dicht = true; break; }
      if (!NAAMTEKEN.test(c)) { j++; continue; }       // los quote- of =-teken
      const nb = j;
      while (j < n && NAAMTEKEN.test(tekst[j])) j++;
      const naam = tekst.slice(nb, j).toLowerCase();
      const attr = { naam, plek: nb, eind: j, waarde: null };
      namen.push(attr);
      let k = j;
      while (k < n && /\s/.test(tekst[k])) k++;
      if (tekst[k] !== '=') continue;
      k++;
      while (k < n && /\s/.test(tekst[k])) k++;
      const q = tekst[k];
      if (q === '"' || q === "'") {
        k++;
        const vb = k;
        while (k < n && tekst[k] !== q && tekst[k] !== BREEK) k++;
        if (tekst[k] !== q) { j = k; break; }
        const w = tekst.slice(vb, k);
        attr.waarde = /[\u0000\u0001]/.test(w) ? null : w;
        attr.eind = k + 1;
        j = k + 1;
      } else {
        while (k < n && !/[\s>]/.test(tekst[k]) && tekst[k] !== BREEK) k++;
        j = k;
      }
    }
    if (!dicht) continue;
    const klassen = namen.filter(a => a.naam === 'class');
    if (klassen.length > 1) {
      const bron = (k) => pos ? pos[k] : basis + k;
      uit.push({ tag, aantal: klassen.length, plek: bron(i), tweede: bron(klassen[1].plek),
        /* Per class-attribuut de plek in de BRON (van de naam tot na de
           sluitquote) en de waarde, of null als er code in de waarde staat.
           Daarmee kan een herstel ze samenvoegen zonder opnieuw te lezen. */
        klassen: klassen.map(a => ({ begin: bron(a.plek), eind: bron(a.eind - 1) + 1, waarde: a.waarde })) });
    }
    i = j;
  }
  return uit;
}

/* De vraag zelf: welke elementen in deze bron dragen meer dan een class-
   attribuut? `soort` is 'html' of 'js' (zoals bij zonderCommentaar). Elke
   treffer draagt de regel en kolom van het element en van het tweede attribuut,
   plus het fragment, zodat een melding direct te vinden is. */
function dubbeleKlassen(bron, opties) {
  const soort = (opties && opties.soort) || 'js';
  const s = String(bron);
  const kaal = zonderCommentaar(s, { soort, regelsHeel: true });
  const treffers = [];
  if (soort === 'html') {
    let plek = 0;
    for (const d of stukken(kaal)) {
      if (d.soort === 'script') {
        const st = stroom(d.tekst, plek);
        treffers.push(...elementen(st.tekst, st.pos, plek));
      } else if (d.soort === null) {
        /* HTML-commentaar plat, met de posities heel. */
        const markup = d.tekst.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
        treffers.push(...elementen(markup, null, plek));
      }
      plek += d.tekst.length;
    }
  } else {
    const st = stroom(kaal, 0);
    treffers.push(...elementen(st.tekst, st.pos, 0));
  }
  const regelVan = (p) => {
    const voor = s.slice(0, p);
    const r = voor.split('\n');
    return { regel: r.length, kolom: r[r.length - 1].length + 1 };
  };
  return treffers.sort((a, b) => a.plek - b.plek).map(t => {
    const { regel, kolom } = regelVan(t.plek);
    const eindRegel = s.indexOf('\n', t.tweede);
    return { tag: t.tag, aantal: t.aantal, regel, kolom, klassen: t.klassen,
      fragment: s.slice(t.plek, Math.min(eindRegel < 0 ? s.length : eindRegel, t.tweede + 40)).slice(0, 200) };
  });
}

/* Welke bestanden horen erbij. De BRON en niet de bouwuitvoer: een bundel
   (scripts/bundel.js, BUNDELLIJST) is byte voor byte de som van zijn delen --
   regel 12 van check.js houdt dat vast -- dus de delen meten is de bundel
   meten, en de bundel erbij nemen zou elke treffer twee keer tellen.
   public/dist is gebouwde uitvoer. index.html in de repositoryroot is de
   voordeur (CLAUDE.md, structuur) en doet mee; server/ ook, want daar worden
   ook pagina's samengesteld. */
function bronbestanden(root) {
  const { bundels } = require('../bundel');
  const gebundeld = new Set(Object.keys(bundels).map(k => path.join(root, 'public', k)));
  const uit = [];
  const loop = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const vol = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!/^(node_modules|\.git|data)$/.test(e.name) && vol !== path.join(root, 'public', 'dist')) loop(vol);
        continue;
      }
      if (!/\.(html|js|mjs)$/.test(e.name) || gebundeld.has(vol)) continue;
      uit.push(vol);
    }
  };
  loop(path.join(root, 'public'));
  loop(path.join(root, 'server'));
  const voordeur = path.join(root, 'index.html');
  if (fs.existsSync(voordeur)) uit.push(voordeur);
  return uit.sort();
}

/* Over het hele huis: { bestand -> treffers }, alleen bestanden MET treffers. */
function meet(root) {
  const uit = {};
  for (const f of bronbestanden(root)) {
    const t = dubbeleKlassen(fs.readFileSync(f, 'utf8'), { soort: f.endsWith('.html') ? 'html' : 'js' });
    if (t.length) uit[path.relative(root, f).split(path.sep).join('/')] = t;
  }
  return uit;
}

module.exports = { dubbeleKlassen, bronbestanden, meet, stroom };

if (require.main === module) {
  const root = path.join(__dirname, '..', '..');
  const m = meet(root);
  let tot = 0;
  for (const [f, t] of Object.entries(m)) {
    tot += t.length;
    console.log(String(t.length).padStart(4) + '  ' + f);
    if (process.argv.includes('--toon')) for (const x of t) console.log('        ' + x.regel + ':' + x.kolom + '  ' + x.fragment);
  }
  console.log(tot + ' elementen met meer dan een class-attribuut, in ' + Object.keys(m).length + ' bestanden');
}
