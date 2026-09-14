/* Media OS (deelmodule): NIEUW WERK WEKT DE JUISTE MENSEN.

   Dit sluit de belofte die de meldingsvoorkeur eerst alleen OPSCHREEF (TAKEN.md
   4.11): je volgt een maker één keer, kiest waarvoor je gewekt wilt worden, en
   vanaf nu gebeurt dat ook echt.

   VIER MOMENTEN, en het zijn precies de momenten waarop er iets TE ZIEN is:
   een uitgave in het Klankwerk, een video waarvan de bytes binnen zijn (niet
   het aanmaken van de lege kaart), een nieuwe clip, en live GAAN op het Podium.
   De vier domeinen roepen dit zelf aan via een laat gebonden haak; ze weten
   verder niets van deze laag en werken zonder hem gewoon door.

   DRIE FILTERS, en alle drie horen ze er te zijn:

   1. WIE VOLGT ER. Die lijst komt uit de domeinen zelf (de volgerslijst van
      Clips en de abonnees van het Theaterkanaal), niet uit een eigen tabel.
   2. WAARVOOR. De voorkeur per maker en per soort uit ./eigen.js. Wie niets
      heeft gezegd krijgt alles -- dat is wat volgen betekent.
   3. DE ALGEMENE MELDINGSSCHAKELAAR. notify() zelf kijkt nog naar de scope in
      de meldingsvoorkeuren van het lid (kern/ervaring.js). Wie "media" daar
      uitzet, krijgt hier niets, en dat hoort een andere knop te zijn dan
      "welke maker": de een is een dagstand, de ander een relatie.

   WAT ER MET OPZET NIET GEBEURT. De maker wordt niet over zijn eigen werk
   gewekt. Er gaat geen melding naar wie niet volgt -- dit is geen kanaal om
   aandacht mee te kopen. En er staat geen aantal in ("3.000 mensen wachten op
   u"): dat zijn de lokkertjes die dit huis nergens gebruikt. */
'use strict';

const SOORT_NAAM = {
  muziek: 'nieuwe muziek', video: 'een nieuwe video', flow: 'een nieuwe korte video', live: 'nu live',
  /* De vier die er op 13 september bij kwamen. Ze horen bij een PUBLIEKE
     AANWEZIGHEID (./aanwezigheid.js) en niet per se bij een mens: een festival en
     een club kunnen ze ook uitzenden. */
  optreden: 'een bevestigd optreden', kaartverkoop: 'kaartverkoop open',
  wedstrijd: 'een wedstrijd in de agenda', uitgelicht: 'uitgelicht werk'
};

