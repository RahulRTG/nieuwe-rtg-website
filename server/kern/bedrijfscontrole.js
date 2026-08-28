/* De ene toelatingscatalogus voor bedrijven. Een KVK-inschrijving is de vaste
   ondergrens; gereguleerde activiteiten krijgen daar hun eigen openbare bron
   bij. De uitkomst is nooit "RTG heeft een vergunning afgegeven": RTG legt
   alleen vast wat in het bevoegde register of bij de bevoegde instantie is
   gecontroleerd. */
'use strict';

const { nu: klokNu } = require('../lib/klok');

const BRONNEN = Object.freeze({
  kvk: 'https://developers.kvk.nl/nl/documentation/basisprofiel-api',
  vergunningen: 'https://business.gov.nl/business-location/establishing-or-relocating-a-business/permits-for-your-business/',
  nvwa: 'https://www.nvwa.nl/onderwerpen/voedselveiligheid/levensmiddelen-produceren-en-verhandelen/registratie-en-erkenning/registreer-uw-levensmiddelenbedrijf',
  taxi: 'https://business.gov.nl/regulations/permit-operate-taxi-service/',
  zorg: 'https://business.gov.nl/regulations/requirements-care-institutions/',
  big: 'https://business.gov.nl/regulations/registering-as-healthcare-professional/',
  apotheek: 'https://business.gov.nl/regulations/pharmaceutical-permits/',
  kinderopvang: 'https://business.gov.nl/regulations/registration-childcare/',
  beveiliging: 'https://business.gov.nl/regulations/licence-private-security-organisation/',
  afm: 'https://www.afm.nl/nl-nl/sector/registers/vergunningenregisters/financiele-dienstverleners',
  pakketreis: 'https://business.gov.nl/regulations/offering-trips-and-holidays/'
});

const SPECIFIEK = Object.freeze({
  nvwa: { label: 'NVWA-registratie levensmiddelenbedrijf', bron: 'NVWA', url: BRONNEN.nvwa },
  taxi: { label: 'Kiwa-ondernemersvergunning taxivervoer', bron: 'Kiwa / ILT', url: BRONNEN.taxi },
  zorg: { label: 'CIBG-melding en, waar vereist, Wtza-toelating', bron: 'CIBG / IGJ', url: BRONNEN.zorg },
  big: { label: 'Geldige BIG-registratie voor de aangeboden handelingen', bron: 'BIG-register', url: BRONNEN.big },
  apotheek: { label: 'Register gevestigde apothekers en toepasselijke Farmatec-registratie', bron: 'CIBG / Farmatec', url: BRONNEN.apotheek },
  kinderopvang: { label: 'LRK-inschrijving van deze vestiging', bron: 'Landelijk Register Kinderopvang', url: BRONNEN.kinderopvang },
  beveiliging: { label: 'Wpbr-vergunning particuliere beveiligingsorganisatie', bron: 'Justis', url: BRONNEN.beveiliging },
  afm: { label: 'AFM-vergunning, aansluiting of Europees paspoort voor de aangeboden dienst', bron: 'AFM-register', url: BRONNEN.afm },
  pakketreis: { label: 'Insolventiebescherming voor pakketreizen', bron: 'Garantieregeling pakketreis', url: BRONNEN.pakketreis },
  alcohol: { label: 'Gemeentelijke alcoholvergunning voor deze locatie', bron: 'Gemeente', url: BRONNEN.vergunningen },
  behandelbevoegdheid: { label: 'Bevoegdheid voor de aangeboden medisch-cosmetische behandelingen', bron: 'BIG-register / IGJ', url: BRONNEN.big }
});

const HORECA = new Set(['restaurant', 'bar', 'club', 'beachclub', 'koffie', 'chef']);
const ZORG = new Set(['zorg', 'care', 'ziekenhuis', 'huisarts', 'specialist', 'tandarts']);
const BIG = new Set(['huisarts', 'specialist', 'tandarts']);

/* De acht genres uit de bestaande ondernemersintake lezen voortaan deze
   catalogus. Zo kan een apotheek niet in de ene aanvraag iets anders hoeven
   bewijzen dan in de andere. */
