/* ============================================================================
   De vorm van SCIM: hoe een gebruiker, een lijst en een fout eruitzien volgens
   RFC 7643/7644. Puur vertaalwerk tussen ons account en wat de IdP verwacht.

   WAT ER MET OPZET NIET IN ZIT

   SCIM staat toe dat je vrijwel elk veld teruggeeft dat je hebt. Wij geven het
   minimum: id, userName, e-mail, actief, en de weergavenaam. Geen telefoon,
   geen adres, geen pas, geen codenaam, geen boekingen.

   Dat is geen luiheid. De IdP van een klant is een ANDER systeem, met andere
   beheerders en een eigen logboek. Alles wat we hier meesturen, ligt daarna ook
   daar -- en gegevensminimalisering (AVG art. 5(1)(c)) is geen wens maar een
   verplichting. De klant heeft niets aan onze codenaam, en de codenaam is juist
   het ding dat het hele ontwerp beschermt.

   De externalId slaan we op noch geven we terug: die is van de IdP.
   ========================================================================== */
'use strict';

const SCHEMA_USER = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCHEMA_LIJST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCHEMA_FOUT = 'urn:ietf:params:scim:api:messages:2.0:Error';
const SCHEMA_PATCH = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

/* Een account als SCIM-gebruiker. `email` komt uit de kluis en wordt hier
   alleen doorgegeven -- de aanroeper bepaalt of hij hem mag zien. */
function gebruiker(u, email, basis) {
  return {
    schemas: [SCHEMA_USER],
    id: String(u.id),
    userName: email || String(u.id),
    active: u.actief !== 0,
    name: { formatted: undefined },
    emails: email ? [{ value: email, primary: true, type: 'work' }] : [],
    meta: {
      resourceType: 'User',
      created: u.created_at,
      location: (basis || '') + '/Users/' + u.id
    }
  };
}

function lijst(bronnen, { start, aantal, totaal }) {
  return {
    schemas: [SCHEMA_LIJST],
    totalResults: totaal,
    startIndex: start,
    itemsPerPage: bronnen.length,
    Resources: bronnen
  };
}

/* SCIM wil fouten in zijn eigen envelop; een gewone {error:...} laat een IdP
   vaak stilvallen met "onbekend antwoord" in plaats van een leesbare melding
   voor de beheerder die het probleem moet oplossen. */
function fout(status, detail, type) {
  const o = { schemas: [SCHEMA_FOUT], status: String(status), detail: String(detail) };
  if (type) o.scimType = type;
  return o;
}

/* Wat wij kunnen, in het formaat waarin een IdP het uitleest. Eerlijk zijn is
   hier praktisch: zegt een provider-config dat je iets kunt wat je niet kunt,
   dan loopt de eerste synchronisatie stuk op een plek waar niemand kijkt. */
function providerConfig(basis) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: (basis || '') + '/docs',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },   // wachtwoorden lopen niet via SCIM
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{
      type: 'oauthbearertoken', name: 'Bearer-token',
      description: 'Een SCIM-sleutel per organisatie, uitgegeven door RTG.',
      primary: true
    }],
    meta: { resourceType: 'ServiceProviderConfig', location: (basis || '') + '/ServiceProviderConfig' }
  };
}

function resourceTypes(basis) {
  return lijst([{
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'User', name: 'User', endpoint: '/Users', schema: SCHEMA_USER,
    meta: { resourceType: 'ResourceType', location: (basis || '') + '/ResourceTypes/User' }
  }], { start: 1, aantal: 1, totaal: 1 });
}

/* Alleen de attributen die we echt ondersteunen. */
function schemas(basis) {
  return lijst([{
    id: SCHEMA_USER, name: 'User', description: 'RTG-account',
    attributes: [
      { name: 'userName', type: 'string', required: true, uniqueness: 'server', mutability: 'readWrite' },
      { name: 'active', type: 'boolean', required: false, mutability: 'readWrite' },
      { name: 'emails', type: 'complex', multiValued: true, required: false, mutability: 'readWrite' }
    ],
    meta: { resourceType: 'Schema', location: (basis || '') + '/Schemas/' + SCHEMA_USER }
  }], { start: 1, aantal: 1, totaal: 1 });
}

module.exports = { gebruiker, lijst, fout, providerConfig, resourceTypes, schemas,
  SCHEMA_USER, SCHEMA_LIJST, SCHEMA_FOUT, SCHEMA_PATCH };
