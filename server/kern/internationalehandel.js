/* Wereldwijde bedrijfstoelating voor WORK. Er bestaat geen wereldwijd KVK:
   de rechtspersoon wordt daarom in het officiele register van het
   vestigingsland gecontroleerd. Grenshandel krijgt daar bovenop een apart
   dossier voor sancties, btw, douane, goederenindeling en exportcontrole. */
'use strict';

const { LANDEN } = require('./fiscaal/landen');

const BRONNEN = Object.freeze({
  kvk: 'https://www.kvk.nl/zoeken/',
  bris: 'https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-search-company-eu/general-information-find-company_en',
  uk: 'https://find-and-update.company-information.service.gov.uk/',
  us: 'https://www.sba.gov/business-guide/launch-your-business/register-your-business',
  japan: 'https://www.houjin-bangou.nta.go.jp/en/',
  vies: 'https://ec.europa.eu/taxation_customs/vies/',
  eori: 'https://taxation-customs.ec.europa.eu/customs/customs-procedures-import-and-export/customs-operations/economic-operators-registration-and-identification-number-eori_en',
  handel: 'https://trade.ec.europa.eu/access-to-markets/en/home',
  euSancties: 'https://finance.ec.europa.eu/eu-and-world/sanctions-restrictive-measures/overview-sanctions-and-related-resources_en',
  vnSancties: 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list',
  dualUse: 'https://policy.trade.ec.europa.eu/help-exporters-and-importers/exporting-dual-use-items_en',
  ofac: 'https://ofac.treasury.gov/sanctions-list-search-tool'
});

const EU = new Set(('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE').split(' '));
const BRIS = new Set([...EU, 'IS', 'LI', 'NO']);
const GEREGULEERD = new Set(['restaurant', 'bar', 'club', 'beachclub', 'koffie', 'chef',
  'taxi', 'zorg', 'care', 'ziekenhuis', 'huisarts', 'specialist', 'tandarts', 'apotheek',
  'kinderopvang', 'beveiliging', 'verzekeringen', 'beautymedical']);

const HANDELSEISEN = Object.freeze({
  sancties_vn: { label: 'Bedrijf, bestuurders en uiteindelijk belanghebbenden tegen de VN-sanctielijst gecontroleerd', bron: 'VN-Veiligheidsraad', url: BRONNEN.vnSancties, aanvrager: false },
  sancties_eu: { label: 'Bedrijf, bestuurders en uiteindelijk belanghebbenden tegen actuele EU-sancties gecontroleerd', bron: 'Europese Commissie', url: BRONNEN.euSancties, aanvrager: false },
  handelsscope: { label: 'Landen, producten, oorsprong, bestemming, invoerrechten en productvereisten beoordeeld', bron: 'EU Access2Markets en bevoegde nationale instanties', url: BRONNEN.handel, aanvrager: false },
  lokale_handelsregels: { label: 'Lokale handels-, import-, export- en sanctieregels per betrokken land beoordeeld', bron: 'Bevoegde instanties in oorsprongs- en bestemmingsland', url: BRONNEN.handel, aanvrager: false },
  vies: { label: 'Geldig EU-btw-nummer voor grensoverschrijdende B2B-handel', bron: 'VIES van de Europese Commissie', url: BRONNEN.vies, aanvrager: true },
  eori: { label: 'Geldig EORI-nummer voor douanehandelingen in de EU', bron: 'EU EORI-validatie / nationale douane', url: BRONNEN.eori, aanvrager: true },
  goederencode: { label: 'Productassortiment met HS/GN-goederencodes en landen van oorsprong en bestemming', bron: 'EU Access2Markets', url: BRONNEN.handel, aanvrager: true },
  exportvergunning: { label: 'Exportvergunning of officiële beoordeling voor dual-use of andere gecontroleerde goederen', bron: 'Bevoegde exportautoriteit en EU Dual-use-regime', url: BRONNEN.dualUse, aanvrager: true },
  ofac: { label: 'Amerikaanse sancties en toepasselijkheid vanwege een VS-aanknopingspunt gecontroleerd', bron: 'U.S. Treasury OFAC', url: BRONNEN.ofac, aanvrager: false },
  sector_lokaal: { label: 'Lokale sectorregistratie of vergunning voor de aangeboden activiteit en vestiging', bron: 'Bevoegde toezichthouder in het vestigingsland', url: null, aanvrager: true }
});

function aan(waarde) { return waarde === true || waarde === 'on'; }
function vlaggenUit(data) {
  const b = data || {};
  const goederen = aan(b.goederen), euBtw = aan(b.euBtw), douane = aan(b.douane);
  const gecontroleerdeGoederen = aan(b.gecontroleerdeGoederen), vsBetrokken = aan(b.vsBetrokken);
  return { internationaleHandel: aan(b.internationaleHandel) || goederen || euBtw || douane || gecontroleerdeGoederen || vsBetrokken,
    goederen, euBtw, douane, gecontroleerdeGoederen, vsBetrokken };
}

