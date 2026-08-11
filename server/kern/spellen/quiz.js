/* Spellen (deelmodule): het Quizduel. Iedereen krijgt DEZELFDE tien vragen en
   antwoordt in eigen tempo (de zet 'antwoord' mag buiten de beurt); de meeste
   goed wint, bij gelijke stand wie het eerst klaar was. De juiste antwoorden
   blijven op de server tot er geantwoord is.

   DIT SPEL IS DE EERSTE MET VARIANTEN, en dat is de reden dat het hier zo staat.
   Een quiz met schoolvragen is geen tweede spel: dezelfde beurten, dezelfde
   winnaarsbepaling, dezelfde poorten, alleen een andere bron. Vier quiz-apps
   bouwen zou vier keer dezelfde fouten opleveren. Wat er te kiezen valt staat
   in `varianten` onderaan en wordt door het platform gewogen (./variant.js);
   hier staat alleen wat een keuze BETEKENT.

   DE SCHOOLBRON IS DE BESTAANDE LEERSTOF EN GEEN TWEEDE BIBLIOTHEEK.
   `kern/leerstof-data/` heeft de leerlijnen al, met per leerdoel een generator
   die verse meerkeuzevragen maakt, en `kern/leerstof-gen.js` maakt ze. Een
   eigen schoolvragenbank hiernaast zou binnen een jaar achterlopen op die van
   de school zelf -- en dan legt de quiz iets anders voor dan de les.

   Wat de schoolbron NIET doet, en dat hoort er hard bij: hij schrijft niets bij
   in het leerpaspoort. Oefenen doe je in de leerstofmodule, en daar wordt een
   leerdoel bijgeschreven als je vier van de vijf haalt. Een quiz tegen een
   klasgenoot is een SPEL; die uitslag hoort geen schoolvoortgang te worden.
   Zou dat wel gebeuren, dan is winnen van een klasgenoot ineens een cijfer, en
   dat is precies wat "leren is geen wedstrijd" tegenhoudt.

   TEAMS: 2-tegen-2 bij een vol potje ('keuze', niet 'altijd' -- met z'n
   tweeen quizzen moet gewoon kunnen). In teams telt de SOM van het team, en
   dat verandert alleen wie er wint; iedereen beantwoordt zijn eigen vragen. */
const BANK = require('./quiz-data');
/* Waar de SCHOOLVRAGEN vandaan komen staat in ./quiz-school.js. Dat is een
   ander onderwerp dan de regels van dit spel -- het gaat over de leerlijnen,
   welke leerdoelen meerkeuze zijn en hoe de keuzelijst eruitziet -- en het
   groeit mee met de leerstof terwijl de quizregels dat niet doen. */
const school = require('./quiz-school');

const VRAGEN = 10;

