/* Spellen (deelmodule): het Quizduel van De Societeit. Iedereen krijgt
   DEZELFDE tien vragen uit de bank en antwoordt in eigen tempo (de zet
   'antwoord' mag buiten de beurt); de meeste goed wint, bij gelijke stand
   wie het eerst klaar was. De juiste antwoorden blijven op de server tot
   er geantwoord is. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/spellen.js. */
const BANK = require('./quiz-data');
module.exports = (ctx) => {
  const { save, schud, codenaamVan, nudge, ZONDER_SPELER } = ctx;
  function quizInit(potje) {
    const volgorde = schud(BANK.map((_, i) => i)).slice(0, 10);
    const st = { vragen: volgorde, idx: {}, goed: {}, klaarOm: {} };
    for (const sp of potje.spelers) { st.idx[sp] = 0; st.goed[sp] = 0; }
    potje.staat = st;
  }
  function quizZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'antwoord') return { status: 400, error: 'Onbekende zet.' };
    if (st.idx[mij] >= st.vragen.length) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    const vraag = BANK[st.vragen[st.idx[mij]]];
    const keuze = Number(zet.keuze);
    const goedWas = keuze === vraag[2];
    if (goedWas) st.goed[mij] += 1;
    st.idx[mij] += 1;
    if (st.idx[mij] >= st.vragen.length) st.klaarOm[mij] = Date.now();
    if (potje.spelers.every(sp => st.idx[sp] >= st.vragen.length)) {
      potje.status = 'klaar';
      const beste = Math.max(...potje.spelers.map(sp => st.goed[sp]));
      const kandidaten = potje.spelers.filter(sp => st.goed[sp] === beste);
      kandidaten.sort((x, y) => st.klaarOm[x] - st.klaarOm[y]);
      if (kandidaten.length > 1 && st.klaarOm[kandidaten[0]] === st.klaarOm[kandidaten[1]]) potje.gelijk = true;
      else potje.winnaar = codenaamVan(kandidaten[0]);
    }
    save();
    potje.spelers.filter(sp => sp !== mij).forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, goedWas, juist: vraag[2], juistTekst: vraag[1][vraag[2]] };
  }
  // de eigen vraag MET opties maar ZONDER oplossing, plus de tussenstand
  const quizView = (p, st, mij) => {
    const vraag = st.idx[mij] < st.vragen.length ? BANK[st.vragen[st.idx[mij]]] : null;
    return { vraag: vraag ? vraag[0] : null, opties: vraag ? vraag[1] : null,
      nr: st.idx[mij], tot: st.vragen.length, goed: st.goed[mij],
      stand: p.spelers.map(sp => ({ af: st.idx[sp], goed: st.goed[sp] })) };
  };
  /* Op een gedeeld scherm hoort de TUSSENSTAND en niets persoonlijks: ieders
     eigen vraag loopt niet gelijk (je speelt in je eigen tempo), dus een vraag
     op de televisie zou de een vooruit helpen en de ander verklappen. */
  const quizPubliek = (p, st) => ({ tot: st.vragen.length,
    stand: p.spelers.map(sp => ({ af: st.idx[sp], goed: st.goed[sp] })) });
  const spel = { sleutel: 'quiz', naam: 'Quizduel', max: 4, wereld: 'rtf', buitenBeurt: ['antwoord'],
    init: quizInit, zet: quizZet,
    zicht: { speler: quizView, kijker: ZONDER_SPELER, publiek: quizPubliek } };
  return { spel, quizInit, quizZet, quizView };
};
