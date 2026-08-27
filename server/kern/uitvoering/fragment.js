/* UITVOERENDE MEDIA (deelmodule): HET FRAGMENT -- een bereik in een stuk.

   Dit is de vijfde id-vorm naast de vier van kern/mediaos/catalogus.js
   (`track:`, `video:`, `clip:`, `live:`), en de enige die er bij komt:

     fragment:<vorm>:<domein-id>@<van>-<tot>      fragment:track:u91c0@0-30

   EEN FRAGMENT BEZIT NIETS. Het draagt een verwijzing en twee getallen, precies
   zoals een afspeellijst alleen id's draagt (kern/mediaos/lijsten.js). Daaruit
   volgen drie eigenschappen die niet apart gebouwd hoeven te worden:

     - haalt de maker het stuk weg, dan is het fragment weg -- en het staat er
       als verdwenen, niet als een kaart die niemand kan spelen (LAT.md regel 5);
     - het wordt opgelost met de sessie van de KIJKER, dus een uitvoering is
       nooit een weg naar wat de wereld hem weigert;
     - er komt geen tweede exemplaar van een clip of een uitgave naast het
       origineel te staan (LAT.md regel 4).

   WAAROM HET GEEN "DEEL" HEET, en dat is nagemeten en geen smaak. `deel` is in
   precies deze laag al bezet: `deelId()` in kern/mediaos/catalogus.js SPLITST
   een stuk-id, en `delen` in kern/mediaos/lijstdelen.js betekent iets met
   iemand DELEN. Een derde betekenis erbij, uitgerekend in de module die het id
   moet parsen, is de stille botsing die SEMANTIEK.json telt (77 namen met meer
   dan één betekenis). `fragment` kwam uit dezelfde meting als vrij.

   EN WAAROM DE TIJDEN OP EEN TIENDE STAAN: dezelfde afronding als een
   ondertitelcue (kern/ondertitels.js). Twee tijdlijnen over hetzelfde beeld die
   anders afronden, lopen op den duur zichtbaar uiteen. */
'use strict';

const MAX_S = 6 * 3600;          // zes uur; daarboven is het geen fragment meer
const tiende = (n) => Math.round(n * 10) / 10;

/* Bouwen. Geeft null terug bij alles wat niet klopt -- een fragment met een
   eind vóór zijn begin is een typefout en geen keuze, en die hoort te vervallen
   in plaats van ergens als nul-seconden op te duiken (zelfde regel als de knip
   in kern/clips-studio.js). */
function maak(stukId, van, tot) {
  const sid = String(stukId || '');
  if (!/^[a-z]+:.+$/.test(sid) || sid.startsWith('fragment:')) return null;
  const v = Number(van), t = Number(tot);
  if (!Number.isFinite(v) || !Number.isFinite(t)) return null;
  if (v < 0 || t <= v || t > MAX_S) return null;
  return 'fragment:' + sid + '@' + tiende(v) + '-' + tiende(t);
}

/* Lezen. Gesplitst op de LAATSTE `@`: een domein-id mag er zelf een bevatten
   zonder dat het bereik zoekraakt -- dezelfde voorzichtigheid als `deelId()`,
   dat op de EERSTE dubbele punt splitst en in zijn kop uitlegt waarom. */
function lees(fid) {
  const s = String(fid || '');
  if (!s.startsWith('fragment:')) return null;
  const rest = s.slice('fragment:'.length);
  const i = rest.lastIndexOf('@');
  if (i < 1) return null;
  const stukId = rest.slice(0, i);
  const m = /^(\d+(?:\.\d)?)-(\d+(?:\.\d)?)$/.exec(rest.slice(i + 1));
  if (!m) return null;
  const van = Number(m[1]), tot = Number(m[2]);
  if (!/^[a-z]+:.+$/.test(stukId) || tot <= van || tot > MAX_S) return null;
  return { stukId, van, tot, duurS: tiende(tot - van) };
}

const isFragment = (fid) => lees(fid) != null;

/* De duur van een fragment, zonder het stuk te kennen. Dit is het getal waarop
   een uitvoering rekent, en het is met opzet het GEVRAAGDE bereik en niet de
   werkelijke lengte van het stuk: RTG kent die lengte voor twee van de vier
   vormen niet (de bytes van een clip staan op het toestel van de maker). Wat
   de maker opschreef is dus de bron, en waar dat niet klopt is dat een fout
   van de maker die hij zelf kan zien -- niet een getal dat wij verzinnen. */
const duurVan = (fid) => { const f = lees(fid); return f ? f.duurS : 0; };

module.exports = { maak, lees, isFragment, duurVan, MAX_S };
