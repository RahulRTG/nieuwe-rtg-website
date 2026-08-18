/* DE MAP IN JE KLUIS OPZOEKEN (of aanmaken), EEN KEER, EN NIET TE VROEG.

   WAT HIER MIS GING, TWEE KEER. Een app die zijn bestanden in een eigen map van
   de Bestanden-kluis zet, moet die map eerst opzoeken en zo nodig aanmaken: twee
   verzoeken. Zowel RTG Scanner als RTG Memo bewaarde het antwoord in een
   variabele `mapId` en las die bij het opslaan gewoon uit. Wie sneller klaar was
   dan die twee verzoeken, bewaarde met `map: null`.

   Het bestand landde dan NAAST de map, terwijl de melding zei dat het erin
   stond. De upload lukte, de melding kwam, alleen de map klopte niet -- en niets
   meldde dat. Bij Memo kwam er nog een gevolg bij: de lijst filtert op diezelfde
   map, dus de memo was daarna ook niet meer terug te vinden.

   Op een rustige machine wint de server die wedloop altijd, dus zag je het nooit.
   Op een belaste CI-runner zakte de schermtoets van de Scanner erop (job
   95666993170, 18 augustus 2026); op een trage telefoon zou een mens hem winnen.

   DE REGEL IS NU: geen variabele maar een BELOFTE, en wachten hoort bij het
   bewaren. Wie de map nodig heeft, vraagt hem hier op en krijgt dezelfde belofte
   terug -- ook als het opzoeken nog loopt.

   BIJ EEN FOUT VERVALT DE BELOFTE. Anders zou een hapering bij het openen van
   het scherm betekenen dat elk bestand van die sessie buiten de map valt, zonder
   weg terug. Een volgende poging begint dan gewoon opnieuw.

   HET STAAT HIER EN NIET TWEE KEER IN EEN APP, omdat twee kopieen van dezelfde
   waarheid uiteenlopen zodra er een verandert (LAT-regel 4). Wie een derde app
   met een eigen map bouwt, hoort hier langs te komen. */
(function () {
  'use strict';
  /* Per mapNAAM een belofte. Een pagina draait een app, dus meer sleutel dan de
     naam is er niet nodig; twee apps delen deze window niet. */
  var beloften = {};

  /* `api` komt van de app zelf: een functie (pad, body) die een belofte geeft op
     { status, body }. Dat is in elke app dezelfde vorm, en zo hoeft dit bestand
     niets te weten van tokens of foutafhandeling van het scherm. */
  function zoek(api, naam) {
    if (beloften[naam]) return beloften[naam];
    beloften[naam] = api('/api/bestanden/mijn').then(function (r) {
      if (r.body.error) throw new Error(r.body.error);
      var m = (r.body.mappen || []).find(function (x) { return x.naam === naam; });
      if (m) return m.id;
      return api('/api/bestanden/map', { naam: naam }).then(function (n) {
        if (n.body.error) throw new Error(n.body.error);
        return n.body.id;
      });
    }).catch(function (e) { delete beloften[naam]; throw e; });
    return beloften[naam];
  }

  window.RTGKluisMap = { zoek: zoek };
})();
