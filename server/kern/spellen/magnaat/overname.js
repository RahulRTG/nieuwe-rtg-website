/* Magnaat: OVERNAMES -- een zaak rechtstreeks van een ander kopen.

   WAT ER AL WAS. De veiling (./veiling.js) verkoopt een vestiging aan de hoogste
   bieder: de EIGENAAR beslist dat hij weg wil, en de markt bepaalt de prijs.
   Dat is de ene kant.

   WAT ERBIJ KOMT is de andere: een bod dat van de KOPER uitgaat. Je ziet een
   zaak die je goed uitkomt -- naast je eigen restaurant, in een sector waar je
   al onderzoek in hebt, met een contract dat je toch al levert -- en je legt er
   een bedrag op. De eigenaar zegt ja, nee, of noemt zijn prijs. Dat is een heel
   ander gesprek dan een veiling: er is geen tweede bieder, en de verkoper hoeft
   niet te verkopen.

   WIE KOOPT, KOOPT DE ZAAK MET ALLES ERAAN. De verhuizing loopt langs dezelfde
   weg als bij de veiling (./afscheid.js `verhuis`): de contracten gaan mee, een
   contract dat daardoor met jezelf zou komen te staan wordt afgekocht, en de
   HYPOTHEEK op het pand wordt uit de opbrengst afgelost. Dat laatste ontbrak en
   was een gat: een speler kon een verhypothekeerd pand verkopen, de opbrengst
   houden en de schuld laten staan -- met zekerheid op een gebouw dat van een
   ander was geworden.

   EEN PRIJSBAND, om dezelfde reden als op de beurs en bij de contracten. Zonder
   band is een overname een overboeking met een gebouw eraan geniet: twee spelers
   verkopen elkaar een schuurtje voor twee ton en het geld staat waar ze het
   hebben willen. De band hangt aan `waarde()`, dezelfde als de eindstand en het
   onderpand gebruiken.

   ER IS GEEN VIJANDIGE OVERNAME, en dat is een besluit. Een bod dat je NIET kunt
   weigeren zou betekenen dat iemand met een dikke kas de tafel leegkoopt, en dan
   is spelen zinloos zodra iemand voorloopt. Wie een zaak wil die niet te koop is,
   moet ernaast bouwen -- dat is de concurrentie waar dit spel over gaat. */
const rond = (n) => Math.round(n);

const PRIJSBAND = [0.6, 2.5];
const MAX_RONDEN = 6;      // daarna is het ja of nee, net als bij een contract
const MAX_OPEN = 3;        // hoeveel biedingen je tegelijk kunt laten liggen

module.exports = ({ wieHeeft, waarde, verhuis }) => {
  const lopend = (st, h) => (st.overnames || [])
    .filter(o => o.status === 'voorgesteld' && (o.koper === h || o.verkoper === h));

  /* De grenzen van een bod. Geeft een foutregel of null; zo staat de reden op
     een plek en niet in vier ifs verspreid. */
  function keur(st, koper, v, prijs) {
    const eerlijk = waarde(v);
    if (!(prijs > 0)) return 'Noem een bedrag.';
    if (prijs < eerlijk * PRIJSBAND[0] || prijs > eerlijk * PRIJSBAND[1])
      return 'Die zaak staat op ' + rond(eerlijk) + '; een bod hoort tussen ' +
        rond(eerlijk * PRIJSBAND[0]) + ' en ' + rond(eerlijk * PRIJSBAND[1]) + ' te liggen.';
    if (st.geld[koper] < prijs) return 'Dat bedrag heb je niet op de rekening.';
    return null;
  }

  /* WAT ER MEEKOMT, en dit is de reden dat een overname iets anders is dan een
     kavel kopen. De koper hoort dit VOORAF te zien: welke contracten hij erbij
     krijgt, welke schuld er op het pand rust, en hoeveel belang er bij anderen
     zit. Een overname waarbij je pas na afloop ontdekt dat er een leverplicht
     aan hangt, is geen onderhandeling maar een verrassing. */
  function bagage(st, v) {
    const contracten = (st.contracten || []).filter(c => c.status === 'loopt'
      && (c.leverancierId === v.id || c.afnemerId === v.id));
    const schuld = (st.leningen || [])
      .filter(l => l.status === 'loopt' && l.onderpand === v.id)
      .reduce((n, l) => n + l.restant, 0);
    const vergeven = (st.deelnemingen || [])
      .filter(d => d.status === 'loopt' && d.vestiging === v.id)
      .reduce((n, d) => n + d.deel, 0);
    return {
      contracten: contracten.length,
      levert: contracten.filter(c => c.leverancierId === v.id).length,
      koopt: contracten.filter(c => c.afnemerId === v.id).length,
      hypotheek: rond(schuld), vergeven,
      /* WAT ER NETTO OVERBLIJFT VOOR DE VERKOPER bij dit bod. Zonder dat getal
         onderhandelt hij over een bruto bedrag terwijl de bank er als eerste
         uit betaald wordt. */
      nettoBij: (prijs) => Math.max(0, rond(prijs - Math.min(prijs, schuld)))
    };
  }

  /* De overname uitvoeren. Alles wat er gebeurt loopt langs `verhuis` -- er is
     geen tweede manier om een vestiging van eigenaar te laten wisselen. */
  function voltrek(st, o) {
    const uit = verhuis(st, o.koper, o.vestiging, o.prijs);
    if (!uit) return null;
    o.status = 'gedaan'; o.tot = st.maand;
    o.afgelost = uit.afgelost || 0;
    o.contractenMee = uit.contracten;
    return uit;
  }

  function beeld(st, h, codenaamVan) {
    return lopend(st, h).map(o => {
      const w = wieHeeft(st, o.vestiging);
      const v = w ? w.v : null;
      return { id: o.id, vestiging: o.vestiging, naam: v ? v.naam : null,
        sector: v ? v.sector : null, prijs: o.prijs, ronde: o.ronde,
        rol: o.koper === h ? 'koper' : 'verkoper',
        tegenpartij: codenaamVan(o.koper === h ? o.verkoper : o.koper),
        aanZet: o.van !== h,
        rekenwaarde: v ? rond(waarde(v)) : null,
        bagage: v ? (({ nettoBij, ...rest }) => Object.assign(rest,
          { nettoVoorVerkoper: nettoBij(o.prijs) }))(bagage(st, v)) : null };
    });
  }

  return { lopend, keur, bagage, voltrek, beeld, PRIJSBAND, MAX_RONDEN, MAX_OPEN };
};
Object.assign(module.exports, { PRIJSBAND, MAX_RONDEN, MAX_OPEN });
