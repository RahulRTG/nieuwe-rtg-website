/* RTG Office, in en uit: exporteren (DOCX, XLSX, HTML, CSV, TXT, SVG) en een
   XLSX inlezen, voor alle vijf de ingangen (OFFICE.md punt 23).

   De export liep in de browser en las de classificatie niet. Hij loopt nu over
   de server, langs kern/office/uitgangspoort.js, zodat de classificatie IN het
   bestand meereist en het documentspoor weet wie wat exporteerde.

   Paden voluit, zelfde reden als in de andere kantoorpakket-bestanden: de
   schakelkast ziet alleen wat er letterlijk staat (scripts/check.js regel 45).
   Er staat bewust geen eigen lijfgrens bij: de algemene lijfparser
   (server/opzet/lijfpoort.js) leest het lijf al voor deze route, dus een
   strengere grens hier zou niets doen. De echte grenzen staan in de kern
   (MAX_XLSX en MAX_SVG in kern/office/formaten.js), met een nette weigering. */
'use strict';

const envelop = require('../opzet/envelop');

module.exports = (kern) => {
  const { app, auth, supplierAuth, officeAuth, rtf, werkplek, boardroomWie, boardroomBaas, office } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json(r) : res.json(r);

  /* EERST DE DEUREN, DAN DE ROUTES. Elke ingang heeft zijn eigen deur (wie ben
     je, welke drive), en die staan hier bij elkaar boven de tien routes. Zo
     toont elke route alleen wat zij zelf leest; de gezinsdeur leest een code en
     een profieltoken, en die hoort niet in het venster van de ledenroute
     (scripts/codecredentials.js leest dat venster). */
  // de zaak: de team-drive op de leverancierscode
  const supDoe = fn => async (req, res) => stuur(res, await fn('sup:' + req.supplier.code, req.body || {}));

  // de RTG-kantoren: de gedeelde kantoor-drive
  const kantoorDoe = fn => async (req, res) => stuur(res, await fn('rtg:kantoor', req.body || {}));

  // leden: op het eigen account; de gratis gast-app heeft geen Office
  function geenGast(req, res, next) {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG Office is voor leden.' });
    next();
  }
  const lidDoe = fn => async (req, res) => stuur(res, await fn(req.session.key, req.body || {}));

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

  // de tien routes: per ingang exporteren en inlezen, alle tien via de kern
  app.post('/api/supplier/kantoorpakket/exporteer', supplierAuth, supDoe((key, b) => office.exporteer(key, b.id, b)));
  app.post('/api/supplier/kantoorpakket/importeer', supplierAuth, supDoe((key, b) => office.importeer(key, b)));
  app.post('/api/office/kantoorpakket/exporteer', officeAuth, kantoorDoe((key, b) => office.exporteer(key, b.id, b)));
  app.post('/api/office/kantoorpakket/importeer', officeAuth, kantoorDoe((key, b) => office.importeer(key, b)));
  app.post('/api/kantoorpakket/exporteer', auth, geenGast, lidDoe((key, b) => office.exporteer(key, b.id, b)));
  app.post('/api/kantoorpakket/importeer', auth, geenGast, lidDoe((key, b) => office.importeer(key, b)));
  app.post('/api/rtf/kantoorpakket/exporteer', rtfPoort, rtfDoe((s, b) => office.exporteer(s.key, b.id, b, s.kring)));
  app.post('/api/rtf/kantoorpakket/importeer', rtfPoort, rtfDoe((s, b) => office.importeer(s.key, b, s.kring), true));
  app.post('/api/werkplek/kantoorpakket/exporteer', huisPoort, huisDoe((s, b) => office.exporteer(s.key, b.id, b, s.kring)));
  app.post('/api/werkplek/kantoorpakket/importeer', huisPoort, huisDoe((s, b) => office.importeer(s.key, b, s.kring)));
};
