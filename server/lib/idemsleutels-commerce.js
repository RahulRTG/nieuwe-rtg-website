/* Idempotentieverklaringen voor de samengevoegde App Store-, commerce-,
   navigatie- en retailroutes. Zie ./idemsleutels.js voor de vier vormen. */
'use strict';

const SLEUTELS = {
  /* App Store: de overzichten en proeven lezen; de overige routes zetten een
     aanwijsbare aanvraag, versie, intrekking of keuringsuitslag. */
  'POST /api/appstore/kantoor/toegankelijk': { zelfdeVerzoek: true },
  'POST /api/appstore/kantoor/toegankelijk/wachtrij': { leest: true },
  'POST /api/appstore/naslag': { leest: true },
  'POST /api/appstore/persoon': { leest: true },
  'POST /api/appstore/persoon/aanvraag': { zelfdeVerzoek: true },
  'POST /api/appstore/persoon/cijfers': { leest: true },
  'POST /api/appstore/persoon/dossier': { leest: true },
  'POST /api/appstore/persoon/intrekken': { zelfdeVerzoek: true },
  'POST /api/appstore/persoon/inzenden': { zelfdeVerzoek: true },
  'POST /api/appstore/persoon/journaal': { leest: true },
  'POST /api/appstore/persoon/naslag': { leest: true },
  'POST /api/appstore/persoon/omzet': { leest: true },
  'POST /api/appstore/persoon/proef': { leest: true },
  'POST /api/appstore/uitgever/cijfers': { leest: true },
  'POST /api/appstore/uitgever/journaal': { leest: true },

  /* De commerce-laag bevestigt noch betaalt. Alleen mand/zet kan bewust
     optellen: tweemaal `vervang:false` betekent echt tweemaal erbij. */
  'POST /api/commerce/aanbod': { leest: true },
  'POST /api/commerce/etalage': { leest: true },
  'POST /api/commerce/mand': { leest: true },
  'POST /api/commerce/mand/leeg': { zelfdeVerzoek: true },
  'POST /api/commerce/mand/zet': { nietIdempotent: true,
    waarom: 'met vervang:false telt ieder verzoek het genoemde aantal bij de bestaande mandregel op; ' +
      'twee bewuste drukken zijn daarom twee toevoegingen en mogen niet stil worden samengevoegd' },
  'POST /api/commerce/overdracht/lees': { zelfdeVerzoek: true },
  'POST /api/commerce/overdracht/maak': { zelfdeVerzoek: true },
  'POST /api/commerce/overdracht/mijn': { leest: true },
  'POST /api/commerce/reken': { leest: true },
  'POST /api/commerce/retour/mijn': { leest: true },
  'POST /api/commerce/retour/verstuurd': { zelfdeVerzoek: true },
  'POST /api/commerce/retour/vraag': { zelfdeVerzoek: true },

  /* Een passkey-optie maakt juist een verse, eenmalige ceremonie. */
  'POST /api/member/pin/actie/opties': { nietIdempotent: true,
    waarom: 'iedere aanvraag maakt een verse action-bound passkeychallenge; een eerdere challenge ' +
      'hergebruiken zou de nieuwe beveiligingsceremonie onterecht overslaan' },

  'POST /api/nav/status': { leest: true },
  'POST /api/supplier/nav/event': { zelfdeVerzoek: true },
  'POST /api/supplier/nav/events': { leest: true },

  'POST /api/supplier/retail/annuleer': { zelfdeVerzoek: true },
  'POST /api/supplier/retail/bon': { leest: true },
  'POST /api/supplier/retour/lijst': { leest: true },
  'POST /api/supplier/retour/uitvoeren': { zelfdeVerzoek: true },
  'POST /api/supplier/retour/zet': { zelfdeVerzoek: true },
  'POST /api/supplier/verkoopweg/lijst': { leest: true },
  'POST /api/supplier/verkoopweg/publiceer': { zelfdeVerzoek: true },
  'POST /api/supplier/verkoopweg/wis': { zelfdeVerzoek: true },
  'POST /api/supplier/verkoopweg/zet': { zelfdeVerzoek: true }
};

module.exports = { SLEUTELS };
