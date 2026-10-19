/* De beeldeditor van de TravelOS-Cover, als ds-dialoog (#beeldDialoog in
   reizen.html). Dezelfde werking, grenzen en teksten als
   shared/interface/personal-image-editor.js: eigen foto's kiezen of uploaden
   (JPG, PNG of WebP, hoogstens 15 MB, in stukken van 3 MB), een uitsnede voor
   desktop en een voor mobiel, opslaan of terug naar het RTG-beeld. Alleen
   eigen, niet verwijderde bestanden staan in de keuze; het raakt nooit media
   die een ander heeft gepubliceerd. Het voorbeeld is hetzelfde SVG-vlak als de
   Cover, dus wat u hier ziet, staat daar straks ook. */
(function (w, d) {
  'use strict';
  var B = w.RTGReizenBeeld, dlg = d.getElementById('beeldDialoog');
  if (!B || !dlg) return;
  function $(id) { return d.getElementById(id); }
  var vlak = $('beeldVlak'), kader = $('beeldSnede'), status = $('beeldStatus'), galerij = $('beeldGalerij');
  var upload = $('beeldUpload'), uploadKnop = $('beeldUploadKnop'), bewaar = $('beeldBewaar');
  var knoppen = { desktop: $('beeldDesktop'), mobile: $('beeldMobiel') };
  var invoer = { zoom: $('beeldZoom'), x: $('beeldX'), y: $('beeldY') };
  var concept = null, bron = '', view = 'desktop', revisie = 0, bezig = false, trigger = null, sleep = null;

  function zeg(t) { status.textContent = t; }
  function teken() {
    var c = concept ? concept[view] : { x: 50, y: 50, zoom: 1 };
    kader.setAttribute('data-ds-snede', view === 'mobile' ? 'mobiel' : 'desktop');
    B.zet(vlak, bron || B.origineel, c).catch(function () {});
    Object.keys(invoer).forEach(function (k) { invoer[k].value = c[k]; invoer[k].disabled = !concept; });
    Object.keys(knoppen).forEach(function (k) { knoppen[k].setAttribute('aria-pressed', String(view === k)); });
  }
  function kiesHuidig() {
    var seq = ++revisie, keuze = B.keuze();
    concept = keuze ? JSON.parse(JSON.stringify(keuze)) : null; bron = B.origineel; teken();
    if (concept) B.bestand(concept.file).then(function (url) { if (seq === revisie) { bron = url; teken(); } }).catch(function (e) { zeg(e.message); });
  }
  function herstel() { revisie++; concept = null; bron = B.origineel; teken(); zeg('RTG-beeld gekozen. Kies Opslaan om dit te bevestigen.'); }
  function kies(id) {
    var seq = ++revisie; zeg('Foto laden…');
    return B.bestand(id).then(function (url) {
      if (seq !== revisie) return;
      bron = url; concept = { file: id, desktop: { x: 50, y: 50, zoom: 1 }, mobile: { x: 50, y: 50, zoom: 1 } }; teken(); zeg('');
    }).catch(function (e) { zeg(e.message); });
  }
  function mijn() {
    if (!B.ingelogd()) { zeg('Log in met uw RTG-account om uw foto’s te gebruiken.'); return; }
    zeg('Uw foto’s laden…');
    B.api('/api/bestanden/mijn').then(function (j) {
      galerij.textContent = '';
      var lijst = j.items.filter(function (f) { return f.vanMij && !f.weg && /^image\/(jpeg|png|webp|gif)$/.test(f.mime); });
      lijst.slice(0, 60).forEach(function (f) {
        var b = d.createElement('button'), naam = d.createElement('span');
        b.type = 'button'; b.className = 'ds-keuze'; naam.textContent = f.naam; b.appendChild(naam);
        b.addEventListener('click', function () { kies(f.id); }); galerij.appendChild(b);
        B.bestand(f.id).then(function (url) { var t = d.createElement('img'); t.className = 'ds-kaart__beeld'; t.src = url; t.alt = ''; b.prepend(t); })
          .catch(function () { b.disabled = true; });
      });
      zeg(lijst.length ? '' : 'Nog geen eigen foto’s. Kies Upload foto.');
    }).catch(function (e) { zeg(e.message); });
  }
  function sluit() {
    revisie++; sleep = null;
    if (dlg.open) dlg.close();
    if (trigger && trigger.isConnected) trigger.focus();
  }
  function open() {
    trigger = d.activeElement; bezig = false; view = B.weergave(); galerij.textContent = ''; zeg('');
    kiesHuidig();
    bewaar.disabled = !B.ingelogd(); uploadKnop.disabled = !B.ingelogd();
    if (!B.ingelogd()) zeg('Log in met uw RTG-account om persoonlijke beelden te bewaren.');
    if (!dlg.open) dlg.showModal();
  }

  $('beeldWijzig').addEventListener('click', function (e) { e.preventDefault(); open(); });
  $('beeldSluit').addEventListener('click', sluit); $('beeldAnnuleer').addEventListener('click', sluit);
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); sluit(); });
  d.addEventListener('rtg-beeld-wissel', function () { if (dlg.open) sluit(); });
  $('beeldMijn').addEventListener('click', mijn);
  $('beeldStandaard').addEventListener('click', herstel); $('beeldHerstel').addEventListener('click', herstel);
  uploadKnop.addEventListener('click', function () { upload.click(); });
  knoppen.desktop.addEventListener('click', function () { view = 'desktop'; teken(); });
  knoppen.mobile.addEventListener('click', function () { view = 'mobile'; teken(); });
  Object.keys(invoer).forEach(function (k) {
    invoer[k].addEventListener('input', function () { if (!concept) return; concept[view][k] = Number(invoer[k].value); teken(); });
  });
  bewaar.addEventListener('click', function () {
    if (bezig) return; bezig = true; bewaar.disabled = true; zeg('Opslaan…');
    B.bewaar(concept).then(function () { if (dlg.open) sluit(); }).catch(function (e) { zeg(e.message); })
      .finally(function () { bezig = false; bewaar.disabled = !B.ingelogd(); });
  });
  upload.addEventListener('change', function () {
    var f = upload.files[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) { zeg('Kies een JPG-, PNG- of WebP-foto van maximaal 15 MB.'); return; }
    uploadKnop.disabled = true; bewaar.disabled = true; zeg('Foto veilig uploaden…');
    w.RTGBestandUpload(f, function (actie, body) { return B.api('/api/bestanden/' + actie, body).then(function (j) { return { status: 200, body: j }; }); }, { chunkBytes: 3 * 1024 * 1024 })
      .then(function (j) { return kies(j.body.id); })
      .catch(function (e) { zeg(e.message); })
      .finally(function () { uploadKnop.disabled = !B.ingelogd(); bewaar.disabled = !B.ingelogd(); upload.value = ''; });
  });
  /* Slepen verschuift het brandpunt, net als in de oude editor. */
  kader.addEventListener('pointerdown', function (e) {
    if (!concept) return; sleep = { x: e.clientX, y: e.clientY, cx: concept[view].x, cy: concept[view].y }; kader.setPointerCapture(e.pointerId);
  });
  kader.addEventListener('pointermove', function (e) {
    if (!sleep || !concept) return;
    concept[view].x = Math.max(0, Math.min(100, sleep.cx - (e.clientX - sleep.x) / kader.clientWidth * 100));
    concept[view].y = Math.max(0, Math.min(100, sleep.cy - (e.clientY - sleep.y) / kader.clientHeight * 100)); teken();
  });
  ['pointerup', 'pointercancel'].forEach(function (t) { kader.addEventListener(t, function () { sleep = null; }); });
})(window, document);
