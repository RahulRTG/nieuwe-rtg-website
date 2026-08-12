/* Magnaat: LOKALE GOVERNANCE -- wie beslist wat de Foundation bouwt.

   Fase C, het laatste stuk. Tot nu toe lag de volgorde van ./foundation.js
   VAST: `f.volgend` liep de lijst af, en waar een project landde volgde uit de
   bedrijvigheid. Dat was goed genoeg zolang de Foundation een gevolg was van
   de economie. Hij is dat niet meer: hij verschuift zone-eigenschappen waar
   iedereen mee rekent, dus hij is een KEUZE geworden en die hoort bij de mensen
   aan tafel te liggen.

   DIT IS WAT `lokale governance` MOET ZIJN EN NIET MEER. Geen burgemeester,
   geen partijen, geen wetten. Een stemming over de ene vraag die de stad echt
   verandert: wat komt er hierna, en in welke buurt.

   ======================== VIJF REGELS ========================

   1. EEN STEM IS EEN STEM. Niet gewogen naar vermogen, omzet of aantal zaken.
      Dat is de scherpste regel van deze laag: zou een stem meewegen met wat je
      bezit, dan IS de rijkste speler het bestuur, en dan is governance een
      tweede ranglijst met een ander woord erop. Wie meespeelt telt even zwaar.

   2. STEMMEN KOST NIETS, EN NIET STEMMEN KOST OOK NIETS. Geen inleg, geen
      boete, geen gemiste beurt. Dat is VERHAAL.md grens 4 (weg zijn mag niets
      kosten) en CLAUDE.md in een adem: een stemming met een deadline die je
      iets kost, is kunstmatige urgentie.

   3. DE MEERDERHEID BESLIST WAT ER BIJKOMT, NOOIT WAT ER WEGGAAT. Er is geen
      besluit dat iemand iets AFNEEMT -- geen belasting, geen onteigening, geen
      verbod op een sector. Een meerderheid die een minderheid kan uitkleden is
      geen governance maar een pestmechaniek, en die bouwen we niet.

   4. ZONDER STEM VERANDERT ER NIETS. Heeft niemand gestemd, dan geldt precies
      de oude vaste volgorde. Deze laag is dus VOLLEDIG weglaatbaar: een tafel
      die er niets mee doet speelt de campagne zoals hij was. Dat is de eis dat
      elke fase speelbaar is zonder de volgende.

   5. HIJ IS DETERMINISTISCH. Gelijke stand wordt gebroken door de vaste
      lijstvolgorde en niet door toeval of door wie het eerst stemde: de klok
      REKENT BIJ, dus tien maanden in een keer horen hetzelfde te bouwen als
      tien maanden los (GAMEHALL.md 12.4).

   WIE STEMT ER. Iedereen aan tafel die nog meespeelt -- ook wie geen enkele
   zaak heeft. De Foundation bouwt voor de STAD en niet voor de ondernemers, en
   een stemrecht dat aan bezit hangt is regel 1 door de achterdeur. Wie is
   uitgestapt stemt niet meer; hij woont er niet meer. */
'use strict';
const F = require('./foundation');

/* De lijst waarop gestemd wordt: alles wat nog niet gebouwd is. Niet "de
   volgende drie" -- een keuze uit een voorgeselecteerd rijtje is de vaste
   volgorde met een stemhokje ervoor. */
const openProjecten = (f) => F.PROJECTEN.filter(p => !f.gedaan.some(g => g.id === p.id));

const stemmen = (st) => (st.foundation.stemmen = st.foundation.stemmen || {});

/* STEMMEN. Je laatste stem telt, en je mag hem altijd wijzigen of intrekken --
   een stem die vastligt is een verplichting, en die zou je moeten bijhouden
   terwijl je weg bent. */
