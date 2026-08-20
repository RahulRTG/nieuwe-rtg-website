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
const fs = require('fs');
const path = require('path');
const { segmentPatroon } = require('../lib/padvorm');

const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

module.exports = ({ pad, ttlMs, log } = {}) => {
  const bron = pad || path.join(__dirname, '..', '..', 'VERTROUWEN.json');
  const ttl = ttlMs === undefined ? 30000 : ttlMs;
  let cache = null;
  let gelezenOp = 0;
  const gemeld = new Set();

  function laad() {
    const nu = Date.now();
    if (cache && nu - gelezenOp < ttl) return cache;
    gelezenOp = nu;
    const vers = { letterlijk: new Map(), vormen: [] };
    try {
      const reg = JSON.parse(fs.readFileSync(bron, 'utf8'));
      for (const [sleutel, u] of Object.entries(reg.perRoute || {})) {
        if (!u || u.staat !== 'geschorst') continue;
        const spatie = sleutel.indexOf(' ');
        const methode = sleutel.slice(0, spatie);
        const p = sleutel.slice(spatie + 1);
        const rx = segmentPatroon(p);
        if (rx) vers.vormen.push({ methode, rx, reden: u.reden || 'bewijs gezakt' });
        else vers.letterlijk.set(sleutel, u.reden || 'bewijs gezakt');
      }
    } catch (e) { /* geen register = geen signaal; zie de grenzen in de kop */ }
    cache = vers;
    return cache;
  }

  return function schorspoort(req, res, next) {
    if (process.env.RTG_SCHORSPOORT_UIT === '1') return next();
    if (!SCHRIJFT.has(req.method) || !req.path.startsWith('/api/')) return next();
    const k = laad();
    const sleutel = req.method + ' ' + req.path;
    let reden = k.letterlijk.get(sleutel);
    if (reden === undefined) {
      const v = k.vormen.find(x => x.methode === req.method && x.rx.test(req.path));
      if (v) reden = v.reden;
    }
    if (reden === undefined) return next();
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
