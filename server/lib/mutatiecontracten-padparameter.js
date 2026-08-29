/* ============================================================================
   MUTATIECONTRACTEN -- DE TIEN MET EEN PAD-PARAMETER.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   WAAROM DEZE TIEN APART STAAN. De idemproef slaat elk pad met een parameter
   over (`/api/x/:id`), en dat is geen slordigheid: zo'n pad is geen adres maar
   een VORM. Er een verzinnen levert een 404 op die niets meet -- en een 404 die
   als "geen werk gedaan" in het register belandt, leest hetzelfde als een route
   die werkelijk niets doet.

   Ze zijn dus niet gemeten, en daarmee is LEGACY hier de eerlijke stand... maar
   niet de nuttige. BLOCKED_BY_TEST_FIXTURE zegt hetzelfde ("wij weten het niet")
   en voegt toe WAT ER MOET KOMEN. Voor deze tien is dat per stuk bekend, want ze
   zijn gelezen -- en bij vier ervan bestaat de helft van de opstelling al.

   HERKOMST 'mens' EN NIET 'afgeleid'. De afleidgang schrijft alleen routes uit
   die een gemeten HINDERNIS hebben; deze hebben er geen, want ze zijn nooit
   aangeroepen. Wat hier staat komt uit het lezen van de handler, en dat is
   mensenwerk.

   DE OPSTELLING DIE ZE ALLEMAAL NODIG HEBBEN is dezelfde die CREATE.md par. 10
   en MUTATIECONTRACT.md par. 8 beschrijven: eerst een object maken, dan zijn
   eigen id invullen. Zolang die niet bestaat, blijft dit een wachtrij met een
   adres -- en dat is beter dan tien regels onder LEGACY.
   ========================================================================== */
'use strict';

/* De vorm is voor alle tien gelijk; alleen het werk verschilt. */
const geblokkeerd = (route, mutatieId, toegang, watErMoetKomen) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'onbekend' },
  toegang,
  stand: 'BLOCKED_BY_TEST_FIXTURE',
  watErMoetKomen
}];

const SCIM = { klasse: 'SERVICE_TO_SERVICE' };
const KANTOOR = { klasse: 'AUTHENTICATED' };

/* De SCIM-kant is het dichtst bij: scripts/lib/proefsleutels.js DRAAIT al een
   SCIM-sleutel (een SSO-koppeling zetten, dan de sleutel draaien). Wat ontbreekt
   is de tweede helft -- eerst een gebruiker of groep AANMAKEN via POST
   /api/scim/v2/Users, en dan het id uit dat antwoord in het pad zetten. */
const SCIM_WERK = 'de proefopstelling heeft de SCIM-sleutel al (proefsleutels.js draait er een). ' +
  'Wat ontbreekt: eerst een %s aanmaken via POST /api/scim/v2/%s en het id uit dat antwoord in het ' +
  'pad zetten. Zolang dat niet gebeurt, is elk id verzonnen en meet een 404 niets.';

const CONTRACTEN = Object.fromEntries([
  geblokkeerd('PUT /api/scim/v2/Users/:id', 'scim.v2.Users.id', SCIM, SCIM_WERK.replace('%s', 'gebruiker').replace('%s', 'Users')),
  geblokkeerd('PATCH /api/scim/v2/Users/:id', 'scim.v2.Users.id', SCIM, SCIM_WERK.replace('%s', 'gebruiker').replace('%s', 'Users')),
  geblokkeerd('DELETE /api/scim/v2/Users/:id', 'scim.v2.Users.id', SCIM, SCIM_WERK.replace('%s', 'gebruiker').replace('%s', 'Users')),
  geblokkeerd('PUT /api/scim/v2/Groups/:id', 'scim.v2.Groups.id', SCIM, SCIM_WERK.replace('%s', 'groep').replace('%s', 'Groups')),
  geblokkeerd('PATCH /api/scim/v2/Groups/:id', 'scim.v2.Groups.id', SCIM, SCIM_WERK.replace('%s', 'groep').replace('%s', 'Groups')),
  geblokkeerd('DELETE /api/scim/v2/Groups/:id', 'scim.v2.Groups.id', SCIM, SCIM_WERK.replace('%s', 'groep').replace('%s', 'Groups')),

  /* Deze twee zijn het goedkoopst: scripts/lib/idemwereld.js maakt tijdens de
     schoolketen al een SSO-koppeling aan met org 'proefkoppeling'. Die org in
     het pad zetten is genoeg -- maar let op de volgorde, want beide zijn
     WISSERS: de sleutel eerst, de koppeling daarna, anders is er bij de tweede
     niets meer te wissen en meet die een 404. */
  geblokkeerd('DELETE /api/techniek/sso/scimsleutel/:org', 'techniek.sso.scimsleutel.org', KANTOOR,
    "scripts/lib/idemwereld.js maakt al een SSO-koppeling met org 'proefkoppeling'. Die org in het pad " +
    'zetten volstaat. Let op de volgorde: eerst deze (de sleutel), daarna de koppeling -- andersom is er ' +
    'bij de tweede niets meer te wissen en meet die een 404 in plaats van een handeling.'),
  geblokkeerd('DELETE /api/techniek/sso/:org', 'techniek.sso.org', KANTOOR,
    "dezelfde 'proefkoppeling' uit idemwereld.js, en als LAATSTE van de twee wissers -- zie hierboven. " +
    'Daarna bestaat de koppeling niet meer, dus de schoolketen die er in dezelfde ronde op leunt, moet ' +
    'ervoor draaien.'),

  geblokkeerd('POST /api/theater/upload/:id', 'theater.upload.id', KANTOOR,
    'een theaterproductie met een id, aangemaakt via de gewone route, en daarna een upload met dat id. ' +
    'Dit is de enige van de tien waar de wereld nog helemaal moet worden gebouwd.'),

  /* De vreemde eend, en die verdient zijn eigen zin: `:actie` is GEEN object-id
     maar een handelingsnaam. Er is dus niets aan te maken -- de opstelling moet
     de geldige waarden kennen, en die staan in de handler. Dat is een ander soort
     werk dan een fixture, en het staat hier zodat niemand hem bij de andere negen
     indeelt en zich afvraagt welk object hij mist. */
  geblokkeerd('POST /api/cluster/:actie', 'cluster.actie', { klasse: 'SYSTEM_INTERNAL' },
    'GEEN fixture maar een lijst: `:actie` is een handelingsnaam en geen object-id. De opstelling moet ' +
    'de geldige acties uit de handler kennen en ze een voor een aanroepen. Zolang dat niet gebeurt, ' +
    'is deze route niet ongemeten omdat er iets ontbreekt, maar omdat er niets is om aan te maken.')
]);

module.exports = { CONTRACTEN };
