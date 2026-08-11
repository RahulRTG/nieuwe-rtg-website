/* Magnaat: ONDERZOEK DOEN -- starten, budget zetten, uitrollen, subsidie vragen.

   De acties en de maandloop van de onderzoekslaag; de boom staat in
   ./onderzoek.js. Dezelfde driedeling als bij de bank en de verzekering.

   KENNIS IS VAN HET BEDRIJF, TOEPASSING IS PER VESTIGING. Dat onderscheid is de
   hele reden dat `implementatie` bestaat. Wie iets uitvindt, weet het overal --
   maar elk pand moet er nog voor om, en met tien vestigingen is uitrollen
   duurder dan uitvinden. Zonder die tweede post is onderzoek een knop die je
   een keer indrukt.

   DE SUBSIDIE IS EEN EXTERNE INJECTIE EN GEEN BEDRIJFSPRESTATIE. De RTFoundation
   kan de helft van een onderzoek meebetalen uit de LOKALE pot -- dat is precies
   waar die pot voor is (GAMEHALL.md 12.5: maatschappelijk geld dat meetbaar
   doorwerkt in de economie). Het geld komt dus ergens VANDAAN en verschijnt niet
   uit het niets; in de geldpompmeter is dat zichtbaar doordat de pot in het
   totaal meetelt. Wie een subsidie krijgt, haalt geld uit een pot die anders een
   bibliotheek was geworden, en dat hoort een zichtbare afweging te zijn en geen
   gratis geld.

   ONDERZOEK IS EEN VRIJE ACTIE, uitrollen ook: ze veranderen de kaart niet. */
const O = require('./onderzoek');

const rond = (n) => Math.round(n);
const SUBSIDIEDEEL = 0.5;

