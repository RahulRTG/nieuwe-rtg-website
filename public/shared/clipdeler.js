/* DE CLIPDELER -- korte video's die het toestel van de maker nooit verlaten.

   Een clip staat ALLEEN in het Origin Private File System (OPFS) van de maker.
   Bij RTG landen enkel titel, duur en een kleine affiche; het beeld reist
   rechtstreeks van toestel naar toestel over een versleuteld WebRTC-datakanaal,
   en de server is niet meer dan het doorgeefluik voor de signalen.

   WAAROM DIT EEN GEDEELDE LAAG IS. Sinds de Media OS (/apps/media.html)
   dezelfde clips in de stand FLOW toont, zijn er TWEE schermen die ze willen
   afspelen. Een tweede exemplaar zou twee plekken opleveren die allebei de
   waarheid vasthouden over knip, ondertitels, cache en protocol -- en die lopen
   uiteen (LAT.md regel 4). Hier staat het één keer; beide pagina's laden dit.

   HIJ DOET BEIDE KANTEN, en dat is geen luxe: wie een pagina met deze laag
   openheeft, DIENT ook zijn eigen clips uit en klopt zijn aanwezigheid aan. Zat
   dat alleen in clips.html, dan was een maker die in de Media OS bladert voor
   iedereen "offline" terwijl zijn toestel gewoon aanstaat.

   Niet hierin: het opnemen (dat hoort bij de studio van Clips) en de feed.

   Gebruik:
     var deler = RTGClipDeler.start({ token: t, opStatus: function (tekst) {} });
     deler.zetEigen(ids);            // welke clips op DIT toestel staan
     deler.speel(vlak, clip);        // vlak bevat een <video> (en optioneel .status)
     deler.bewaar(id, blob);         // na een opname
   Zonder token doet start() niets en geeft hij null terug. */
