/* Spellen (deelmodule): telemetrie -- geaggregeerd, zonder personen.

   WAT DIT WEL IS: hoeveel potjes er per dag per spel zijn afgelopen, en hoeveel
   stoelen daaraan zaten. Daarmee is te zien of een spel gespeeld wordt, of een
   nieuw spel aanslaat, en of er iets stukging (een spel dat op nul valt).

   WAT DIT NIET IS, en dat is de hele vorm van dit bestand: er staat GEEN
   persoon in. Geen sleutel, geen codenaam, geen winnaar, geen leeftijd. Een rij
   is `{ dag, spel, potjes, spelers }` en verder niets. Dat is geen belofte in
   een kop maar een eigenschap van wat er wordt weggeschreven: er is niets te
   herleiden, want er is niets om te herleiden.

   WAAROM DIT NAAST DE UITSLAGEN STAAT en niet eruit wordt afgeleid. De
   uitslagenlog draagt personen en valt daarom onder de progressiegrens: een
   partij waarin niemand boven de 18+-grens meespeelde wordt daar helemaal niet
   bewaard. Een teller die daaruit zou lezen, telt De Arena dus stelselmatig
   niet mee -- en zou juist bij de groep die het meest speelt het minst zien.
   Omdat hier geen persoon in staat, mag deze teller alles tellen. De
   privacyregel maakt de cijfers hier dus BETER en niet slechter.

   EEN PLEK WAAR HET GEBEURT. De teller hangt aan `noteerUitslag` (uitslagen.js)
   en niet aan de twee plekken waar een potje kan eindigen. Dat is dezelfde
   afweging als bij de toernooiladder: twee aanroepplekken is twee kansen om er
   een te vergeten, en de idempotentie (`potje.uitslagGenoteerd`) is daarmee
   meteen ook die van de teller -- een potje kan niet dubbel geteld worden.

   BEWAREN: `spelTelling` staat in bewaarbeleid.js als gewone lijst met een
   datum per rij, dus hij verloopt vanzelf. Een dagcijfer van drie jaar terug
   zegt niets meer over een spel dat sindsdien is veranderd. */
module.exports = (ctx) => {
  const { db, save, nu, SOORTEN } = ctx;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/spellen/telling', bezit: { spelTelling: 'lijst' } });

  const MAX_DAGEN = 400;   // wat een vraag hoogstens terug mag kijken

  function T() {
    return eigen.bak('spelTelling');
  }

  /* Een afgelopen potje bijtellen. Alleen het SOORT en het AANTAL stoelen gaan
     mee; wie er zat wordt niet gelezen, ook niet om te tellen hoeveel er
     "volwassen" waren -- dat zou een eigenschap van personen in een tabel
     zetten die er juist geen heeft. */
  function telPotje(potje) {
    if (!potje || !potje.soort) return;
    const dag = nu().slice(0, 10);
    const lijst = T();
    let r = lijst.find(x => x.dag === dag && x.spel === potje.soort);
    if (!r) {
      // `at` op middernacht van die dag: daarmee verloopt de rij via het
      // gewone bewaarbeleid, zonder dat de motor een nieuwe vorm hoeft te leren
      r = { dag, at: dag + 'T00:00:00.000Z', spel: potje.soort, potjes: 0, spelers: 0 };
      lijst.push(r);
    }
    r.potjes++;
    r.spelers += Array.isArray(potje.spelers) ? potje.spelers.length : 0;
    save();
  }

  /* De cijfers, opgeteld over een venster. Geeft per spel een totaal en per dag
     een regel, zodat een grafiek mogelijk is zonder dat er ooit een rij per
     persoon hoeft te bestaan. */
  function spelTelemetrie(dagen) {
    const n = Math.max(1, Math.min(MAX_DAGEN, Number(dagen) || 30));
    const grens = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const rijen = T().filter(r => r.dag >= grens);

    const perSpel = new Map();
    const perDag = new Map();
    for (const r of rijen) {
      const s = perSpel.get(r.spel) || { spel: r.spel, naam: (SOORTEN && SOORTEN[r.spel]) || r.spel, potjes: 0, spelers: 0 };
      s.potjes += r.potjes; s.spelers += r.spelers;
      perSpel.set(r.spel, s);
      const d = perDag.get(r.dag) || { dag: r.dag, potjes: 0 };
      d.potjes += r.potjes;
      perDag.set(r.dag, d);
    }
    const spellen = [...perSpel.values()].sort((a, b) => b.potjes - a.potjes);
    return {
      status: 200, dagen: n, vanaf: grens,
      totaal: {
        potjes: spellen.reduce((t, s) => t + s.potjes, 0),
        spelers: spellen.reduce((t, s) => t + s.spelers, 0),
        spellen: spellen.length
      },
      perSpel: spellen,
      perDag: [...perDag.values()].sort((a, b) => a.dag.localeCompare(b.dag))
    };
  }

  return { telPotje, spelTelemetrie };
};