module.exports = ({ mijnVestiging }) => {
  const lopend = (st, h) => (st.onderzoek || []).filter(o => o.speler === h && o.status === 'loopt');
  const af = (st, h) => (st.onderzoek || []).filter(o => o.speler === h && o.status === 'klaar');
  const klaarVan = (st, h) => af(st, h).map(o => o.sleutel);
  const heeftSector = (st, h, sector) => (st.vestigingen[h] || [])
    .some(v => !sector || v.sector === sector);
  const uitkomstVan = (st, h, sleutel) => (af(st, h).find(o => o.sleutel === sleutel) || {}).uitkomst;
  /* WAT ER VOOR DEZE SPELER WERKELIJK UIT ZIJN ONDERZOEK KWAM, per sleutel. De
     boom zegt wat een knoop BEDOELT; dit zegt wat hij bij hem GEWORDEN is. */
  const gerealiseerd = (st, h) => Object.fromEntries(af(st, h).map(o => [o.sleutel, o.effect]));

  /* WAT ER VAN DE SUBSIDIE OVERBLIJFT GAAT TERUG NAAR DE POT. Zonder deze regel
     verdampt het: het geld is bij het toekennen uit de pot gehaald en wordt
     daarna nooit meer uitgegeven, dus het bestaat nergens. De geldpompmeter zag
     dat als waarde die uit de wereld verdween -- en dat is net zo goed een fout
     als waarde die erbij komt. Bovendien klopt het inhoudelijk: het is
     maatschappelijk geld dat geoormerkt was, niet opgemaakt. */
  function teruggave(st, o) {
    const rest = Math.max(0, o.subsidieRest || 0);
    if (rest <= 0) return 0;
    st.foundation.lokaal += rest;
    o.subsidieRest = 0;
    o.subsidieTerug = (o.subsidieTerug || 0) + rest;
    return rond(rest);
  }

  const ACTIES = {
    /* VRIJ: een onderzoek starten. Wat er open staat volgt uit de boom, niet uit
       het verzoek -- anders slaat een speler de stam over.

       JE ONDERZOEKT WAT JE DOET. Een sectortak gaat alleen open als je in die
       sector ook werkelijk een vestiging hebt. Dat is geen rem maar de kern van
       de keuze: een specialist loopt een diepe boom af, een conglomeraat staat
       overal aan het begin -- en daarmee is je portefeuille ook een
       onderzoeksbeslissing geworden. De stam (`meten`) is sectorloos en staat
       voor iedereen open die uberhaupt iets heeft. */
    'onderzoek-starten'(potje, h, z) {
      const st = potje.staat;
      const sleutel = String(z.sleutel || '');
      if (!O.BOOM[sleutel]) return { status: 400, error: 'Dat onderzoek bestaat niet.' };
      const sector = O.BOOM[sleutel].sector;
      if (!heeftSector(st, h, sector))
        return { status: 409, error: sector
          ? 'Daar heb je een vestiging in ' + sector + ' voor nodig; je onderzoekt wat je doet.'
          : 'Daar heb je eerst een vestiging voor nodig.' };
      const klaar = klaarVan(st, h);
      if (klaar.includes(sleutel)) return { status: 409, error: 'Dat heb je al uitgevonden.' };
      if (lopend(st, h).some(o => o.sleutel === sleutel)) return { status: 409, error: 'Daar loop je al aan.' };
      if (!O.staatOpen(sleutel, klaar))
        return { status: 409, error: 'Daar is eerst ' + O.BOOM[sleutel].vereist.map(v => O.BOOM[v].naam).join(' en ') + ' voor nodig.' };
      if (lopend(st, h).length >= O.TEGELIJK)
        return { status: 429, error: 'Je kunt aan ' + O.TEGELIJK + ' dingen tegelijk werken.' };
      const budget = Math.max(0, Math.min(200000, Math.floor(Number(z.budget) || O.BOOM[sleutel].kosten)));
      const o = { id: 'o' + (st.onderzoekTeller = (st.onderzoekTeller || 0) + 1),
        speler: h, sleutel, budget, voortgang: 0, besteed: 0, subsidie: 0,
        begonnen: st.maand, status: 'loopt' };
      (st.onderzoek = st.onderzoek || []).push(o);
      return { status: 200, ok: true, id: o.id, budget: o.budget };
    },

    /* VRIJ: het budget bijstellen of stoppen. Meer betalen gaat sneller, maar
       niet onbeperkt -- de looptijd is een bodem, want sommige dingen kosten
       gewoon tijd. Stoppen kost je wat je al besteed hebt: kennis die half af is
       is geen kennis. */
    'onderzoek-budget'(potje, h, z) {
      const st = potje.staat;
      const o = (st.onderzoek || []).find(x => x.id === String(z.id || '') && x.speler === h && x.status === 'loopt');
      if (!o) return { status: 404, error: 'Daar loop je niet aan.' };
      if (z.stoppen) {
        o.status = 'gestaakt'; o.tot = st.maand;
        const terug = teruggave(st, o);
        return { status: 200, ok: true, status_: 'gestaakt', terugNaarPot: terug };
      }
      o.budget = Math.max(0, Math.min(200000, Math.floor(Number(z.budget) || 0)));
      return { status: 200, ok: true, budget: o.budget };
    },

    /* VRIJ: uitrollen op een vestiging. Kennis is van het bedrijf, toepassing is
       per pand -- en dat kost elke keer opnieuw. */
    'onderzoek-uitrollen'(potje, h, z) {
      const st = potje.staat;
      const sleutel = String(z.sleutel || '');
      if (!klaarVan(st, h).includes(sleutel)) return { status: 409, error: 'Dat heb je nog niet uitgevonden.' };
      const v = mijnVestiging(st, h, String(z.vestiging || ''));
      if (!v) return { status: 404, error: 'Die vestiging is niet van jou.' };
      v.tech = v.tech || [];
      if (v.tech.includes(sleutel)) return { status: 409, error: 'Dat draait daar al.' };
      /* HET PAND MOET WEL IN DE SECTOR STAAN. Een uitvinding uit de horecaboom
         doet niets in een loods, en hem daar toch mogen uitrollen zou de hele
         sectorindeling decoratie maken. */
      if (O.BOOM[sleutel].sector && v.sector !== O.BOOM[sleutel].sector)
        return { status: 409, error: 'Dat is een uitvinding voor ' + O.BOOM[sleutel].sector + '.' };
      const kosten = O.uitrolkosten(v, sleutel);
      if (st.geld[h] < kosten) return { status: 400, error: 'Uitrollen kost ' + kosten + '; dat heb je niet.' };
      st.geld[h] -= kosten;
      v.tech.push(sleutel);
      /* WAT ER OP HET PAND LANDT IS DE UITKOMST VAN DEZE SPELER en niet wat er
         in de tabel stond: het onderzoek kan gedeeltelijk of anders zijn
         uitgepakt. De vermenigvuldigers worden hier bijgewerkt en nergens
         anders, want dit is de enige plek waar `tech` verandert. */
      v.techEffect = O.techEffect(v.tech, gerealiseerd(st, h));
      return { status: 200, ok: true, kosten, tech: v.tech.slice(),
        uitkomst: uitkomstVan(st, h, sleutel), effect: v.techEffect };
    },

    /* VRIJ: subsidie vragen. De Foundation betaalt de helft mee, uit de LOKALE
       pot en niet uit het niets -- er staat dus een bibliotheek tegenover die er
       niet komt. Een keer per onderzoek, en alleen zolang er in de pot zit. */
    'onderzoek-subsidie'(potje, h, z) {
      const st = potje.staat;
      const o = (st.onderzoek || []).find(x => x.id === String(z.id || '') && x.speler === h && x.status === 'loopt');
      if (!o) return { status: 404, error: 'Daar loop je niet aan.' };
      if (o.subsidieToegekend) return { status: 409, error: 'Daar is al subsidie op verleend.' };
      const k = O.BOOM[o.sleutel];
      const gevraagd = rond(k.kosten * k.duur * SUBSIDIEDEEL);
      if (st.foundation.lokaal < gevraagd)
        return { status: 409, error: 'In de lokale pot zit ' + rond(st.foundation.lokaal) + '; dit vraagt ' + gevraagd + '.' };
      st.foundation.lokaal -= gevraagd;
      o.subsidieToegekend = gevraagd;
      o.subsidieRest = gevraagd;
      return { status: 200, ok: true, subsidie: gevraagd, potNa: rond(st.foundation.lokaal) };
    }
  };

  /* DE MAAND staat in ./onderzoek-maand.js -- budget eruit, voortgang erbij, en
     de plek waar de uitkomst valt. */
  const maandVoorSpeler = require('./onderzoek-maand')({ lopend, teruggave });

  /* WAT EEN SPELER ZIET staat in ./onderzoek-beeld.js -- een eigen onderwerp
     (de grens tussen spelers) dat los staat van wat hij DOET. */
  const beeld = require('./onderzoek-beeld')({ lopend, af, klaarVan });

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES), maandVoorSpeler, beeld, klaarVan, SUBSIDIEDEEL };
};
