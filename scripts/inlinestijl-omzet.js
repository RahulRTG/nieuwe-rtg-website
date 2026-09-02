#!/usr/bin/env node
/* ============================================================================
   INLINE STIJLEN NAAR KLASSEN, PER BESTAND EN MET EEN BEWIJS ERNAAST.

   WAAROM DIT SCRIPT BESTAAT EN scripts/hulpklassen-omzet.js NIET VOLSTAAT.
   Die zet ENKELVOUDIGE attributen om naar gedeelde hulpklassen (`flex:1` ->
   `.h-flex1`) en is daarmee uitgeput: wat er nog staat zijn attributen met
   MEERDERE declaraties (`display:block;font-size:.72rem;color:var(--soft)`), en
   die half omzetten is erger dan niet omzetten.

   TAKEN.md 4.51 zegt erbij waarom de volgende stap niet mechanisch mocht: de
   gedeelde schillen zetten `color` en `width` met `!important`, en een inline
   stijl wint van alles behalve dat. Een hulpklasse wint het niet. Omzetten kan
   daar dus een uitslag omdraaien -- en bij `kantoren.html` is dat geen theorie:
   `ios.css` wordt op regel 216 geladen, NA het eigen `<style>`-blok op regel 20.

   DUS NIET REDENEREN MAAR METEN. Dit script doet de omzetting; het bewijs komt
   van scripts/inlinestijl-proef.js, die de pagina in een echte browser opent en
   voor ELK element de berekende waarde van ELKE aangeraakte eigenschap
   vergelijkt met de stand ervoor. Nul verschil, of de omzetting gaat terug.

   WAT HIJ WEL DOET
     - alleen de MARKUP, nooit een `style="..."` binnen een <script>. Die tweede
       soort staat in een JavaScript-string en komt pas op het scherm na een
       aanroep; een proef zonder inlog ziet hem niet, en wat de proef niet ziet
       wordt hier niet aangeraakt.
     - alleen waarden die MEER DAN EENS voorkomen. Een unieke waarde omzetten
       levert een klasse met een gebruiker: dat is dezelfde declaratie op een
       andere plek, en geen winst.
     - de klassen komen in het EIGEN <style>-blok van de pagina, met de waarde
       er letterlijk in. Geen gedeeld blad: dit zijn geen ontwerpbesluiten maar
       precies wat er stond.

   EEN INLINE STIJL DIE JAVASCRIPT AANRAAKT IS GEEN STIJL MAAR TOESTAND, en dat
   is de duurste les van deze ronde. `style="display:none;"` werd een klasse, en
   `test/notities.e2e.js` viel om: de app zet `el.style.display = ''` om zo'n vak
   te TONEN, en een lege inline waarde wint niet meer van een klasse. Het vak
   bleef onzichtbaar. De berekende-stijlproef kon dat per definitie niet zien --
   die meet de rusttoestand zonder JavaScript, en dit is precies de toestand die
   pas na een tik ontstaat.

   Vandaar twee grenzen die niets met de cascade te maken hebben:

     - een waarde met `display:none` of `visibility:hidden` wordt NOOIT omgezet.
       Dat is negen van de tien keer een schakelaar en geen opmaak.
     - een element waarvan het `id` in dit bestand naast `.style.` staat, wordt
       overgeslagen: daar schrijft de app zelf op.

   Wat overblijft is wat het hoort te zijn: opmaak die niemand aanraakt.

   Draai:  node scripts/inlinestijl-omzet.js public/apps/kantoren.html
           node scripts/inlinestijl-omzet.js <bestand> --toon   (alleen tellen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const TOON = argv.includes('--toon');
const doel = argv.filter(a => !a.startsWith('--'))[0];
/* De klassen die de proef heeft AFGEKEURD: daar wint een schilregel van, en dan
   verandert de omzetting wel degelijk iets op het scherm. Ze blijven inline. */
const OVERSLAAN = (() => {
  const i = argv.indexOf('--overslaan');
  if (i < 0) return new Set();
  const bron = argv[i + 1];
  if (!bron || !fs.existsSync(bron)) { console.error('--overslaan wijst niet naar een bestand'); process.exit(2); }
  return new Set(fs.readFileSync(bron, 'utf8').split(/\s+/).filter(Boolean));
})();

/* De stukken buiten <script>. Een style-attribuut in een JavaScript-string is
   een ander soort ding: het komt pas op het scherm na een aanroep, en de proef
   ernaast kan het niet zien. Wat niet te bewijzen valt, wordt niet omgezet. */
