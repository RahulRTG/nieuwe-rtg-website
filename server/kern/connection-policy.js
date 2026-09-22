/* CONNECTION OS -- het machineleesbare capabilitycontract.

   Dit bestand maakt geen nieuwe datingbackend. Het formaliseert de voordeuren
   die Vonk en Rendez-vous al hebben. De productkernen blijven eigenaar van hun
   eigen semantiek: een wederzijdse match, een blinde keuze en twee akkoorden
   worden nog steeds daar bewezen waar de gegevens wonen.

   Vijf wetten zijn hier uitvoerbaar gemaakt:
   - capability is niet hetzelfde als permission;
   - onbekend of niet expliciet geopend is dicht;
   - een geblokkeerde relatie is dicht, behalve de veiligheidsactie zelf;
   - Rahul erft uitsluitend de beslissing van het lid namens wie hij handelt;
   - niet-gebouwde functies staan in het register maar zijn in elk product dicht.

   `domainState` in het JSON-contract noemt de tweede, domeineigen poort. De
   routelaag beoordeelt account/pas/identiteit/leeftijd; de bestaande kerncode
   beoordeelt bijvoorbeeld match, uitnodiging en dubbel akkoord. Zo ontstaat
   geen tweede kopie van die waarheid. */
'use strict';

const CONTRACT = require('./connection-policy.json');

const REDENEN = Object.freeze({
  PRODUCT_UNKNOWN: 'Dit Connection-product bestaat niet.',
  CAPABILITY_UNKNOWN: 'Deze Connection-functie bestaat niet.',
  NOT_IMPLEMENTED: 'Deze functie is nog niet volledig gebouwd.',
  PRODUCT_DENY: 'Deze functie is niet geopend voor dit product.',
  ACTOR_DENY: 'Deze actor mag deze functie niet gebruiken.',
  PASS_REQUIRED: 'Voor deze functie is een geldige pas nodig.',
  IDENTITY_REQUIRED: 'Verifieer eerst uw identiteit.',
  AGE_REQUIRED: 'Deze functie is uitsluitend voor geverifieerde leden van 18 jaar en ouder.',
  BLOCKED: 'Dit contact is geblokkeerd.',
  RAHUL_DENY: 'Rahul heeft hier niet meer rechten dan het lid.'
});

function weiger(code, extra) {
  return { allow: false, code, reden: REDENEN[code], ...(extra || {}) };
}

function pasOpen(product, pas) {
  if (!product) return false;
  if (product.passes.includes('member')) return !!pas && pas !== 'guest';
  return product.passes.includes(String(pas || ''));
}

function projectieVan(product, capability, actor, capabilityContract) {
  const regel = product && product.projections && product.projections[capability];
  if (typeof regel === 'string') return regel;
  if (regel && typeof regel === 'object') return regel[actor] || null;
  return capabilityContract && capabilityContract.projection || null;
}

function beslis({ actor, product, capability, state, _delegated }) {
  const p = CONTRACT.products[product];
  if (!p) return weiger('PRODUCT_UNKNOWN');
  const c = CONTRACT.capabilities[capability];
  if (!c) return weiger('CAPABILITY_UNKNOWN');
  if (!c.implemented) return weiger('NOT_IMPLEMENTED');
  const actors = p.capabilities[capability];
  if (!actors) return weiger('PRODUCT_DENY');
  const s = state && typeof state === 'object' ? state : {};

  /* Een blokkade mag nooit worden omzeild via een andere capability. Alleen de
     blokkeerhandeling zelf blijft bereikbaar, zodat die veilig idempotent kan
     zijn. */
  if (s.blocked && capability !== 'connection.safety.block') return weiger('BLOCKED');

  if (!actors.includes(actor)) return weiger('ACTOR_DENY');
  const projection = projectieVan(p, capability, actor, c);
  if (actor === 'office') return { allow: true, code: 'ALLOW', domainState: c.domainState.slice(), projection };

  if (!pasOpen(p, s.pass)) return weiger('PASS_REQUIRED');
  if (!s.verified) return weiger('IDENTITY_REQUIRED');
  if (!s.adult) return weiger('AGE_REQUIRED');

  /* Rahul krijgt eerst zijn expliciete productregel en daarna exact dezelfde
     voordeurbeslissing als het lid. `_delegated` voorkomt recursie en is niet
     publiek nodig. */
  if (actor === 'rahul' && !_delegated) {
    const lid = beslis({ actor: 'member', product, capability, state: s, _delegated: true });
    if (!lid.allow) return weiger('RAHUL_DENY', { oorzaak: lid.code });
  }
  return { allow: true, code: 'ALLOW', domainState: c.domainState.slice(), projection };
}

function matrix() {
  const uit = [];
  for (const [product, p] of Object.entries(CONTRACT.products)) {
    for (const [capability, actors] of Object.entries(p.capabilities)) {
      const c = CONTRACT.capabilities[capability];
      for (const actor of actors) uit.push({ product, actor, capability,
        implemented: !!(c && c.implemented), passes: p.passes.slice(),
        domainState: c ? c.domainState.slice() : [], projection: projectieVan(p, capability, actor, c) });
    }
  }
  return uit;
}

module.exports = { CONTRACT, REDENEN, beslis, matrix };
