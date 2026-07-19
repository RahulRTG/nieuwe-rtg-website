/* De doe-laag van de Butler (kern/fluister): de intent-handlers die Fluister voor
   het lid zelf uitvoert. Boven de drempel (geld, of een claim op een gedeeld object)
   zet elke handler eerst een voorstel klaar (p.wacht) dat op "ja" wacht; onder de
   drempel (gratis, altijd annuleerbaar) gebeurt het direct. doeActie loopt de
   handlers langs en geeft een antwoord terug, of null als geen enkele matcht (dan
   valt gesprek.js door naar de AI/eigen regels).

   Dit is de orkestrator; de handlers zelf wonen in drie deelbestanden op dezelfde
   gedeelde ctx: ./bevestig (ja/nee, gratis acties en zoeken), ./boeken (tickets,
   behandeling, rit, 24-uursblok) en ./betalen (bestellen en het RTG Pay-verkeer).
   De keten hieronder houdt exact de volgorde aan van de oorspronkelijke acties.js. */
module.exports = (ctx) => {
  const b = require('./bevestig')(ctx);
  const k = require('./boeken')(ctx);
  const t = require('./betalen')(ctx);

  const keten = [
    b.ja, b.nee, b.planDag, b.saldo, b.annuleerRes,
    k.tickets, k.behandeling, k.taxi, t.bestel, k.blok24, t.tik,
    b.reserveer, b.zoek, t.vraagKlompje, t.watBetalen
  ];

  async function doeActie(a) {
    for (const h of keten) {
      const r = await h(a);
      if (r != null) return r;
    }
    return null; // geen doe-handler pakte dit; gesprek.js valt door naar de AI
  }

  return { doeActie };
};
