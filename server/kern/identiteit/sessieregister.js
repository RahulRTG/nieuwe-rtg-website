/* ============================================================================
   MIJN RTG, blok 1: HET SESSIEREGISTER.

   WAAROM DIT BESTAAT. Dit huis kent twee soorten sessies en dat is geen fout
   maar een gevolg:

     kern/sessies.js   demo-, gast-, leverancier- en kantoorsessies. Die hebben
                       WEL een record (een Map plus db.data.sessions).
     accounts/tokens   een echt lid. Staatloos ondertekend token, en
                       resolveSession bouwt bij elk verzoek een vers object.
                       Er wordt NIETS bewaard.

   Voor verreweg de meeste mensen op dit platform bestond een sessie dus niet als
   ding. "Toon mijn actieve sessies" was daarmee geen ontbrekend scherm maar een
   onbeantwoordbare vraag, en "log overal uit behalve hier" een belofte zonder
   voorwerp.

   Dit register geeft beide soorten een plek voor hun CONTEXT, met de sid als
   gedeelde sleutel. Het is nadrukkelijk geen tweede sessie-opslag:

     - het verleent geen toegang. Een record hier maakt een ongeldig token niet
       geldig; de geldigheid blijft bij verifyToken en sessionFor.
     - het bewaart geen token en geen tokenhash. De sid is een willekeurig
       getal uit het token en identificeert de sessie, niet de mens.
     - het bewaart geen persoonsgegeven. Wat er wel in mag staat op de gesloten
       lijst in ./sessiecontext.js, en die weigert de rest met de reden erbij.

   DE LIDSLEUTEL staat er wel in, want zonder "van wie is deze sessie" kun je
   geen sessielijst tonen. Dat is een codenaam-sleutel (`user-<id>`), dezelfde
   die elders in de operationele laag reist -- geen naam, geen e-mail. Draai
   npm run afleidbaar na elke uitbreiding: dit record is precies de vorm die
   scripts/afleidbaar.js als afleidingsrisico meet.
   ========================================================================== */
'use strict';

const ctx = require('./sessiecontext');
const { standVan } = require('./vertrouwen');
const klok = require('../../lib/klok');

/* Een sessie zonder gebruik verdwijnt hier eerder dan het token zelf verloopt.
   Andersom zou betekenen dat het register de sessie overleeft en een lijst
   sessies toont die niet meer bestaan -- een scherm dat liegt over hoeveel
   ingangen er open staan is erger dan geen scherm. */
const REGISTER_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_PER_LID = 100;

