/* Vertrouwde, vaste allowlist van bronnen voor de automatische regelwacht.
   Geen URL komt uit een aanvraag: dat houdt de ophaler buiten interne netten. */
'use strict';
const internationaal = require('./internationalehandel');
const B = internationaal.BRONNEN;
module.exports = Object.freeze([
  { id:'sancties_vn', naam:'VN geconsolideerde sanctielijst', url:'https://main.un.org/securitycouncil/en/rss-updates-unsc-consolidated-list', eisen:['sancties_vn'], marker:'Sanctions' },
  { id:'sancties_eu', naam:'EU sancties en geconsolideerde lijst', url:B.euSancties, eisen:['sancties_eu','lokale_handelsregels'], marker:'sanction' },
  { id:'dual_use', naam:'EU dual-use-exportcontrole', url:B.dualUse, eisen:['exportvergunning'], marker:'dual-use' },
  { id:'eori', naam:'EU EORI en douane', url:B.eori, eisen:['eori'], marker:'EORI' },
  { id:'vies', naam:'EU VIES-btw-validatie', url:B.vies, eisen:['vies'], marker:'VAT' },
  { id:'handel', naam:'EU Access2Markets', url:B.handel, eisen:['handelsscope','lokale_handelsregels','goederencode'], marker:'Access2Markets' },
  { id:'bris', naam:'EU/EEA ondernemingsregisters', url:B.bris, eisen:['handelsregister'], landen:[...internationaal.EU,'IS','LI','NO'], marker:'business register' },
  { id:'kvk', naam:'KVK Handelsregister', url:B.kvk, eisen:['kvk'], landen:['NL'], marker:'KVK' },
  { id:'uk_register', naam:'UK Companies House', url:B.uk, eisen:['handelsregister'], landen:['GB'], marker:'Companies House' },
  { id:'us_register', naam:'US officiële registratie-uitleg', url:B.us, eisen:['handelsregister'], landen:['US'], marker:'register' },
  { id:'jp_register', naam:'Japan Corporate Number-register', url:B.japan, eisen:['handelsregister'], landen:['JP'], marker:'Corporate Number' },
  { id:'stichting_kvk', naam:'KVK-regels voor stichtingen en UBO', url:'https://www.kvk.nl/inschrijven/inschrijven-stichting/', eisen:[], foundationEisen:['stichtingsregister','ubo','statuten_doel','bestuur'], marker:'stichting' },
  { id:'anbi', naam:'Belastingdienst ANBI-voorwaarden', url:'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/aan_welke_voorwaarden_moet_een_anbi_voldoen/', eisen:[], foundationEisen:['anbi','financien'], marker:'ANBI' },
  { id:'duo_brin', naam:'DUO basisgegevens onderwijsinstellingen', url:'https://duo.nl/open_onderwijsdata/onderwijs-algemeen/basisgegevens/basisgegevens-instellingen.jsp', eisen:[], foundationEisen:['brin'], marker:'Basisgegevens' },
  { id:'vog_vrijwilligers', naam:'Justis VOG voor vrijwilligers', url:'https://www.justis.nl/producten/verklaring-omtrent-het-gedrag/vog-voor-vrijwilligers-en-vrijwilligersorganisaties', eisen:[], foundationEisen:['vog','vogbeleid','gedragscode','referentie'], marker:'VOG' },
  { id:'privacy_kinderen', naam:'Autoriteit Persoonsgegevens · privacy op school', url:'https://www.autoriteitpersoonsgegevens.nl/themas/onderwijs/gebruik-van-persoonsgegevens-in-het-onderwijs/privacyregels-voor-scholen', eisen:[], foundationEisen:['privacy_kinderen','privacy','verwerkersafspraken'], marker:'privacy' }
]);
