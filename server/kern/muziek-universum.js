/* RTG Klankwerk (deelmodule): HET MUZIKALE UNIVERSUM -- een uitgave die geen
   opname is maar een REGEL.

   Elk platform geeft je een nummer: een vast bestand dat elke keer identiek
   klinkt. Dat kan hier ook, en dat blijft. Maar dit huis kan iets wat de andere
   drie structureel niet kunnen: muziek wordt hier niet afgespeeld maar
   UITGEREKEND (kern/muziek.js -- een track is een handvol getallen, geen audio).
   Zodra dat waar is, hoeft een uitgave niet één uitvoering te zijn.

   EEN UNIVERSUM IS WAT DE ARTIEST VASTLEGT: een stijl, een ladder, een
   tempobereik en een lengte. Binnen die grenzen rekent elk toestel een eigen
   VERTOLKING uit. Twee mensen horen niet hetzelfde, en toch onmiskenbaar
   hetzelfde werk -- zoals twee uitvoeringen van dezelfde partituur.

   DE OPNAME VAN DE MAKER BLIJFT BESTAAN, en dat is de belangrijkste keuze in
   dit bestand. Een uitgave met een universum draagt nog steeds de `kanalen`
   die de maker zelf heeft neergezet. Die zijn niet vervangen door een generator:
   ze staan er als "zoals de maker het speelde", naast de vertolking van vandaag.
   Anders zou dit formaat de maker uit zijn eigen werk schrijven, en dat is
   precies wat het Klankwerk elders al weigert ("de AI zet neer, jij bent de
   maker").

   WAAROM "VERTOLKING". Gemeten voor het een naam kreeg, net als de vier
   begrippen van kern/uitvoering/: `vertolking` had nul treffers in server/ en
   public/. `uitvoering` was al bezet door de laag erboven, en twee betekenissen
   op een woord is precies wat SEMANTIEK.json telt.

   HET IS REPRODUCEERBAAR. Elke vertolking draagt haar zaad. Dezelfde zaad geeft
   tot op de noot hetzelfde resultaat -- dus een maker kan horen wat een
   luisteraar hoorde, en een luisteraar kan een vertolking terugvinden die hij
   mooi vond. Zonder dat zou "elke keer anders" niet een formaat zijn maar ruis.

   WAT HIER NIET KOMT: een universum dat zichzelf bijstelt op wat mensen mooi
   vinden. Dat zou een hitlijst zijn met een omweg, en die weigeren het
   Klankwerk, de zaal en de Media OS alle drie al met zoveel woorden. */
'use strict';

const I = require('./muziek-instrumenten');
const LIED = require('./muziek-lied');
const { LADDERS, STIJLEN, STIJLNAMEN, bouw, zaadRnd } = require('./muziek-stijlen');

const LADDERNAMEN = Object.keys(LADDERS);
const BPM_SPEELRUIMTE_MIN = 0;     // een universum mag ook een vast tempo hebben

/* De regel die de maker vastlegt. Alles wat er niet in past vervalt en krijgt
   een verstandige waarde -- behalve de stijl: die IS het universum, en een
   onbekende stijl stil vervangen door house zou de maker iets anders laten
   uitgeven dan hij bedoelde (zelfde regel als het onbekende instrument in
   kern/muziek.js: weg is eerlijker). */
function schoonUniversum(v) {
  if (!v || typeof v !== 'object') return null;
  const stijl = String(v.stijl || '');
  if (!STIJLNAMEN.includes(stijl)) return null;
  const s = STIJLEN[stijl];
  const ladder = LADDERNAMEN.includes(String(v.ladder || '')) ? String(v.ladder) : s.ladder;
  const maten = Math.max(1, Math.min(I.MAX_MATEN, Math.round(Number(v.maten)) || 8));
  let min = Math.round(Number(v.bpmMin)), max = Math.round(Number(v.bpmMax));
  if (!Number.isFinite(min)) min = s.bpm;
  if (!Number.isFinite(max)) max = s.bpm;
  min = Math.max(I.BPM_MIN, Math.min(I.BPM_MAX, min));
  max = Math.max(I.BPM_MIN, Math.min(I.BPM_MAX, max));
  if (max < min) { const t = min; min = max; max = t; }
  return { stijl, ladder, maten, bpmMin: min, bpmMax: max, lied: !!v.lied };
}

