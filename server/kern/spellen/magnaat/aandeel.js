/* Magnaat: DEELNEMINGEN -- een belang in de zaak van een ander.

   Het derde en laatste stuk van fase B, en het is de laag waar "concern" iets
   betekent zonder dat er een tweede spel bij komt. Een contract koppelt twee
   bedrijven aan een LEVERING; een deelneming koppelt ze aan een RESULTAAT. Dat
   is een ander soort afhankelijkheid: je verdient aan iets waar je zelf niet
   aan de knoppen zit, en je verliest eraan als het misgaat.

   VIER BESLUITEN, en ze hangen alle vier aan dezelfde vraag -- wie is de baas?

   1. EEN BELANG GEEFT GEEN ZEGGENSCHAP. De eigenaar blijft de enige die prijs,
      personeel, marketing en onderhoud zet. Zonder die regel is een vestiging
      met drie aandeelhouders een object waarvan onduidelijk is wie er een zet
      op mag doen, en dan is elke actie een vraag in plaats van een knop. Dit
      spel heeft geen stemlaag en krijgt er ook geen: dat zou een tweede spel
      zijn.
   2. HOOGSTENS 49% GAAT WEG. Dezelfde reden van de andere kant: zou een
      eigenaar de meerderheid kunnen verkopen, dan is hij bestuurder van iets
      dat niet meer van hem is, en dat is een positie waar geen goede zet
      bestaat. Wie het hele bedrijf wil, koopt het in de veiling (./veiling.js).
   3. VERLIES DEEL JE MEE. Anders is een belang verkopen in een zaak die het
      slecht doet gratis geld -- je haalt de inleg op en de koper draagt niets.
      Een deelneming is geen lening; daarvoor is fase B nog niet.
   4. HET BELANG HANGT AAN DE VESTIGING EN NIET AAN DE EIGENAAR. Wordt de zaak
      verkocht, dan blijft het belang staan: de aandeelhouder heeft een claim op
      het bedrijf, niet op de persoon. Zonder dat kan een eigenaar zijn
      aandeelhouders van zich af schudden door de zaak te verkopen.

   HET ONDERHANDELEN ZELF staat in ./aandeel-acties.js, op dezelfde naad als bij
   de contracten en de veilingen: dit bestand kent het BELANG en wat een maand
   ermee doet, dat bestand kent het gesprek. */
const rond = (n) => Math.round(n);

const MAX_DEEL = 49;      // procent dat weg mag; zie besluit 2

module.exports = ({ wieHeeft, waarde }) => {
  const lopend = (st) => (st.deelnemingen || []).filter(d => d.status === 'loopt');
  /* Hoeveel procent van deze vestiging al bij anderen zit. De grens wordt HIER
     berekend en niet bijgehouden op de vestiging: een tweede administratie van
     hetzelfde getal loopt uiteen zodra er ergens een pad bijkomt. */
  const uitgegeven = (st, vestigingId) =>
    lopend(st).filter(d => d.vestiging === vestigingId).reduce((n, d) => n + d.deel, 0);
  /* Welk deel van het resultaat en de waarde nog van de eigenaar zelf is. */
  const eigenDeel = (st, vestigingId) => 1 - uitgegeven(st, vestigingId) / 100;
  const belangenVan = (st, h) => lopend(st).filter(d => d.houder === h);

  /* ---------- wat een maand ermee doet ----------
     Het resultaat van een vestiging wordt VERDEELD. De eigenaar houdt wat er
     niet vergeven is; elke aandeelhouder krijgt zijn deel -- ook als dat een
     verlies is (besluit 3). Wordt aangeroepen met het resultaat van EEN
     vestiging, en geeft terug wat er naar wie ging zodat het op het
     maandoverzicht komt. */
  function verdeel(st, vestigingId, resultaat) {
    const rijen = lopend(st).filter(d => d.vestiging === vestigingId);
    if (!rijen.length) return { eigenaar: resultaat, uit: [] };
    const uit = [];
    let weg = 0;
    for (const d of rijen) {
      const bedrag = resultaat * (d.deel / 100);
      st.geld[d.houder] += bedrag;
      d.ontvangen += bedrag;
      weg += bedrag;
      uit.push({ id: d.id, houder: d.houder, deel: d.deel, bedrag: rond(bedrag) });
    }
    return { eigenaar: resultaat - weg, uit };
  }

  /* Wat een speler aan VERMOGEN heeft buiten zijn eigen panden om: de waarde
     van zijn belangen in andermans zaken. En andersom telt de eigenaar alleen
     zijn eigen deel mee -- anders staat dezelfde waarde bij twee mensen op de
     eindstand en klopt de optelsom van de partij niet. */
  function belangwaarde(st, h) {
    let som = 0;
    for (const d of belangenVan(st, h)) {
      const w = wieHeeft(st, d.vestiging);
      if (w) som += waarde(w.v) * (d.deel / 100);
    }
    return som;
  }

  /* Wat een speler van zijn belangen ziet. Zijn eigen kant helemaal; van de
     zaak zelf alleen wat er op straat staat -- een aandeelhouder krijgt geen
     inzage in andermans boeken, alleen zijn eigen uitkering. Dat is streng, en
     het is dezelfde grens als overal: je ziet WAT JOU TOEKOMT en niet hoe het
     tot stand kwam. */
  function beeld(st, h, codenaamVan) {
    return (st.deelnemingen || []).filter(d => d.houder === h
      || (wieHeeft(st, d.vestiging) || {}).speler === h || (d.status !== 'loopt' && d.eigenaar === h)).map(d => {
      const w = wieHeeft(st, d.vestiging);
      /* DE EIGENAAR WORDT AFGELEID en niet gelezen. `d.eigenaar` is wie het was
         toen er getekend werd; een belang hangt aan de VESTIGING, dus na een
         overname is de wederpartij iemand anders. Het veld bijwerken op elke
         plek waar een zaak van eigenaar wisselt is een tweede administratie van
         hetzelfde, en die loopt uiteen -- dit stond al fout in de eerste versie
         en de toets ving het. */
      const nu = w ? w.speler : d.eigenaar;
      return { id: d.id, status: d.status, deel: d.deel, prijs: d.prijs,
        rol: d.houder === h ? 'houder' : 'eigenaar',
        tegenpartij: codenaamVan(d.houder === h ? nu : d.houder),
        zaak: w ? w.v.naam : null, sector: w ? w.v.sector : null,
        // de waarde van JOUW deel; de rest van de zaak gaat je niet aan
        mijnWaarde: w && d.status === 'loopt' && d.houder === h ? rond(waarde(w.v) * (d.deel / 100)) : null,
        aanZet: d.status === 'voorgesteld' && d.van !== h, ronde: d.ronde,
        ontvangen: rond(d.ontvangen), gekocht: d.gekocht };
    });
  }

  return { verdeel, belangwaarde, beeld, uitgegeven, eigenDeel, lopend, MAX_DEEL };
};
