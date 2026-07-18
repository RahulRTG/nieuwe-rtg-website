/* Spelmotor "magnaat" (kern/spellen): Magnaat (monopoly-achtig): 40 velden in de RTG-wereld, kopen, huur, bouwen, kanskaarten en de cel.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

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

  return { magnaatInit, magnaatZet, M_VELDEN };
};
