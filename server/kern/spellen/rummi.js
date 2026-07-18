/* Spelmotor "rummi" (kern/spellen): Rummi (rummikub-achtig): 106 stenen, eerste uitleg 30 punten, de server keurt de hele tafel.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

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

  return { rummiInit, rummiZet, rummiSet };
};
