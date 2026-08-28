const klok = require('./lib/klok');
/* Techniek-motor voor het beveiligde Backoffice-statusbord.

   Twee dingen:
   1. Gezondheidschecks: een lijst subsystemen die elk een status teruggeven
      (ok / waarschuwing / fout) met een korte uitleg en een vaste code. Zo zie
      je in één oogopslag een groen of rood bolletje, en bij rood meteen wat er
      speelt.
   2. Zekeringen ("circuit breakers"): per subsysteem een schakelaar. Springt er
      een (automatisch bij een fout, of met de hand), dan staat de stroom eraf en
      kan de eigenaar hem er weer in doen. Sommige zekeringen gaten echt gedrag
      (onderhoudsstand, registratie).

   De checks krijgen alles via een ctx-object, zodat deze module zuiver en
   testbaar is (geen verborgen globals). De integratie-checks (AI, betalingen,
   wallet, motor, bank, stad, e-mail) staan in ./techniek-checks.js en worden
   hieronder op hun vaste plek ingevoegd. */

const kluis = require('./kluis');
const { CHECKS_INTEGRATIES } = require('./techniek-checks');

// Elke check geeft { status, detail } terug. status: 'ok' | 'waarschuwing' | 'fout'.
const { CHECKS_BASIS: CHECKS } = require('./techniek-basis');

// Draai alle checks (ook async), en respecteer een gesprongen zekering: staat de
// stroom eraf, dan is het subsysteem bewust uit -> toon dat i.p.v. een "fout".
async function draaiChecks(ctx) {
  const uit = [];
  for (const chk of CHECKS) {
    let res;
    try { res = await chk.run(ctx); } catch (e) { res = { status: 'fout', detail: 'Check wierp een fout: ' + (e.message || e) }; }
    const zeker = ctx.zekeringen && ctx.zekeringen[chk.id];
    if (zeker && zeker.aan === false) res = { status: 'fout', detail: 'Zekering gesprongen (subsysteem uit): ' + (zeker.reden || 'handmatig') };
    uit.push({ id: chk.id, naam: chk.naam, code: chk.code, categorie: chk.categorie, status: res.status, detail: res.detail });
  }
  return uit;
}

/* Standaard-zekeringen. `aan:true` = stroom erop (normaal). `poort` = of deze
   zekering echt gedrag afsluit als hij springt (onderhoud, registratie). */
function standaardZekeringen() {
  return {
    onderhoud:   { naam: 'Onderhoudsstand', code: 'FUSE-MAINT', aan: true, poort: true, uitleg: 'Springt hij (stroom eraf), dan is de hele app in onderhoud: alleen de eigenaar komt er nog in.' },
    registratie: { naam: 'Nieuwe registraties', code: 'FUSE-REG', aan: true, poort: true, uitleg: 'Eraf = geen nieuwe accounts (bijv. bij misbruik).' },
    /* De kleine degraded mode van de noodrem-ladder: alleen de inlog- en
       registratiepaden dicht, ingelogde leden merken niets. Bestaat omdat de
       oude noodrem bij een brede brute force de ONDERHOUDS-zekering trok --
       de hele app op slot, permanent tot de eigenaar langskwam. Zes gespoofte
       bronnen op de inlog waren zo genoeg voor totale uitval: een verdediging
       die als DoS-versterker werkte. */
    inlogpauze: { naam: 'Inlogpauze', code: 'FUSE-LOGIN', aan: true, poort: true, uitleg: 'Eraf = in- en uitschrijfpaden tijdelijk dicht (brede brute force); wie al is ingelogd merkt niets.' },
    betalingen:  { naam: 'Betaalverkeer', code: 'FUSE-PAY', aan: true, poort: true, uitleg: 'Eraf = betalingen tijdelijk geblokkeerd.' },
    ai:          { naam: 'AI-antwoorden', code: 'FUSE-AI', aan: true, poort: true, uitleg: 'Eraf = de persoonlijke AI staat uit.' }
  };
}

/* Is deze zekering gesprongen? EN de plek waar een tijdgebonden (automatische)
   zekering vanzelf dooft. flood.js formuleerde het huisprincipe al voor de
   lastafworp: een reflex die blijft hangen is geen bescherming. Een zekering
   die de noodrem trok draagt daarom een 'tot'; is die verstreken, dan gaat de
   stroom er hier weer op -- bij de eerstvolgende lezing, zonder dat er een
   mens of een timer aan te pas komt. Een HANDMATIG getrokken zekering heeft
   geen 'tot' en blijft eruit tot de eigenaar hem reset; dat verschil is de
   hele afspraak. De heling wordt niet apart weggeschreven: elke lezing heelt
   opnieuw, en de eerstvolgende gewone save neemt hem mee. */
function zekeringGesprongen(z) {
  if (!z || z.aan !== false) return false;
  if (z.tot && z.tot <= klok.nu()) {
    z.aan = true; z.reden = null; z.sindsGesprongen = null; z.tot = null;
    return false;
  }
  return true;
}

module.exports = { CHECKS, draaiChecks, standaardZekeringen, zekeringGesprongen };
