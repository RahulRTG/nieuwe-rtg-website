/* CONNECTION OS -- benoemde serverprojecties.

   Een consumer krijgt nooit een opslagobject om daarna zelf velden weg te
   poetsen. Elke projectie hieronder bouwt een nieuw object uit een vaste
   allowlist. Niet-toegestane eigenschappen zijn afwezig, niet null. */
'use strict';

const NAMES = Object.freeze({
  VONK_PROFILE_OWNER: 'VONK_PROFILE_OWNER',
  VONK_DISCOVERY: 'VONK_DISCOVERY',
  VONK_MATCH: 'VONK_MATCH',
  VONK_CONVERSATION: 'VONK_CONVERSATION',
  VONK_MEET: 'VONK_MEET',
  RENDEZVOUS_PROFILE_OWNER: 'RENDEZVOUS_PROFILE_OWNER',
  RENDEZVOUS_MATCH: 'RENDEZVOUS_MATCH',
  RENDEZVOUS_INTRODUCTION: 'RENDEZVOUS_INTRODUCTION',
  RENDEZVOUS_PRESENCE: 'RENDEZVOUS_PRESENCE',
  RENDEZVOUS_ENCOUNTER: 'RENDEZVOUS_ENCOUNTER',
  RENDEZVOUS_TABLE_MEMBER: 'RENDEZVOUS_TABLE_MEMBER',
  RENDEZVOUS_TABLE_OFFICE: 'RENDEZVOUS_TABLE_OFFICE',
  RENDEZVOUS_TOGETHER: 'RENDEZVOUS_TOGETHER',
  RENDEZVOUS_MEET: 'RENDEZVOUS_MEET',
  RAHUL_CONNECTION: 'RAHUL_CONNECTION',
  BACKOFFICE_SAFETY: 'BACKOFFICE_SAFETY'
});

const CONTRACTS = Object.freeze({
  [NAMES.VONK_PROFILE_OWNER]: ['codenaam', 'over', 'leeftijd', 'stad', 'interesses', 'betrouwbaarheid', 'kenmerken', 'geslacht', 'zoekt', 'leeftijdMin', 'leeftijdMax', 'maxKm', 'actief', 'afstandActief', 'wensen', 'zicht', 'beschikbaar', 'datewens'],
  [NAMES.VONK_DISCOVERY]: ['codenaam', 'over', 'leeftijd', 'stad', 'interesses', 'betrouwbaarheid', 'kenmerken', 'gemeen', 'waarom'],
  [NAMES.VONK_MATCH]: ['id', 'met', 'at', 'status', 'betrouwbaarheid', 'tafel', 'ikBetaalde', 'anderBetaalde', 'berichten', 'kenmerken', 'wanneer'],
  [NAMES.VONK_CONVERSATION]: ['van', 'tekst', 'at'],
  [NAMES.VONK_MEET]: ['supplierCode', 'supplierName', 'plek', 'middenAfstandKm', 'datum', 'tijd', 'prijsPP', 'rtgDeel', 'soort', 'reisminuten', 'waarom'],
  [NAMES.RENDEZVOUS_PROFILE_OWNER]: ['codenaam', 'rooster', 'profiel'],
  [NAMES.RENDEZVOUS_MATCH]: ['id', 'codenaam', 'gedeeldeLocaties', 'samen', 'wanneer', 'voorstel', 'sinds'],
  [NAMES.RENDEZVOUS_INTRODUCTION]: ['id', 'codenaam', 'over', 'zoekt', 'wensen', 'locaties', 'gedeeldeLocaties', 'samen', 'likteMij', 'status', 'soort', 'aanleiding', 'ikAntwoordde', 'geopend', 'at'],
  [NAMES.RENDEZVOUS_PRESENCE]: ['stad', 'van', 'tot'],
  [NAMES.RENDEZVOUS_ENCOUNTER]: ['ok', 'wacht', 'codenaam'],
  [NAMES.RENDEZVOUS_TABLE_MEMBER]: ['id', 'naam', 'stad', 'datum', 'tijd', 'thema', 'plaatsen', 'mijnStatus'],
  [NAMES.RENDEZVOUS_TABLE_OFFICE]: ['id', 'naam', 'stad', 'datum', 'tijd', 'thema', 'plaatsen', 'at', 'genodigden', 'toegezegd', 'aantal'],
  [NAMES.RENDEZVOUS_TOGETHER]: ['samen', 'met', 'ikVerklaarde'],
  [NAMES.RENDEZVOUS_MEET]: ['setting', 'settingLabel', 'stad', 'van', 'tot', 'dagdeel', 'dagdeelLabel', 'ikAkkoord', 'anderAkkoord', 'tekst', 'bijRechterhand'],
  [NAMES.RAHUL_CONNECTION]: ['matchCodenaam', 'gedeeldeLocaties', 'openLocaties', 'watIkZoek', 'presence', 'gedeeldDagdeel', 'voorkeursStad'],
  [NAMES.BACKOFFICE_SAFETY]: ['id', 'van', 'over', 'reden', 'at', 'status']
});