function maakSessieregister({ db, save }) {
  /* Het lichte opslagcontract van dit huis (kern/eigencollectie.js): een module,
     een collectie, exclusief van hem. Zonder deze declaratie zou regel 63 van
     scripts/check.js deze collectie niet bewaken -- hij ziet alleen wat iemand
     heeft OPGEEIST. Een nieuwe bak zonder eigenaar is precies hoe een tweede
     schrijver er over een half jaar ongemerkt bij komt. */
  const eigen = require('../eigencollectie')({ db, domein: 'kern/identiteit',
    bezit: { sessiecontext: 'kaart' } });
  const bak = () => eigen.bak('sessiecontext');

  const geldigeSid = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{12}$/.test(s);

  /* OPENEN. Gebeurt op het moment van authenticatie en nergens anders: de
     herkomst van een claim moet worden vastgelegd WANNEER hij is vastgesteld,
     niet achteraf gereconstrueerd. Een reconstructie is een afleiding en zou
     dus hoogstens `vermoed` mogen heten -- terwijl het moment zelf `bewezen`
     had kunnen opleveren. Achteraf invullen kost je dus bewijs. */
  function open(sid, lidKey, ruweContext) {
    if (!geldigeSid(sid)) return { ok: false, reden: 'geen geldige sid' };
    const { context, geweigerd } = ctx.bouw(ruweContext || {});
    const nu = klok.datum().toISOString();
    const rij = { lidKey: String(lidKey || '') || null, geopendOp: nu, gezienOp: nu, context };
    bak()[sid] = rij;
    ruim(rij.lidKey, sid);
    save();
    return { ok: true, sid, geweigerd };
  }

  /* AANVULLEN. Een claim mag erbij komen als hij later pas bewijsbaar wordt --
     een toestelbinding die na het inloggen tot stand komt, bijvoorbeeld. Wat
     NIET mag is een bestaande claim overschrijven met een zwakkere herkomst:
     dan zou een `bewezen` toestelbinding stilletjes `vermoed` kunnen worden en
     zou niemand zien dat het bewijs is verdwenen. Degraderen is nooit stil
     (PROOF.md par. 9); wie echt wil verzwakken, sluit de sessie. */
  function vul(sid, ruweContext) {
    const rij = bak()[sid];
    if (!geldigeSid(sid) || !rij) return { ok: false, reden: 'onbekende sessie' };
    const { context, geweigerd } = ctx.bouw(ruweContext || {});
    const afgewezen = [];
    for (const [naam, claim] of Object.entries(context)) {
      const oud = rij.context[naam];
      if (oud) {
        const oudG = ctx.GRADEN.indexOf(ctx.graadVan(Object.assign({ veld: naam }, oud)).graad);
        const nieuwG = ctx.GRADEN.indexOf(ctx.graadVan(Object.assign({ veld: naam }, claim)).graad);
        if (nieuwG < oudG) { afgewezen.push({ veld: naam, reden: 'zou het bewijs verzwakken; degraderen is nooit stil' }); continue; }
      }
      rij.context[naam] = claim;
    }
    rij.gezienOp = klok.datum().toISOString();
    save();
    return { ok: true, geweigerd: geweigerd.concat(afgewezen) };
  }

  function lees(sid) {
    if (!geldigeSid(sid)) return null;
    const rij = bak()[sid];
    if (!rij) return null;
    if (klok.nu() - new Date(rij.gezienOp || 0).getTime() > REGISTER_TTL_MS) { sluit(sid); return null; }
    return rij;
  }

  /* Het venster opschuiven, met dezelfde spaarzaamheid als kern/sessies.js:
     hoogstens eens per uur wegschrijven. Anders schrijft elk verzoek de hele
     snapshot opnieuw. */
  function raak(sid) {
    const rij = bak()[sid];
    if (!rij) return false;
    if (klok.nu() - new Date(rij.gezienOp || 0).getTime() < 3600 * 1000) return false;
    rij.gezienOp = klok.datum().toISOString();
    save();
    return true;
  }

  function sluit(sid) {
    if (!geldigeSid(sid) || !bak()[sid]) return false;
    delete bak()[sid];
    save();
    return true;
  }

  /* De sessies van een lid, met per sessie de STAND per veld -- niet een cijfer.
     Dit is wat een sessielijst hoort te lezen: elk veld met zijn graad, zodat
     een scherm "toestelbinding: bewezen" naast "vertrouwen: vermoed, 3 uur oud"
     kan zetten in plaats van alles even zeker te laten lijken. */
  function vanLid(lidKey, nu = klok.nu()) {
    const uit = [];
    for (const [sid, rij] of Object.entries(bak())) {
      if (!lidKey || rij.lidKey !== lidKey) continue;
      if (nu - new Date(rij.gezienOp || 0).getTime() > REGISTER_TTL_MS) continue;
      /* De SOORT naast de STAND. Zonder dit moet een scherm de soort raden uit de
         graad ("bewezen dus een passkey"), en dat is precies zo lang waar tot er
         een derde manier van inloggen bij komt. De soort is geen persoonsgegeven
         en geen bewijs -- hij zegt WAT het was, de graad zegt hoe zeker. */
      const st = ctx.stand(rij.context, nu);
      uit.push({ sid, geopendOp: rij.geopendOp, gezienOp: rij.gezienOp,
        soort: (rij.context.authenticator && rij.context.authenticator.type) || null,
        /* De toestelId reist mee, de toestelNAAM niet: die woont in het
           toestelregister en wordt door de route erbij gezocht. Zou hij hier
           staan, dan had de sessie hem moeten dragen -- en dat is precies wat
           de verbodenlijst tegenhoudt. */
        toestelId: (rij.context.toestel && rij.context.toestel.toestelId) || null,
        /* Dezelfde knip als bij het toestel: de CODE reist mee, de naam niet.
           De naam van een zaak wordt door de route opgezocht bij de bron die
           hem bezit; een sessie draagt geen namen. */
        contextSoort: (rij.context.context && rij.context.context.contextSoort) || null,
        contextId: (rij.context.context && rij.context.context.contextId) || null,
        stand: st,
        /* DE VERTROUWENSSTAND WORDT HIER BEREKEND EN NERGENS BEWAARD. Hij leest
           de stand-per-veld die er net boven uit komt, dus hij kan nooit iets
           zien wat het scherm niet ziet -- en hij kan niet verouderen, want hij
           bestaat alleen op het moment dat iemand hem vraagt. */
        vertrouwen: standVan(st, (rij.context.authenticator && rij.context.authenticator.type) || null) });
    }
    return uit.sort((a, b) => new Date(b.gezienOp) - new Date(a.gezienOp));
  }

  /* Vangnet per lid. Zonder grens groeit het register door met elke inlog op
     elk toestel; met een grens verdwijnt de OUDSTE en nooit de zojuist geopende. */
  function ruim(lidKey, behoud) {
    if (!lidKey) return;
    const mijne = Object.entries(bak())
      .filter(([sid, r]) => r.lidKey === lidKey && sid !== behoud)
      .sort((a, b) => new Date(a[1].gezienOp || 0) - new Date(b[1].gezienOp || 0));
    const teveel = mijne.length + 1 - MAX_PER_LID;
    for (let i = 0; i < teveel; i++) delete bak()[mijne[i][0]];
  }

  return { open, vul, lees, raak, sluit, vanLid, REGISTER_TTL_MS, MAX_PER_LID };
}

module.exports = { maakSessieregister, REGISTER_TTL_MS };
