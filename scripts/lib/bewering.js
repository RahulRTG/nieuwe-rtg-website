/* ============================================================================
   BEWEERT DIT SCHERM MEER DAN DE BRON KAN BEWIJZEN? -- de vierde detector
   achter scripts/liegronde.js (bewijs 4, waarheidsgetrouw).

   De drie detectoren in ./schermleugen.js vangen een scherm dat iets VERZINT
   als de backend leeg antwoordt. Deze vangt het scherm dat een ECHT antwoord
   sterker brengt dan het is. Een fout, zes gedaanten (eigenaarsbesluit 19
   oktober 2026):

     voorspelling  een vooruitblik, doorrekening of schatting zonder voorbehoud
     aanvraag      een reserveringsAANVRAAG die als bevestigd verschijnt
     betaling      een betaling als geslaagd voor de provider het bevestigt
     simulatie     een demo-, simulatie- of oefenstand als echte uitkomst
     voorstel      een voorgestelde actie die als uitgevoerd verschijnt
     verouderd     een verouderde stand zonder tijdstip of "bijgewerkt"

   Per gedaante leidt de detector uit het ANTWOORD af wat de werkelijke stand
   is, en vergelijkt dat met de zichtbare tekst. Twee soorten regels:

     voorbehoud    de bron is onzeker (voorspelling, simulatie, verouderd);
                   het scherm moet dat ergens zeggen.
     bewering      de bron is in een zwakkere stand (aangevraagd, nog niet
                   betaald, voorgesteld) en NERGENS in het antwoord in de
                   sterkere; het scherm mag dan niet de sterke stand noemen
                   zonder ook de zwakke.

   Geen nieuwe schaal: onzeker is een klasse uit kern/fiscaal/zekerheid.js
   (`advies`/`uitlegbaar`), de staten komen uit de backend zelf
   (betaalwaarheid/staten.js, de statussen van aanvraag en voorstel), en het
   oordeel gebruikt de standen van de bewijsbron (BEWIJSLUS par. 11, AFSPRAAK
   par. 5.1).

   DE GRENS, en die gaat mee in elke uitslag: per SCHERM, niet per regel.
   Staat de zwakke stand of het voorbehoud ergens op het scherm, dan telt het
   scherm als eerlijk, ook als dat bij een andere regel staat. Wie hier zakt,
   beweert zeker meer dan de bron; wie slaagt, is niet per regel gecontroleerd.
   ========================================================================== */
'use strict';

/* Bekende onzekere uitkomsten buiten fiscaal, per API-pad: ze dragen (nog)
   geen zekerheidsblok. `klasse` is een van de bestaande vier (zekerheid.js). */
const ONZEKER = {
  '/api/geld/cockpit': { wat: 'de vooruitblik van de geldgraaf (7/30/90 dagen, einde maand)', klasse: 'advies' },
  '/api/kosten/vooruitblik': { wat: 'de verwachte kosten over de maand', klasse: 'advies' },
  '/api/supplier/kosten/vooruitblik': { wat: 'de verwachte kosten over de maand', klasse: 'advies' },
  '/api/move/gevolg': { wat: 'de gevolgberekening van een verschuiving', klasse: 'advies' },
  '/api/supplier/scenario/personeel': { wat: 'een doorrekening op aannames', klasse: 'advies' },
  '/api/supplier/scenario/omzet': { wat: 'een doorrekening op aannames', klasse: 'advies' },
  '/api/member/zzp': { wat: 'een indicatie op een verwachte jaarwinst', klasse: 'advies' },
  '/api/balans': { wat: 'de adviezen over de werk-privebalans', klasse: 'advies' },
  '/api/onderneming/kas': { wat: 'de kasvooruitblik', klasse: 'advies' },
  '/api/onderneming/dagbeeld': { wat: 'de kasvooruitblik en de doortrekking van de belasting', klasse: 'advies' },
  '/api/voorspel': { wat: 'een voorspelling uit het eigen gedrag', klasse: 'advies' }
};
const ONZEKERE_KLASSEN = new Set(['advies', 'uitlegbaar']);
const KOPPEN = ['Vraag een fiscalist', 'Keuze met onderbouwing'];

