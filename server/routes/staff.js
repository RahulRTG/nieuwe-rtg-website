/* Domein "staff" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel, stuurLus,
    oogVoertuigen, oogNulmetingZet, oogNulmetingVan, oogSchouwLog, oogSchouwen, oogLeer, oogSpullen, oogUitgifteLog, oogOverzicht } = kern;

  /* De collega-, dienst- en ooglaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const actx = { DEMO, accounts, app, checkCred, crypto, db, findStaffPartner, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluisterZeg, fluisterVergeet, fluisterFocus, fluisterProfiel, stuurLus,
    oogVoertuigen, oogNulmetingZet, oogNulmetingVan, oogSchouwLog, oogSchouwen, oogLeer, oogSpullen, oogUitgifteLog, oogOverzicht };
  require('./staff/collega')(actx);
  require('./staff/dienst')(actx);
  require('./staff/oog')(actx);

app.post('/api/staff', (req, res) => {
  let partner;
  if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Gebruik uw personeelscode.' });
    if (!checkCred(req.body.username, req.body.password))
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    partner = db.data.partners.find(p => p.staff) || null;
  } else {
    partner = findStaffPartner(req.body.staffCode);
  }
  if (!partner) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
  // De personeelscode gaat mee terug zodat de inlog verder werkt zoals de code-invoer.
  res.json({ ok: true, partner: publicPartner(partner), staffCode: partner.staff ? partner.staff.code : null });
});
};
