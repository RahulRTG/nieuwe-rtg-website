/* RTG PIN: de altijd beschikbare rem vóór het opzoeken.

   De lidrem alleen is niet genoeg: een aanvaller kan accounts rouleren. Een
   contact-PIN heeft bovendien geen vooraf bekend doel, dus hangt de tweede rem
   aan de deur zelf: een huisbreed budget van missers per minuut. Alleen
   missers tellen; echt gebruik kent de zojuist uitgewisselde code vrijwel
   altijd. Een derde rem volgt het netwerkspoor, gehasht in geheugen.

   Deze directe laag werkt ook zonder infrastructuur. De HTTP-rand voegt met
   Redis dezelfde grenzen atomisch over alle instances toe. */
'use strict';
const klok = require('../../lib/klok');

module.exports = ({ crypto }) => {
  const UUR = 60 * 60 * 1000;
  const MIS_VENSTER = 60 * 1000;
  const MIS_PER_MINUUT = 120;
  const BRON_PER_UUR = 120;
  const misBudget = { vanaf: 0, n: 0 };
  const bronBudget = new Map();

  function misser() {
    const nu = klok.nu();
    if (nu - misBudget.vanaf > MIS_VENSTER) { misBudget.vanaf = nu; misBudget.n = 0; }
    misBudget.n++;
  }
  const dicht = () => (klok.nu() - misBudget.vanaf <= MIS_VENSTER) && misBudget.n >= MIS_PER_MINUUT;
  function bronMag(bron) {
    if (!bron) return true; // kerntoetsen en interne aanroepen hebben geen HTTP-bron
    const sleutel = crypto.createHash('sha256').update(String(bron)).digest('hex').slice(0, 24);
    const nu = klok.nu();
    let b = bronBudget.get(sleutel);
    if (!b || b.reset < nu) { b = { n: 0, reset: nu + UUR }; bronBudget.set(sleutel, b); }
    b.n++;
    if (bronBudget.size > 5000)
      for (const [k, v] of bronBudget) if (v.reset < nu) bronBudget.delete(k);
    return b.n <= BRON_PER_UUR;
  }
  function reset() { misBudget.vanaf = 0; misBudget.n = 0; bronBudget.clear(); }

  return { UUR, MIS_PER_MINUUT, misser, dicht, bronMag, reset };
};
