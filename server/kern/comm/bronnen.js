/* ============== DE BRONNEN: wat er al was, in dezelfde inbox ==============

   De kern (./index.js) is het model waar alles naartoe hoort. Maar er staan al
   gesprekken in dit huis die er niet in zitten: de Berichtenbox van
   MijnOverheid en het doorlopende gesprek met Rahul zelf. Die staan in hun
   eigen voorraden, met hun eigen vorm, en ze zijn niet stuk -- ze horen alleen
   thuis in dezelfde lijst.

   DIT BESTAND IS GEKROMPEN, EN DAT IS DE BEDOELING. Er stonden er vier: het
   gastcontact met een zaak en de sollicitatiechat zijn inmiddels echt verhuisd
   (./gast.js, ./werk.js) en dus hier weg; de collegachat en de priveberichten
   hebben hier om dezelfde reden nooit gestaan. Wat overblijft zijn twee
   bronnen die je alleen LEEST -- en dat blijft waarschijnlijk zo: officiele
   post is eenrichtingsverkeer en Rahul heeft zijn eigen scherm.

   TWEE MANIEREN OM DAT OP TE LOSSEN, en de keuze is hier belangrijk.

   Je kunt ze MIGREREN: alles overzetten naar het nieuwe model en de oude
   voorraad opruimen. Dat is waar het naartoe moet, en voor de priveberichten
   tussen leden is het ook precies wat er gebeurd is (zie sociaal/vrienden:
   die schrijven nu in de kern). Maar migreren van vier voorraden tegelijk,
   elk met een eigen module die er ook nog in schrijft, is vier keer de kans
   om berichten kwijt te raken in een ronde waarin niemand dat merkt totdat
   iemand iets terugzoekt.

   Of je kunt ze LEZEN waar ze staan, en ze in de inbox laten meelopen als wat
   ze zijn: gesprekken met een soort, een titel en een laatste regel, met een
   weg naar de app waar ze wonen. Dat is wat hier gebeurt. Het is eerlijk over
   wat het is -- deze gesprekken zijn nog niet van de kern, en dat zie je ook:
   je leest ze hier, je beantwoordt ze daar.

   Zo is de Universal Inbox vanaf dag een waar, zonder dat er een migratie
   nodig is die niemand durft te doen. Elke bron die later wel overgaat,
   verdwijnt gewoon uit dit bestand.

   REGEL: een bron SCHRIJFT NIET ZELF. Hij mag wel een bericht DOORGEVEN aan
   de module die de voorraad beheert -- en dat verschil is het hele punt. Een
   sollicitatiechat beantwoorden gaat via de werk-module, met haar eigen
   controles (is dit jouw sollicitatie?), haar eigen vertaallaag en haar eigen
   melding aan de werkgever. Dit bestand kopieert daar niets van; het roept aan.

   Zonder dat doorgeven was de ene app voor deze kanalen weer een leeslijst:
   je zag dat er iets lag en werd naar een andere app gestuurd om te antwoorden
   -- precies wat er hiervoor mis was. Met een eigen schrijfweg zou hij de
   tweede schrijver op een voorraad zijn, en dat is de splitsing die we aan het
   opheffen zijn. Doorgeven is de enige vorm die allebei vermijdt. */
'use strict';

const MAX_PER_BRON = 40;

