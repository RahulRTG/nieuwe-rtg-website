/* ============================================================================
   PREMIUMDEKKING -- het blokformaat en de lezer (stap a, 19 oktober 2026).

   Wat dit is, en wat nog niet. De eigenaar beslist nog of premiumdekking er
   komt (het voorstel ligt bij hem). Dit bestand is de INFRASTRUCTUUR: het leest
   eindcontracten en rekent per criterium uit of het bewezen is. Het zegt niets
   toe, staat nog in geen register, en geen enkele rij van APPWERKT leest het.

   HET BLOK. Een wereldagent schrijft in docs/domeinkaarten/<wereld>.md per app
   een fenced block met de taal `premiumdekking` en JSON erin:

     ```premiumdekking
     { "app": "link:pay",
       "criteria": [
         { "id": "PAY-L1", "dimensie": "levenscyclus",
           "zin": "een lid laadt op en ziet het nieuwe saldo",
           "bewezenDoor": { "register": "VOLTOOIPROEF.json",
                            "pad": ["apps", "link:pay", "voltooibaar"],
                            "stap": { "soort": "schakel", "nr": 3 } } } ] }
     ```

   DE ACHT DIMENSIES liggen vast (DIMENSIES hieronder); een andere naam is een
   fout, geen negende dimensie.

   WANNEER EEN CRITERIUM TELT. Het staat in een blok (toegezegd), en zijn
   `bewezenDoor` wijst naar een STAP die bestaat (een schakel of storing, op
   nummer) in een register met een stempel dat vers is, en die stap staat op
   gesloten (schakel) of gehouden (storing). Anders staat hij in de noemer en
   niet in de teller, met de reden. Wat niet is toegezegd, telt nergens.

   WAT HET NOOIT DOET. De acht bewijzen blijven de enige standen; dekking is een
   getal per dimensie ernaast, geen graad (BEWIJSLUS par. 11, CIVILIS par. 3).
   beyondPremium() is de enige afgeleide uitspraak, en die is altijd onwaar
   zolang een van de acht bewijzen niet BEWEZEN is.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');
const MAP = 'docs/domeinkaarten';
const DIMENSIES = ['breedte', 'diepte', 'levenscyclus', 'samenwerking', 'domeinintelligentie', 'los', 'ketens', 'betrouwbaarheid'];

const leesStandaard = (rel) => { try { return fs.readFileSync(path.join(WORTEL, rel), 'utf8'); } catch (e) { return null; } };
const lijstStandaard = () => { try { return fs.readdirSync(path.join(WORTEL, MAP)).filter((f) => f.endsWith('.md')).map((f) => MAP + '/' + f); } catch (e) { return []; } };

/* Alle blokken uit alle kaarten: { blokken: [{ kaart, app, criteria }], fouten: [zin] }. */
function leesKaarten({ lees = leesStandaard, lijst = lijstStandaard } = {}) {
  const blokken = [], fouten = [];
  const ids = new Map();
  for (const kaart of lijst()) {
    const tekst = lees(kaart);
    if (tekst === null) continue;
    for (const m of tekst.matchAll(/```premiumdekking[ \t]*\n([\s\S]*?)```/g)) {
      const regel = tekst.slice(0, m.index).split('\n').length;
      let b;
      try { b = JSON.parse(m[1]); } catch (e) { fouten.push(kaart + ':' + regel + ': het blok is geen geldige JSON (' + e.message + ')'); continue; }
      if (!b || typeof b.app !== 'string' || !b.app) { fouten.push(kaart + ':' + regel + ': het blok noemt geen app'); continue; }
      if (!Array.isArray(b.criteria)) { fouten.push(kaart + ':' + regel + ': ' + b.app + ' heeft geen lijst criteria'); continue; }
      const criteria = [];
      for (const c of b.criteria) {
        const wie = kaart + ':' + regel + ' ' + b.app + ' ' + (c && c.id ? c.id : '(zonder id)');
        if (!c || !c.id || !c.zin) { fouten.push(wie + ': een criterium heeft een id en een zin'); continue; }
        if (!DIMENSIES.includes(c.dimensie)) { fouten.push(wie + ': dimensie "' + c.dimensie + '" is niet een van de acht'); continue; }
        if (ids.has(c.id)) { fouten.push(wie + ': id staat al in ' + ids.get(c.id)); continue; }
        ids.set(c.id, kaart);
        criteria.push(c);
      }
      blokken.push({ kaart, app: b.app, criteria });
    }
  }
  return { blokken, fouten };
}

