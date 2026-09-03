/* ============================================================================
   DE BELMOTOR VAN RTG SERVICE -- één keer geschreven, twee kanten.

   Bellen naar RTG loopt binnen de app (kern/service/gesprek.js): geen provider,
   geen nummer, en geen telefoonnummer dat de identiteitskluis verlaat. Aan
   beide kanten van zo'n gesprek staat exact dezelfde WebRTC-dans -- media
   ophalen, een verbinding opzetten, kandidaten uitwisselen, ophangen -- en die
   hoort niet twee keer te bestaan. Vandaar dit bestand: het TRANSPORT komt van
   buiten, de dans staat hier.

   Wie hem gebruikt geeft twee dingen mee:
     stuur(kind, payload)   hoe een signaal de deur uit gaat (de melder POST naar
                            /api/service/bel/signaal, het kantoor naar
                            /api/office/service/gesprek/signaal)
     rol                    'beller' maakt het aanbod, 'opnemer' antwoordt erop
     opTekst(regel)         een regel uit de tekstbaan van de andere kant

   DE ROLLEN ZIJN NIET SYMMETRISCH, en dat is met opzet. De beller wacht op
   `accept` voordat hij een aanbod maakt; wie meteen een aanbod stuurt naar een
   kantoor waar niemand zit, onderhandelt met de muur en houdt zijn camera aan.

   DRIE DINGEN DIE DEZE MOTOR NIET DOET:
   - hij belooft niets. Geen wachttijd, geen "u bent nummer drie"; hij meldt
     alleen wat er GEBEURT (rinkelt, verbonden, opgehangen);
   - hij zet niets vast. Valt de verbinding weg, dan zegt hij dat en laat hij de
     zaak staan -- de tijdlijn is de waarheid en die staat op de server;
   - hij kijkt niet in het pakket van de tegenpartij. Een SDP of een
     ICE-kandidaat gaat er ongelezen doorheen, precies zoals de server dat doet.
   ========================================================================== */
