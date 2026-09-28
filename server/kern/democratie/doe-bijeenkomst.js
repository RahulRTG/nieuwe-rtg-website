/* ============================================================================
   DE BIJEENKOMST VAN EEN ACTIE (./doe.js, POLITIEK.md par. 6).

   Dezelfde regels als server/kern/genootschap/bijeenkomst.js, zonder dat een
   actie een genootschap hoeft te zijn: genootschap is een functie van de
   betaalde passen, en in DemocratieOS geeft een pas nooit meer gewicht.

   - Een bijeenkomst plant alleen wie de actie begon. Opnieuw plannen zet de
     antwoorden terug: wie ja zei tegen dinsdag, zei niet ja tegen donderdag.
   - Is het vol, dan is het vol. Geen wachtlijst die iedereen hoop geeft.
   - Misschien is een eigen antwoord en blijft dat tot het lid het verandert.
   - Er gaat geen melding uit. Wie meedoet, ziet de bijeenkomst in de lijst. */
'use strict';

module.exports = ({ op, schoon, DATUM, TIJD, ANTWOORDEN, tel, doetMee, nu }) => {
  const plan = (sleutel, id, b) => op(sleutel, id, 'starter', {
    toets: () => {
      if (!DATUM.test(String(b.datum || ''))) return { status: 400, error: 'Geef een datum als 2026-10-14.' };
      if (b.tijd && !TIJD.test(String(b.tijd))) return { status: 400, error: 'Geef een tijd als 19:30.' };
      if (schoon(b.waar, 120).length < 3) return { status: 400, error: 'Zeg waar u samenkomt.' };
      return null;
    },
    doe: (x) => {
      const plaatsen = Number(b.plaatsen);
      x.bijeenkomst = { datum: String(b.datum), tijd: b.tijd ? String(b.tijd) : null, waar: schoon(b.waar, 120),
        plaatsen: Number.isInteger(plaatsen) && plaatsen > 0 && plaatsen <= 500 ? plaatsen : null,
        antwoorden: {}, afgelast: null, at: nu() };
    } });

  const afgelast = (sleutel, id, b) => op(sleutel, id, 'starter', {
    toets: (x) => (!x.bijeenkomst ? { status: 409, error: 'Er is geen bijeenkomst om af te gelasten.' } : null),
    doe: (x) => { x.bijeenkomst.afgelast = { reden: schoon(b.reden, 200), at: nu() }; } });

  const antwoord = (sleutel, id, b) => op(sleutel, id, 'deelnemer', {
    toets: (x, refs) => {
      const bk = x.bijeenkomst;
      if (!bk || bk.afgelast) return { status: 409, error: 'Er is geen bijeenkomst om op te antwoorden.' };
      if (!ANTWOORDEN.includes(b.wat)) return { status: 400, error: 'Antwoord met ja, misschien of nee.' };
      const ref = doetMee(x, refs);
      if (b.wat === 'ja' && bk.plaatsen && bk.antwoorden[ref] !== 'ja' && tel(bk, 'ja') >= bk.plaatsen) {
        return { status: 409, error: 'Het is vol. Zegt iemand af, dan komt er een plaats vrij.' };
      }
      return null;
    },
    doe: (x, refs) => { x.bijeenkomst.antwoorden[doetMee(x, refs)] = b.wat; } });

  return { plan, afgelast, antwoord };
};
