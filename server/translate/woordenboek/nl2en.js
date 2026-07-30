/* Vertaallaag, data "NL2EN" (server/translate/woordenboek): de vaste seed-inhoud
   Nederlands -> Engels. Deterministisch, dekt de hele demo-inhoud (facturen,
   reis, posts, reacties, menukaarten, partnerreizen). Pure data; de omkering
   (EN2NL) en de woord-voor-woord terugval staan in index.js. */

/* Het woordenboek staat in nl2en-delen/. Opgeknipt omdat dit bestand boven de
   10 KB kwam en alleen maar groeit; samenvoegen gebeurt hier, zodat de rest van
   het systeem dezelfde require houdt. */
module.exports = Object.assign(
  {},
  require('./nl2en-delen/deel1'),
  require('./nl2en-delen/deel2')
);
