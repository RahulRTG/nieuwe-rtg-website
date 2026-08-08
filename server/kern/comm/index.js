/* ==================== RTG COMMUNICATION CORE ====================

   EEN GESPREK IS EEN GESPREK, WAAR HET OOK VANDAAN KOMT.

   Wat hier veranderde. Dit huis had zes berichtenvoorraden naast elkaar --
   db.data.memberChats (vrienden), applyChats (sollicitaties), guestChats
   (gast en zaak), collegaChats (werkvloer), podiumChat en rijkBerichten
   (overheid) -- en elke module die er een gesprek bij wilde, bouwde de
   zevende. Elk met een eigen berichtvorm, een eigen verstuurroute, een eigen
   leesstand, en geen van alle met zoiets gewoons als een reactie, een
   antwoord-op of een correctie. De Berichten-app was daarbovenop een LEESLIJST
   die naar de bron-app doorverwees: hij kon tonen dat er iets was, en verder
   niets.

   Dat is de fout die je maar een keer moet maken. Een chatfunctie per module
   betekent dat "verwijderen voor iedereen", "gelezen op dit apparaat" of
   "zoeken over alles" zes keer gebouwd en zes keer net anders wordt -- en dat
   de zevende module weer bij nul begint.

   Dus: communicatie is hier INFRASTRUCTUUR, geen functie. Er is een
   gesprekmodel, een berichtmodel en een standenmodel, en elke module vraagt
   het aan deze kern:

       comm.gesprekMaak({ soort: 'ride', deelnemers: [chauffeur, reiziger],
                          titel: 'Rit RT-1941', meta: { sleutel: 'rit:RT-1941' } })

   Taxi bouwt dus geen berichtenbackend. Horeca ook niet. School ook niet.

   HET SOORT IS DE CONTEXT, en dat is meer dan een etiket: het bepaalt in welke
   la van de inbox het gesprek valt en welke regels erop staan. De twaalf staan
   in SOORTEN hieronder en zijn bewust een gesloten lijst -- een vrij tekstveld
   was binnen een maand een verzameling spelfouten geweest.

   DRIE REGELS DIE HET ONTWERP STUREN, en die verderop worden afgedwongen en
   niet alleen beschreven:

   1. ALLES OP CODENAAM. Deze kern kent sleutels en codenamen, nooit echte
      namen; die staan in de gescheiden kluis (accounts.js) en komen hier niet
      langs. Ook niet in een titel, ook niet in een zoekindex.
   2. WIE ER NIET IN ZIT, LEEST NIET MEE. Elke leesweg loopt langs magErin().
      Een gesprek-id raden mag nooit genoeg zijn.
   3. DE AI STELT OP, DE MENS VERSTUURT. Deze kern heeft geen enkele weg waarop
      een model zelf een bericht plaatst; @Rahul levert tekst terug (zie ./ai)
      en die belandt in het invoerveld. Dezelfde drempel als bij geld.

   EEN DEELNEMER IS NIET PER SE EEN LID. In `deelnemers` staan sleutels, en
   sinds ./wie.js kan zo'n sleutel ook een zaak zijn ('zaak:AB12'), een
   medewerker ('mens:AB12:7') of het kantoor. Dat is wat de laatste voorraden
   ontsluit -- het gastcontact, de collega-DM, de sollicitatie stonden niet
   apart omdat ze anders waren, maar omdat de andere kant van het gesprek geen
   naam had in dit model. Deze kern verandert er nauwelijks door: de poort is
   nog steeds de deelnemerslijst, en die kent alleen sleutels. Wie zo'n sleutel
   MAG dragen, wordt beantwoord waar de sessie is (routes/supplier/comm.js) en
   niet hier.

   WAT HIER (NOG) NIET IN ZIT, zodat niemand het hier gaat zoeken: end-to-end
   encryptie, rollen en rechten binnen een zaak (RBAC), legal hold, eDiscovery
   en de publieke API voor externe ontwikkelaars. Die horen in dit model thuis
   -- het is er ook op gebouwd, zie meta en het feit dat elk bericht een
   gesprek met een soort heeft -- maar ze staan er niet. Een half aangezette
   compliance-laag is gevaarlijker dan een afwezige. Het retentiebeleid staat
   er sinds de verhuizing wel (server/bewaarbeleid.js).
   ================================================================ */
'use strict';

/* De twaalf contexten. Een gesprek hoort bij precies een van deze, en de
   inbox groepeert erop. `personal` en `group` zijn de gewone menselijke
   gesprekken; de rest komt uit een module en draagt in meta.bron mee waar
   vandaan. */
