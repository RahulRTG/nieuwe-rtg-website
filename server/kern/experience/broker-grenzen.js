/* De drie grenzen vóór een Experience-runtime: de gekozen context behoort aan
   deze actor en wereld, de context draagt alle vereiste bevoegdheden en de
   intentie bevat haar verplichte velden. Geen van deze controles muteert. */
'use strict';

function fout(error, status, code, extra) { return { error, status, code, ...(extra || {}) }; }

module.exports = function maakBrokerGrenzen({ contexten }) {
  function contextVoor(key, world, contextId) {
    const context = contexten.kies(key, world, contextId);
    if (!context || (contextId && context.id !== contextId))
      return fout('Deze context hoort niet bij deze gebruiker en wereld.', 403, 'CONTEXT_NOT_ALLOWED');
    return context;
  }

  function bevoegd(context, definition) {
    const scope = new Set(context.authorityScope || []);
    const mist = (definition.authority || []).filter(a => !scope.has(a));
    return mist.length ? fout('Deze context geeft geen bevoegdheid voor de actie.', 403,
      'AUTHORITY_DENIED', { requiredAuthority: mist }) : null;
  }

  function velden(definition, parameters) {
    const p = parameters || {};
    for (const naam of definition.required) if (p[naam] == null || p[naam] === '')
      return fout('Verplicht veld ontbreekt: ' + naam + '.', 400, 'INVALID_INPUT');
    return null;
  }

  return Object.freeze({ contextVoor, bevoegd, velden });
};
