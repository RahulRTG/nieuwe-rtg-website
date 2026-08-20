/* RTG Festival (deelmodule): de KALENDER -- festival, editie en dag.

   Zie FESTIVAL.md voor de doctrine. Dit bestand draagt de tijd; ./terrein.js
   draagt de plaats. Die twee zijn met opzet uit elkaar gehouden: een editie
   verhuist zelden en een terrein verandert elk jaar, en wie ze in een bestand
   zet krijgt de wijziging van het een altijd bovenop het ander.

   WAAROM EEN DAG EEN OBJECT IS EN GEEN DATUM (FESTIVAL.md par. 3.2). Een
   festivaldag opent om 12:00, sluit om 02:00 en heeft een curfew om 01:00 die
   NIET hetzelfde is als de sluiting. Hij loopt dus over middernacht heen, en
   alles wat erin gebeurt moet daar doorheen kunnen rekenen: een recht dat van
   23:00 tot 01:00 geldt, een set die om 00:30 begint, een scan om 01:12.

   DE TRUC: reken niet in kloktijd maar in MINUTEN NA OPENING. Dan is 01:12 op
   een dag die om 12:00 opende gewoon minuut 792, ligt dat netjes na minuut 660
   (23:00), en hoeft nergens anders in deze wereld nog een middernachtgeval te
   staan. Elke tijdvergelijking loopt hierlangs (LAT-regel 4). */
'use strict';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/* Minuten sinds middernacht. Alleen voor intern rekenen; naar buiten toe gaat
   altijd de offset, want dat is het getal dat over middernacht heen klopt. */
const klok = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/* MINUTEN NA OPENING, of null als het moment buiten de dag valt.

   De modulo doet het middernachtwerk: (tijd - opening + 1440) % 1440 geeft voor
   elk moment het aantal minuten dat er sinds de opening verstreken is, of de
   dag nu wel of niet over 00:00 heen loopt. Valt dat getal voorbij de duur van
   de dag, dan hoort het moment bij een andere dag -- en dat is precies de
   controle die anders vergeten wordt. */
function offset(dag, tijd) {
  if (!dag || !HHMM.test(String(tijd || ''))) return null;
  const o = klok(dag.open), s = klok(dag.sluit);
  const duur = (s - o + 1440) % 1440;
  const na = (klok(tijd) - o + 1440) % 1440;
  return na <= duur ? na : null;
}

/* HET MOMENT, EXACT: minuten na opening, gerekend met de KALENDERDATUM erbij.

   offset() hierboven kent alleen een kloktijd, en dat is niet genoeg zodra twee
   opeenvolgende dagen allebei over middernacht heen lopen. Een scan om 01:12 op
   4 juli hoort bij de dag van 3 juli (die om 12:00 opende en om 02:00 sluit),
   maar offset() zou hem OOK binnen de dag van 4 juli vinden -- daar is 01:12
   immers ook minuut 792, alleen dan van 5 juli. Twee dagen claimen dan hetzelfde
   moment, en welke wint hangt af van de volgorde in een lijst.

   Met de datum erbij is er geen keuze meer: de dag begint op een absoluut
   moment, het moment ligt erin of niet. Alles wat een ECHT tijdstip vergelijkt
   (welke dag hoort hierbij, wanneer werd er gescand) loopt hierlangs; offset()
   blijft voor wat het is -- een kloktijd binnen een dag, zoals een curfew of het
   venster van een recht. */
const dagnummer = (datum) => Math.floor(Date.parse(datum + 'T00:00:00Z') / 86400000);

function momentOffset(dag, datum, tijd) {
  if (!dag || !DATUM.test(String(datum || '')) || !HHMM.test(String(tijd || ''))) return null;
  const start = dagnummer(dag.datum) * 1440 + klok(dag.open);
  const na = dagnummer(datum) * 1440 + klok(tijd) - start;
  return (na >= 0 && na <= duurVan(dag)) ? na : null;
}

/* De duur van een dag in minuten. Losstaand omdat ./rechten.js hem ook nodig
   heeft om een venster te begrenzen, en een tweede berekening ervan zou de
   eerste stilletjes tegen kunnen spreken. */
const duurVan = (dag) => dag ? (klok(dag.sluit) - klok(dag.open) + 1440) % 1440 : 0;

