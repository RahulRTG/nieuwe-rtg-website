/* VRIJHEID: DE TIJDCATEGORIEEN -- hard gescheiden, en dat is het ontwerp.

   Een vakantiedag, een RTG Day, verjaardagvrijheid en eerder naar huis zien er
   in een rooster allemaal uit als "niet aan het werk". De klassieke fout is ze
   daarom op een teller te zetten, en dan verdwijnt een wettelijke vakantiedag
   ongemerkt in een benefit dat RTG juist EXTRA gaf. Hier draagt elke categorie
   zijn eigen teller (of geen), en er is geen functie die de ene categorie van
   de teller van een andere afschrijft. Die functie bestaat niet, dus kan
   niemand hem per ongeluk aanroepen.

   VRIJHEID.md par. 3. De namen zijn met opzet de hoofdletternamen uit de
   opdracht: `vrijgave` is in dit huis al bezet (de productiepoorten in
   server/config/), en een tweede betekenis op dat woord is de VERMOGENS-fout.

   Wat hier NIET staat: hoeveel dagen, welk loon, welk percentage. Dat is
   beleid (beleid.js) en voor een deel juridisch nog niet gevalideerd. Hier
   staat alleen WAT een categorie is en van welke teller hij mag afschrijven. */
'use strict';

/* teller: de enige teller waar deze categorie van mag afschrijven, of null.
   aanvullend: bovenop een recht, nooit in plaats ervan.
   betaald: 'ja' | 'nee' | 'beleid' (dan beslist de laag die het recht kent). */
const CATEGORIEEN = Object.freeze({
  STATUTORY_LEAVE:      Object.freeze({ naam: 'Vakantie',                teller: 'wettelijk',   aanvullend: false, betaald: 'ja',     bron: 'LEGAL_BASELINE' }),
  CONTRACTUAL_LEAVE:    Object.freeze({ naam: 'Bovenwettelijk verlof',   teller: 'contractueel', aanvullend: false, betaald: 'ja',    bron: 'CONTRACT' }),
  RTG_DAY:              Object.freeze({ naam: 'RTG Day',                 teller: 'rtgDag',      aanvullend: true,  betaald: 'ja',     bron: 'RTG_ADDITIONAL_BENEFIT' }),
  BIRTHDAY_LEAVE:       Object.freeze({ naam: 'Uw verjaardag',           teller: null,          aanvullend: true,  betaald: 'ja',     bron: 'RTG_ADDITIONAL_BENEFIT' }),
  FREEDOM_RELEASE:      Object.freeze({ naam: 'Eerder naar huis',        teller: null,          aanvullend: true,  betaald: 'ja',     bron: 'RTG_ADDITIONAL_BENEFIT' }),
  RECOVERY_RELEASE:     Object.freeze({ naam: 'Hersteltijd',             teller: null,          aanvullend: true,  betaald: 'ja',     bron: 'RTG_ADDITIONAL_BENEFIT' }),
  SCHEDULE_FLEXIBILITY: Object.freeze({ naam: 'Andere werktijd',         teller: null,          aanvullend: false, betaald: 'beleid', bron: 'ORGANIZATION_POLICY' }),
  SPECIAL_LEAVE:        Object.freeze({ naam: 'Bijzonder verlof',        teller: null,          aanvullend: false, betaald: 'beleid', bron: 'LEGAL_BASELINE' }),
  UNPAID_LEAVE:         Object.freeze({ naam: 'Onbetaald verlof',        teller: null,          aanvullend: false, betaald: 'nee',    bron: 'CONTRACT' })
});

/* De eenheid per teller: vakantie telt in uren (zoals de wet), een RTG Day is
   een DAG -- een parttimer met een korte dienst levert geen halve RTG Day in. */
const EENHEID = Object.freeze({ wettelijk: 'uur', contractueel: 'uur', rtgDag: 'dag' });

/* De aanvullende categorieen: het RTG-deel. Afgeleid, niet overgetypt. */
const AANVULLEND = Object.freeze(Object.keys(CATEGORIEEN).filter(k => CATEGORIEEN[k].aanvullend));