function maakBronnen({ db, codenaamVan, convOf, overheid, rtmail }) {
  const snij = (t, n) => String(t == null ? '' : t).slice(0, n || 140);

  /* Elke bron levert dezelfde vorm als comm.toonGesprek(), plus `extern: true`
     zodat de app weet dat hier gelezen en niet geantwoord wordt. De id draagt
     zijn herkomst (`bron:...`), want een id uit de kern en een id uit een bron
     mogen nooit door elkaar lopen. */
  function rij(o) {
    return {
      id: 'bron:' + o.id, extern: true, soort: o.soort, lade: o.lade,
      titel: o.titel, deelnemers: [], aantal: 2,
      laatste: snij(o.laatste), laatsteVanMij: false,
      at: o.at || null, ongelezen: o.ongelezen || 0,
      vast: false, stil: false, weg: false, concept: null, online: false,
      bron: o.bronnaam, link: o.link
    };
  }

  /* 1. Rahul zelf. Het doorlopende gesprek in de leden-app is het enige
        gesprek dat iedereen heeft, en het hoort dus ook gewoon in de lijst --
        niet als los icoon ergens anders. */
  function rahul(mij, account) {
    if (!account || !convOf) return [];
    let laatste = null;
    try {
      const conv = convOf(account.id) || [];
      laatste = conv[conv.length - 1] || null;
    } catch (e) { return []; }
    return [rij({
      id: 'rahul', soort: 'ai', lade: 'rahul', titel: 'Rahul',
      laatste: laatste ? snij(laatste.text) : 'Stel me gerust een vraag.',
      at: laatste ? laatste.at : null, bronnaam: 'Rahul', link: '/apps/app.html'
    })];
  }

  /* 2. De Berichtenbox van MijnOverheid. Officiele post, en die hoort zichtbaar
        te zijn zonder dat je een aparte app opent om te ontdekken dat er iets
        ligt. */
  function overheidBox(mij) {
    if (!overheid) return [];
    try {
      const box = overheid.berichten(mij) || {};
      const eerste = (box.berichten || [])[0];
      if (!eerste) return [];
      return [rij({
        id: 'overheid', soort: 'government', lade: 'officieel',
        titel: 'Berichtenbox (MijnOverheid)', laatste: eerste.titel,
        at: eerste.at, ongelezen: box.ongelezen || 0,
        bronnaam: 'Overheid', link: '/apps/overheid.html'
      })];
    } catch (e) { return []; }
  }

  /* 3. DE SOLLICITATIECHAT STOND HIER, EN IS WEG -- ook verhuisd.

        Hij woont sinds kern/comm/werk.js in de kern, met de zaak als
        deelnemer en de sollicitant (een lid of een gezinsprofiel) ertegenover.
        Hij komt dus al via comm.inbox() binnen; hier ook nog eens zou hem
        dubbel in de lijst zetten. */

  /* 4. HET GASTCONTACT STOND HIER, EN IS WEG -- want het is verhuisd.

        De lijn tussen een lid en een zaak woont sinds kern/comm/gast.js in de
        kern zelf: een echt gesprek, met de zaak als deelnemer. Hij komt dus al
        via comm.inbox() binnen, en zou hij hier OOK nog als bron staan, dan
        stond elke gastchat twee keer in de lijst -- een keer echt en een keer
        als kopie van dezelfde voorraad, met een ander id en een eigen teller.

        Dat is precies wat de kop van dit bestand belooft: "elke bron die later
        wel overgaat, verdwijnt gewoon uit dit bestand." Dit is de eerste. */

  /* Alles bij elkaar. De volgorde doet er niet toe -- de inbox sorteert zelf
     op tijd -- maar de bronnen wel: valt er een om, dan vallen de andere niet
     mee. Vandaar dat elke bron zijn eigen try/catch heeft en een lege lijst
     teruggeeft in plaats van de hele inbox mee te slepen. */
  function alles(mij, account) {
    return [].concat(rahul(mij, account), overheidBox(mij));
  }

  /* ---------------- openen: alleen nog LEZEN ----------------

     Hier stond het doorgeven naar de module die een bron beheerde: de app
     kreeg te horen WAAR een antwoord heen moest ('/api/member/apply/chat/send'
     bijvoorbeeld) en postte daar rechtstreeks naartoe. Dat was de goede vorm
     zolang die voorraden nog buiten de kern stonden.

     Ze staan er niet meer. Het gastcontact en de sollicitatiechat zijn allebei
     echt verhuisd (./gast.js, ./werk.js) en komen nu als gewoon gesprek uit de
     kern. Wat overblijft zijn twee bronnen die je alleen kunt LEZEN, en dat is
     geen tekortkoming: officiele post van de overheid is eenrichtingsverkeer,
     en Rahul heeft zijn eigen scherm. Een invoerveld tonen bij iets waar je
     niet op kunt antwoorden is erger dan geen invoerveld. */
  function ontleed(bronId) {
    const kaal = String(bronId || '').replace(/^bron:/, '');
    const i = kaal.indexOf(':');
    return { soort: i < 0 ? kaal : kaal.slice(0, i), sleutel: i < 0 ? '' : kaal.slice(i + 1) };
  }
  const open = () => null;

  return { alles, open, ontleed };
}

module.exports = { maakBronnen };
