/* Enterprise-samenwerking voor alle vijf RTG Office-ingangen.

   De paden staan expres voluit. Zo blijven toegangsdeur, drive en actie per
   route zichtbaar voor de schakelkast en de beveiligingscontroles. */
'use strict';

module.exports = kern => {
  const { app, auth, supplierAuth, officeAuth, rtf, werkplek, boardroomWie, boardroomBaas,
    office } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json(r) : res.json(r);

  const supDoe = fn => async (req, res) => stuur(res, await fn('sup:' + req.supplier.code, req.body || {}));
  app.post('/api/supplier/kantoorpakket/samen', supplierAuth, supDoe((key, b) => office.samen(key, b.id)));
  app.post('/api/supplier/kantoorpakket/aanwezig', supplierAuth, supDoe((key, b) => office.aanwezig(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/opmerking', supplierAuth, supDoe((key, b) => office.opmerking(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/beheer', supplierAuth, supDoe((key, b) => office.beheer(key, b.id, b)));

  const kantoorDoe = fn => async (req, res) => stuur(res, await fn('rtg:kantoor', req.body || {}));
  app.post('/api/office/kantoorpakket/samen', officeAuth, kantoorDoe((key, b) => office.samen(key, b.id)));
  app.post('/api/office/kantoorpakket/aanwezig', officeAuth, kantoorDoe((key, b) => office.aanwezig(key, b.id, b)));
  app.post('/api/office/kantoorpakket/opmerking', officeAuth, kantoorDoe((key, b) => office.opmerking(key, b.id, b)));
  app.post('/api/office/kantoorpakket/beheer', officeAuth, kantoorDoe((key, b) => office.beheer(key, b.id, b)));

  function geenGast(req, res, next) {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG Office is voor leden.' });
    next();
  }
  const lidDoe = fn => async (req, res) => stuur(res, await fn(req.session.key, req.body || {}));
  app.post('/api/kantoorpakket/samen', auth, geenGast, lidDoe((key, b) => office.samen(key, b.id)));
  app.post('/api/kantoorpakket/aanwezig', auth, geenGast, lidDoe((key, b) => office.aanwezig(key, b.id, b)));
  app.post('/api/kantoorpakket/opmerking', auth, geenGast, lidDoe((key, b) => office.opmerking(key, b.id, b)));
  app.post('/api/kantoorpakket/beheer', auth, geenGast, lidDoe((key, b) => office.beheer(key, b.id, b)));

  function rtfPoort(req, res, next) {
    const sess = rtf && rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const code = String(req.body.code || '').toUpperCase();
    req.officeSamenDrive = { key: 'rtf:' + code + ':' + sess.handle, kring: 'rtfgezin:' + code, gast: !!sess.gast };
    next();
  }
  const rtfDoe = (fn, schrijf) => async (req, res) => {
    const s = req.officeSamenDrive;
    if (schrijf && s.gast) return res.status(403).json({ error: 'Als oppas of familielid lees je mee; beheren doet het gezin zelf.' });
    stuur(res, await fn(s, req.body || {}));
  };
  app.post('/api/rtf/kantoorpakket/samen', rtfPoort, rtfDoe((s, b) => office.samen(s.key, b.id, s.kring)));
  app.post('/api/rtf/kantoorpakket/aanwezig', rtfPoort, rtfDoe((s, b) => office.aanwezig(s.key, b.id, b, s.kring)));
  app.post('/api/rtf/kantoorpakket/opmerking', rtfPoort, rtfDoe((s, b) => office.opmerking(s.key, b.id, b, s.kring)));
  app.post('/api/rtf/kantoorpakket/beheer', rtfPoort, rtfDoe((s, b) => office.beheer(s.key, b.id, b), true));

  function huisPoort(req, res, next) {
    const key = boardroomWie(req), baas = boardroomBaas(key);
    const code = String((req.body || {}).bedrijf || '').toLowerCase();
    if (!werkplek.kent(code)) return res.status(404).json({ error: 'Dit bedrijf kennen we niet.' });
    if (!werkplek.magIn(code, key, baas)) return res.status(403).json({ error: 'Deze werkplek is niet van u.' });
    req.officeSamenDrive = { key: code + ':kantoor', kring: 'werkplek:' + code };
    next();
  }
  const huisDoe = fn => async (req, res) => stuur(res, await fn(req.officeSamenDrive, req.body || {}));
  app.post('/api/werkplek/kantoorpakket/samen', huisPoort, huisDoe((s, b) => office.samen(s.key, b.id, s.kring)));
  app.post('/api/werkplek/kantoorpakket/aanwezig', huisPoort, huisDoe((s, b) => office.aanwezig(s.key, b.id, b, s.kring)));
  app.post('/api/werkplek/kantoorpakket/opmerking', huisPoort, huisDoe((s, b) => office.opmerking(s.key, b.id, b, s.kring)));
  app.post('/api/werkplek/kantoorpakket/beheer', huisPoort, huisDoe((s, b) => office.beheer(s.key, b.id, b)));
};
