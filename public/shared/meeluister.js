/* ============================================================================
   MEELUISTEREN: JE EIGEN STEM ALS TEKST IN DE MEELEESBAAN.

   DE HELFT DIE ONTBRAK. shared/meelezen.js gaf een live gesprek een tekstbaan
   waarin deelnemers MEETYPEN. Dat verplaatste de afhankelijkheid van "wie doof
   is kan niet meedoen" naar "kan meedoen als de anderen meetypen" -- beter, maar
   nog steeds afhankelijk van de goede wil van de rest. Deze module maakt de
   tekst vanzelf: elke deelnemer laat zijn EIGEN stem omzetten en stuurt de
   regel over dezelfde seinweg als een getypte regel.

   WAAROM IEDEREEN ZICHZELF ONDERTITELT, en niet de ander:
     - de spreker beslist zelf of zijn stem door een model gaat, en dat is een
       andere vraag dan of hij meedoet aan het gesprek;
     - er hoeft nergens een tweede geluidsstroom te worden afgetapt;
     - niemand ondertitelt een ander achter zijn rug.

   WAAR HET GELUID HEEN GAAT, eerlijk gezegd: naar de server van RTG, en daar
   naar een LOKAAL model (LOCAL_AI_URL). Niet naar een browserleverancier, niet
   naar een derde partij, en het wordt niet bewaard. Dat is iets anders dan "het
   verlaat uw toestel niet", en dat verschil hoort de gebruiker te lezen -- de
   knop zegt het dan ook.

   EN ALS ER GEEN MODEL IS, KOMT ER GEEN KNOP. Een ondertitelknop die niets doet
   is erger dan geen knop: hij laat iemand aan een gesprek beginnen in de
   veronderstelling dat hij het kan volgen. `/api/ondertiteling/stand` zegt of
   het kan; kan het niet, dan staat er wat er WEL is (meelezen) en waarom.
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.RTGMeeluister) return;

  var STUK_MS = 4000;        // een fragment van vier seconden: kort genoeg om live te heten
  var SOORTEN = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

  function kanOpnemen() {
    if (typeof w.MediaRecorder !== 'function') return null;
    for (var i = 0; i < SOORTEN.length; i++) {
      try { if (w.MediaRecorder.isTypeSupported(SOORTEN[i])) return SOORTEN[i]; } catch (e) {}
    }
    return null;
  }

  function tok() { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } }

  function stand() {
    var t = tok();
    if (!t) return Promise.resolve({ beschikbaar: false, reden: 'U bent niet ingelogd.' });
    return fetch('/api/ondertiteling/stand', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' })
      .then(function (r) { return r.json(); })
      .catch(function () { return { beschikbaar: false, reden: 'De server antwoordde niet.' }; });
  }

  /* Een fragment opsturen. RAUW, want een audiofragment door JSON halen betekent
     base64 en dus een derde meer bytes -- elke vier seconden opnieuw. */
  function verstuur(blob, taal) {
    var t = tok();
    if (!t) return Promise.resolve(null);
    return fetch('/api/ondertiteling/fragment', { method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm', Authorization: 'Bearer ' + t,
        'X-RTG-Taal': taal || (d.documentElement.lang || 'nl').slice(0, 8) },
      body: blob })
      .then(function (r) { return r.json(); })
      .then(function (x) { return (x && x.ok && x.tekst) ? x.tekst : null; })
      .catch(function () { return null; });
  }

  /* De luisteraar zelf. `stream` is de eigen microfoonstroom die het gesprek al
     heeft -- er wordt geen tweede aangevraagd, want dan staat er een tweede
     lampje aan voor dezelfde microfoon.

     `opRegel(tekst)` krijgt elke herkende regel. De aanroeper doet er twee
     dingen mee: in de eigen baan zetten en over de seinweg sturen. Deze module
     doet dat niet zelf; zij weet niet hoe dit gesprek seint. */
  function maak(opties) {
    var o = opties || {};
    var soort = kanOpnemen();
    var rec = null, aan = false, bezig = false;

    function stop() {
      aan = false;
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) {} }
      rec = null;
    }

    function ronde(stream) {
      if (!aan) return;
      var brokken = [];
      try { rec = new w.MediaRecorder(stream, { mimeType: soort }); } catch (e) { stop(); return; }
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) brokken.push(ev.data); };
      rec.onstop = function () {
        var blob = new Blob(brokken, { type: soort.split(';')[0] });
        /* EEN RONDE TEGELIJK. Zonder deze rem stapelen de fragmenten zich op bij
           een trage modelserver, en dan loopt de tekst steeds verder achter op
           het gesprek -- wat live ondertiteling per definitie niet is. Een
           overgeslagen ronde is beter dan een baan die een halve minuut achterloopt. */
        if (!bezig && blob.size > 1200) {
          bezig = true;
          verstuur(blob, o.taal).then(function (tekst) {
            bezig = false;
            if (tekst && typeof o.opRegel === 'function') { try { o.opRegel(tekst); } catch (e) {} }
          });
        }
        if (aan) ronde(stream);
      };
      try { rec.start(); } catch (e) { stop(); return; }
      w.setTimeout(function () { if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} } }, STUK_MS);
    }

    return {
      /* Kan dit hier? Twee vragen, en allebei kunnen ze nee zijn om een andere
         reden: heeft deze BROWSER een recorder, en heeft dit HUIS een model. */
      kan: function () {
        if (!soort) return Promise.resolve({ beschikbaar: false,
          reden: 'Deze browser kan geen geluidsfragmenten maken. Meelezen werkt wel.' });
        return stand();
      },
      start: function (stream) {
        if (aan || !soort || !stream) return false;
        aan = true; ronde(stream);
        return true;
      },
      stop: stop,
      get loopt() { return aan; }
    };
  }

  /* DE KNOP, en hij hoort HIER en niet in de baan. Wat hij zegt, wanneer hij
     verschijnt en wat er staat als het niet kan, is een uitspraak over deze
     voorziening -- die hoort op een plek te staan. Vijf gesprekken delen hem via
     shared/meelezen.js, dus vijf kopieen zouden binnen een maand vier
     verschillende teksten dragen.

     HIJ VERSCHIJNT ALLEEN ALS HET ECHT KAN. Kan het niet, dan komt er geen grijze
     knop maar een ZIN met de reden: een ondertitelknop die niets doet laat iemand
     aan een gesprek beginnen in de veronderstelling dat hij het kan volgen. */
  function knop(o) {
    var luister = o.luister;
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'meelees-auto';
    b.hidden = true;
    b.setAttribute('aria-pressed', 'false');
    b.style.cssText = o.stijl || '';
    o.kop.appendChild(b);

    luister.kan().then(function (st) {
      if (!st || !st.beschikbaar) {
        var uitleg = d.createElement('p');
        uitleg.className = 'meelees-geenauto';
        uitleg.style.cssText = 'margin:.35rem 0 0;font-size:.8rem;opacity:.75;';
        uitleg.textContent = 'Automatisch ondertitelen kan hier niet: ' +
          ((st && st.reden) || 'onbekende reden') + ' Typ mee zodat iedereen kan volgen.';
        o.wrap.appendChild(uitleg);
        return;
      }
      b.hidden = false;
      b.textContent = 'Ondertitel mijn stem';
      /* WAT ER WERKELIJK GEBEURT, en niet "het verlaat uw toestel niet" -- dat
         zou onwaar zijn. Het geluid gaat naar de server van RTG en daar naar een
         lokaal model; dat verschil hoort de gebruiker te lezen. */
      b.title = 'Uw stem wordt op de server van RTG omgezet naar tekst met een lokaal model. ' +
        'Het geluid gaat niet naar een andere partij en wordt niet bewaard.';
      b.addEventListener('click', function () {
        if (luister.loopt) {
          luister.stop();
          b.textContent = 'Ondertitel mijn stem';
          b.setAttribute('aria-pressed', 'false');
          return;
        }
        var stroom = typeof o.stroom === 'function' ? o.stroom() : null;
        if (!stroom) return;
        luister.start(stroom);
        b.textContent = 'Ondertitelen stoppen';
        b.setAttribute('aria-pressed', 'true');
        if (typeof o.open === 'function') o.open();
      });
    }).catch(function () {});
    return b;
  }

  w.RTGMeeluister = { maak: maak, knop: knop, STUK_MS: STUK_MS, kanOpnemen: kanOpnemen };
}(window, document));
