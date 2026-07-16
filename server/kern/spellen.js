/* Kern-module "spellen": verslavende potjes op de vriendenlaag, voor alle
   leden (RTF en RTG spelen tegen elkaar, op codenaam).

   Drie bordspellen en een scorebord:
   - Mens erger je niet: 2, 3 of 4 spelers vrij-voor-allen, of 2-tegen-2 in
     teams. Server-authoritatief: de server dobbelt, bewaakt de regels
     (6 = eruit en nog een keer, slaan = terug naar start, exact thuisbrengen)
     en wijst de winnaar aan.
   - Schaken: volledige zetvalidatie (rokade, en passant, promotie naar dame,
     schaak, mat en pat) op de server.
   - Woordduel (wordfeud-achtig): 15x15 met premievelden, de Nederlandse
     letterzak, kruiswoord-scoring en de 40-puntenbonus. Zonder woordenboek:
     het eer-systeem, zoals thuis aan tafel.
   - Sneek: ieder speelt zelf; de beste scores vormen een ranglijst onder
     vrienden.

   Een potje start met uitgenodigde vrienden (die accepteren zelf) of via de
   random wachtrij per spel en groepsgrootte. Beurten gaan via polling plus
   een SSE-duwtje naar wie aan zet is. */
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  function S() {
    if (!db.data.spellen) db.data.spellen = { potjes: {}, wachtrij: {}, sneek: {} };
    return db.data.spellen;
  }
  const SOORTEN = { mejn: 'Mens erger je niet', schaak: 'Schaken', woord: 'Woordduel' };
  const nudge = (naar, potje) => { try { sseToCustomer(naar, 'social', { kind: 'spel', potje: potje.id, soort: potje.soort }); } catch (e) {} };

  /* ---------- opschonen: klare potjes na een dag weg, wachtenden na een uur ---------- */
  function opschonen() {
    const s = S(), t = Date.now();
    for (const [id, p] of Object.entries(s.potjes)) {
      const leeftijd = t - new Date(p.at).getTime();
      if ((p.status === 'klaar' && leeftijd > 86400000) || (p.status === 'wacht' && leeftijd > 6 * 3600000)) delete s.potjes[id];
    }
  }

  /* ================= Mens erger je niet =================
     Ring van 40 velden; speler p start op veld p*10. Een pion: -1 = in het
     starthok, 0..39 = op de ring (absoluut), 100+i = eigen thuisrij. */
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
  const W_TAtLEN = {
    nl: { a: [6, 1], b: [2, 3], c: [2, 5], d: [5, 2], e: [18, 1], f: [2, 4], g: [3, 3], h: [2, 4], i: [4, 1], j: [2, 4], k: [3, 3], l: [3, 3], m: [3, 3], n: [10, 1], o: [6, 1], p: [2, 3], q: [1, 10], r: [5, 2], s: [5, 2], t: [5, 2], u: [3, 4], v: [2, 4], w: [2, 5], x: [1, 8], y: [1, 8], z: [2, 4] },
    en: { a: [9, 1], b: [2, 3], c: [2, 3], d: [4, 2], e: [12, 1], f: [2, 4], g: [3, 2], h: [2, 4], i: [9, 1], j: [1, 8], k: [1, 5], l: [4, 1], m: [2, 3], n: [6, 1], o: [8, 1], p: [2, 3], q: [1, 10], r: [6, 1], s: [4, 1], t: [6, 1], u: [4, 1], v: [2, 4], w: [2, 4], x: [1, 8], y: [2, 4], z: [1, 10] }
  };
  const taalVanPotje = (p) => W_TAtLEN[p.taal] ? p.taal : 'nl';
  const wLetters = (p) => W_TAtLEN[taalVanPotje(p)];
  const wWaarde = (p, l) => (wLetters(p)[l] || [0, 0])[1];
  /* Het woordenboek: echte NL- en EN-lijsten (server/woorden/*.txt.gz),
     lui geladen en daarna in het geheugen. Ontbreekt een lijst, dan valt
     dat potje terug op het eer-systeem in plaats van stuk te gaan. */
  const WOORDENBOEK = {};
  function woordenboek(taal) {
    if (taal in WOORDENBOEK) return WOORDENBOEK[taal];
    try {
      const raw = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', 'woorden', taal + '.txt.gz')));
      WOORDENBOEK[taal] = new Set(raw.toString('utf8').split('\n'));
    } catch (e) { WOORDENBOEK[taal] = null; }
    return WOORDENBOEK[taal];
  }
  // premievelden (klassieke symmetrische indeling): 3W, 2W, 3L, 2L
  const W_PREMIE = (() => {
    const p = {};
    const zet = (co, w) => co.forEach(([r, k]) => { p[r * 15 + k] = w; p[r * 15 + (14 - k)] = w; p[(14 - r) * 15 + k] = w; p[(14 - r) * 15 + (14 - k)] = w; });
    zet([[0, 0], [0, 7]], '3W');
    zet([[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]], '2W');
    zet([[1, 5], [5, 1], [5, 5]], '3L');
    zet([[0, 3], [2, 6], [3, 0], [6, 6], [7, 3], [6, 2]], '2L');
    return p;
  })();
  function woordInit(potje) {
    const zak = [];
    for (const [l, [n]] of Object.entries(wLetters(potje))) for (let i = 0; i < n; i++) zak.push(l);
    for (let i = zak.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [zak[i], zak[j]] = [zak[j], zak[i]]; }
    const st = { bord: Array(225).fill(null), zak, rekken: {}, scores: {}, passes: 0 };
    for (const h of potje.spelers) { st.rekken[h] = zak.splice(0, 7); st.scores[h] = 0; }
    potje.staat = st;
  }
  function woordZet(potje, h, zet) {
    const st = potje.staat;
    if (zet.pas === true) {
      st.passes++;
      if (zet.ruil && Array.isArray(zet.ruil) && st.zak.length >= zet.ruil.length) {
        const rek = st.rekken[h];
        for (const l of zet.ruil.slice(0, 7)) { const i = rek.indexOf(String(l)); if (i >= 0) { st.zak.push(rek.splice(i, 1)[0]); } }
        while (rek.length < 7 && st.zak.length) rek.push(st.zak.splice(crypto.randomInt(0, st.zak.length), 1)[0]);
      }
      if (st.passes >= potje.spelers.length * 2) { potje.status = 'klaar'; woordEinde(potje); }
      else potje.beurt = (potje.beurt + 1) % potje.spelers.length;
      save(); nudge(potje.spelers[potje.beurt], potje);
      return { status: 200, ok: true, gepast: true };
    }
    const tegels = Array.isArray(zet.tegels) ? zet.tegels.map(t => ({ i: Number(t.i), letter: String(t.letter || '').toLowerCase() })) : [];
    if (!tegels.length || tegels.length > 7) return { status: 400, error: 'Leg 1 tot 7 letters.' };
    const rek = st.rekken[h].slice();
    for (const t of tegels) {
      const ri = rek.indexOf(t.letter);
      if (ri < 0) return { status: 400, error: 'Die letters heb je niet op je rek.' };
      rek.splice(ri, 1);
      if (t.i < 0 || t.i > 224 || st.bord[t.i]) return { status: 400, error: 'Dat veld is al bezet.' };
    }
    // een rechte, aaneengesloten lijn (gaten mogen bestaande letters zijn)
    const rijen = new Set(tegels.map(t => Math.floor(t.i / 15))), kols = new Set(tegels.map(t => t.i % 15));
    const horizontaal = rijen.size === 1;
    if (!horizontaal && kols.size !== 1) return { status: 400, error: 'Leg de letters in een rechte lijn.' };
    const proef = st.bord.slice(); tegels.forEach(t => proef[t.i] = t.letter);
    const posities = tegels.map(t => t.i).sort((a, b) => a - b);
    const stap = horizontaal ? 1 : 15;
    for (let i = posities[0]; i <= posities[posities.length - 1]; i += stap) if (!proef[i]) return { status: 400, error: 'Er zit een gat in je woord.' };
    const eerste = st.bord.every(c => !c);
    if (eerste && !tegels.some(t => t.i === 112)) return { status: 400, error: 'Het eerste woord gaat over het middenvak.' };
    if (!eerste) {
      const raakt = tegels.some(t => [t.i - 1, t.i + 1, t.i - 15, t.i + 15].some(b => b >= 0 && b < 225 && st.bord[b] && Math.abs((b % 15) - (t.i % 15)) <= 1));
      if (!raakt) return { status: 400, error: 'Je woord moet aansluiten op wat er ligt.' };
    }
    // score: het hoofdwoord plus elk kruiswoord; premies tellen alleen op nieuwe letters
    const nieuw = new Set(tegels.map(t => t.i));
    function woordScore(begin, stapje) {
      let start = begin; while (start - stapje >= 0 && proef[start - stapje] && (stapje === 1 ? Math.floor((start - stapje) / 15) === Math.floor(start / 15) : true)) start -= stapje;
      let punten = 0, keer = 1, woord = '';
      for (let i = start; i >= 0 && i < 225 && proef[i] && (stapje === 1 ? Math.floor(i / 15) === Math.floor(start / 15) : true); i += stapje) {
        let w = wWaarde(potje, proef[i]);
        if (nieuw.has(i)) { const pr = W_PREMIE[i]; if (pr === '2L') w *= 2; if (pr === '3L') w *= 3; if (pr === '2W') keer *= 2; if (pr === '3W') keer *= 3; }
        punten += w; woord += proef[i];
      }
      return woord.length > 1 ? { punten: punten * keer, woord } : null;
    }
    const gevormd = [];
    const hoofd = woordScore(posities[0], stap);
    if (hoofd) gevormd.push(hoofd);
    // kruiswoorden staan altijd haaks op het hoofdwoord, dus dubbel tellen kan niet
    for (const t of tegels) { const kruis = woordScore(t.i, horizontaal ? 15 : 1); if (kruis) gevormd.push(kruis); }
    let score = gevormd.reduce((a, g) => a + g.punten, 0);
    if (score === 0) return { status: 400, error: 'Een woord is minstens twee letters.' };
    // het woordenboek keurt elk gevormd woord (NL of EN, per potje gekozen)
    const boek = woordenboek(taalVanPotje(potje));
    if (boek) { const fout = gevormd.find(g => !boek.has(g.woord)); if (fout) return { status: 400, error: '"' + fout.woord.toUpperCase() + '" staat niet in het ' + (taalVanPotje(potje) === 'nl' ? 'Nederlandse' : 'Engelse') + ' woordenboek.' }; }
    if (tegels.length === 7) score += 40; // alle zeven letters: de bonus
    tegels.forEach(t => st.bord[t.i] = t.letter);
    st.rekken[h] = rek;
    while (st.rekken[h].length < 7 && st.zak.length) st.rekken[h].push(st.zak.splice(crypto.randomInt(0, st.zak.length), 1)[0]);
    st.scores[h] += score; st.passes = 0;
    if (!st.rekken[h].length && !st.zak.length) { potje.status = 'klaar'; woordEinde(potje); }
    else potje.beurt = (potje.beurt + 1) % potje.spelers.length;
    save(); nudge(potje.spelers[potje.beurt], potje);
    return { status: 200, ok: true, score };
  }
  function woordEinde(potje) {
    const st = potje.staat;
    for (const h of potje.spelers) st.scores[h] -= st.rekken[h].reduce((a, l) => a + wWaarde(potje, l), 0);
    const beste = potje.spelers.slice().sort((a, b) => st.scores[b] - st.scores[a]);
    potje.gelijk = st.scores[beste[0]] === st.scores[beste[1]];
    potje.winnaar = potje.gelijk ? null : codenaamVan(beste[0]);
  }

  /* ================= lobby: uitnodigen, accepteren, random wachtrij ================= */
  function spelStart(potje) {
    potje.status = 'bezig'; potje.beurt = 0;
    if (potje.soort === 'mejn') mejnInit(potje);
    else if (potje.soort === 'schaak') schaakInit(potje);
    else woordInit(potje);
  }
  function spelNieuw(mij, { soort, grootte, modus, vrienden, taal }) {
    opschonen();
    if (!SOORTEN[soort]) return { status: 400, error: 'Onbekend spel.' };
    const max = soort === 'mejn' ? Math.min(4, Math.max(2, Number(grootte) || 2)) : 2;
    const uitgenodigd = (Array.isArray(vrienden) ? vrienden : []).slice(0, max - 1).filter(v => zijnVrienden(mij, v));
    if (!uitgenodigd.length) return { status: 400, error: 'Nodig minstens een vriend uit (of speel random).' };
    if (uitgenodigd.length > max - 1) return { status: 400, error: 'Te veel spelers voor dit spel.' };
    const potje = { id: rid(5), soort, grootte: max, modus: soort === 'mejn' && modus === 'teams' && max === 4 ? 'teams' : 'vrij',
      taal: taal === 'en' ? 'en' : 'nl',
      teams: [0, 1, 0, 1], spelers: [mij], uitgenodigd, status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: codenaamVan(mij) };
    S().potjes[potje.id] = potje;
    save();
    uitgenodigd.forEach(v => nudge(v, potje));
    return { status: 200, ok: true, id: potje.id };
  }
  function spelAntwoord(mij, id, akkoord) {
    const p = S().potjes[id];
    if (!p || p.status !== 'wacht' || !p.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    p.uitgenodigd = p.uitgenodigd.filter(x => x !== mij);
    if (akkoord === true) {
      p.spelers.push(mij);
      if (p.spelers.length >= p.grootte || (!p.uitgenodigd.length && p.spelers.length >= 2)) spelStart(p);
    } else if (!p.uitgenodigd.length && p.spelers.length < 2) delete S().potjes[id];
    save();
    p.spelers.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true, gestart: p.status === 'bezig' };
  }
  function spelRandom(mij, soort, grootte, taal) {
    opschonen();
    if (!SOORTEN[soort]) return { status: 400, error: 'Onbekend spel.' };
    const max = soort === 'mejn' ? Math.min(4, Math.max(2, Number(grootte) || 2)) : 2;
    const w_taal = taal === 'en' ? 'en' : 'nl';
    const sleutel = soort + ':' + max + (soort === 'woord' ? ':' + w_taal : '');
    const w = S().wachtrij;
    w[sleutel] = (w[sleutel] || []).filter(x => x !== mij);
    w[sleutel].push(mij);
    if (w[sleutel].length >= max) {
      const spelers = w[sleutel].splice(0, max);
      const potje = { id: rid(5), soort, grootte: max, modus: 'vrij', taal: w_taal, teams: [0, 1, 0, 1], spelers, uitgenodigd: [],
        status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: 'random' };
      S().potjes[potje.id] = potje;
      spelStart(potje);
      save();
      spelers.forEach(sp => nudge(sp, potje));
      return { status: 200, ok: true, id: potje.id, gestart: true };
    }
    save();
    return { status: 200, ok: true, wachten: true, plek: w[sleutel].length, nodig: max };
  }
  function mijnSpellen(mij) {
    opschonen();
    const alle = Object.values(S().potjes);
    const mijnPotjes = alle.filter(p => p.spelers.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl',
      spelers: p.spelers.map(codenaamVan), wachtOp: p.uitgenodigd.length,
      aanZet: p.status === 'bezig' ? codenaamVan(p.spelers[p.beurt]) : null, ikAanZet: p.status === 'bezig' && p.spelers[p.beurt] === mij,
      winnaar: p.winnaar, gelijk: !!p.gelijk, at: p.at
    })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
    const uitnodigingen = alle.filter(p => p.status === 'wacht' && p.uitgenodigd.includes(mij)).map(p => ({
      id: p.id, soort: p.soort, naam: SOORTEN[p.soort], van: p.door, spelers: p.spelers.map(codenaamVan), modus: p.modus
    }));
    return { potjes: mijnPotjes, uitnodigingen };
  }
  function spelStaat(mij, id) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const uit = { id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl', teams: p.teams.slice(0, p.spelers.length),
      spelers: p.spelers.map(codenaamVan), ik: p.spelers.indexOf(mij), beurt: p.beurt, winnaar: p.winnaar, gelijk: !!p.gelijk };
    const st = p.staat;
    if (p.status !== 'wacht' && st) {
      if (p.soort === 'mejn') uit.staat = { pionnen: p.spelers.map(sp => st.pionnen[sp].map(x => x.pos)), dobbel: st.dobbel, mag: st.mag, zetten: p.spelers[p.beurt] === mij && st.mag === 'zet' ? mejnZetten(p, mij) : [] };
      else if (p.soort === 'schaak') uit.staat = { bord: st.bord.join(''), aanZet: st.aanZet, laatste: st.zetten[st.zetten.length - 1] || null };
      else uit.staat = { bord: st.bord, scores: p.spelers.map(sp => st.scores[sp]), rek: st.rekken[mij], zak: st.zak.length, passes: st.passes };
    }
    return { status: 200, potje: uit };
  }
  function spelZet(mij, id, zet) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status !== 'bezig') return { status: 409, error: 'Dit potje loopt niet (meer).' };
    if (p.soort !== 'schaak' && p.spelers[p.beurt] !== mij) return { status: 409, error: 'De ander is aan zet.' };
    if (p.soort === 'mejn') return zet && zet.actie === 'gooi' ? mejnGooi(p, mij) : mejnZet(p, mij, zet || {});
    if (p.soort === 'schaak') return schaakZet(p, mij, zet || {});
    return woordZet(p, mij, zet || {});
  }
  function spelOpgeven(mij, id) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status === 'klaar') return { status: 409, error: 'Dit potje is al klaar.' };
    p.status = 'klaar';
    const rest = p.spelers.filter(sp => sp !== mij);
    p.winnaar = rest.length === 1 ? codenaamVan(rest[0]) : rest.map(codenaamVan).join(' & ');
    save();
    rest.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true };
  }

  /* ================= Sneek: de ranglijst onder vrienden ================= */
  function sneekScore(mij, punten) {
    const n = Math.max(0, Math.min(99999, Math.floor(Number(punten) || 0)));
    const s = S().sneek;
    if (!s[mij] || n > s[mij].punten) { s[mij] = { punten: n, at: nu() }; save(); }
    return { status: 200, ok: true, beste: s[mij].punten };
  }
  function sneekBord(mij, vrienden) {
    const s = S().sneek;
    const rij = [mij, ...vrienden].filter(h => s[h]).map(h => ({ codenaam: codenaamVan(h), ik: h === mij, punten: s[h].punten }));
    return { bord: rij.sort((a, b) => b.punten - a.punten).slice(0, 20) };
  }

  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, sneekScore, sneekBord, SPEL_SOORTEN: SOORTEN };
};
