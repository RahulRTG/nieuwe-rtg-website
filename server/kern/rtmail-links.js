/* ============================================================================
   DE VEILIGHEIDSSCAN OP DE TEKST VAN EEN BERICHT.

   Losgemaakt van ./rtmail.js, dat over BEZORGEN gaat. Dit is iets anders: het is
   tekstanalyse, puur, zonder database en zonder netwerk -- precies daarom kan hij
   op zichzelf staan en op zichzelf getoetst worden.
   ========================================================================== */
/* ---- de veiligheidsscan op de tekst ----
   RTMAIL rendert platte tekst; hier merken we vooruit welke stukken een link
   (kunnen) zijn, zodat de client ze kan defangen en de motor kan tellen. We
   zoeken alleen naar wat een klikbare/gevaarlijke link zou worden: een schema
   (http/https/ftp), een "www."-start, of een gevaarlijk schema. Puur, geen
   netwerk. Externe adressen (mailto/andere codes) blijven gewoon tekst. */
const LINK_RE = new RegExp('(?:https?:\\/\\/|ftp:\\/\\/|www\\.)[^\\s<>()"\'\\]]+', 'gi');
const GEVAAR_RE = /(?:javascript|data|vbscript|file)\s*:/i;
function scanLinks(tekst) {
  const t = String(tekst == null ? '' : tekst);
  const externeLinks = (t.match(LINK_RE) || []).map(u => u.replace(/[.,;:!?)]+$/, '').slice(0, 300)).filter(Boolean);
  // dubbelen eruit, en begrensd zodat een spam-bericht de opslag niet opblaast
  const uniek = Array.from(new Set(externeLinks)).slice(0, 40);
  return { externeLinks: uniek, aantal: uniek.length, gevaarlijk: GEVAAR_RE.test(t) };
}

module.exports = { scanLinks, LINK_RE, GEVAAR_RE };
