/* Horeca-kern (deelmodule): het bouwen van EEN bestelregel.

   WAAROM DIT HIER STAAT EN NIET IN DE ROUTE. Deze code stond in
   routes/supplier/horeca/rekening.js, in de handler zelf. Zolang alleen de
   bediening bestelde was dat prima. Zodra de GAST vanaf zijn eigen telefoon
   bestelt, zou diezelfde rekensom een tweede keer geschreven moeten worden --
   en dan zijn er twee plekken die bepalen wat een biertje kost, welke happy
   hour erop zit en of de allergie meegaat. Dat is LAT-regel 4, en het eerste
   dat er stukgaat is de prijs: een happy hour die de bediening wel toepast en
   de gast niet, of andersom.

   De regel wordt hier GEBOUWD maar niet weggeschreven. Wie hem op een rekening
   zet (en of dat mag) is de vraag van de aanroeper -- de bediening mag altijd,
   de gast alleen binnen het beleid van de zaak. Zo blijft de prijsvorming een
   plek en de toestemming een andere. */
'use strict';

module.exports = ({ schoon, horeca }) => {
  const { id, nu, centen, uitEuro, happyKorting } = horeca;

  /* Bouwt een bestelregel of geeft een fout terug in dezelfde vorm als de rest
     van het huis ({ status, error }). Geeft nooit een half gevulde regel: bij
     een fout komt er geen regel uit. */
  function bouwRegel(zaakcode, invoer, wie) {
    const b = invoer || {};
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Wat wordt er besteld?' };

    /* De prijs komt in centen of in euro's, en 0 is een geldige prijs (een
       glas kraanwater, een gang uit een arrangement). Daarom de expliciete
       vergelijking met null en niet de valstrik `if (!prijs)`.

       WAT DEZE CONTROLE NIET DOET, en dat was in de oude code net zo: een
       ONTBREKENDE prijs komt hier als 0 binnen, want `centen()` maakt van
       undefined een nul. Er is dus geen verschil tussen "gratis" en "vergeten
       in te vullen". Voor de gastkant maakt dat niet uit -- daar komt de prijs
       altijd van de kaart van de zaak -- maar de bediening kan zo een regel van
       nul euro aanslaan. Bewust hier gelaten en niet stilletjes veranderd: het
       strenger maken raakt de kassa en hoort een eigen besluit te zijn. */
    const prijs = b.centen != null ? centen(b.centen) : uitEuro(b.prijs);
    if (prijs == null || Number.isNaN(prijs)) return { status: 400, error: 'Vul de prijs in.' };

    const groep = schoon(b.groep, 30) || null;
    const happy = happyKorting(zaakcode, groep, nu());

    const regel = {
      id: id(3),
      naam,
      aantal: Math.max(1, Math.min(99, parseInt(b.aantal, 10) || 1)),
      centen: happy ? Math.round(prijs * (100 - happy.procent) / 100) : prijs,
      lijstprijs: prijs,
      happy: happy ? happy.naam + ' -' + happy.procent + '%' : null,
      groep,
      gang: Math.max(0, Math.min(9, parseInt(b.gang, 10) || 0)),
      station: schoon(b.station, 30) || null,
      notitie: schoon(b.notitie, 120) || null,
      /* Allergie is een eigen veld en geen notitie. In een vrij notitieveld
         verdwijnt hij tussen "zonder ui" en "extra krokant". */
      allergie: schoon(b.allergie, 120) || null,
      gastNr: b.gastNr == null ? null : Math.max(1, Math.min(99, parseInt(b.gastNr, 10) || 1)),
      stand: 'besteld',
      at: nu(),
      door: wie
    };
    return { regel };
  }

  return { bouwRegel };
};
