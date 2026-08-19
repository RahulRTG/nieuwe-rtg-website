  /* Afgesplitst van app-main-24a2.js toen dat over de 10 KB ging. De snede loopt
     langs een echte grens, en het is dezelfde grens waar WERELDEN.md over gaat:
     hierboven staat WAAR iets is (de werelden), hier staat WIE het mag zien (de
     pas). Wereld en pas zijn twee loodrechte assen; ze horen niet in hetzelfde
     bestand omdat ze toevallig allebei over tegels gaan. */

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt.

     LET OP DE KORREL, want dit is de tweede plek waar staat wat een pas krijgt.
     De server kent 190 functieschakelaars met doelgroepen
     (server/functies/register), deze set kent veertien APP-sleutels en kent
     geen verschil tussen Lifestyle en Business. Die twee weten niets van
     elkaar; scripts/groepen.js legt ze in GROEPEN.md naast elkaar in plaats van
     te doen alsof er een is. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';
