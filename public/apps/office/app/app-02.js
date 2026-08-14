
  /* ---------- openen ---------- */
  function zetTab(doc) {
    var tab = tabs.find(function (t) { return t.id === doc.id; });
    if (!tab) {
      if (tabs.length >= 6) {
        var weg = tabs.findIndex(function (t) { return !open || t.id !== open.id; });
        tabs.splice(weg < 0 ? 0 : weg, 1);
      }
      tab = { id: doc.id }; tabs.push(tab);
    }
    tab.titel = doc.titel; tab.soort = doc.soort;
    tab.fase = (doc.werkstroom && doc.werkstroom.fase) || tab.fase || 'concept';
    tekenTabs();
  }
  function tekenTabs() {
    // Rahul gebruikt dezelfde tabstrip. Bewaar zijn levende knop (met eigen
    // click-handler) wanneer Office de documenttabs opnieuw tekent.
    var rahulTab = $('#docTabs').querySelector('.rtg-rahul-tab');
    if (rahulTab) rahulTab.remove();
    $('#docTabs').innerHTML = tabs.map(function (t) {
      var actief = open && open.id === t.id;
      return '<button class="office-tab" type="button" role="tab" aria-selected="' + (actief ? 'true' : 'false') +
        '" data-tab="' + esc(t.id) + '" data-actief="' + (actief ? '1' : '0') + '">' +
        '<i>' + glyf(GLYF_SOORT[t.soort] || 'logboek') + '</i><span>' + esc(t.titel || 'Document') +
        '</span><b data-tab-dicht="' + esc(t.id) + '" aria-label="Sluit tab">×</b></button>';
    }).join('');
    if (rahulTab) $('#docTabs').appendChild(rahulTab);
    Array.prototype.forEach.call($('#docTabs').querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function (e) {
        if (e.target && e.target.closest('[data-tab-dicht]')) return;
        openen(b.dataset.tab);
      });
    });
    Array.prototype.forEach.call($('#docTabs').querySelectorAll('[data-tab-dicht]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); sluitTab(b.dataset.tabDicht); });
    });
  }
  function sluitTab(id) {
    var wasActief = open && open.id === id;
    Promise.resolve(wasActief && vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return;
      var plek = tabs.findIndex(function (t) { return t.id === id; });
      if (plek >= 0) tabs.splice(plek, 1);
      if (!wasActief) return tekenTabs();
      clearInterval(leesT); open = null; vuil = false;
      var volgende = tabs[Math.min(plek, tabs.length - 1)];
      if (volgende) openLaden(volgende.id); else sluitEditor();
    });
  }
  function openen(id, geforceerd) {
    if (!id) return Promise.resolve(false);
    if (!geforceerd && open && open.id === id) return Promise.resolve(true);
    return Promise.resolve(open && vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return false;
      return openLaden(id);
    });
  }
  function openLaden(id) {
    var volgorde = ++openVolgorde;
    return api('open', { id: id }).then(function (r) {
      if (volgorde !== openVolgorde) return false;
      if (r.status !== 200) return zeg(r.body.error || 'Kon niet openen.');
      open = r.body; magBewerken = !!r.body.magBewerken; vuil = false;
      zetTab(open);
      $('#titel').value = r.body.titel; $('#titel').disabled = !r.body.eigenaar;
      $('#staat').textContent = magBewerken ? (r.body.eigenaar ? '' : 'meeschrijven · van ' + r.body.door)
        : 'alleen lezen · van ' + r.body.door;
      $('#deelBtn').style.display = r.body.eigenaar ? '' : 'none';
      // Rahul leest tekst en dia's; op een formulier of schets heeft hij niets te zoeken
      $('#aiBtn').style.display = magBewerken && r.body.soort !== 'formulier' && r.body.soort !== 'schets' && r.body.soort !== 'bord' ? '' : 'none';
      $('#presBtn').style.display = r.body.soort === 'presentatie' ? '' : 'none';
      $('#formBalk').style.display = r.body.soort === 'blad' ? '' : 'none';
      $('#tekstTools').style.display = 'none'; $('#bladTools').style.display = 'none';
      $('#tekst').style.display = 'none'; $('#bladWrap').style.display = 'none'; $('#presWrap').style.display = 'none';
      $('#formWrap').style.display = 'none'; $('#schetsWrap').style.display = 'none';
      $('#bordWrap').style.display = 'none';
      if (r.body.soort === 'blad') toonBlad(r.body.inhoud);
      else if (r.body.soort === 'presentatie') toonPres(r.body.inhoud);
      else if (r.body.soort === 'formulier') toonFormulier(r.body.inhoud);
      else if (r.body.soort === 'schets') toonSchets(r.body.inhoud);
      else if (r.body.soort === 'bord') toonBord(r.body.inhoud);
      else toonTekst(r.body.inhoud);
      $('#lijst').style.display = 'none'; $('#editor').classList.add('aan');
      tekenFase();
      startSamen();
      volgMee();
      return true;
    });
  }
  function volgMee() {
    clearInterval(leesT);
    leesT = setInterval(function () {
      if (!open || vuil) return;
      api('open', { id: open.id }).then(function (v) {
        if (v.status !== 200 || v.body.gewijzigd === open.gewijzigd) return;
        // wie een formulier aan het invullen is raakt zijn half getypte
        // antwoorden niet kwijt aan een verversing; nieuwe vragen komen
        // vanzelf bij de volgende keer openen
        if (open.soort === 'formulier' && !magBewerken) return;
        // Houd bij actieve tekstinvoer ook de oude versiecode vast. Als de
        // gebruiker daarna schrijft, ziet bewaren het conflict; de nieuwere
        // serverstand wordt nooit stil door de zichtbare oude tekst vervangen.
        if (document.activeElement && document.activeElement.id === 'tekst') return;
        open.gewijzigd = v.body.gewijzigd; open.inhoud = v.body.inhoud; open.werkstroom = v.body.werkstroom;
        if (open.soort === 'blad') blad.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'presentatie') pres.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'formulier') formulier.laad(v.body.inhoud, magBewerken, open.id);
        else if (open.soort === 'schets') schets.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'bord') bord.laad(v.body.inhoud, magBewerken);
        else $('#tekst').innerHTML = (v.body.inhoud && v.body.inhoud.tekst) || '';
        zetTab(open); tekenFase();
        zeg('Bijgewerkt door ' + (v.body.door || 'een ander'));
      });
    }, 5000);
  }
  function sluitEditor() {
    clearInterval(leesT); stopSamen(); $('#editor').classList.remove('aan'); $('#lijst').style.display = '';
    open = null; vuil = false; $('#voetbalk').textContent = ''; tekenTabs(); laadLijst();
  }
  $('#editTerug').addEventListener('click', function () {
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) { if (veilig !== false) sluitEditor(); });
  });
