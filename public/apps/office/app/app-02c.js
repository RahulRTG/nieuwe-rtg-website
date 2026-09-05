
  /* ---------- live samenwerking en documentbeleid ---------- */
  var samenT = null, typenT = null, samenStand = null, laatsteTypMelding = 0;
  var samenClient = (function () {
    var sleutel = '';
    try { sleutel = sessionStorage.getItem('rtg_office_venster') || ''; } catch (e) {}
    if (!sleutel) {
      sleutel = RTGId('office');
      try { sessionStorage.setItem('rtg_office_venster', sleutel); } catch (e) {}
    }
    return sleutel;
  })();

  function samenAnkerNu() {
    if (!open) return 'Geheel document';
    if (open.soort === 'blad' && blad) return 'Cel ' + blad.actief();
    if (open.soort === 'presentatie' && pres) {
      var nr = pres.actief() + 1, d = pres.dias()[pres.actief()] || {};
      return 'Dia ' + nr + (d.titel ? ' · ' + d.titel.slice(0, 72) : '');
    }
    if (open.soort === 'tekst') {
      var sel = window.getSelection && window.getSelection();
      var tekst = sel ? String(sel.toString() || '').replace(/\s+/g, ' ').trim() : '';
      var knoop = sel && sel.anchorNode;
      if (tekst && knoop && $('#tekst').contains(knoop)) return 'Tekst · “' + tekst.slice(0, 78) + (tekst.length > 78 ? '…' : '') + '”';
      return 'Geheel document';
    }
    return NAAM_SOORT[open.soort] || 'Geheel document';
  }

  function meldAanwezig(standNu) {
    if (!open) return Promise.resolve(null);
    var did = open.id;
    return api('aanwezig', { id: did, client: samenClient, stand: standNu || 'bekijkt' }).then(function (r) {
      if (!open || open.id !== did || r.status !== 200) return null;
      samenStand = r.body; tekenSamenKop();
      if ($('#samenScrim').classList.contains('open')) tekenSamen();
      return r.body;
    });
  }
  function meldTypen() {
    if (!open || !magBewerken) return;
    var nuMs = Date.now();
    if (nuMs - laatsteTypMelding > 1800) { laatsteTypMelding = nuMs; meldAanwezig('typt'); }
    clearTimeout(typenT);
    typenT = setTimeout(function () { meldAanwezig('bewerkt'); }, 2600);
  }
  function startSamen() {
    clearInterval(samenT); clearTimeout(typenT); samenStand = null;
    $('#samenLabel').textContent = 'Verbinden…';
    meldAanwezig(magBewerken ? 'bewerkt' : 'bekijkt');
    samenT = setInterval(function () { meldAanwezig(presLoop ? 'presenteert' : (magBewerken ? 'bewerkt' : 'bekijkt')); }, 15000);
  }
  function stopSamen() {
    clearInterval(samenT); clearTimeout(typenT); samenT = null; typenT = null; samenStand = null;
    $('#samenLabel').textContent = 'Alleen u'; $('#samenBtn').dataset.typt = '0';
    $('#samenScrim').classList.remove('open');
  }
  function samenVervers() {
    if (!open) return Promise.resolve(null);
    var did = open.id;
    return api('samen', { id: did }).then(function (r) {
      if (!open || open.id !== did || r.status !== 200) return null;
      samenStand = r.body; tekenSamenKop(); tekenSamen(); return r.body;
    });
  }
  function tekenSamenKop() {
    var rij = (samenStand && samenStand.aanwezig) || [];
    var typt = rij.find(function (p) { return p.stand === 'typt'; });
    $('#samenBtn').dataset.typt = typt ? '1' : '0';
    $('#samenLabel').textContent = typt ? typt.naam + ' typt'
      : rij.length > 1 ? rij.length + ' aanwezig'
      : (samenStand && samenStand.openActies) ? samenStand.openActies + ' open actie' + (samenStand.openActies === 1 ? '' : 's')
      : 'Alleen u';
  }
  function samenDatum(s) {
    if (!s) return '';
    try { return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function tekenSamen() {
    if (!samenStand) return;
    var beheer = samenStand.beheer || {};
    var mensen = samenStand.aanwezig || [];
    $('#samenAanwezig').innerHTML = mensen.length ? mensen.map(function (p) {
      return '<span class="office-persoon" data-stand="' + esc(p.stand) + '"><b>' + esc(p.naam) + '</b> · ' + esc(p.stand) + '</span>';
    }).join('') : '<span>Niemand anders in dit document.</span>';
    $('#samenBeleid').innerHTML = '<span class="office-policychip">' + esc(beheer.classificatie || 'intern') + '</span>' +
      '<span class="office-policychip">bewaren: ' + esc(beheer.bewaartermijn || '7jaar') + '</span>' +
      (beheer.herzienOp ? '<span class="office-policychip">herzien: ' + esc(beheer.herzienOp) + '</span>' : '') +
      (beheer.tags || []).map(function (t) { return '<span class="office-policychip">#' + esc(t) + '</span>'; }).join('');
    $('#samenAantal').textContent = samenStand.openActies + ' open';
    $('#opmerkingLijst').innerHTML = (samenStand.opmerkingen || []).length
      ? samenStand.opmerkingen.map(function (o) {
        var meta = [o.actiehouder ? 'voor ' + o.actiehouder : '', o.voor ? 'deadline ' + o.voor : ''].filter(Boolean).join(' · ');
        return '<article class="office-opmerking" data-opgelost="' + (o.opgelost ? '1' : '0') + '"><div>' +
          '<div class="office-opmerkingkop"><b>' + esc(o.door) + '</b><span>' + esc(samenDatum(o.gemaakt)) + '</span>' +
          (meta ? '<span>' + esc(meta) + '</span>' : '') + (o.opgelost ? '<span>opgelost door ' + esc(o.opgelostDoor) + '</span>' : '') + '</div>' +
          '<p>' + esc(o.tekst) + '</p>' + (o.anker ? '<p class="office-opmerkinganker">' + esc(o.anker) + '</p>' : '') + '</div>' +
          (o.magBeheren ? '<div class="office-opmerkingactie"><button class="mini" type="button" data-opmerking="' + esc(o.id) + '" data-actie="' +
            (o.opgelost ? 'heropen">Heropen' : 'oplos">Oplossen') + '</button></div>' : '') + '</article>';
      }).join('') : '<p class="stil">Nog geen opmerkingen. Dit document kan zonder open eindjes door.</p>';
    Array.prototype.forEach.call($('#opmerkingLijst').querySelectorAll('[data-opmerking]'), function (b) {
      b.addEventListener('click', function () { wijzigOpmerking(b.dataset.opmerking, b.dataset.actie); });
    });
    $('#beheerBlok').style.display = samenStand.eigenaar ? '' : 'none';
    if (samenStand.eigenaar) {
      $('#beheerClassificatie').value = beheer.classificatie || 'intern';
      $('#beheerTermijn').value = beheer.bewaartermijn || '7jaar';
      $('#beheerHerzien').value = beheer.herzienOp || '';
      $('#beheerTags').value = (beheer.tags || []).join(', ');
    }
  }

  $('#samenBtn').addEventListener('click', function () {
    if (!open) return;
    $('#samenAnker').textContent = samenAnkerNu();
    $('#samenScrim').classList.add('open');
    var paneel = $('#samenScrim').querySelector('.office-samen'); if (paneel) paneel.scrollTop = 0;
    samenVervers();
  });
  $('#samenDicht').addEventListener('click', function () { $('#samenScrim').classList.remove('open'); });
  $('#opmerkingForm').addEventListener('submit', function (e) {
    e.preventDefault(); if (!open) return;
    var tekst = $('#opmerkingTekst').value.trim();
    if (!tekst) return zeg('Schrijf eerst een opmerking.');
    api('opmerking', { id: open.id, actie: 'nieuw', tekst: tekst, anker: $('#samenAnker').textContent,
      actiehouder: $('#opmerkingWie').value, voor: $('#opmerkingVoor').value }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      $('#opmerkingTekst').value = ''; $('#opmerkingWie').value = ''; $('#opmerkingVoor').value = '';
      zeg('Opmerking geplaatst.'); samenVervers(); laadLijst();
    });
  });
  function wijzigOpmerking(id, actie) {
    api('opmerking', { id: open.id, opmerking: id, actie: actie }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg(actie === 'oplos' ? 'Actie opgelost.' : 'Actie heropend.'); samenVervers(); laadLijst();
    });
  }
  $('#beheerBewaar').addEventListener('click', function () {
    if (!open) return;
    api('beheer', { id: open.id, classificatie: $('#beheerClassificatie').value,
      bewaartermijn: $('#beheerTermijn').value, herzienOp: $('#beheerHerzien').value,
      tags: $('#beheerTags').value.split(',') }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg('Documentbeleid bewaard.'); samenVervers(); laadLijst();
    });
  });
