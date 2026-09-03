/* ============================================================================
   DE AI-ONDERZOEKER AAN DE KANTOORKANT -- twee routes, en allebei openen ze
   niets.

   Waarom hier en niet in ./service-kantoor.js: dat bestand ging er over de
   omvangsgrens van keuringsregel 13 mee, en de naad ligt op een echte grens --
   dit is de enige plek in de laag waar een MACHINE de aanvrager is. Wat er
   verder in deze routes gebeurt, gebeurt in kern/service/onderzoeker.js.

   DE AI VRAAGT NIET UIT ZICHZELF, en dat is de reden dat dit routes van een
   MEDEWERKER zijn en geen achtergrondtaak. Een machine die bij elke zaak
   standaard om toegang vraagt, maakt van de bevestigingsknop van het lid binnen
   een maand een reflex -- en dan is de bevestiging niets meer waard. Een mens
   zet het in gang, het LID beslist, en de AI leest pas daarna.
   ========================================================================== */
'use strict';

module.exports = (kern, { veilig, lijf, kort, balieAuth }) => {
  const { app, officeAuth, serviceOnderzoeker } = kern;

  /* WAT ZOU DE AI HIER KUNNEN. Leest niets van het lid: dit is een vraag over
     het TEAM van de zaak en over de grenzen, niet over de inhoud. Hij geeft ook
     terug wat NIET kan en waarom -- een lege lijst zou lezen als "er valt niets
     te vragen", en dat is een ander antwoord dan "dit gaat langs een mens". */
  app.post('/api/office/service/ai/mag', officeAuth, balieAuth, (req, res) => veilig(res, () =>
    serviceOnderzoeker.mag(kort(lijf(req).id, 40), lijf(req).capabilities)));

  /* DE AI VRAAGT HET LID. Dezelfde weg als een medewerker (bevestiging), met de
     machine als zichtbare aanvrager. Er gaat hier niets open: het antwoord is
     een openstaand verzoek, en pas als het lid drukt ontstaat er een machtiging.
     De code van dat verzoek staat er met opzet niet in -- die hoort in de app
     van het lid, net als bij een mens. */
  app.post('/api/office/service/ai/vraag', officeAuth, balieAuth, (req, res) => veilig(res, () => {
    const b = lijf(req);
    return serviceOnderzoeker.vraagToegang({ zaakId: kort(b.id, 40),
      capabilities: b.capabilities, reden: kort(b.reden, 500) });
  }));
};
