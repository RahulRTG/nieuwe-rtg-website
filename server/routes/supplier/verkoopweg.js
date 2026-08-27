/* Domein "supplier" (deelmodule): DE VERKOOPWEGEN van een zaak.

   De motor staat in kern/commerce/verkoopweg.js; hier staan alleen de deuren.
   Wat er in die kop staat geldt onverkort, en één ding daarvan hoort ook hier
   genoemd te worden omdat het de eerste vraag is die een ondernemer stelt:

   PUBLIEK VERKOPEN KAN NIET, en dat is een geweigerde regel en geen ontbrekende.
   kern/webdomein.js heeft er twee sloten voor, waarvan het eerste een besluit
   van de boardroom is. De motor antwoordt met 403 en met de reden erin, zodat
   het scherm hem kan tonen in plaats van de knop weg te laten -- een knop die
   ontbreekt zonder uitleg, laat iemand zoeken naar een instelling die niet
   bestaat.

   DE ZAAK KOMT UIT HET TOKEN, nooit uit het verzoek -- dezelfde grens als
   ./btw.js en ./retour.js. Een zaakcode in het lijf zou betekenen dat elke
   manager de winkels van de buurman aan- en uitzet. De motor krijgt hem daarom
   als LOSSE parameter en niet in het body-object, zodat hij er niet per ongeluk
   uit een veld in kan glippen. */
module.exports = (kern) => {
  const { app, commerce, supplierAuth, schoon } = kern;
  if (!commerce) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const managerOf = (req, res) => {
    if (!req.actor || !req.actor.manager) { res.status(403).json({ error: 'Alleen voor management.' }); return null; }
    return req.actor.name || 'manager';
  };

  /* De lijst, mét de keuzes en mét wat er niet bestaat. Die laatste twee gaan
     mee zodat een scherm de mogelijkheden kan tonen zonder ze te kennen -- en
     zodat het `publiek` kan laten zien als wat het is: een optie met een
     antwoord erop, en niet een gat in de lijst. */
  app.post('/api/supplier/verkoopweg/lijst', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    res.json({ ok: true, wegen: commerce.wegLijst(req.supplier.code),
      soorten: commerce.WEG_SOORTEN, toegang: commerce.WEG_TOEGANG,
      nietGebouwd: commerce.WEG_NIET_GEBOUWD });
  });

  app.post('/api/supplier/verkoopweg/zet', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const b = req.body || {};
    antwoord(res, commerce.wegZet(req.supplier.code, {
      id: schoon(b.id, 40), naam: schoon(b.naam, 60),
      soort: schoon(b.soort, 20), toegang: schoon(b.toegang, 20),
      alleen: Array.isArray(b.alleen) ? b.alleen : undefined
    }));
  });

  /* Live zetten staat apart van bewerken -- dezelfde knip als
     kern/webmaker-publiceren.js maakt tussen bouwen en publiceren, en om
     dezelfde reden: dit is het moment waarop er iets naar buiten verandert. */
  app.post('/api/supplier/verkoopweg/publiceer', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const b = req.body || {};
    antwoord(res, commerce.wegPubliceer(req.supplier.code, schoon(b.id, 40), b.live !== false));
  });

  app.post('/api/supplier/verkoopweg/wis', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    antwoord(res, commerce.wegWis(req.supplier.code, schoon((req.body || {}).id, 40)));
  });
};
