/* RTG Werk OS (deellaag): het geconsolideerde directiebeeld.

   Consolideren is een eigen handeling. Een moeder kijkt niet ongemerkt in de
   boeken van dochters: lokaal reist de aparte dochtersleutel mee, terwijl in
   productie voor iedere gekozen dochter een actuele accountrol nodig is. */
'use strict';

function totalenVan(delen) {
  const som = (pad) => delen.reduce((t, b) => {
    const v = pad.split('.').reduce((o, k) => (o == null ? null : o[k]), b);
    return t + (typeof v === 'number' ? v : 0);
  }, 0);
  return { mensenActief: som('mensen.actief'), projectenLopend: som('projecten.lopend'),
    gewonnenCenten: som('verkoop.gewonnenCenten'), ticketsOpen: som('service.open'),
    contractenActief: som('recht.actief') };
}

module.exports = (sctx, beeld) => {
  const { app, beheerVan, eigenVeld, W } = sctx;
  const PRODUCTIE = String(process.env.NODE_ENV || '') === 'production';

  app.post('/api/bedrijf/geconsolideerd', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    if (PRODUCTIE) {
      const gevraagd = Array.isArray(req.body.dochters)
        ? [...new Set(req.body.dochters.map(x => String(x || '').trim().toUpperCase()).filter(Boolean))] : [];
      const mee = [];
      let geweigerd = 0;
      for (const code of gevraagd) {
        const d = eigenVeld(W(), code);
        const l = d && d.moeder === w.code
          ? Object.values(d.leden || {}).find(x => x && x.rtgKey === req.session.key && x.status === 'actief') : null;
        const rechten = l && sctx.rechtenVan ? sctx.rechtenVan(l) : [];
        if (d && l && rechten.includes('cijfer')) mee.push(d); else geweigerd++;
      }
      const delen = [w].concat(mee).map(beeld);
      return res.json({ ok: true, werkruimtes: delen.map(d => d.werkruimte),
        nietMeegeteld: geweigerd, totalen: totalenVan(delen), delen,
        let: geweigerd
          ? geweigerd + ' gekozen dochter(s) tellen niet mee: alleen een actuele eigen rol met het recht "cijfer" opent die grens.'
          : 'Alle expliciet gekozen dochters waarvoor u nu cijferrecht heeft, tellen mee.' });
    }

    const sleutels = req.body.dochterTokens && typeof req.body.dochterTokens === 'object'
      ? req.body.dochterTokens : {};
    const dochters = Object.values(W()).filter(x => x.moeder === w.code);
    const mee = [], zonder = [];
    for (const d of dochters) {
      if (eigenVeld(sleutels, d.code) === d.beheerToken) mee.push(d); else zonder.push(d.code);
    }
    const delen = [w].concat(mee).map(beeld);
    res.json({ ok: true, werkruimtes: delen.map(d => d.werkruimte),
      nietMeegeteld: zonder, totalen: totalenVan(delen), delen,
      let: zonder.length
        ? zonder.length + ' dochter(s) tellen NIET mee: zonder hun beheer-token kijkt een moeder hier niet in de boeken. Dat is geen fout maar de grens.'
        : 'Alle dochters hebben hun sleutel meegegeven; dit totaal is compleet.' });
  });
};