function markupStukken(bron) {
  const uit = [];
  const re = /<script[\s\S]*?<\/script>/gi;
  let laatste = 0, m;
  while ((m = re.exec(bron))) { uit.push([laatste, m.index]); laatste = m.index + m[0].length; }
  uit.push([laatste, bron.length]);
  return uit;
}

function inMarkup(stukken, i) {
  return stukken.some(([a, b]) => i >= a && i < b);
}

/* Een klassenaam uit de waarde zelf, kort en stabiel: dezelfde waarde geeft
   altijd dezelfde naam, zodat een tweede ronde niets hernoemt. */
function naamVoor(waarde, n) {
  let h = 0;
  for (let i = 0; i < waarde.length; i++) { h = ((h << 5) - h + waarde.charCodeAt(i)) | 0; }
  return 'i-' + (h >>> 0).toString(36).slice(0, 6) + (n ? '-' + n : '');
}

/* De id's waarvan dit bestand zelf de stijl zet. `$('#ntLijstWrap').style.display`
   is de vorm die hier voorkomt; het venster van 80 tekens vangt ook
   `document.getElementById('x').style` en een tussenliggende variabele niet --
   dat laatste is de bekende blinde vlek van deze zeef, en de e2e-toetsen zijn
   het vangnet eronder. */
function idsMetStijlSchrijven(bron) {
  const uit = new Set();
  for (const m of bron.matchAll(/['"#]([A-Za-z][\w-]{2,})['"\)\]]/g)) {
    const staart = bron.slice(m.index, m.index + 80);
    if (/\.style\s*\./.test(staart) || /\.style\s*=/.test(staart)) uit.add(m[1]);
  }
  return uit;
}

/* Een waarde die een element VERBERGT is een schakelaar en geen opmaak. */
function isToestand(waarde) {
  return /display\s*:\s*none/i.test(waarde) || /visibility\s*:\s*hidden/i.test(waarde);
}

function verzamel(bron) {
  const stukken = markupStukken(bron);
  const tel = new Map();
  const re = /\sstyle="([^"]*)"/g;
  let m;
  while ((m = re.exec(bron))) {
    if (!inMarkup(stukken, m.index)) continue;
    const waarde = m[1].trim().replace(/;\s*$/, '');
    if (!waarde || isToestand(waarde)) continue;
    tel.set(waarde, (tel.get(waarde) || 0) + 1);
  }
  return { tel, stukken };
}