function maakWekken({ notify, codenaamVan, meldVan, bronnen, aanwezig, tijdlijn }) {
  /* ---- HET MOMENTREGISTER, EN WAAROM HET ER NIET WAS ----

     GEVONDEN DOOR SCHAKEL 5 VAN scripts/momentproef.js (13 september 2026).
     `nieuwMoment` WEKTE wel en BEWAARDE niets. Een lid werd dus gewekt over een
     optreden en kon daarna nergens terugvinden waarover -- want een melding is
     in dit huis een WEK en geen link, en geen enkele `notify()` draagt een
     bestemming. Dat is precies de scheiding "moment is geen notificatie" uit
     STAGE.md par. 3, maar dan met de ene helft ontbrekend: de wek werkte, het
     FEIT werd niet vastgelegd.

     DE VORM DIE HIER GEKOZEN IS, en waarom hij geen tweede waarheid wordt.
     STAGE.md par. 2 is streng: de BRON bepaalt DAT iets gebeurd is, Stage
     bepaalt alleen hoe dat publieke feit in deze context wordt gepresenteerd.
     Een register dat de bron KOPIEERT is dus verboden -- dat is exact de fout
     die deze tak al een keer maakte, toen de aanwezigheid van een zaak de naam
     van het festival droeg en een tweede festival de eerste hernoemde.

     Daarom deze scheiding, en zij is het hele ontwerp:

       WAT HIER STAAT is een GEBEURTENIS: dat op dit tijdstip deze aanwezigheid
       dit soort heeft uitgezonden, met de tekst die er TOEN bij hoorde. Een
       gebeurtenis is naar haar aard historisch; die tekst hoort niet mee te
       veranderen en is dus geen kopie maar een momentopname.

       WAT HIER NIET STAAT is alles wat LEEFT. De naam van de aanwezigheid wordt
       bij het lezen opgehaald uit ./aanwezigheid.js, zodat een club die
       hernoemt overal meteen goed staat. En er staat geen prijs, geen
       beschikbaarheid en geen stand van de bron in -- wie dat toevoegt, bouwt de
       tweede waarheid alsnog.

     DE FEED EN DE WEK ZIJN TWEE DINGEN, en dat is met opzet. Vastleggen gebeurt
     zodra de AANWEZIGHEID iets uitzendt; gewekt wordt alleen wie dat soort aan
     heeft staan (`meldVan`). Dus: de feed is de tijdlijn van de aanwezigheid, de
     wek is mijn meldingsvoorkeur. Wie ze samenvoegt, laat een lid zijn eigen
     geschiedenis kwijtraken door een vinkje uit te zetten. */
  const { leg, momentenVoor } = tijdlijn;

  /* De volgers van een maker: de vereniging van de twee gratis volgrelaties
     die de Media OS ook zet (Clips en het Theater). Een betaald podium-
     abonnement telt hier niet mee -- dat is een betaalrelatie en geen volg. */
  function volgersVan(makerKey) {
    const uit = new Set();
    try { for (const k of (bronnen.clipsVolgersVan ? bronnen.clipsVolgersVan(makerKey) : [])) uit.add(k); }
    catch (e) { /* een bron die stuk is mag de rest niet tegenhouden */ }
    try { for (const k of (bronnen.theaterVolgersVan ? bronnen.theaterVolgersVan(makerKey) : [])) uit.add(k); }
    catch (e) {}
    /* EN DE AANWEZIGHEID VAN DIT LID. Sinds 13 september is dat de derde bron,
       en de enige die de Media OS zelf bezit. Voor een MENS is het dus een
       aanvulling op zijn domeinlijsten; voor een organisatie is het de enige. */
    try {
      const a = aanwezig && aanwezig.aanwezigVan('lid', makerKey);
      if (a) for (const k of aanwezig.aanwezigVolgersVan(a.id)) uit.add(k);
    } catch (e) {}
    uit.delete(makerKey);
    return [...uit];
  }

  /* Geeft terug WIE er gewekt is en wie niet, met de reden erbij. Dat is niet
     voor de sier: zonder die uitslag is "er ging geen melding uit" niet te
     onderscheiden van "er is niets gebeurd", en dat is precies de stilte waar
     LAT.md regel 5 over gaat. De toetsen lezen hem ook. */
  function nieuwWerk(makerKey, soort, titel) {
    if (!makerKey || !SOORT_NAAM[soort]) return { gewekt: [], overgeslagen: [] };
    const codenaam = codenaamVan ? codenaamVan(makerKey) : null;
    if (!codenaam) return { gewekt: [], overgeslagen: [] };
    const gewekt = [], overgeslagen = [];
    for (const volger of volgersVan(makerKey)) {
      const soorten = meldVan(volger, codenaam);
      if (!soorten.includes(soort)) { overgeslagen.push({ key: volger, reden: 'wil geen ' + soort + ' van deze maker' }); continue; }
      try {
        notify(volger, {
          title: 'RTG Media',
          body: codenaam + ': ' + SOORT_NAAM[soort] + (titel ? ' -- "' + titel + '"' : '') + '.',
          scope: 'media'
        });
        gewekt.push(volger);
      } catch (e) {
        overgeslagen.push({ key: volger, reden: 'melden mislukte: ' + (e && e.message ? e.message : 'onbekend') });
      }
    }
    return { gewekt, overgeslagen, soort, maker: codenaam };
  }

  /* ---- WEKKEN OP EEN AANWEZIGHEID, en dat is de ingang voor alles wat geen
     mens is. Een festival en een club hebben geen ledensleutel, dus nieuwWerk()
     hierboven kan hen niet bedienen -- hij begint immers bij een maker.

     DRIE DINGEN DIE HIER GELIJK BLIJVEN aan nieuwWerk, want anders zou een
     organisatie stiekem meer mogen dan een mens: de voorkeur per soort wordt
     gerespecteerd, de algemene meldingsschakelaar van notify() blijft erboven
     staan, en de uitslag zegt WIE er gewekt is en wie niet met de reden. */
  function nieuwMoment(aanwezigheidId, soort, titel) {
    if (!aanwezig || !SOORT_NAAM[soort]) return { gewekt: [], overgeslagen: [] };
    const a = aanwezig.aanwezigMet(aanwezigheidId);
    if (!a) return { gewekt: [], overgeslagen: [], reden: 'deze aanwezigheid bestaat niet' };
    /* Een aanwezigheid die deze soort niet uitzendt, wekt er ook niet mee. Zonder
       deze regel belooft het volgscherm iets anders dan er gebeurt. */
    if (!a.soorten.includes(soort))
      return { gewekt: [], overgeslagen: [], reden: 'deze aanwezigheid zendt geen ' + soort + ' uit' };
    /* EERST VASTLEGGEN, DAN WEKKEN. Het feit dat deze aanwezigheid iets heeft
       uitgezonden staat los van de vraag of er iemand gewekt kon worden -- een
       moment zonder volgers is nog steeds gebeurd, en hoort in de tijdlijn te
       staan voor wie er morgen op volgen drukt. */
    const regel = leg(a.id, soort, titel);
    const gewekt = [], overgeslagen = [];
    for (const volger of aanwezig.aanwezigVolgersVan(a.id)) {
      const soorten = meldVan(volger, a.naam);
      if (!soorten.includes(soort)) { overgeslagen.push({ key: volger, reden: 'wil geen ' + soort + ' van ' + a.naam }); continue; }
      try {
        notify(volger, {
          title: 'RTG Media',
          body: a.naam + ': ' + SOORT_NAAM[soort] + (titel ? ' -- "' + titel + '"' : '') + '.',
          scope: 'media'
        });
        gewekt.push(volger);
      } catch (e) {
        overgeslagen.push({ key: volger, reden: 'melden mislukte: ' + (e && e.message ? e.message : 'onbekend') });
      }
    }
    return { gewekt, overgeslagen, soort, aanwezigheid: a.id, moment: regel ? regel.id : null };
  }

  return { mediaNieuwWerk: nieuwWerk, mediaNieuwMoment: nieuwMoment,
    mediaVolgersVan: volgersVan, mediaMomentenVoor: momentenVoor,
    MEDIA_SOORT_NAAM: SOORT_NAAM };
}

module.exports = { maakWekken, SOORT_NAAM };
