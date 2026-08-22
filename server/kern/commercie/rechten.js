/* WAT MAG DEZE PARTIJ NU ECHT?

   DE VRAAG DIE NIEMAND IN EEN KEER KON BEANTWOORDEN. Het antwoord ligt sinds dit
   traject op zes plekken: de trede (./pasladder), wat die trede bevat
   (./capaciteiten), welk abonnement de zaak werkelijk draagt (./zaakabonnement),
   wat het contract zegt (./contract), welke regels vandaag afdwingen en welke
   nog meelopen (./schaduw), en wat er aan AI-tegoed over is (./tegoed). Wie dat
   met de hand samenstelt, doet het een keer goed en daarna niet meer.

   HET INTERESSANTSTE VERSCHIL DAT DIT BORD LAAT ZIEN:

       NOMINAAL   wat het productprofiel zegt
       EFFECTIEF  wat er vandaag werkelijk gebeurt

   Die twee lopen uiteen zodra een handhavingsregel in de SCHADUW staat. Een zaak
   op Business Lite heeft nominaal geen governance -- en krijgt het vandaag toch,
   omdat die regel nog meeloopt en niemand tegenhoudt. Dat is geen fout: het is
   een besluit (zie ./schaduw.js). Maar het is wel iets dat je moet KUNNEN ZIEN,
   want anders staat er in de verkooppraatjes iets anders dan in de deur.

   Precies dat gat -- de belofte tegenover de handhaving -- is waar dit hele
   traject mee begon.

   WAT DIT NIET IS: een plek waar rechten ontstaan of veranderen. Alles hier is
   LEZEN. Er is geen enkele functie die iets zet, en dat is met opzet: een bord
   dat ook knoppen heeft, wordt gebruikt om te sturen, en dan is er een zevende
   plek waar rechten vandaan komen in plaats van een die ze samenvat. */
'use strict';

const ladder = require('../pasladder');
const caps = require('./capaciteiten');
const routepoort = require('./routepoort');
const { TERUGVAL } = require('./zaakabonnement');
const { MODUS } = require('./schaduw');

/* De handhavingsstand per capability. Zonder schaduwlaag is het antwoord
   "onbekend" en niet "afgedwongen": doen alsof een regel bijt terwijl je het
   niet kunt nakijken, is precies de soort zekerheid die dit huis niet wil. */
function handhavingVan(schaduw) {
  const uit = {};
  for (const r of routepoort.regels()) {
    if (!schaduw) { uit[r.cap] = { modus: null, bekend: false }; continue; }
    const st = schaduw.stand(r.id);
    uit[r.cap] = { modus: st.modus, bekend: true, vrijgesteld: !!st.vrijstelling,
      waarnemingen: st.waarnemingen, zouTegenhouden: st.zouTegenhouden };
  }
  return uit;
}

/* Een capability, van drie kanten bekeken. `nominaal` is wat het product zegt,
   `handhaving` of er iets is dat het afdwingt, en `effectief` wat er vandaag
   werkelijk gebeurt -- dat laatste is het enige getal dat een klant merkt. */
function regelVoor(pas, cap, handhaving) {
  const nominaal = caps.mag(pas, cap);
  const h = handhaving[cap] || { modus: null, bekend: false };

  /* DIT BORD KENT MAAR EEN SOORT HANDHAVING: de abonnementspoort
     (./routepoort.js). Vier van de acht capabilities worden daar bewaakt; de
     andere vier hebben hun poort ELDERS -- can_use_ai in ./tegoed.js,
     can_be_partner in ./zaakabonnement.js en routes/member/partnerkanaal.js,
     can_use_lifestyle_service in routes/member/lifestyle.js,
     can_use_dedicated_support in routes/supplier/abonnement.js.

     Die zou dit bord "onbewaakt" noemen als het alleen naar de routepoort keek,
     en dat is erger dan niets zeggen: een vals alarm dat vier keer per bord
     afgaat, leert iedereen om de kolom te negeren. Vandaar `handhaving: 'elders'`
     en een `onbewaakt` die ALLEEN gaat over regels die hier horen te bewaken en
     het vandaag niet doen. Welke capability waar wordt gevraagd, is machinaal na
     te lopen met scripts/capabilities.js -- dat is het register, niet dit bord. */
  const heeftPoortHier = h.bekend;
  const bewaakt = heeftPoortHier ? h.modus === MODUS.AFDWINGEN : null;   // null = elders, niet nee
  const meeloopt = heeftPoortHier && h.modus === MODUS.SCHADUW;
  const effectief = nominaal || (heeftPoortHier && (meeloopt || h.modus === MODUS.UIT));
  return { cap, uitleg: caps.CAPS[cap], nominaal, effectief, bewaakt,
    handhaving: heeftPoortHier ? h.modus : 'elders',
    /* De zin die er werkelijk toe doet staat erbij, en alleen als er iets aan de
       hand is. Een rij die altijd een opmerking draagt, wordt niet meer gelezen. */
    let: (!nominaal && effectief)
      ? (meeloopt
        ? 'Het product zegt nee, maar de regel loopt nog mee en houdt niemand tegen.'
        : 'Het product zegt nee, maar de regel staat uit.')
      : null };
}

