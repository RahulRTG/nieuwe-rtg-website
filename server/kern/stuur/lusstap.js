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
const { compileer } = require('./plan');
const { voorspel } = require('./gevolg');

/* DE POORT BIJT ALLEEN MET DE VLAG OM, EN DAT IS EEN BESLUIT MET EEN PRIJS.

   CONTROLPLANE.md: een nieuwe handhavingsregel loopt eerst mee zonder te
   blokkeren -- je kunt niet afdwingen wat nooit in de schaduw heeft gelopen. De
   prijs is gemeten en niet geschat: na de eerste geslaagde `doe` gaat een lid van
   120 naar 36 AI-paden en een zaak van 53 naar 9. Dat getal hoort een mens te
   zien voordat de vlag omgaat.

   HIER STONDEN EERST 43 EN 9, EN DIE WAREN VEROUDERD. Ze zijn gemeten VOORDAT de
   leesset-vrijstelling werd aangescherpt (../isolatie/herkomstpoort.js:
   SCHRIJFNIVEAUS -- een bewezen lezer die het beleid een SCHRIJVER noemt, is
   onder onvertrouwde invoer geen lezer meer). Een gemeten getal in commentaar dat
   niet meer klopt, is precies het soort stille onwaarheid waar deze laag voor is
   gebouwd; wie hem verandert, meet opnieuw.

   In de schaduw TELT hij en houdt hij niets tegen; de telling reist mee in het
   antwoord van de kaart, zodat de eigenaar de prijs op zijn scherm heeft in
   plaats van in een logregel. */
const AFDWINGEN = () => process.env.RTG_HERKOMST_AFDWINGEN === '1';

module.exports = function maakLusstap({ stuurRoep, filter, vuil }) {

  /* De schaduwtelling van deze lus. Geen module-toestand: twee gesprekken
     tegelijk zouden elkaars getal opschrijven. */
  const schaduw = { gewogen: 0, zouSluiten: 0, paden: [] };

  function herkomstpoort(pad, wereld) {
    if (!filter || !filter.magMetHerkomst) return { mag: true, schaduw: false };
    const oordeel = filter.magMetHerkomst(pad, wereld, vuil.bronnen());
    schaduw.gewogen++;
    if (!oordeel.mag) {
      schaduw.zouSluiten++;
      if (schaduw.paden.length < 20) schaduw.paden.push(pad);
    }
    return { mag: AFDWINGEN() ? oordeel.mag : true, oordeel,
      schaduw: !oordeel.mag && !AFDWINGEN() };
  }

  async function voerUit(req, t, { wereld, kaartVraag, paden, acties }) {
    if (t.name === 'plan') {
      /* Wegen, niet doen. De compiler krijgt de rol mee en raakt niets aan; wat
         hij teruggeeft is een oordeel dat het model aan de gebruiker kan
         voorlezen voordat er een voorstel ontstaat.

         Het plan en de gevolgvoorspelling reizen SAMEN terug maar zijn twee
         dingen: ./plan.js weegt de bevoegdheid, ./gevolg.js zegt uit een eerdere
         meting wat de stappen aanraakten. Het plan bezit de voorspelling niet
         (EXECUTIE.md blok 3: PLAN bezit niets). */
      const gewogen = compileer(t.input || {}, wereld);
      const uit = Object.assign({}, gewogen, { gevolg: voorspel(gewogen) });
      acties.push({ pad: 'plan', status: uit.uitvoerbaar ? 200 : 409, gevraagd: true });
      return uit;
    }

    if (t.name === 'kaart') {
      const toegestaan = paden();
      const uit = (t.input && t.input.alles)
        ? { paden: toegestaan, versmald: false, reden: 'De volledige lijst voor deze rol, op verzoek.' }
        : resolveer(kaartVraag, toegestaan);
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
          voorbeelden: schaduw.paden.slice(0, 8), afdwingen: AFDWINGEN(),
          wat: 'wat de herkomstpoort zou hebben gesloten; hij telt en houdt niets tegen ' +
            'zolang RTG_HERKOMST_AFDWINGEN niet op 1 staat' };
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

    const uit = await stuurRoep(req, pad, (t.input || {}).body, { wereld });
    acties.push({ pad, status: uit.status,
      goedkeuring: uit && uit.goedkeuring ? uit.goedkeuring : undefined });
    /* MELDEN VOOR HET ANTWOORD HET GESPREK IN GAAT. Zie de kop: erna is de
       eerste besmette beurt gratis. */
    vuil.meldToolantwoord(pad);
    return uit;
  }

  return { voerUit, schaduw: () => Object.assign({}, schaduw, { paden: schaduw.paden.slice() }) };
};