const BEWIJS_EISEN = Object.freeze({
  ziekenhuis: SPECIFIEK.zorg.label,
  huisarts: SPECIFIEK.big.label,
  specialist: SPECIFIEK.big.label,
  apotheek: SPECIFIEK.apotheek.label,
  beautymedical: SPECIFIEK.behandelbevoegdheid.label,
  kinderopvang: SPECIFIEK.kinderopvang.label,
  verzekeringen: SPECIFIEK.afm.label,
  beveiliging: SPECIFIEK.beveiliging.label
});

function vlaggenUit(data) {
  const b = data || {};
  return {
    voedsel: b.voedsel === true || b.voedsel === 'on',
    alcohol: b.alcohol === true || b.alcohol === 'on',
    pakketreis: b.pakketreis === true || b.pakketreis === 'on'
  };
}

function specifiekeIds(genre, data) {
  /* Buiten Nederland gelden andere bevoegde registers. Die bewijzen komen uit
     internationalehandel.js; hier mogen nooit per ongeluk Nederlandse
     vergunningen op een buitenlands bedrijf worden geplakt. */
  if (String((data || {}).landCode || 'NL').toUpperCase() !== 'NL') return [];
  const v = vlaggenUit(data);
  const ids = [];
  if (HORECA.has(genre) || v.voedsel) ids.push('nvwa');
  if (genre === 'taxi') ids.push('taxi');
  if (ZORG.has(genre)) ids.push('zorg');
  if (BIG.has(genre)) ids.push('big');
  if (genre === 'apotheek') ids.push('apotheek');
  if (genre === 'kinderopvang') ids.push('kinderopvang');
  if (genre === 'beveiliging') ids.push('beveiliging');
  if (genre === 'verzekeringen') ids.push('afm');
  if (genre === 'beautymedical') ids.push('behandelbevoegdheid');
  if (v.alcohol) ids.push('alcohol');
  if (v.pakketreis) ids.push('pakketreis');
  return [...new Set(ids)];
}

function eisenVoor(genre, data) {
  const b = data || {};
  const buitenlands = String(b.landCode || 'NL').toUpperCase() !== 'NL';
  const registerUrl = buitenlands ? (b.registerBron || null) : BRONNEN.kvk;
  const basis = [
    buitenlands
      ? { id: 'handelsregister', label: 'Actieve inschrijving, handelsnaam, vestiging en activiteiten in het officiële register van het vestigingsland', bron: 'Officieel ondernemingsregister', url: registerUrl, aanvrager: false }
      : { id: 'kvk', label: 'Actieve KVK-inschrijving, handelsnaam, vestiging en passende SBI-activiteit', bron: 'KVK Handelsregister', url: BRONNEN.kvk, aanvrager: false },
    { id: 'bevoegdheid', label: 'Bevoegdheid van de aanvrager om het bedrijf te vertegenwoordigen', bron: buitenlands ? 'Officieel register of contact via officieel bedrijfskanaal' : 'KVK-uittreksel of contact via officieel bedrijfskanaal', url: registerUrl, aanvrager: false },
    { id: 'vergunningenscan', label: 'Vergunningen voor activiteit, beroep en locatie gecontroleerd', bron: 'Bevoegde gemeente, toezichthouder of register', url: BRONNEN.vergunningen, aanvrager: false, magNietVanToepassing: true },
    { id: 'integriteit', label: 'Dubbele aanvragen, afwijkende gegevens en overige fraudesignalen beoordeeld', bron: 'RTG-toelatingscontrole', url: null, aanvrager: false }
  ];
  return basis.concat(specifiekeIds(genre, data).map(id => ({ id, ...SPECIFIEK[id], aanvrager: true })));
}