const SOORTEN = ['personal', 'group', 'business', 'order', 'ride', 'school',
  'project', 'support', 'marketplace', 'government', 'event', 'ai'];

/* De laden van de inbox: welke soorten onder welke kop vallen. Dit is de
   "Universal Inbox" uit een gebruikersoogpunt -- Chats > Mobiliteit > Rit
   #RT-1941 -- terwijl het technisch allemaal gesprekken blijven. */
const LADEN = [
  { id: 'mensen', naam: 'Mensen', soorten: ['personal', 'group'] },
  { id: 'zaken', naam: 'Zaken', soorten: ['business', 'project', 'marketplace'] },
  { id: 'onderweg', naam: 'Onderweg', soorten: ['ride', 'order', 'event'] },
  { id: 'officieel', naam: 'Officieel', soorten: ['government', 'school', 'support'] },
  { id: 'rahul', naam: 'Rahul', soorten: ['ai'] }
];

const MAX_TEKST = 4000;         // een bericht is een bericht, geen document
const MAX_PER_GESPREK = 500;    // wat we per gesprek bewaren
const MAX_GESPREKKEN = 400;     // per lid, in de inbox
const MAX_DEELNEMERS = 256;
/* De grenzen die van de MENS zijn (een kwartier corrigeren, een por per
   minuut) staan bij de handelingen zelf: ./deelnemer.js. */

const wie = require('./wie');
const { maakTonen } = require('./tonen');
const { maakDeelnemer } = require('./deelnemer');

