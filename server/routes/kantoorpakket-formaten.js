/* RTG Office, in en uit: exporteren (DOCX, XLSX, HTML, CSV, TXT, SVG) en een
   XLSX inlezen, voor alle vijf de ingangen (OFFICE.md punt 23).

   De export liep in de browser en las de classificatie niet. Hij loopt nu over
   de server, langs kern/office/uitgangspoort.js, zodat de classificatie IN het
   bestand meereist en het documentspoor weet wie wat exporteerde.

   Paden voluit, zelfde reden als in de andere kantoorpakket-bestanden: de
   schakelkast ziet alleen wat er letterlijk staat (scripts/check.js regel 45).
   Beide routes nemen een ruim lijf aan: een XLSX of een SVG reist mee. */
'use strict';

const envelop = require('../opzet/envelop');

module.exports = (kern) => {
  const { app, auth, supplierAuth, officeAuth, express, rtf, werkplek, boardroomWie, boardroomBaas, office } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json(r) : res.json(r);
  const ruim = express.json({ limit: '600kb' });

  // de zaak: de team-drive op de leverancierscode
  const supDoe = fn => async (req, res) => stuur(res, await fn('sup:' + req.supplier.code, req.body || {}));
  app.post('/api/supplier/kantoorpakket/exporteer', ruim, supplierAuth, supDoe((key, b) => office.exporteer(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/importeer', ruim, supplierAuth, supDoe((key, b) => office.importeer(key, b)));

  // de RTG-kantoren: de gedeelde kantoor-drive
  const kantoorDoe = fn => async (req, res) => stuur(res, await fn('rtg:kantoor', req.body || {}));
  app.post('/api/office/kantoorpakket/exporteer', ruim, officeAuth, kantoorDoe((key, b) => office.exporteer(key, b.id, b)));
  app.post('/api/office/kantoorpakket/importeer', ruim, officeAuth, kantoorDoe((key, b) => office.importeer(key, b)));

  // leden: op het eigen account; de gratis gast-app heeft geen Office
  function geenGast(req, res, next) {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG Office is voor leden.' });
    next();
  }
  const lidDoe = fn => async (req, res) => stuur(res, await fn(req.session.key, req.body || {}));
  app.post('/api/kantoorpakket/exporteer', ruim, auth, geenGast, lidDoe((key, b) => office.exporteer(key, b.id, b)));
  app.post('/api/kantoorpakket/importeer', ruim, auth, geenGast, lidDoe((key, b) => office.importeer(key, b)));

  /* Het RTF-gezin: elk profiel een eigen map, met de kring van het gezin. Een
     oppas of familielid leest mee en mag dus ook downloaden wat hij al ziet;
     een nieuw blad inlezen is maken, en dat doet het gezin zelf. */
  function rtfPoort(req, res, next) {
    const sess = rtf && rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const code = String(req.body.code || '').toUpperCase();
    req.officeFormaatDrive = { key: 'rtf:' + code + ':' + sess.handle, kring: 'rtfgezin:' + code, gast: !!sess.gast };
    envelop.zet(req, { soort: 'gezinslid', id: req.officeFormaatDrive.key, rol: sess.gast ? 'gast' : 'gezinslid',
      identiteit: 'bewezen', tenantSoort: 'gezin', tenantId: code });
    next();
  }
  const rtfDoe = (fn, schrijf) => async (req, res) => {
    const s = req.officeFormaatDrive;
    if (schrijf && s.gast) return res.status(403).json({ error: 'Als oppas of familielid lees je mee; maken en bewerken doet het gezin zelf.' });
    stuur(res, await fn(s, req.body || {}));
  };
  app.post('/api/rtf/kantoorpakket/exporteer', ruim, rtfPoort, rtfDoe((s, b) => office.exporteer(s.key, b.id, b, s.kring)));
  app.post('/api/rtf/kantoorpakket/importeer', ruim, rtfPoort, rtfDoe((s, b) => office.importeer(s.key, b, s.kring), true));

  // de werkplekken: elk huis zijn eigen kantoordrive, collega's delen de kring
  function huisPoort(req, res, next) {
    const key = boardroomWie(req), baas = boardroomBaas(key);
    const code = String((req.body || {}).bedrijf || '').toLowerCase();
    if (!werkplek.kent(code)) return res.status(404).json({ error: 'Dit bedrijf kennen we niet.' });
    if (!werkplek.magIn(code, key, baas)) return res.status(403).json({ error: 'Deze werkplek is niet van u. Vraag de eigenaar om toegang tot dit bedrijf.' });
    req.officeFormaatDrive = { key: code + ':kantoor', kring: 'werkplek:' + code };
    envelop.zet(req, { soort: 'werkplek', id: code + ':kantoor', identiteit: 'bewezen', tenantSoort: 'werkplek', tenantId: 'werkplek:' + code });
    next();
  }
  const huisDoe = fn => async (req, res) => stuur(res, await fn(req.officeFormaatDrive, req.body || {}));
  app.post('/api/werkplek/kantoorpakket/exporteer', ruim, huisPoort, huisDoe((s, b) => office.exporteer(s.key, b.id, b, s.kring)));
  app.post('/api/werkplek/kantoorpakket/importeer', ruim, huisPoort, huisDoe((s, b) => office.importeer(s.key, b, s.kring)));
};
