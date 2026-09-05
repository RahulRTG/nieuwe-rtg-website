'use strict';

module.exports = function betalingCijfers(data) {
  const alle = Object.values(data.betaalWaarheid || {});
  const perStatus = {}, perProvider = {};
  let bevestigdCenten = 0, terugbetaaldCenten = 0, afhandelingWacht = 0,
    terugbetalingWacht = 0, terugbetalingControle = 0;
  for (const b of alle) {
    perStatus[b.status] = (perStatus[b.status] || 0) + 1;
    const p = b.provider || 'nog-geen';
    perProvider[p] = (perProvider[p] || 0) + 1;
    if (['BEVESTIGD', 'TERUGBETALING_WACHT', 'GEDEELTELIJK_TERUGBETAALD', 'TERUGBETAALD'].includes(b.status))
      bevestigdCenten += Number(b.centen) || 0;
    terugbetaaldCenten += Number(b.terugbetaaldCenten) || 0;
    if (b.status === 'BEVESTIGD' && !b.afgehandeldAt) afhandelingWacht += 1;
    for (const op of (b.terugbetaalOpdrachten || [])) {
      if (['VASTGELEGD', 'BIJ_PROVIDER'].includes(op.status)) terugbetalingWacht += 1;
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
    afhandelingWacht, terugbetalingWacht, terugbetalingControle,
    onderweg: (perStatus.AANGEMAAKT || 0) + (perStatus.WACHT_OP_KLANT || 0) +
      (perStatus.IN_BEHANDELING || 0), recent };
};
