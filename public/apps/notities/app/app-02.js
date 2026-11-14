  /* ---- de editor ---- */
  var terugFocus = null;
  function openEditor() {
    var laag = $('#ntScrim');
    if (laag.open) return;
    terugFocus = document.activeElement; $('#ntMelding').textContent = '';
    laag.classList.add('open'); laag.showModal(); $('#ntTitel').focus();
  }
  function alle() { return (stand.eigen || []).concat(stand.gedeeld || []); }
  function toon(id) {
    if ($('#ntScrim').open || saving) return;
    open = alle().find(function (n) { return n.id === id; });
    if (!open) return;
    open = JSON.parse(JSON.stringify(open));
    vul();
    openEditor();
  }
  function nieuw(soort) {
    if ($('#ntScrim').open || saving) return;
    open = { soort: soort, titel: '', tekst: '', items: [], vanMij: true };
    vul();
    openEditor();
  }
  function vul() {
    $('#ntTitel').value = open.titel || '';
    $('#ntTekstWrap').hidden = open.soort !== 'notitie';
    $('#ntLijstWrap').hidden = open.soort !== 'lijst';
    $('#ntTekst').value = open.tekst || '';
    $('#ntDatum').value = open.herinnerOp || '';
    $('#ntTijd').value = open.herinnerTijd || '';
    window.RTGDailyFields.set($('#ntVast'), open.vast ? 'unpin' : 'pin');
    window.RTGDailyFields.set($('#ntArchief'), open.archief ? 'restoreNote' : 'archiveAction');
    // vastpinnen, archief en delen zijn van de eigenaar; samen bewerken niet
    ['ntVast', 'ntArchief'].forEach(function (id) { $('#' + id).style.display = open.vanMij ? '' : 'none'; });
    $('#ntDeelWrap').style.display = open.vanMij && open.id ? '' : 'none';
    $('#ntWeg').textContent = open.vanMij ? 'Verwijder' : 'Haal mij eraf';
    $('#ntWeg').style.display = open.id ? '' : 'none';
    $('#ntGedeeld').textContent = (open.gedeeldMet || []).length
      ? 'Samen met: ' + open.gedeeldMet.join(', ') : '';
    tekenTaken();
  }
  function tekenTaken() {
    $('#ntTaken').innerHTML = (open.items || []).map(function (x, i) {
      return '<div class="taakrij ds-dag-taakrij"><input type="checkbox" data-i="' + i + '"' + (x.af ? ' checked' : '') +
        ' aria-label="Afvinken"><input class="t ds-invoer' + (x.af ? ' af' : '') + '" data-t="' + i + '" value="' + esc(x.t) + '" maxlength="200">' +
        '<button class="weg" data-w="' + i + '" aria-label="Punt weghalen" title="Punt weghalen">&#10005;</button></div>';
    }).join('');
    Array.prototype.forEach.call($('#ntTaken').querySelectorAll('[data-i]'), function (el) {
      el.addEventListener('change', function () { open.items[+el.dataset.i].af = el.checked; tekenTaken(); });
    });
    Array.prototype.forEach.call($('#ntTaken').querySelectorAll('[data-t]'), function (el) {
      el.addEventListener('input', function () { open.items[+el.dataset.t].t = el.value; });
    });
    Array.prototype.forEach.call($('#ntTaken').querySelectorAll('[data-w]'), function (el) {
      el.addEventListener('click', function () { open.items.splice(+el.dataset.w, 1); tekenTaken(); });
    });
  }
  $('#ntNieuwTaak').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !this.value.trim()) return;
    e.preventDefault();
    (open.items = open.items || []).push({ t: this.value.trim(), af: false });
    this.value = '';
    tekenTaken();
  });
  var saving = false;
  function bewaar(extra) {
    if (saving || !open) return Promise.resolve(null);
    saving = true;
    var b = Object.assign({ id: open.id, soort: open.soort, titel: $('#ntTitel').value,
      tekst: $('#ntTekst').value, items: open.items,
      herinnerOp: $('#ntDatum').value || null, herinnerTijd: $('#ntTijd').value || null }, extra || {});
    return api('bewaar', b).then(function (r) {
      if (r.status !== 200 || r.body.error || !r.body.id) { meld(r.body.error || window.RTGDailyCopy.value('failed')); return null; }
      return r.body.id;
    }).finally(function () { saving = false; });
  }
  $('#ntBewaar').addEventListener('click', function () {
    var doel = open; bewaar().then(function (id) { if (id) { if (open === doel) { meld('Bewaard.'); dicht(); } laad(); } });
  });
  $('#ntVast').addEventListener('click', function () {
    if (!open) return;
    var doel = open; bewaar({ vast: !open.vast }).then(function (id) { if (id) { if (open === doel) dicht(); laad(); } });
  });
  $('#ntArchief').addEventListener('click', function () {
    if (!open) return;
    var doel = open; bewaar({ archief: !open.archief }).then(function (id) { if (id) { if (open === doel) { meld(doel.archief ? 'Terug op het bord.' : 'Gearchiveerd; niets is weg.'); dicht(); } laad(); } });
  });
  $('#ntWeg').addEventListener('click', function () {
    if (!open) return;
    if (!confirm(open.vanMij ? 'Deze notitie verwijderen?' : 'Uzelf van deze gedeelde notitie halen?')) return;
    var doel = open; api('weg', { id: open.id }).then(function (r) {
      if (r.status !== 200 || r.body.error) {
        // Een late fout hoort niet in een inmiddels geopende andere notitie.
        if (!open || open === doel) meld(r.body.error || window.RTGDailyCopy.value('failed'));
        return;
      }
      if (open === doel) dicht();
      laad();
    });
  });
  $('#ntDeel').addEventListener('click', function () {
    if (!open) return;
    var code = $('#ntCode').value.trim();
    if (!code || !open.id) return;
    var doel = open; api('deel', { id: open.id, codenaam: code }).then(function (r) {
      if (open !== doel) return;
      if (r.status !== 200 || r.body.error) return meld(r.body.error || window.RTGDailyCopy.value('failed'));
      $('#ntCode').value = '';
      open.gedeeldMet = r.body.gedeeldMet || [];
      $('#ntGedeeld').textContent = 'Samen met: ' + open.gedeeldMet.join(', ');
      meld('Gedeeld; jullie werken nu samen in deze notitie.');
    });
  });
  function dicht() {
    var laag = $('#ntScrim'); laag.classList.remove('open'); if (laag.open) laag.close(); open = null;
    if (terugFocus && terugFocus.isConnected) terugFocus.focus({ preventScroll: true });
    terugFocus = null;
  }
  $('#ntScrim').addEventListener('cancel', function (e) { e.preventDefault(); dicht(); });
  $('#ntDicht').addEventListener('click', dicht);
  $('#nieuwNotitie').addEventListener('click', function () { nieuw('notitie'); });
  $('#nieuwLijst').addEventListener('click', function () { nieuw('lijst'); });

  /* De handgreep voor de gebarenlaag (apps/notities/gebaren.js). Het bord houdt
     zijn eigen staat -- welke notities er liggen en of het archief open staat --
     en de veeg heeft allebei nodig. Apart bestand, zelfde reden als bij de kluis
     en de post: de bediening van een scherm hoort niet door het scherm zelf
     heen te lopen. */
  window.RTGNotities = { api: api, laad: laad, meld: meld,
    archief: function () { return archief; },
    notitie: function (id) {
      return (stand && (stand.eigen || []).filter(function (n) { return n.id === id; })[0]) || null;
    } };
  if (!token) window.RTGDaily.render('notities', 'guest'); else laad();
})();
