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
  const klaarVan = (st, h) => (st.onderzoek || [])
    .filter(o => o.speler === h && o.status === 'klaar').map(o => o.sleutel);

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
       het verzoek -- anders slaat een speler de stam over. */
    'onderzoek-starten'(potje, h, z) {
      const st = potje.staat;
      const sleutel = String(z.sleutel || '');
      if (!O.BOOM[sleutel]) return { status: 400, error: 'Dat onderzoek bestaat niet.' };
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
      const kosten = O.uitrolkosten(v, sleutel);
      if (st.geld[h] < kosten) return { status: 400, error: 'Uitrollen kost ' + kosten + '; dat heb je niet.' };
      st.geld[h] -= kosten;
      v.tech.push(sleutel);
      return { status: 200, ok: true, kosten, tech: v.tech.slice() };
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

  /* ---------- de maand ----------
     Elk lopend onderzoek verbruikt zijn budget en boekt voortgang. De subsidie
     betaalt mee zolang hij strekt; wat er niet uit de subsidie komt, komt uit de
     kas. */
  function maandVoorSpeler(potje, h) {
    const st = potje.staat;
    const regels = [];
    let uitEigenZak = 0, uitPot = 0;
    for (const o of lopend(st, h)) {
      const k = O.BOOM[o.sleutel];
      const uitSubsidie = Math.min(o.subsidieRest || 0, o.budget);
      const zelf = o.budget - uitSubsidie;
      st.geld[h] -= zelf;
      if (uitSubsidie > 0) o.subsidieRest -= uitSubsidie;
      o.besteed += o.budget;
      o.subsidie += uitSubsidie;
      uitEigenZak += zelf;
      uitPot += uitSubsidie;
      o.voortgang += O.voortgang(potje.id, st.maand, o.sleutel, o.budget);
      const af = o.voortgang >= 1;
      if (af) { o.status = 'klaar'; o.voortgang = 1; o.tot = st.maand; teruggave(st, o); }
      regels.push({ id: o.id, naam: k.naam, soort: 'onderzoek',
        budget: rond(o.budget), subsidie: rond(uitSubsidie),
        voortgang: Math.round(o.voortgang * 100), klaar: af || undefined,
        resultaat: -rond(zelf) });
    }
    return { regels, uitEigenZak, uitPot };
  }

  /* WAT EEN SPELER ZIET: de hele boom met wat open staat, wat loopt en wat af
     is, plus per vestiging wat er draait. Van een ander niets -- welke kant een
     concurrent op onderzoekt, is precies het soort kennis waar hij voor betaalt. */
  function beeld(st, h) {
    const klaar = klaarVan(st, h);
    const loopt = lopend(st, h);
    return {
      boom: O.KNOPEN.map(sleutel => {
        const k = O.BOOM[sleutel];
        const bezig = loopt.find(o => o.sleutel === sleutel);
        return { sleutel, naam: k.naam, tak: k.tak, uitleg: k.uitleg,
          kosten: k.kosten, duur: k.duur, deel: k.implementatie, effect: k.effect,
          vereist: k.vereist, open: O.staatOpen(sleutel, klaar),
          staat: klaar.includes(sleutel) ? 'klaar' : bezig ? 'loopt' : O.staatOpen(sleutel, klaar) ? 'open' : 'dicht',
          voortgang: bezig ? Math.round(bezig.voortgang * 100) : null,
          budget: bezig ? bezig.budget : null, id: bezig ? bezig.id : null,
          subsidie: bezig ? rond(bezig.subsidieToegekend || 0) : null };
      }),
      tegelijk: O.TEGELIJK, bezig: loopt.length,
      /* WAT UITROLLEN HIER KOST, per vestiging. Sinds de uitrol een deel van de
         bouwsom is, is er geen bedrag meer dat voor alle panden geldt -- en een
         boom die alleen een percentage toont, laat de speler zelf rekenen. */
      uitgerold: (st.vestigingen[h] || []).map(v => ({ vestiging: v.id, naam: v.naam,
        tech: (v.tech || []).slice(),
        uitrol: Object.fromEntries(O.KNOPEN.map(s => [s, O.uitrolkosten(v, s)])) }))
    };
  }

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES), maandVoorSpeler, beeld, klaarVan, SUBSIDIEDEEL };
};
