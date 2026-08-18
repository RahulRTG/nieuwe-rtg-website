/* RTG iD, deel "claims": wat een dienst over dit lid te horen krijgt, en hoe
   hard dat is.

   Afgesplitst uit rtgid.js om dezelfde reden als ./rtgid-regie.js: dat bestand
   ging door de 10 KB van keuringsregel 13, en die grens is een dakpan die zegt
   dat er een tweede onderwerp in zit. Dat klopte hier. De koppelflow gaat over
   WIE er aanklopt en of het lid akkoord gaat; dit gaat over WAT er dan de deur
   uit mag en waar dat op rust. Twee vragen, twee bestanden.

   DE TWEE REGELS DIE DIT DEEL DRAAGT:

   1. SELECTIEVE DELING. Alleen de gevraagde attributen worden berekend en
      geleverd. 18plus is een AFGELEID bewijs: wie alleen hoeft te weten of
      iemand volwassen is, krijgt ja of nee en nooit de geboortedatum. Die
      verlaat de kluis hier niet, bij geen enkel niveau.

   2. EEN FEIT ZONDER HERKOMST IS EEN HALF FEIT. Elke leeftijdsclaim draagt
      `leeftijdBron`: 'paspoort' als de keurder de datum van het document heeft
      overgenomen, 'opgegeven' als hij nog is zoals het lid hem bij de
      aanmelding intypte. Dat verschil bestond wel in de gegevens en niet in het
      antwoord, en een slijterij die op 18plus afgaat kon het dus niet zien.
      Daarnaast draagt elk antwoord het betrouwbaarheidsniveau van het lid
      (kern/betrouwbaarheid.js) -- niet hoe oud iemand is, maar hoe zeker RTG
      weet dat hij het is.

   De gedeelde helpers komen via het context-object binnen, net als bij regie,
   zodat accountVanKey en de ledengids één bron van waarheid houden. */

'use strict';

const { niveauVan } = require('./betrouwbaarheid');

module.exports = (ctx) => {
  const { accounts, accountVanKey, codenaamUit, leeftijdVan } = ctx;

  const staatVan = key => {
    const u = accountVanKey(key);
    return { u, md: u ? (accounts.getMemberState(u.id) || {}) : {} };
  };

  /* Het betrouwbaarheidsniveau van dit lid. Er wordt niets nieuws gevraagd of
     bewaard: kern/betrouwbaarheid.js geeft alleen een naam aan de stand die het
     ledendossier al draagt. */
  function niveauVoor(key) {
    const { u, md } = staatVan(key);
    return niveauVan({ account: u, verified: u && u.verified, faceMatch: md.faceMatch });
  }

  function attributenVoor(key, gevraagd) {
    const { u, md } = staatVan(key);
    const geboren = md.geboren || null;
    const lft = geboren && typeof leeftijdVan === 'function' ? leeftijdVan(geboren) : null;
    const uit = { geverifieerd: !!(u && u.verified === 'verified'),
      betrouwbaarheid: niveauVan({ account: u, verified: u && u.verified, faceMatch: md.faceMatch }) };
    /* De herkomst reist alleen mee als er ook echt iets over leeftijd wordt
       gedeeld; anders krijgt een dienst die om een codenaam vraagt een veld
       over de leeftijd terug dat hij niet heeft gevraagd. */
    const leeftijdBron = md.geborenBron === 'paspoort' ? 'paspoort' : 'opgegeven';
    for (const a of gevraagd) {
      if (a === 'codenaam') uit.codenaam = codenaamUit(key);
      else if (a === '18plus') { uit['18plus'] = lft != null ? lft >= 18 : null; uit.leeftijdBron = leeftijdBron; }
      else if (a === 'leeftijd') { uit.leeftijd = lft; uit.leeftijdBron = leeftijdBron; }
      else if (a === 'nationaliteit') uit.nationaliteit = md.nationaliteit || null;
      else if (a === 'naam') uit.naam = u ? accounts.realNameOf(u) : null;
    }
    return uit;
  }

  return { niveauVoor, attributenVoor };
};
