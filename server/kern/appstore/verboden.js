/* ============================================================================
   DE LIJSTEN VAN DE POORT -- wat er in een bundel mag zitten, hoe zwaar hij mag
   zijn, en welke vormen er niet in horen.

   Puur data, met bij elke regel de uitleg die de uitgever te lezen krijgt. Apart
   van ./keuring.js omdat dat bestand daarmee over de 10 kB-keuringsgrens van dit
   huis ging -- en omdat de scheiding ook echt een naad is: hier staat WAT er
   verboden is, in ./keuring.js staat HOE er wordt gezocht.

   Een patroon zonder uitleg hoort hier niet. Een lijst van namen is een lijst
   waar iemand omheen gaat werken; een lijst met redenen is een lijst die iemand
   begrijpt. Alle drie de kolommen (vorm, wat, hoe) zijn daarom verplicht, en
   test/appstore-cel.test.js leest de derde uit.
   ========================================================================== */
'use strict';

const TOEGESTAAN = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain'
};
const TEKSTSOORT = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

/* Het budget. De getallen zijn niet heilig, hun HERKOMST wel: ze zijn gekozen
   op wat een app op een trage telefoon binnen een seconde binnen heeft. Wie ze
   verruimt, verruimt de belofte "snel" en hoort dat hier op te schrijven. */
const BUDGET = {
  bestanden: 60,
  perBestand: 512 * 1024,
  totaal: 2 * 1024 * 1024,
  script: 300 * 1024,   // alle .js samen: dit is wat de telefoon moet uitvoeren
  stijl: 150 * 1024
};

/* De verboden vormen in scriptcode. Elk patroon draagt zijn eigen uitleg; een
   lijst van namen zonder uitleg is een lijst waar iemand omheen gaat werken. */
const VERBODEN_JS = [
  [/\bfetch\s*\(/, 'fetch()', 'Een app in de cel heeft geen netwerk (connect-src \'none\'). Alles wat je van RTG nodig hebt, vraag je via RTG.roep() aan de brug; die controleert wat het lid je heeft verleend.'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest', 'Zelfde reden als fetch: de cel heeft geen netwerk. Gebruik RTG.roep().'],
  [/\bWebSocket\b/, 'WebSocket', 'De cel heeft geen netwerk, ook geen open verbinding.'],
  [/\bEventSource\b/, 'EventSource', 'De cel heeft geen netwerk, ook geen server-stroom.'],
  [/\bnavigator\s*\.\s*sendBeacon\b/, 'navigator.sendBeacon', 'Een baken is netwerkverkeer dat je niet ziet vertrekken. Daarom nergens.'],
  [/\bimportScripts\s*\(/, 'importScripts()', 'Code die tijdens het draaien binnenkomt, is code die niet gekeurd is.'],
  [/\bnavigator\s*\.\s*serviceWorker\b/, 'navigator.serviceWorker', 'Een service worker leeft langer dan je app en vangt verzoeken af. Niet in een cel.'],
  [/\beval\s*\(/, 'eval()', 'Code die tijdens het draaien wordt samengesteld, is code die niet gekeurd is.'],
  [/\bnew\s+Function\s*\(/, 'new Function()', 'Zelfde als eval(): dit maakt code die niemand heeft gezien.'],
  [/\bdocument\s*\.\s*write\s*\(/, 'document.write()', 'Schrijf je scherm op met createElement en textContent; document.write voegt onbeoordeelde HTML toe.'],
  [/\bwindow\s*\.\s*(parent|top)\b|(^|[^.\w])(parent|top)\s*\.\s*(postMessage|location|document)/, 'parent/top', 'De cel praat maar op een manier met RTG, en die weg is RTG.roep(). Rechtstreeks naar het venster erboven reiken kan niet en hoeft niet.'],
  [/\bimport\s*\(/, 'dynamische import()', 'Laad wat je nodig hebt gewoon met een <script src="..."> uit je eigen bundel; dat is gekeurd en het is sneller.'],
  [/\bdocument\s*\.\s*cookie\b/, 'document.cookie', 'De cel heeft geen cookies; hij draait op een eigen, naamloze herkomst. Gebruik de machtiging opslag.eigen.']
];

const VERBODEN_HTML = [
  [/<\s*(iframe|object|embed|frame|frameset|portal)\b/i, 'een venster in een venster', 'Een cel opent geen tweede venster. Wat je wilt tonen, toon je zelf.'],
  [/\bsrcdoc\s*=/i, 'srcdoc', 'Zelfde reden: dit is een document binnen je document.'],
  [/\son[a-z]+\s*=\s*["'`]/i, 'een on...-attribuut in de HTML', 'Inline gebeurtenis-attributen werken niet achter de CSP van de cel. Gebruik addEventListener in je eigen .js-bestand; dat werkt wel.'],
  [/<\s*script[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//i, 'een <script> van buiten', 'Alles wat je app nodig heeft, zit in je bundel. Een bestand van buiten kan na de keuring veranderen.'],
  [/<\s*base\b/i, '<base>', 'Een <base> verlegt waar alle andere verwijzingen heen gaan. Dat maakt de keuring van die verwijzingen waardeloos.'],
  [/<\s*meta[^>]*http-equiv\s*=\s*["']?refresh/i, 'meta refresh', 'Een cel stuurt de lezer niet ergens anders heen.']
];

const VERBODEN_CSS = [
  [/@import\b/i, '@import', 'Een stijlblad dat een ander stijlblad laadt, laadt iets wat niet gekeurd is. Zet je stijl in je eigen bestand.'],
  [/url\s*\(\s*["']?(?:https?:)?\/\//i, 'url() naar buiten', 'Beeld en lettertypes komen uit je eigen bundel.'],
  [/\bexpression\s*\(/i, 'expression()', 'Dit is code in een stijlblad.']
];

const VERBODEN_SVG = [
  [/<\s*script\b/i, '<script> in een SVG', 'Een SVG is een plaatje, geen programma.'],
  [/\son[a-z]+\s*=/i, 'een on...-attribuut in een SVG', 'Zelfde reden: een plaatje reageert niet.'],
  [/\bhref\s*=\s*["']?\s*javascript:/i, 'javascript: in een SVG', 'Zelfde reden.'],
  [/<\s*(foreignObject|use[^>]*\bhref\s*=\s*["']?https?:)/i, 'ingesloten of extern SVG-onderdeel', 'Een SVG haalt niets van buiten en sluit geen HTML in.']
];

/* Overal verboden, ongeacht de soort: een verwijzing naar een andere server. De
   uitzondering is er precies een, en die staat hier met naam: het protocol
   `data:` voor beeld, want dat is inhoud en geen verwijzing. */
const EXTERN = /(?:src|href|action|formaction|poster|data|content)\s*=\s*["']?\s*(?:https?:)?\/\/[a-z0-9]/i;

module.exports = { TOEGESTAAN, TEKSTSOORT, BUDGET, VERBODEN_JS, VERBODEN_HTML, VERBODEN_CSS, VERBODEN_SVG, EXTERN };
