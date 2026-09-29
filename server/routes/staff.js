/* Domein "staff" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { DEMO, accounts, app, checkCred, commCollega, crypto, db, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan, stuurLus, werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN, oogVoertuigen, oogNulmetingZet, oogNulmetingVan, oogSchouwLog, oogSchouwen, oogLeer, oogSpullen, oogUitgifteLog, oogOverzicht, plaats, codenaamVan,
    // payrollOS gaat door naar staff/dienst.js: een ziekmelding raakt ook de
    // loondoorbetaling. Hij mag ontbreken (een kaal testproces mount de
    // loonlaag niet), dus de aanroepen daar controleren dat.
    payrollOS, ochtendkaart } = kern;
  /* De fluisterlaag als EEN naam, en die geven we ook als een naam door. Zou
     staff.js hier de vier losse namen uitpakken en die in actx zetten, dan staan
     ze weer los in de subcontext -- en dan zegt geen enkel bestand meer dat dit
     domein van de fluisterlaag afhangt, ook al staat het op de kern netjes onder
     een naam. De grens loopt door de doorgifte heen. */
  const fluister = kern.fluister;

  /* De collega-, dienst- en ooglaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const actx = { DEMO, accounts, app, checkCred, commCollega, crypto, db, hasCred, klokVan, logActivity, managerOnly, notifySupplier, publicPartner, save, schoon, sseClients, sseSend, sseToOffice, sseToSupplier, supplierAuth, trustVan,
    fluister, stuurLus,
    werkbeleidPauzeStand, WERKBELEID_PAUZE_MINUTEN,
    oogVoertuigen, oogNulmetingZet, oogNulmetingVan, oogSchouwLog, oogSchouwen, oogLeer, oogSpullen, oogUitgifteLog, oogOverzicht,
    /* payrollOS gaat mee omdat een ziekmelding twee kanten heeft: de bezetting
       van vandaag (die laag hier) en de loondoorbetaling (kern/payroll/verzuim).
       Die tweede stond klaar en werd door niets aangeroepen -- de loonrun wist
       niet dat iemand ziek was. Hij mag ontbreken (een kaal testproces mount de
       payrolllaag niet), dus elke aanroep hieronder checkt dat. */
    payrollOS,
    /* De plaatslaag (kern/plaats, PLAATS.md fase 2): de prikklok in
       ./staff/dienst.js vraagt hem of het toestel van deze mens binnen het hek
       van de zaak stond. Hij mag ontbreken -- dan is "niet gemeten" het
       antwoord, en dat is iets anders dan "niet bevestigd". */
    plaats, codenaamVan,
    // de ochtendkaart (kern/ochtendkaart.js): een lezing, via ./staff/ochtend.js
    ochtendkaart };
  require('./staff/collega')(actx);
  require('./staff/dienst')(actx);
  require('./staff/inzetbaarheid')(actx);
  require('./staff/oog')(actx);
  require('./staff/ochtend')(actx);

/* De personeelsdeur van het partnerkanaal (B14). De code is een 128-bit
   credential per medewerker (kern/partnerpersoneelscode.js): hij opent het
   bedrijfsbeeld van zijn partner zolang hij geldig is, wordt hier NIET verbruikt
   (dat doet pas een boeking) en gaat nooit terug in het antwoord. Een onbekende,
   verlopen, ingetrokken of opgebruikte code krijgt hetzelfde antwoord. */
app.post('/api/staff', (req, res) => {
  res.set('Cache-Control', 'no-store');
  let partner, personeel = null;
  if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Gebruik uw personeelscode.' });
    if (!checkCred(req.body.username, req.body.password))
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    partner = db.data.partners.find(p => p.staff) || null;
  } else {
    const v = kern.partnerPersoneelscode.welke(req.body && req.body.staffCode);
    if (v) { partner = v.partner; personeel = { expires_at: v.expires_at, resterend: v.resterend }; }
  }
  if (!partner) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
  res.json({ ok: true, partner: publicPartner(partner), personeel });
});
};
