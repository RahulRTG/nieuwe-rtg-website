/* EEN GEREEDSCHAPSAANROEP VAN DE STUURLUS -- plan, kaart of doe, precies een.

   Afgesplitst uit ./lus.js toen dat door de 10 KB van keuringsregel 13 ging. De
   naad is echt en niet cosmetisch: lus.js houdt de LUS (budget, deeltaken,
   synthese, de klok naar het model), en dit bestand doet EEN aanroep. Dat zijn
   twee dingen die om verschillende redenen schuiven -- de lus als de
   taakverdeling verandert, deze stap als er een gereedschap of een poort bij
   komt. Zelfde naad als ./luscontext.js.

   DE POORT STAAT HIER EN NIET ALLEEN BIJ DE KAART, en dat is de reden dat dit
   bestand bestaat. De kaart wordt bij stap n opgehaald en `doe` gebeurt bij stap
   n+3: het model heeft de bredere lijst dan allang gezien. Alleen de LIJST
   versmallen sluit dus niets -- het model kan een pad noemen dat er bij het
   ophalen nog in stond. De herkomstpoort hangt daarom VOOR de aanroep, en zij
   velt hetzelfde oordeel als de kaart doordat allebei `magMetHerkomst` gebruiken.

   DE VOLGORDE IS DE HELE BEVEILIGING. Het melden van een toolantwoord gebeurt NA
   de aanroep en VOOR het antwoord in `messages` belandt. Zou het erna gebeuren,
   dan is de eerste besmette beurt gratis: het model heeft de onvertrouwde tekst
   dan al gezien terwijl de lijst nog ongewijzigd was. */
'use strict';

const { magDoen } = require('../rahul/twijfel');
const { resolveer } = require('./resolver');
const { woordenUit } = require('./resolver-woorden');
const { compileer } = require('./plan');
const { voorspel } = require('./gevolg');

/* De herkomstpoort en zijn schaduwtelling staan in ./lusstap-herkomst.js: een
   beveiligingspoort met een eigen meting is iets anders dan het uitvoeren van
   een gereedschap, en dit bestand ging door de omvangband. */
const maakHerkomstpoort = require('./lusstap-herkomst');