(function (w) {
  'use strict';

  var STUN = [{ urls: 'stun:stun.l.google.com:19302' }];

  function maak(opties) {
    var o = opties || {};
    var stuur = o.stuur;                     // (kind, payload) => Promise
    var rol = o.rol === 'opnemer' ? 'opnemer' : 'beller';
    var video = !!o.video;
    var opStand = typeof o.opStand === 'function' ? o.opStand : function () {};
    var pc = null, stream = null, ijs = null, dood = false;
    /* Kandidaten die binnenkomen VOORDAT de verbinding een beschrijving heeft,
       moeten wachten. Zonder deze rij gooit addIceCandidate en valt precies het
       eerste gesprek van een verbinding weg -- de klassieke WebRTC-val. */
    var wachtrij = [];

    function meld(stand, extra) { try { opStand(stand, extra || null); } catch (e) {} }

    async function ijsblokjes() {
      if (ijs) return ijs;
      try { ijs = (await (await fetch('/api/ice')).json()).iceServers || STUN; }
      catch (e) { ijs = STUN; }
      return ijs;
    }

    /* CAMERA EN MICROFOON GAAN LANGS DE MEDIAPOORT (shared/media.js) en niet
       rechtstreeks langs getUserMedia. Die poort stelt de diagnose die de
       gebruiker nodig heeft -- onveilige verbinding, een kader dat het recht
       niet doorgeeft, geweigerd, geen apparaat, of bezet door een ander
       programma -- en dat zijn vijf verschillende handelingen. Een eigen
       aanroep hier zou ze op een hoop gooien tot "geen toegang", en dan zoekt
       iemand naar een knop die er niet is. */
    async function media() {
      if (stream) return stream;
      if (!w.RTGMedia) { meld('geenmedia', 'mediapoort ontbreekt'); return null; }
      try {
        stream = await w.RTGMedia.vraag({ audio: true, video: video });
      } catch (e) {
        /* De poort heeft de melding al in beeld gezet; hier alleen de stand,
           zodat het scherm weet dat er niet gebeld gaat worden. */
        meld('geenmedia', (e && e.rtg && e.rtg.code) || (e && e.name));
        return null;
      }
      if (o.elLokaal) { try { o.elLokaal.srcObject = stream; } catch (e) {} }
      return stream;
    }

    async function verbinding() {
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: await ijsblokjes() });
      if (stream) stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
      pc.onicecandidate = function (ev) {
        if (ev.candidate && !dood) { try { stuur('ice', ev.candidate); } catch (e) {} }
      };
      pc.ontrack = function (ev) {
        if (o.elExtern) { try { o.elExtern.srcObject = ev.streams[0]; } catch (e) {} }
        meld('verbonden');
      };
      pc.onconnectionstatechange = function () {
        if (!pc) return;
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') meld('weggevallen');
      };
      return pc;
    }

    /* De beller: media pakken en wachten. Pas na `accept` gaat er een aanbod
       uit -- zie de kop. */
    async function start() {
      if (!(await media())) return false;
      meld(rol === 'beller' ? 'rinkelt' : 'opnemen');
      if (rol === 'opnemer') { await stuur('accept', null); }
      return true;
    }

    async function aanbod() {
      var v = await verbinding();
      var d = await v.createOffer();
      await v.setLocalDescription(d);
      await stuur('offer', d);
    }

    async function leegWachtrij() {
      while (wachtrij.length) {
        var k = wachtrij.shift();
        try { await pc.addIceCandidate(k); } catch (e) {}
      }
    }

    /* Een binnengekomen signaal. De aanroeper voedt hem hier in; deze motor
       luistert zelf niet, want wie het kanaal opzet verschilt per kant. */
    async function ontvang(kind, payload) {
      if (dood) return;
      try {
        if (kind === 'accept' && rol === 'beller') { await aanbod(); return; }
        if (kind === 'offer' && rol === 'opnemer') {
          var v = await verbinding();
          await v.setRemoteDescription(payload);
          await leegWachtrij();
          var d = await v.createAnswer();
          await v.setLocalDescription(d);
          await stuur('answer', d);
          return;
        }
        if (kind === 'answer' && rol === 'beller') {
          await pc.setRemoteDescription(payload);
          await leegWachtrij();
          return;
        }
        if (kind === 'ice') {
          if (!pc || !pc.remoteDescription) { wachtrij.push(payload); return; }
          try { await pc.addIceCandidate(payload); } catch (e) {}
          return;
        }
        /* DE TEKSTBAAN. Een live gesprek zonder weg naar tekst sluit een dove
           deelnemer uit -- TOEGANKELIJK.md zegt dat met zoveel woorden, en
           shared/meelezen.js bestaat er precies voor. De regels rijden mee over
           dezelfde doorgeefluik en worden NERGENS bewaard: net als de stem. */
        if (kind === 'tekst') { if (typeof o.opTekst === 'function') o.opTekst(payload && payload.r); return; }
        if (kind === 'hangup' || kind === 'decline' || kind === 'busy') { stop(false); meld('opgehangen', kind); }
      } catch (e) {
        meld('mislukt', e && e.message);
      }
    }

    /* Ophangen. `zeghet` staat er omdat de kant die zelf ophangt dat moet
       melden, en de kant die een hangup ONTVING niet -- anders sturen twee
       kanten elkaar om beurten een ophanger. */
    function stop(zeghet) {
      if (dood) return;
      dood = true;
      if (zeghet !== false) { try { stuur('hangup', null); } catch (e) {} }
      if (pc) { try { pc.close(); } catch (e) {} pc = null; }
      if (stream) { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); stream = null; }
      meld('gestopt');
    }

    return { start: start, ontvang: ontvang, stop: stop,
      get actief() { return !dood; } };
  }

  w.RTGServiceBel = { maak: maak };
})(window);
