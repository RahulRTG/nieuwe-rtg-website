/* Spelmotor "seconden" (kern/spellen): 30 Seconden: 2 tegen 2 op het eer-systeem; de teamgenoot raadt en ziet de kaart niet.
   Verbatim afgesplitst uit kern/spellen.js; de lobby (aldaar) doet matchmaking,
   beurten en views en roept deze motor via de gedeelde context aan. */
module.exports = (ctx) => {
  const { save, crypto, schud, beurtDoor, codenaamVan, nudge } = ctx;

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

  const spel = {
    /* GEEN `kijken`, en dat is het enige spel waar dat zo is. De weergave
       verbergt de kaart voor de RADER door op zijn spelersindex te kijken --
       en een kijker heeft geen index, dus die zou de kaart juist wel zien en
       hem kunnen doorgeven. Nagemeten, niet aangenomen: zie
       test/spelkijken.test.js. Meekijken kan hier pas als er een eigen
       kijkweergave is die de kaart weglaat.

       teams:'altijd' -- 30 Seconden BESTAAT alleen als twee teams van twee,
       vandaar ook min 4. De lobby leest dat hier en kent de spelnaam niet. */
    sleutel: 'seconden', naam: '30 Seconden', max: 4, min: 4, wereld: 'rtg', teams: 'altijd',
    init: secondenInit, zet: secondenZet,
    view: (p, st, mij) => {
      const rader = (p.beurt + 2) % p.spelers.length; // de teamgenoot raadt en mag de kaart niet zien
      return { scores: st.scores, kaart: st.kaart && p.spelers.indexOf(mij) !== rader ? st.kaart : null, tot: st.tot, rader, bezig: !!st.kaart };
    }
  };
  return { spel, secondenInit, secondenZet };
};