/* Een boeking is het enige dat een saldo beweegt. Hij draagt ZIJN categorie,
   en de teller komt uit de categorie -- nooit uit de aanroeper. Wie een
   `teller` meegeeft, wordt geweigerd: dat is precies de deur waardoor een
   benefit van het vakantiesaldo zou worden afgeschreven. */
function boeking({ categorie, uren, datum, persoon, betaaldeUren }) {
  const c = CATEGORIEEN[categorie];
  if (!c) return { fout: 'onbekende-categorie', reden: 'Categorie ' + categorie + ' bestaat niet.' };
  if (!(Number(uren) >= 0)) return { fout: 'uren', reden: 'Uren moeten nul of meer zijn.' };
  return Object.freeze({
    categorie, persoon: String(persoon), datum: String(datum), uren: Number(uren),
    teller: c.teller,
    afschrijving: !c.teller ? 0 : EENHEID[c.teller] === 'dag' ? 1 : Number(uren),
    /* Betaalde uren blijven staan voor wat al betaald was. Een aanvullende
       categorie verlaagt nooit het loon: de uren die ingepland stonden, blijven
       betaald (NO_FREEDOM_RELEASE_REDUCES_PAY). */
    betaaldeUren: c.betaald === 'nee' ? 0 : betaaldeUren != null ? Number(betaaldeUren) : c.betaald === 'beleid' ? null : Number(uren)
  });
}

/* Saldo per teller uit een lijst boekingen. Een teller die niet bestaat in het
   recht komt niet in het antwoord -- geen nul verzinnen. */
function saldi(rechten, boekingen) {
  const uit = {};
  for (const [teller, recht] of Object.entries(rechten || {})) {
    if (recht == null) { uit[teller] = { recht: null, reden: 'Niet vastgesteld in beleid.' }; continue; }
    const af = (boekingen || []).filter(b => b.teller === teller).reduce((s, b) => s + b.afschrijving, 0);
    uit[teller] = { recht: Number(recht), gebruikt: af, over: Number(recht) - af };
  }
  return uit;
}

/* DE INVARIANTEN, als een functie die een lijst boekingen nakijkt. Een
   overtreding is een bevinding met een naam; een lege lijst is in orde. */
function invarianten(boekingen, geplandeUren) {
  const fout = [];
  for (const b of boekingen || []) {
    const c = CATEGORIEEN[b.categorie];
    if (!c) { fout.push({ regel: 'ONBEKENDE_CATEGORIE', boeking: b }); continue; }
    if (c.aanvullend && (b.teller === 'wettelijk' || b.teller === 'contractueel'))
      fout.push({ regel: 'NO_RTG_BENEFIT_DEDUCTS_STATUTORY_LEAVE', boeking: b });
    if (b.categorie === 'BIRTHDAY_LEAVE' && b.afschrijving > 0)
      fout.push({ regel: 'NO_BIRTHDAY_LEAVE_DEDUCTS_NORMAL_LEAVE', boeking: b });
    if (b.categorie === 'FREEDOM_RELEASE' && b.afschrijving > 0)
      fout.push({ regel: 'NO_FREEDOM_RELEASE_DEDUCTS_NORMAL_LEAVE', boeking: b });
    if (b.categorie === 'RTG_DAY' && b.teller !== 'rtgDag')
      fout.push({ regel: 'RTG_DAY_OP_EIGEN_TELLER', boeking: b });
    const gepland = geplandeUren && geplandeUren[b.persoon + '|' + b.datum];
    if (c.aanvullend && gepland != null && !(b.betaaldeUren >= gepland))
      fout.push({ regel: b.categorie === 'FREEDOM_RELEASE' ? 'NO_FREEDOM_RELEASE_REDUCES_PAY' : 'NO_RTG_BENEFIT_REDUCES_PAY', boeking: b });
  }
  return fout;
}

module.exports = { CATEGORIEEN, EENHEID, AANVULLEND, boeking, saldi, invarianten };