/* Het zaad. Zonder opgegeven zaad krijgt elke luisteraar zijn EIGEN vertolking,
   en die blijft de hele dag hetzelfde: "Night Drive -- jouw uitvoering van
   vandaag" hoort niet te veranderen terwijl je luistert. Het zaad is dus een
   som van het stuk, de luisteraar en de dag -- geen toeval, want dan was hij
   niet terug te vinden. */
function zaadVan(uitgaveId, luisteraar, dag) {
  const s = String(uitgaveId) + '|' + String(luisteraar || 'gast') + '|' + String(dag || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* De vertolking: wat er NU klinkt, binnen de grenzen van de maker. Alles wordt
   uit het zaad afgeleid, ook het tempo -- dus dezelfde zaad geeft tot op de
   noot hetzelfde stuk. */
function vertolk(universum, zaad) {
  const u = schoonUniversum(universum);
  if (!u) return null;
  const z = (Number(zaad) >>> 0) || 1;
  const rnd = zaadRnd(z);
  /* Het tempo komt uit een EIGEN toevalsdraad-trekking vóór de kanalen, zodat
     het verschuiven van het bereik de noten niet verandert en andersom. */
  const bpm = u.bpmMax > u.bpmMin ? u.bpmMin + Math.floor(rnd() * (u.bpmMax - u.bpmMin + 1)) : u.bpmMin;
  const kanalen = bouw(u.stijl, u.maten, u.ladder, z);
  let secties = [];
  if (u.lied) { try { secties = LIED.vorm(u.maten); } catch (e) { secties = []; } }
  return {
    zaad: z, bpm, maten: u.maten, kanalen, secties,
    universum: u,
    let: 'Dit is één vertolking van dit universum, binnen de grenzen die de maker heeft vastgelegd. ' +
      'Met hetzelfde zaad klinkt hij weer precies zo.'
  };
}

/* EEN VERTOLKING OPHALEN voor een uitgave. Zonder opgegeven zaad krijgt elke
   luisteraar zijn eigen vertolking, en die blijft de hele dag hetzelfde -- een
   stuk hoort niet te veranderen terwijl je ernaar luistert. Mét zaad is hij tot
   op de noot terug te vinden, en dat is wat "elke keer anders" onderscheidt van
   ruis.

   Deze functie woont hier en niet in ./muziek-uitgave.js, en dat is niet alleen
   omdat dat bestand over de keuringsgrens liep: dit bestand bezit de REGEL, dus
   het hoort ook te bepalen wat eruit klinkt. */
function maakVertolking({ uitgaveMet, nu }) {
  function vertolking(sess, invoer) {
    const v = invoer || {};
    const u = uitgaveMet(v.id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    if (!u.universum) return { status: 409, error: 'Dit stuk is een opname en geen universum; er valt niets te vertolken.' };
    const dag = nu().slice(0, 10);
    const zaad = Number(v.zaad) > 0 ? Number(v.zaad) : zaadVan(u.id, sess.key, dag);
    const r = vertolk(u.universum, zaad);
    if (!r) return { status: 409, error: 'Het universum van dit stuk is niet te lezen.' };
    return Object.assign({ status: 200, uitgaveId: u.id, naam: u.naam }, r);
  }
  return { vertolking };
}

module.exports = { schoonUniversum, vertolk, zaadVan, maakVertolking, LADDERNAMEN, STIJLNAMEN, BPM_SPEELRUIMTE_MIN };
