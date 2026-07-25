/* De ECHTE, leesbare kern van de Reis-Bibliotheek. Geen miljoen lege titels
   meer: elke gids hieronder heeft een echte, leesbare tekst die je kunt openen
   en lezen. Eigen RTG-redactie: sfeer en hoogtepunten, eten, en een praktisch
   woord. Eerlijk en zonder opsmuk; geen boekingslinks, geen reclame. Een kern
   om mee te beginnen en uit te breiden; kwaliteit boven aantal.

   [slug, bestemming, regio, titel, tekst]; alinea's gescheiden door \n\n.

   De gidsen zelf staan per werelddeel in ./gidsen/. Zo blijft een werelddeel
   bijwerken een klein, overzichtelijk bestand in plaats van scrollen door
   alle regios heen. */
const G_EUROPA = require('./gidsen/europa');
const G_MIDDEN_OOSTEN_NOORD_AFRIKA = require('./gidsen/midden-oosten-noord-afrika');
const G_AFRIKA = require('./gidsen/afrika');
const G_AZIE = require('./gidsen/azie');
const G_AMERIKA_S = require('./gidsen/amerika-s');
const G_OCEANIE = require('./gidsen/oceanie');

const G = [].concat(G_EUROPA, G_MIDDEN_OOSTEN_NOORD_AFRIKA, G_AFRIKA, G_AZIE, G_AMERIKA_S, G_OCEANIE);

module.exports = { GIDSEN: G };
