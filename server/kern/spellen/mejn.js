/* Spelmotor "mejn" (kern/spellen): Mens erger je niet: 2-4 spelers of 2-tegen-2; de server dobbelt en bewaakt de regels.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

  function mejnInit(potje) {
    const st = { pionnen: {}, dobbel: null, mag: 'gooi' };
    for (const h of potje.spelers) st.pionnen[h] = [{ pos: -1 }, { pos: -1 }, { pos: -1 }, { pos: -1 }];
    potje.staat = st;
  }
  const mejnStartveld = (potje, h) => potje.spelers.indexOf(h) * 10;
  const mejnKlaar = (st, h) => st.pionnen[h].every(p => p.pos >= 100);
  function mejnZetten(potje, h) {
    // welke pionnen mogen bewegen met de huidige worp?
    const st = potje.staat, d = st.dobbel, uit = [];
    if (!d) return uit;
    const eigen = st.pionnen[h], startveld = mejnStartveld(potje, h);
    for (let i = 0; i < 4; i++) {
      const pos = eigen[i].pos;
      let doel = null;
      if (pos === -1) { if (d === 6) doel = startveld; }
      else if (pos >= 100) { const n = pos - 100 + d; if (n <= 3 && !eigen.some(p => p.pos === 100 + n)) doel = 100 + n; }
      else {
        const rel = (pos - startveld + 40) % 40;
        if (rel + d > 39) { const n = rel + d - 40; if (n <= 3 && !eigen.some(p => p.pos === 100 + n)) doel = 100 + n; }
        else doel = (pos + d) % 40;
      }
      if (doel === null) continue;
      // eigen pion (of die van je teamgenoot) sla je niet en blokkeert het veld
      if (doel < 100) {
        const bezet = potje.spelers.find(sp => st.pionnen[sp].some(p => p.pos === doel));
        if (bezet && (bezet === h || (potje.modus === 'teams' && potje.teams[potje.spelers.indexOf(bezet)] === potje.teams[potje.spelers.indexOf(h)]))) continue;
      }
      uit.push({ pion: i, doel });
    }
    return uit;
  }
  function mejnVolgende(potje) {
    // volgende speler die nog niet klaar is
    const st = potje.staat;
    for (let stap = 1; stap <= potje.spelers.length; stap++) {
      const kand = potje.spelers[(potje.beurt + stap) % potje.spelers.length];
      if (!mejnKlaar(st, kand)) { potje.beurt = potje.spelers.indexOf(kand); return; }
    }
  }
  function mejnGooi(potje, h) {
    const st = potje.staat;
    if (st.mag !== 'gooi') return { status: 409, error: 'Je hebt al gegooid; zet eerst een pion.' };
    st.dobbel = crypto.randomInt(1, 7);
    const zetten = mejnZetten(potje, h);
    if (!zetten.length) {
      // niets mogelijk: bij een 6 mag je opnieuw, anders is de volgende aan de beurt
      const zes = st.dobbel === 6;
      const worp = st.dobbel;
      st.dobbel = null; st.mag = 'gooi';
      if (!zes) mejnVolgende(potje);
      save();
      nudge(potje.spelers[potje.beurt], potje);
      return { status: 200, ok: true, dobbel: worp, geenZet: true, nogEens: zes };
    }
    st.mag = 'zet';
    save();
    return { status: 200, ok: true, dobbel: st.dobbel };
  }
  function mejnZet(potje, h, zet) {
    const st = potje.staat;
    if (st.mag !== 'zet') return { status: 409, error: 'Gooi eerst de dobbelsteen.' };
    const keuze = mejnZetten(potje, h).find(z => z.pion === Number(zet.pion));
    if (!keuze) return { status: 400, error: 'Die pion kan niet met deze worp.' };
    const eigen = st.pionnen[h];
    // slaan: een pion van een tegenstander op het doelveld gaat terug het hok in
    if (keuze.doel < 100) {
      for (const sp of potje.spelers) {
        if (sp === h) continue;
        const raak = st.pionnen[sp].find(p => p.pos === keuze.doel);
        if (raak) raak.pos = -1;
      }
    }
    eigen[keuze.pion].pos = keuze.doel;
    const zes = st.dobbel === 6;
    st.dobbel = null; st.mag = 'gooi';
    // winnen: al je pionnen thuis (bij teams: allebei de teamleden)
    if (mejnKlaar(st, h)) {
      if (potje.modus === 'teams') {
        const team = potje.teams[potje.spelers.indexOf(h)];
        const teamKlaar = potje.spelers.filter((sp, i) => potje.teams[i] === team).every(sp => mejnKlaar(st, sp));
        if (teamKlaar) { potje.status = 'klaar'; potje.winnaar = potje.spelers.filter((sp, i) => potje.teams[i] === team).map(codenaamVan).join(' & '); }
      } else { potje.status = 'klaar'; potje.winnaar = codenaamVan(h); }
    }
    if (potje.status !== 'klaar' && !zes) mejnVolgende(potje);
    save();
    nudge(potje.spelers[potje.beurt], potje);
    return { status: 200, ok: true };
  }

  /* ================= Schaken ================= */

  return { mejnInit, mejnZet, mejnZetten, mejnGooi };
};