/* Is dit criterium bewezen? { bewezen, reden }. `versheid` is versheid() uit
   ./stempel.js (of het raakvlak); injecteerbaar voor de toetsen. */
function criteriumUitslag(c, { lees = leesStandaard, versheid = require('./stempel').versheid } = {}) {
  const b = c.bewezenDoor;
  if (!b) return { bewezen: false, reden: 'toegezegd, niet beproefd: geen bewezenDoor' };
  if (!b.register || !Array.isArray(b.pad) || !b.stap || !['schakel', 'storing'].includes(b.stap.soort) || !Number.isInteger(b.stap.nr)) {
    return { bewezen: false, reden: 'bewezenDoor is onvolledig: register, pad en stap { soort: schakel|storing, nr } horen erbij' };
  }
  const tekst = lees(b.register);
  if (tekst === null) return { bewezen: false, reden: b.register + ' bestaat niet' };
  let reg;
  try { reg = JSON.parse(tekst); } catch (e) { return { bewezen: false, reden: b.register + ' is geen geldige JSON' }; }
  const st = reg.stempel;
  const v = st && typeof st === 'object' ? versheid(st) : { vers: false, reden: 'het register draagt geen stempel' };
  if (!v.vers) return { bewezen: false, reden: 'vervallen: ' + v.reden };
  const deel = b.pad.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), reg);
  if (!deel || typeof deel !== 'object') return { bewezen: false, reden: b.register + ' kent ' + b.pad.join('/') + ' niet' };
  const rij = (b.stap.soort === 'schakel' ? deel.schakels : deel.storingen) || [];
  const stap = rij.find((x) => x && x.nr === b.stap.nr);
  if (!stap) return { bewezen: false, reden: b.pad.join('/') + ' heeft geen ' + b.stap.soort + ' ' + b.stap.nr };
  const goed = b.stap.soort === 'schakel' ? 'gesloten' : 'gehouden';
  if (stap.stand !== goed) return { bewezen: false, reden: b.stap.soort + ' ' + b.stap.nr + ' staat ' + stap.stand };
  return { bewezen: true, reden: b.register + ' ' + b.pad.join('/') + ' ' + b.stap.soort + ' ' + b.stap.nr + ' ' + goed + ' (' + v.reden + ')' };
}

/* De dekking van een app: per dimensie { bewezen, toegezegd, open: [{ id, reden }] }.
   Alleen dimensies met iets toegezegd staan erin -- een lege dimensie is geen 0
   van 0, ze is niet toegezegd. */
function dekking(criteria, opties = {}) {
  const uit = {};
  for (const c of criteria) {
    const d = uit[c.dimensie] = uit[c.dimensie] || { bewezen: 0, toegezegd: 0, open: [] };
    d.toegezegd++;
    const u = criteriumUitslag(c, opties);
    if (u.bewezen) d.bewezen++;
    else d.open.push({ id: c.id, reden: u.reden });
  }
  return uit;
}

/* Beyond Premium: ALLE acht bewijzen BEWEZEN en elke toegezegde dimensie vol,
   met minstens een criterium. Een afgeleide uitspraak, geen stand. */
function beyondPremium(rij, dek) {
  const { BEWIJZEN } = require('./appcontract');
  const achtGroen = BEWIJZEN.every((n) => rij && rij.bewijzen && rij.bewijzen[n] && rij.bewijzen[n].status === 'BEWEZEN');
  const dims = Object.values(dek || {});
  return achtGroen && dims.length > 0 && dims.every((d) => d.toegezegd > 0 && d.bewezen === d.toegezegd);
}

module.exports = { DIMENSIES, MAP, leesKaarten, criteriumUitslag, dekking, beyondPremium };