module.exports = (ctx) => {
  const { db, save, crypto, schoon } = ctx;

  const id = (p) => p + crypto.randomBytes(4).toString('hex');

  function bak() {
    if (!db.data.festivals || typeof db.data.festivals !== 'object') db.data.festivals = {};
    return db.data.festivals;
  }

  const festivalVind = (fid) => bak()[String(fid || '')] || null;

  function editieVind(fid, eid) {
    const f = festivalVind(fid);
    if (!f) return null;
    return (f.edities || {})[String(eid || '')] || null;
  }

  /* ---------- het festival ----------

     De EIGENAAR is een verwijzing en geen kopie: de code van de zaak of de
     entiteit die dit festival draait. Wie hier naam, KvK of adres zou
     overschrijven, bouwt de tweede waarheid die kern/concern/ nu juist kwam
     opruimen (CONCERN.md wet 4). */
  function festivalNieuw(eigenaar, data) {
    const naam = schoon((data || {}).naam, 80);
    if (!naam) return { status: 400, error: 'Geef het festival een naam.' };
    const code = schoon(eigenaar, 40);
    if (!code) return { status: 400, error: 'Een festival hangt aan een zaak of entiteit.' };
    const f = { id: id('fes'), naam, eigenaar: code, edities: {}, at: new Date().toISOString() };
    bak()[f.id] = f;
    save();
    return { ok: true, festival: publiek(f) };
  }

  /* ---------- de editie ----------

     Een editie is het jaar dat draait. Alles wat vergankelijk is hangt eraan:
     de dagen, het terrein, de passen, de scans. Dat is geen ordening voor de
     nettigheid maar de reden dat de opruiming later kan kloppen -- een editie
     is het ding dat afloopt, en FESTIVAL.md par. 5.8 belooft dat er dingen
     verlopen als hij afloopt. */
  function editieNieuw(fid, data) {
    const f = festivalVind(fid);
    if (!f) return { status: 404, error: 'Dit festival bestaat niet.' };
    const naam = schoon((data || {}).naam, 80) || f.naam;
    const jaar = parseInt((data || {}).jaar, 10);
    if (!(jaar >= 2000 && jaar <= 2100)) return { status: 400, error: 'Geef een geldig jaar op.' };
    const e = { id: id('ed'), naam, jaar, dagen: [], plekken: {}, producten: {}, passen: {}, at: new Date().toISOString() };
    f.edities[e.id] = e;
    save();
    return { ok: true, editie: publiekeEditie(e) };
  }

  /* ---------- de dag ----------

     DRIE TIJDEN EN GEEN TWEE. De curfew is wettelijk of contractueel het moment
     waarop het geluid uit moet; de sluiting is wanneer het terrein leeg hoort te
     zijn. Ze vallen bijna nooit samen, en een systeem dat ze samenneemt kan het
     verschil tussen "de laatste set is voorbij" en "iedereen is weg" niet meer
     zien -- terwijl juist dat verschil de uitstroompiek IS waar par. 2 van de
     cockpit over gaat. */
  function dagZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const datum = String(d.datum || '');
    if (!DATUM.test(datum)) return { status: 400, error: 'Geef de datum als jjjj-mm-dd.' };
    if (!HHMM.test(String(d.open || '')) || !HHMM.test(String(d.sluit || '')))
      return { status: 400, error: 'Geef opening en sluiting als uu:mm.' };
    if (d.open === d.sluit) return { status: 400, error: 'Opening en sluiting mogen niet gelijk zijn.' };
    if (d.curfew != null && d.curfew !== '' && !HHMM.test(String(d.curfew)))
      return { status: 400, error: 'Geef de curfew als uu:mm.' };
    const dag = { id: id('dag'), datum, open: String(d.open), sluit: String(d.sluit), curfew: d.curfew ? String(d.curfew) : null };
    /* De curfew hoort BINNEN de dag te liggen. Zonder deze controle kon iemand
       een curfew om 15:00 zetten op een dag die om 18:00 opent, en dan staat er
       een geluidsstop die nooit valt -- een belofte in tekst zonder code
       (LAT-regel 6). */
    if (dag.curfew && offset(dag, dag.curfew) === null)
      return { status: 400, error: 'De curfew valt buiten de openingstijden van deze dag.' };
    if (e.dagen.some(x => x.datum === datum)) return { status: 409, error: 'Deze datum staat al in de editie.' };
    if (e.dagen.length >= 30) return { status: 400, error: 'Tot dertig dagen per editie.' };
    e.dagen.push(dag);
    e.dagen.sort((a, b) => a.datum.localeCompare(b.datum));
    save();
    return { ok: true, dag };
  }

  const dagVind = (e, dagId) => (e && Array.isArray(e.dagen) ? e.dagen.find(d => d.id === String(dagId || '')) : null) || null;

  /* Welke dag hoort bij dit moment? Een scan om 01:12 hoort bij de dag die
     gisteren om 12:00 opende, en dat is precies waar een naief `datum ===
     vandaag` de mist in gaat -- de fout die het huidige ticketmodel maakt
     (FESTIVAL.md par. 2, punt 3).

     Met momentOffset kan er hoogstens EEN dag zijn die dit moment bevat, want
     de dagen van een editie overlappen niet. Er wordt dus niet gekozen; er
     wordt gevonden. */
  function dagOpMoment(e, datum, tijd) {
    if (!e || !Array.isArray(e.dagen)) return null;
    return e.dagen.find(d => momentOffset(d, datum, tijd) !== null) || null;
  }

  const publiek = (f) => ({ id: f.id, naam: f.naam, eigenaar: f.eigenaar,
    edities: Object.values(f.edities || {}).map(publiekeEditie) });
  const publiekeEditie = (e) => ({ id: e.id, naam: e.naam, jaar: e.jaar, dagen: e.dagen || [],
    plekken: Object.keys(e.plekken || {}).length, passen: Object.keys(e.passen || {}).length });

  return { festivalNieuw, festivalVind, editieNieuw, editieVind, dagZet, dagVind, dagOpMoment,
    offset, momentOffset, duurVan, publiekFestival: publiek, HHMM };
};

module.exports.offset = offset;
module.exports.momentOffset = momentOffset;
module.exports.duurVan = duurVan;
