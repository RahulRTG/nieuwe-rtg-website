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
    Promise.resolve(vuil ? bewaarNu() : null).then(function () {
      $('#aiUit').value = 'Rahul leest…';
      return api('ai', { id: open.id, opdracht: $('#aiOpdracht').value, vraag: $('#aiVraag').value });
    }).then(function (r) {
      if (r.body.error) { $('#aiUit').value = ''; return zeg(r.body.error); }
      $('#aiUit').value = r.body.voorstel + (r.body.demo ? '\n\n(demostand: zet een AI-sleutel voor echte voorstellen)' : '');
      $('#aiToepas').style.display = '';
    });
  });
  $('#aiToepas').addEventListener('click', function () {
    var stuk = $('#aiUit').value.split('\n\n(demostand')[0];
    if (open.soort === 'presentatie') pres.erbij({ indeling: 'punten', titel: 'Voorstel van Rahul', tekst: stuk });
    else if (open.soort === 'blad') blad.zetFormule(stuk.trim().split('\n')[0]);
    else $('#tekst').innerHTML += '<p>' + esc(stuk).replace(/\n/g, '<br>') + '</p>';
    markeer(); telBij(); $('#aiScrim').classList.remove('open');
    zeg('Toegevoegd; u kunt het gewoon bewerken.');
  });

  /* ---------- export ---------- */
  function laadNeer(data, naam, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
    a.download = naam; a.click(); URL.revokeObjectURL(a.href);
    zeg('Geëxporteerd: ' + naam);
  }
  $('#exportBtn').addEventListener('click', function () {
    if (!open) return;
    var data, naam, type, titel = $('#titel').value || 'document';
    if (open.soort === 'blad') { data = blad.naarCsv(); naam = titel + '.csv'; type = 'text/csv'; }
    else if (open.soort === 'presentatie') { data = pres.naarTekst(); naam = titel + '.txt'; type = 'text/plain'; }
    else if (open.soort === 'schets') { data = schets.naarSvg(); naam = titel + '.svg'; type = 'image/svg+xml'; }
    else if (open.soort === 'formulier') {
      // de beheerder krijgt de uitslag als CSV; wie alleen invult niets
      if (!magBewerken) return zeg('De uitslag is voor wie het formulier beheert.');
      return formulier.uitslagCsv().then(function (csv) {
        if (csv == null) return zeg('Kon de uitslag niet ophalen.');
        laadNeer(csv, titel + '.csv', 'text/csv');
      });
    }
    else {
      data = '<!doctype html><meta charset="utf-8"><title>' + esc(titel) + '</title>' +
        '<body style="font-family:Georgia,serif;max-width:42em;margin:3em auto;line-height:1.7;color:#1a1a19;">' +
        $('#tekst').innerHTML;
      naam = titel + '.html'; type = 'text/html';
    }
    laadNeer(data, naam, type);
  });

  if (!token) zeg(opzet.leeg); else laadLijst();
})();
