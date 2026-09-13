/* Media OS (deelmodule): DE TIJDLIJN -- het momentregister en de Fan Inbox.

   WAAROM DIT EEN EIGEN BESTAND IS. De wekmotor (./wekken.js) is een MOTOR: hij
   leest wie er volgt en stuurt een bericht. Opslag hoort daar niet -- een motor
   die ook een collectie bezit, is twee dingen tegelijk -- en hij ging er
   bovendien over de 10 kB-grens mee. Hier woont `mediaMomenten`, met precies
   EEN schrijver, wat ook is wat regel 63 van de keuring eist.

   HET GAT DAT DIT DICHT (13 september 2026). Gevonden door schakel 5 van
   scripts/momentproef.js: `nieuwMoment` WEKTE wel en BEWAARDE niets. Een lid
   werd dus gewekt over een optreden en kon daarna nergens terugvinden waarover
   -- want een melding is in dit huis een WEK en geen link, en geen enkele
   `notify()` draagt een bestemming. Dat is precies de scheiding "moment is geen
   notificatie" uit STAGE.md par. 3, maar dan met de ene helft ontbrekend: de
   wek werkte, het FEIT werd niet vastgelegd.

   DE VORM DIE HIER GEKOZEN IS, en waarom hij geen tweede waarheid wordt.
   STAGE.md par. 2 is streng: de BRON bepaalt DAT iets gebeurd is, Stage bepaalt
   alleen hoe dat publieke feit in deze context wordt gepresenteerd. Een register
   dat de bron KOPIEERT is dus verboden -- dat is exact de fout die deze tak al
   twee keer maakte, toen de aanwezigheid van een zaak de naam van het festival
   droeg, en toen een club publiek `FCRTG` heette in plaats van FC RTG.

   Daarom deze scheiding, en zij is het hele ontwerp:

     WAT HIER STAAT is een GEBEURTENIS: dat op dit tijdstip deze aanwezigheid dit
     soort heeft uitgezonden, met de tekst die er TOEN bij hoorde. Een gebeurtenis
     is naar haar aard historisch; die tekst hoort niet mee te veranderen en is
     dus geen kopie maar een momentopname.

     WAT HIER NIET STAAT is alles wat LEEFT. De naam van de aanwezigheid wordt
     bij het LEZEN opgehaald uit ./aanwezigheid.js, zodat een club die hernoemt
     overal meteen goed staat. En er staat geen prijs, geen beschikbaarheid en
     geen stand van de bron in -- wie dat toevoegt, bouwt de tweede waarheid
     alsnog.

   DE FEED EN DE WEK ZIJN TWEE DINGEN, en dat is met opzet. Vastleggen gebeurt
   zodra de AANWEZIGHEID iets uitzendt; gewekt wordt alleen wie dat soort aan
   heeft staan (`meldVan` in ./wekken.js). Dus: de feed is de tijdlijn van de
   aanwezigheid, de wek is mijn meldingsvoorkeur. Wie ze samenvoegt, laat een lid
   zijn eigen geschiedenis kwijtraken door een vinkje uit te zetten. */
'use strict';

const MAX = 500;

module.exports = ({ db, save, aanwezig, SOORT_NAAM }) => {
  const namen = SOORT_NAAM || {};

  function M() {
    if (!db || !db.data) return [];
    if (!Array.isArray(db.data.mediaMomenten)) db.data.mediaMomenten = [];
    return db.data.mediaMomenten;
  }

  function leg(aanwezigheidId, soort, titel) {
    if (!db || !db.data) return null;
    const lijst = M();
    const m = { id: 'mo' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      aanwezigheid: String(aanwezigheidId), soort,
      titel: titel == null ? null : String(titel).slice(0, 120), at: new Date().toISOString() };
    lijst.push(m);
    /* Een plafond, en hij snijdt de OUDSTE weg. Zonder plafond groeit dit
       register ongelimiteerd mee met elke wedstrijd en elk optreden. */
    if (lijst.length > MAX) db.data.mediaMomenten = lijst.slice(-MAX);
    if (save) save();
    return m;
  }

  /* DE FAN INBOX: de momenten van de aanwezigheden die dit lid volgt.

     Hij leest de VOLGLIJST als filter en de aanwezigheid voor de naam -- dus wie
     ontvolgt, ziet die tijdlijn niet meer, en wie later weer volgt ziet hem
     terug. Dat is geen gat: de feed is een VENSTER op publieke tijdlijnen en
     geen persoonlijke postbus. Een echte postbus zou per lid moeten bewaren wat
     hij heeft gezien, en dat is een tweede register over dezelfde feiten. */
  function momentenVoor(key, grens) {
    if (!aanwezig) return { momenten: [], volgt: 0 };
    const mijn = aanwezig.aanwezigMijn(key) || [];
    const opId = new Map(mijn.map(a => [a.id, a]));
    const n = Math.min(Math.max(Number(grens) || 50, 1), 100);
    const uit = M().filter(m => opId.has(m.aanwezigheid)).slice(-n).reverse()
      .map(m => ({
        id: m.id, soort: m.soort, wat: namen[m.soort] || m.soort,
        titel: m.titel, at: m.at,
        aanwezigheid: m.aanwezigheid,
        /* LIVE opgehaald en niet meegeschreven -- zie de kop hierboven. */
        naam: (opId.get(m.aanwezigheid) || {}).naam || null
      }));
    return {
      momenten: uit, volgt: mijn.length,
      watDitNietDoet: 'Dit is een venster op de tijdlijnen die u volgt, geen postbus: er wordt niet bijgehouden wat u al heeft gezien, en er staat geen volgorde op populariteit.'
    };
  }

  return { leg, mediaMomentenVoor: momentenVoor };
};
