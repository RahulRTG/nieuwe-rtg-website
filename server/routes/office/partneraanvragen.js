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

  app.post('/api/office/partner/decide', boardroomAuth, async (req, res) => {
    const a = (db.data.partnerApplications || []).find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Aanvraag niet gevonden.' });
    if (a.status !== 'nieuw') return res.status(409).json({ error: 'Deze aanvraag is al behandeld.' });
    const action = String(req.body.action || '');
    if (!['goedkeuren', 'afwijzen'].includes(action)) return res.status(400).json({ error: 'Kies goedkeuren of afwijzen.' });
    const door = boardroomWie(req);
    const at = klokDatum().toISOString();

    if (action === 'goedkeuren') {
      const poort = toelatingscontrole.magGoedkeuren(a, Date.parse(at));
      if (!poort.ok) return res.status(409).json(poort);
      const code = makeSupplierCode(a.company);
      const registratie = a.registratie ? JSON.parse(JSON.stringify(a.registratie)) : null;
      if (registratie) delete registratie.voorcontrole;
      const s = { code, name: a.company, type: a.type, city: a.city, loc: null,
        rate: 0.12, menu: [], online: false, registratie,
        activiteiten: a.activiteiten ? JSON.parse(JSON.stringify(a.activiteiten)) : {},
        toelating: { aanvraagId: a.id, gecontroleerdAt: at,
          eisen: a.toelating.eisen.map(e => ({ id: e.id, label: e.label, bron: e.bron,
            status: e.status, gecontroleerd: e.gecontroleerd })) } };
      ensureSupplierDefaults(s);
      db.data.suppliers.push(s);
      const pin = accounts.makePin();
      await accounts.createStaff({ supplierCode: code, name: a.contactName, role: 'manager', func: 'Beheer', pin });
      a.status = 'goedgekeurd'; a.code = code;
      a.besluit = { action, door, at };
      save();
      logActivity(code, { name: 'Boardroom' }, 'liet de partner toe na afronding van het toelatingsdossier');
      const url = appUrl(req);
      mail.send(a.email, 'Welkom als gecontroleerde partner van Rahul Travel Group',
        'Beste ' + a.contactName + ',\n\n' + a.company + ' is na de toelatingscontrole goedgekeurd als RTG-partner.\n\n' +
        'Uw leverancierscode: ' + code + '\nUw manager-PIN: ' + pin + ' (op naam van ' + a.contactName + ')\n\n' +
        'Open de partner-app op ' + url + '/apps/leverancier.html, kies uw bedrijf via de code en log in als management. ' +
        'Uw zaak staat nog offline totdat de ondernemer-poort, Salon-pagina en werkintro zijn afgerond.\n\nRahul Travel Group');
      sseToOffice('sync', { scope: 'team' });
      return res.json({ ok: true, code, pin });
    }

    const reden = schoon(req.body.reden, 300);
    if (reden.length < 3) return res.status(400).json({ error: 'Leg kort vast waarom de aanvraag wordt afgewezen.' });
    a.status = 'afgewezen';
    a.besluit = { action, door, at, reden };
    save();
    mail.send(a.email, 'Uw partneraanvraag bij Rahul Travel Group',
      'Beste ' + a.contactName + ',\n\nNa beoordeling kunnen we ' + a.company + ' op dit moment geen partnerplek aanbieden. ' +
      'Reden: ' + reden + '\n\nRahul Travel Group');
    sseToOffice('sync', { scope: 'team' });
    res.json({ ok: true });
  });
};
