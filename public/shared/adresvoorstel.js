/* De adresopzoeker op het scherm: postcode en huisnummer erin, een VOORSTEL eruit.

   WAAR DIT BIJ HOORT. De intake vraagt sinds de momenten geen adres meer
   (server/kern/onboarding.js: alleen naam, e-mail en geboortedatum staan op
   'nu'). De enige plek waar nog een adres gevraagd wordt is de adresstap van de
   gegevenspoort, als er echt iemand langskomt: "Waar mag het heen? Straat,
   huisnummer, postcode en plaats." Drie van die vier zijn af te leiden uit de
   twee die je toch al geeft, dus mag die vraag korter. Deze module doet dat
   stukje; het gesprek eromheen staat in shared/poortgesprek.js.

   WAAROM EEN EIGEN BESTAND EN NIET EEN PAAR REGELS DAAR. De drie regels
   hieronder komen alle drie uit een fout die hier echt is gemaakt, en ze horen
   op EEN plek te staan (LAT.md regel 4) -- ook als er ooit een tweede scherm een
   adres vraagt.

   1. WAT ERUIT KOMT IS EEN VOORSTEL, GEEN OPSLAG. Wat de opzoeker teruggeeft
      komt op het scherm en gaat pas na een "ja, klopt" naar de server. Een
      eerdere ronde bewaarde een postcode die het lid nooit had gezien, en die
      klopte ook nog niet: "10115 5" (Berlijn) werd door een gulzige regex
      "1011" (Amsterdam), en dat ging als "zijn eigen antwoord" de kluis in.
   2. DE VORM IS DE POORT. lees() accepteert ALLEEN een volledige Nederlandse
      postcode plus huisnummer, van het eerste teken tot het laatste. Een
      buitenlandse postcode, een telefoonnummer of een half adres levert geen
      halve treffer maar niets, en dan typt het lid zijn adres gewoon voluit. Zo
      kan er nooit een opzoekvraag ontstaan uit iets dat geen postcode is.
   3. ER GAAN TWEE DINGEN DE DEUR UIT, en dat is precies waarom deze vraag naar
      een derde partij mag: bij het Kadaster komt een vraag binnen die van
      iedereen kan zijn. Geen naam, geen codenaam, geen token, ook niet de ruwe
      regel die het lid typte. De server bewaakt dat aan zijn kant
      (server/kern/adresopzoek/vertaling.js, bouwVraag); dit is de andere helft,
      en test/adresvraag.e2e.js leest na wat de browser werkelijk verstuurt --
      als gelijkheid, zodat een extra veld de toets laat zakken.

   Wat er terugkomt zijn de velden van server/routes/adres.js en niets meer. Er
   is met opzet geen veld dat verschil maakt tussen "vers opgehaald" en "stond al
   in de cache": daarmee kon lid B aftasten welke adressen lid A had opgezocht,
   en dat is gedrag van een ander lid in een huis dat op codenamen draait. */
(function (w) {
  'use strict';
  if (w.RTGAdresvoorstel) return;

  /* Van het eerste teken tot het laatste: vier cijfers, twee letters, en dan het
     huisnummer met hooguit een korte toevoeging. Anker aan beide kanten, want
     daar ging het mis: zonder ^ en $ eet een gulzige regex de eerste vier cijfers
     van een buitenlandse postcode op. "10115 5" en "75002 12" matchen hier NIET,
     en "06 12345678" ook niet (een postcode begint niet met een nul). */
  var PC_NR = /^([1-9]\d{3})\s*([A-Za-z]{2})[\s,;]+(\d{1,5}\s?[A-Za-z]{0,3})$/;

  // Niets gevonden en ook geen zin van de server: dan zegt het scherm het zelf.
  var GEEN = 'Opzoeken lukt nu even niet. Typ je adres dan voluit.';

  function lees(tekst) {
    var m = PC_NR.exec(String(tekst == null ? '' : tekst).trim());
    if (!m) return null;
    return { postcode: m[1] + m[2].toUpperCase(), huisnummer: m[3].replace(/\s+/g, ' ').trim() };
  }

  /* De zin die het lid TE ZIEN krijgt en die daarna wordt opgeslagen: een en
     dezelfde, zodat er nooit iets in de kluis komt dat niet in beeld stond.
     Straat en woonplaats komen van de bron; postcode en huisnummer zijn wat het
     lid zelf typte (de bron rekent het huisnummer na en weigert een ander, zie
     leesAntwoord in server/kern/adresopzoek/vertaling.js, dus de toevoeging
     "12A" mag blijven staan zonder dat er iets verzonnen wordt).

     EN DE PLAATS STAAT ACHTERAAN, met opzet. De server leest hem daar
     (server/kern/gegevensgesprek.js, plaatsUit) om de woonplaats bij te
     schrijven in het onboardingprofiel -- de enige voeding die het stad-facet
     van kern/ledenregister.js nog heeft. Zet er een land achter en "Nederland"
     wordt de woonplaats. */
  function zin(vondst, huisnummer) {
    return String(vondst.straat).trim() + ' ' + huisnummer + ', ' +
      String(vondst.postcode).trim() + ' ' + String(vondst.woonplaats).trim();
  }

  /* Opzoeken. `call(pad, body)` is de api-helper van de pagina, dus deze module
     weet niets van tokens. Er komt altijd hetzelfde soort antwoord terug --
     {voorstel: zin} of {tekst: zin voor het lid} -- en nooit een worp: een
     mislukte opzoeking is geen fout maar gewoon "typ het voluit".

     Over de ZIN bij een mislukking: die komt van de server als die er een
     meestuurde, en anders valt hij terug op GEEN. Dat "anders" is niet
     theoretisch en het is eerlijker om het hier te noemen dan te beweren dat
     de server altijd iets meegeeft: bij een netwerkfout, een afgebroken
     verbinding of een antwoord zonder lichaam is er niets om te tonen, en dan
     is de eigen zin de enige die er staat. */
  function zoek(call, gel) {
    return call('/api/adres/zoek', { postcode: gel.postcode, huisnummer: gel.huisnummer })
      .then(function (d) {
        if (d && d.gevonden && d.straat && d.woonplaats) return { voorstel: zin(d, gel.huisnummer) };
        return { tekst: (d && d.tekst) || GEEN };
      })
      .catch(function (e) { return { tekst: (e && e.data && e.data.tekst) || GEEN }; });
  }

  /* De kaart waarop het voorstel te zien is voordat er iets bewaard wordt. Hij
     hoort hier en niet in poortgesprek.js: dit is de module over het voorstel,
     en daar paste hij niet meer binnen de 10 KB-lat.

     De focus gaat naar "Ja, klopt". Bij de vraag zelf staat hij in het
     invoerveld, en dat veld verdwijnt hier: zonder die regel valt de focus
     terug op de body en staat wie met het toetsenbord werkt stil voor een kaart
     die hij niet kan bedienen. */
  function kaartToon(kaart, esc, zin, opJa, opNee) {
    kaart.innerHTML = '<h2>Nog een ding</h2><p class="rp-vraag">' + esc(zin) + ', klopt dat?</p>' +
      '<div class="rp-rij"><button type="button" class="rp-door">Ja, klopt</button>' +
      '<button type="button" class="rp-stop">Nee, ik typ het voluit</button></div>';
    kaart.querySelector('.rp-door').addEventListener('click', opJa);
    kaart.querySelector('.rp-stop').addEventListener('click', opNee);
    kaart.querySelector('.rp-door').focus();
  }

  w.RTGAdresvoorstel = { lees: lees, zin: zin, zoek: zoek, kaart: kaartToon };
})(window);
