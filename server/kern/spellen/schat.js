/* Spellen (deelmodule): het Schatduel van De Societeit. Vijf schattings-
   vragen, voor iedereen dezelfde; je geeft in eigen tempo je schatting
   (buiten de beurt) en zodra iedereen een ronde binnen heeft, krijgt de
   dichtstbijzijnde het punt (bij exact gelijke afstand allebei). De meeste
   punten na vijf ronden wint. Krijgt de gedeelde context een keer bij het
   opstarten vanuit kern/spellen.js. */
const BANK = [
  { v: 'Hoe hoog is de Eiffeltoren?', a: 330, e: 'meter' },
  { v: 'In welk jaar begon de Eerste Wereldoorlog?', a: 1914, e: 'jaartal' },
  { v: 'Hoe lang is de Chinese Muur ongeveer?', a: 21196, e: 'kilometer' },
  { v: 'Hoeveel inwoners heeft Nederland ongeveer?', a: 18, e: 'miljoen' },
  { v: 'Hoe diep is het diepste punt van de oceaan?', a: 10935, e: 'meter' },
  { v: 'Hoeveel landen telt Afrika?', a: 54, e: 'landen' },
  { v: 'Hoe snel vliegt een lijnvliegtuig ongeveer?', a: 900, e: 'km per uur' },
  { v: 'Hoe ver ligt Parijs hemelsbreed van Amsterdam?', a: 430, e: 'kilometer' },
  { v: 'Hoeveel seconden zitten er in een etmaal?', a: 86400, e: 'seconden' },
  { v: 'Hoe hoog is de Mount Everest?', a: 8849, e: 'meter' },
  { v: 'Hoe hard rent een jachtluipaard maximaal?', a: 110, e: 'km per uur' },
  { v: 'Hoeveel gemeenten telt Nederland ongeveer?', a: 342, e: 'gemeenten' },
  { v: 'In welk jaar kwam de grondwet van Thorbecke?', a: 1848, e: 'jaartal' },
  { v: 'Hoe lang is de Afsluitdijk?', a: 32, e: 'kilometer' },
  { v: 'Hoeveel talen worden er wereldwijd gesproken?', a: 7000, e: 'talen' },
  { v: 'Hoe oud werd de oudste mens ooit?', a: 122, e: 'jaar' },
  { v: 'Wat is de omtrek van de aarde?', a: 40075, e: 'kilometer' },
  { v: 'In welk jaar reed de eerste trein in Nederland?', a: 1839, e: 'jaartal' },
  { v: 'Hoeveel eilanden telt Indonesie ongeveer?', a: 17000, e: 'eilanden' },
  { v: 'Hoe hoog is de Domtoren in Utrecht?', a: 112, e: 'meter' },
  { v: 'Hoeveel weegt een volwassen olifant ongeveer?', a: 5000, e: 'kilo' },
  { v: 'Hoeveel hartslagen per minuut heeft een mens in rust?', a: 70, e: 'slagen' },
  { v: 'In welk jaar werd de eerste iPhone gepresenteerd?', a: 2007, e: 'jaartal' },
  { v: 'Hoeveel kilometer snelweg heeft Nederland ongeveer?', a: 2800, e: 'kilometer' }
];
const RONDEN = 5;
module.exports = (ctx) => {
  const { save, schud, codenaamVan, nudge } = ctx;
  function schatInit(potje) {
    const st = { vragen: schud(BANK.map((_, i) => i)).slice(0, RONDEN), antwoorden: {}, punten: {}, beslist: 0 };
    for (const sp of potje.spelers) { st.antwoorden[sp] = []; st.punten[sp] = 0; }
    potje.staat = st;
  }
  function schatZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'schat') return { status: 400, error: 'Onbekende zet.' };
    if (st.antwoorden[mij].length >= RONDEN) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    const w = Math.round(Number(zet.w) || 0);
    const i = st.antwoorden[mij].length;
    st.antwoorden[mij].push(w);
    // is ronde i nu compleet, dan valt het punt bij de dichtstbijzijnde
    const vraag = BANK[st.vragen[i]];
    if (st.beslist === i && potje.spelers.every(sp => st.antwoorden[sp].length > i)) {
      const afstand = sp => Math.abs(st.antwoorden[sp][i] - vraag.a);
      const beste = Math.min(...potje.spelers.map(afstand));
      potje.spelers.filter(sp => afstand(sp) === beste).forEach(sp => { st.punten[sp] += 1; });
      st.beslist += 1;
    }
    if (potje.spelers.every(sp => st.antwoorden[sp].length >= RONDEN)) {
      potje.status = 'klaar';
      const beste = Math.max(...potje.spelers.map(sp => st.punten[sp]));
      const kandidaten = potje.spelers.filter(sp => st.punten[sp] === beste);
      if (kandidaten.length > 1) potje.gelijk = true;
      else potje.winnaar = codenaamVan(kandidaten[0]);
    }
    save();
    potje.spelers.filter(sp => sp !== mij).forEach(sp => nudge(sp, potje));
    // de onthulling reist mee: wie geantwoord heeft, mag het echte getal zien
    return { status: 200, ok: true, w, juist: vraag.a, eenheid: vraag.e };
  }
  // de eigen volgende vraag zonder oplossing; punten alleen van besliste ronden
  const schatView = (p, st, mij) => {
    const vraag = st.antwoorden[mij].length < RONDEN ? BANK[st.vragen[st.antwoorden[mij].length]] : null;
    return { vraag: vraag ? vraag.v : null, eenheid: vraag ? vraag.e : null,
      nr: st.antwoorden[mij].length, tot: RONDEN, beslist: st.beslist,
      stand: p.spelers.map(sp => ({ af: st.antwoorden[sp].length, punten: st.punten[sp] })) };
  };
  return { schatInit, schatZet, schatView };
};