function stem(potje, h, projectId, zone) {
  const st = potje.staat;
  const f = st.foundation;
  if (projectId === null || projectId === '') { delete stemmen(st)[h]; return { status: 200, ok: true, ingetrokken: true }; }
  const p = openProjecten(f).find(x => x.id === String(projectId));
  if (!p) return { status: 400, error: 'Dat project staat niet meer op de lijst.' };
  const zones = (potje.kaart || { zones: [] }).zones;
  const zoneId = zone === undefined || zone === null || zone === '' ? null : String(zone);
  if (zoneId && !zones.some(z => z.id === zoneId))
    return { status: 400, error: 'Die buurt bestaat niet in deze stad.' };
  stemmen(st)[h] = { project: p.id, zone: zoneId, maand: st.maand };
  return { status: 200, ok: true, project: p.id, zone: zoneId };
}

/* WAT DE TAFEL WIL. Telt de stemmen van wie nog meespeelt, en geeft terug wat
   er wint -- of null als er niets is gekozen, en dan blijft de vaste volgorde
   staan zoals hij was.

   HIJ TELT ELKE STEM EEN KEER en leest geen enkel bedrag. Zie regel 1. */
function uitslag(potje, meedoen) {
  const st = potje.staat, f = st.foundation;
  const lijst = openProjecten(f);
  if (!lijst.length) return null;
  const perProject = {}, perZone = {};
  for (const [h, s] of Object.entries(stemmen(st))) {
    if (!meedoen(st, h)) continue;
    if (!lijst.some(p => p.id === s.project)) continue;
    perProject[s.project] = (perProject[s.project] || 0) + 1;
    if (s.zone) {
      (perZone[s.project] = perZone[s.project] || {});
      perZone[s.project][s.zone] = (perZone[s.project][s.zone] || 0) + 1;
    }
  }
  /* GELIJKE STAND BREEKT OP DE VASTE LIJSTVOLGORDE. Niet op wie het eerst
     stemde: dan hangt de uitkomst aan de volgorde waarin de staat is
     opgeschreven, en dat is precies wat een deterministische klok verbiedt. */
  let winnaar = null, meeste = 0;
  for (const p of lijst) {
    const n = perProject[p.id] || 0;
    if (n > meeste) { meeste = n; winnaar = p; }
  }
  if (!winnaar) return null;
  let zone = null, zoneste = 0;
  for (const z of (potje.kaart || { zones: [] }).zones) {
    const n = ((perZone[winnaar.id] || {})[z.id]) || 0;
    if (n > zoneste) { zoneste = n; zone = z.id; }
  }
  return { project: winnaar, stemmen: meeste, zone, zoneStemmen: zoneste,
    totaal: Object.keys(perProject).reduce((n, k) => n + perProject[k], 0) };
}

/* WAT ER OP HET SCHERM STAAT. Aantallen en geen namen: wie op wat stemde gaat
   de tafel niet aan, en een zichtbare stemlijst maakt van een keuze een
   onderhandeling met publiek. Je eigen stem zie je wel -- anders weet je niet
   of hij is aangekomen. */
function beeld(potje, h, meedoen) {
  const st = potje.staat, f = st.foundation;
  const lijst = openProjecten(f);
  const telling = {};
  for (const [wie, s] of Object.entries(stemmen(st)))
    if (meedoen(st, wie)) telling[s.project] = (telling[s.project] || 0) + 1;
  const wint = uitslag(potje, meedoen);
  return {
    pot: Math.round(f.lokaal),
    projecten: lijst.map(p => ({ id: p.id, naam: p.naam, tekst: p.tekst, kosten: p.kosten,
      stemmen: telling[p.id] || 0, bijnaGenoeg: f.lokaal >= p.kosten })),
    mijn: stemmen(st)[h] || null,
    wint: wint ? { id: wint.project.id, naam: wint.project.naam, zone: wint.zone } : null,
    /* De regel er in woorden bij, want een stemming waarvan je de regels niet
       kent is een knop en geen keuze. */
    regels: ['Elke speler heeft een stem; wat je bezit telt niet mee.',
      'Stemmen kost niets, en niet stemmen kost ook niets.',
      'Er wordt alleen besloten wat erbij komt, nooit wat iemand wordt afgenomen.',
      'Stemt niemand, dan bouwt de Foundation de vaste volgorde af.']
  };
}

module.exports = { stem, uitslag, beeld, openProjecten };
