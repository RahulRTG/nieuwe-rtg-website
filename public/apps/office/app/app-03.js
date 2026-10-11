
  /* ---------- Rahul leest mee ---------- */
  $('#aiBtn').addEventListener('click', function () {
    if (!open) return;
    $('#aiUit').value = ''; $('#aiToepas').style.display = 'none';
    // in een rekenblad is de formule de enige zinnige opdracht
    $('#aiOpdracht').value = open.soort === 'blad' ? 'formule' : 'samenvatten';
    $('#aiScrim').classList.add('open');
  });
  $('#aiDicht').addEventListener('click', function () { $('#aiScrim').classList.remove('open'); });
  $('#aiVraagBtn').addEventListener('click', function () {
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return null;
      $('#aiUit').value = 'Rahul leest…';
      return api('ai', { id: open.id, opdracht: $('#aiOpdracht').value, vraag: $('#aiVraag').value });
    }).then(function (r) {
      if (!r) return;
      if (r.body.error) { $('#aiUit').value = ''; return zeg(r.body.error); }
      $('#aiUit').value = r.body.voorstel;
      $('#aiToepas').style.display = '';
    });
  });
  $('#aiToepas').addEventListener('click', function () {
    var stuk = $('#aiUit').value;
    if (open.soort === 'presentatie') pres.erbij({ indeling: 'punten', titel: 'Voorstel van Rahul', tekst: stuk });
    else if (open.soort === 'blad') blad.zetFormule(stuk.trim().split('\n')[0]);
    else $('#tekst').innerHTML += '<p>' + esc(stuk).replace(/\n/g, '<br>') + '</p>';
    markeer(); telBij(); $('#aiScrim').classList.remove('open');
    zeg('Toegevoegd; u kunt het gewoon bewerken.');
  });

  /* ---------- in en uit ----------
     De export loopt over de server (kern/office/formaten.js), langs de
     classificatiepoort: het bestand draagt de classificatie en het
     documentspoor noteert wie wat exporteerde. Wat er NIET meekwam, staat in
     het venster -- niet in een melding die na drie seconden weg is. */
  function laadNeer(data, naam, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
    a.download = naam; a.click(); URL.revokeObjectURL(a.href);
    zeg('Geëxporteerd: ' + naam);
  }
  function bytesVan(b64) {
    var bin = atob(b64), uit = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) uit[i] = bin.charCodeAt(i);
    return uit;
  }
  var FORMAAT = { docx: 'Word (DOCX)', html: 'Webpagina (HTML)', xlsx: 'Excel (XLSX)', csv: 'CSV',
    txt: 'Tekst (TXT)', svg: 'Afbeelding (SVG)' };
  var FORMATEN = { tekst: ['docx', 'html'], blad: ['xlsx', 'csv'], presentatie: ['txt'], schets: ['svg'], bord: ['csv'] };
  function toonTrouw(lijst, leegZin) {
    var ul = $('#formaatTrouw');
    ul.innerHTML = (lijst && lijst.length) ? lijst.map(function (t) {
      return '<li>' + esc(t.wat) + (t.aantal > 1 ? ' (' + t.aantal + '×)' : '') +
        (t.cel ? ' · cel ' + esc(t.cel) + ': ' + esc(t.reden || '') : '') +
        (t.cellen && t.cellen.length ? ' · ' + esc(t.cellen.join(', ')) : '') + '</li>';
    }).join('') : '<li>' + esc(leegZin) + '</li>';
  }
  function exporteer(formaat) {
    var extra = formaat === 'svg' ? { svg: schets.naarSvg() } : {};
    $('#formaatTrouw').innerHTML = '<li>Bezig…</li>';
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return null;
      return api('exporteer', Object.assign({ id: open.id, formaat: formaat }, extra));
    }).then(function (r) {
      if (!r) { $('#formaatTrouw').innerHTML = ''; return; }
      if (r.body.error) { toonTrouw([], r.body.error); return zeg(r.body.error); }
      laadNeer(bytesVan(r.body.bestand), r.body.naam, r.body.mime);
      toonTrouw(r.body.trouw, 'Alles kwam mee. Classificatie in het bestand: ' + r.body.label + '.');
    }).catch(function () {
      toonTrouw([], 'Er kwam geen verbinding met de server; er is niets geëxporteerd.');
    });
  }
  $('#exportBtn').addEventListener('click', function () {
    if (!open) return;
    var titel = $('#titel').value || 'document';
    if (open.soort === 'formulier') {
      // de beheerder krijgt de uitslag als CSV; wie alleen invult niets
      if (!magBewerken) return zeg('De uitslag is voor wie het formulier beheert.');
      return formulier.uitslagCsv().then(function (csv) {
        if (csv == null) return zeg('Kon de uitslag niet ophalen.');
        laadNeer(csv, titel + '.csv', 'text/csv');
      });
    }
    $('#formaatKop').textContent = 'Exporteren';
    $('#formaatUitleg').textContent = 'Het bestand draagt de classificatie van dit document, en het documentspoor noteert de export.';
    $('#formaatTrouw').innerHTML = '';
    $('#formaatKeuze').innerHTML = (FORMATEN[open.soort] || []).map(function (f) {
      return '<button class="knop" type="button" data-formaat="' + f + '">' + esc(FORMAAT[f]) + '</button>';
    }).join('');
    $('#formaatScrim').classList.add('open');
  });
  $('#formaatKeuze').addEventListener('click', function (e) {
    var k = e.target.closest('[data-formaat]');
    if (k && open) exporteer(k.dataset.formaat);
  });
  $('#formaatDicht').addEventListener('click', function () { $('#formaatScrim').classList.remove('open'); });

  /* Een XLSX inlezen maakt altijd een NIEUW rekenblad; er wordt nooit over
     een bestaand document heen geschreven. */
  $('#inleesXlsx').addEventListener('click', function () { $('#inleesBestand').click(); });
  $('#inleesBestand').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    var lezer = new FileReader();
    lezer.onload = function () {
      var b64 = String(lezer.result || '').replace(/^data:[^,]*,/, '');
      api('importeer', { bestand: b64, titel: f.name.replace(/\.xlsx$/i, '') }).then(function (r) {
        if (r.body.error) return zeg(r.body.error);
        $('#formaatKop').textContent = 'Ingelezen: ' + r.body.titel;
        $('#formaatUitleg').textContent = r.body.cellen + ' cellen staan in een nieuw rekenblad. Wat er niet meekwam:';
        $('#formaatKeuze').innerHTML = '';
        toonTrouw(r.body.trouw, 'Niets: het hele werkblad kwam mee.');
        $('#formaatScrim').classList.add('open');
        laadLijst();
        openen(r.body.id);
      }).catch(function () { zeg('Er kwam geen verbinding met de server; er is niets ingelezen.'); });
    };
    lezer.readAsDataURL(f);
  });

  /* RTDocs is de rustige voorzijde van deze documentmotor. De voorzijde
     gebruikt dezelfde API, dezelfde lijst en
     dezelfde editor. Zo ontstaan er geen tweede documentenmodel en geen
     schaduwversies naast RTG Office. */
  window.RTGOffice = Object.freeze({
    api: api,
    laad: laadLijst,
    openen: openen,
    nieuw: nieuw,
    verwijderen: verwijderen,
    markeren: markeren,
    stand: function () { return stand; }
  });

  if (!token) zeg(opzet.leeg); else laadLijst();
})();
