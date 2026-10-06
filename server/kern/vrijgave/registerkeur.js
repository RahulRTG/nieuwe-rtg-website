/* De keuring van het vrijgaveregister (./register.js), apart gezet omdat het
   register zelf een lijst is die een bestuurder moet kunnen lezen, en deze
   regels het gereedschap zijn waarmee de bouw hem tegenhoudt. */
'use strict';
const { STANDEN } = require('./register');   // geen kring: ./register.js laadt deze keuring pas bij een aanroep
const { BESLUITEN } = require('./besluiten');

/* VALIDATIE. Draait bij het laden en bij de opstartcontrole. Een register dat
   zichzelf tegenspreekt (een veilige stand die niet in zijn eigen standenlijst
   staat, een afhankelijkheid naar een id die niet bestaat, een geldregel die
   standaard aan staat) is een fout in de CODE en moet de bouw laten zakken. */
function valideerRegister(lijst, { vermogens = null, controles = null } = {}) {
  const fouten = [];
  const ids = new Set();
  for (const c of lijst) {
    const w = (zin) => fouten.push((c && c.id || '?') + ': ' + zin);
    if (!c || typeof c.id !== 'string' || !/^[a-z]+(\.[a-z_]+)+$/.test(c.id)) { w('id ongeldig'); continue; }
    if (ids.has(c.id)) w('id dubbel');
    ids.add(c.id);
    if (typeof c.naam !== 'string' || !c.naam) w('naam ontbreekt');
    if (typeof c.eigenaar !== 'string' || !c.eigenaar) w('eigenaar ontbreekt');
    if (typeof c.geimplementeerd !== 'boolean') w('geimplementeerd is geen boolean');
    for (const k of ['geld', 'beveiliging', 'noodknop']) if (typeof c[k] !== 'boolean') w(k + ' is geen boolean');
    if (!Array.isArray(c.standen) || !c.standen.length) w('standen ontbreken');
    else for (const s of c.standen) if (!STANDEN.includes(s)) w('onbekende stand ' + s);
    if (!Array.isArray(c.standen) || !c.standen.includes(c.veiligeStand)) w('veilige stand staat niet in de eigen standen');
    /* De kern van "uit mag nooit per ongeluk aan betekenen": een regel die geld
       of veiligheid raakt, staat bij gebrek aan een mens op UIT. */
    if ((c.geld || c.beveiliging) && c.veiligeStand !== 'disabled') w('geld of veiligheid moet veilig op disabled staan');
    if (c.noodknop && Array.isArray(c.standen) && !c.standen.includes('emergency_disabled')) w('noodknop zonder emergency_disabled');
    if (!Array.isArray(c.afhankelijk)) w('afhankelijk is geen lijst');
    /* De externe controles bestaan al (server/config/external-release.js
       ALLE_CONTROLES). Een regel die een controle noemt die daar niet staat, eist
       een bewijs dat nooit geleverd kan worden. */
    if (!c.bewijs || !Array.isArray(c.bewijs.controles)) w('bewijs zonder controles');
    else if (controles) for (const k of c.bewijs.controles) if (!controles.includes(k)) w('onbekende externe controle ' + k);
    if (!c.bevoegdheid || (!c.bevoegdheid.vermogen && !c.bevoegdheid.besluit)) w('autorisatiebeleid ontbreekt');
    if (c.bevoegdheid && c.bevoegdheid.besluit && !BESLUITEN[c.bevoegdheid.besluit]) w('onbekend besluit ' + c.bevoegdheid.besluit);
    if (vermogens && c.bevoegdheid && c.bevoegdheid.vermogen && !vermogens[c.bevoegdheid.vermogen])
      w('onbekend bevoegdheidsvermogen ' + c.bevoegdheid.vermogen);
    if (!Array.isArray(c.toetsen) || !c.toetsen.length) w('geen toetsen genoemd');
  }
  for (const c of lijst) for (const a of (c && c.afhankelijk) || []) if (!ids.has(a)) fouten.push(c.id + ': afhankelijkheid ' + a + ' bestaat niet');
  /* Een kring in de afhankelijkheden zou een oordeel opleveren dat nooit
     eindigt -- of, als iemand het afkapt, een dat op volgorde wordt beslist. */
  const OP = new Map(lijst.filter(Boolean).map(c => [c.id, c]));
  const bezig = new Set(), klaar = new Set();
  const loop = (id, pad) => {
    if (klaar.has(id)) return;
    if (bezig.has(id)) { fouten.push('kring in afhankelijkheden: ' + pad.concat(id).join(' -> ')); return; }
    bezig.add(id);
    for (const a of (OP.get(id) && OP.get(id).afhankelijk) || []) if (OP.has(a)) loop(a, pad.concat(id));
    bezig.delete(id); klaar.add(id);
  };
  for (const id of OP.keys()) loop(id, []);
  return { ok: fouten.length === 0, fouten };
}

module.exports = { valideerRegister };
