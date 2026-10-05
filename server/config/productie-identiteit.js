'use strict';

function keurIdentiteit(env, fouten) {
  const eigenaar = String(env.RTG_OWNER_EMAIL || '').trim().toLowerCase();
  if (eigenaar === 'rahul@rtg.example')
    fouten.push('RTG_OWNER_EMAIL staat op het voorbeeldadres. Zet het echte e-mailadres van de eigenaar.');
  else if (!eigenaar)
    fouten.push('RTG_OWNER_EMAIL ontbreekt. In productie geldt de ingebouwde standaard uit server/eigenaar.js niet: zet het echte e-mailadres van de eigenaar.');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eigenaar))
    fouten.push('RTG_OWNER_EMAIL is geen geldig e-mailadres; de eigenaar moet herstel- en veiligheidsberichten werkelijk kunnen ontvangen.');
  if (env.RTG_ISOLATIE_AFDWINGEN !== '1')
    fouten.push('RTG_ISOLATIE_AFDWINGEN=1 ontbreekt: persoonlijke isolatie zou alleen meten en gewone HTTP-verzoeken niet blokkeren. Productie vereist actieve handhaving.');
  /* OFFICE_CODE en OFFICE_TOTP_SECRET zijn sinds 4 oktober 2026 GEEN eis meer
     (besluit van de eigenaar): in productie opent de gedeelde kantoorcode niets
     (B10, kern/kantoor/productiedeur.js) en gebruikt het koppelen van een
     uitnodiging de TOTP niet (B24, kern/eenaccount/koppelen.js). Een eis op een
     geheim dat niets opent, is een ritueel. Staan ze toch gezet, dan negeert de
     server ze en zegt hij dat in een regel (opzet/startcontrole.js). */
}

module.exports = { keurIdentiteit };
