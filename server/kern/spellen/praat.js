/* Spellen (deelmodule): praten IN het potje.

   EEN GESPREK IS EEN GESPREK. Deze laag bouwt geen berichtenvoorraad: hij
   maakt een gesprek aan in de communicatiekern (kern/comm) met soort 'group'
   en `meta.sleutel = 'potje:<id>'`, en stuurt daar berichten in. Dat is niet
   netheid maar de reden dat het klopt: die kern heeft al een bewaartermijn
   (bewaarbeleid.js), al een wisrecht (vergeten/gesprekken.js), al een leesstand
   en al een sein naar de andere kant. Een zevende chatvoorraad zou dat alles
   opnieuw moeten leren, en net iets anders doen.

   DE REGEL DIE ERBOVEN STAAT: EEN POTJE GEEFT GEEN NIEUW RECHT OM IEMAND TE
   BEREIKEN. Chatten kan alleen als ELK PAAR aan tafel elkaar buiten dit potje
   ook al mag bereiken -- vrienden of klasgenoten. Dat is geen voorzichtigheid:
   de wachtrij koppelt WILLEKEURIGE spelers, dus zonder deze regel is "even een
   potje dammen" de kortste weg naar een open lijn met een vreemde. En omdat de
   RTF-app tieners bevat die met opzet onvindbaar zijn in de zoeker, zou dat
   precies de poort omzeilen die daarvoor gebouwd is.

   Elk PAAR, en niet "iedereen die ik ken": in een groepsruimte praat ook B
   tegen C. Zou de controle alleen naar mijn eigen kant kijken, dan kan ik twee
   mensen die elkaar niet mogen bereiken in een kamer zetten door ze allebei
   uit te nodigen. Wat "bereiken" precies is -- vrienden, klasgenoten, hetzelfde
   gezin -- staat in ./kring.js en niet hier, want het teamuitnodigen stelt
   dezelfde vraag en twee antwoorden gaan uiteen.

   LEZEN MAAKT GEEN GESPREK. Het gesprek ontstaat pas bij het eerste bericht.
   `gesprekMaak` is idempotent op de sleutel en dus verleidelijk om ook als
   opzoeker te gebruiken, maar dan legt een leesvraag de lijn aan -- en dan is
   "bestaat hier een gesprek?" altijd ja. De kop van kern/comm/index.js
   waarschuwt daar met zoveel woorden voor; deze laag houdt zich eraan.

   ONDER DE 18+-GRENS MAG DIT GEWOON. Praten is geen prestatie die buiten het
   potje blijft staan: er wordt niets van opgeteld en niets van vergeleken. De
   grens die hier telt is de kring, niet de leeftijd. */
module.exports = (ctx) => {
  const { comm, S, SOORTEN, codenaamVan, sociaalRate } = ctx;

  const MAX = 500;   // een bericht is een bericht; de kern kapt zelf op 4000

  // wie je buiten dit potje om al kunt bereiken staat in ./kring.js, op EEN
  // plek -- het teamuitnodigen leest dezelfde regel
  const { elkPaarKent } = require('./kring')(ctx);

  const GEEN = 'In dit potje zit iemand die je buiten het spel niet kunt bereiken. Praten kan met vrienden, klasgenoten en je eigen gezin.';

  function potjeVan(mij, id) {
    /* Zonder communicatiekern bestaat praten hier niet. Dat is geen storing die
       je moet melden als "probeer het opnieuw": er is niets om opnieuw te
       proberen zolang die laag niet meedraait. */
    if (!comm()) return { fout: { status: 404, error: 'Praten in het potje bestaat hier niet.' } };
    const p = S().potjes[String(id || '')];
    if (!p || !Array.isArray(p.spelers) || !p.spelers.includes(mij))
      return { fout: { status: 404, error: 'Dit potje bestaat niet (meer).' } };
    const spelers = p.spelers.filter(Boolean);
    if (spelers.length < 2 || !elkPaarKent(spelers)) return { fout: { status: 403, error: GEEN } };
    return { p, spelers };
  }
  const sleutelVan = (p) => 'potje:' + p.id;

  /* Het gesprek van dit potje lezen. Bestaat het nog niet, dan is het antwoord
     een lege draad met `mag: true` -- de client toont dan een leeg venster met
     een invoerveld, en niet een foutmelding voor iets dat gewoon nog niet
     gezegd is. */
  function spelPraat(mij, id, aantal) {
    const { p, fout } = potjeVan(mij, id);
    if (fout) return fout;
    const g = comm().gesprekMetSleutel(sleutelVan(p));
    const basis = { status: 200, mag: true, potje: p.id, spelers: p.spelers.map(sp => sp ? codenaamVan(sp) : null) };
    if (!g) return Object.assign(basis, { gesprek: null, berichten: [] });
    const d = comm().gesprek(mij, g.id, { aantal: Math.max(1, Math.min(120, Number(aantal) || 60)) });
    return Object.assign(basis, { gesprek: g.id, berichten: d.berichten, typt: d.typt });
  }

  /* Een bericht sturen. HIER ontstaat het gesprek, met alle spelers erin. */
  function spelPraatStuur(mij, id, tekst) {
    const { p, spelers, fout } = potjeVan(mij, id);
    if (fout) return fout;
    const t = String(tekst == null ? '' : tekst).slice(0, MAX).trim();
    if (!t) return { status: 400, error: 'Een leeg bericht versturen doet niets.' };
    if (!sociaalRate(mij, 'spel-praat', 60, 5 * 60 * 1000)) return { status: 429, error: 'Rustig aan met berichten.' };
    const g = comm().gesprekMaak({
      soort: 'group', deelnemers: spelers, door: mij,
      // de titel draagt de SPELNAAM en geen codenamen: dit is een plek, geen lijstje mensen
      titel: 'Potje ' + (SOORTEN[p.soort] || p.soort),
      meta: { sleutel: sleutelVan(p), spel: p.soort, potje: p.id }
    });
    const m = comm().bericht({ gesprekId: g.id, van: mij, tekst: t });
    return { status: 200, ok: true, gesprek: g.id, bericht: m.id };
  }

  return { spelPraat, spelPraatStuur, _elkPaarKent: elkPaarKent };
};
