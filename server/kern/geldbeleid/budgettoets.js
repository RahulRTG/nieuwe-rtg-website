/* Geldbeleid, deel "budgettoets": past een concreet voorstel binnen mijn pot?

   Besluit B2 van de eigenaar (11 oktober 2026): het budget van een vriend
   telt alleen mee met zijn EXPLICIETE toestemming, en dan ontvangt Rahul
   uitsluitend `past` of `past-niet` voor een CONCREET voorstel. Geen bedrag,
   geen saldo, geen vergelijking, en de uitkomst gaat niet vanzelf naar de
   andere deelnemers. Romeproef schakel 12.

   DRIE DINGEN DIE HIER IN CODE STAAN EN NIET IN EEN ZIN:

   1. ZONDER TOESTEMMING GEEN UITKOMST. `toets()` geeft dan `null` met de reden,
      en geen "past niet": een "nee" uit een pot waar niemand naar mocht kijken
      is ook een uitspraak over die pot.
   2. DE TOESTEMMING IS EEN GEWONE TOESTEMMING. Ze staat op het toestemmingsscherm
      (laag `budgettoets` in kern/consent-register.js) en wordt daar ingetrokken
      langs `intrek()` hieronder -- er komt geen tweede toestemmingsmodel bij.
      Ze draagt een einddatum (30 dagen), want "kijk voortaan altijd in mijn
      pot" is meer dan iemand vraagt die een weekend plant.
   3. DE UITKOMST ZEGT NIET WAAROM. "Past niet" draagt geen reden: "uw pot is te
      klein" of "uw maandgrens weigert dit" vertelt al iets over het bedrag.

   WAT "PAST" BETEKENT. Het voorstel past als het bedrag binnen het DOEL van de
   gekozen pot blijft (het lid zette dat zelf als budget, ./potten.js) EN zijn
   eigen geldgrens het niet zou weigeren (./grens.js `grensVoor`, de dag- en
   maandgrens die de waardepoort afdwingt). Er wordt geen saldo gelezen: een pot
   is een oormerk en geen rekening, en een tweede saldocontrole zou een tweede
   boekhouding zijn (GELD.md par. 7). */
'use strict';

const DAGEN = 30;
const DAG_MS = 86400000;

module.exports = (ctx) => {
  const { pak, kijk, save, maakId, bedragVan, logSchrijf, grensVoor } = ctx;
  const ms = () => new Date(ctx.nu()).getTime();
  const bak = (rec) => { if (!Array.isArray(rec.budgettoetsen)) rec.budgettoetsen = []; return rec.budgettoetsen; };
  const loopt = (t) => t.status === 'actief' && Date.parse(t.tot) > ms();
  const zicht = (rec, t) => {
    const pot = rec.potten.find(p => p.id === t.potId);
    return { id: t.id, potId: t.potId, pot: pot ? pot.naam : null, sinds: t.at, tot: t.tot,
      stand: loopt(t) ? 'actief' : (t.status === 'actief' ? 'verlopen' : t.status) };
  };

  function toestemmingen(codenaam) {
    const rec = kijk(codenaam);
    return rec ? bak(rec).map(t => zicht(rec, t)) : [];
  }

  /* Het lid geeft ZELF toestemming, voor EEN eigen pot. Een tweede toestemming
     vervangt de eerste: er is per lid hoogstens een pot waartegen getoetst wordt,
     anders kiest het systeem welke pot het antwoord bepaalt. */
  function sta(codenaam, potId) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    const pot = rec.potten.find(p => p.id === String(potId == null ? '' : potId));
    if (!pot) return { status: 404, error: 'Kies een eigen pot waartegen getoetst mag worden.' };
    // nog eens hetzelfde geven is geen nieuwe toestemming: de eerste einddatum blijft staan
    const al = bak(rec).find(t => loopt(t) && t.potId === pot.id);
    if (al) return { status: 200, ok: true, toestemming: zicht(rec, al), al: true };
    const nu = ms();
    for (const t of bak(rec)) if (t.status === 'actief') { t.status = 'ingetrokken'; t.ingetrokkenOp = new Date(nu).toISOString(); }
    const t = { id: maakId('bt'), codenaam, status: 'actief', potId: pot.id,
      at: new Date(nu).toISOString(), tot: new Date(nu + DAGEN * DAG_MS).toISOString() };
    bak(rec).unshift(t);
    if (rec.budgettoetsen.length > 20) rec.budgettoetsen.length = 20;
    logSchrijf(codenaam, { wie: 'lid', wat: 'Toestemming voor de budgettoets op pot ' + pot.naam,
      waarom: 'Rahul mag bij een voorstel dat aan u is klaargezet alleen zeggen of het past; geen bedrag, en de uitkomst ziet alleen u',
      gegevens: ['pot: ' + pot.id, 'tot: ' + t.tot] });
    save();
    return { status: 200, ok: true, toestemming: zicht(rec, t) };
  }

  function intrek(codenaam, id) {
    const rec = kijk(codenaam);
    const t = rec && bak(rec).find(x => x.id === String(id || ''));
    if (!t) return { status: 404, error: 'Deze toestemming bestaat niet.' };
    if (t.status !== 'actief') return { status: 200, ok: true, al: t.status };
    t.status = 'ingetrokken'; t.ingetrokkenOp = new Date(ms()).toISOString();
    logSchrijf(codenaam, { wie: 'lid', wat: 'Toestemming voor de budgettoets ingetrokken',
      waarom: 'het lid trok hem zelf in', gegevens: ['toestemming: ' + t.id] });
    save();
    return { status: 200, ok: true };
  }

  /* DE TOETS. Alleen een boolean naar buiten, en `null` als er niets mag. */
  function toets(codenaam, bedragCenten) {
    const centen = bedragVan(bedragCenten);
    if (centen == null) return { uitkomst: null, reden: 'geen concreet bedrag in het voorstel' };
    const rec = kijk(codenaam);
    const t = rec && bak(rec).find(loopt);
    if (!t) return { uitkomst: null, reden: 'geen toestemming' };
    const pot = rec.potten.find(p => p.id === t.potId);
    if (!pot) return { uitkomst: null, reden: 'de pot van de toestemming bestaat niet meer' };
    const grens = typeof grensVoor === 'function' ? grensVoor(codenaam) : null;
    const binnenGrens = !grens || [grens.dagMaxCenten, grens.maandMaxCenten].every(m => m == null || centen <= m);
    return { uitkomst: centen <= pot.doelCenten && binnenGrens ? 'past' : 'past-niet' };
  }

  return { toestemmingen, sta, intrek, toets };
};
