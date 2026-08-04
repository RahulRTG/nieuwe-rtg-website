  /* ---- de editor ---- */
  function alle() { return (stand.eigen || []).concat(stand.gedeeld || []); }
  function toon(id) {
    open = alle().find(function (n) { return n.id === id; });
    if (!open) return;
    open = JSON.parse(JSON.stringify(open));
    vul();
    $('#ntScrim').classList.add('open');
  }
  function nieuw(soort) {
    open = { soort: soort, titel: '', tekst: '', items: [], vanMij: true };
    vul();
    $('#ntScrim').classList.add('open');
    $('#ntTitel').focus();
  }
  function vul() {
    $('#ntTitel').value = open.titel || '';
    $('#ntTekstWrap').style.display = open.soort === 'notitie' ? '' : 'none';
    $('#ntLijstWrap').style.display = open.soort === 'lijst' ? '' : 'none';
    $('#ntTekst').value = open.tekst || '';
    $('#ntDatum').value = open.herinnerOp || '';
    $('#ntTijd').value = open.herinnerTijd || '';
    $('#ntVast').textContent = open.vast ? 'Losmaken' : 'Vastpinnen';
    $('#ntArchief').textContent = open.archief ? 'Terug op het bord' : 'Archiveer';
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
      return '<div class="taakrij"><input type="checkbox" data-i="' + i + '"' + (x.af ? ' checked' : '') +
        ' aria-label="Afvinken"><input class="t' + (x.af ? ' af' : '') + '" data-t="' + i + '" value="' + esc(x.t) + '" maxlength="200">' +
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
  function bewaar(extra) {
    var b = Object.assign({ id: open.id, soort: open.soort, titel: $('#ntTitel').value,
      tekst: $('#ntTekst').value, items: open.items,
      herinnerOp: $('#ntDatum').value || null, herinnerTijd: $('#ntTijd').value || null }, extra || {});
    return api('bewaar', b).then(function (r) {
      if (r.body.error) { meld(r.body.error); return null; }
      return r.body.id;
    });
  }
  $('#ntBewaar').addEventListener('click', function () {
    bewaar().then(function (id) { if (id) { meld('Bewaard.'); dicht(); laad(); } });
  });
  $('#ntVast').addEventListener('click', function () {
    bewaar({ vast: !open.vast }).then(function (id) { if (id) { dicht(); laad(); } });
  });
  $('#ntArchief').addEventListener('click', function () {
    bewaar({ archief: !open.archief }).then(function (id) { if (id) { meld(open.archief ? 'Terug op het bord.' : 'Gearchiveerd; niets is weg.'); dicht(); laad(); } });
  });
  $('#ntWeg').addEventListener('click', function () {
    if (!confirm(open.vanMij ? 'Deze notitie verwijderen?' : 'Uzelf van deze gedeelde notitie halen?')) return;
    api('weg', { id: open.id }).then(function () { dicht(); laad(); });
  });
  $('#ntDeel').addEventListener('click', function () {
    var code = $('#ntCode').value.trim();
    if (!code || !open.id) return;
    api('deel', { id: open.id, codenaam: code }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      $('#ntCode').value = '';
      open.gedeeldMet = r.body.gedeeldMet || [];
      $('#ntGedeeld').textContent = 'Samen met: ' + open.gedeeldMet.join(', ');
      meld('Gedeeld; jullie werken nu samen in deze notitie.');
    });
  });
  function dicht() { $('#ntScrim').classList.remove('open'); open = null; }
  $('#ntDicht').addEventListener('click', dicht);
  $('#nieuwNotitie').addEventListener('click', function () { nieuw('notitie'); });
  $('#nieuwLijst').addEventListener('click', function () { nieuw('lijst'); });

  if (!token) meld('Log eerst in op de leden-app.'); else laad();
})();
