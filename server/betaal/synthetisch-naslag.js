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

   TERUGBETALEN. Dezelfde verdeling uit de sleutel als de rest van de bank:
   bevestigd, geweigerd of traag (wacht op een melding, zoals een echte refund
   op een webhook wacht). Een terugboeking op een terugbetaling bestaat niet;
   dat vak telt als bevestigd. Het id volgt uit de sleutel, zodat een herhaling
   dezelfde terugbetaling is: dat doet een echte provider met zijn
   idempotencyKey, en kern/betaalwaarheid/terug.js telt hem daardoor een keer. */
'use strict';

const VERLOOP_MS = 60 * 60 * 1000;
const TERUG = { betaald: ['bevestigd', 'refunded'], terugboeking: ['bevestigd', 'refunded'],
  geweigerd: ['geweigerd', 'failed'], traag: ['traag', 'pending'] };

module.exports = function simulatieNaslag({ crypto, eis, scenarioVan, nu }) {
  const klok = () => (typeof nu === 'function' ? Number(nu()) : Date.now());

  function haal(id) {
    eis();
    const [, naam, tijd] = String(id || '').split('_');
    const start = /^[0-9a-z]+$/.test(tijd || '') && String(id).split('_').length > 3 ? parseInt(tijd, 36) : 0;
    const status = naam === 'betaald' ? 'betaald' : naam === 'terugboeking' ? 'teruggeboekt'
      : naam === 'traag' ? (klok() - start < VERLOOP_MS ? 'open' : 'verlopen') : 'geweigerd';
    return { id: String(id), status, aanbieder: 'simulatie', simulatie: naam || null };
  }

  const terugScenarioVan = (o) => TERUG[scenarioVan({ idempotentieSleutel: 'terug|' + ((o && o.idempotentieSleutel) || ''),
    simulatie: o && o.simulatie })][0];

  function terugbetaal(opdracht) {
    eis();
    const { providerId, bedrag, valuta = 'eur', idempotentieSleutel } = opdracht || {};
    const [naam, status] = TERUG[scenarioVan({ idempotentieSleutel: 'terug|' + (idempotentieSleutel || ''),
      simulatie: opdracht && opdracht.simulatie })];
    const kern = idempotentieSleutel ? crypto.createHash('sha256').update(String(idempotentieSleutel)).digest('hex').slice(0, 16)
      : crypto.randomBytes(8).toString('hex');
    return { id: 'sim_terug_' + naam + '_' + kern, status, aanbieder: 'simulatie', providerId,
      bedrag: Math.round(bedrag), valuta, simulatie: naam };
  }

  return { haal, terugbetaal, terugScenarioVan, startTijd: () => klok().toString(36) };
};
module.exports.VERLOOP_MS = VERLOOP_MS;
