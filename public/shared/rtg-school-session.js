/* Tijdelijke schoolsessies voor de professionele werkruimtes.

   School- en personeelssleutels horen niet permanent op een gedeeld gezin-
   of schooltoestel te blijven staan. Daarom gebruikt deze laag uitsluitend
   sessionStorage: sluiten van de tab/browser ruimt de sleutel op. Oude
   localStorage-sessies worden eenmalig overgenomen en direct verwijderd.

   Na dertig minuten zonder activiteit verloopt de sessie ook binnen een open
   tab. De server blijft bij elk verzoek de rol en de sleutel controleren; dit
   bestand is de extra clientgrens, nooit de bron van rechten. */
(function (w) {
  'use strict';
  var MAX_STIL = 30 * 60 * 1000;
  var MERK = 'rtg-school-sessie-v1';

  function pak(k) {
    var raw = null;
    try { raw = sessionStorage.getItem(k); } catch (e) {}
    if (!raw) {
      /* Veilige migratie van de eerdere permanente opslag. */
      try {
        raw = localStorage.getItem(k);
        if (raw) localStorage.removeItem(k);
      } catch (e) {}
      if (raw) {
        try { zet(k, JSON.parse(raw)); } catch (e) { raw = null; }
        try { raw = sessionStorage.getItem(k); } catch (e) { raw = null; }
      }
    }
    if (!raw) return null;
    try {
      var doos = JSON.parse(raw);
      if (!doos || doos.merk !== MERK || !doos.waarde) return null;
      if (Date.now() > doos.verloopt) { weg(k); return null; }
      return doos;
    } catch (e) { weg(k); return null; }
  }

  function zet(k, waarde) {
    if (!waarde) return weg(k);
    try { sessionStorage.setItem(k, JSON.stringify({ merk: MERK, waarde: waarde, verloopt: Date.now() + MAX_STIL })); } catch (e) {}
    try { localStorage.removeItem(k); } catch (e) {}
    return waarde;
  }
  function lees(k) { var d = pak(k); return d ? d.waarde : null; }
  function raak(k) {
    var d = pak(k); if (!d) return false;
    d.verloopt = Date.now() + MAX_STIL;
    try { sessionStorage.setItem(k, JSON.stringify(d)); } catch (e) {}
    return true;
  }
  function weg(k) {
    try { sessionStorage.removeItem(k); } catch (e) {}
    try { localStorage.removeItem(k); } catch (e) {}
  }

  /* Een ontbrekende of verlopen Schoolpas mag de bezoeker niet stil naar een
     ander scherm sturen. Houd het gevraagde klaslokaal op zijn eigen adres,
     verberg de inhoud fail-closed en leg in gewone taal uit hoe de tijdelijke
     toegang opnieuw wordt verkregen. Zo lekt er ook bij een geldige
     gezinssessie zonder Schoolpas geen klasbediening door. */
  function deur(opties) {
    var o = opties || {}, id = 'rtf-school-slot';
    document.documentElement.classList.add('rtf-school-dicht');
    if (!document.getElementById('rtf-school-stijl')) {
      var stijl = document.createElement('style'); stijl.id = 'rtf-school-stijl';
      stijl.textContent = 'html.rtf-school-dicht body>*:not(#rtf-school-slot){visibility:hidden!important}' +
        'html.rtf-school-dicht #rtf-school-slot{visibility:visible!important}' +
        '#rtf-school-slot .rtf-school-kaart{width:min(92vw,34rem);padding:1.35rem;border:1px solid #3a3730;border-radius:18px;background:#151513;box-shadow:0 24px 80px rgba(0,0,0,.55)}' +
        '#rtf-school-slot .rtf-school-merk{font:600 .68rem/1 Inter;letter-spacing:.17em;text-transform:uppercase;color:#c9a24b}' +
        '#rtf-school-slot h1{font:500 1.75rem/1.15 Georgia,serif;margin:.55rem 0}' +
        '#rtf-school-slot p{color:#bdb8ad;line-height:1.55;margin:0 0 1rem}' +
        '#rtf-school-slot .rtf-school-acties{display:flex;gap:.5rem;flex-wrap:wrap}' +
        '#rtf-school-slot a{display:inline-flex;padding:.65rem .85rem;border-radius:10px;text-decoration:none}' +
        '#rtf-school-slot [data-school-open]{background:#f6f1e7;color:#111;font-weight:700}' +
        '#rtf-school-slot [data-school-uitweg]{border:1px solid #4a463d;color:#f6f1e7}';
      (document.head || document.documentElement).appendChild(stijl);
    }
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('dialog'); el.id = id;
      el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483001;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;display:grid;place-items:center;padding:1rem;background:#0c0c0b;color:#f6f1e7;font-family:Inter,system-ui,sans-serif';
      (document.body || document.documentElement).appendChild(el);
    }
    var rol = o.rol === 'docent' ? 'docentenruimte' : 'leerlingruimte';
    el.innerHTML = '<div class="rtf-school-kaart">' +
      '<div class="rtf-school-merk">RTFoundation · tijdelijke Schoolpas</div>' +
      '<h1>Deze ' + rol + ' blijft nog dicht</h1>' +
      '<p>Open de les via Leren. De klascode en sleutel blijven alleen in deze tab staan en verlopen automatisch na dertig minuten zonder activiteit.</p>' +
      '<div class="rtf-school-acties"><a data-school-open href="/apps/foundation/leren.html">Naar Leren</a>' +
      '<a data-school-uitweg href="/apps/app.html">Naar RTG OS</a></div></div>';
    try { if (!el.open) el.showModal(); } catch (e) {}
    return el;
  }
  function bewaak(sleutels, verlopen) {
    sleutels = sleutels || [];
    var laatste = 0;
    function actief() {
      var nu = Date.now(); if (nu - laatste < 15000) return;
      laatste = nu; sleutels.forEach(raak);
    }
    ['pointerdown', 'keydown', 'focus'].forEach(function (soort) { addEventListener(soort, actief, { passive: true }); });
    var klok = setInterval(function () {
      var had = false, heeft = false;
      sleutels.forEach(function (k) {
        try { if (sessionStorage.getItem(k)) had = true; } catch (e) {}
        if (pak(k)) heeft = true;
      });
      if (had && !heeft && verlopen) verlopen();
    }, 30000);
    return function () { clearInterval(klok); };
  }

  w.RTGSchoolSession = { lees: lees, zet: zet, raak: raak, weg: weg, deur: deur, bewaak: bewaak, maxStil: MAX_STIL };
})(window);