function startControle({ genre, data, kvkNummer, vestigingsnummer, registratieReferentie, extraEisen, bewijzen, at }) {
  const refs = bewijzen && typeof bewijzen === 'object' ? bewijzen : {};
  const defs = eisenVoor(genre, data).concat(Array.isArray(extraEisen) ? extraEisen : [])
    .filter((e, i, alle) => alle.findIndex(x => x.id === e.id) === i);
  return {
    versie: 2,
    status: 'controle_nodig',
    vlaggen: vlaggenUit(data),
    eisen: defs.map(def => ({
      ...def, verplicht: true, status: 'open',
      referentie: ['kvk', 'handelsregister'].includes(def.id) ?
        (registratieReferentie || kvkNummer + ' / ' + vestigingsnummer) :
        (def.aanvrager ? String(refs[def.id] || '').trim().slice(0, 120) : null),
      gecontroleerd: null
    })),
    historie: [],
    gestartAt: at
  };
}

function eisKlaar(eis, nu) {
  if (!eis) return false;
  if (eis.status === 'niet_van_toepassing' && eis.magNietVanToepassing) return true;
  if (eis.status !== 'geverifieerd' || !eis.gecontroleerd) return false;
  if (eis.gecontroleerd.geldigTot && Date.parse(eis.gecontroleerd.geldigTot) < nu) return false;
  return true;
}

function herbereken(toelating, nu) {
  if (!toelating || !Array.isArray(toelating.eisen)) return { status: 'controle_nodig', open: ['oude-aanvraag'] };
  const tijd = nu == null ? klokNu() : nu;
  const open = toelating.eisen.filter(e => e.verplicht && !eisKlaar(e, tijd)).map(e => e.id);
  toelating.status = open.length ? 'controle_nodig' : 'klaar_voor_besluit';
  return { status: toelating.status, open };
}

function controleer(toelating, data, door, at) {
  if (!toelating || !Array.isArray(toelating.eisen)) return { status: 409, error: 'Deze oude aanvraag heeft geen toelatingsdossier. Laat het bedrijf opnieuw aanvragen.' };
  const eis = toelating.eisen.find(e => e.id === String((data || {}).onderdeel || ''));
  if (!eis) return { status: 400, error: 'Onbekend controleonderdeel.' };
  const uitkomst = String(data.uitkomst || '');
  if (!['geverifieerd', 'niet_van_toepassing', 'afgekeurd'].includes(uitkomst)) return { status: 400, error: 'Kies geverifieerd, niet van toepassing of afgekeurd.' };
  if (uitkomst === 'niet_van_toepassing' && !eis.magNietVanToepassing) return { status: 409, error: 'Dit verplichte registerbewijs kan niet als niet van toepassing worden afgevinkt.' };
  const referentie = String(data.referentie || '').trim().slice(0, 180);
  if (referentie.length < 3) return { status: 400, error: 'Leg de geraadpleegde bron, het nummer of de reden vast.' };
  const geldigTot = String(data.geldigTot || '').trim().slice(0, 10) || null;
  if (geldigTot && !/^\d{4}-\d{2}-\d{2}$/.test(geldigTot)) return { status: 400, error: 'Gebruik voor geldig tot JJJJ-MM-DD.' };
  eis.status = uitkomst;
  eis.gecontroleerd = { door, at, referentie, geldigTot };
  toelating.historie = (toelating.historie || []).concat({ onderdeel: eis.id, uitkomst, door, at, referentie }).slice(-100);
  const stand = herbereken(toelating, Date.parse(at));
  return { ok: true, toelating, open: stand.open };
}

function magGoedkeuren(aanvraag, nu) {
  if (!aanvraag || !aanvraag.businessPass || !aanvraag.businessPass.key)
    return { ok: false, error: 'De aanvraag heeft geen Business Pass-bewijs.' };
  const stand = herbereken(aanvraag.toelating, nu == null ? klokNu() : nu);
  if (stand.open.length) return { ok: false, open: stand.open,
    error: 'Goedkeuren is geblokkeerd: rond eerst alle officiële en interne controles af (' + stand.open.join(', ') + ').' };
  return { ok: true };
}

module.exports = { BRONNEN, BEWIJS_EISEN, eisenVoor, specifiekeIds, vlaggenUit,
  startControle, herbereken, controleer, magGoedkeuren };
