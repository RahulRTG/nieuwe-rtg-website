/* de ontvangende kant van een gedeelde clip */
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
