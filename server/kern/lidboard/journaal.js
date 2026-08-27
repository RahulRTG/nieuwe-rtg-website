/* Boardroom van het lid, deel "journaal": wie zette wat om, wanneer, waarvandaan.

   Waarom dit bestaat. Op dit bord staan de knoppen die bepalen of je locatie
   gedeeld wordt, of je paspoort opvraagbaar is, of je vindbaar bent en of je
   berichten kunt ontvangen. Een ouder mag bovendien het bord van zijn
   beschermde kind bijsturen. Een schakelaar met die reikwijdte zonder spoor is
   geen instelling maar een blinde vlek: "stond dat altijd al uit?" en "wie heeft
   dat aangezet?" zijn dan onbeantwoordbaar -- ook voor de eigenaar zelf, ook na
   een incident, en ook als de AVG erom vraagt (art. 15).

   Twee regels, in dezelfde geest als het inzagejournaal (server/inzagelog.js):

   1. HET JOURNAAL BEWAART GEEN IDENTITEIT DIE ER NIET AL WAS. Er staat WAT er
      omging, VAN welke stand NAAR welke, DOOR wie (in rol: 'lid' of 'ouder') en
      VANWAAR (het scherm/de route). Geen namen, geen e-mailadressen: dit
      journaal mag zelf nooit een tweede kluis worden.

   2. HET JOURNAAL IS VAN DE BETROKKENE. Het lid leest zijn eigen journaal; het
      gaat mee in zijn AVG-export. Het is geen beheerdersinstrument dat achter
      zijn rug om meekijkt.

   Begrensd op MAX regels per boardroom: loopt hij vol, dan valt de oudste eraf.
   Zonder grens groeit een enkel bord ongelimiteerd en zou een lus met
   schakelverzoeken de opslag kunnen laten vollopen.

   3. AAN DE HASHKETEN. De twee vragen waarvoor dit journaal bestaat -- "stond
      dat altijd al uit?" en "wie heeft dat aangezet?" -- zijn precies zoveel
      waard als de zekerheid dat er niemand achteraf aan gesleuteld heeft. Elke
      regel draagt daarom de hash van zijn voorganger. Wat dat wel en niet
      tegenhoudt staat in de kop van ../../lib/keten.js.

      De keten loopt PER BOARDROOM, want zo is dit journaal opgeslagen: een
      lijst per lid. Dat past ook bij regel 2 -- wissen op verzoek van de
      betrokkene haalt zijn hele lijst weg en laat geen gat in andermans
      keten. */

const MAX = 200;

const { noteerIn: ketenNoteerIn, verifieer: ketenVerifieer, top: ketenTop } = require('../../lib/keten');

function maakJournaal({ db, save }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/lidboard/journaal', bezit: { ledenBoardLog: 'kaart' } });
  function store() {
    return eigen.bak('ledenBoardLog');
  }
  const kort = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  /* Noteer een of meer omzettingen als EEN handeling. Een bulk-actie ("alles
     uit", "terug naar standaard") is voor de lezer een gebeurtenis, geen
     eenentwintig; zo blijft het journaal leesbaar. */
  function noteer(sleutel, wijzigingen, { door, bron } = {}) {
    const lijst = (Array.isArray(wijzigingen) ? wijzigingen : []).filter(w => w && w.id);
    if (!sleutel || !lijst.length) return null;
    const s = store();
    if (!Array.isArray(s[sleutel])) s[sleutel] = [];
    const r = {
      /* WIENS JOURNAAL DIT IS, IN DE REGEL ZELF.

         De keten bindt alleen wat er in de regel staat. Stond de boardroom er
         niet in, dan zijn twee regels met dezelfde inhoud in dezelfde
         milliseconde letterlijk identiek -- inclusief hun hash -- en is een
         regel onopgemerkt van het ene lid naar het andere te verplaatsen. Dat
         is precies het soort verschuiving waarvoor dit journaal bestaat: "wie
         heeft dat aangezet?" mag niet te beantwoorden zijn met de regel van een
         ander. Zo gevonden, door de toets die twee leden vergeleek.

         Dit voegt geen gegeven toe dat er niet al was: de sleutel IS de plek
         waar deze lijst onder staat. Hij wordt hier alleen expliciet, zodat de
         hash hem dekt. */
      boardroom: String(sleutel),
      at: new Date().toISOString(),
      door: door === 'ouder' ? 'ouder' : 'lid',
      bron: kort(bron, 60) || 'boardroom',
      wijzigingen: lijst.slice(0, 40).map(w => ({
        id: kort(w.id, 40), naam: kort(w.naam, 60),
        van: w.van === true, naar: w.naar === true
      }))
    };
    const geschreven = ketenNoteerIn(s[sleutel], r, MAX);
    if (save) { try { save(); } catch (e) { /* de schakeling zelf is al bewaard */ } }
    return geschreven;
  }

  /* De ketenstand van één boardroom-journaal: klopt dit spoor nog met zichzelf?
     Het lid kan dit over zijn eigen journaal opvragen -- het journaal is van hem,
     dus de controle erop ook. */
  function keten(sleutel) {
    const s = store();
    const l = Array.isArray(s[sleutel]) ? s[sleutel] : [];
    return Object.assign({ top: ketenTop(l) }, ketenVerifieer(l));
  }

  /* Het journaal van een boardroom, nieuwste eerst. */
  function lijst(sleutel, max) {
    const s = store();
    const l = Array.isArray(s[sleutel]) ? s[sleutel] : [];
    return l.slice(0, Math.min(Number(max) || 50, MAX));
  }

  /* Bij "verwijder mijn gegevens" moet ook dit spoor weg: het gaat over de
     betrokkene en hoort niet achter te blijven als de rest is gewist. */
  function wis(sleutel) {
    const s = store();
    if (!s[sleutel]) return false;
    delete s[sleutel];
    if (save) { try { save(); } catch (e) {} }
    return true;
  }

  return { noteer, lijst, wis, keten, MAX };
}

module.exports = { maakJournaal, MAX };
