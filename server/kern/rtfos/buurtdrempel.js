/* Foundation OS, deel "gemeente": de buurtdrempel van het gemeentenportaal.
   Los van ./gemeente.js omdat dit de privacyregel zelf is en dat bestand de
   10 kB-grens raakte; gemeente.js gebruikt hem en geeft hem ongewijzigd door
   (scripts/overgangsvorm.js proef `buurtenQueryveilig` toetst hem daar). */
'use strict';

module.exports = (K) => {
  /* Buurten samenvoegen onder de drempel. Het aantal samengevoegde buurten
     staat er WEL bij: "overige buurten: 7" is informatie, stilzwijgend weglaten
     zou de gemeente een onvolledig beeld geven zonder dat ze het weet.

     CELVEILIG IS NIET QUERYVEILIG (VERDER.md par. 6, besluit B1). Het portaal
     toont ook het TOTAAL, dus de som van wat er niet genoemd wordt is altijd
     uit te rekenen. De vraag is dus niet "staat er een klein getal" maar "is
     het aantal van een verborgen buurt AF TE LEIDEN". Drie vormen die alle drie
     gedraaid zijn (golf 3, tegenlezing):
       - een groep van een buurt: haar aantal is de groep;
       - een uiterste som: twee buurten met samen 2 zijn er allebei 1;
       - grenzen: een buurt die meegaat om een kleine buurt te dekken ligt
         tussen K en het kleinste genoemde aantal, dus {1, 5, 12} geeft een groep
         van 6 en daarmee 1 en 5.
     Daarom rekent deze functie per verborgen buurt het bereik uit dat een
     gemeente met maximale kennis (zij weet welke buurten klein zijn en welke
     zijn meegenomen) nog openhoudt, en voegt zij de volgende kleinste buurt
     toe zolang er een buurt is met maar EEN mogelijke waarde. Lukt dat niet
     meer, dan staat er geen aantal (null) met de reden. Labels worden op hun
     schrijfwijze samengevoegd (hoofdletters, spaties): "Zeewijk" en "zeewijk"
     zijn een buurt en mogen niet als twee buurten een groep vormen. Een
     tikfout ("Zeewyk") vangt dat niet; daarvoor is een vaste buurtenlijst per
     stad nodig, en dat is een besluit (VERDER.md par. 6). */
  const sleutel = w => String(w).trim().toLowerCase().replace(/\s+/g, ' ');
  /* Het bereik van lid i bij som S: wat de anderen samen minimaal en maximaal
     kunnen dragen, bepaalt wat er voor i overblijft. */
  function afleidbaar(leden, S) {
    const lo = leden.reduce((a, l) => a + l.lo, 0), hi = leden.reduce((a, l) => a + l.hi, 0);
    return leden.some(l => Math.min(l.hi, S - (lo - l.lo)) - Math.max(l.lo, S - (hi - l.hi)) < 1);
  }
  function buurten(perWijk) {
    const per = new Map();
    for (const [wijk, n] of Object.entries(perWijk || {})) {
      const k = sleutel(wijk);
      if (!k) continue;
      const r = per.get(k) || { wijk: String(wijk).trim(), aantal: 0 };
      r.aantal += Number(n) || 0;
      per.set(k, r);
    }
    const groot = [], klein = [];
    for (const r of per.values()) (r.aantal >= K ? groot : klein).push(r);
    groot.sort((a, b) => b.aantal - a.aantal || (a.wijk < b.wijk ? -1 : 1));
    if (!klein.length) return groot;
    const groep = klein.map(r => ({ aantal: r.aantal, lo: 1, hi: K - 1 }));
    let meegenomen = 0;
    const veilig = () => {
      if (groep.length < 2) return false;
      const U = groot.length ? groot[groot.length - 1].aantal : Infinity;
      for (const l of groep) if (l.mee) l.hi = U;
      return !afleidbaar(groep, groep.reduce((a, l) => a + l.aantal, 0));
    };
    while (!veilig() && groot.length) { groep.push({ aantal: groot.pop().aantal, lo: K, hi: Infinity, mee: true }); meegenomen++; }
    const ok = veilig();
    const uit = groot.slice();
    uit.push({ wijk: 'overige buurten (' + groep.length + ')', buurten: groep.length,
      aantal: ok ? groep.reduce((a, l) => a + l.aantal, 0) : null, samengevoegd: true,
      ...(meegenomen ? { complementair: meegenomen + ' buurt(en) boven de drempel meegenomen, anders was het aantal van een buurt af te leiden' } : {}),
      ...(ok ? {} : { onderdrukt: 'ook na samenvoegen zou het aantal van een buurt af te leiden zijn; daarom staat hier geen getal' }) });
    return uit;
  }

  return buurten;
};
