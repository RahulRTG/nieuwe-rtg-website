/* Spelmotor "woord" (kern/spellen): Woordduel (wordfeud-achtig): 15x15 met premievelden, letterzak, kruiswoord-scoring en 40-puntenbonus.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;
  const fs = require('fs'), zlib = require('zlib'), path = require('path');

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
  /* De woordenlijsten (NL + EN samen ruwweg 700.000 woorden) kosten tientallen
     MB's aan geheugen. Ze laden lui bij het eerste woord-potje en worden weer
     VRIJGEGEVEN als er een half uur geen woord gekeurd is: een server zonder
     actieve Woordduel-potjes draagt ze dan niet mee. */
  const WOORDENBOEK = {};
  let woordenboekGebruikt = 0, woordenboekOpruimer = null;
  function woordenboek(taal) {
    woordenboekGebruikt = Date.now();
    if (!woordenboekOpruimer) {
      woordenboekOpruimer = setInterval(() => {
        if (Date.now() - woordenboekGebruikt > 30 * 60000) {
          for (const t of Object.keys(WOORDENBOEK)) delete WOORDENBOEK[t];
          clearInterval(woordenboekOpruimer); woordenboekOpruimer = null;
        }
      }, 5 * 60000);
      if (woordenboekOpruimer.unref) woordenboekOpruimer.unref();
    }
    if (taal in WOORDENBOEK) return WOORDENBOEK[taal];
    try {
      const raw = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', '..', 'woorden', taal + '.txt.gz')));
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

  return { woordInit, woordZet, W_PREMIE };
};
