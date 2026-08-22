/* De boardroom behandelt partneraanvragen. Controleren en beslissen zijn twee
   aparte handelingen: een goedkeurknop kan de register- of vergunningenpoort
   daardoor nooit omzeilen. Iedere controle bewaart bron, tijd en medewerker. */
'use strict';

const toelatingscontrole = require('../../kern/bedrijfscontrole');
const { datum: klokDatum } = require('../../lib/klok');

module.exports = (octx) => {
  const { accounts, app, appUrl, boardroomAuth, boardroomWie, db,
    ensureSupplierDefaults, findSupplier, handelsregelwacht, logActivity, mail,
    makeSupplierCode, officeAuth, save, schoon, sseToOffice } = octx.kern;

  app.post('/api/office/partner/regels', officeAuth, (req, res) =>
    res.json(handelsregelwacht.status()));

  app.post('/api/office/partner/regels/check', boardroomAuth, async (req, res) => {
    const r = await handelsregelwacht.check(String(req.body.bronId || '') || null);
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/partner/regels/bevestig', boardroomAuth, (req, res) => {
    const r = handelsregelwacht.bevestig(String(req.body.id || ''), boardroomWie(req), req.body.toelichting);
    if (!r.ok) return res.status(r.status || 400).json(r);
    sseToOffice('sync', { scope:'team', handelsregels:true });
    res.json(r);
  });

  app.post('/api/office/partner/regels/hercontrole', boardroomAuth, (req, res) => {
    const s = findSupplier(String(req.body.code || ''));
    if (!s || !s.toelating) return res.status(404).json({ error:'Partnerdossier niet gevonden.' });
    const eis = (s.toelating.eisen || []).find(e => e.id === String(req.body.onderdeel || ''));
    if (!eis || eis.status !== 'hercontrole_nodig')
      return res.status(409).json({ error:'Dit onderdeel wacht niet op hercontrole.' });
    const at = klokDatum().toISOString();
    const r = toelatingscontrole.controleer(s.toelating,
      { onderdeel:eis.id, uitkomst:'geverifieerd', referentie:req.body.referentie, geldigTot:req.body.geldigTot },
      boardroomWie(req), at);
    if (!r.ok) return res.status(r.status || 400).json(r);
    if (!r.open.length) {
      s.toelating.status = 'actueel';
      if (s.activiteiten) delete s.activiteiten.regelHercontrole;
    }
    save();
    sseToOffice('sync', { scope:'team', handelsregels:true });
    res.json({ ok:true, open:r.open });
  });

  app.post('/api/office/partner/controle', boardroomAuth, (req, res) => {
    const a = (db.data.partnerApplications || []).find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
    if (a.status !== 'nieuw') return res.status(409).json({ error: 'Alleen een open aanvraag kan worden gecontroleerd.' });
    const at = klokDatum().toISOString();
    const r = toelatingscontrole.controleer(a.toelating, req.body || {}, boardroomWie(req), at);
    if (!r.ok) return res.status(r.status || 400).json(r);
    save();
    sseToOffice('sync', { scope: 'team', partnerAanvraag: a.id });
    res.json({ ok: true, toelating: { status: a.toelating.status, open: r.open } });
  });
  /* /api/office/partner/decide STAAT HIER NIET MEER, en dat is een besluit.

     Deze module bracht een eigen `decide` mee. De verzameling had die route al,
     in ./partners.js, en daar zit het werk van deze week in: de eis dat er een
     LEDENBEWIJS bij de aanvraag zit voordat er een bedrijfscode uitgaat, en het
     vastleggen van het abonnement van de zaak. Beide ontbraken in de versie
     hier. Twee registraties op hetzelfde adres betekent bovendien dat de eerste
     stil wint en de tweede dode code is (keuringsregel 31) -- dus de zwakkere
     poort had de sterkere kunnen verdringen, afhankelijk van de laadvolgorde.
     De regels- en controleroutes hieronder zijn wel nieuw en blijven. */

};
