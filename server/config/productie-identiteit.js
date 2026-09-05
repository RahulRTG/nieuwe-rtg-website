'use strict';

function keurIdentiteit(env, fouten) {
  const eigenaar = String(env.RTG_OWNER_EMAIL || '').trim().toLowerCase();
  if (eigenaar === 'rahul@rtg.example')
    fouten.push('RTG_OWNER_EMAIL staat op het voorbeeldadres. Zet het echte e-mailadres van de eigenaar.');
  else if (!eigenaar)
    fouten.push('RTG_OWNER_EMAIL ontbreekt. In productie geldt de ingebouwde standaard uit server/eigenaar.js niet: zet het echte e-mailadres van de eigenaar.');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eigenaar))
    fouten.push('RTG_OWNER_EMAIL is geen geldig e-mailadres; de eigenaar moet herstel- en veiligheidsberichten werkelijk kunnen ontvangen.');
  if (!env.OFFICE_CODE)
    fouten.push('OFFICE_CODE ontbreekt: een per-proces willekeurige code is na herstart en tussen instances niet bruikbaar. Zet een gedeeld geheim uit de secrets manager.');
  else if (env.OFFICE_CODE.length < 12)
    fouten.push('OFFICE_CODE is te kort; gebruik minstens 12 willekeurige tekens naast de verplichte TOTP.');
  if (env.RTG_ISOLATIE_AFDWINGEN !== '1')
    fouten.push('RTG_ISOLATIE_AFDWINGEN=1 ontbreekt: persoonlijke isolatie zou alleen meten en gewone HTTP-verzoeken niet blokkeren. Productie vereist actieve handhaving.');
  if (!env.OFFICE_TOTP_SECRET)
    fouten.push('OFFICE_TOTP_SECRET ontbreekt: dan staat de backoffice (auditlog, tijdlijn met codenamen, export) achter alleen de statische OFFICE_CODE. Zet een base32-geheim en koppel een authenticator-app.');
  else if (String(env.OFFICE_TOTP_SECRET).toUpperCase().replace(/[^A-Z2-7]/g, '').length < 16)
    fouten.push('OFFICE_TOTP_SECRET is te kort om een tweede factor te zijn: na het weglaten van niet-base32-tekens blijven er minder dan 16 over. Maak er een van 32 tekens (A-Z en 2-7).');
}

module.exports = { keurIdentiteit };
