/* Alleen lezen via de bestaande tenantopslag. Een ontbrekende collectie wordt
   niet aangemaakt; een dubbele binding wordt niet met de eerste rij opgelost. */
'use strict';
module.exports = ({ db }) => {
  const opslag = require('./opslag')({ db });
  const norm = c => String(c || '').trim().toUpperCase();
  const alle = () => Object.values(opslag.tenantsKijk()).filter(t => t && typeof t === 'object');
  function haal(org) {
    const code = norm(org), pot = opslag.tenantsKijk(), rows = alle().filter(t => t.org === code);
    return /^[A-Z0-9][A-Z0-9-]{1,30}$/.test(code) && Object.hasOwn(pot, code) &&
      rows.length === 1 && pot[code] === rows[0] ? rows[0] : null;
  }
  function van(veld, code) {
    const c = norm(code), rows = alle().filter(t => Array.isArray(t[veld]) && t[veld].includes(c));
    return rows.length === 1 && haal(rows[0].org) === rows[0] ? rows[0] : null;
  }
  return { haal, vanZaak: code => van('zaken', code), vanWerkruimte: code => van('werkruimtes', code),
    alle: () => alle().slice() };
};
