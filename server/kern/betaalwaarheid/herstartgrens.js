/* Stripe API v1 mag idempotentiesleutels na >=24 uur verwijderen. Dezelfde
   sleutel is dan GEEN bewijs tegen een nieuwe inning. Zonder bekende PI/CS
   stopt deze recurring-opdracht na 23 uur vanaf de EERSTE PROVIDER_START;
   alleen reconciliatie kan de onbekende oorspronkelijke uitkomst oplossen.
   https://docs.stripe.com/api/idempotent_requests */
'use strict';
const HORIZON_MS = 23 * 3600000;
module.exports = ({ STATUS, nuIso, naar, save }) => function herstartgrens(r, eersteStart) {
  if (r.providerId || r.start?.aanbieder !== 'stripe' || !r.start.terugkerend) return;
  const eerste = (r.gebeurtenissen || []).find(g => g.soort === 'PROVIDER_START');
  // Een werkelijk nieuwe opdracht krijgt hierna zijn eerste startevent. Een
  // oude start zonder controleerbare tijd is juist GEEN nieuwe toestemming.
  if (!eerste && eersteStart && r.status !== STATUS.CONTROLE_NODIG) return;
  const start = Date.parse(eerste?.at), nu = Date.parse(nuIso());
  if (r.status !== STATUS.CONTROLE_NODIG && Number.isFinite(start) && Number.isFinite(nu) &&
      nu >= start && nu - start < HORIZON_MS) return;
  if (r.status !== STATUS.CONTROLE_NODIG) {
    r.blokkade = 'providerherstart-onzeker';
    r.escalatie = { at: nuIso(), status: r.status, onbekend: true,
      reden: 'De oorspronkelijke Stripe-opdracht moet worden afgestemd; veilig automatisch opnieuw innen is niet bewezen.' };
    naar(r, STATUS.CONTROLE_NODIG, { reden: r.blokkade, eersteProviderStartAt: eerste?.at || null });
    save();
  }
  throw Object.assign(new Error('Betaling vereist controle van de oorspronkelijke provideropdracht; er is niet opnieuw geïnd.'),
    { code: 'BETAAL_PROVIDER_HERSTART_ONZEKER', nietVerstuurd: true });
};
module.exports.HORIZON_MS = HORIZON_MS;
