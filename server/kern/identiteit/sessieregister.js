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
const klok = require('../../lib/klok');

/* Een sessie zonder gebruik verdwijnt hier eerder dan het token zelf verloopt.
   Andersom zou betekenen dat het register de sessie overleeft en een lijst
   sessies toont die niet meer bestaan -- een scherm dat liegt over hoeveel
   ingangen er open staan is erger dan geen scherm. */
const REGISTER_TTL_MS = 30 * 24 * 3600 * 1000;

/* De claims die een sessie aan EEN ding vastmaken, met het veld dat dat ding
   aanwijst. Zie vul(): zo'n anker wordt aangevuld, nooit vervangen. */
const ANKERS = Object.freeze({ sleutelbinding: 'keyRef', toestel: 'toestelId' });
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
  const kijk = () => eigen.kijk('sessiecontext');
  // Exclusief eigendom: geen andere collectie hoort bij deze opslaghandeling.
  const bewaar = () => save.sleutels ? save.sleutels(['sessiecontext']) : save();

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
    bewaar();
    return { ok: true, sid, geweigerd };
  }

  /* AANVULLEN. Een claim mag erbij komen als hij later pas bewijsbaar wordt --
     een toestelbinding die na het inloggen tot stand komt, bijvoorbeeld. Wat
     NIET mag is een bestaande claim overschrijven met een zwakkere herkomst:
     dan zou een `bewezen` toestelbinding stilletjes `vermoed` kunnen worden en
     zou niemand zien dat het bewijs is verdwenen. Degraderen is nooit stil
     (PROOF.md par. 9); wie echt wil verzwakken, sluit de sessie. */
  function vul(sid, ruweContext) {
    if (!geldigeSid(sid)) return { ok: false, reden: 'onbekende sessie' };
    const rij = kijk()[sid];
    if (!rij) return { ok: false, reden: 'onbekende sessie' };
    const { context, geweigerd } = ctx.bouw(ruweContext || {});

    const afgewezen = [];
    const schrijf = [];
    for (const [naam, claim] of Object.entries(context)) {
      const oud = rij.context[naam];
      if (oud) {
        const oudG = ctx.GRADEN.indexOf(ctx.graadVan(Object.assign({ veld: naam }, oud)).graad);
        const nieuwG = ctx.GRADEN.indexOf(ctx.graadVan(Object.assign({ veld: naam }, claim)).graad);
        if (nieuwG < oudG) { afgewezen.push({ veld: naam, reden: 'zou het bewijs verzwakken; degraderen is nooit stil' }); continue; }
      }
      schrijf.push([naam, claim]);
    }

    /* EEN ANKER WORDT NIET VERVANGEN (P1-1). De graadtoets hierboven houdt een
       ZWAKKERE claim tegen, maar een even sterke met een andere sleutel ging
       erdoor -- en zo bond een gestolen token de sleutel van de dief over die
       van het lid heen. Een sessie draagt hoogstens EEN sleutel en EEN toestel;
       wie een ander wil, logt opnieuw in en krijgt een nieuwe sessie. Dezelfde
       waarde nog een keer mag: dat verandert niets.

       Alles of niets: botst een anker, dan wordt NIETS uit deze aanroep
       geschreven. Anders zou het toestel van de dief in de sessie staan naast
       de sleutel van het lid -- een context die over zichzelf liegt. */
    const botsing = [];
    for (const [naam, claim] of schrijf) {
      const veld = ANKERS[naam], oud = rij.context[naam];
      if (veld && oud && oud[veld] && claim[veld] !== oud[veld])
        botsing.push({ veld: naam, reden: 'deze sessie is al gebonden; een andere sleutel vraagt een nieuwe inlog' });
    }
    if (botsing.length) return { ok: false, reden: 'herbinding', geweigerd: geweigerd.concat(afgewezen, botsing) };

    for (const [naam, claim] of schrijf) rij.context[naam] = claim;
    rij.gezienOp = klok.datum().toISOString();
    bewaar();
    return { ok: true, geweigerd: geweigerd.concat(afgewezen) };
  }

  function lees(sid) {
    if (require('../../lib/verraad').sla('sessieregister-faalt')) throw new Error('verraad: sessieregister-faalt');
    if (!geldigeSid(sid)) return null;
    const rij = kijk()[sid];
    if (!rij) return null;
    if (klok.nu() - new Date(rij.gezienOp || 0).getTime() > REGISTER_TTL_MS) { sluit(sid); return null; }
    return rij;
  }

  /* Het venster opschuiven, met dezelfde spaarzaamheid als kern/sessies.js:
     hoogstens eens per uur wegschrijven. Anders schrijft elk verzoek de hele
     snapshot opnieuw. */
  function raak(sid) {
    if (!geldigeSid(sid)) return false;
    const rij = kijk()[sid];
    if (!rij) return false;
    if (klok.nu() - new Date(rij.gezienOp || 0).getTime() < 3600 * 1000) return false;
    rij.gezienOp = klok.datum().toISOString();
    bewaar();
    return true;
  }

  function sluit(sid) {
    if (!geldigeSid(sid)) return false;
    const huidig = kijk();
    if (!huidig[sid]) return false;
    delete huidig[sid];
    bewaar();
    return true;
  }

  /* De lijst die een lid van zijn eigen sessies ziet, woont in
     ./sessielijst.js -- een projectie is geen opslag, en dit bestand bezit de
     collectie. Hij krijgt `bak` als functie en niet als object, zodat hij
     altijd de huidige stand leest. */
  const { vanLid } = require('./sessielijst').maakSessielijst({ bak: kijk, ttlMs: REGISTER_TTL_MS });

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

  /* HET RECHT OP VERGETELHEID, en waarom die functie HIER staat.

     Bij het wissen van een lid bleef zijn sleutel in deze bak achter. De
     bezem van test/vergeten-gezelschap.test.js gaat door de hele database en
     vond hem: tak `sessiecontext (sleutel)`. De sessies zelf werden wel
     uitgelogd (forgetSession), maar dat raakt de Map met tokens en niet dit
     register -- twee dingen met dezelfde naam en een verschillende levensduur,
     precies zoals de kop van dit bestand zegt.

     Waarom niet vanLid() + sluit() vanuit kern/vergeten.js: vanLid FILTERT op
     de TTL van dertig dagen. Een rij die net over die grens is, komt daar niet
     uit en zou dus blijven staan -- en juist de oudste rij is de rij die het
     langst blijft liggen. Wissen kijkt naar wat er STAAT en niet naar wat een
     scherm nog zou tonen.

     Deze module bezit de collectie (zie de declaratie bij eigencollectie
     hierboven), dus hoort hij hem ook zelf leeg te maken. Wie dit van buitenaf
     doet, is de tweede schrijver waar die declaratie voor bestaat. */
  function wisLid(lidKey) {
    if (!lidKey) return 0;
    let weg = 0;
    const huidig = kijk();
    for (const [sid, rij] of Object.entries(huidig)) {
      if (rij && rij.lidKey === lidKey) { delete huidig[sid]; weg += 1; }
    }
    if (weg) bewaar();
    return weg;
  }

  return { open, vul, lees, raak, sluit, vanLid, wisLid, REGISTER_TTL_MS, MAX_PER_LID };
}

module.exports = { maakSessieregister, REGISTER_TTL_MS };
