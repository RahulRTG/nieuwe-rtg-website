/* Spellen (deelmodule): het Rangschikduel van De Societeit. Vijf ronden
   met voor iedereen DEZELFDE opdrachten: zet vier dingen in de juiste
   volgorde (van laag naar hoog, van vroeg naar laat). De bank bewaart de
   waarheid; de spelers krijgen de vier dingen geschud en zonder waarden.
   Helemaal goed is een punt; de meeste punten winnen, bij gelijke stand
   wie het eerst klaar was. Krijgt de gedeelde context een keer bij het
   opstarten vanuit kern/spellen.js. */
const BANK = [
  { t: 'Van laag naar hoog', items: [['De Domtoren', '112 m'], ['De Eiffeltoren', '330 m'], ['Het Empire State Building', '381 m'], ['De Burj Khalifa', '828 m']] },
  { t: 'Van weinig naar veel inwoners', items: [['Nederland', '18 mln'], ['Duitsland', '84 mln'], ['De Verenigde Staten', '335 mln'], ['India', '1430 mln']] },
  { t: 'Van vroeg naar laat uitgevonden', items: [['De boekdrukkunst', '1450'], ['De stoomtrein', '1804'], ['De telefoon', '1876'], ['De televisie', '1927']] },
  { t: 'Van langzaam naar snel', items: [['De olifant', '40 km/u'], ['De windhond', '72 km/u'], ['De jachtluipaard', '110 km/u'], ['De slechtvalk in duikvlucht', '390 km/u']] },
  { t: 'Van klein naar groot', items: [['Mercurius', '4879 km'], ['Mars', '6779 km'], ['De aarde', '12742 km'], ['Jupiter', '139820 km']] },
  { t: 'Van kort naar lang', items: [['De Maas', '925 km'], ['De Rijn', '1233 km'], ['De Donau', '2850 km'], ['De Nijl', '6650 km']] },
  { t: 'Van vroeg naar laat in Nederland', items: [['De eerste trein', '1839'], ['De grondwet van Thorbecke', '1848'], ['De Afsluitdijk klaar', '1932'], ['De Deltawerken voltooid', '1997']] },
  { t: 'Van laag naar hoog', items: [['De Vaalserberg', '323 m'], ['De Mont Blanc', '4809 m'], ['De Kilimanjaro', '5895 m'], ['De Mount Everest', '8849 m']] },
  { t: 'Van langzaam naar snel', items: [['Wandelen', '5 km/u'], ['Fietsen', '20 km/u'], ['De intercity', '140 km/u'], ['Een lijnvliegtuig', '900 km/u']] },
  { t: 'Van weinig naar veel inwoners', items: [['Eindhoven', '250 dzd'], ['Den Haag', '565 dzd'], ['Rotterdam', '675 dzd'], ['Amsterdam', '935 dzd']] },
  { t: 'Van klein naar groot in oppervlakte', items: [['Nederland', '42 dzd km2'], ['Frankrijk', '644 dzd km2'], ['Australie', '7,7 mln km2'], ['Rusland', '17,1 mln km2']] },
  { t: 'Van vroeg naar laat op de markt', items: [['De grammofoonplaat', '1887'], ['Het cassettebandje', '1963'], ['De cd', '1982'], ['De mp3-speler', '1998']] },
  { t: 'Van licht naar zwaar', items: [['Een huiskat', '4 kg'], ['Een volwassen mens', '70 kg'], ['Een paard', '500 kg'], ['Een olifant', '5000 kg']] },
  { t: 'Van weinig naar veel moedertaalsprekers', items: [['Nederlands', '25 mln'], ['Frans', '80 mln'], ['Engels', '380 mln'], ['Mandarijn', '940 mln']] },
  { t: 'Van vroeg naar laat voor het eerst gehouden', items: [['De moderne Olympische Spelen', '1896'], ['Het WK voetbal', '1930'], ['Het EK voetbal', '1960'], ['Het WK vrouwenvoetbal', '1991']] },
  { t: 'Van licht naar machtig (kcal per 100 gram)', items: [['Komkommer', '15'], ['Appel', '52'], ['Brood', '265'], ['Chocolade', '546']] },
  { t: 'Van vroeg naar laat in de geschiedenis', items: [['De val van het West-Romeinse Rijk', '476'], ['Columbus naar Amerika', '1492'], ['De Franse Revolutie', '1789'], ['Het begin van de Eerste Wereldoorlog', '1914']] },
  { t: 'Van kort naar lang', items: [['De Erasmusbrug', '802 m'], ['De Afsluitdijk', '32 km'], ['Het Amsterdam-Rijnkanaal', '72 km'], ['De Nieuwe Waterweg met Maasmond', '107 km']] }
];
const RONDEN = 5;
module.exports = (ctx) => {
  const { save, crypto, schud, codenaamVan, nudge } = ctx;
  function ordeInit(potje) {
    const st = { vragen: schud(BANK.map((_, i) => i)).slice(0, RONDEN), schuddels: [], af: {}, punten: {}, klaarOm: {} };
    // dezelfde schudde presentatie voor iedereen: eerlijk vergelijken
    for (const vi of st.vragen) st.schuddels.push(schud(BANK[vi].items.map((_, i) => i)));
    for (const sp of potje.spelers) { st.af[sp] = 0; st.punten[sp] = 0; }
    potje.staat = st;
  }
  function ordeZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'orde') return { status: 400, error: 'Onbekende zet.' };
    if (st.af[mij] >= RONDEN) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    const i = st.af[mij], vraag = BANK[st.vragen[i]], schuddel = st.schuddels[i];
    const volgorde = Array.isArray(zet.volgorde) ? zet.volgorde.map(Number) : [];
    // de speler wijst getoonde posities aan; terugvertaald moet dat 0,1,2,3 zijn
    const goedWas = volgorde.length === 4 && volgorde.every((p, k) => schuddel[p] === k);
    if (goedWas) st.punten[mij] += 1;
    st.af[mij] += 1;
    if (st.af[mij] >= RONDEN) st.klaarOm[mij] = Date.now();
    if (potje.spelers.every(sp => st.af[sp] >= RONDEN)) {
      potje.status = 'klaar';
      const beste = Math.max(...potje.spelers.map(sp => st.punten[sp]));
      const kandidaten = potje.spelers.filter(sp => st.punten[sp] === beste);
      kandidaten.sort((x, y) => st.klaarOm[x] - st.klaarOm[y]);
      if (kandidaten.length > 1 && st.klaarOm[kandidaten[0]] === st.klaarOm[kandidaten[1]]) potje.gelijk = true;
      else potje.winnaar = codenaamVan(kandidaten[0]);
    }
    save();
    potje.spelers.filter(sp => sp !== mij).forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, goedWas, juist: vraag.items.map(it => it[0] + ' (' + it[1] + ')') };
  }
  // de eigen opdracht met de vier dingen geschud en ZONDER waarden
  const ordeView = (p, st, mij) => {
    const klaar = st.af[mij] >= RONDEN;
    const vraag = klaar ? null : BANK[st.vragen[st.af[mij]]];
    return { opdracht: vraag ? vraag.t : null,
      items: vraag ? st.schuddels[st.af[mij]].map(oi => vraag.items[oi][0]) : null,
      nr: st.af[mij], tot: RONDEN, punten: st.punten[mij],
      stand: p.spelers.map(sp => ({ af: st.af[sp], punten: st.punten[sp] })) };
  };
  const spel = { sleutel: 'orde', naam: 'Rangschikduel', max: 4, wereld: 'rtf', buitenBeurt: ['orde'], kijken: true,
    init: ordeInit, zet: ordeZet, view: ordeView };
  return { spel, ordeInit, ordeZet, ordeView };
};
