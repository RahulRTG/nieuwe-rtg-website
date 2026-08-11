/* De objectlaag, deelbestand "persoon": wat kan ik met deze mens?

   HET OBJECT IS EEN CODENAAM. Dat is geen beperking maar het ontwerp: deze laag
   leest domeinen die zelf al op codenamen draaien, en de kluis met echte namen
   blijft erbuiten (CLAUDE.md, privacy by design).

   EN DAAROM KUNNEN ATTENTIES EN ENTOURAGE HIER NIET IN, hoe logisch ze ook
   voelen bij "wat kan ik met deze persoon". Die twee bewaren MENSEN MET HUN
   ECHTE NAAM in het eigen dossier van het lid (kern/rechterhand/attenties.js,
   entourage.js) -- er is geen codenaam om op te matchen. Een cap 'attentie
   sturen' aanzetten zou betekenen dat deze laag namen uit een dossier gaat
   vergelijken met codenamen, en dat is precies het ontwerp doorbreken dat
   CLAUDE.md beschermt. Ze staan dus niet in de catalogus, en dit is de plek waar
   staat waarom -- zodat de volgende die ze mist, niet denkt dat het vergeten is.

   ELKE CAP HIER HEEFT BEWIJS. Niet "een persoon kan chatten" in het algemeen,
   maar "er IS een verbinding met deze codenaam, dus er is een gesprek". Zonder
   dat bewijs staat de cap er niet -- een objectlaag die alles aanbiedt wat
   denkbaar is, is een menukaart met gerechten die de keuken niet heeft. */
'use strict';

const { capVoor } = require('./caps');
const maakSamen = require('./samen');

/* Hoeveel wbw-lijstjes we nalopen om te zien of er een gedeeld is. Elk lijstje
   kost een aparte aanroep, want wbwMijn levert alleen een AANTAL leden en geen
   namen (kern/wbw.js) -- de ledenlijst zit in wbwGroep. Twintig is ruim: wie er
   meer heeft, heeft geen lijstjes meer maar een boekhouding. */
const WBW_MAX = 20;

