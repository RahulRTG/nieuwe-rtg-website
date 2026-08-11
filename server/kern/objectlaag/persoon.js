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

/* Hoeveel wbw-lijstjes we nalopen om te zien of er een gedeeld is. Elk lijstje
   kost een aparte aanroep, want wbwMijn levert alleen een AANTAL leden en geen
   namen (kern/wbw.js) -- de ledenlijst zit in wbwGroep. Twintig is ruim: wie er
   meer heeft, heeft geen lijstjes meer maar een boekhouding. */
const WBW_MAX = 20;

module.exports = ({ kern }) => {

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
    } }
  ];

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
    return { caps: uit.filter(Boolean), stil };
  }

  return { caps, PROEVEN };
};
