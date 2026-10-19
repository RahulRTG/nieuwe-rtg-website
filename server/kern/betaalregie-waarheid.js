'use strict';
const { standVoorControle } = require('./betaalwaarheid/controle');
const euro = (c) => 'EUR ' + ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');

module.exports = function betalingCijfers(data) {
  const alle = Object.values(data.betaalWaarheid || {});
  const perStatus = {}, perProvider = {};
  let bevestigdCenten = 0, terugbetaaldCenten = 0, afhandelingWacht = 0,
    terugbetalingWacht = 0, terugbetalingControle = 0;
  /* regels met een knop op de lijst van de betaalkamer (eigenaarsbesluiten van
     19 oktober 2026; apps/kantoren-terugbetaling.js) */
  const regels = [];
  for (const b of alle) {
    perStatus[b.status] = (perStatus[b.status] || 0) + 1;
    const p = b.provider || 'nog-geen';
    perProvider[p] = (perProvider[p] || 0) + 1;
    if (['BEVESTIGD', 'TERUGBETALING_WACHT', 'GEDEELTELIJK_TERUGBETAALD', 'TERUGBETAALD'].includes(b.status))
      bevestigdCenten += Number(b.centen) || 0;
    terugbetaaldCenten += Number(b.terugbetaaldCenten) || 0;
    if (b.status === 'BEVESTIGD' && !b.afgehandeldAt) afhandelingWacht += 1;
    // op controle met een definitieve stand ervoor: een mens op naam kan afronden (betaalwaarheid/controle.js)
    const terugNaar = b.status === 'CONTROLE_NODIG' ? standVoorControle(b) : null;
    if (terugNaar) regels.push({ ernst: 'kritiek', code: 'BETALING-OP-CONTROLE', betalingId: b.id,
      tekst: 'Betaling op controle: ' + euro(b.centen) + ' van betaling ' + b.id + ' via ' + (b.provider || 'onbekend') +
        '; ' + (b.blokkade || 'reden niet vastgelegd') + '. Afronden zet haar terug op ' + terugNaar + '.' });
    for (const op of (b.terugbetaalOpdrachten || [])) {
      if (['VASTGELEGD', 'BIJ_PROVIDER'].includes(op.status)) terugbetalingWacht += 1;
      // geescaleerd door de veegronde (betaalwaarheid/terugveeg.js) en nog niet door een mens afgehandeld
      if (op.escalatie && op.status === 'BIJ_PROVIDER' && !op.mens)
        regels.push({ ernst: 'kritiek', code: 'TERUGBETALING-VASTGELOPEN', betalingId: b.id, opdrachtId: op.id,
          sinds: op.escalatie.at || null, tekst: 'Terugbetaling vastgelopen: ' + euro(op.centen) + ' van betaling ' + b.id +
            ' via ' + (b.provider || 'onbekend') + '; ' + (op.escalatie.reden || '') + '.' });
      if (op.status === 'CONTROLE_NODIG') terugbetalingControle += 1;
    }
  }
  const recent = alle.slice().sort((a, b) =>
    String(b.bijgewerktAt || '').localeCompare(String(a.bijgewerktAt || ''))).slice(0, 12)
    .map(b => ({ id: b.id, provider: b.provider || null, status: b.status,
      centen: Number(b.centen) || 0, terugbetaaldCenten: Number(b.terugbetaaldCenten) || 0,
      bijgewerktAt: b.bijgewerktAt || b.aangemaaktAt || null }));
  return { totaal: alle.length, perStatus, perProvider, bevestigdCenten, terugbetaaldCenten,
    controleNodig: perStatus.CONTROLE_NODIG || 0,
    afhandelingWacht, terugbetalingWacht, terugbetalingControle, regels,
    onderweg: (perStatus.AANGEMAAKT || 0) + (perStatus.WACHT_OP_KLANT || 0) +
      (perStatus.IN_BEHANDELING || 0), recent };
};