/* `null` mag betekenis hebben (bijvoorbeeld: het lid heeft nog niet
   geantwoord). Alleen een niet-geselecteerd veld blijft volledig afwezig. */
const aanwezig = v => v !== undefined;
const kopie = v => Array.isArray(v) ? v.map(kopie)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, kopie(x)])) : v;

function alleen(source, velden) {
  const uit = {};
  const s = source && typeof source === 'object' ? source : {};
  for (const veld of velden) if (aanwezig(s[veld])) uit[veld] = kopie(s[veld]);
  return uit;
}

function presence(v) {
  return alleen(v, CONTRACTS[NAMES.RENDEZVOUS_PRESENCE]);
}

function project(name, source) {
  if (!CONTRACTS[name]) throw new Error('Onbekende Connection-projectie: ' + name);
  const s = source && typeof source === 'object' ? source : {};
  const uit = alleen(s, CONTRACTS[name]);

  if (name === NAMES.VONK_MATCH) {
    if (aanwezig(s.tafel)) uit.tafel = project(NAMES.VONK_MEET, s.tafel);
    if (aanwezig(s.berichten)) uit.berichten = s.berichten.map(x => project(NAMES.VONK_CONVERSATION, x));
  }
  if (name === NAMES.RENDEZVOUS_MATCH || name === NAMES.RENDEZVOUS_INTRODUCTION) {
    if (aanwezig(s.samen)) uit.samen = s.samen.map(presence);
  }
  if (name === NAMES.RENDEZVOUS_PROFILE_OWNER && aanwezig(s.profiel)) {
    uit.profiel = alleen(s.profiel, ['aan', 'over', 'zoekt', 'wensen', 'locaties', 'thuis', 'aanwezig', 'beschikbaar']);
    if (aanwezig(s.profiel.aanwezig)) uit.profiel.aanwezig = s.profiel.aanwezig.map(presence);
  }
  if (name === NAMES.RENDEZVOUS_TABLE_OFFICE && aanwezig(s.genodigden)) {
    uit.genodigden = s.genodigden.map(g => alleen(g, ['codenaam', 'status']));
  }
  if (name === NAMES.RAHUL_CONNECTION) {
    if (aanwezig(s.presence)) uit.presence = s.presence.map(presence);
  }
  return uit;
}

function projectList(name, rows) {
  return (Array.isArray(rows) ? rows : []).map(row => project(name, row));
}

/* Rahul krijgt eerst een minimale inputprojectie. Zijn vrije tekst passeert na
   generatie opnieuw deze grens: een waarde uit een privébron die niet in de
   projectie stond, maakt het gehele antwoord dicht in plaats van half rood. */
const GEVOELIGE_SLEUTELS = new Set(['legalName', 'echteNaam', 'birthDate', 'geboortedatum', 'address', 'adres',
  'exactLocation', 'lat', 'lng', 'religion', 'geloof', 'religionImportance', 'thuis']);

function gevoeligeWaarden(value, gevonden, sleutel) {
  const uit = gevonden || [];
  if (Array.isArray(value)) for (const v of value) gevoeligeWaarden(v, uit, sleutel);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) gevoeligeWaarden(v, uit, k);
  else if (GEVOELIGE_SLEUTELS.has(sleutel) && typeof value === 'string' && value.trim().length >= 3) uit.push(value.trim());
  else if (GEVOELIGE_SLEUTELS.has(sleutel) && typeof value === 'number' && Number.isFinite(value)) uit.push(String(value));
  return uit;
}

function rahulOutputGuard(tekst, toegestaneProjectie, priveBronnen) {
  const antwoord = String(tekst || '');
  const toegestaan = JSON.stringify(toegestaneProjectie || {}).toLowerCase();
  const verboden = gevoeligeWaarden(Array.isArray(priveBronnen) ? priveBronnen : [priveBronnen]);
  const lek = verboden.find(v => !toegestaan.includes(v.toLowerCase()) &&
    antwoord.toLowerCase().includes(v.toLowerCase()));
  if (lek) return { ok: false, tekst: 'Ik kan alleen werken met gegevens die voor deze ontmoeting zijn vrijgegeven.' };
  return { ok: true, tekst: antwoord };
}

module.exports = { NAMES, CONTRACTS, project, projectList, rahulOutputGuard };
