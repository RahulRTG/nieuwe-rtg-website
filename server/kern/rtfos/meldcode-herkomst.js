/* ============================================================================
   WAAR EEN MELDCODE-DOSSIER VANDAAN KOMT -- en wat er dan wel en niet meereist.

   Twee bronnen kunnen aanleiding zijn voor een meldcode-dossier:

     een HULPVRAAG      (kern/rtfos/casus.js) -- tijdens het werk aan iets anders
                        ziet een medewerker iets dat hij niet kan laten liggen;
     een BESCHERMZAAK   (kern/beschermzaak/) -- een zaak die als "geweld" begon
                        blijkt bij nader inzien HUISELIJK geweld te zijn, en dan
                        is er een wettelijke route die er eerst niet was.

   DE ENIGE ZIN DIE HIER TOE DOET: ER REIST EEN CODENAAM MEE EN VERDER NIETS.
   Geen omschrijving, geen aanleiding, geen veiligheidsantwoord, geen
   toestemming, geen overdrachtenlijst. Een meldcode-dossier is geen onderdeel
   van het hulpverleningsdossier en hoort er ook niet in te lekken -- die regel
   stond al in ./meldcode.js voor de hulpvraag, en hij geldt hier onverkort. Wie
   het volledige beeld nodig heeft, opent de zaak zelf, en dat laat een spoor na.

   DE TWEEDE GRENDEL IS DE AARD. Niet elke beschermzaak mag een meldcode worden.
   De wettelijke meldcode gaat over huiselijk geweld en kindermishandeling; een
   zaak over uitbuiting door een werkgever of een stalker buiten de huiselijke
   kring hoort daar niet in, hoe ernstig hij ook is. De omzetting weigert dan,
   met de reden erbij -- dezelfde redenering als bij het openen van een dossier
   zonder aard.

   WAT HIER MET OPZET NIET STAAT: een weg terug. Een meldcode wordt geen
   beschermzaak. De vijf stappen zijn beroepsstappen met een wettelijke grond;
   ze omzetten naar iets anders zou betekenen dat een lopende meldcode kan
   verdwijnen in een dossier met een kortere bewaartermijn. Dat is precies wat
   "niemand kan een dossier verwijderen" moet voorkomen.

   Afgesplitst uit ./meldcode.js op de 10 KB van keuringsregel 13, en dat kwam
   goed uit: de herkomstvraag verdient een eigen uitleg.
   ========================================================================== */
'use strict';

/* WAARVOOR EEN MELDCODE-DOSSIER IS, EN WAARVOOR NIET.

   De wettelijke meldcode gaat over huiselijk geweld en kindermishandeling.
   "Huiselijk geweld" is daarbij niet beperkt tot kinderen: partnergeweld,
   ouderenmishandeling en eergerelateerd geweld vallen eronder, en een volwassen
   slachtoffer hoort hier dus gewoon thuis.

   Wat er NIET onder valt is geweld en uitbuiting buiten de huiselijke kring:
   een werkgever die iemands paspoort houdt, mensenhandel, een stalker die geen
   familie is. Daar geldt geen meldplicht, gaat de route niet via Veilig Thuis,
   en past deze vijfstappenketen niet. Daarvoor is er sinds september 2026 de
   BESCHERMZAAK (server/kern/beschermzaak/), met een eigen keten en een eigen
   dataklasse.

   Deze lijst weigert dus niet om iemand weg te sturen maar om hem op de
   verkeerde rails te zetten -- en de weigering noemt de goede rails. Dat is het
   verschil met "dit is niets voor u" (FOUNDATION.md par. 5.3). */
const AARD = ['huiselijk-geweld', 'kindermishandeling'];

/* Welke aanleiding van een beschermzaak onder de meldcode valt, en als wat.
   Alles wat hier NIET staat, valt er niet onder -- de lijst is de grendel. */
const AARD_UIT_BESCHERMZAAK = {
  'huiselijk-geweld': 'huiselijk-geweld',
  'eergerelateerd': 'huiselijk-geweld',
  'kindveiligheid': 'kindermishandeling'
};

module.exports = (ctx) => {
  const { S } = ctx;

  /* De hulpvraag. Ongewijzigd overgenomen uit ./meldcode.js; alleen de plek is
     anders. */
  function vanCasus(casusId, stadId) {
    const c = S().casussen.find(x => x.id === String(casusId));
    if (!c || c.stad !== stadId) return { status: 404, error: 'Die hulpvraag hoort niet bij deze stad.' };
    return { ok: true, codenaam: c.codenaam };
  }

  /* De beschermzaak. Levert behalve de codenaam ook de AARD die eruit volgt,
     zodat de aanroeper hem niet zelf hoeft te kiezen -- en hem dus ook niet kan
     kiezen. Wie een uitbuitingszaak als "huiselijk geweld" zou willen
     doorzetten, komt hier niet langs. */
  function vanBeschermzaak(zaakId, stadId) {
    const rij = Array.isArray(S().beschermzaken) ? S().beschermzaken : [];
    const z = rij.find(x => x.id === String(zaakId));
    if (!z || z.stad !== stadId) return { status: 404, error: 'Die beschermzaak hoort niet bij deze stad.' };
    const aard = AARD_UIT_BESCHERMZAAK[z.aanleiding];
    if (!aard) {
      return { status: 400, error: 'Deze zaak gaat over "' + z.aanleiding + '", en dat valt niet onder de ' +
        'wettelijke meldcode. Die geldt voor huiselijk geweld en kindermishandeling. De zaak blijft staan ' +
        'waar hij staat; wat hier nodig is, is geen meldcode maar de route die bij deze aanleiding hoort.' };
    }
    return { ok: true, codenaam: z.codenaam, aard };
  }

  return { vanCasus, vanBeschermzaak, AARD, AARD_UIT_BESCHERMZAAK };
};
module.exports.AARD_UIT_BESCHERMZAAK = AARD_UIT_BESCHERMZAAK;
module.exports.AARD = AARD;