function maakRechten({ zaakAbonnement, schaduw, tegoed, contracten }) {

  /* HET BORD VOOR EEN ZAAK. `code` is de zaakcode; deze laag zoekt de zaak niet
     op, want zij hoort de leverancierstabel niet te kennen. */
  function voorZaak(code) {
    const abo = zaakAbonnement ? zaakAbonnement.van(code)
      : { code, pas: TERUGVAL, herkomst: 'voor-de-ladder', sinds: null, contractId: null };
    const trede = ladder.trede(abo.pas) || {};
    const handhaving = handhavingVan(schaduw);
    const regels = Object.keys(caps.CAPS).map(c => regelVoor(abo.pas, c, handhaving));

    return {
      soort: 'zaak', code: String(code || '').toUpperCase(),
      pas: abo.pas, pasNaam: trede.naam || abo.pas,
      /* DE HERKOMST HOORT VOORAAN. Een zaak op de terugval draagt geen
         vastgelegd besluit, en dat is iets anders dan een zaak die bewust op
         Business staat -- ook al mogen ze precies hetzelfde. */
      herkomst: abo.herkomst, sinds: abo.sinds || null,
      contract: contractVan(abo.contractId),
      rechten: regels,
      /* De twee getallen die je hier wilt zien zonder te tellen. */
      afwijkend: regels.filter(r => r.nominaal !== r.effectief).map(r => r.cap),
      /* Alleen regels die HIER horen te bewaken en het vandaag niet doen. Zie
         regelVoor(): `bewaakt === null` betekent "elders" en is geen gat. */
      onbewaakt: regels.filter(r => r.nominaal && r.bewaakt === false).map(r => r.cap),
      aiTegoed: tegoedVan(code, abo.pas)
    };
  }

  /* HET BORD VOOR EEN LID. Een lid draagt geen zaakabonnement; zijn trede komt
     van zijn pas. Verder dezelfde drie kolommen, zodat er een taal is en niet
     twee. */
  function voorLid(pas, houder) {
    const trede = ladder.trede(pas) || {};
    const handhaving = handhavingVan(schaduw);
    const regels = Object.keys(caps.CAPS).map(c => regelVoor(pas, c, handhaving));
    return {
      soort: 'lid', pas: String(pas || ''), pasNaam: trede.naam || pas,
      herkomst: 'pas', contract: null,
      rechten: regels,
      afwijkend: regels.filter(r => r.nominaal !== r.effectief).map(r => r.cap),
      onbewaakt: regels.filter(r => r.nominaal && r.bewaakt === false).map(r => r.cap),
      aiTegoed: houder ? tegoedVan(houder, pas) : null
    };
  }

  function contractVan(id) {
    if (!id || !contracten || !contracten.vind) return null;
    try {
      const c = contracten.vind(id);
      if (!c) return null;
      return { id: c.id, status: c.status, afgesprokenCenten: c.afgesprokenCenten,
        prijsVastTot: c.prijsVastTot || null, eindigtOp: c.eindigtOp || null };
    } catch (e) { return null; }
  }

  function tegoedVan(houder, pas) {
    if (!tegoed || !tegoed.stand) return null;
    try { return tegoed.stand(houder, pas); } catch (e) { return null; }
  }

  /* WAAR LOPEN BELOFTE EN HANDHAVING UIT ELKAAR, over alle zaken heen? Dit is
     het getal waar dit hele traject mee begon: "0% commissie" naast een
     commissieknop op 12 procent. `zaakCodes` komt van de aanroeper. */
  function scheuren(zaakCodes) {
    const uit = [];
    for (const code of (zaakCodes || []).slice(0, 2000)) {
      const b = voorZaak(code);
      if (b.afwijkend.length) uit.push({ code: b.code, pas: b.pas, afwijkend: b.afwijkend });
    }
    const handhaving = handhavingVan(schaduw);
    return { aantal: uit.length, zaken: uit.slice(0, 200),
      /* En de regels zelf, want een scheur die over ALLE zaken loopt is geen
         zaakprobleem maar een regel die nog niet afdwingt. */
      regels: Object.entries(handhaving)
        .filter(([, h]) => h.bekend && h.modus !== MODUS.AFDWINGEN)
        .map(([cap, h]) => ({ cap, modus: h.modus, waarnemingen: h.waarnemingen })) };
  }

  return { voorZaak, voorLid, scheuren, handhavingVan: () => handhavingVan(schaduw) };
}

module.exports = { maakRechten, regelVoor, handhavingVan };
