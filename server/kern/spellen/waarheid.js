/* Spelmotor "waarheid" (kern/spellen): Doen of Waarheid: 2-6 spelers, kaarten en punten tot 8.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

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

  return { waarheidInit, waarheidZet };
};
