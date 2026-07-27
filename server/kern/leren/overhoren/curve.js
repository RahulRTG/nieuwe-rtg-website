/* Leren-overhoren, deel "curve": de eerlijke vergeetcurve (Leitner-bakjes).
   Elke vraag van elke lijst zit in een bakje 1 t/m 5. Goed beantwoord = een
   bakje omhoog en langer rust; fout = terug naar bakje 1 en vandaag nog een
   keer. De dagstapel verzamelt alles wat vandaag aan de beurt is, over alle
   lijsten heen.

   Eerlijk gebruikt: geen streaks, geen druk, geen "vuurtjes". De teller zegt
   alleen wat er vandaag klaarstaat, en een vraag is nooit "voor altijd
   klaar" -- bakje 5 komt elke twee weken gewoon terug, want zo werkt een
   geheugen. De bakjes groeien lui mee met de lijst (nieuwe paren beginnen
   in bakje 1, vandaag). */
module.exports = (ctx) => {
  const { save, L, schud } = ctx;
  // rustdagen per bakje (index = bakje): 1 dagelijks .. 5 elke twee weken
  const WACHT = [0, 1, 2, 4, 7, 14];
  const dagStr = ms => {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const vandaag = () => dagStr(Date.now());
  const plus = n => dagStr(Date.now() + n * 86400000);

  // de bakjes van een lijst, lui aangemaakt en meegroeiend met de paren
  function bakken(l) {
    if (!Array.isArray(l.curve)) l.curve = [];
    while (l.curve.length < l.paren.length) l.curve.push({ bak: 1, weer: vandaag() });
    if (l.curve.length > l.paren.length) l.curve.length = l.paren.length;
    return l.curve;
  }

  /* de dagstapel: alles wat vandaag (of eerder) aan de beurt is, door elkaar
     geschud zodat je niet lijst-voor-lijst dezelfde volgorde voorspelt */
  function herhaalVandaag(mij) {
    const nu = vandaag();
    const stapel = [];
    for (const l of Object.values(L().lijsten)) {
      if (l.van !== mij) continue;
      bakken(l).forEach((c, i) => {
        if (c.weer <= nu) stapel.push({ lijstId: l.id, lijst: l.naam, idx: i,
          v: l.paren[i].v, a: l.paren[i].a, bak: c.bak });
      });
    }
    schud(stapel);
    return { status: 200, vandaag: nu, aantal: stapel.length, stapel: stapel.slice(0, 100) };
  }

  function herhaalAntwoord(mij, { lijstId, idx, goed }) {
    const l = L().lijsten[String(lijstId || '')];
    if (!l || l.van !== mij) return { status: 404, error: 'Deze lijst is er niet (meer).' };
    const c = bakken(l)[Math.floor(Number(idx))];
    if (!c) return { status: 404, error: 'Die vraag hoort niet bij deze lijst.' };
    if (goed === true) { c.bak = Math.min(5, c.bak + 1); c.weer = plus(WACHT[c.bak]); }
    else { c.bak = 1; c.weer = vandaag(); } // fout: vandaag nog een keer, zonder straf
    save();
    return { status: 200, ok: true, bak: c.bak, weer: c.weer };
  }

  // het overzicht: per lijst de bakverdeling en wat er vandaag klaarstaat
  function herhaalStand(mij) {
    const nu = vandaag();
    let totaal = 0;
    const lijsten = [];
    for (const l of Object.values(L().lijsten)) {
      if (l.van !== mij) continue;
      const b = [0, 0, 0, 0, 0, 0];
      let klaar = 0;
      for (const c of bakken(l)) { b[c.bak]++; if (c.weer <= nu) klaar++; }
      totaal += klaar;
      lijsten.push({ id: l.id, naam: l.naam, bakken: b.slice(1), vandaag: klaar });
    }
    return { status: 200, vandaag: totaal, lijsten };
  }

  return { herhaalVandaag, herhaalAntwoord, herhaalStand };
};
