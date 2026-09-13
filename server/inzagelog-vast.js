/* HET SPOOR DAT KAN WEIGEREN -- de duurzame kant van het inzagejournaal.

   Los van ./inzagelog.js langs een naad in de BELOFTE. Daar staat het spoor dat
   write-behind wordt weggeschreven en dat 41 plekken vandaag nog gebruiken;
   hier staat het spoor dat pas terugkomt als de opslag het heeft BEVESTIGD, en
   dat kan zeggen dat hij dat niet kon. Twee beloftes over dezelfde regel, en
   juist daarom een gedeelde regelbouwer: die krijgt dit bestand aangereikt en
   maakt hij niet zelf -- een hashketen die twee soorten regels dekt, bewijst
   over geen van beide iets.
   ========================================================================== */
'use strict';

module.exports = ({ rij, zelf, schrijfRegel, veelOpdracht, heeftOpslag, vastlegger, bevestigbaar }) => {
  /* KAN DEZE OPSLAG DUURZAAMHEID AANTONEN? Dat is een andere vraag dan of de
     commit slaagde, en het verschil zat bijna verkeerd in dit bestand.

     `bijeen({duurzaam:true})` gooit alleen `if (uit.bevestigbaar && !uit.duurzaam)`
     (server/db/bijeen.js), en dat is de juiste keuze: een opslag die niet kan
     tellen mag geen transactie laten mislukken -- dat brak eerder vier
     geldtoetsen. Het gevolg is wel dat de commit op zo'n opslag SLAAGT zonder
     dat er iets is aangetoond. Zou `vast` dan toch `true` zijn, dan staat er een
     VALSE BEVESTIGING in precies het veld dat zegt hoe hard de regel zelf staat
     -- de fout waar dit hele bestand tegen is gebouwd, een laag dieper.

     Vandaar dat `vast` de UITSLAG volgt en niet het VOORNEMEN: op een opslag die
     het niet kan aantonen staat er `vast: false` met een reden. De inzage gaat
     daar wel gewoon door -- de weigering hangt aan de COMMIT en niet aan de
     bewijsbaarheid ervan, want anders zou een opslag zonder teller de hele balie
     sluiten. Zo staat er in het journaal wat er werkelijk over bekend is, en dat
     is bij een spoor het hele punt. */
  const kanBewijzen = () => {
    if (typeof bevestigbaar !== 'function') return true;
    try { return bevestigbaar() !== false; } catch (e) { return false; }
  };
  /* ============================================================================
     HET SPOOR DAT KAN WEIGEREN -- noteerVast()

     WAAROM DEZE ER NAAST noteer() STAAT, EN NIET IN PLAATS VAN.

     noteer() faalt OPEN, en niemand heeft dat gekozen. Hij geeft de weggeschreven
     regel terug en geen van de 42 aanroepende bestanden leest dat antwoord; het
     wegschrijven zit in een lege catch; en zonder database geeft rij() een VERSE
     ARRAY terug, zodat de regel in iets wordt gelegd dat meteen daarna wordt
     weggegooid -- met een geslaagde terugkeer. De inzage gaat daarna gewoon door.

     ERGER DAN EEN GENEGEERDE UITZONDERING IS EEN VALSE BEVESTIGING. Zelfs als
     SAVE() geen fout gooit, betekent dat niet dat er iets STAAT: save() in
     server/db/index.js zet binnen een bundel alleen een vlag, en in
     PostgreSQL-modus markeert hij dat de responsepoort later een commit moet
     doen. Succesvol terugkeren is daar geen bewijs. Daarom hangt deze functie aan
     de duurzame vastlegger en niet aan save(): `bevestigd` betekent hier dat de
     opslag het heeft BEVESTIGD, niet dat er geen fout kwam.

     DE REGEL DIE HIJ MOGELIJK MAAKT: GEEN AANTOONBAAR JOURNAAL, GEEN INZAGE. Deze
     functie beslist dat niet zelf -- zij levert een UITSLAG, en de aanroeper die
     de inzage doet, houdt hem tegen. Dat is met opzet: het journaal weet niet wat
     er zou worden getoond, en een poort die weigert zonder te weten waarover,
     weigert het verkeerde. Zie server/kern/ledenbalie.js voor de eerste aanroeper.

     WAT DE REGEL WEL EN NIET BEWEERT, en dit is de scherpste keuze in dit bestand.
     Er staat `stand: 'toegestaan'` en niet 'geleverd'. Het journaal legt vast dat
     aan deze medewerker op dit moment inzage is VERLEEND -- en dat is waar, ook
     als het samenstellen van het dossier daarna stukloopt. Zou er 'ingezien'
     staan, dan liegt het spoor bij elke mislukte lezing, en een spoor dat in het
     voordeel van het huis liegt is erger dan geen spoor. De andere kant op is het
     veilig: een lid dat leest dat iemand toegang kreeg terwijl er niets op zijn
     scherm verscheen, weet iets kloppends.

     WAAROM NIET ALLE 42 AANROEPERS IN EEN KEER OM. Omdat dat 42 keer dezelfde
     beslissing is die per plek anders kan uitvallen: bij een lijstscherm dat een
     naam laat zien is weigeren iets anders dan bij het openen van een
     identiteitskluis. Ze staan geteld in FAALPROEF.json en gaan per plek om, met
     de reden erbij. Wat hier is vastgelegd, is de VORM.
     ========================================================================== */
  async function noteerVast(opdracht = {}) {
    /* GEEN DATABASE IS GEEN JOURNAAL. Dit is de tak die noteer() stilletjes
       doorloopt: rij() geeft dan een verse array, de regel gaat erin, en het
       antwoord is een geslaagde regel over iets dat nergens staat. */
    if (!heeftOpslag()) {
      return { ok: false, status: 503, reden: 'geen-opslag',
        error: 'Dit is niet vast te leggen; er is geen opslag. Zonder spoor geen inzage.' };
    }
  const VASTLEGGEN = vastlegger();
  if (typeof VASTLEGGEN !== 'function') {
      return { ok: false, status: 503, reden: 'geen-vastlegger',
        error: 'Dit is niet vast te leggen; het journaal is niet duurzaam aangesloten. Zonder spoor geen inzage.' };
    }

    /* ZELF-INZAGE IS GEEN INZAGE, en dat blijft hier gelden -- zie mag() in de
       kop. Maar `null` is dan het VERKEERDE antwoord voor een aanroeper die op
       `ok` stuurt: die zou zijn eigen dossier niet meer kunnen openen. Vandaar een
       eigen uitslag, met de reden erbij. */
    if (zelf(opdracht.door, opdracht.over)) {
      return { ok: true, zelf: true, regel: null };
    }

    let regel = null;
    /* `vast: true` gaat MEE de mutatie in en wordt er niet na afloop op gezet. De
       hashketen dekt de regel zoals hij wordt weggeschreven; hem daarna bijstellen
       laat verifieer() een vervalsing aanwijzen op de enige plek waar niemand
       heeft gesjoemeld. Dezelfde reden waarom `extra` bestaat -- zie noteerVeel(). */
    const hard = kanBewijzen();
    const uit = await VASTLEGGEN(() => {
      regel = schrijfRegel({ ...opdracht, extra: { ...(opdracht.extra || {}),
        vast: hard,
        ...(hard ? {} : { vastWaarom: 'deze opslag kan duurzaamheid niet bevestigen' }) } });
    });
    if (uit) {
      /* De vastlegger geeft {status, error} als de opslag niet bevestigde. Die
         vorm gaat rechtstreeks door: hij is met opzet zo gemaakt dat een
         aanroeper hem niet per ongeluk als waarheid kan lezen. */
      return { ok: false, status: uit.status || 503, reden: 'niet-bevestigd', error: uit.error };
    }
    /* NA DE COMMIT NOG EEN KEER KIJKEN. De vastlegger zegt dat de opslag heeft
       bevestigd; deze regel zegt dat het onze regel is die er staat. Dat is geen
       dubbelop: `bijeen` commit de hele werkkopie, en een lege catch ergens in de
       mutatie zou de regel kunnen hebben weggelaten zonder dat de commit faalt. */
    if (!regel || !rij().some(r => r === regel)) {
      return { ok: false, status: 503, reden: 'regel-niet-teruggevonden',
        error: 'Dit is niet vast te leggen; het spoor was na het vastleggen niet terug te vinden.' };
    }
    return { ok: true, regel };
  }

  /* De duurzame tweeling van noteerVeel(). Een lege trefferlijst is hier GEEN
     fout: er is niemand ingezien, dus er valt niets vast te leggen en de
     aanroeper mag door. Dat is iets anders dan "het vastleggen mislukte", en die
     twee mogen niet op een hoop -- anders zou een zoekopdracht zonder resultaat
     een 503 opleveren. */
  async function noteerVeelVast(opdracht = {}) {
    const o = veelOpdracht(opdracht);
    if (!o) return { ok: true, leeg: true, regel: null };
    return noteerVast(o);
  }

  return { noteerVast, noteerVeelVast };
};
