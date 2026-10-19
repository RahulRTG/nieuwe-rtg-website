/* ============================================================================
   TOONT DIT SCHERM EEN VOORSPELLING ALS FEIT? -- de vierde detector achter
   scripts/liegronde.js (bewijs 4, waarheidsgetrouw).

   De drie detectoren in ./schermleugen.js vangen een scherm dat iets VERZINT
   als de backend leeg antwoordt. Deze vangt het omgekeerde: de backend geeft
   een onzekere uitkomst -- een vooruitblik, een doorrekening, een schatting --
   en het scherm brengt hem zonder enig voorbehoud, alsof het een feit is.

   WANNEER IS EEN UITKOMST ONZEKER. Twee bronnen, allebei bestaand:
     1. het antwoord draagt een zekerheidsblok uit server/kern/fiscaal/zekerheid.js
        met de klasse `advies` of `uitlegbaar` (herkenbaar aan `klasse` + `kop`);
     2. het pad staat in ONZEKER hieronder: de bekende voorspellingen buiten
        fiscaal, die (nog) geen zekerheidsblok dragen. Elke regel noemt de
        klasse uit diezelfde vier -- er komt geen nieuwe schaal bij (BEWIJSLUS
        par. 11, AFSPRAAK par. 5.1).

   WAT TELT ALS VOORBEHOUD. De kop van de klasse ("Vraag een fiscalist",
   "Keuze met onderbouwing") of een woord dat zegt dat het geen feit is
   (verwacht, schatting, indicatie, prognose, ongeveer, extrapolatie, ...).
   Statische tekst telt mee: een vast label "Verwacht einde maand" is precies
   het voorbehoud dat hier gevraagd wordt.

   DE GRENS, en die gaat mee in elke uitslag: dit kijkt per SCHERM, niet per
   getal. Staat er ergens op het scherm een voorbehoud, dan telt het scherm als
   voorzichtig, ook als dat voorbehoud bij een ander getal staat. Een scherm dat
   hier zakt, toont dus zeker een onzekere uitkomst zonder enig voorbehoud; een
   scherm dat slaagt, is daarmee niet per getal gecontroleerd.
   ========================================================================== */
'use strict';

/* Bekende onzekere uitkomsten buiten fiscaal, per API-pad. `wat` zegt wat er
   onzeker aan is; `klasse` is een van de bestaande vier (zekerheid.js). */
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
// de koppen van die klassen, zoals zekerheid.js ze geeft
const KOPPEN = ['Vraag een fiscalist', 'Keuze met onderbouwing'];
/* Woorden die zeggen dat iets geen vastgesteld feit is. Als woordstam, zodat
   "verwacht", "verwachting" en "naar verwachting" alle drie tellen. */
const VOORBEHOUD = /(^|[^a-zà-ÿ])(verwacht|schatting|geschat|indicatie|indicatief|prognose|voorspel|ongeveer|circa|extrapolatie|doortrekking|simulatie|aanname|bandbreedte|advie|onzeker|vermoed|expected|estimate|forecast|approximately)/i;

const heeftVoorbehoud = (tekst) => VOORBEHOUD.test(tekst || '') || KOPPEN.some((k) => (tekst || '').includes(k));

/* Een zekerheidsblok ergens in het antwoord: een object met `klasse` en `kop`.
   Diepte begrensd, zodat een groot antwoord de meting niet laat hangen. */
function zekerheidsblokken(body, diepte = 0, uit = []) {
  if (!body || typeof body !== 'object' || diepte > 6) return uit;
  if (typeof body.klasse === 'string' && typeof body.kop === 'string') uit.push(body);
  for (const v of Array.isArray(body) ? body : Object.values(body)) zekerheidsblokken(v, diepte + 1, uit);
  return uit;
}

/* De onzekere uitkomsten die een scherm kreeg. `antwoorden` is een lijst
   { pad, body } van wat de backend werkelijk teruggaf. Een antwoord met
   `ok: false` of een `error` is geen uitkomst. */
function onzekereUitkomsten(antwoorden) {
  const uit = [];
  for (const a of antwoorden || []) {
    const body = a && a.body;
    if (!body || typeof body !== 'object' || body.ok === false || body.error) continue;
    const blok = zekerheidsblokken(body).find((b) => ONZEKERE_KLASSEN.has(b.klasse));
    if (blok) { uit.push({ pad: a.pad, klasse: blok.klasse, wat: blok.sleutel || 'een uitkomst met een zekerheidsblok', bron: 'zekerheid' }); continue; }
    const r = ONZEKER[a.pad];
    if (r) uit.push({ pad: a.pad, klasse: r.klasse, wat: r.wat, bron: 'register' });
  }
  return uit;
}

/* De klachten: elke onzekere uitkomst op een scherm zonder enig voorbehoud. */
function vindVoorspellingAlsFeit({ antwoorden, tekst }) {
  const uitkomsten = onzekereUitkomsten(antwoorden);
  if (!uitkomsten.length || heeftVoorbehoud(tekst)) return [];
  return uitkomsten.map((u) => 'voorspelling als feit: ' + u.pad + ' (' + u.wat + '; klasse ' + u.klasse + ') zonder enig voorbehoud op het scherm');
}

const GRENS = 'per scherm en niet per getal: een voorbehoud ergens op het scherm telt voor elke onzekere uitkomst erop';

/* Het oordeel per rij, in de bestaande standen van de bewijsbron (geen nieuwe
   woordenlijst): een scherm dat een onzekere uitkomst kreeg en hem met een
   voorbehoud toonde, is BEWEZEN; zonder voorbehoud GEBLOKKEERD_DOOR_DEFECT; wie
   geen onzekere uitkomst kreeg, is op dit punt NIET_GETEST. */
function oordeelVoorspelling({ antwoorden, tekst, deur, landing, pad }) {
  if (landing && pad && landing !== pad) return { status: 'NIET_GETEST', reden: 'landde op ' + landing + '; het scherm zelf is niet beproefd' };
  if (deur) return { status: 'NIET_GETEST', reden: 'achter een deur (' + deur + ')' };
  const uitkomsten = onzekereUitkomsten(antwoorden);
  if (!uitkomsten.length) return { status: 'NIET_GETEST', reden: 'het scherm kreeg geen onzekere uitkomst van de backend', uitkomsten: [] };
  const paden = [...new Set(uitkomsten.map((u) => u.pad))].sort();
  const klachten = vindVoorspellingAlsFeit({ antwoorden, tekst });
  if (klachten.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: klachten[0], uitkomsten: paden };
  return { status: 'BEWEZEN', reden: paden.length + ' onzekere uitkomst(en) met een voorbehoud op het scherm; ' + GRENS, uitkomsten: paden };
}

module.exports = { ONZEKER, ONZEKERE_KLASSEN, KOPPEN, VOORBEHOUD, GRENS, heeftVoorbehoud,
  zekerheidsblokken, onzekereUitkomsten, vindVoorspellingAlsFeit, oordeelVoorspelling };
