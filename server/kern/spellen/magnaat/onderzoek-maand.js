/* Magnaat: DE ONDERZOEKSMAAND -- budget eruit, voortgang erbij, en de uitkomst.

   Afgesplitst van ./onderzoek-acties.js: dat bestand gaat over de vier dingen
   die een speler DOET, en dit over de ene maand die daar tussendoor loopt. De
   naad ligt op dezelfde plek als bij de bank en de verzekering, en het bestand
   ging over de 10 kB-grens toen de uitkomsten erbij kwamen.

   HIER VALT DE UITKOMST, en dat is de enige plek. Volledig, gedeeltelijk of
   anders -- getrokken uit dezelfde hash als de rest, dus tien maanden in een
   keer geeft dezelfde uitkomst als tien maanden los (GAMEHALL.md 12.4).

   EN ER GEBEURT VERDER NIETS BIJ HET AFRONDEN. Geen geld, geen waarde, geen
   bonus: een afgerond onderzoek verandert alleen wat er UITGEROLD kan worden.
   Dat is de wet uit ./onderzoek.js -- onderzoek maakt nooit kas, het verandert
   productievoorwaarden -- en dit is het bestand waar die wet gehandhaafd wordt.
   Wie hier een bijschrijving toevoegt, breekt scripts/magnaat-pomp.js. */
const O = require('./onderzoek');

const rond = (n) => Math.round(n);

module.exports = ({ lopend, teruggave }) => {
  /* ---------- de maand ----------
     Elk lopend onderzoek verbruikt zijn budget en boekt voortgang. De subsidie
     betaalt mee zolang hij strekt; wat er niet uit de subsidie komt, komt uit de
     kas. */
  return function maandVoorSpeler(potje, h) {
    const st = potje.staat;
    const regels = [];
    let uitEigenZak = 0, uitPot = 0;
    for (const o of lopend(st, h)) {
      const k = O.BOOM[o.sleutel];
      const uitSubsidie = Math.min(o.subsidieRest || 0, o.budget);
      const zelf = o.budget - uitSubsidie;
      st.geld[h] -= zelf;
      if (uitSubsidie > 0) o.subsidieRest -= uitSubsidie;
      o.besteed += o.budget;
      o.subsidie += uitSubsidie;
      uitEigenZak += zelf;
      uitPot += uitSubsidie;
      o.voortgang += O.voortgang(potje.id, st.maand, o.sleutel, o.budget);
      const klaarNu = o.voortgang >= 1;
      if (klaarNu) {
        /* HIER VALT DE UITKOMST, en dit is de enige plek. Volledig, gedeeltelijk
           of anders -- getrokken uit dezelfde hash als de rest, dus tien maanden
           in een keer geeft dezelfde uitkomst als tien maanden los.

           EN ER GEBEURT VERDER NIETS. Geen geld, geen waarde, geen bonus: het
           afronden van een onderzoek verandert alleen wat er UITGEROLD kan
           worden. Zie de wet in ./onderzoek.js -- onderzoek maakt nooit kas. */
        o.status = 'klaar'; o.voortgang = 1; o.tot = st.maand;
        o.uitkomst = O.uitkomst(potje.id, o.sleutel);
        o.effect = O.effectVan(potje.id, o.sleutel, o.uitkomst);
        if (o.uitkomst === 'anders') o.anderVeld = O.anderVeld(potje.id, o.sleutel);
        teruggave(st, o);
      }
      regels.push({ id: o.id, naam: k.naam, soort: 'onderzoek',
        budget: rond(o.budget), subsidie: rond(uitSubsidie),
        voortgang: Math.round(o.voortgang * 100), klaar: klaarNu || undefined,
        uitkomst: klaarNu ? o.uitkomst : undefined, anderVeld: klaarNu ? o.anderVeld : undefined,
        resultaat: -rond(zelf) });
    }
    return { regels, uitEigenZak, uitPot };
  };
};