module.exports = (ctx) => {
  const { save, schud, codenaamVan, nudge, ZONDER_SPELER } = ctx;

  /* Tien vragen, in EEN vorm: `{ v, opties, j }` met j de index van het juiste
     antwoord. De algemene bank en de leerstof leveren allebei iets anders aan
     (de bank een index, de leerstof de tekst van het antwoord), en dat verschil
     hoort hier op te houden -- anders draagt `quizZet` twee gevallen en is de
     tweede het geval dat niemand naspeelt. */
  function uitBank() {
    return schud(BANK.map((_, i) => i)).slice(0, VRAGEN)
      .map(i => ({ v: BANK[i][0], opties: BANK[i][1], j: BANK[i][2] }));
  }
  function quizInit(potje) {
    const v = potje.variant || {};
    const vragen = v.bron === 'school' ? school.vragenVoor(v.stof, VRAGEN) : uitBank();
    const st = { vragen, idx: {}, goed: {}, klaarOm: {} };
    for (const sp of potje.spelers) { st.idx[sp] = 0; st.goed[sp] = 0; }
    potje.staat = st;
  }

  // de stand per team: de som van wie erin zit. Alleen in teams, en dan is het
  // ook meteen wat de winnaar bepaalt
  const teamStand = (p, st) => [0, 1].map(t =>
    p.spelers.reduce((n, sp, i) => n + (p.teams[i] === t ? st.goed[sp] : 0), 0));

  function quizKlaar(potje, st) {
    potje.status = 'klaar';
    if (potje.modus === 'teams') {
      const som = teamStand(potje, st);
      // gelijkspel tussen teams blijft gelijkspel: het "eerst klaar"-criterium
      // is van EEN speler en zegt niets over twee mensen samen
      if (som[0] === som[1]) { potje.gelijk = true; return; }
      const winnend = som[0] > som[1] ? 0 : 1;
      potje.winnaar = potje.spelers.filter((_, i) => potje.teams[i] === winnend).map(codenaamVan).join(' & ');
      return;
    }
    const beste = Math.max(...potje.spelers.map(sp => st.goed[sp]));
    const kandidaten = potje.spelers.filter(sp => st.goed[sp] === beste);
    kandidaten.sort((x, y) => st.klaarOm[x] - st.klaarOm[y]);
    if (kandidaten.length > 1 && st.klaarOm[kandidaten[0]] === st.klaarOm[kandidaten[1]]) potje.gelijk = true;
    else potje.winnaar = codenaamVan(kandidaten[0]);
  }

  function quizZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'antwoord') return { status: 400, error: 'Onbekende zet.' };
    if (st.idx[mij] >= st.vragen.length) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    const vraag = st.vragen[st.idx[mij]];
    const goedWas = Number(zet.keuze) === vraag.j;
    if (goedWas) st.goed[mij] += 1;
    st.idx[mij] += 1;
    if (st.idx[mij] >= st.vragen.length) st.klaarOm[mij] = Date.now();
    if (potje.spelers.every(sp => st.idx[sp] >= st.vragen.length)) quizKlaar(potje, st);
    save();
    potje.spelers.filter(sp => sp !== mij).forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, goedWas, juist: vraag.j, juistTekst: vraag.opties[vraag.j] };
  }

  /* De eigen vraag MET opties maar ZONDER oplossing, plus de tussenstand.

     Deze functie is de ENIGE weg waarlangs de staat van dit spel naar buiten
     gaat (partij.js geeft niets anders door), dus wat hier niet in staat kan
     een speler niet zien. Het antwoord (`j`) staat er dus niet in, en dat is
     geen detail: het staat wel in `st.vragen`, want de server moet het
     naderhand kunnen nakijken. Een toets legt de sleutels van deze uitkomst
     vast, zodat een veld erbij een besluit is en geen slip. */
  const quizView = (p, st, mij) => {
    const vraag = st.idx[mij] < st.vragen.length ? st.vragen[st.idx[mij]] : null;
    const uit = { vraag: vraag ? vraag.v : null, opties: vraag ? vraag.opties : null,
      nr: st.idx[mij], tot: st.vragen.length, goed: st.goed[mij],
      stand: p.spelers.map(sp => ({ af: st.idx[sp], goed: st.goed[sp] })) };
    if (p.modus === 'teams') uit.teams = teamStand(p, st);
    return uit;
  };
  /* Op een gedeeld scherm hoort de TUSSENSTAND en niets persoonlijks: ieders
     eigen vraag loopt niet gelijk (je speelt in je eigen tempo), dus een vraag
     op de televisie zou de een vooruit helpen en de ander verklappen. */
  const quizPubliek = (p, st) => {
    const uit = { tot: st.vragen.length, stand: p.spelers.map(sp => ({ af: st.idx[sp], goed: st.goed[sp] })) };
    if (p.modus === 'teams') uit.teams = teamStand(p, st);
    return uit;
  };

  const spel = { sleutel: 'quiz', naam: 'Quizduel', max: 4, wereld: 'rtf', buitenBeurt: ['antwoord'],
    teams: 'keuze',
    init: quizInit, zet: quizZet,
    /* WAT ER TE KIEZEN VALT. Gesloten lijsten, en de schoollijsten komen uit de
       leerstof zelf -- een handgeschreven kopie zou stil achterlopen zodra er
       een vak bij komt, en dan staat er een keuze in de app die nul vragen
       oplevert. */
    varianten: {
      bron: { keuze: ['algemeen', 'school'], standaard: 'algemeen' },
      stof: { keuze: school.STOFKEUZE, standaard: null }
    },
    /* De vraag OVER de velden heen, en die is van dit spel: leerstof hoort bij
       de schoolbron en nergens anders. Zwijgend negeren zou betekenen dat een
       docent 'taal groep 3' kiest, algemene kennis krijgt, en dat pas merkt als
       de klas de eerste vraag ziet. */
    variantFout: (v) => {
      if (v.bron !== 'school') return v.stof ? 'Leerstof hoort bij de schoolvragen; kies eerst die bron.' : null;
      return v.stof ? null : 'Kies bij schoolvragen ook een vak en een groep.';
    },
    zicht: { speler: quizView, kijker: ZONDER_SPELER, publiek: quizPubliek } };

  return { spel, quizInit, quizZet, quizView, quizStof: school.STOFKEUZE };
};
