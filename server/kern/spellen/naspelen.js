/* Spellen (deelmodule): NASPELEN -- een afgelopen partij zet voor zet terug.

   `zetten.js` bewaart het verloop als RUWE ZETTEN: `{ speler, zet }`, opgeslagen
   zoals ze binnenkwamen, zonder te weten wat ze betekenen. Dat is precies goed
   (het werkt daardoor voor alle zestien spellen tegelijk), en het betekent dat
   er nog iets moet gebeuren voordat je een partij kunt TERUGKIJKEN: een bord op
   zet 24 bestaat nergens, je moet het uitrekenen.

   DE VERLEIDING IS OM DAT IN DE CLIENT TE DOEN, en dat is precies de fout die
   dit huis al twee keer heeft opgeruimd. Schaken naspelen betekent rokade, en
   passant en promotie kennen; die regels staan in `schaak.js` en een tweede
   exemplaar in `spelen.html` loopt binnen een jaar uiteen zonder dat iemand het
   merkt. Dus rekent de SERVER het uit, met de motor die de partij ook echt
   gespeeld heeft. Er is geen tweede implementatie, dus er valt niets uiteen.

   DAAROM STAAT HIER EEN TWEEDE, STILLE REGISTER. De spelmotoren zijn bij het
   opstarten gebouwd met de ECHTE context: elke `zet` eindigt op `save()` en
   `nudge()`. Een partij naspelen zou dan de database schrijven en je
   tegenstander een seintje geven dat hij aan zet is -- voor een zet uit een
   partij die al klaar is. Het register wordt hier daarom nog een keer
   opgebouwd, met een context waarin `save` en `nudge` niets doen. Dat kost
   zestien extra modulesluitingen bij het opstarten en verder niets; de
   woordenlijsten van Woordduel laden lui, dus die komen er niet bij.

   NIET ELK SPEL IS NA TE SPELEN, en dat is een eigenschap van het SPEL en niet
   van deze laag. Om een partij te kunnen herbouwen moet twee dingen kloppen:
   het begin moet elke keer hetzelfde zijn, en de opgeslagen zetten moeten de
   rest volledig bepalen. Bij schaken en dammen is dat zo. Bij Pesten, Rummi en
   Woordduel niet -- die delen kaarten en letters uit met de schudbeker, en die
   worp staat nergens. Bij mens-erger-je-niet evenmin: de opgeslagen zet is
   `{actie:'gooi'}` en niet wat er gegooid werd.

   Een spel zegt daarom zelf `naspeelbaar: true`. Dat raden zou betekenen dat we
   een bord tonen dat er nooit zo heeft gestaan, en dat is erger dan geen bord:
   het ziet er precies zo echt uit. */
module.exports = (ctx) => {
  const { SPEL, spelReplay, codenaamVan } = ctx;

  /* Het stille register: dezelfde motoren, maar `save` en `nudge` doen niets.
     `schud` en `crypto` zitten erin omdat de modules ze uitpakken -- ze worden
     bij een naspeelbaar spel niet gebruikt, want dat is juist de eis. */
  const { INITS, ZETTEN, ZICHT } = require('./register')({
    save() {}, nudge() {}, crypto: require('crypto'),
    schud: (a) => a, beurtDoor() {}, codenaamVan
  });

  /* De partij herbouwen tot en met stap `t`. Geeft de weergave zoals DEZE
     speler hem toen zag; hij speelde mee, dus hij mag zijn eigen kant zien.

     Een zet die de motor nu weigert stopt het naspelen op dat punt in plaats
     van door te denderen: dan klopt er iets niet tussen het verloop en de
     regels, en dat hoort zichtbaar te zijn en niet weggepoetst. */
  function bouw(verloop, spelers, tot) {
    const p = { id: 'naspeel', soort: verloop.soort, modus: 'vrij', spelers,
      uitgenodigd: [], beurt: 0, teams: [0, 1, 0, 1, 0, 1], status: 'bezig',
      winnaar: null, at: verloop.at };
    INITS[verloop.soort](p);
    let gedaan = 0, gestrand = null;
    for (let i = 0; i < tot && i < verloop.zetten.length; i++) {
      const z = verloop.zetten[i];
      const wie = spelers[z.speler];
      if (!wie) { gestrand = i + 1; break; }
      const r = ZETTEN[verloop.soort](p, wie, z.zet || {});
      if (r && r.error) { gestrand = i + 1; break; }
      gedaan++;
    }
    return { p, gedaan, gestrand };
  }

  function spelNaspelen(mij, id, stap) {
    // wie hem mag zien staat in het verloop zelf: alleen wie meespeelde
    const verloop = spelReplay(mij, id);
    if (verloop.error) return verloop;

    const s = SPEL[verloop.soort];
    if (!s || !s.naspeelbaar)
      return { status: 400, error: 'Dit spel is niet na te spelen: het begin of de worp ligt niet vast in het verloop.' };
    /* Een afgekapt verloop mist juist het BEGIN (zetten.js gooit de oudste weg),
       en dan is er geen bord om vanaf te rekenen. Dat weigeren we met de reden
       erbij; half naspelen vanaf een verzonnen beginstand is geen replay. */
    if (verloop.afgekapt)
      return { status: 409, error: 'Van deze partij is het begin niet meer bewaard, dus hij is niet na te spelen.' };

    const totaal = verloop.zetten.length;
    const t = Math.max(0, Math.min(totaal, Number(stap) === 0 ? 0 : (Number(stap) || totaal)));

    /* De spelerslijst van het verloop bestaat uit CODENAMEN (of null voor wie
       zich liet verwijderen). De motor wil sleutels en gebruikt ze alleen als
       identiteit, dus de codenaam voldoet -- behalve voor mijzelf, want de
       weergave moet weten welke kant ik was. */
    const mijnCodenaam = codenaamVan(mij);
    const spelers = verloop.spelers.map((cn, i) => cn || ('weg' + i));
    const ik = spelers.indexOf(mijnCodenaam);

    const { p, gedaan, gestrand } = bouw(verloop, spelers, t);
    const uit = {
      status: 200, potje: verloop.potje, soort: verloop.soort, naam: (ctx.SOORTEN || {})[verloop.soort] || verloop.soort,
      spelers: verloop.spelers.map(cn => cn || null), ik,
      stap: gedaan, totaal, beurt: p.beurt,
      staat: p.staat ? ZICHT[verloop.soort].speler(p, p.staat, spelers[ik]) : null
    };
    if (gestrand) uit.gestrand = gestrand;   // hier liep het verloop vast
    return uit;
  }

  return { spelNaspelen };
};
