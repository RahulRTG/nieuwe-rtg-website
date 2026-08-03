  /* ---- uploaden: kiezen of slepen; groot gaat in stukken ---- */
  var STUK = 4 * 1024 * 1024; // base64-tekens per stuk; ruim onder de bodygrens
  function stuur(file, bid) {
    return new Promise(function (af) {
      var r = new FileReader();
      r.onload = function () {
        var dataUrl = String(r.result || '');
        var b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (b64.length <= STUK) {
          af(api('upload', bid ? { id: bid, dataUrl: dataUrl } : { naam: file.name, map: hier, dataUrl: dataUrl }));
          return;
        }
        // in stukken: start, delen, klaar -- dezelfde poort, hetzelfde quotum
        af(api('upstart', { naam: file.name, map: hier, id: bid || undefined, mime: file.type || 'application/octet-stream' })
          .then(function (s) {
            if (s.body.error) return s;
            var ket = Promise.resolve({ status: 200, body: {} });
            for (var i = 0; i < b64.length; i += STUK) {
              (function (stuk) {
                ket = ket.then(function (v) { return v.body.error ? v : api('updeel', { uploadId: s.body.uploadId, stuk: stuk }); });
              })(b64.slice(i, i + STUK));
            }
            return ket.then(function (v) { return v.body.error ? v : api('upklaar', { uploadId: s.body.uploadId }); });
          }));
      };
      r.readAsDataURL(file);
    });
  }
  function uploadAlles(files) {
    var lijst = Array.prototype.slice.call(files || []);
    if (!lijst.length) return;
    meld(lijst.length === 1 ? 'Bezig met uploaden.' : 'Bezig met ' + lijst.length + ' bestanden.');
    var ket = Promise.resolve();
    lijst.forEach(function (f) {
      ket = ket.then(function () { return stuur(f).then(function (r) { if (r.body.error) meld(r.body.error); }); });
    });
    ket.then(function () { laad(); });
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
  if (!token) meld('Log eerst in op de leden-app.'); else laad();
})();