// een woord(stam) aan het begin van een woord, hoofdletterongevoelig
const stam = (woorden) => new RegExp('(^|[^a-zà-ÿ])(' + woorden.join('|') + ')', 'i');
const heelWoord = (woorden) => new RegExp('(^|[^a-zà-ÿ])(' + woorden.join('|') + ')($|[^a-zà-ÿ])', 'i');
const lc = (v) => String(v == null ? '' : v).toLowerCase();

const VOORBEHOUD = stam(['verwacht', 'schatting', 'geschat', 'indicatie', 'indicatief', 'prognose', 'voorspel',
  'ongeveer', 'circa', 'extrapolatie', 'doortrekking', 'simulatie', 'aanname', 'bandbreedte', 'advie',
  'onzeker', 'vermoed', 'expected', 'estimate', 'forecast', 'approximately']);
const heeftVoorbehoud = (tekst) => VOORBEHOUD.test(tekst || '') || KOPPEN.some((k) => (tekst || '').includes(k));

const BETAALSTAAT_ZWAK = new Set(['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING', 'CONTROLE_NODIG']);
const SIMULATIE_AANBIEDER = new Set(['demo', 'magnaat-test', 'simulatiebank']);
const isZekerheidsblok = (o) => typeof o.klasse === 'string' && typeof o.kop === 'string';

/* DE ZES GEDAANTEN. `bron(o, pad)` zegt of een object uit het antwoord de
   zwakke/onzekere stand draagt; `sterk(o)` (alleen bij beweringen) of het de
   sterke stand draagt. `scherm` is wat de tekst moet (voorbehoud) of mag niet
   (sterk zonder zwak) zeggen. */
