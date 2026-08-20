/* DE SCHORSPOORT -- een route waarvan het bewijs zegt "geschorst" trekt
   zichzelf terug. PROOF.md fase 3, en de eerste plek waar de vertrouwenslaag
   niet meer alleen KIJKT maar ook DOET.

   WAT HIJ DOET. VERTROUWEN.json (scripts/vertrouwen.js) kent elke route een
   vervalstaat toe; `geschorst` betekent: een bewijscel is GEZAKT -- het bewijs
   zegt zelf dat het niet klopt. Zolang dat zo is weigert deze poort de
   SCHRIJVENDE aanroepen op precies die routes met een 503, de kop
   X-Vervalstaat: geschorst, en de reden uit het register. Lezen blijft open:
   degraderen gaat naar de veiligste toestand die nog bewezen is, nooit naar
   alles-uit (PROOF.md par. 9.4).

   WAT HIJ NADRUKKELIJK NIET DOET:
   - hij opent NOOIT iets. De enige weg omhoog is een geslaagde hermeting die
     het register verandert (par. 9.9: niemand zet een staat met de hand op
     bewezen -- deze poort kan het dus ook niet).
   - hij oordeelt niet zelf. Hij leest een register dat de proeven schreven;
     de regel over wat geschorst betekent woont in scripts/vertrouwen.js.
   - hij is niet stil. Elke route die hij dichthoudt wordt bij de eerste keer
     in het serverlog gemeld, en elke geweigerde aanroep draagt de reden.

   DE GRENZEN, eerlijk benoemd:
   - geen register = geen signaal. De poort is een extra verdediging bovenop
     de gewone poorten, geen bestaansvoorwaarde; een huis zonder
     VERTROUWEN.json draait gewoon (en de keuring bewaakt dat het register er
     in deze repo wel IS).
   - het register wordt elke ttlMs opnieuw gelezen (standaard 30 s); een
     schorsing werkt dus binnen een halve minuut door, niet binnen een
     milliseconde.
   - RTG_SCHORSPOORT_UIT=1 is de menselijke noodrem, voor het geval de poort
     zelf het probleem is. Gebruik ervan is per definitie luid: hij staat in
     de omgeving, niet in de code. */
'use strict';
const { staatVan } = require('../lib/vervalstaat');

const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

module.exports = ({ pad, ttlMs, log } = {}) => {
  const gemeld = new Set();

  return function schorspoort(req, res, next) {
    if (process.env.RTG_SCHORSPOORT_UIT === '1') return next();
    if (!SCHRIJFT.has(req.method) || !req.path.startsWith('/api/')) return next();
    /* De vervalstaat komt uit de GEDEELDE lezer (server/lib/vervalstaat.js),
       dezelfde die de bewijspoort van het AI-stuur gebruikt: een waarheid,
       twee poorten. */
    const s = staatVan(req.method, req.path, { pad, ttlMs });
    if (!s || s.staat !== 'geschorst') return next();
    const sleutel = req.method + ' ' + req.path;
    const reden = s.reden || 'bewijs gezakt';
    if (log && !gemeld.has(sleutel)) {
      gemeld.add(sleutel);
      log.warn('[schorspoort] ' + sleutel + ' staat dicht: ' + reden);
    }
    res.set('X-Vervalstaat', 'geschorst');
    return res.status(503).json({
      error: 'Deze handeling is tijdelijk geschorst: het bewijs erachter is gezakt. ' +
        'Alleen een geslaagde hermeting heropent hem; lezen blijft gewoon werken.',
      vervalstaat: 'geschorst',
      reden
    });
  };
};
