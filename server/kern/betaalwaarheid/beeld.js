'use strict';

const LABEL = {
  AANGEMAAKT: 'Veilig klaargezet', WACHT_OP_KLANT: 'Wacht op jouw bevestiging',
  IN_BEHANDELING: 'Wordt gecontroleerd', BEVESTIGD: 'Betaling bevestigd',
  GEWEIGERD: 'Betaling niet gelukt', GEANNULEERD: 'Betaling geannuleerd',
  CONTROLE_NODIG: 'Persoonlijke controle nodig', TERUGBETALING_WACHT: 'Terugbetaling onderweg',
  GEDEELTELIJK_TERUGBETAALD: 'Deels terugbetaald', TERUGBETAALD: 'Terugbetaald'
};

function publiek(r, definitiefBetaald) {
  if (!r) return null;
  const laatste = (r.gebeurtenissen || [])[r.gebeurtenissen.length - 1];
  return { id: r.id, status: r.status, label: LABEL[r.status] || 'In behandeling',
    definitief: definitiefBetaald(r.status), provider: r.provider || null,
    bedragCenten: r.centen, valuta: r.valuta, aangemaaktAt: r.aangemaaktAt,
    bijgewerktAt: r.bijgewerktAt, providerKenmerk: r.providerId ? String(r.providerId).slice(-8) : null,
    bewijs: laatste ? laatste.zegel.slice(0, 16).toUpperCase() : null,
    afgehandeld: !!r.afgehandeldAt,
    volgende: r.status === 'WACHT_OP_KLANT' ? 'Rond de betaling af bij de gekozen provider.'
      : r.status === 'IN_BEHANDELING' ? 'Je hoeft niets opnieuw te betalen; RTG controleert de terugmelding.'
      : r.status === 'BEVESTIGD' && !r.afgehandeldAt ? 'De bestelling wordt nu veilig vrijgegeven.'
      : r.status === 'CONTROLE_NODIG' ? 'Er wordt niets vrijgegeven tot een medewerker het verschil heeft gecontroleerd.'
      : null };
}

function actieVan(p) {
  if (p.checkoutUrl) return { soort: 'doorsturen', url: p.checkoutUrl };
  if (p.clientSecret) return { soort: 'client-bevestigen', clientSecret: p.clientSecret };
  return { soort: p.aanbieder === 'demo' ? 'klaar' : 'wachten' };
}

module.exports = { publiek, actieVan };
