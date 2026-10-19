/* De simulatiebank, NADAT een betaling bestaat: opzoeken en terugbetalen
   (dezelfde snede als ./naslag.js naast ./ontvangst.js).

   Gevonden door LivingOS-A bij de asset-koop: ./naslag.js kende 'simulatie'
   niet. Een herroeping na een simulatiebetaling bleef eeuwig op "terugbetaling
   loopt" staan, en een trage simulatiebetaling kon de veegronde niet opzoeken:
   zes hervattingen met dezelfde fout en dan een escalatie voor een mens, voor
   een betaling die per definitie nooit komt.

   OPZOEKEN. De afloop staat in het id (`sim_<scenario>_<tijd>_<willekeur>`); de
   bank houdt dus geen staat bij. Een trage betaling is open tot VERLOOP_MS na
   haar start en daarna verlopen, zoals een open betaling bij een echte provider
   verloopt. Die looptijd is GEKOZEN (ruim boven de eerste twee hervattingen van
   kern/betaalwaarheid/hervat.js), niet gemeten. Een id zonder tijd is van voor
   deze regel; zijn leeftijd is onbekend en dus ouder dan elke looptijd.

   TERUGBETALEN. Dezelfde verdeling uit de sleutel als de rest van de bank, met
   vier afloopen: bevestigd, geweigerd, traag (bevestigt bij navraag pas na
   VERLOOP_MS) en stil (antwoordt nooit; het vak van de terugboeking, want een
   terugboeking op een terugbetaling bestaat niet). Een melding komt er nooit:
   de veegronde (kern/betaalwaarheid/terugveeg.js) vraagt na, zoals bij een
   echte provider waarvan de webhook wegbleef, en escaleert de stille. De bank
   rondt dus zelf niets af. Een herhaling met dezelfde sleutel is dezelfde
   terugbetaling, zoals een echte provider dat met zijn idempotencyKey doet. */
'use strict';

const VERLOOP_MS = 60 * 60 * 1000;
const TERUG = { betaald: ['bevestigd', 'refunded'], terugboeking: ['stil', 'pending'],
  geweigerd: ['geweigerd', 'failed'], traag: ['traag', 'pending'] };

module.exports = function simulatieNaslag({ crypto, eis, scenarioVan, nu }) {
  const klok = () => (typeof nu === 'function' ? Number(nu()) : Date.now());

  const startVan = (id, i) => {
    const delen = String(id || '').split('_');
    return delen.length > i + 1 && /^[0-9a-z]+$/.test(delen[i]) ? parseInt(delen[i], 36) : 0;
  };

  function haal(id) {
    eis();
    const naam = String(id || '').split('_')[1];
    const start = startVan(id, 2);
    const status = naam === 'betaald' ? 'betaald' : naam === 'terugboeking' ? 'teruggeboekt'
      : naam === 'traag' ? (klok() - start < VERLOOP_MS ? 'open' : 'verlopen') : 'geweigerd';
    return { id: String(id), status, aanbieder: 'simulatie', simulatie: naam || null };
  }

  const terugScenarioVan = (o) => TERUG[scenarioVan({ idempotentieSleutel: 'terug|' + ((o && o.idempotentieSleutel) || ''),
    simulatie: o && o.simulatie })][0];

  const uitgegeven = new Map(); /* sleutel -> terugbetaling, zoals de provider hem kent */
  function terugbetaal(opdracht) {
    eis();
    const { providerId, bedrag, valuta = 'eur', idempotentieSleutel } = opdracht || {};
    if (idempotentieSleutel && uitgegeven.has(idempotentieSleutel)) return Object.assign({}, uitgegeven.get(idempotentieSleutel));
    const [naam, status] = TERUG[scenarioVan({ idempotentieSleutel: 'terug|' + (idempotentieSleutel || ''),
      simulatie: opdracht && opdracht.simulatie })];
    const uit = { id: 'sim_terug_' + naam + '_' + klok().toString(36) + '_' + crypto.randomBytes(8).toString('hex'),
      status, aanbieder: 'simulatie', providerId, bedrag: Math.round(bedrag), valuta, simulatie: naam };
    if (idempotentieSleutel) uitgegeven.set(idempotentieSleutel, uit);
    return Object.assign({}, uit);
  }

  /* navraag naar een terugbetaling (de veegronde); het bedrag kent de navraag niet */
  function haalTerugbetaling(id) {
    eis();
    const naam = String(id || '').split('_')[2];
    const status = naam === 'bevestigd' ? 'refunded' : naam === 'geweigerd' ? 'failed'
      : naam === 'traag' && klok() - startVan(id, 3) >= VERLOOP_MS ? 'refunded' : 'pending';
    return { id: String(id), status, aanbieder: 'simulatie', simulatie: naam || null };
  }

  return { haal, terugbetaal, haalTerugbetaling, terugScenarioVan, startTijd: () => klok().toString(36) };
};
module.exports.VERLOOP_MS = VERLOOP_MS;