function zet(bestand) {
  /* ALLEEN .html, en dat is een grendel en geen voorkeur. In een .js-bestand
     bestaat het onderscheid markup/script niet: daar staat ELK style-attribuut
     in een JavaScript-string, dus `markupStukken()` zou het hele bestand als
     markup aanmerken en de omzetting zou tekst in strings verbouwen die de proef
     nooit te zien krijgt. Bij het meten van de potentie leverde dat 1160
     "kandidaten" waarvan honderden uit bundeldelen kwamen -- allemaal fictie. */
  if (!/\.html$/.test(bestand)) {
    console.error(bestand + ': alleen .html-bestanden. In een .js-bestand staat elk ' +
      'style-attribuut in een string, en die verandert deze omzetting niet.');
    return 2;
  }
  const vol = path.isAbsolute(bestand) ? bestand : path.join(WORTEL, bestand);
  const bron = fs.readFileSync(vol, 'utf8');
  const { tel, stukken } = verzamel(bron);
  const eigenStijl = idsMetStijlSchrijven(bron);

  /* Meer dan eens, en niet iets wat een browser als losse eigenschap anders
     leest. Een waarde met een `"` erin kan hier niet voorkomen (het attribuut
     staat zelf tussen dubbele aanhalingstekens) maar wel een `}`, en die zou
     het <style>-blok breken -- die slaan we over in plaats van te ontsnappen. */
  const kandidaten = [...tel]
    .filter(([w, n]) => n > 1 && !w.includes('}') && !w.includes('<'))
    .sort((a, b) => b[1] - a[1]);

  const namen = new Map();
  const gebruikt = new Set();
  let afgekeurd = 0;
  for (const [w] of kandidaten) {
    let naam = naamVoor(w, 0), n = 0;
    while (gebruikt.has(naam) || new RegExp('\\b' + naam + '\\b').test(bron)) naam = naamVoor(w, ++n);
    gebruikt.add(naam);
    if (OVERSLAAN.has(naam)) { afgekeurd++; continue; }
    namen.set(w, naam);
  }

  const winst = kandidaten.filter(([w]) => namen.has(w)).reduce((a, [, n]) => a + n, 0);
  if (afgekeurd) console.log('  ' + afgekeurd + ' klasse(n) overgeslagen: de proef wees ze af');
  if (TOON || !kandidaten.length) {
    console.log('\n' + bestand);
    console.log('  style-attributen in de markup : ' + [...tel.values()].reduce((a, b) => a + b, 0));
    console.log('  unieke waarden                : ' + tel.size);
    console.log('  waarden die vaker voorkomen   : ' + kandidaten.length);
    console.log('  attributen die dan verdwijnen : ' + winst + ' (' + kandidaten.length + ' klassen ervoor terug)');
    if (TOON || !kandidaten.length) return 0;
  }

  /* De vervanging. Van achter naar voren, zodat de posities uit de eerste
     ronde blijven kloppen. */
  const treffers = [];
  const re = /(\s)style="([^"]*)"/g;
  let m;
  while ((m = re.exec(bron))) {
    if (!inMarkup(stukken, m.index)) continue;
    const waarde = m[2].trim().replace(/;\s*$/, '');
    if (!namen.has(waarde)) continue;
    /* Schrijft de app zelf op dit element, dan blijft de inline stijl staan. */
    const tagStart = bron.lastIndexOf('<', m.index);
    const id = (/\sid="([^"]+)"/.exec(bron.slice(tagStart, m.index + m[0].length)) || [])[1];
    if (id && eigenStijl.has(id)) continue;
    treffers.push({ i: m.index, len: m[0].length, waarde, spatie: m[1] });
  }

  let uit = bron;
  for (const t of treffers.reverse()) {
    const naam = namen.get(t.waarde);
    /* Draagt het element al een class, dan komt de nieuwe erbij; anders een
       nieuw attribuut. De tag begint op de laatste `<` voor deze plek. */
    const tagStart = uit.lastIndexOf('<', t.i);
    const tag = uit.slice(tagStart, t.i + t.len);
    const heeftClass = /\sclass="/.test(tag);
    if (heeftClass) {
      const voor = uit.slice(tagStart, t.i);
      const nieuw = voor.replace(/(\sclass=")/, '$1' + naam + ' ');
      uit = uit.slice(0, tagStart) + nieuw + uit.slice(t.i + t.len);
    } else {
      uit = uit.slice(0, t.i) + t.spatie + 'class="' + naam + '"' + uit.slice(t.i + t.len);
    }
  }

  /* De klassen in het eigen <style>-blok, achteraan zodat ze binnen dat blad
     als laatste komen. Wat ERBUITEN staat (ios.css laadt later) wint nog
     steeds -- daarvoor is de proef. */
  const regels = kandidaten.filter(([w]) => namen.has(w))
    .map(([w]) => '  .' + namen.get(w) + '{' + w + '}').join('\n');
  /* GEEN REGELS, GEEN BLOK. Zijn alle kandidaten door de proef afgekeurd, dan
     bleef er een kop zonder inhoud achter -- een blok dat zegt dat er iets is
     omgezet terwijl er niets is omgezet. Zeven bestanden droegen die na de
     eerste ronde. */
  if (!regels) { console.log(bestand + ': niets omgezet (alles afgekeurd door de proef)'); return 0; }
  const blok = '\n  /* Uit inline style-attributen gehaald door ' +
    'scripts/inlinestijl-omzet.js (TAKEN.md 4.51). Bewezen gelijk met\n' +
    '     scripts/inlinestijl-proef.js: elk element, elke aangeraakte eigenschap,\n' +
    '     berekend in een echte browser. Letterlijk wat er stond -- geen ontwerpbesluit. */\n' +
    regels + '\n';
  const eindStyle = uit.indexOf('</style>');
  if (eindStyle < 0) { console.error('geen <style>-blok in ' + bestand); return 1; }
  uit = uit.slice(0, eindStyle) + blok + uit.slice(eindStyle);

  fs.writeFileSync(vol, uit);
  console.log(bestand + ': ' + treffers.length + ' attributen weg, ' + namen.size + ' klassen erbij');
  return 0;
}

if (!doel) {
  console.error('geef een bestand: node scripts/inlinestijl-omzet.js public/apps/kantoren.html [--toon]');
  process.exit(2);
}
process.exit(zet(doel));
