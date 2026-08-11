/* Magnaat: HET KREDIETPROFIEL -- waarom jouw geld duurder is dan dat van hem.

   HET IS ZICHTBAAR, EN DAT IS HET HELE PUNT. Een verborgen kredietscore die je
   rente bepaalt is een dobbelsteen met een verhaaltje eromheen: je merkt het
   pas als je een offerte krijgt en je kunt er niets mee. Een zichtbaar profiel
   is een DOEL. Wie ziet dat zijn schuldpositie op twee sterren staat, weet
   precies wat hij deze maand kan doen -- en dat is een strategie in plaats van
   een straf.

   VIJF ASSEN, EN ALLE VIJF KOMEN ZE UIT WAT DE SPELER DOET. Geen enkele is een
   los cijfer dat ergens wordt bijgehouden; ze worden ALLEMAAL afgeleid uit de
   toestand van dit moment. Dat is geen netheid maar een eis: een score die
   apart wordt bijgehouden loopt uiteen met de werkelijkheid waar hij over gaat,
   en dan legt de bank iets uit dat niet klopt.

     liquiditeit           kas ten opzichte van je jaarlasten
     schuldpositie         schuld ten opzichte van je vermogen
     betalingsdiscipline   heb je aflossingen gemist, en hoe vaak
     contractzekerheid     leveren je contracten wat ze beloven
     winststabiliteit      hoe grillig je maandresultaat is

   DE ENIGE DIE GESCHIEDENIS NODIG HEEFT is de laatste. Grilligheid is per
   definitie een reeks, dus er staat een kort logboek van maandresultaten in de
   staat -- twaalf maanden, meer niet. Wat langer geleden is dan een jaar zegt
   niets meer over hoe dit bedrijf vandaag draait, en een oneindig logboek is
   opslag die niemand heeft gevraagd (dezelfde afspraak als bij de dagopgave).

   ELKE AS LOOPT VAN 0 TOT 1 en wordt voor het scherm in vijf sterren vertaald.
   De sterren zijn de weergave; de rente rekent met het getal, want vijf
   drempels zouden betekenen dat een euro erbij je ineens een halve procent
   scheelt. */
const klem = (n, a, b) => Math.max(a, Math.min(b, n));
const MAANDEN_GEHEUGEN = 12;

/* Een reeks vertalen naar "hoe stabiel is dit". De variatiecoefficient, maar
   dan begrensd en omgedraaid: 1 is saai en voorspelbaar, 0 is een achtbaan.
   Bij minder dan drie maanden is er niets te zeggen, en dan is het antwoord
   NIET "slecht" maar "neutraal" -- een starter is niet onbetrouwbaar, hij is
   onbekend, en dat verschil hoort een bank te maken. */
function stabiliteit(reeks) {
  if (!reeks || reeks.length < 3) return 0.5;
  const gem = reeks.reduce((n, x) => n + x, 0) / reeks.length;
  if (Math.abs(gem) < 1) return 0.5;
  const variantie = reeks.reduce((n, x) => n + (x - gem) ** 2, 0) / reeks.length;
  return klem(1 - Math.sqrt(variantie) / Math.abs(gem) / 2, 0, 1);
}

module.exports = ({ waarde }) => {
  /* De harde cijfers waar zowel het profiel als de convenanten op rusten. Een
     keer uitgerekend en aan beide kanten gebruikt: twee berekeningen van
     dezelfde verhouding lopen uiteen. */
  function cijfers(st, h) {
    const rij = st.vestigingen[h] || [];
    const leningen = (st.leningen || []).filter(l => l.speler === h && l.status === 'loopt');
    const schuld = leningen.reduce((n, l) => n + l.restant, 0);
    const ondernemingswaarde = rij.reduce((n, v) => n + waarde(v), 0);
    const kas = st.geld[h] || 0;
    const vermogen = kas + ondernemingswaarde - schuld;
    // wat er per maand sowieso uitgaat: lonen, vaste lasten, huur, rente
    const maandlast = rij.reduce((n, v) => n + v.huur + (v.onderhoudBudget || 0) + (v.marketing || 0), 0)
      + leningen.reduce((n, l) => n + l.restant * (l.rente + (l.opslag || 0)), 0);
    const reeks = (st.resultaatlog || {})[h] || [];
    const jaarwinst = reeks.length ? reeks.reduce((n, x) => n + x, 0) / reeks.length * 12 : 0;
    return {
      kas, schuld, ondernemingswaarde, vermogen, maandlast, jaarwinst, reeks,
      // de twee waar de convenanten op staan
      buffer: maandlast > 0 ? kas / (maandlast * 12) : (kas > 0 ? 1 : 0),
      schuldlast: jaarwinst > 0 ? schuld / jaarwinst : (schuld > 0 ? 99 : 0),
      achtergesteld: leningen.filter(l => l.soort === 'achtergesteld').reduce((n, l) => n + l.restant, 0)
    };
  }

  function profiel(st, h) {
    const c = cijfers(st, h);
    const gemist = (st.betaalgemist || {})[h] || 0;
    const con = (st.contracten || []).filter(x => x.leverancier === h && x.maandenGeleverd + x.maandenTekort > 0);
    const geleverd = con.reduce((n, x) => n + x.maandenGeleverd, 0);
    const totaal = con.reduce((n, x) => n + x.maandenGeleverd + x.maandenTekort, 0);
    return {
      liquiditeit: klem(c.buffer / 0.30, 0, 1),
      schuldpositie: klem(1 - c.schuldlast / 8, 0, 1),
      betalingsdiscipline: klem(1 - gemist / 6, 0, 1),
      /* Geen contracten is GEEN slechte score. Wie er nooit een tekende heeft
         niets gebroken; hem daarvoor laten betalen zou betekenen dat de bank
         een speler straft voor een laag die hij niet gebruikt. */
      contractzekerheid: totaal > 0 ? klem(geleverd / totaal, 0, 1) : 0.7,
      winststabiliteit: stabiliteit(c.reeks)
    };
  }

  const sterren = (x) => Math.max(1, Math.round(x * 5));
  /* Het faillissementsrisico is een SAMENVATTING en geen zesde as: hij wordt uit
     de andere vijf afgeleid zodat er nooit een cijfer op het scherm staat dat
     de rest tegenspreekt. */
  function beeld(st, h) {
    const p = profiel(st, h), c = cijfers(st, h);
    const gemiddeld = Object.values(p).reduce((n, x) => n + x, 0) / 5;
    return {
      assen: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { waarde: v, sterren: sterren(v) }])),
      risico: gemiddeld > 0.75 ? 'laag' : gemiddeld > 0.5 ? 'gemiddeld' : gemiddeld > 0.3 ? 'verhoogd' : 'hoog',
      kas: Math.round(c.kas), schuld: Math.round(c.schuld), vermogen: Math.round(c.vermogen),
      buffer: Math.round(c.buffer * 100) / 100, schuldlast: Math.round(c.schuldlast * 10) / 10
    };
  }

  /* Het maandresultaat bijschrijven in het korte geheugen. Wordt door de
     maandloop aangeroepen; twaalf maanden en niet meer. */
  function onthoud(st, h, resultaat) {
    const log = st.resultaatlog = st.resultaatlog || {};
    const rij = log[h] = log[h] || [];
    rij.push(Math.round(resultaat));
    while (rij.length > MAANDEN_GEHEUGEN) rij.shift();
  }

  return { cijfers, profiel, beeld, onthoud, stabiliteit, sterren, MAANDEN_GEHEUGEN };
};
