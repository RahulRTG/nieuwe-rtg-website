/* Muisvrij bedienen, deel 6: de camera in de balk.

   Twee dingen die dicht bij elkaar liggen maar niet hetzelfde zijn, en die
   daarom ook twee knoppen zijn:

     KIJK   je richt op iets en Rahul zegt wat het is. De foto gaat een keer
            naar het model en wordt nergens bewaard.
     DEEL   je maakt of kiest een foto en zet hem ergens neer (De Salon, een
            vriend). WAAR dat kan vraagt dit bestand aan de server, want dat
            hangt af van de pas en van wie je kent; een lijstje in de app zou
            dat raden en dus soms mis hebben.

   Het verschil is niet cosmetisch. Bij KIJK gaat het beeld het toestel uit en
   dat staat er ook bij. Bij DEEL kies JIJ waar het heen gaat; Rahul plaatst
   nooit iets uit zichzelf. Dat laatste is geen beleefdheid maar de grens: een
   assistent die zelf foto's plaatst, plaatst er ooit een die niet had gemoeten.

   Geen extra rechten, geen open camera: elke opname begint met een tik van de
   gebruiker op een <input type="file" capture>. Dat is bewust geen live
   camerabeeld -- dan zou hij "aan" kunnen blijven staan. */
(function (root) {
  'use strict';
  if (root.__handenvrijOog) return; root.__handenvrijOog = true;
  var kamer = root.__handenvrijKamer;
  if (!kamer || !kamer.vak) return;
  var memTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  if (!memTok) return;                        // alleen voor leden

  var css = '.hv-oog{display:flex;gap:.4rem;flex-wrap:wrap;margin:.2rem 0 .4rem;}' +
    '.hv-oog .hv-sk{flex:0 0 auto;}' +
    '.hv-foto{max-width:min(220px,60%);border-radius:12px;border:1px solid #2f2c29;display:block;margin:.2rem 0;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* Een foto ophalen via een verborgen bestandsveld. `camera` bepaalt of de
     telefoon meteen de camera opent of eerst de bibliotheek toont. */
  function vraagFoto(camera) {
    return new Promise(function (klaar) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      if (camera) inp.setAttribute('capture', 'environment');
      inp.style.display = 'none';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        inp.remove();
        if (!f) return klaar(null);
        klein(f).then(klaar).catch(function () { klaar(null); });
      });
      document.body.appendChild(inp);
      inp.click();
    });
  }

  /* Verkleinen op het TOESTEL, niet op de server. Een foto van een moderne
     telefoon is zo 5 MB; dat is zonde van de verbinding van de gebruiker en
     het model heeft er niets aan. 1280 px lange zijde is ruim genoeg om te
     zien wat iets is. */
  function klein(file) {
    return new Promise(function (klaar, mis) {
      var lezer = new FileReader();
      lezer.onerror = mis;
      lezer.onload = function () {
        var img = new Image();
        img.onerror = mis;
        img.onload = function () {
          var max = 1280;
          var s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          klaar(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = lezer.result;
      };
      lezer.readAsDataURL(file);
    });
  }

  function api(pad, body) {
    return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memTok }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Dat lukte niet.'); return d; }); });
  }
  function zeg(t) { if (kamer.beurt) kamer.beurt('rahul', t); }

  /* ---------- kijk: wat is dit? ---------- */
  function toonFoto(dataUrl) {
    // dit is geen antwoord maar een aanzet: het paneel hoort niet weg te zakken
    kamer.geenZak = true;
    var rij = kamer.beurt ? kamer.beurt('member', 'Kijk hier eens naar.') : null;
    kamer.geenZak = false;
    if (!rij) return;
    var img = document.createElement('img');
    img.className = 'hv-foto'; img.src = dataUrl; img.alt = 'De foto die je net maakte';
    var bel = rij.querySelector('.hv-bel');
    if (bel) bel.insertBefore(img, bel.firstChild);
  }
  async function kijk() {
    var foto = await vraagFoto(true);
    if (!foto) return;
    toonFoto(foto);
    if (kamer.tikt) kamer.tikt(true);
    try { var d = await api('/api/rahul/kijk', { foto: foto, vraag: 'Wat is dit?' }); zeg(d.tekst); }
    catch (e) { zeg(e.message); }
    finally { if (kamer.tikt) kamer.tikt(false); }
  }

  /* ---------- deel: waar mag deze foto heen? ---------- */
  async function deel() {
    var foto = await vraagFoto(false);
    if (!foto) return;
    toonFoto(foto);
    var d;
    try { d = await api('/api/rahul/plekken', {}); }
    catch (e) { return zeg(e.message); }
    var plekken = (d.plekken || []).filter(function (p) { return p.id === 'salon'; });
    if (!plekken.length) return zeg('Er is nu geen plek waar deze foto heen kan.');
    /* Bewust maar EEN knop per bestemming en geen automatische keuze: het
       versturen is jouw handeling, niet die van Rahul. */
    var rij = kamer.beurt('rahul', 'Waar wil je hem hebben? ' + (d.noot || ''));
    if (!rij) return;
    var vak = document.createElement('div');
    vak.className = 'hv-oog';
    plekken.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'hv-sk'; b.type = 'button'; b.textContent = p.naam;
      b.title = p.uitleg;
      b.addEventListener('click', async function () {
        b.disabled = true;
        try { await api('/api/member/story/post', { foto: foto, tekst: '' }); zeg('Staat in De Salon, 24 uur zichtbaar voor je connecties.'); }
        catch (e) { zeg(e.message); b.disabled = false; }
      });
      vak.appendChild(b);
    });
    var bel = rij.querySelector('.hv-bel');
    if (bel) bel.appendChild(vak);
  }

  /* ---------- de knoppen in de greep ---------- */
  function hang() {
    var greep = root.RTGChatScherm && root.RTGChatScherm.greep;
    if (!greep) return false;                  // schermlaag nog niet klaar
    if (greep.querySelector('[data-kijk]')) return true;
    var mk = function (naam, label, titel, doen) {
      var b = document.createElement('button');
      b.className = 'hv-sk'; b.type = 'button'; b.textContent = label;
      b.title = titel; b.setAttribute(naam, '');
      b.addEventListener('click', doen);
      return b;
    };
    var eerste = greep.querySelector('button');
    greep.insertBefore(mk('data-deel', 'Deel', 'Een foto ergens neerzetten', deel), eerste);
    greep.insertBefore(mk('data-kijk', 'Kijk', 'Foto maken; Rahul zegt wat het is', kijk), eerste);
    return true;
  }
  // de schermlaag kan een tel later klaar zijn; even geduld, dan opgeven
  if (!hang()) {
    var pogingen = 0;
    var t = setInterval(function () { if (hang() || ++pogingen > 20) clearInterval(t); }, 100);
  }
  kamer.camera = { kijk: kijk, deel: deel };
})(typeof self !== 'undefined' ? self : this);
