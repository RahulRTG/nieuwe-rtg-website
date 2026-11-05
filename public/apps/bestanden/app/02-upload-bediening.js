  /* ---- uploaden: kiezen of slepen; groot gaat in stukken ---- */
  function stuur(file, bid) {
    return window.RTGBestandUpload(file, api, { id: bid, map: hier });
  }
  function uploadAlles(files) {
    var lijst = Array.prototype.slice.call(files || []);
    if (!lijst.length) return;
    meld(lijst.length === 1 ? 'Bezig met uploaden.' : 'Bezig met ' + lijst.length + ' bestanden.');
    var ket = Promise.resolve();
    lijst.forEach(function (f) {
      ket = ket.then(function () { return stuur(f).then(function (r) { if (r.body.error) meld(r.body.error); }); });
    });
    ket.then(function () { laad(); }).catch(function (e) { meld(e.message); });
  }
  $('#kies').addEventListener('click', function () { $('#bestandkiezer').click(); });
  $('#bestandkiezer').addEventListener('change', function () { uploadAlles(this.files); this.value = ''; });
  document.addEventListener('dragover', function (e) { e.preventDefault(); document.body.classList.add('sleept'); });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) document.body.classList.remove('sleept'); });
  document.addEventListener('drop', function (e) {
    e.preventDefault(); document.body.classList.remove('sleept');
    if (e.dataTransfer && e.dataTransfer.files) uploadAlles(e.dataTransfer.files);
  });

  $('#nieuwMap').addEventListener('click', function () {
    var naam = prompt('Hoe heet de nieuwe map?');
    if (!naam || !naam.trim()) return;
    api('map', { naam: naam.trim(), ouder: hier }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      laad();
    });
  });
  $('#toonBak').addEventListener('click', function () {
    bak = !bak;
    this.classList.toggle('aan', bak);
    this.textContent = bak ? 'Terug naar de kluis' : 'Prullenbak';
    teken();
  });
  $('#zoek').addEventListener('input', teken);
  $('#sorteer').addEventListener('change', teken);

  window.RTGBestanden = { api: api, meld: meld, laad: laad, maat: maat, stuur: stuur,
    stand: function () { return stand; }, bak: function () { return bak; } };
  window.addEventListener('rtglang', teken);
  ['focus', 'online'].forEach(function (event) { window.addEventListener(event, function () { if (token) laad(); }); });
  if (!token) window.RTGDaily.render('bestanden', 'guest'); else laad();
})();
