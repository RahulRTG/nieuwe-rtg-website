/* DE DEUR VAN DE UNIVERSELE BODEM -- een gratis account mag, mits RTG het
   paspoort heeft gezien.

   SAMENLEVING.md par. 2 noemt zeven werkwoorden die voor niemand achter
   betaling mogen verdwijnen, en `hulp vinden` is er een van. De nulmeting
   (scripts/onvervreemdbaar.js) vond drie handelingen in dat werkwoord die een
   RTG Community-lid weigerden met "Alleen voor leden": een afspraak bij de
   gemeente, aangifte bij de overheid en een zorgintake delen. Dat zijn geen
   commerciele functies maar wegen naar een instantie.

   HET BESLUIT (27 september 2026): die drie gaan open voor een gratis account,
   maar pas NA een paspoortcontrole. Dat is geen tweede identiteitsregel: het
   is `idGeverifieerd()` uit server/server.js -- een account waarvan RTG het
   identiteitsbewijs werkelijk heeft gezien -- dezelfde vraag die de bar stelt
   voor alcohol. SAM-04 staat erboven: identiteit begrenst de HANDELING (namens
   uzelf iets bij een instantie in gang zetten), niet het mens-zijn; het
   bekijken van dezelfde loketten blijft zonder controle open.

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. EEN BETAALDE PAS VERANDERT NIET. Wie vandaag met een pas binnenkomt, komt
      morgen net zo binnen. Deze deur maakt de bodem breder en maakt niemand
      anders smaller -- een reparatie die een betalend lid een nieuwe eis
      oplegt, zou een tweede besluit verstoppen in een eerste.
   2. EEN BEZOEKER ZONDER ACCOUNT BLIJFT BUITEN. Zonder account is er niemand
      om een afspraak op te zetten, en `idGeverifieerd` zegt dan altijd nee.
   3. ELKE WEIGERING ZEGT HOE HET WEL KAN (SAM-04), in `hoe`, en nooit alleen
      "nee". */
'use strict';

function maakPaspoortdeur({ idGeverifieerd }) {
  if (typeof idGeverifieerd !== 'function') {
    throw new Error('kern/onvervreemdbaar: idGeverifieerd ontbreekt -- zonder de paspoortvraag kan deze deur alleen alles of niets');
  }
  return function paspoortdeur(req, res) {
    const s = req.session || {};
    if (s.tier !== 'guest') return true;
    if (!s.account) {
      res.status(403).json({ error: 'Hiervoor is een gratis account nodig.',
        hoe: 'Maak een gratis RTG-account aan en laat uw paspoort controleren; een pas is niet nodig.' });
      return false;
    }
    if (!idGeverifieerd(s)) {
      res.status(403).json({ error: 'Dit kan met een gratis account zodra RTG uw paspoort heeft gezien.',
        hoe: 'Upload uw paspoort en een selfie bij Identiteitsverificatie; na de controle staat dit voor u open.' });
      return false;
    }
    return true;
  };
}

module.exports = { maakPaspoortdeur };