module.exports = ({ kern }) => {
  const ruimte = maakSamen({ kern });

  /* Iedere bron levert nul of een cap, met zijn bewijs. De methode heet `proef`
     en niet `vind`: `vind` is de top-level naam waarmee ./event.js en ./groep.js
     hun object opzoeken, en scripts/kruisscan.js slaat aan op een slice die een
     naam van een zusterslice gebruikt -- de vorm die als ReferenceError pas op
     runtime knalt. Hier was het geen fout maar wel dezelfde naam op twee
     betekenissen, en `proef` zegt beter wat het is: een bewijsstuk zoeken. Een bron die stukgaat
     mag de andere niet meenemen en niet stil verdwijnen: dan zou het scherm
     "hier kan niets" zeggen terwijl er een gedeeld lijstje bestaat. */
  const PROEVEN = [
    { cap: 'berichten', naam: 'verbinding', proef(key, codenaam) {
      const s = kern.socialConnecties(key) || {};
      const c = (s.connections || []).find(x => x.codename === codenaam);
      if (!c) return null;
      return c.unread > 0
        ? c.unread + (c.unread === 1 ? ' ongelezen bericht' : ' ongelezen berichten')
        : 'u bent verbonden';
    } },

    { cap: 'samengroep', naam: 'genootschap', proef(key, codenaam) {
      const namen = [];
      for (const gr of kern.genootschap.mijne(key) || []) {
        const p = kern.genootschap.publiek(gr, key);
        if ((p.ledenlijst || []).some(l => l.codenaam === codenaam)) namen.push(p.naam);
      }
      if (!namen.length) return null;
      return namen.length === 1 ? namen[0] : namen.length + ' gedeelde groepen';
    } },

    { cap: 'wbw', naam: 'wbw', proef(key, codenaam) {
      const m = kern.wbwMijn(key) || {};
      for (const g of (m.groepen || []).slice(0, WBW_MAX)) {
        const d = kern.wbwGroep(key, g.id) || {};
        const leden = (d.groep && d.groep.leden) || [];
        if (leden.some(l => l.codenaam === codenaam)) return g.naam;
      }
      return null;
    } },

    { cap: 'vonk', naam: 'vonk', proef(key, codenaam) {
      const v = kern.vonkMijn(key) || {};
      /* Een gesloten poort (18+, geverifieerd paspoort) is geen storing en geen
         match: gewoon niets. Zelfde afspraak als in de sociale graaf. */
      if (v.error) return null;
      const m = (v.matches || []).find(x => x.met === codenaam);
      if (!m) return null;
      return m.tafel ? 'match, tafel gereserveerd' : 'wederzijdse match';
    } },

    { cap: 'rendezvous', naam: 'rendezvous', proef(key, codenaam) {
      const r = kern.rvMatches(key) || {};
      if (r.error) return null;
      const m = (r.matches || []).find(x => x.codenaam === codenaam);
      if (!m) return null;
      return m.voorstel ? 'match, gedeelde plek: ' + m.voorstel : 'wederzijdse match';
    } },

    /* Een lopend potje. `ikAanZet` komt uit het spellendomein zelf en is precies
       het soort feit waar deze laag om draait: niet "u speelt weleens samen"
       maar "de beurt ligt bij u".

       WAT HIER NIET IN KOMT: een winst-verliesbalans tussen twee mensen. Dat is
       een score op het leven tussen mensen (LIFE.md par. 4.4), en alles wat een
       uitslag BUITEN het potje bewaart hangt sowieso aan de 18+-grens
       (kern/spellen/grens.js). Een lopend potje is geen uitslag. */
    { cap: 'spel', naam: 'spel', proef(key, codenaam) {
      const s = kern.mijnSpellen(key) || {};
      const p = (s.potjes || []).find(x => x.status === 'bezig' && (x.spelers || []).includes(codenaam));
      if (!p) return null;
      return p.ikAanZet ? p.naam + ', u bent aan zet' : p.naam + ', ' + (p.aanZet || 'de ander') + ' is aan zet';
    } },

    /* Gedeelde bestanden, gemeten aan de EIGEN kant: bestanden van dit lid waar
       de codenaam op de deellijst staat. Wat de ander met MIJ deelt zit in
       dezelfde lijst onder `gedeeld`, maar zonder eigenaar erbij -- daar valt
       dus niet uit af te leiden dat het van deze persoon komt, en dat verzinnen
       we niet. De cap zegt daarom "wat u deelt" en niet "wat u samen deelt". */
    { cap: 'bestand', naam: 'bestanden', proef(key, codenaam) {
      const b = kern.bestandenLijst(key) || {};
      const n = (b.eigen || []).filter(x => (x.gedeeldMet || []).includes(codenaam)).length;
      if (!n) return null;
      return n === 1 ? '1 bestand gedeeld' : n + ' bestanden gedeeld';
    } }
  ];

  /* DE KOP VAN HET OBJECT: wie is dit, en wat is de stand tussen ons.

     Dit is geen extra cap maar CONTEXT -- feiten die geen weg naar een app zijn.
     Ze staan apart zodat het scherm ze anders kan tonen dan de acties, en zodat
     duidelijk blijft dat een cap altijd ergens heen leidt.

     ALLES HIER IS EEN FEIT UIT EEN DOMEIN, en dat is de grens die ertoe doet.
     Geen relatiescore, geen "hoe hecht", geen reeks en geen aansporing om weer
     eens iets van u te laten horen (LIFE.md par. 4.4). Een telling van gedeelde
     dingen is een feit; een cijfer over een relatie is een oordeel, en dat komt
     hier nooit. */
  function context(key, codenaam) {
    const over = {}, stil = [];

    try {
      const s = kern.socialConnecties(key) || {};
      const c = (s.connections || []).find(x => x.codename === codenaam);
      if (c) {
        /* De sleutel komt uit de verbinding zelf; er is dus geen opzoeking in de
           kluis nodig om te weten of iemand aanwezig is. Wie niet verbonden is,
           krijgt geen aanwezigheid -- online zijn is geen openbaar gegeven. */
        over.laatsteGesprek = c.lastAt || null;
        try { over.aanwezig = !!kern.comm.isAanwezig(c.key); } catch (e) { stil.push('aanwezigheid'); }
      }
    } catch (e) { stil.push('verbinding'); }

    /* De eerstvolgende bijeenkomst waar deze persoon OOK ja heeft gezegd. Het
       domein levert die lijst zelf (`komen`, codenamen); hier wordt alleen
       gefilterd. Een bijeenkomst waar de ander niet op geantwoord heeft, is
       geen gedeelde afspraak en staat er dus niet -- dat zou een verwachting
       wekken die op niets rust. */
    try {
      const a = kern.bijeenkomst.mijnAgenda({ key }) || {};
      const b = (a.komt || []).find(x => (x.komen || []).includes(codenaam));
      if (b) over.volgendeAfspraak = { wat: b.wat, datum: b.datum, tijd: b.tijd || null, groep: b.groep };
    } catch (e) { stil.push('afspraken'); }

    return { over, stil };
  }

  /* De caps van deze persoon, plus de namen van de proeven die stukgingen. Geen
     enkele proef mag de andere meenemen: bij een object weegt dat zwaarder dan
     bij een lijst, want een leeg object leest als "hier kan niets" en dat is een
     bewering en geen leegte. */
  function caps(key, codenaam) {
    const uit = [], stil = [];
    for (const p of PROEVEN) {
      try {
        const waarom = p.proef(key, codenaam);
        if (waarom) uit.push(capVoor(p.cap, waarom));
      } catch (e) { stil.push(p.naam); }
    }
    const k = context(key, codenaam);
    /* ONTDUBBELD, want de proeven en de kop lezen deels dezelfde bronnen: valt
       de vriendenlaag om, dan merken ze het allebei. Twee keer "verbinding" in
       de melding leest als twee storingen en zet iemand aan het zoeken naar de
       tweede. Een stukke bron is een melding. */
    /* DE RELATIERUIMTE (fase 3). Hij hangt aan de persoon en niet aan een eigen
       object, want hij IS de persoon zoals u hem kent: wat u samen heeft. Een
       eigen ingang zou een tweede plek maken waar dezelfde vraag beantwoord
       wordt. */
    const r = ruimte.samen(key, codenaam);
    const alles = [...new Set(stil.concat(k.stil, r.stil))];
    return { titel: codenaam, caps: uit.filter(Boolean), over: k.over,
      samen: r.samen, telling: r.telling, stil: alles };
  }

  return { caps, context, PROEVEN };
};
