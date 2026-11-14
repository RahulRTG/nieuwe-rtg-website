/* De bureau-eigenaar geeft de dienst door; de abonnementsbron beslist laat,
   zodat de montagevolgorde geen toegangsbesluit vastlegt. Geen body-account. */
'use strict';
module.exports = kern => (key, dienst) => {
  const id = /^user-([1-9][0-9]*)$/.exec(key);
  return !id || kern.aanmeldingen?.automatisch?.magDienst(Number(id[1]), dienst) !== false;
};
