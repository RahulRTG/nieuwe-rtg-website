/* Fail-closed bestemming bovenop de verwisselbare betaalproviders.

   Een Connected Account mag nooit stil verdwijnen in een gewone
   platformbetaling. Alleen de expliciet lokale contract-sandbox mag dit pad
   simuleren; live blijft het dicht tot een echte, gecontroleerde Connect-rail
   bestaat. */
'use strict';

module.exports = ({ crypto, sandbox, regie, haalOp, bewaar, maakProviderBetaling }) =>
  async function maakBetaling(opdracht) {
    const { bedrag, valuta = 'eur', referentie, idempotentieSleutel, bestemming } = opdracht || {};
    if (!bestemming) return maakProviderBetaling(opdracht);
    if (!Number.isFinite(bedrag) || bedrag <= 0)
      throw new Error('Bedrag moet een positief bedrag in centen zijn.');

    const sleutel = idempotentieSleutel || (referentie ? 'ref:' + referentie : crypto.randomUUID());
    const bestaand = haalOp(sleutel);
    if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

    if (regie.connectGeconfigureerd && !regie.connectAan) {
      const e = new Error('Stripe Connect-sandbox is door de Integratiekamer uitgezet.');
      e.code = 'CONNECT_SANDBOX_UIT';
      throw e;
    }
    if (regie.connectAan) {
      const res = sandbox.connect({ bedrag, valuta, referentie, bestemming });
      bewaar(sleutel, res);
      return res;
    }

    const e = new Error('Partnerbetaling veilig geblokkeerd: Stripe Connect is nog niet geactiveerd.');
    e.code = 'STRIPE_CONNECT_NIET_ACTIEF';
    throw e;
  };
