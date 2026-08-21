/* ============================================================================
   DE MEDIAPOORT -- de enige deur naar camera en microfoon.

   WAAROM DIT ER IS. Er stonden zeventien losse aanroepen van getUserMedia in
   public/, elk met eigen (of geen) foutbehandeling: zeven gaven stil `null`
   terug, drie lieten de fout lopen. Vandaar de klacht "op mijn telefoon doet
   niks het" -- er GEBEURT niets, en niemand zegt waarom. En het waarom is bijna
   nooit wat de gebruiker denkt. Vijf oorzaken, vijf verschillende handelingen:

     onveilig      het adres is http:// -- dan BESTAAT navigator.mediaDevices
                   niet en is "geef toegang" misleidende raad. Dit treft een
                   telefoon op een LAN-adres en localhost nooit: vandaar dat
                   het "op de laptop wel werkt".
     kader         een iframe naar een ANDERE origin dat het recht niet
                   doorgeeft; dan weigert de browser, wat je ook toestaat.
     geweigerd     de gebruiker of het slotje in de adresbalk zegt nee.
     geenapparaat  er zit geen camera of microfoon in dit toestel.
     bezet         een ander tabblad of programma heeft hem al.

   Een melding die die vijf op een hoop gooit ("Geen toegang tot de camera")
   laat de gebruiker zoeken naar een knop die er niet is. Deze laag stelt de
   diagnose waar dat kan VOORDAT ze het de browser vraagt, vertaalt de
   DOMException waar dat niet kan, en zegt het hardop op het moment van gebruik.

   GEBRUIK. camera({achter:true}) / microfoon() / vraag(wensen) geven een
   Promise<MediaStream>; hij breekt met een Error die `fout.rtg = {code, kort,
   uitleg}` draagt en de melding staat dan al in beeld (tenzij `{stil:true}`).
   Verder kan()/reden(), meld(fout), spraak(code) voor SpeechRecognition en
   kader(iframe).

   WAT DIT NIET OPLOST: buiten https laat de browser camera en microfoon
   simpelweg niet toe. Deze laag maakt die oorzaak zichtbaar; de rest is een
   serverkeuze (RTG_TLS=1, server/lib/tls.js).
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.RTGMedia) return;

  var inKader = (function () { try { return w.self !== w.top; } catch (e) { return true; } })();

  /* Weigert het kader het recht echt? Chromium zegt dat via featurePolicy,
     Safari kent hem niet. Weet ik het niet, dan noemt de melding het kader als
     MOGELIJKE oorzaak naast de weigering -- niet als feit. */
  function kaderWeigert(wat) {
    var fp = d.featurePolicy || d.permissionsPolicy;
    if (!fp || typeof fp.allowsFeature !== 'function') return null;
    try { return !fp.allowsFeature(wat); } catch (e) { return null; }
  }

  /* Per oorzaak een korte kop (statusregel of toast) en een uitleg die zegt wat
     de gebruiker kan DOEN -- dat tweede is de reden voor deze tabel. */
  var mk = function (kort, uitleg) { return { kort: kort, uitleg: uitleg }; };
  var TEKST = {
    onveilig: mk('Camera en microfoon werken niet op een http-adres',
      'Buiten https (en localhost) geeft de browser camera en microfoon niet vrij -- er valt hier niets goed te keuren. Open de app via het https-adres van dezelfde server.'),
    geenapi: mk('Deze browser kan geen camera of microfoon openen',
      'De browser heeft navigator.mediaDevices niet; werk hem bij of neem een andere.'),
    kader: mk('Dit venster geeft de camera niet door',
      'De app staat in een venster dat het recht op camera en microfoon niet doorgeeft. Open hem als eigen pagina -- dan mag het wel.'),
    geweigerd: mk('De browser houdt camera of microfoon tegen',
      'Zet camera en microfoon voor deze site weer aan via het slotje naast de adresbalk, en probeer het opnieuw.'),
    geweigerdInKader: mk('De browser houdt camera of microfoon tegen',
      'Of de toegang staat voor deze site uit (het slotje naast de adresbalk), of het venster waarin deze app staat geeft het recht niet door. Open hem als eigen pagina om het tweede uit te sluiten.'),
    geenapparaat: mk('Geen camera of microfoon gevonden',
      'Dit toestel meldt geen bruikbare camera of microfoon. Zit hij er wel in, zet hem dan aan in de instellingen.'),
    bezet: mk('De camera of microfoon is al in gebruik',
      'Een ander tabblad of programma heeft hem vast; sluit dat en probeer opnieuw.'),
    afgebroken: mk('Het openen is afgebroken',
      'De browser brak het openen af voordat het klaar was; probeer opnieuw.'),
    onbekend: mk('Camera of microfoon gaat niet open',
      'De browser gaf een fout die dit huis niet kent; de naam staat erachter.')
  };

  function maak(code, extra) {
    var t = TEKST[code] || TEKST.onbekend;
    var fout = new Error('[media/' + code + '] ' + t.kort);
    fout.rtg = { code: code, kort: t.kort, uitleg: t.uitleg + (extra ? ' (' + extra + ')' : '') };
    return fout;
  }

  /* Wat we ZONDER te vragen al weten, zodat een scherm de knop kan uitzetten
     met de reden erbij in plaats van een knop die niets doet. */
  function reden(wat) {
    if (!w.isSecureContext) return 'onveilig';
    if (!(w.navigator && w.navigator.mediaDevices && w.navigator.mediaDevices.getUserMedia)) return 'geenapi';
    if (inKader && kaderWeigert(wat || 'camera') === true) return 'kader';
    return null;
  }
  function kan(wat) { return reden(wat) === null; }

