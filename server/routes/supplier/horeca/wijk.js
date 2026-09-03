/* Horeca OS (deellaag): DE WIJK -- welke tafels zijn van wie.

   De regels staan in kern/horeca/wijk.js; hier staat de deur. Twee soorten
   handelingen, en ze horen bij verschillende mensen:

     indelen   wie welke tafels krijgt is een besluit van de leiding, dus
               manager-werk. Een bediening die zijn eigen wijk kan hertekenen,
               kan er ook de drukste tafels uit halen.
     nemen     een wijk oppakken en loslaten doet de bediening zelf, aan het
               begin en het eind van een dienst. Dat is geen planning maar een
               handeling van een halve seconde -- planning vooraf klopt op een
               drukke avond toch nooit. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, managerOnly, logActivity, sseToSupplier, horeca } = kern;
  const { H, Hlees } = horeca;
  const wijk = require('../../../kern/horeca/wijk')({ horeca, schoon });
  /* Het wijkbeeld (hoeveel open werk draagt elke wijk) komt uit de WERKLIJST en
     wordt hier niet nog eens geteld: dat is dezelfde som die de PDA toont, en
     twee tellingen van hetzelfde lopen gegarandeerd uiteen (LAT-regel 4). */
  const werk = require('../../../kern/horeca/werklijst')({ horeca, schoon, verzoeklaag: kern.verzoeklaag });
  /* Overdragen is iets anders dan nemen of loslaten: het mag geen moment
     opleveren waarop de wijk van niemand is. De HANDELINGEN staan naast dit
     bestand (./wijk-overdracht.js); hier wordt alleen de STAND gelezen, want
     die hoort in hetzelfde antwoord als de verdeling zelf. */
  const over = require('../../../kern/horeca/wijk-overdracht')({ horeca, schoon });

  const wieVan = (req) => ({ staffId: req.actor.staffId == null ? null : String(req.actor.staffId),
    naam: req.actor.name, manager: !!req.actor.manager });
  const duw = (code) => sseToSupplier(code, 'sync', { scope: 'horeca' });

  app.post('/api/supplier/horeca/wijken', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const ik = wieVan(req);
    /* De verdeling en de drukte in EEN antwoord, en dus op EEN moment. Uit twee
       aanroepen samengesteld kan een wijk in de ene helft van het scherm van
       Sanne zijn en in de andere helft van Ayla -- precies op het moment dat
       iemand hem overdraagt, en dat is het moment waarop dit scherm gelezen
       wordt. */
    const beeld = werk.werklijst(h, req.supplier.code, { modus: 'alles', staffId: ik.staffId }).wijkbeeld;
    const drukte = (id) => beeld.find((b) => b.id === id) || { taken: 0, nu: 0 };
    /* De uitgeleende tafels van deze wijk staan bij de wijk zelf: wie leest
       "Serre, 12 open" moet erbij zien dat er drie bij Sanne staan, anders is
       dat getal geen drukte maar een mening (grens 7). */
    const uitVan = (wijkId) => wijk.leen.lijst(h).filter((l) => l.wijkId === wijkId);
    const rijen = wijk.lijst(h).map((w) => Object.assign({}, w,
      { vanMij: !!(w.van && String(w.van.staffId) === String(ik.staffId)),
        taken: drukte(w.id).taken, nu: drukte(w.id).nu, uit: drukte(w.id).uit,
        uitgeleend: uitVan(w.id).map((l) => ({ tafel: l.tafel, naam: l.naam, staat: l.staat })) }));
    const inWijk = new Set(rijen.reduce((a, w) => a.concat(w.tafels), []));
    const aanbiedingen = over.lijst(h).map((o) => Object.assign({}, o, {
      vanMij: String(o.vanId) === String(ik.staffId),
      voorMij: String(o.naarId) === String(ik.staffId)
    }));
    const leningen = wijk.leen.lijst(h).map((l) => Object.assign({}, l, {
      vanMij: !!(l.vanId != null && String(l.vanId) === String(ik.staffId)),
      naarMij: String(l.staffId) === String(ik.staffId)
    }));
    res.json({ ok: true, wijken: rijen,
      mijne: rijen.filter((w) => w.vanMij).map((w) => w.naam),
      overdrachten: aanbiedingen,
      voorMij: aanbiedingen.filter((o) => o.voorMij).length,
      /* Weigeringen die aan MIJ gericht zijn en die ik nog niet heb gezien. Ze
         verdwijnen niet vanzelf na een tijd: wie op dat moment met borden liep,
         mist een bericht dat zichzelf opruimt (wijk-antwoord.js regel 2). */
      antwoorden: over.antwoorden(h, ik.staffId),
      leningen,
      /* De ploeg, zodat een aanbod een naam kan krijgen. Geen rollen en geen
         telling per mens -- alleen wie er is (grens 5). */
      ploeg: (function () {
        try {
          return (kern.accounts.listStaff(req.supplier.code) || [])
            .map(function (x) { return { id: String(x.id), naam: x.name, ik: String(x.id) === String(ik.staffId) }; });
        } catch (e) { return []; }
      })(),
      /* Alleen een WEERGAVEHINT: het indeelblok verschijnt bij wie er iets mee
         kan. Het recht zelf blijft op de server (managerOnly bij /wijk/zet en
         /wijk/weg) -- een client die dit vlaggetje omzet, komt er niet in. */
      magIndelen: !!ik.manager,
      tafels: (req.supplier.tables || []).map((t) => t.name),
      /* De tafels die in geen enkele wijk zitten staan er APART bij, met hun
         eigen drukte. Ze zijn van iedereen, en wat van iedereen is verdwijnt
         het makkelijkst -- een verdeelscherm dat ze weglaat, laat precies de
         tafels weg waar niemand zich verantwoordelijk voor voelt. */
      zonderWijk: { tafels: (req.supplier.tables || []).map((t) => t.name).filter((t) => !inWijk.has(t)),
        taken: drukte(null).taken, nu: drukte(null).nu },
      let: 'Een tafel die in geen wijk zit en een wijk die niemand draagt, zijn van ' +
        'iedereen. Een wijk verdeelt werk en verbergt het nooit.' });
  });

  /* KIJKEN MET Hlees, SCHEPPEN MET H. H() zet de horecadoos van een zaak neer
     zodra iemand ernaar vraagt -- ook als het verzoek daarna met een 404 terug
     moet omdat die wijk niet bestaat, en dan zeggen de statuscode en de opslag
     iets anders over hetzelfde verzoek (zie kern/horeca.js bij Hlees).

     Weghalen, nemen en loslaten kunnen alleen slagen op een wijk die er al is,
     en een wijk bestaat alleen in een doos die er al is. Bestaat die doos, dan
     geeft Hlees hem ECHT terug en landt de wijziging gewoon in de opslag;
     bestaat hij niet, dan is er niets te vinden en eindigt de aanroep sowieso
     op een 404 -- nu zonder spoor.

     `zet` hieronder houdt daarom bewust H(): hij is de enige van de vier die
     ook op een zaak zonder doos kan SLAGEN, want hij maakt de eerste wijk. Met
     een leesdoos zou die eerste wijk in een losse vorm landen en verdwijnen.
     Zijn keuring woont in kern/horeca/wijk.js, in dezelfde aanroep die
     schrijft, dus de route kan er niet tussen komen zonder die keuring over te
     typen -- en twee plekken die dezelfde regel kennen lopen uiteen. */
  app.post('/api/supplier/horeca/wijk/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const h = H(req.supplier.code);
    const uit = wijk.zet(h, { wijkId: req.body.wijkId, naam: req.body.naam, tafels: req.body.tafels });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'zette wijk "' + uit.wijk.naam + '" op ' + uit.wijk.tafels.length + ' tafel(s)');
    duw(req.supplier.code);
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const h = Hlees(req.supplier.code);
    const uit = wijk.weg(h, req.body.wijkId);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'haalde wijk "' + uit.wijk.naam + '" weg');
    duw(req.supplier.code);
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/neem', supplierAuth, (req, res) => {
    const ik = wieVan(req);
    if (ik.staffId == null) return res.status(403).json({ error: 'Alleen vanaf een persoonlijke inlog.' });
    const h = Hlees(req.supplier.code);
    const uit = wijk.neem(h, req.body.wijkId, ik);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error, code: uit.code || null, van: uit.van });
    if (!uit.al) {
      save();
      logActivity(req.supplier.code, req.actor, 'nam wijk "' + uit.wijk.naam + '"');
      duw(req.supplier.code);
    }
    res.json(uit);
  });

  app.post('/api/supplier/horeca/wijk/laat', supplierAuth, (req, res) => {
    const h = Hlees(req.supplier.code);
    const uit = wijk.laat(h, req.body.wijkId, wieVan(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    logActivity(req.supplier.code, req.actor, 'liet een wijk los');
    duw(req.supplier.code);
    res.json(uit);
  });
};
