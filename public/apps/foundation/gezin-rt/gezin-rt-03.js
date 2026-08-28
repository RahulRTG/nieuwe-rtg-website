/* Gezin-RT, deel 3: HET GESPREKSSCHERM zelf -- de stijl en de opbouw van de
   overlay, plus de tekstbaan erin (shared/meelezen.js).

   Stond in deel 2, en is er afgeknipt toen dat deel met die baan erbij over de
   tienkilobytelat ging. De naad is een echte: deel 2 voert het GESPREK (seinen,
   verbinding, op- en ophangen), dit deel bepaalt hoe het ERUITZIET. De delen
   worden op naam gesorteerd aan elkaar geplakt binnen dezelfde omhulsel-functie,
   dus `injectUI()` ziet `call`, `mee` en `seinNaar` gewoon staan. */
  function injectUI() {
    if (ingezet) return; ingezet = true;
    var css = '#grt-call,#grt-incoming{position:fixed;inset:0;z-index:9999;background:#0C0C0B;color:#F7F5F1;display:none;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;}' +
      '#grt-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}' +
      '#grt-local{position:absolute;right:14px;top:14px;width:88px;height:120px;object-fit:cover;border-radius:12px;border:2px solid rgba(255,255,255,.5);z-index:2;background:#111;}' +
      '#grt-av{width:96px;height:96px;border-radius:50%;background:#2a2417;display:flex;align-items:center;justify-content:center;font-size:2.6rem;z-index:1;}' +
      '#grt-naam,#grt-inaam{font-size:1.5rem;margin-top:1rem;z-index:1;}#grt-status,#grt-isoort{color:#A79F92;margin-top:.3rem;z-index:1;font-family:Arial,sans-serif;font-size:.9rem;}' +
      '#grt-tijd{position:absolute;top:20px;left:0;right:0;text-align:center;color:#fff;z-index:2;font-family:Arial,sans-serif;}' +
      '.grt-knoppen{position:absolute;bottom:40px;display:flex;gap:1.2rem;z-index:3;}' +
      '.grt-b{width:60px;height:60px;border-radius:50%;border:none;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:#2a2724;}' +
      '.grt-b.weg{background:#B4574E;}.grt-b.op{background:#5FA56A;}.grt-b.dicht{background:#5a4;opacity:.6;}' +
      '#grt-iav{width:110px;height:110px;border-radius:50%;background:#2a2417;display:flex;align-items:center;justify-content:center;font-size:3rem;}' +
      /* De tekstbaan hangt boven de knoppenrij en onder het beeld: wie meeleest
         kijkt naar het gesprek en niet ernaast (shared/meelezen.js). */
      '#grt-mee{position:absolute;left:14px;right:14px;bottom:112px;z-index:4;color:#F7F5F1;font-family:Arial,sans-serif;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="grt-call"><video id="grt-remote" autoplay playsinline></video><video id="grt-local" autoplay playsinline muted></video>' +
      '<div id="grt-tijd"></div><div id="grt-av"></div><div id="grt-naam"></div><div id="grt-status"></div>' +
      '<div class="grt-knoppen"><button class="grt-b" id="grt-mute" title="Microfoon"></button><button class="grt-b" id="grt-cam" title="Camera"></button><button class="grt-b weg" id="grt-weg" title="Ophangen"></button></div>' +
      '<div id="grt-mee"></div></div>' +
      '<div id="grt-incoming"><div id="grt-iav"></div><div id="grt-inaam"></div><div id="grt-isoort"></div>' +
      '<div class="grt-knoppen"><button class="grt-b weg" id="grt-nee"></button><button class="grt-b op" id="grt-ja"></button></div></div>';
    document.body.appendChild(wrap);
    /* MEELEZEN. Zonder tekstbaan kan wie doof is niet meedoen aan dit gesprek
       (TOEGANKELIJK.md). Wat erin staat is getypt door een mens en niet uit
       spraak herkend -- zie de kop van shared/meelezen.js. */
    if (w.RTGMeelezen) {
      mee = w.RTGMeelezen.maak({ stuur: function (regel) { if (call) seinNaar(call.met, 'tekst', { r: regel }); } });
      var meeVak = document.getElementById('grt-mee'); if (meeVak) meeVak.appendChild(mee.el);
    }
    document.getElementById('grt-weg').onclick = function () { eindeGesprek(true); };
    document.getElementById('grt-ja').onclick = neemOp;
    document.getElementById('grt-nee').onclick = function () { document.getElementById('grt-incoming').style.display = 'none'; if (inkomend) seinNaar(inkomend.van, 'decline'); inkomend = null; };
    document.getElementById('grt-mute').onclick = function () { if (!call) return; var t = call.stream.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; this.classList.toggle('dicht', !t.enabled); };
    document.getElementById('grt-cam').onclick = function () { if (!call) return; var t = call.stream.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled; this.classList.toggle('dicht', !t.enabled); };
  }