function maakComm({ db, save, crypto, codenaamVan, naamVan, sein, sseToCustomer }) {
  const nu = () => new Date().toISOString();
  const id = (p) => p + '_' + crypto.randomBytes(8).toString('hex');

  /* Een deelnemer heet bij zijn naam en nooit bij zijn sleutel. Welke naam dat
     is, hangt af van wat voor actor het is (./wie.js): een lid draagt zijn
     codenaam, een zaak zijn zaaknaam. Staat er geen naamVan opgehangen, dan is
     dit precies de oude regel -- alleen leden hebben een naam. */
  const noem = (key) => {
    const f = naamVan || codenaamVan;
    return (f ? f(key) : null) || null;
  };

  /* ---------------------------------------------------------- opslag */
  function G() {
    if (!Array.isArray(db.data.commGesprekken)) db.data.commGesprekken = [];
    return db.data.commGesprekken;
  }
  function B() {
    if (!db.data.commBerichten || typeof db.data.commBerichten !== 'object') db.data.commBerichten = {};
    return db.data.commBerichten;
  }
  function S() {
    if (!db.data.commStand || typeof db.data.commStand !== 'object') db.data.commStand = {};
    return db.data.commStand;
  }
  const standVan = (key, gid) => ((S()[key] || {})[gid] || {});
  function standZet(key, gid, veld, waarde) {
    const s = S();
    const rij = s[key] = s[key] || {};
    const st = rij[gid] = rij[gid] || {};
    if (waarde === null || waarde === false || waarde === '') delete st[veld];
    else st[veld] = waarde;
    if (!Object.keys(st).length) delete rij[gid];
    return st;
  }

  /* -------------------------------------------------------- toegang */
  const gesprekVan = (gid) => G().find((g) => g.id === gid) || null;
  const magErin = (g, key) => !!(g && Array.isArray(g.deelnemers) && g.deelnemers.includes(key));
  /* Elke leesweg loopt hierlangs. Geen enkele functie hieronder haalt een
     gesprek op zonder deze poort -- een id raden mag nooit genoeg zijn. */
  function eis(gid, key) {
    const g = gesprekVan(gid);
    if (!g) throw new Error('Dit gesprek bestaat niet.');
    if (!magErin(g, key)) throw new Error('Dit gesprek is niet van jou.');
    return g;
  }

  /* --------------------------------------------------- een gesprek maken */
  /* DE ENIGE MANIER waarop er een gesprek bij komt, en dus de plek waar elke
     module langskomt. Idempotent op meta.sleutel: een rit, een bestelling of
     een ticket vraagt bij elke stap opnieuw om "zijn" gesprek en hoort er dan
     niet elke keer een nieuw te krijgen. Zonder dat zou de taxi-module zelf
     moeten onthouden welk gesprek bij welke rit hoort -- en dan zit de
     koppeling weer in de module in plaats van hier. */
  function gesprekMaak(opties) {
    const o = opties || {};
    const soort = SOORTEN.includes(o.soort) ? o.soort : 'personal';
    const deelnemers = [...new Set((o.deelnemers || []).filter(Boolean).map(String))].slice(0, MAX_DEELNEMERS);
    if (deelnemers.length < 1) throw new Error('Een gesprek heeft deelnemers nodig.');
    const sleutel = o.meta && o.meta.sleutel ? String(o.meta.sleutel).slice(0, 120) : null;
    if (sleutel) {
      const bestaat = G().find((g) => g.meta && g.meta.sleutel === sleutel);
      if (bestaat) {
        /* Wie er later bij komt (een tweede chauffeur, een collega die de zaak
           overneemt) schuift gewoon aan. Wie eruit moet, gaat er niet vanzelf
           uit: dat is een handeling met gevolgen en hoort een eigen weg te
           hebben, niet een neveneffect van "maak dit gesprek nog eens". */
        for (const d of deelnemers) if (!bestaat.deelnemers.includes(d)) bestaat.deelnemers.push(d);
        save();
        return bestaat;
      }
    }
    const g = {
      id: id('gsp'), soort,
      titel: String(o.titel || '').slice(0, 120) || null,
      deelnemers, door: o.door || deelnemers[0],
      op: nu(), laatst: nu(),
      meta: Object.assign({}, o.meta || {})
    };
    G().push(g);
    B()[g.id] = [];
    save();
    return g;
  }

  /* Het gesprek van een module OPZOEKEN zonder het te maken. gesprekMaak() is
     idempotent op meta.sleutel en dus verleidelijk om ook als opzoeker te
     gebruiken -- maar dan MAAKT een leesvraag een gesprek, en een module die
     "bestaat deze lijn?" vraagt krijgt altijd ja. Dat is geen detail: bij het
     gastcontact hing er een controle aan ("alleen inzage als er echt een lijn
     is"), en die viel om zodra de vraag zelf de lijn aanlegde. */
  const gesprekMetSleutel = (sleutel) =>
    (sleutel ? G().find((g) => g.meta && g.meta.sleutel === String(sleutel)) : null) || null;

  /* Het een-op-een gesprek tussen twee leden is er precies een, welke kant je
     het ook opent. De sleutel is daarom de twee sleutels op alfabet -- zonder
     dat krijg je twee gesprekken die elkaars berichten niet zien, en dat is
     het soort fout dat pas opvalt als iemand zegt "ik heb je wel geantwoord". */
  function tussen(a, b, opties) {
    const paar = [String(a), String(b)].sort();
    return gesprekMaak(Object.assign({ soort: 'personal', deelnemers: paar,
      meta: { sleutel: 'paar:' + paar.join('|') } }, opties || {}));
  }

  /* ------------------------------------------------------ een bericht */
  function bericht(opties) {
    const o = opties || {};
    const g = eis(o.gesprekId, o.van);
    const tekst = String(o.tekst == null ? '' : o.tekst).slice(0, MAX_TEKST).trim();
    const bijlage = o.bijlage && typeof o.bijlage === 'object' ? o.bijlage : null;
    if (!tekst && !bijlage) throw new Error('Een leeg bericht versturen doet niets.');
    if (o.antwoordOp) {
      // antwoorden op een bericht uit een ander gesprek zou een citaat maken
      // van iets waar de lezer geen toegang toe heeft
      const bron = (B()[g.id] || []).find((m) => m.id === o.antwoordOp);
      if (!bron) throw new Error('Dat bericht staat niet in dit gesprek.');
    }
    const m = {
      id: id('brc'), van: o.van, at: nu(),
      /* Namens wie er geschreven wordt (`van`) en WIE het typte (`door`) zijn
         bij een zaak niet hetzelfde. Alleen ingevuld als het iemand uit
         dezelfde zaak is: `door` van een vreemde sleutel zou een manier zijn
         om een naam in andermans gesprek te zetten. */
      door: o.door && wie.zelfdeZaak(o.door, o.van) ? String(o.door) : null,
      tekst: tekst || null,
      soort: o.soort || (bijlage ? bijlage.soort || 'bijlage' : 'tekst'),
      antwoordOp: o.antwoordOp || null,
      bijlage: bijlage,
      /* De brontaal reist mee met het bericht en niet met de lezer. Dat lijkt
         een detail tot iemand van taal wisselt: dan moet een oud bericht nog
         steeds vertaald kunnen worden vanaf de taal waarin het GESCHREVEN is,
         en niet vanaf de taal die de schrijver vandaag toevallig heeft staan. */
      lang: o.lang || null,
      reacties: {}
    };
    const lijst = B()[g.id] = B()[g.id] || [];
    lijst.push(m);
    if (lijst.length > MAX_PER_GESPREK) lijst.splice(0, lijst.length - MAX_PER_GESPREK);
    g.laatst = m.at;
    // de afzender heeft zijn eigen bericht per definitie gelezen
    standZet(o.van, g.id, 'gelezen', m.at);
    standZet(o.van, g.id, 'concept', null);
    save();
    seinNaarDeRest(g, o.van, 'bericht', { gesprekId: g.id, bericht: tonen.toonBericht(m, o.van) });
    return m;
  }

  /* Iedereen behalve de afzender krijgt het sein. Wie het gesprek stil heeft
     gezet krijgt het OOK -- stil gaat over meldingen, niet over of het scherm
     bijwerkt; een gesprek dat pas na een verversing verandert voelt kapot.

     WELKE STROOM dat is, hangt af van wie de deelnemer is: een lid luistert op
     de ledenapp, een zaak op de leveranciersstroom. Die wissel staat in
     ./wie.js (maakSein) en niet hier, zodat er een plek is waar "waar woont
     deze actor" wordt beantwoord. Zonder `sein` valt de kern terug op de oude
     weg, en dan zijn alleen leden bereikbaar -- eerlijk, want dan zijn er ook
     geen actoren opgehangen. */
  const stuurSein = sein || (sseToCustomer
    ? (sleutel, event, data) => { if (wie.isLid(sleutel)) sseToCustomer(sleutel, event, data); }
    : null);
  function seinNaarDeRest(g, behalve, event, data) {
    if (!stuurSein) return;
    for (const d of g.deelnemers) {
      if (d === behalve) continue;
      try { stuurSein(d, 'comm', Object.assign({ soort: event }, data)); } catch (e) {}
    }
  }

  /* Twee deuren voor de verhuizing van een oude voorraad (./dm.js), en
     bewust smal: de geschiedenis moet MET zijn eigen tijdstempels naar binnen
     kunnen, en de leesstand moet meeverhuizen. Via bericht() zou alles op NU
     komen te staan -- een gesprek van twee jaar dat er ineens uitziet alsof
     het vanmiddag gebeurde. Wie niets te verhuizen heeft, gebruikt bericht(). */
  const berichtenVan = (gesprekId) => (B()[gesprekId] = B()[gesprekId] || []);
  function leesZet(key, gesprekId, at) {
    if (!key || !at) return;
    const nuStand = standVan(key, gesprekId).gelezen || '';
    if (at > nuStand) standZet(key, gesprekId, 'gelezen', at);
  }

  /* De twee andere helften krijgen de binnenkant mee en niet de db: zo is aan
     deze regels af te lezen wat ze precies mogen aanraken.

     ./deelnemer.js eerst, want ./tonen.js leunt op isAanwezig en wieTypt --
     "wie is er online" en "wie typt er" horen bij de handelingen en niet bij de
     weergave, maar de weergave laat ze wel zien. */
  const deelnemer = maakDeelnemer({
    B, eis, nu, save, seinNaarDeRest, standZet, standVan, noem, MAX_TEKST
  });
  const tonen = maakTonen({
    G, B, standVan, magErin, eis, noem,
    isAanwezig: deelnemer.isAanwezig, wieTypt: deelnemer.wieTypt,
    LADEN, MAX_GESPREKKEN
  });

  return {
    SOORTEN, LADEN,
    // voor andere modules: dit is de hele koppelvlakte
    gesprekMaak, tussen, bericht, gesprekVan, gesprekMetSleutel, magErin,
    berichtenVan, leesZet,
    // voor de app -- de leeskant uit ./tonen.js, de handelingen uit ./deelnemer.js
    inbox: tonen.inbox, gesprek: tonen.gesprek, zoek: tonen.zoek, draad: tonen.draad,
    lees: deelnemer.lees, vlag: deelnemer.vlag, concept: deelnemer.concept,
    wijzig: deelnemer.wijzig, wis: deelnemer.wis, reactie: deelnemer.reactie,
    levensteken: deelnemer.levensteken, isAanwezig: deelnemer.isAanwezig,
    typtNu: deelnemer.typtNu, wieTypt: deelnemer.wieTypt, nudge: deelnemer.nudge
  };
}

module.exports = { SOORTEN, LADEN, maakComm };
