  /* Afgesplitst van app-main-24a2.js toen dat over de 10 KB ging. De snede loopt
     langs een echte grens, en het is dezelfde grens waar WERELDEN.md over gaat:
     hierboven staat WAAR iets is (de werelden), hier staat WIE het mag zien (de
     pas). Wereld en pas zijn twee loodrechte assen; ze horen niet in hetzelfde
     bestand omdat ze toevallig allebei over tegels gaan. */

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt.

     DIT IS DE TWEEDE PLEK WAAR STAAT WAT EEN PAS KRIJGT, en sinds vandaag
     weten die twee van elkaar. De server weigert /api/member/rechterhand aan
     wie geen Lifestyle of Business heeft; dezelfde veertien sleutels staan als
     `apps` op de functie `rechterhand` in het register, en
     test/wereldregister.test.js legt ze naast deze set. Wie er een vijftiende
     bij zet, zet hem op beide plekken of de bouw zakt.

     De korrel blijft wel verschillen, en dat is geen slordigheid: de server
     schakelt op FUNCTIE en per doelgroep, deze set verbergt APPS en kent geen
     verschil tussen Lifestyle en Business. Wat ze nu delen is de inhoud, niet
     de vorm. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';
