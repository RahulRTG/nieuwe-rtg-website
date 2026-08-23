'use strict';

module.exports = ({ kern, zaakVan, handleVan, horeca, orderlaag, buitenshuis, findSupplier, stuur }) => {
  const { app, auth } = kern;
  const etenBeeld = require('../../kern/eten/orderbeeld');
  app.post('/api/gast/bezorg/mijn', auth, (req, res) => {
    const handle = handleVan(req);
    const bestellingen = buitenshuis.mijne(kern.db, handle).map(b => {
      const rek = horeca.H(b.zaakcode).rekeningen[b.rekeningId];
      const deelnemer = rek && (rek.deelnemers || []).find(d => d.handle === handle);
      const beeld = rek ? orderlaag.gastBeeld(rek, deelnemer || null) : null;
      const zaak = findSupplier(b.zaakcode);
      const order = rek ? etenBeeld.projecteerRekening({ zaakcode:b.zaakcode, zaak,
        rekening:rek, horecaDoos:horeca.H(b.zaakcode) }) : null;
      return Object.assign({}, b, { zaakNaam: zaak ? zaak.name : b.zaakcode,
        service: beeld ? beeld.service : null, tijdlijn: beeld ? beeld.tijdlijn.slice(-24) : [],
        orderregels: beeld ? beeld.regels.slice(0, 40) : [],
        openstaand: beeld ? beeld.openstaand : b.openstaand,
        order:order ? etenBeeld.zonderIntern(order) : null });
    });
    res.json({ ok: true, bestellingen });
  });

  app.post('/api/gast/bezorg/rekening', auth, (req, res) => {
    const s = zaakVan(req, res); if (!s) return;
    const kanaal = String((req.body || {}).kanaal || 'bezorging');
    const lop = buitenshuis.lopende(s.code, kanaal, handleVan(req), { open: false });
    if (lop.error) return stuur(res, lop);
    if (!lop.rekening) return res.status(404).json({ error: 'Je hebt hier geen lopende bestelling.', code: 'niets-open' });
    res.json({ ok: true, rekening: orderlaag.gastBeeld(lop.rekening, lop.deelnemer),
      bezorg: lop.rekening.bezorg || null, afhaal: lop.rekening.afhaal || null });
  });
};
