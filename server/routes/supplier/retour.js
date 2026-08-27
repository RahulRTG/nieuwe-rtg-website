/* Domein "supplier" (deelmodule): DE RETOURSTROOM, verkoperkant.

   De motor staat in kern/commerce/retour.js en de begrippen in
   kern/commerce/retourlijst.js; hier staan alleen de deuren. Wat er in die kop
   staat geldt onverkort: RTG beslist niets namens deze zaak, en een uitkomst met
   geld erin wordt KLAARGEZET en niet uitgevoerd.

   TWEE GRENZEN DIE HIER NIET MOGEN VERVAGEN -- dezelfde twee als bij de
   btw-aangifte (./btw.js), en om dezelfde reden:

   1. DE ZAAK KOMT UIT HET TOKEN, nooit uit het verzoek. Een zaakcode in het lijf
      zou betekenen dat elke manager de retouren van de buurman beweegt, en die
      bevatten bedragen, gronden en toelichtingen van andermans klanten. De kern
      controleert het nog een keer (`verkoper` gaat mee naar retourZet), zodat
      een tweede deur die dit ooit vergeet er alsnog op stuit.

   2. ALLEEN EEN MANAGER. Een retour afhandelen zet een geldbesluit klaar. Dat is
      dezelfde lat als de rest van het financiele bord.

   WAT HIER MET OPZET NIET STAAT: een knop die het geld werkelijk terugstort. Die
   weg loopt langs kern/pay met de bevoegdheid die daarvoor bestaat, en hij komt
   hier niet als bijproduct van een statusknop bij. Zie GELD.md par. 3. */
module.exports = (kern) => {
  const { app, commerce, supplierAuth, schoon } = kern;
  if (!commerce) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  /* LETTERLIJK dezelfde vorm als ./btw.js, en dat is geen kopieerzucht maar de
     enige juiste: `req.actor` is wat supplierAuth neerzet. Een eigen variant
     (bijvoorbeeld op req.staff, wat hier eerst stond) kijkt naar een veld dat
     niemand vult -- en dan laat de rolcontrole iedereen door zonder dat er iets
     kapot lijkt. Een verkeerde controle is erger dan geen. */
  const managerOf = (req, res) => {
    if (!req.actor || !req.actor.manager) { res.status(403).json({ error: 'Alleen voor management.' }); return null; }
    return req.actor.name || 'manager';
  };

  app.post('/api/supplier/retour/lijst', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    res.json({ ok: true, retouren: commerce.retourVanVerkoper(req.supplier.code),
      nietGebouwd: commerce.RETOUR_NIET_GEBOUWD });
  });

  /* Een stand zetten. `naar` komt uit het verzoek, de ZAAK niet -- en `door`
     staat vast op 'verkoper': deze deur is er een van de verkoper, dus namens
     iemand anders zetten kan hier per definitie niet. */
  app.post('/api/supplier/retour/zet', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const b = req.body || {};
    antwoord(res, commerce.retourZet({
      id: schoon(b.id, 60),
      naar: schoon(b.naar, 30),
      door: 'verkoper',
      wie: door,
      verkoper: req.supplier.code,
      staat: schoon(b.staat, 30),
      uitkomst: schoon(b.uitkomst, 30),
      bedragCenten: b.bedragCenten,
      reden: schoon(b.reden, 300),
      orderKenmerk: schoon(b.orderKenmerk, 80)
    }));
  });

  /* UITVOEREN IS EEN ANDERE HANDELING DAN AFHANDELEN, en heeft daarom een eigen
     deur. Afhandelen ZET een bedrag klaar; dit BETAALT het uit, langs
     kern/pay/verkoop.js terugGave. Een mens drukt -- er gebeurt niets vanzelf,
     niet op een timer en niet als bijproduct van de statusknop (GELD.md par. 3).

     Twee keer drukken is geen tweede teruggave: de retour-id is de idem-sleutel
     in de geldlaag, en dit is precies de knop waarop twee keer wordt gedrukt. */
  app.post('/api/supplier/retour/uitvoeren', supplierAuth, async (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    antwoord(res, await commerce.retourVoerUit({
      id: schoon((req.body || {}).id, 60), verkoper: req.supplier.code, wie: door }));
  });
};