const GEDAANTEN = [
  { id: 'voorspelling', soort: 'voorbehoud', wat: 'een onzekere uitkomst (voorspelling, doorrekening, schatting)',
    bron: (o) => isZekerheidsblok(o) && ONZEKERE_KLASSEN.has(o.klasse),
    pad: (p) => ONZEKER[p], voorbehoud: heeftVoorbehoud },
  { id: 'aanvraag', soort: 'bewering', wat: 'een aanvraag die nog niet bevestigd is',
    bron: (o) => ['aangevraagd', 'aanvraag', 'requested', 'pending'].includes(lc(o.status)),
    sterk: (o) => ['bevestigd', 'confirmed'].includes(lc(o.status)),
    schermSterk: heelWoord(['bevestigd', 'gereserveerd', 'geboekt', 'confirmed']),
    schermZwak: stam(['aangevraagd', 'aanvraag', 'in afwachting', 'wacht op', 'nog niet bevestigd', 'requested', 'pending']) },
  { id: 'betaling', soort: 'bewering', wat: 'een betaling die de provider nog niet bevestigde',
    bron: (o) => BETAALSTAAT_ZWAK.has(String(o.status || '')) || (o.definitief === false && 'bedragCenten' in o) || o.paid === false,
    sterk: (o) => o.status === 'BEVESTIGD' || o.definitief === true || o.paid === true,
    schermSterk: heelWoord(['betaald', 'geslaagd', 'ontvangen', 'paid']),
    schermZwak: stam(['in afwachting', 'wordt verwerkt', 'in behandeling', 'onbetaald', 'nog niet betaald', 'openstaand', 'controle', 'wacht op', 'pending']) },
  { id: 'simulatie', soort: 'voorbehoud', wat: 'een demo-, simulatie- of oefenstand',
    bron: (o) => o.demo === true || o.simulatie === true || o.droogloop === true ||
      SIMULATIE_AANBIEDER.has(lc(o.aanbieder)) || SIMULATIE_AANBIEDER.has(lc(o.provider)) || ['demo', 'simulatie', 'oefen'].includes(lc(o.modus)),
    voorbehoud: (t) => stam(['demo', 'simulatie', 'gesimuleerd', 'oefen', 'droogloop', 'proef', 'voorbeeld', 'test', 'sample']).test(t || '') },
  { id: 'voorstel', soort: 'bewering', wat: 'een voorgestelde actie die nog niet is uitgevoerd',
    bron: (o) => o.uitgevoerd === false || lc(o.status) === 'voorgesteld',
    sterk: (o) => o.uitgevoerd === true || lc(o.status) === 'uitgevoerd',
    schermSterk: heelWoord(['uitgevoerd', 'verplaatst', 'geregeld', 'aangepast', 'gewijzigd', 'done']),
    schermZwak: stam(['voorstel', 'voorgesteld', 'stel voor', 'bevestig', 'nog niet', 'suggest', 'proposal']) },
  { id: 'verouderd', soort: 'voorbehoud', wat: 'een verouderde stand',
    bron: (o) => o.verouderd === true || o.stale === true,
    voorbehoud: (t) => /bijgewerkt|verouderd|laatst|geleden|\bsinds\b|updated|\b\d{1,2}:\d{2}\b|\b\d{1,2} (jan|feb|mrt|maa|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i.test(t || '') }
];

// elk object in een antwoord, diepte begrensd
function objecten(body, diepte = 0, uit = []) {
  if (!body || typeof body !== 'object' || diepte > 6) return uit;
  if (!Array.isArray(body)) uit.push(body);
  for (const v of Array.isArray(body) ? body : Object.values(body)) objecten(v, diepte + 1, uit);
  return uit;
}

/* Wat de bron zegt: per gedaante of het antwoord de zwakke of onzekere stand
   draagt (en bij een bewering: of het ook ergens de sterke draagt). Een
   antwoord met ok:false of een error is geen uitkomst. */
function bronStand(antwoorden) {
  const stand = {};
  for (const a of antwoorden || []) {
    const body = a && a.body;
    if (!body || typeof body !== 'object' || body.ok === false || body.error) continue;
    const alle = objecten(body);
    for (const g of GEDAANTEN) {
      const s = stand[g.id] || (stand[g.id] = { zwak: [], sterk: false });
      if ((g.pad && g.pad(a.pad)) || alle.some(g.bron)) s.zwak.push(a.pad);
      if (g.sterk && alle.some(g.sterk)) s.sterk = true;
    }
  }
  for (const id of Object.keys(stand)) if (!stand[id].zwak.length) delete stand[id];
  return stand;
}

/* De klachten: per gedaante waar de bron zwak of onzeker is en het scherm
   meer zegt. */
function vindBeweringen({ antwoorden, tekst }) {
  const stand = bronStand(antwoorden);
  const klachten = [];
  for (const g of GEDAANTEN) {
    const s = stand[g.id];
    if (!s) continue;
    const paden = [...new Set(s.zwak)].sort().join(', ');
    if (g.soort === 'voorbehoud' && !g.voorbehoud(tekst)) {
      klachten.push(g.id + ': ' + g.wat + ' uit ' + paden + ' staat zonder voorbehoud op het scherm');
    }
    if (g.soort === 'bewering' && !s.sterk && g.schermSterk.test(tekst || '') && !g.schermZwak.test(tekst || '')) {
      klachten.push(g.id + ': ' + g.wat + ' uit ' + paden + ' verschijnt als "' + (tekst.match(g.schermSterk) || [])[2] + '"');
    }
  }
  return klachten;
}

const GRENS = 'per scherm en niet per regel: een voorbehoud of zwakke stand ergens op het scherm telt voor elke uitkomst erop';

/* Het oordeel per rij, in de bestaande standen van de bewijsbron. */
function oordeelBewering({ antwoorden, tekst, deur, landing, pad }) {
  if (landing && pad && landing !== pad) return { status: 'NIET_GETEST', reden: 'landde op ' + landing + '; het scherm zelf is niet beproefd', gedaanten: [] };
  if (deur) return { status: 'NIET_GETEST', reden: 'achter een deur (' + deur + ')', gedaanten: [] };
  const gedaanten = Object.keys(bronStand(antwoorden)).sort();
  if (!gedaanten.length) return { status: 'NIET_GETEST', reden: 'de bron gaf geen onzekere of nog-niet-definitieve stand', gedaanten };
  const klachten = vindBeweringen({ antwoorden, tekst });
  if (klachten.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: klachten[0], gedaanten, klachten };
  return { status: 'BEWEZEN', reden: 'de bron gaf ' + gedaanten.join(', ') + ' en het scherm zei niet meer; ' + GRENS, gedaanten };
}

module.exports = { ONZEKER, ONZEKERE_KLASSEN, KOPPEN, GEDAANTEN, GRENS, heeftVoorbehoud,
  objecten, bronStand, vindBeweringen, oordeelBewering };
