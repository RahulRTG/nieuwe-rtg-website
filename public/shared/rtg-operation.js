/* Transport en status hebben aparte verantwoordelijkheden. Een antwoord van
   HTTP is geen domeinbevestiging; alleen de aanroepende route kan die geven. */
(function (g, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGOperation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var LABELS = Object.freeze({ local: 'Lokaal verwerkt', sent: 'Verzonden',
    confirmed: 'Bevestigd', waiting: 'Wacht op bron', failed: 'Mislukt', reverted: 'Teruggedraaid' });
  var RISKS = ['financial', 'legal', 'identity', 'authority'];
  function state(element, next, evidence) {
    if (!element || !Object.prototype.hasOwnProperty.call(LABELS, next)) return false;
    evidence = evidence || {};
    var risk = element.getAttribute('data-rtg-operation-risk');
    if (next === 'local' && RISKS.indexOf(risk) >= 0) return false;
    if ((next === 'confirmed' || next === 'reverted') &&
        !(evidence.confirmed === true && typeof evidence.source === 'string' && evidence.source.trim())) return false;
    element.setAttribute('data-rtg-operation-state', next);
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    element.textContent = LABELS[next] + (evidence.message ? ' · ' + evidence.message : '');
    if (evidence.source) element.setAttribute('data-rtg-operation-source', evidence.source);
    else element.removeAttribute('data-rtg-operation-source');
    return true;
  }
  async function requestJson(fetcher, url, options) {
    try {
      var response = await fetcher(url, options), body;
      try { body = await response.json(); }
      catch (e) { return { status: response.status, body: { error: 'Geen leesbare bevestiging ontvangen. Uw invoer blijft staan.' }, confirmed: false }; }
      if (!body || typeof body !== 'object' || Array.isArray(body)) body = { error: 'Geen geldige bevestiging ontvangen. Uw invoer blijft staan.' };
      if (!response.ok && !body.error) body.error = 'Niet bevestigd door de server. Uw invoer blijft staan.';
      return { status: response.status, body: body, confirmed: false };
    } catch (e) {
      return { status: 0, body: { error: 'Verbinding onderbroken. Controleer de stand voordat u opnieuw verstuurt. Uw invoer blijft staan.' }, confirmed: false };
    }
  }
  return Object.freeze({ LABELS: LABELS, setState: state, requestJson: requestJson });
}));
