/* Spelmotor "schaak" (kern/spellen): Schaken: volledige zetvalidatie (rokade, en passant, promotie, schaak/mat/pat) op de server.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

  const SCH_START = 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr'; // wit onder (kleine letters = wit)
  function schaakInit(potje) {
    potje.staat = { bord: SCH_START.split(''), aanZet: 'w', rokade: { wk: true, wq: true, bk: true, bq: true }, ep: -1, zetten: [] };
  }
  const kleurVan = (c) => c === '.' ? null : (c === c.toLowerCase() ? 'w' : 'z');
  function schAangevallen(bord, veld, door) {
    // wordt 'veld' aangevallen door kleur 'door'? (voor schaak-detectie)
    const r = Math.floor(veld / 8), k = veld % 8;
    const vij = (c) => kleurVan(c) === door;
    const stukIs = (c, s) => c !== '.' && c.toLowerCase() === s;
    const richt = { l: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
    for (const [sl, dirs] of [['b', richt.l], ['r', richt.r]]) {
      for (const [dr, dk] of dirs) {
        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i, nk = k + dk * i;
          if (nr < 0 || nr > 7 || nk < 0 || nk > 7) break;
          const c = bord[nr * 8 + nk];
          if (c === '.') continue;
          if (vij(c) && (stukIs(c, sl) || stukIs(c, 'q'))) return true;
          break;
        }
      }
    }
    for (const [dr, dk] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
      const nr = r + dr, nk = k + dk;
      if (nr >= 0 && nr < 8 && nk >= 0 && nk < 8 && vij(bord[nr * 8 + nk]) && stukIs(bord[nr * 8 + nk], 'n')) return true;
    }
    const pr = door === 'w' ? 1 : -1; // witte pionnen staan op hogere rijen en slaan omlaag (bord: rij 0 = zwartkant boven? nee: rij 0..1 zwart (hoofdletters), rij 6..7 wit)
    for (const dk of [-1, 1]) {
      const nr = r + pr, nk = k + dk;
      if (nr >= 0 && nr < 8 && nk >= 0 && nk < 8 && vij(bord[nr * 8 + nk]) && stukIs(bord[nr * 8 + nk], 'p')) return true;
    }
    for (const [dr, dk] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nk = k + dk;
      if (nr >= 0 && nr < 8 && nk >= 0 && nk < 8 && vij(bord[nr * 8 + nk]) && stukIs(bord[nr * 8 + nk], 'k')) return true;
    }
    return false;
  }
  function schPseudo(st, veld) {
    // pseudo-legale zetten voor het stuk op 'veld'
    const bord = st.bord, c = bord[veld]; if (c === '.') return [];
    const ik = kleurVan(c), r = Math.floor(veld / 8), k = veld % 8, uit = [];
    const push = (nr, nk) => { if (nr < 0 || nr > 7 || nk < 0 || nk > 7) return false; const d = bord[nr * 8 + nk]; if (d === '.') { uit.push(nr * 8 + nk); return true; } if (kleurVan(d) !== ik) uit.push(nr * 8 + nk); return false; };
    const glij = (dirs) => { for (const [dr, dk] of dirs) for (let i = 1; i < 8; i++) if (!push(r + dr * i, k + dk * i)) break; };
    const s = c.toLowerCase();
    if (s === 'p') {
      const richting = ik === 'w' ? -1 : 1, thuis = ik === 'w' ? 6 : 1;
      if (bord[(r + richting) * 8 + k] === '.') {
        uit.push((r + richting) * 8 + k);
        if (r === thuis && bord[(r + 2 * richting) * 8 + k] === '.') uit.push((r + 2 * richting) * 8 + k);
      }
      for (const dk of [-1, 1]) {
        const nr = r + richting, nk = k + dk;
        if (nr < 0 || nr > 7 || nk < 0 || nk > 7) continue;
        const doel = nr * 8 + nk;
        if ((bord[doel] !== '.' && kleurVan(bord[doel]) !== ik) || doel === st.ep) uit.push(doel);
      }
    } else if (s === 'n') { for (const [dr, dk] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) push(r + dr, k + dk); }
    else if (s === 'b') glij([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    else if (s === 'r') glij([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    else if (s === 'q') glij([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
    else if (s === 'k') {
      for (const [dr, dk] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) push(r + dr, k + dk);
      // rokade: velden vrij en nergens onderweg schaak
      const rij = ik === 'w' ? 7 : 0, vij = ik === 'w' ? 'z' : 'w';
      const mag = (kant) => st.rokade[(ik === 'w' ? 'w' : 'b') + kant];
      if (veld === rij * 8 + 4 && !schAangevallen(bord, veld, vij)) {
        if (mag('k') && bord[rij * 8 + 5] === '.' && bord[rij * 8 + 6] === '.' &&
          !schAangevallen(bord, rij * 8 + 5, vij) && !schAangevallen(bord, rij * 8 + 6, vij)) uit.push(rij * 8 + 6);
        if (mag('q') && bord[rij * 8 + 3] === '.' && bord[rij * 8 + 2] === '.' && bord[rij * 8 + 1] === '.' &&
          !schAangevallen(bord, rij * 8 + 3, vij) && !schAangevallen(bord, rij * 8 + 2, vij)) uit.push(rij * 8 + 2);
      }
    }
    return uit;
  }
  function schToepassen(st, van, naar) {
    // een (pseudo-legale) zet uitvoeren op een kopie; geeft de nieuwe staat
    const n = { bord: st.bord.slice(), aanZet: st.aanZet === 'w' ? 'z' : 'w', rokade: Object.assign({}, st.rokade), ep: -1, zetten: st.zetten };
    const c = n.bord[van], s = c.toLowerCase(), ik = kleurVan(c);
    n.bord[naar] = c; n.bord[van] = '.';
    if (s === 'p') {
      if (naar === st.ep) n.bord[naar + (ik === 'w' ? 8 : -8)] = '.'; // en passant slaat de passant
      if (Math.abs(naar - van) === 16) n.ep = (van + naar) / 2;
      const rij = Math.floor(naar / 8);
      if (rij === 0 || rij === 7) n.bord[naar] = ik === 'w' ? 'q' : 'Q'; // promotie naar dame
    }
    if (s === 'k') {
      n.rokade[(ik === 'w' ? 'w' : 'b') + 'k'] = false; n.rokade[(ik === 'w' ? 'w' : 'b') + 'q'] = false;
      if (naar - van === 2) { n.bord[naar - 1] = n.bord[naar + 1]; n.bord[naar + 1] = '.'; }   // korte rokade
      if (van - naar === 2) { n.bord[naar + 1] = n.bord[naar - 2]; n.bord[naar - 2] = '.'; }   // lange rokade
    }
    if (s === 'r') {
      const rij = ik === 'w' ? 7 : 0;
      if (van === rij * 8) n.rokade[(ik === 'w' ? 'w' : 'b') + 'q'] = false;
      if (van === rij * 8 + 7) n.rokade[(ik === 'w' ? 'w' : 'b') + 'k'] = false;
    }
    return n;
  }
  const schKoning = (bord, kleur) => bord.indexOf(kleur === 'w' ? 'k' : 'K');
  function schLegaal(st, kleur) {
    // alle echt legale zetten van 'kleur' (eigen koning blijft uit schaak)
    const uit = [];
    for (let v = 0; v < 64; v++) {
      if (kleurVan(st.bord[v]) !== kleur) continue;
      for (const naar of schPseudo(st, v)) {
        const na = schToepassen(st, v, naar);
        if (!schAangevallen(na.bord, schKoning(na.bord, kleur), kleur === 'w' ? 'z' : 'w')) uit.push({ van: v, naar });
      }
    }
    return uit;
  }
  function schaakZet(potje, h, zet) {
    const st = potje.staat;
    const kleur = potje.spelers.indexOf(h) === 0 ? 'w' : 'z';
    if (st.aanZet !== kleur) return { status: 409, error: 'De ander is aan zet.' };
    const van = Number(zet.van), naar = Number(zet.naar);
    if (!schLegaal(st, kleur).some(z => z.van === van && z.naar === naar)) return { status: 400, error: 'Die zet kan niet.' };
    const nieuw = schToepassen(st, van, naar);
    nieuw.zetten = st.zetten.concat([[van, naar]]).slice(-200);
    potje.staat = nieuw;
    const ander = kleur === 'w' ? 'z' : 'w';
    if (!schLegaal(nieuw, ander).length) {
      potje.status = 'klaar';
      const schaak = schAangevallen(nieuw.bord, schKoning(nieuw.bord, ander), kleur);
      potje.winnaar = schaak ? codenaamVan(h) : null; // mat of pat (gelijkspel)
      potje.gelijk = !schaak;
    }
    save();
    nudge(potje.spelers[potje.beurt = potje.spelers.indexOf(potje.spelers.find(sp => sp !== h))], potje);
    return { status: 200, ok: true };
  }

  /* ================= Woordduel (wordfeud-achtig, eer-systeem) ================= */

  return { schaakInit, schaakZet };
};
