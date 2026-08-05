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

  /* DE MELDING, op het moment van gebruik -- geen banner die je een half uur
     eerder wegklikte. Opmaak in shared/media.css; zonder dat blad staat de TEKST
     er nog, en dat is de kant waar dit hoort te falen. */
  function meld(fout) {
    var r = (fout && fout.rtg) || TEKST.onbekend;
    if (!d.body) return r;
    var oud = d.querySelector('.rtg-media-melding');
    if (oud && oud.parentNode) oud.parentNode.removeChild(oud);
    var el = d.createElement('div');
    el.className = 'rtg-media-melding';
    el.setAttribute('role', 'alert');
    var tekst = d.createElement('div');
    var kop = d.createElement('strong'); kop.textContent = r.kort;
    var p = d.createElement('p'); p.textContent = r.uitleg;
    tekst.appendChild(kop); tekst.appendChild(p);
    // bij een onveilig adres het https-adres ERBIJ; anders blijft het abstract
    if (r.code === 'onveilig' && w.location) {
      var c = d.createElement('code');
      c.textContent = 'nu: ' + w.location.origin + '   →   https://' + w.location.host.replace(/:\d+$/, '') + '/';
      var wrap = d.createElement('p'); wrap.appendChild(c); tekst.appendChild(wrap);
    }
    var x = d.createElement('button');
    x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Melding sluiten');
    x.addEventListener('click', function () { if (el.parentNode) el.parentNode.removeChild(el); });
    el.appendChild(tekst); el.appendChild(x);
    d.body.appendChild(el);
    return r;
  }

  /* De DOMException-namen die browsers echt geven. OverconstrainedError telt als
     "geen apparaat": een camera die aan geen eis voldoet is er voor de gebruiker
     niet. */
  var NAMEN = {
    NotAllowedError: 'geweigerd', PermissionDeniedError: 'geweigerd', SecurityError: 'onveilig',
    NotFoundError: 'geenapparaat', DevicesNotFoundError: 'geenapparaat', OverconstrainedError: 'geenapparaat',
    NotReadableError: 'bezet', TrackStartError: 'bezet', AbortError: 'afgebroken'
  };

  function vraag(wensen, opties) {
    opties = opties || {};
    var wat = (wensen && wensen.video) ? 'camera' : 'microphone';
    var vooraf = reden(wat);
    if (vooraf) {
      var f = maak(vooraf);
      if (!opties.stil) meld(f);
      return Promise.reject(f);
    }
    return w.navigator.mediaDevices.getUserMedia(wensen).catch(function (e) {
      var code = NAMEN[e && e.name] || 'onbekend';
      // een weigering IN een kader is meestal het kader en niet de gebruiker
      if (code === 'geweigerd' && inKader) code = kaderWeigert(wat) === true ? 'kader' : 'geweigerdInKader';
      var fout = maak(code, code === 'onbekend' ? ((e && e.name) || 'zonder naam') : '');
      fout.oorzaak = e;
      if (!opties.stil) meld(fout);
      throw fout;
    });
  }

  /* SPRAAKHERKENNING gebruikt dezelfde microfoon maar meldt zich met een korte
     code in plaats van een DOMException. Zelfde oorzaken, zelfde teksten. */
  var SPRAAK = { 'not-allowed': 'geweigerd', 'service-not-allowed': 'geweigerd', 'audio-capture': 'geenapparaat' };
  function spraak(code) {
    var c = !w.isSecureContext ? 'onveilig' : SPRAAK[code];
    if (!c) return null;
    if (c === 'geweigerd' && inKader) c = kaderWeigert('microphone') === true ? 'kader' : 'geweigerdInKader';
    var f = maak(c); meld(f); return f.rtg;
  }

  function camera(opties) {
    opties = opties || {};
    var video = opties.video || {};
    if (opties.achter) video.facingMode = { ideal: 'environment' };
    else if (opties.voor) video.facingMode = 'user';
    return vraag({ video: video, audio: opties.audio === true }, opties);
  }
  function microfoon(opties) { return vraag({ audio: true, video: false }, opties || {}); }

  /* HET KADERRECHT, en eerlijk over wat het WEL en NIET doet. Een iframe geeft
     camera en microfoon alleen door met allow="camera; microphone". Voor een
     kader naar een ANDERE origin is dat verplicht. Voor een SAME-ORIGIN kader is
     het dat niet -- nagemeten in test/media.e2e.js: featurePolicy.allowsFeature
     ('camera') is daar `true` zonder allow en de camera gaat open. Dit huis
     heeft alleen same-origin kaders (frame-ancestors 'self'), dus dit repareert
     hier niets; het maakt de bedoeling expliciet en houdt de deur open voor een
     engine die strenger is. De tekst staat op EEN plek omdat zes losse
     tekenreeksen binnen een maand uiteenlopen (LAT.md regel 4); regel 38 in
     check.js houdt vast dat elk kader hem hier ophaalt. */
  var KADERRECHT = 'camera; microphone; display-capture; geolocation; fullscreen; clipboard-write';

  w.RTGMedia = { vraag: vraag, camera: camera, microfoon: microfoon, spraak: spraak,
    kan: kan, reden: reden, meld: meld, inKader: inKader, teksten: TEKST,
    KADERRECHT: KADERRECHT,
    // een aanroep per kader, zodat de tekst nergens wordt overgetypt
    kader: function (el) { if (el && el.setAttribute) el.setAttribute('allow', KADERRECHT); return el; } };
})(window, document);