module.exports = function maakLusstap({ stuurRoep, filter, vuil, spoor }) {

  const { herkomstpoort, schaduw, AFDWINGEN } = maakHerkomstpoort({ filter, vuil });

  async function voerUit(req, t, { wereld, kaartVraag, paden, acties, ctxWoorden }) {
    if (t.name === 'plan') {
      /* Wegen, niet doen. De compiler krijgt de rol mee en raakt niets aan; wat
         hij teruggeeft is een oordeel dat het model aan de gebruiker kan
         voorlezen voordat er een voorstel ontstaat.

         Het plan en de gevolgvoorspelling reizen SAMEN terug maar zijn twee
         dingen: ./plan.js weegt de bevoegdheid, ./gevolg.js zegt uit een eerdere
         meting wat de stappen aanraakten. Het plan bezit de voorspelling niet
         (EXECUTIE.md blok 3: PLAN bezit niets). */
      const gewogen = compileer(t.input || {}, wereld);
      /* DE COMPILER DIE NEE ZEGT, HEEFT GEDRAAID. Hier stond `uitvoerbaar ?
         PASS : NOT_RUN`, en dat is in strijd met de betekenis die ./spoor.js
         zelf aan NOT_RUN geeft: "hij was aan de beurt en deed terecht niets".
         Een plan dat wordt AFGEWEZEN is geen niets-doen maar het werk zelf --
         de compiler heeft gewogen en een reden geproduceerd. De stand gaat over
         de FASE, de uitkomst staat in het detail.

         Dat verschil is precies wat een gouden plak moet kunnen tonen: "parijs
         vrijdag" hoort te eindigen op een compiler die PASS is en een
         capability die er niet IS -- niet op een fase die eruitziet alsof hij
         is overgeslagen. */
      spoor && spoor.mark('PLAN_COMPILED', 'PASS',
        { uitvoerbaar: !!gewogen.uitvoerbaar, bezwaren: (gewogen.bezwaren || []).length,
          /* De eerste reden staat erbij: een telling van bezwaren zegt niet
             WAAROM er niets kan, en dat is nu juist het antwoord. */
          eersteBezwaar: (gewogen.bezwaren || [])[0] ? (gewogen.bezwaren[0].reden || '').slice(0, 120) : undefined });
      const gevolg = voorspel(gewogen);
      /* WAT HIER STAAT, IS WAT ./gevolg.js WERKELIJK TERUGGEEFT. Hier stond
         `{ graad: gevolg.graad }`, en voorspel() heeft geen `graad` -- die woont
         per STAP, niet over het plan. Het merk droeg dus sinds de bouw een leeg
         veld: het detail viel weg in de JSON en de fase leek keurig gemeten.
         Gevonden door MENSELIJKE_UITVOERING.json, dat het detail per zin naast
         de stand legde en overal niets vond. Een veld dat nooit een waarde heeft
         gehad, is erger dan een ontbrekend veld -- het leest als bewijs.

         `onbekend` staat er apart bij en wordt nergens bij `gemeten` opgeteld:
         "van deze stap is niet gemeten wat hij aanraakt" is iets anders dan
         "deze stap raakt niets aan" (./gevolg.js zegt dat zelf ook). */
      const gt = (gevolg && gevolg.telling) || {};
      spoor && spoor.mark('CONSEQUENCE_EVALUATED', 'PASS',
        { stappen: (gevolg && gevolg.stappen || []).length,
          collecties: (gevolg && gevolg.geraakteCollecties || []).length,
          gemeten: gt.gemeten, geenEffect: gt['geen-effect-gemeten'], onbekend: gt.onbekend });
      const uit = Object.assign({}, gewogen, { gevolg });
      acties.push({ pad: 'plan', status: uit.uitvoerbaar ? 200 : 409, gevraagd: true });
      return uit;
    }

    if (t.name === 'kaart') {
      const toegestaan = paden();
      const uit = (t.input && t.input.alles)
        ? { paden: toegestaan, versmald: false, reden: 'De volledige lijst voor deze rol, op verzoek.' }
        : resolveer(kaartVraag, toegestaan);
      /* HEEFT DE CONTEXT ECHT MEEGEWOGEN? CONTEXT_SANITIZED zegt alleen dat er
         iets gesaneerd is; dit zegt of een van die woorden ook werkelijk een
         pad heeft geraakt. `ctxWoorden` draagt al alleen wat de context BOVEN
         de vraag toevoegt (./lus.js), dus een treffer hier komt niet uit de
         zin van de mens zelf. Vraagt hij om de volledige lijst, dan is er
         niets gewogen -- dat is `false` en geen stilte. */
      const ctxw = new Set(woordenUit((ctxWoorden || []).join(' ')));
      const ctxRaak = (uit.raakvlak || []).filter((w) => ctxw.has(w));
      spoor && spoor.mark('INTENT_RESOLVED', 'PASS',
        { versmald: !!uit.versmald, paden: (uit.paden || []).length,
          contextWoorden: ctxw.size, contextGebruikt: ctxRaak.length > 0, contextRaak: ctxRaak });
      /* WAT ER DOOR EEN BEVEILIGINGSSTAND WEGVIEL, ZEGT DE KAART ERBIJ. Zonder
         deze regel denkt het model dat die vermogens niet BESTAAN, en zegt het
         "dat kan ik niet" in plaats van "dat kan nu niet, omdat". EXECUTIE.md
         blok 0. */
      const iso = toegestaan.isolatie;
      if (iso && iso.actief && iso.weggevallen.length) {
        uit.beveiligingsstand = {
          weggevallen: iso.weggevallen.length,
          uitleg: iso.uitleg,
          zegTegenDeGebruiker: 'Er staat een beveiligingsstand aan. Zeg WAT er nu niet kan en ' +
            'WAARDOOR; doe niet alsof die mogelijkheid niet bestaat.'
        };
      }
      /* DE PRIJS VAN DE HERKOMSTPOORT, in de schaduw gemeten. Hij staat op de
         kaart en niet in een logregel: wie besluit of de vlag omgaat, hoort het
         getal te zien op het scherm waar hij kijkt. */
      if (schaduw.gewogen) {
        uit.herkomstSchaduw = { gewogen: schaduw.gewogen, zouSluiten: schaduw.zouSluiten,
          voorbeelden: schaduw.paden.slice(0, 8), afdwingen: AFDWINGEN(wereld),
          wat: 'wat de herkomstpoort zou hebben gesloten; hij telt en houdt niets tegen ' +
            'zolang deze wereld niet in RTG_HERKOMST_AFDWINGEN staat' };
      }
      return uit;
    }

    /* De twijfelpoort staat VOOR de aanroep. Zonder expliciete zekerheid gebeurt
       er niets en krijgt het model te horen dat het eerst moet vragen. Dit is
       bewust een harde poort en geen regel die het model mag afwegen: bij twijfel
       is de neiging om toch maar iets te doen nu juist het probleem. */
    const poort = magDoen(t.input || {});
    if (!poort.ok) {
      acties.push({ pad: (t.input || {}).pad, status: 0, gevraagd: true });
      return poort;
    }
    const pad = String((t.input || {}).pad || '');

    /* DE HERKOMSTPOORT, voor de aanroep en niet erna. */
    const h = herkomstpoort(pad, wereld);
    if (!h.mag) {
      acties.push({ pad, status: 0, gevraagd: true, geweigerd: 'HERKOMST' });
      return { ok: false, reden: 'HERKOMST', pad,
        uitleg: (h.oordeel && h.oordeel.uitleg) ||
          'onvertrouwde inhoud heeft aan dit gesprek bijgedragen; dit pad raakt een effect dat ' +
          'daarmee dichtgaat',
        zegTegenDeGebruiker: 'Zeg dat dit nu niet kan OMDAT er inhoud van buiten in dit gesprek zit, ' +
          'en niet dat de mogelijkheid niet bestaat.' };
    }

    spoor && spoor.mark('CAPABILITY_SELECTED', 'PASS', { pad });
    const uit = await stuurRoep(req, pad, (t.input || {}).body, { wereld });
    /* EXECUTED: DRIE UITKOMSTEN IN TWEE STANDEN (2xx = PASS, 428 = voorstel,
       al het andere = geweigerd). Hier stond `bevestigNodig ? NOT_RUN : PASS`,
       en daarmee las een GEWEIGERDE aanroep -- 403, 409, 503 -- als een
       uitgevoerde. Zonder status is het NOT_RUN: een uitvoering claimen die we
       niet kunnen zien, is de valse nul andersom. Zie MENS.md par. 3e. */
    const st = uit && typeof uit.status === 'number' ? uit.status : null;
    const voorstel = !!(uit && uit.bevestigNodig);
    const gelukt = st !== null && st >= 200 && st < 300 && !voorstel;
    spoor && spoor.mark('EXECUTED', gelukt ? 'PASS' : 'NOT_RUN',
      { status: st === null ? undefined : st, voorstel: voorstel || undefined,
        geweigerd: (!gelukt && !voorstel) || undefined,
        statusOnbekend: st === null || undefined });
    acties.push({ pad, status: uit.status,
      goedkeuring: uit && uit.goedkeuring ? uit.goedkeuring : undefined });
    /* MELDEN VOOR HET ANTWOORD HET GESPREK IN GAAT. Zie de kop: erna is de
       eerste besmette beurt gratis. */
    vuil.meldToolantwoord(pad);
    return uit;
  }

  return { voerUit, schaduw: () => Object.assign({}, schaduw, { paden: schaduw.paden.slice() }) };
};

