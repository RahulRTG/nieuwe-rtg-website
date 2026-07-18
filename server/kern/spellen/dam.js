/* Spelmotor "dam" (kern/spellen): Dammen: 10x10 internationaal, slaan verplicht, meerslag, de dam vliegt over de diagonaal.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

  const D_RICH = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  function damInit(potje) {
    const b = Array(100).fill('.');
    for (let i = 0; i < 100; i++) {
      const r = Math.floor(i / 10);
      if ((r + i % 10) % 2 !== 1) continue; // alleen de donkere velden
      if (r <= 3) b[i] = 'z';
      if (r >= 6) b[i] = 'w';
    }
    potje.staat = { bord: b, ketting: null };
  }
  const damKleur = (potje, h) => potje.spelers.indexOf(h) === 0 ? 'w' : 'z';
  function damZettenVoor(st, k) {
    const B = st.bord, slagen = [], stappen = [];
    const ok = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 10;
    const vijand = (cel) => cel !== '.' && cel.toLowerCase() !== k;
    for (let i = 0; i < 100; i++) {
      const cel = B[i];
      if (cel === '.' || cel.toLowerCase() !== k) continue;
      const r = Math.floor(i / 10), c = i % 10, dame = cel === cel.toUpperCase();
      for (const [dr, dc] of D_RICH) {
        if (!dame) {
          const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
          const vooruit = k === 'w' ? dr === -1 : dr === 1;
          if (ok(r1, c1) && B[r1 * 10 + c1] === '.' && vooruit) stappen.push({ van: i, naar: r1 * 10 + c1 });
          if (ok(r2, c2) && vijand(B[r1 * 10 + c1]) && B[r2 * 10 + c2] === '.') slagen.push({ van: i, naar: r2 * 10 + c2, slaat: r1 * 10 + c1 });
        } else {
          let rr = r + dr, cc = c + dc, gezien = null;
          while (ok(rr, cc)) {
            const doel = B[rr * 10 + cc];
            if (doel === '.') { if (gezien === null) stappen.push({ van: i, naar: rr * 10 + cc }); else slagen.push({ van: i, naar: rr * 10 + cc, slaat: gezien }); }
            else if (vijand(doel) && gezien === null) gezien = rr * 10 + cc;
            else break; // eigen stuk, of een tweede stuk achter de eerste
            rr += dr; cc += dc;
          }
        }
      }
    }
    return { slagen, stappen };
  }
  function damZetten(potje, h) {
    const st = potje.staat, k = damKleur(potje, h);
    const { slagen, stappen } = damZettenVoor(st, k);
    if (st.ketting != null) return slagen.filter(s => s.van === st.ketting);
    return slagen.length ? slagen : stappen;
  }
  function damZet(potje, h, zet) {
    const st = potje.staat, B = st.bord, k = damKleur(potje, h);
    const mag = damZetten(potje, h);
    const keuze = mag.find(z => z.van === Number(zet.van) && z.naar === Number(zet.naar));
    if (!keuze) return { status: 400, error: mag.length && mag[0].slaat != null ? 'Slaan is verplicht.' : 'Die zet kan niet.' };
    B[keuze.naar] = B[keuze.van]; B[keuze.van] = '.';
    if (keuze.slaat != null) {
      B[keuze.slaat] = '.';
      // meerslag: hetzelfde stuk moet doorslaan zolang het kan
      const verder = damZettenVoor(st, k).slagen.filter(s => s.van === keuze.naar);
      if (verder.length) { st.ketting = keuze.naar; save(); return { status: 200, ok: true, verder: true }; }
    }
    st.ketting = null;
    // dam worden kan pas als de (slag)beurt op de laatste rij eindigt
    const rij = Math.floor(keuze.naar / 10);
    if (B[keuze.naar] === 'w' && rij === 0) B[keuze.naar] = 'W';
    if (B[keuze.naar] === 'z' && rij === 9) B[keuze.naar] = 'Z';
    potje.beurt = 1 - potje.beurt;
    const t = damZettenVoor(st, k === 'w' ? 'z' : 'w');
    if (!t.slagen.length && !t.stappen.length) { potje.status = 'klaar'; potje.winnaar = codenaamVan(h); }
    save(); nudge(potje.spelers[potje.beurt], potje);
    return { status: 200, ok: true };
  }

  /* ================= Rummi (rummikub-achtig) =================
     106 stenen: 1 t/m 13 in vier kleuren, alles dubbel, plus twee jokers (*).
     Je eerste uitleg telt minstens 30 punten uit eigen rek; daarna mag je de
     hele tafel herschikken. De client stuurt de complete nieuwe tafel op en
     de server keurt: elke rij/groep geldig, alle oude stenen nog aanwezig,
     de rest komt uit jouw rek. Kun je niets: pak een steen. */

  return { damInit, damZet, damZetten };
};
