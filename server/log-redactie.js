/* Centrale redactie voor console, foutbord en externe fouttracker. */
'use strict';

function geheimVrij(waarde) {
  return String(waarde == null ? '' : waarde)
    .replace(/\b(?:[A-Z0-9_-]{1,12}(?:\.|%2e))?[A-F0-9]{32,}\b/gi, '[GEHEIM]')
    .replace(/([?&#](?:code|token|secret|key|kassacode)=)[^&#\s]+/gi, '$1[GEHEIM]')
    .replace(/\b((?:kassa|kamer|groep|reis|deel|toegang|uitnodigings?)?code)\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[GEHEIM]')
    .replace(/(^|\s)Bearer\s+[^\s,;]+/gi, '$1Bearer [GEHEIM]')
    .replace(/\/werken\/[^/\s?#]+/gi, '/werken/:code')
    .replace(/\/api\/projectie\/[^/\s?#]+/gi, '/api/projectie/:credential');
}

function veiligeWaarde(waarde, diepte = 0) {
  if (typeof waarde === 'string') return geheimVrij(waarde);
  if (waarde == null || typeof waarde !== 'object' || diepte > 3) return waarde;
  if (Array.isArray(waarde)) return waarde.slice(0, 100).map(v => veiligeWaarde(v, diepte + 1));
  const uit = {};
  for (const [k, v] of Object.entries(waarde)) uit[k] = veiligeWaarde(v, diepte + 1);
  return uit;
}

function veiligeFout(err) {
  const bron = err instanceof Error ? err : new Error(String(err));
  const veilig = new Error(geheimVrij(bron.message));
  veilig.name = bron.name || 'Error';
  veilig.stack = geheimVrij(bron.stack || veilig.stack);
  if (bron.code != null) veilig.code = geheimVrij(bron.code);
  return veilig;
}

module.exports = { geheimVrij, veiligeWaarde, veiligeFout };
