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
     niet.

     NotSupportedError staat erbij omdat hij is GEZIEN en niet omdat een lijst hem
     noemt: Chromium geeft die naam bij een geweigerde toestemming met een
     nepapparaat (nagemeten in drie standen; zie test/camerascherm.e2e.js). Voor
     de gebruiker is dat geweigerd. */
  var NAMEN = {
    NotAllowedError: 'geweigerd', PermissionDeniedError: 'geweigerd', SecurityError: 'onveilig',
    NotSupportedError: 'geweigerd',
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
