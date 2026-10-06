/* De STAND van het bezitsbewijs (A-P1-04), los van de poort zodat die onder de
   grens van keuringsregel 13 blijft. Pure functie van de omgeving. */
'use strict';

const STANDEN = ['schaduw', 'aanbevolen', 'verplicht'];
function standNu() {
  /* A-P1-04: DE STANDAARD IS VERPLICHT. Zware paden (geld, privacy-export en
     -verwijdering, wachtwoord, passkey, machtigingen) eisen een toestel dat zijn
     sleutel kan aantonen: een gebonden sessie zonder geldig bewijs wordt
     geweigerd, en een sessie ZONDER binding ook -- met de weg erheen ("bevestig
     dit toestel") in de weigering. Een typefout of onbekende waarde valt OP DE
     VEILIGE KANT terug (verplicht) en zegt dat. `aanbevolen` (ongebonden mag
     door, gebonden niet) en `schaduw` zijn bewuste keuzes; schaduw telt in
     productie niet. */
  const v = String(process.env.RTG_BEZITSBEWIJS || '').trim().toLowerCase();
  if (!v) return { stand: 'verplicht', reden: 'niet ingesteld; standaard verplicht' };
  if (!STANDEN.includes(v)) return { stand: 'verplicht', reden: 'onbekende waarde "' + v + '"; teruggevallen op verplicht' };
  if (v === 'schaduw' && process.env.NODE_ENV === 'production')
    return { stand: 'verplicht', reden: 'schaduw is in productie niet toegestaan voor zware paden; verplicht' };
  return { stand: v, reden: 'ingesteld' };
}

module.exports = { STANDEN, standNu };