(function (w) {
  'use strict';
  if (w.RTGClipDeler) return;

  var IJS = [{ urls: 'stun:stun.l.google.com:19302' }];
  var BROK = 64 * 1024;
  var HARTSLAG_MS = 45000;

  function start(opties) {
    var o = opties || {};
    var token = o.token;
    if (!token) return null;
    var zeg = typeof o.opStatus === 'function' ? o.opStatus : function () {};
    var pad = o.pad || '/api/clips/';

    function api(deel, lijf) {
      return fetch(pad + deel, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(lijf || {})
      }).then(function (r) { return r.json().catch(function () { return {}; }); });
    }

    /* ---------- OPFS: het eigen archief ---------- */
    var opfs = function () { return navigator.storage.getDirectory(); };
    function schrijf(naam, blob) {
      return opfs().then(function (d) { return d.getFileHandle(naam, { create: true }); })
        .then(function (fh) { return fh.createWritable(); })
        .then(function (wr) { return wr.write(blob).then(function () { return wr.close(); }); });
    }
    function lees(naam) {
      return opfs().then(function (d) { return d.getFileHandle(naam); })
        .then(function (fh) { return fh.getFile(); })
        .catch(function () { return null; });
    }

    /* ---------- afspelen: archief, cache, of rechtstreeks P2P ---------- */
    var ontvangst = null, kijkPc = null;

    function statusVan(vlak, tekst) {
      var s = vlak.querySelector('.status');
      if (s) s.textContent = tekst;
      else zeg(tekst);
    }

    function speel(vlak, c) {
      var vid = vlak.querySelector('video');
      if (!vid) return Promise.resolve(false);
      if (vid.src) { vid.muted = false; vid.play().catch(function () {}); return Promise.resolve(true); }
      return lees((c.mijn ? 'clip-' : 'clipcache-') + c.id + '.webm').then(function (eigen) {
        if (eigen) { toonVideo(vlak, eigen, c); return true; }
        if (c.mijn) { zeg('Deze clip staat niet (meer) op dit toestel.'); return false; }
        if (!c.online) { zeg('De maker is nu niet online; deze clip staat alleen op diens eigen toestel.'); return false; }
        statusVan(vlak, 'Rechtstreeks ophalen bij ' + c.codenaam + '…');
        ontvangst = { clipId: c.id, clip: c, vlak: vlak, brokken: [], bytes: 0, totaal: 0 };
        return api('signaal', { id: c.id, kind: 'vraag' }).then(function (r) {
          if (r && r.error) { zeg(r.error); ontvangst = null; return false; }
          return true;
        });
      });
    }

    /* DE KNIP IS GEEN NIEUWE VIDEO: het origineel blijft heel bij de maker, wij
       springen naar het begin en stoppen bij het eind -- daarom kan een knip
       altijd terug. De ondertitels komen wél van RTG (tekst is klein), zodat de
       kijker ze heeft ook al reist het beeld rechtstreeks. */
    function toonVideo(vlak, blob, c) {
      var vid = vlak.querySelector('video');
      vid.src = URL.createObjectURL(blob);
      vid.muted = !!(c && c.geluid === 'stil');
      var knip = c && c.knip;
      if (knip) {
        var begin = function () { if (vid.currentTime < knip.van) vid.currentTime = knip.van; };
        vid.addEventListener('loadedmetadata', begin);
        if (vid.readyState >= 1) begin();
        vid.addEventListener('timeupdate', function () { if (vid.currentTime >= knip.tot) vid.pause(); });
      }
      /* De band staat sinds vandaag in shared/ondertitelband.js: het Theater en
         de Media OS tonen dezelfde cue-lijst, en drie kopieen van "welke regel
         hoort nu in beeld" lopen uiteen op wat je niet ziet (springen in de
         tijd, opruimen bij een volgende video). Valt die laag weg, dan speelt de
         clip gewoon door -- zonder band, en dat is zichtbaar. */
      if (w.RTGOndertitelband) w.RTGOndertitelband.zet(vlak, vid, (c && c.ondertitels) || []);
      vid.play().catch(function () { vid.muted = true; vid.play().catch(function () {}); });
      var p = vlak.querySelector('img.poster'); if (p) p.remove();
      statusVan(vlak, 'Speelt: rechtstreeks ontvangen, niets bij RTG bewaard');
    }

    function kijkOntvang(d) {
      if (!ontvangst || d.clipId !== ontvangst.clipId) return Promise.resolve();
      if (d.kind === 'offer') {
        if (kijkPc) { try { kijkPc.close(); } catch (e) {} }
        kijkPc = new RTCPeerConnection({ iceServers: IJS });
        kijkPc.onicecandidate = function (ev) {
          if (ev.candidate) api('signaal', { id: d.clipId, kind: 'ice', payload: ev.candidate });
        };
        kijkPc.ondatachannel = function (ev) {
          var kanaal = ev.channel;
          kanaal.binaryType = 'arraybuffer';
          kanaal.onmessage = function (m) {
            if (typeof m.data === 'string') {
              var b = JSON.parse(m.data);
              if (b.soort === 'kop') ontvangst.totaal = b.bytes;
              if (b.soort === 'klaar') {
                var blob = new Blob(ontvangst.brokken, { type: 'video/webm' });
                var klaar = ontvangst;
                // de cache is een gunst: lukt schrijven niet, dan speelt hij toch
                schrijf('clipcache-' + klaar.clipId + '.webm', blob)
                  .catch(function () {})
                  .then(function () { toonVideo(klaar.vlak, blob, klaar.clip); });
              }
              return;
            }
            ontvangst.brokken.push(m.data);
            ontvangst.bytes += m.data.byteLength;
            if (ontvangst.totaal) statusVan(ontvangst.vlak,
              'Ophalen: ' + Math.round(ontvangst.bytes / ontvangst.totaal * 100) + '%');
          };
        };
        return kijkPc.setRemoteDescription(d.payload)
          .then(function () { return kijkPc.createAnswer(); })
          .then(function (a) { return kijkPc.setLocalDescription(a).then(function () { return a; }); })
          .then(function (a) { return api('signaal', { id: d.clipId, kind: 'answer', payload: a }); });
      }
      if (d.kind === 'ice' && kijkPc) { try { return kijkPc.addIceCandidate(d.payload).catch(function () {}); } catch (e) {} }
      return Promise.resolve();
    }

    /* ---------- dienen: het origineel uit het eigen archief ---------- */
    var dienPcs = new Map();
    function dienUit(d) {
      return lees('clip-' + d.clipId + '.webm').then(function (f) {
        if (!f) return;
        return f.arrayBuffer().then(function (buf) {
          var pc = new RTCPeerConnection({ iceServers: IJS });
          dienPcs.set(d.van, pc);
          var kanaal = pc.createDataChannel('clip');
          kanaal.binaryType = 'arraybuffer';
          kanaal.onopen = function () {
            kanaal.send(JSON.stringify({ soort: 'kop', bytes: buf.byteLength }));
            var p = 0;
            (function volgende() {
              if (p >= buf.byteLength) { kanaal.send(JSON.stringify({ soort: 'klaar' })); return; }
              if (kanaal.bufferedAmount > 4 * 1024 * 1024) { setTimeout(volgende, 60); return; }
              kanaal.send(buf.slice(p, p + BROK));
              p += BROK;
              volgende();
            })();
          };
          pc.onicecandidate = function (ev) {
            if (ev.candidate) api('signaal', { id: d.clipId, kind: 'ice', doelKey: d.van, payload: ev.candidate });
          };
          return pc.createOffer()
            .then(function (offer) { return pc.setLocalDescription(offer).then(function () { return offer; }); })
            .then(function (offer) { return api('signaal', { id: d.clipId, kind: 'offer', doelKey: d.van, payload: offer }); });
        });
      });
    }

    /* ---------- aanwezigheid en het signaalkanaal ---------- */
    var eigenIds = [];
    function hartslag() { if (eigenIds.length) api('aanwezig', { ids: eigenIds }); }
    var klok = setInterval(hartslag, HARTSLAG_MS);

    var es = null;
    if (w.EventSource) {
      es = new EventSource('/api/stream?token=' + encodeURIComponent(token));
      es.addEventListener('clips', function (e) {
        var d = JSON.parse(e.data);
        if (d.kind === 'vraag') dienUit(d);
        else if (d.kind === 'answer') {
          var pc = dienPcs.get(d.van);
          if (pc) try { pc.setRemoteDescription(d.payload).catch(function () {}); } catch (e2) {}
        } else if (d.kind === 'ice' && dienPcs.get(d.van)) {
          try { dienPcs.get(d.van).addIceCandidate(d.payload).catch(function () {}); } catch (e2) {}
        } else kijkOntvang(d);
      });
    }

    return {
      speel: speel,
      toonVideo: toonVideo,
      bewaar: function (id, blob) { return schrijf('clip-' + id + '.webm', blob); },
      heeft: function (id) { return lees('clip-' + id + '.webm'); },
      zetEigen: function (ids) { eigenIds = Array.isArray(ids) ? ids : []; hartslag(); },
      stop: function () { clearInterval(klok); if (es) es.close(); }
    };
  }

  w.RTGClipDeler = { start: start };
})(window);
