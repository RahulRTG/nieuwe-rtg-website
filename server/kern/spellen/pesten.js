/* Spelmotor "pesten" (kern/spellen): Pesten: het kaartspel, met pakstapels, richting en kleurkeuze; de server bewaakt de regels.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

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

  return { pestenInit, pestenZet };
};
