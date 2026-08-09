/* Spellen (deelmodule): het Geheugenduel van De Arena. Vijf ronden met
   voor iedereen DEZELFDE kleurenreeksen, elke ronde eentje langer (4 tot
   en met 8); je kijkt de reeks af en tikt hem na in eigen tempo (buiten
   de beurt). Helemaal goed is een punt; de meeste punten winnen, bij
   gelijke stand wie het eerst klaar was. De reeks moet naar de client om
   getoond te worden -- afkijken is dus een kwestie van eer, net als het
   Woordduel zonder woordenboek. Krijgt de gedeelde context een keer bij
   het opstarten vanuit kern/spellen.js. */
const RONDEN = 5;
module.exports = (ctx) => {
  const { save, crypto, codenaamVan, nudge } = ctx;
  function geheugenInit(potje) {
    const st = { reeksen: [], af: {}, punten: {}, klaarOm: {} };
    for (let i = 0; i < RONDEN; i++) {
      const r = [];
      for (let j = 0; j < 4 + i; j++) r.push(crypto.randomInt(0, 4));
      st.reeksen.push(r);
    }
    for (const sp of potje.spelers) { st.af[sp] = 0; st.punten[sp] = 0; }
    potje.staat = st;
  }
  function geheugenZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'reeks') return { status: 400, error: 'Onbekende zet.' };
    if (st.af[mij] >= RONDEN) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    const juist = st.reeksen[st.af[mij]];
    const r = Array.isArray(zet.r) ? zet.r.map(Number) : [];
    const goedWas = r.length === juist.length && juist.every((k, i) => r[i] === k);
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
    return { status: 200, ok: true, goedWas, juistR: juist };
  }
  // de eigen volgende reeks (de client toont hem en verbergt hem daarna zelf)
  const geheugenView = (p, st, mij) => ({
    reeks: st.af[mij] < RONDEN ? st.reeksen[st.af[mij]] : null,
    nr: st.af[mij], tot: RONDEN, punten: st.punten[mij],
    stand: p.spelers.map(sp => ({ af: st.af[sp], punten: st.punten[sp] }))
  });
  const spel = { sleutel: 'geheugen', naam: 'Geheugenduel', max: 4, wereld: 'rtf', buitenBeurt: ['reeks'], kijken: true,
    init: geheugenInit, zet: geheugenZet, view: geheugenView };
  return { spel, geheugenInit, geheugenZet, geheugenView };
};