function landen() {
  return Object.entries(LANDEN).map(([code, d]) => ({ code, naam: d.naam, regio: d.regio || '' }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

function registerSuggestie(code) {
  const landCode = String(code || 'NL').toUpperCase();
  if (landCode === 'NL') return { naam: 'KVK Handelsregister', url: BRONNEN.kvk };
  if (landCode === 'GB') return { naam: 'Companies House', url: BRONNEN.uk };
  if (landCode === 'US') return { naam: 'Officieel register van de staat of het territorium', url: BRONNEN.us };
  if (landCode === 'JP') return { naam: 'National Tax Agency Corporate Number Publication Site', url: BRONNEN.japan };
  if (BRIS.has(landCode)) return { naam: 'EU/EEA Business Registers Interconnection System (BRIS)', url: BRONNEN.bris };
  return { naam: 'Officieel ondernemingsregister van het vestigingsland', url: '' };
}

function veiligeHttps(waarde) {
  try { const u = new URL(String(waarde || '').trim()); return u.protocol === 'https:' ? u.toString().slice(0, 240) : null; }
  catch (_) { return null; }
}

function registratieUit(data) {
  const b = data || {};
  const landCode = String(b.landCode || 'NL').trim().toUpperCase();
  const land = LANDEN[landCode];
  if (!land) return { error: 'Kies een geldig vestigingsland.' };
  const nummerRuw = String(b.registratieNummer || b.kvkNummer || '').trim().toUpperCase();
  const nummer = nummerRuw.replace(/\s+/g, ' ');
  const vestigingsnummer = String(b.vestigingsnummer || '').replace(/\D/g, '');
  const regioOfStaat = String(b.regioOfStaat || '').trim().slice(0, 80);
  if (landCode === 'NL' && !/^\d{8}$/.test(nummer.replace(/\D/g, '')))
    return { error: 'Een Nederlands KVK-nummer bestaat uit precies 8 cijfers.' };
  if (landCode === 'NL' && !/^\d{12}$/.test(vestigingsnummer))
    return { error: 'Een KVK-vestigingsnummer bestaat uit precies 12 cijfers.' };
  if (landCode !== 'NL' && (!/^[A-Z0-9][A-Z0-9 .\/-]{2,38}[A-Z0-9]$/.test(nummer) || nummer.length > 40))
    return { error: 'Vul het officiële registratienummer uit het vestigingsland in (4 tot 40 tekens).' };
  if (landCode === 'US' && regioOfStaat.length < 2)
    return { error: 'Vul voor een Amerikaans bedrijf de staat of het territorium van registratie in.' };
  const suggestie = registerSuggestie(landCode);
  const registerBron = landCode === 'NL' ? BRONNEN.kvk : veiligeHttps(b.registerBron || suggestie.url);
  if (landCode !== 'NL' && !registerBron)
    return { error: 'Vul de https-link naar het officiële ondernemingsregister van het vestigingsland in.' };
  const schoonNummer = landCode === 'NL' ? nummer.replace(/\D/g, '') : nummer;
  return { registratie: { landCode, landNaam: land.naam, nummer: schoonNummer,
    kvkNummer: landCode === 'NL' ? schoonNummer : null,
    vestigingsnummer: vestigingsnummer || null, regioOfStaat: regioOfStaat || null,
    registerNaam: suggestie.naam, registerBron,
    sleutel: landCode + ':' + schoonNummer.replace(/[^A-Z0-9]/g, '') } };
}

function sectorEisNodig(genre, data) {
  const b = data || {};
  return GEREGULEERD.has(genre) || aan(b.voedsel) || aan(b.alcohol) || aan(b.pakketreis);
}

function eisenVoor(genre, data, registratie) {
  const v = vlaggenUit(data);
  const landCode = registratie && registratie.landCode || String((data || {}).landCode || 'NL').toUpperCase();
  const ids = [];
  if (landCode !== 'NL' && sectorEisNodig(genre, data)) ids.push('sector_lokaal');
  if (v.internationaleHandel) ids.push('sancties_vn', 'sancties_eu', 'handelsscope', 'lokale_handelsregels');
  if (v.euBtw) ids.push('vies');
  if (v.douane) ids.push('eori');
  if (v.goederen) ids.push('goederencode');
  if (v.gecontroleerdeGoederen) ids.push('exportvergunning');
  if (v.vsBetrokken) ids.push('ofac');
  return [...new Set(ids)].map(id => ({ id, ...HANDELSEISEN[id] }));
}

function catalogus() {
  return Object.fromEntries(Object.entries(HANDELSEISEN).map(([id, e]) => [id, { id, ...e }]));
}

module.exports = { BRONNEN, EU, HANDELSEISEN, landen, registerSuggestie,
  registratieUit, vlaggenUit, sectorEisNodig, eisenVoor, catalogus };
