/* De STAND van het bezitsbewijs (A-P1-04), los van de poort zodat die onder de
   grens van keuringsregel 13 blijft. Pure functie van de omgeving. */
'use strict';

const STANDEN = ['schaduw', 'aanbevolen', 'verplicht'];
function standNu() {
  /* A-P1-04: DE STANDAARD IS AFDWINGEN. Zware paden (geld, privacy-export en
     -verwijdering, wachtwoord, passkey, machtigingen) lopen niet meer mee in de
     schaduw: een gebonden sessie zonder geldig bewijs wordt geweigerd. Een
     typefout of onbekende waarde valt OP DE VEILIGE KANT terug (aanbevolen) en
     zegt dat. `schaduw` blijft alleen als bewuste keuze buiten productie; in
     productie telt hij niet. `verplicht` sluit ook het gat van ongebonden
     sessies en blijft een expliciete keuze. */
  const v = String(process.env.RTG_BEZITSBEWIJS || '').trim().toLowerCase();
  if (!v) return { stand: 'aanbevolen', reden: 'niet ingesteld; standaard afgedwongen' };
  if (!STANDEN.includes(v)) return { stand: 'aanbevolen', reden: 'onbekende waarde "' + v + '"; teruggevallen op aanbevolen (afgedwongen)' };
  if (v === 'schaduw' && process.env.NODE_ENV === 'production')
    return { stand: 'aanbevolen', reden: 'schaduw is in productie niet toegestaan voor zware paden; afgedwongen' };
  return { stand: v, reden: 'ingesteld' };
}

module.exports = { STANDEN, standNu };
