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
   - Dammen: 10x10 internationaal, slaan verplicht, meerslag met hetzelfde
     stuk, een dam vliegt over de diagonaal.
   - Rummi (rummikub-achtig): 106 stenen, eerste uitleg van 30 punten,
     daarna vrij herschikken; de server keurt de hele tafel bij elke beurt.
   - Magnaat (monopoly-achtig): 2 t/m 6 spelers, 40 velden in de RTG-wereld,
     kopen, huur, bouwen, kanskaarten en de gevangenis; wie overblijft wint.
   - Partyspellen: 30 Seconden (2 tegen 2, eer-systeem), Doen of Waarheid
     (2 t/m 6) en Proost (2 t/m 6, alleen 18+ met paspoort-geboortedatum).
   - Arcade (Sneek, Tetris, Sudoku): ieder speelt zelf; de beste scores
     vormen een ranglijst onder vrienden.

   Een potje start met uitgenodigde vrienden (die accepteren zelf), op
   codenaam (maakt geen vriendschap) of via de random wachtrij per spel en
   groepsgrootte. Beurten gaan via polling plus een SSE-duwtje. */
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  function S() {
    if (!db.data.spellen) db.data.spellen = { potjes: {}, wachtrij: {} };
    return db.data.spellen;
  }
  /* Een tabel per spel is de enige bron: naam, spelersaantal en welke app het
     potje START (meespelen op uitnodiging kan altijd over en weer). 'min'
     dwingt af dat 30 Seconden echt met vier begint; 'volwassen' is de
     18+-poort van Proost (paspoort-geboortedatum; RTF-profielen hebben geen
     geverifieerde leeftijd en doen dus nooit mee). */
  const SPEL = {
    mejn:     { naam: 'Mens erger je niet', max: 4, wereld: 'rtf' },
    schaak:   { naam: 'Schaken',            max: 2, wereld: 'rtg' },
    woord:    { naam: 'Woordduel',          max: 2, wereld: 'rtg' },
    pesten:   { naam: 'Pesten',             max: 4, wereld: 'rtf' },
    dam:      { naam: 'Dammen',             max: 2, wereld: 'rtf' },
    rummi:    { naam: 'Rummi',              max: 4, wereld: 'rtf' },
    magnaat:  { naam: 'Magnaat',            max: 6, wereld: 'rtg', buitenBeurt: ['bouw', 'verkoop'] },
    seconden: { naam: '30 Seconden',        max: 4, min: 4, wereld: 'rtg' },
    waarheid: { naam: 'Doen of Waarheid',   max: 6, wereld: 'rtf' },
    proost:   { naam: 'Proost',             max: 6, wereld: 'rtg', volwassen: true }
  };
  const SOORTEN = Object.fromEntries(Object.entries(SPEL).map(([k, v]) => [k, v.naam]));
  const TEAMS = [0, 1, 0, 1, 0, 1]; // om en om twee teams, tot zes spelers
  function wereldFout(wereld, soort) {
    if (!SPEL[soort] || SPEL[soort].wereld === wereld || (wereld !== 'rtg' && wereld !== 'rtf')) return null;
    return wereld === 'rtg' ? 'Dit spel vind je in de RTFoundation-app.' : 'Dit spel vind je in de RTG-leden-app.';
  }
  // de 18+-poort, op ELK toetredingsmoment (starten, uitnodigen, accepteren)
  function leeftijdFout(soort, handle) {
    if (SPEL[soort] && SPEL[soort].volwassen && !volwassen(handle))
      return 'Proost is 18+. Dit spel kan alleen met leden met een geverifieerde volwassen leeftijd.';
    return null;
  }
  const nudge = (naar, potje) => { try { sseToCustomer(naar, 'social', { kind: 'spel', potje: potje.id, soort: potje.soort }); } catch (e) {} };
  // eerlijk schudden (Fisher-Yates op crypto), gedeeld door alle kaart- en letterzakken
  function schud(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // beurt doorschuiven met de klok mee (of tegen, met stap -1); spel-neutraal
  function beurtDoor(potje, stap) {
    const n = potje.spelers.length;
    potje.beurt = ((potje.beurt + (stap || 1)) % n + n) % n;
  }

  /* ---------- opschonen: klare potjes na een dag weg, wachtenden na een uur.
     Hooguit een keer per minuut: de scan over alle potjes hoort niet in het
     hete pad van elke lobby-poll. ---------- */
  let opgeschoondOm = 0;
  function opschonen() {
    const t = Date.now();
    if (t - opgeschoondOm < 60000) return;
    opgeschoondOm = t;
    const s = S();
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
    schud(zak);
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

  /* ================= Pesten =================
     Het klassieke Nederlandse kaartspel, 2 t/m 4 spelers. Pak je slag:
     2 = de volgende pakt er twee (stapelt door), 8 = de volgende wacht een
     beurt, boer = kies een kleur (altijd te leggen), aas = de richting
     draait. Kun je niets: pak een kaart. Wie het eerst leeg is, wint. */
  const P_KLEUREN = ['H', 'R', 'K', 'S'];
  const P_RANGEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'K', 'A'];
  function pestenInit(potje) {
    const dek = [];
    for (const kl of P_KLEUREN) for (const rg of P_RANGEN) dek.push(kl + rg);
    schud(dek);
    const st = { handen: {}, stapel: dek, open: [], kleurKeuze: null, pak: 0, richting: 1 };
    for (const h of potje.spelers) st.handen[h] = st.stapel.splice(0, 7);
    st.open.push(st.stapel.pop());
    potje.staat = st;
  }
  const pKleur = (k) => k[0];
  const pRang = (k) => k.slice(1);
  function pestenMag(st, kaart) {
    const top = st.open[st.open.length - 1];
    if (st.pak > 0) return pRang(kaart) === '2'; // een pakstapel stapel je alleen door met een 2
    if (pRang(kaart) === 'B') return true;       // de boer mag altijd
    const kleur = st.kleurKeuze || pKleur(top);
    return pKleur(kaart) === kleur || pRang(kaart) === pRang(top);
  }
  function pestenTrek(st, n) {
    const uit = [];
    for (let i = 0; i < n; i++) {
      if (!st.stapel.length) {
        // de aflegstapel (op de bovenste na) wordt de nieuwe trekstapel
        const top = st.open.pop();
        st.stapel = schud(st.open); st.open = [top];
      }
      if (st.stapel.length) uit.push(st.stapel.pop());
    }
    return uit;
  }
  function pestenVolgende(potje, slaOver) {
    beurtDoor(potje, potje.staat.richting);
    if (slaOver) beurtDoor(potje, potje.staat.richting);
  }
  function pestenZet(potje, h, zet) {
    const st = potje.staat, hand = st.handen[h];
    if (zet.pak === true) {
      const n = st.pak > 0 ? st.pak : 1;
      st.handen[h] = hand.concat(pestenTrek(st, n));
      st.pak = 0;
      pestenVolgende(potje, false);
      save(); nudge(potje.spelers[potje.beurt], potje);
      return { status: 200, ok: true, gepakt: n };
    }
    const kaart = String(zet.kaart || '');
    if (!hand.includes(kaart)) return { status: 400, error: 'Die kaart heb je niet.' };
    if (!pestenMag(st, kaart)) return { status: 400, error: st.pak > 0 ? 'Er ligt een pakstapel: leg een 2 of pak ' + st.pak + ' kaarten.' : 'Die kaart past niet op wat er ligt.' };
    const rang = pRang(kaart);
    // eerst ALLES keuren, dan pas de staat aanraken: een afgekeurde boer mag
    // de eerder gekozen kleur niet stilletjes wissen
    const kleur = rang === 'B' ? String(zet.kleur || '').toUpperCase() : null;
    if (rang === 'B' && !P_KLEUREN.includes(kleur)) return { status: 400, error: 'Kies een kleur bij de boer (H, R, K of S).' };
    hand.splice(hand.indexOf(kaart), 1);
    st.open.push(kaart);
    st.kleurKeuze = null;
    let slaOver = false;
    if (rang === '2') st.pak += 2;
    else if (rang === '8') slaOver = true;
    else if (rang === 'A') st.richting *= -1;
    else if (rang === 'B') st.kleurKeuze = kleur;
    if (!hand.length) { potje.status = 'klaar'; potje.winnaar = codenaamVan(h); }
    else pestenVolgende(potje, slaOver);
    save(); nudge(potje.spelers[potje.beurt], potje);
    return { status: 200, ok: true };
  }

  /* ================= Dammen =================
     Internationaal op 10x10: schijven stappen schuin vooruit, slaan mag ook
     achteruit en is verplicht, meerslag gaat door met hetzelfde stuk, en op
     de laatste rij word je dam (die vliegt over de hele diagonaal). Als
     huisregel hoeft de meerderheidsslag niet: elke slag telt. */
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
  const R_KLEUREN = ['r', 'b', 'g', 'z']; // rood, blauw, geel (goud), zwart
  function rummiInit(potje) {
    const zak = [];
    for (const kl of R_KLEUREN) for (let n = 1; n <= 13; n++) { zak.push(kl + n, kl + n); }
    zak.push('*', '*');
    schud(zak);
    const st = { zak, rekken: {}, tafel: [], eerste: {}, passes: 0 };
    for (const h of potje.spelers) { st.rekken[h] = zak.splice(0, 14); st.eerste[h] = false; }
    potje.staat = st;
  }
  // is dit setje een geldige groep of rij? levert de puntwaarde, anders null
  function rummiSet(set) {
    if (!Array.isArray(set) || set.length < 3) return null;
    const echte = set.map((t, i) => [t, i]).filter(([t]) => t !== '*');
    if (!echte.length) return null;
    const nums = echte.map(([t]) => Number(t.slice(1))), kleuren = echte.map(([t]) => t[0]);
    if (nums.some(n => !(n >= 1 && n <= 13)) || kleuren.some(kl => !R_KLEUREN.includes(kl))) return null;
    // groep: zelfde nummer, allemaal een andere kleur, hooguit 4 stenen
    if (set.length <= 4 && nums.every(n => n === nums[0]) && new Set(kleuren).size === echte.length) return nums[0] * set.length;
    // rij: een kleur, opeenvolgende nummers; jokers vullen de gaten
    if (new Set(kleuren).size === 1 && set.length <= 13) {
      const start = nums[0] - echte[0][1];
      if (start >= 1 && start + set.length - 1 <= 13 && echte.every(([t, i]) => Number(t.slice(1)) === start + i))
        return set.reduce((som, _, i) => som + start + i, 0);
    }
    return null;
  }
  const rummiTel = (lijst) => { const m = {}; for (const t of lijst) m[t] = (m[t] || 0) + 1; return m; };
  function rummiZet(potje, h, zet) {
    const st = potje.staat, rek = st.rekken[h];
    if (zet.pak === true) {
      if (st.zak.length) { rek.push(st.zak.pop()); st.passes = 0; }
      else st.passes++;
      if (st.passes >= potje.spelers.length) return rummiEinde(potje); // zak leeg en niemand kan meer
      beurtDoor(potje);
      save(); nudge(potje.spelers[potje.beurt], potje);
      return { status: 200, ok: true, gepakt: true };
    }
    const tafel = Array.isArray(zet.tafel) ? zet.tafel.filter(s => Array.isArray(s) && s.length) : null;
    if (!tafel) return { status: 400, error: 'Stuur de nieuwe tafel mee, of pak een steen.' };
    const waardes = tafel.map(rummiSet);
    const fout = waardes.findIndex(w => w == null);
    if (fout >= 0) return { status: 400, error: 'Setje ' + (fout + 1) + ' is geen geldige rij of groep.' };
    // welke stenen komen er nieuw bij? die moeten allemaal uit jouw rek komen
    const oud = rummiTel(st.tafel.flat()), nieuw = rummiTel(tafel.flat()), mijn = rummiTel(rek);
    const gebruikt = [];
    for (const [t, n] of Object.entries(nieuw)) {
      const extra = n - (oud[t] || 0);
      if (extra < 0) return { status: 400, error: 'Er verdwijnen stenen van de tafel; dat mag niet.' };
      if (extra > (mijn[t] || 0)) return { status: 400, error: 'Die stenen heb je niet op je rek.' };
      for (let i = 0; i < extra; i++) gebruikt.push(t);
    }
    for (const [t, n] of Object.entries(oud)) if ((nieuw[t] || 0) < n) return { status: 400, error: 'Er verdwijnen stenen van de tafel; dat mag niet.' };
    if (!gebruikt.length) return { status: 400, error: 'Leg minstens een steen uit je rek aan.' };
    // eerste uitleg: minstens 30 punten, in eigen nieuwe setjes zonder de tafel te verbouwen
    if (!st.eerste[h]) {
      const oudeSets = new Set(st.tafel.map(s => s.slice().sort().join(',')));
      let punten = 0;
      for (let i = 0; i < tafel.length; i++) {
        const sleutel = tafel[i].slice().sort().join(',');
        if (oudeSets.has(sleutel)) { oudeSets.delete(sleutel); continue; }
        const vanRek = tafel[i].every(t => (mijn[t] || 0) > 0);
        if (!vanRek) return { status: 400, error: 'Je eerste uitleg komt helemaal uit je eigen rek (minstens 30 punten).' };
        punten += waardes[i];
      }
      if (punten < 30) return { status: 400, error: 'Je eerste uitleg telt ' + punten + ' punten; er zijn er minstens 30 nodig.' };
      st.eerste[h] = true;
    }
    st.tafel = tafel.map(s => s.slice());
    for (const t of gebruikt) rek.splice(rek.indexOf(t), 1);
    st.passes = 0;
    if (!rek.length) { potje.status = 'klaar'; potje.winnaar = codenaamVan(h); }
    else beurtDoor(potje);
    save(); nudge(potje.spelers[potje.beurt], potje);
    return { status: 200, ok: true };
  }
  function rummiEinde(potje) {
    // zak leeg en iedereen past: het laagste rek (joker telt 30) wint
    const st = potje.staat;
    const som = (h) => st.rekken[h].reduce((s, t) => s + (t === '*' ? 30 : Number(t.slice(1))), 0);
    const beste = potje.spelers.slice().sort((a, b) => som(a) - som(b));
    potje.status = 'klaar';
    potje.winnaar = som(beste[0]) === som(beste[1]) ? null : codenaamVan(beste[0]);
    potje.gelijk = !potje.winnaar;
    save(); potje.spelers.forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, einde: true };
  }

  /* ================= Magnaat (monopoly-achtig, 2 t/m 6) =================
     Veertig velden door de RTG-wereld. Kopen, huur innen, bouwen op een
     complete kleurgroep, kans- en kaskaarten, de cel en start-geld. Wie niet
     kan betalen verkoopt automatisch terug aan de bank (halve prijs); is dat
     niet genoeg, dan ben je failliet en spelen de anderen door. */
  const M_GROEP_HUIZEN = [1, 5, 12, 35, 70, 120]; // huurfactor bij 0..5 huizen (5 = hotel)
  const M_VELDEN = [
    { t: 'start', n: 'Start' },
    { t: 'straat', n: 'Strandtent Ibiza', p: 60, g: 0 }, { t: 'kas', n: 'Kas' }, { t: 'straat', n: 'Beachclub Blanca', p: 60, g: 0 },
    { t: 'belasting', n: 'Toeristenbelasting', p: 200 }, { t: 'station', n: 'RTG Transfers', p: 200 },
    { t: 'straat', n: 'Tapasbar Sol', p: 100, g: 1 }, { t: 'kans', n: 'Kans' }, { t: 'straat', n: 'Bodega Mar', p: 100, g: 1 }, { t: 'straat', n: 'Chiringuito Luz', p: 120, g: 1 },
    { t: 'cel', n: 'Op bezoek / de cel' },
    { t: 'straat', n: 'Salon Amsterdam', p: 140, g: 2 }, { t: 'nut', n: 'RTG Energie', p: 150 }, { t: 'straat', n: 'Grachtenatelier', p: 140, g: 2 }, { t: 'straat', n: 'Modehuis Noord', p: 160, g: 2 },
    { t: 'station', n: 'RTG Jets', p: 200 },
    { t: 'straat', n: 'Bistro Milaan', p: 180, g: 3 }, { t: 'kas', n: 'Kas' }, { t: 'straat', n: 'Galleria Moda', p: 180, g: 3 }, { t: 'straat', n: 'Teatro Aperto', p: 200, g: 3 },
    { t: 'vrij', n: 'Vrij parkeren' },
    { t: 'straat', n: 'Rooftop Barcelona', p: 220, g: 4 }, { t: 'kans', n: 'Kans' }, { t: 'straat', n: 'Casa del Arte', p: 220, g: 4 }, { t: 'straat', n: 'Mercado Central', p: 240, g: 4 },
    { t: 'station', n: 'RTG Yachts', p: 200 },
    { t: 'straat', n: 'Spa Kyoto', p: 260, g: 5 }, { t: 'straat', n: 'Theehuis Zen', p: 260, g: 5 }, { t: 'nut', n: 'RTG Water', p: 150 }, { t: 'straat', n: 'Ryokan Sakura', p: 280, g: 5 },
    { t: 'naarcel', n: 'Ga naar de cel' },
    { t: 'straat', n: 'Club Saint-Tropez', p: 300, g: 6 }, { t: 'straat', n: 'Vignoble Azur', p: 300, g: 6 }, { t: 'kas', n: 'Kas' }, { t: 'straat', n: 'Palais Riviera', p: 320, g: 6 },
    { t: 'station', n: 'RTG Rail', p: 200 },
    { t: 'kans', n: 'Kans' }, { t: 'straat', n: 'Penthouse Dubai', p: 350, g: 7 }, { t: 'belasting', n: 'Weeldebelasting', p: 100 }, { t: 'straat', n: 'Marina Skyline', p: 400, g: 7 }
  ];
  const M_KAARTEN = [
    { tekst: 'De Salon deelt je post: ontvang 50.', geld: 50 },
    { tekst: 'Dividend van RTG Jets: ontvang 100.', geld: 100 },
    { tekst: 'Fooienpot van je beachclub: ontvang 25.', geld: 25 },
    { tekst: 'Achterstallig onderhoud: betaal 75.', geld: -75 },
    { tekst: 'Parkeerboete op de boulevard: betaal 40.', geld: -40 },
    { tekst: 'Je wint de RTG-quiz: ontvang 150.', geld: 150 },
    { tekst: 'Ga direct naar Start en ontvang 200.', naar: 0 },
    { tekst: 'Storm op zee: je jacht moet de haven in. Betaal 60.', geld: -60 },
    { tekst: 'Ga direct naar de cel, zonder langs Start te komen.', cel: true },
    { tekst: 'Iedereen proost op jou: elke speler betaalt je 20.', vanIeder: 20 }
  ];
  function magnaatInit(potje) {
    const st = { posities: {}, geld: {}, eigenaar: {}, huizen: {}, cel: {}, failliet: {}, dobbel: null, mag: 'gooi', koopVeld: null, kaart: null, dubbels: 0 };
    for (const h of potje.spelers) { st.posities[h] = 0; st.geld[h] = 1500; st.cel[h] = 0; st.failliet[h] = false; }
    potje.staat = st;
  }
  const magGroepCompleet = (st, g) => M_VELDEN.every((v, i) => v.g !== g || v.t !== 'straat' || st.eigenaar[i] != null) &&
    new Set(M_VELDEN.map((v, i) => v.t === 'straat' && v.g === g ? st.eigenaar[i] : null).filter(x => x != null)).size === 1;
  function magHuur(st, veld, worp) {
    const v = M_VELDEN[veld], baas = st.eigenaar[veld];
    if (v.t === 'station') { const n = M_VELDEN.filter((x, i) => x.t === 'station' && st.eigenaar[i] === baas).length; return 25 * Math.pow(2, n - 1); }
    if (v.t === 'nut') { const n = M_VELDEN.filter((x, i) => x.t === 'nut' && st.eigenaar[i] === baas).length; return worp * (n === 2 ? 10 : 4); }
    const basis = Math.round(v.p / 10);
    const h = st.huizen[veld] || 0;
    return basis * M_GROEP_HUIZEN[h] / (h === 0 && !magGroepCompleet(st, v.g) ? 2 : 1);
  }
  function naarDeCel(st, h) { st.posities[h] = 10; st.cel[h] = 3; st.dubbels = 0; }
  function magVolgende(potje) {
    const st = potje.staat, n = potje.spelers.length;
    st.dobbel = null; st.mag = 'gooi'; st.koopVeld = null; st.dubbels = 0;
    for (let stap = 1; stap <= n; stap++) {
      const kand = potje.spelers[(potje.beurt + stap) % n];
      if (!st.failliet[kand]) { potje.beurt = potje.spelers.indexOf(kand); return; }
    }
  }
  function magBetaal(potje, h, bedrag, aan) {
    // automatisch afrekenen; komt de speler tekort, dan verkoopt de bank
    // eerst huizen en dan straten terug (halve prijs); daarna failliet
    const st = potje.staat;
    while (st.geld[h] < bedrag) {
      const metHuis = Object.keys(st.huizen).find(v => st.eigenaar[v] === h && st.huizen[v] > 0);
      if (metHuis != null) { st.huizen[metHuis]--; st.geld[h] += Math.round(M_VELDEN[metHuis].p / 4); continue; }
      const bezit = Object.keys(st.eigenaar).find(v => st.eigenaar[v] === h);
      if (bezit != null) { delete st.eigenaar[bezit]; delete st.huizen[bezit]; st.geld[h] += Math.round(M_VELDEN[bezit].p / 2); continue; }
      break;
    }
    const echt = Math.min(bedrag, st.geld[h]);
    st.geld[h] -= echt;
    if (aan) st.geld[aan] += echt;
    if (echt < bedrag) {
      st.failliet[h] = true;
      // bezittingen terug naar de bank; de rest speelt door
      for (const v of Object.keys(st.eigenaar)) if (st.eigenaar[v] === h) { delete st.eigenaar[v]; delete st.huizen[v]; }
      const over = potje.spelers.filter(sp => !st.failliet[sp]);
      if (over.length === 1) { potje.status = 'klaar'; potje.winnaar = codenaamVan(over[0]); }
    }
  }
  function magnaatZet(potje, h, zet) {
    const st = potje.staat;
    if (st.failliet[h]) return { status: 409, error: 'Je bent failliet; dit potje kijk je uit.' };
    const actie = String(zet.actie || '');
    if (actie === 'bouw' || actie === 'verkoop') {
      const veld = Number(zet.veld), v = M_VELDEN[veld];
      if (!v || v.t !== 'straat' || st.eigenaar[veld] !== h) return { status: 400, error: 'Dat veld is niet van jou.' };
      if (actie === 'bouw') {
        if (!magGroepCompleet(st, v.g)) return { status: 400, error: 'Bouwen kan pas als de hele kleurgroep van jou is.' };
        if ((st.huizen[veld] || 0) >= 5) return { status: 400, error: 'Hier staat al een hotel.' };
        const prijs = Math.round(v.p / 2);
        if (st.geld[h] < prijs) return { status: 400, error: 'Bouwen kost ' + prijs + '; dat heb je nu niet.' };
        st.geld[h] -= prijs; st.huizen[veld] = (st.huizen[veld] || 0) + 1;
      } else {
        if ((st.huizen[veld] || 0) > 0) { st.huizen[veld]--; st.geld[h] += Math.round(v.p / 4); }
        else { delete st.eigenaar[veld]; delete st.huizen[veld]; st.geld[h] += Math.round(v.p / 2); }
      }
      save(); return { status: 200, ok: true };
    }
    if (actie === 'koop' || actie === 'sla') {
      if (st.mag !== 'koop' || st.koopVeld == null) return { status: 409, error: 'Er valt nu niets te kopen.' };
      const veld = st.koopVeld, v = M_VELDEN[veld];
      if (actie === 'koop') {
        if (st.geld[h] < v.p) return { status: 400, error: 'Daar heb je niet genoeg geld voor.' };
        st.geld[h] -= v.p; st.eigenaar[veld] = h;
      }
      if (st.dubbels > 0 && !st.failliet[h]) { st.mag = 'gooi'; st.koopVeld = null; } else magVolgende(potje);
      save(); nudge(potje.spelers[potje.beurt], potje);
      return { status: 200, ok: true };
    }
    if (actie !== 'gooi') return { status: 400, error: 'Onbekende actie.' };
    if (st.mag !== 'gooi') return { status: 409, error: 'Rond eerst je kopen af.' };
    st.kaart = null;
    const d1 = crypto.randomInt(1, 7), d2 = crypto.randomInt(1, 7), worp = d1 + d2;
    st.dobbel = [d1, d2];
    // in de cel: alleen met dubbel kom je gratis vrij; na drie beurten betaal je 50.
    // De vrijkom-dubbel geeft GEEN extra worp (zoals aan tafel).
    let vrijMetDubbel = false;
    if (st.cel[h] > 0) {
      if (d1 === d2) { st.cel[h] = 0; vrijMetDubbel = true; }
      else if (--st.cel[h] === 0) magBetaal(potje, h, 50, null);
      else { magVolgende(potje); save(); nudge(potje.spelers[potje.beurt], potje); return { status: 200, ok: true, dobbel: st.dobbel, cel: true }; }
      if (st.failliet[h] || potje.status === 'klaar') { magVolgende(potje); save(); return { status: 200, ok: true, dobbel: st.dobbel }; }
    }
    st.dubbels = d1 === d2 && !vrijMetDubbel ? st.dubbels + 1 : 0;
    if (st.dubbels >= 3) { naarDeCel(st, h); magVolgende(potje); save(); nudge(potje.spelers[potje.beurt], potje); return { status: 200, ok: true, dobbel: st.dobbel, naarCel: true }; }
    const oud = st.posities[h];
    let pos = (oud + worp) % 40;
    if (pos < oud) st.geld[h] += 200; // langs Start
    st.posities[h] = pos;
    const v = M_VELDEN[pos];
    if (v.t === 'naarcel') naarDeCel(st, h);
    else if (v.t === 'belasting') magBetaal(potje, h, v.p, null);
    else if (v.t === 'kans' || v.t === 'kas') {
      const kaart = M_KAARTEN[crypto.randomInt(0, M_KAARTEN.length)];
      st.kaart = kaart.tekst;
      if (kaart.geld > 0) st.geld[h] += kaart.geld;
      else if (kaart.geld < 0) magBetaal(potje, h, -kaart.geld, null);
      else if (kaart.naar != null) { st.posities[h] = kaart.naar; st.geld[h] += 200; }
      else if (kaart.cel) naarDeCel(st, h);
      else if (kaart.vanIeder) for (const sp of potje.spelers) if (sp !== h && !st.failliet[sp]) magBetaal(potje, sp, kaart.vanIeder, h);
    }
    else if ((v.t === 'straat' || v.t === 'station' || v.t === 'nut')) {
      const baas = st.eigenaar[pos];
      if (baas == null) { st.mag = 'koop'; st.koopVeld = pos; save(); return { status: 200, ok: true, dobbel: st.dobbel, teKoop: pos }; }
      if (baas !== h) magBetaal(potje, h, Math.round(magHuur(st, pos, worp)), baas);
    }
    if (potje.status === 'klaar') { save(); potje.spelers.forEach(sp => nudge(sp, potje)); return { status: 200, ok: true, dobbel: st.dobbel }; }
    if (st.dubbels > 0 && !st.failliet[h] && st.cel[h] === 0) { st.mag = 'gooi'; save(); return { status: 200, ok: true, dobbel: st.dobbel, nogEens: true }; }
    magVolgende(potje);
    save(); nudge(potje.spelers[potje.beurt], potje);
    return { status: 200, ok: true, dobbel: st.dobbel };
  }

  /* ================= partyspellen =================
     30 Seconden: 2 tegen 2. De verteller pakt een kaart met vijf begrippen en
     omschrijft ze (bel of aan tafel); de tegenpartij kijkt mee op het scherm,
     de rader juist niet. Daarna vult de verteller eerlijk in hoeveel er goed
     waren: het eer-systeem, zoals thuis. Eerste team op 30 wint. */
  const S_BEGRIPPEN = ('zonnebril,strandstoel,vuurtoren,koffer,paspoort,cocktail,dj,zwembad,hangmat,surfplank,' +
    'olifant,flamingo,dolfijn,papegaai,schildpad,kameleon,pinguin,zeehond,vlinder,eekhoorn,' +
    'kapper,piloot,chirurg,scheidsrechter,tolk,imker,loodgieter,fotograaf,dirigent,advocaat,' +
    'wereldbol,kompas,verrekijker,tandenborstel,paraplu,wasmachine,magnetron,stofzuiger,gieter,ladder,' +
    'bruiloft,verjaardag,sinterklaas,koningsdag,carnaval,marathon,verhuizing,sollicitatie,examen,vakantie,' +
    'pannenkoek,stroopwafel,bitterbal,erwtensoep,sushi,paella,tiramisu,croissant,smoothie,barbecue,' +
    'schaatsen,zeilen,klimmen,boogschieten,jongleren,breakdance,karaoke,schaken,vissen,kamperen,' +
    'piramide,iglo,molen,wolkenkrabber,aquaduct,vuurwerk,regenboog,lawine,woestijn,waterval,' +
    'gitaar,dwarsfluit,trommel,accordeon,viool,saxofoon,harp,mondharmonica,triangel,doedelzak,' +
    'raket,duikboot,heteluchtballon,bakfiets,steppen,tractor,kabelbaan,roltrap,zeppelin,hovercraft').split(',');
  function secondenInit(potje) {
    potje.staat = { scores: [0, 0], kaart: null, tot: null };
  }
  function secondenZet(potje, h, zet) {
    const st = potje.staat, actie = String(zet.actie || '');
    if (actie === 'kaart') {
      if (st.kaart) return { status: 409, error: 'Er ligt al een kaart; vul eerst de score in.' };
      const kies = new Set(); while (kies.size < 5) kies.add(S_BEGRIPPEN[crypto.randomInt(0, S_BEGRIPPEN.length)]);
      st.kaart = [...kies]; st.tot = Date.now() + 33000; // 30 tellen plus even ademhalen
      save(); potje.spelers.forEach(sp => nudge(sp, potje));
      return { status: 200, ok: true, kaart: st.kaart, tot: st.tot };
    }
    if (actie !== 'score') return { status: 400, error: 'Onbekende actie.' };
    if (!st.kaart) return { status: 409, error: 'Pak eerst een kaart.' };
    const goed = Math.max(0, Math.min(5, Number(zet.goed) || 0));
    const team = potje.teams[potje.beurt];
    st.scores[team] += goed;
    st.kaart = null; st.tot = null;
    if (st.scores[team] >= 30) {
      potje.status = 'klaar';
      potje.winnaar = potje.spelers.filter((_, i) => potje.teams[i] === team).map(codenaamVan).join(' & ');
    } else potje.beurt = (potje.beurt + 1) % potje.spelers.length;
    save(); potje.spelers.forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, goed };
  }

  /* Doen of Waarheid: 2 t/m 6 spelers, om de beurt kiezen, eerlijk afvinken
     (eer-systeem). Wie het eerst acht kaarten afrondt wint. De kaarten zijn
     voor iedereen leuk: niets gemeens, niets wat je niet durft te laten zien. */
  const W_WAARHEID = ['Wat is het gekste dat je ooit gegeten hebt?', 'Waar lag je als kind wakker van?', 'Wat is je meest onhandige moment van dit jaar?',
    'Welk compliment is je altijd bijgebleven?', 'Wat zou je doen met een dag onzichtbaarheid?', 'Welk liedje ken je stiekem helemaal uit je hoofd?',
    'Wat is het beste cadeau dat je ooit gaf?', 'Waar kun je uren over praten?', 'Wat wilde je vroeger later worden?', 'Wat is je slechtste gewoonte?',
    'Voor wie in dit potje heb je stiekem bewondering, en waarom?', 'Wat is het aardigste dat een vreemde ooit voor je deed?', 'Welke gewoonte van jezelf vind je zelf grappig?',
    'Wat staat er bovenaan je bucketlist?', 'Welke film heb je vaker dan vijf keer gezien?', 'Wat is je guilty pleasure?'];
  const W_DOEN = ['Doe je beste dierengeluid, tien tellen lang.', 'Zing het refrein van het laatste liedje dat je hoorde.', 'Vertel een mop; niemand hoeft te lachen.',
    'Doe twintig seconden je beste robotdans.', 'Praat tot je volgende beurt met een accent.', 'Noem in tien tellen vijf dingen die geel zijn.',
    'Geef iedereen in het potje een oprecht compliment.', 'Doe je beste slow-motion sprint.', 'Vertel het verhaal van je dag als sportcommentator.',
    'Teken met je ogen dicht een huis en laat het zien.', 'Doe je beste imitatie van iemand in dit potje (lief houden).', 'Zeg het alfabet achterstevoren zo ver je komt.',
    'Balanceer tien tellen op een been met je armen wijd.', 'Spreek drie zinnen zonder de letter e.', 'Doe alsof je een prijs wint en houd een dankwoord.'];
  function waarheidInit(potje) {
    const st = { punten: {}, kaart: null, wat: null };
    for (const h of potje.spelers) st.punten[h] = 0;
    potje.staat = st;
  }
  function waarheidZet(potje, h, zet) {
    const st = potje.staat, actie = String(zet.actie || '');
    if (actie === 'kies') {
      if (st.kaart) return { status: 409, error: 'Er ligt al een kaart; rond die eerst af.' };
      st.wat = zet.wat === 'doen' ? 'doen' : 'waarheid';
      const lijst = st.wat === 'doen' ? W_DOEN : W_WAARHEID;
      st.kaart = lijst[crypto.randomInt(0, lijst.length)];
      save(); potje.spelers.forEach(sp => nudge(sp, potje));
      return { status: 200, ok: true, kaart: st.kaart };
    }
    if (actie !== 'af') return { status: 400, error: 'Onbekende actie.' };
    if (!st.kaart) return { status: 409, error: 'Kies eerst doen of waarheid.' };
    if (zet.gedaan === true) st.punten[h]++;
    st.kaart = null; st.wat = null;
    if (st.punten[h] >= 8) { potje.status = 'klaar'; potje.winnaar = codenaamVan(h); }
    else potje.beurt = (potje.beurt + 1) % potje.spelers.length;
    save(); potje.spelers.forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true };
  }

  /* Proost: het drankspel, alleen voor 18+. Kaarten met opdrachten voor de
     groep; wie niet wil of niet drinkt, drinkt water; dat staat er ook bij.
     Na 25 kaarten is het potje klaar. Geen winnaar of verliezer. */
  const P_PROOST = ['{A} proost met iedereen en neemt 1 slok.', 'Iedereen die vandaag heeft gewerkt: 1 slok.', '{A} kiest iemand die 2 slokken neemt.',
    'Linkerbuur van {A}: 1 slok.', 'Waterronde: iedereen een glas water. Verplicht.', 'Iedereen die weleens te laat op een feest kwam: 1 slok.',
    '{A} vertelt een geheimpje of neemt 3 slokken.', 'De jongste van het stel: 2 slokken.', 'Iedereen met een huisdier: 1 slok.',
    '{A} en {B} klinken en nemen samen 1 slok.', 'Wie het laatst gelachen heeft om een eigen grap: 2 slokken.', 'Iedereen die vandaag sport heeft gedaan deelt 2 slokken uit.',
    '{A} mag een regel instellen die tot het einde geldt.', 'Complimentenronde: wie een compliment krijgt, neemt 1 slok.', 'Iedereen die zijn telefoon vasthoudt: 2 slokken.',
    '{A} doet een toost op de groep; iedereen 1 slok.', 'Duimen op tafel! De laatste: 2 slokken.', 'Wie ooit een verjaardag vergat: 1 slok.',
    'Iedereen wijst de beste kok aan; die deelt 3 slokken uit.', '{B} kiest: zelf 2 slokken of iedereen 1.'];
  function proostInit(potje) {
    potje.staat = { kaart: 'Proost! Drink met mate, drink water tussendoor en zorg voor elkaar. Klaar? Pak de eerste kaart.', teller: 0, totaal: 25 };
  }
  function proostZet(potje, h, zet) {
    const st = potje.staat;
    if (String(zet.actie || '') !== 'kaart') return { status: 400, error: 'Onbekende actie.' };
    st.teller++;
    if (st.teller > st.totaal) {
      potje.status = 'klaar'; potje.winnaar = null; potje.gelijk = true;
      st.kaart = 'Dat was de laatste kaart. Proost, en kom veilig thuis.';
    } else {
      const spelers = potje.spelers.map(codenaamVan);
      const A = spelers[crypto.randomInt(0, spelers.length)];
      let B = spelers[crypto.randomInt(0, spelers.length)];
      if (spelers.length > 1) while (B === A) B = spelers[crypto.randomInt(0, spelers.length)];
      st.kaart = P_PROOST[crypto.randomInt(0, P_PROOST.length)].replace('{A}', A).replace('{B}', B);
      potje.beurt = (potje.beurt + 1) % potje.spelers.length;
    }
    save(); potje.spelers.forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, kaart: st.kaart };
  }

  /* ================= lobby: uitnodigen, accepteren, random wachtrij ================= */
  const INITS = { mejn: mejnInit, schaak: schaakInit, pesten: pestenInit, woord: woordInit,
    dam: damInit, rummi: rummiInit, magnaat: magnaatInit, seconden: secondenInit, waarheid: waarheidInit, proost: proostInit };
  function spelStart(potje) {
    potje.status = 'bezig'; potje.beurt = 0;
    INITS[potje.soort](potje);
  }
  // 30 Seconden speel je met twee teams van twee; Proost alleen met 18+
  function spelGrootte(soort, grootte) {
    const s = SPEL[soort];
    return Math.min(s.max, Math.max(s.min || 2, Number(grootte) || 2));
  }
  async function spelNieuw(mij, { soort, grootte, modus, vrienden, codenamen, taal, wereld }) {
    opschonen();
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };
    // een potje met uitnodigingen telt als EEN uitnodiging tegen het budget,
    // ook op het vriendenpad (anders is nudge-spam naar vrienden gratis)
    if (!sociaalRate(mij, 'spel-uitnodiging', 20, 3600000)) return { status: 429, error: 'Rustig aan met uitnodigen.' };
    const max = spelGrootte(soort, grootte);
    const uitgenodigd = (Array.isArray(vrienden) ? vrienden : []).slice(0, max - 1).filter(v => zijnVrienden(mij, v));
    /* Uitnodigen op codenaam: samen spelen maakt je NIET automatisch vrienden.
       De ander accepteert de uitnodiging zelf, blokkades gelden gewoon en
       beschermde kinderen zijn onvindbaar (die spelen alleen met vrienden). */
    for (const cn of (Array.isArray(codenamen) ? codenamen : []).slice(0, max - 1)) {
      const zoek = await socialZoek(mij, String(cn));
      const hit = (zoek || []).find(r => String(r.codename).toLowerCase() === String(cn).trim().toLowerCase());
      if (!hit) return { status: 404, error: 'De codenaam "' + String(cn).slice(0, 40) + '" is niet gevonden.' };
      if (isGeblokkeerd(mij, hit.key)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
      if (!uitgenodigd.includes(hit.key) && hit.key !== mij) uitgenodigd.push(hit.key);
    }
    if (!uitgenodigd.length) return { status: 400, error: 'Nodig minstens een speler uit (vriend of codenaam), of speel random.' };
    if (uitgenodigd.length > max - 1) return { status: 400, error: 'Te veel spelers voor dit spel.' };
    for (const v of uitgenodigd) { const vf = leeftijdFout(soort, v); if (vf) return { status: 403, error: vf }; }
    const potje = { id: rid(5), soort, grootte: max, modus: (soort === 'mejn' && modus === 'teams' && max === 4) || soort === 'seconden' ? 'teams' : 'vrij',
      taal: taal === 'en' ? 'en' : 'nl',
      teams: TEAMS, spelers: [mij], uitgenodigd, status: 'wacht', beurt: 0, winnaar: null, at: nu(), door: codenaamVan(mij) };
    S().potjes[potje.id] = potje;
    save();
    uitgenodigd.forEach(v => nudge(v, potje));
    return { status: 200, ok: true, id: potje.id };
  }
  function spelAntwoord(mij, id, akkoord) {
    const p = S().potjes[id];
    if (!p || p.status !== 'wacht' || !p.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    if (akkoord === true) {
      const lf = leeftijdFout(p.soort, mij);
      if (lf) return { status: 403, error: lf };
    }
    p.uitgenodigd = p.uitgenodigd.filter(x => x !== mij);
    // 30 Seconden start pas met vier (twee teams); haalt een potje zijn
    // minimum niet meer, dan verdwijnt het in plaats van kapot te starten
    const minimum = SPEL[p.soort].min || 2;
    if (akkoord === true) p.spelers.push(mij);
    if (p.spelers.length >= p.grootte || (!p.uitgenodigd.length && p.spelers.length >= minimum)) spelStart(p);
    else if (!p.uitgenodigd.length && p.spelers.length < minimum) delete S().potjes[id];
    save();
    p.spelers.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true, gestart: p.status === 'bezig', geannuleerd: !S().potjes[id] && p.status !== 'bezig' };
  }
  function spelRandom(mij, soort, grootte, taal, wereld) {
    opschonen();
    if (!SPEL[soort]) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    const lf = leeftijdFout(soort, mij);
    if (lf) return { status: 403, error: lf };
    const max = spelGrootte(soort, grootte);
    const w_taal = taal === 'en' ? 'en' : 'nl';
    const sleutel = soort + ':' + max + (soort === 'woord' ? ':' + w_taal : '');
    const w = S().wachtrij;
    w[sleutel] = (w[sleutel] || []).filter(x => x !== mij);
    w[sleutel].push(mij);
    if (w[sleutel].length >= max) {
      const spelers = w[sleutel].splice(0, max);
      const potje = { id: rid(5), soort, grootte: max, modus: soort === 'seconden' ? 'teams' : 'vrij', taal: w_taal, teams: TEAMS, spelers, uitgenodigd: [],
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
  /* De staat zoals EEN speler hem mag zien (handen en rekken van anderen
     blijven verborgen). Een expliciete map per soort: een nieuw spel zonder
     eigen weergave faalt luid in plaats van stil als Woordduel te renderen. */
  const VIEWS = {
    mejn: (p, st, mij) => ({ pionnen: p.spelers.map(sp => st.pionnen[sp].map(x => x.pos)), dobbel: st.dobbel, mag: st.mag, zetten: p.spelers[p.beurt] === mij && st.mag === 'zet' ? mejnZetten(p, mij) : [] }),
    schaak: (p, st) => ({ bord: st.bord.join(''), aanZet: st.aanZet, laatste: st.zetten[st.zetten.length - 1] || null }),
    woord: (p, st, mij) => ({ bord: st.bord, scores: p.spelers.map(sp => st.scores[sp]), rek: st.rekken[mij], zak: st.zak.length, passes: st.passes }),
    pesten: (p, st, mij) => ({ hand: st.handen[mij], aantallen: p.spelers.map(sp => st.handen[sp].length), open: st.open[st.open.length - 1], kleurKeuze: st.kleurKeuze, pak: st.pak, richting: st.richting, stapel: st.stapel.length }),
    dam: (p, st, mij) => ({ bord: st.bord.join(''), ketting: st.ketting, zetten: p.status === 'bezig' && p.spelers[p.beurt] === mij ? damZetten(p, mij) : [] }),
    rummi: (p, st, mij) => ({ rek: st.rekken[mij], tafel: st.tafel, aantallen: p.spelers.map(sp => st.rekken[sp].length), zak: st.zak.length, eerste: st.eerste[mij], passes: st.passes }),
    magnaat: (p, st) => ({ posities: p.spelers.map(sp => st.posities[sp]), geld: p.spelers.map(sp => st.geld[sp]), failliet: p.spelers.map(sp => !!st.failliet[sp]), cel: p.spelers.map(sp => st.cel[sp] > 0),
      eigenaar: Object.fromEntries(Object.entries(st.eigenaar).map(([v, h]) => [v, p.spelers.indexOf(h)])), // veld -> spelerindex
      huizen: st.huizen, mag: st.mag, koopVeld: st.koopVeld, dobbel: st.dobbel, kaart: st.kaart }),
    seconden: (p, st, mij) => {
      const rader = (p.beurt + 2) % p.spelers.length; // de teamgenoot raadt en mag de kaart niet zien
      return { scores: st.scores, kaart: st.kaart && p.spelers.indexOf(mij) !== rader ? st.kaart : null, tot: st.tot, rader, bezig: !!st.kaart };
    },
    waarheid: (p, st) => ({ punten: p.spelers.map(sp => st.punten[sp]), kaart: st.kaart, wat: st.wat, doel: 8 }),
    proost: (p, st) => ({ kaart: st.kaart, teller: st.teller, totaal: st.totaal })
  };
  function spelStaat(mij, id, metVelden) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const uit = { id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl', teams: p.teams.slice(0, p.spelers.length),
      spelers: p.spelers.map(codenaamVan), ik: p.spelers.indexOf(mij), beurt: p.beurt, winnaar: p.winnaar, gelijk: !!p.gelijk };
    if (p.status !== 'wacht' && p.staat && VIEWS[p.soort]) {
      uit.staat = VIEWS[p.soort](p, p.staat, mij);
      // het statische Magnaat-bord reist alleen mee als de client erom vraagt
      // (bij het openen), niet bij elke poll van 2,5 seconde
      if (p.soort === 'magnaat' && metVelden) uit.staat.velden = M_VELDEN;
    }
    return { status: 200, potje: uit };
  }
  const ZETTEN = { mejn: mejnZet, schaak: schaakZet, woord: woordZet, pesten: pestenZet, dam: damZet, rummi: rummiZet, magnaat: magnaatZet, seconden: secondenZet, waarheid: waarheidZet, proost: proostZet };
  function spelZet(mij, id, zet) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status !== 'bezig') return { status: 409, error: 'Dit potje loopt niet (meer).' };
    if (!ZETTEN[p.soort]) return { status: 400, error: 'Onbekend spel.' };
    // sommige acties mogen buiten je beurt (Magnaat: bouwen/terugverkopen);
    // dat staat in de speltabel, niet als losse uitzondering in de dispatch
    const beheer = zet && (SPEL[p.soort].buitenBeurt || []).includes(zet.actie);
    if (p.soort !== 'schaak' && !beheer && p.spelers[p.beurt] !== mij) return { status: 409, error: 'De ander is aan zet.' };
    if (p.soort === 'mejn' && zet && zet.actie === 'gooi') return mejnGooi(p, mij);
    return ZETTEN[p.soort](p, mij, zet || {});
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

  /* ================= arcade (Sneek en Tetris): ranglijsten onder vrienden ================= */
  const ARCADE = ['sneek', 'tetris', 'sudoku'];
  function A(spel) {
    const s = S();
    if (!s.arcade) {
      s.arcade = { sneek: s.sneek || {}, tetris: {} }; // neemt oude sneek-scores mee
      delete s.sneek; // een bron: anders lopen de oude en nieuwe sleutel uiteen
    }
    if (!s.arcade[spel]) s.arcade[spel] = {};
    return s.arcade[spel];
  }
  function arcadeScore(mij, spel, punten) {
    if (!ARCADE.includes(spel)) return { status: 400, error: 'Onbekend arcadespel.' };
    const n = Math.max(0, Math.min(999999, Math.floor(Number(punten) || 0)));
    const s = A(spel);
    if (!s[mij] || n > s[mij].punten) { s[mij] = { punten: n, at: nu() }; save(); }
    return { status: 200, ok: true, beste: s[mij].punten };
  }
  function arcadeBord(mij, spel, vrienden) {
    if (!ARCADE.includes(spel)) return { status: 400, error: 'Onbekend arcadespel.' };
    const s = A(spel);
    const rij = [mij, ...vrienden].filter(h => s[h]).map(h => ({ codenaam: codenaamVan(h), ik: h === mij, punten: s[h].punten }));
    return { bord: rij.sort((a, b) => b.punten - a.punten).slice(0, 20) };
  }
  const sneekScore = (mij, punten) => arcadeScore(mij, 'sneek', punten);
  const sneekBord = (mij, vrienden) => arcadeBord(mij, 'sneek', vrienden);

  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN };
};
