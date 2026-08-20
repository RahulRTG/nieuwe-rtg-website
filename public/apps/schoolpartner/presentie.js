/* RTG School Partner: de presentielijst van een les, en het verzuimbeeld van
   de klas. Dit scherm ontbrak: de server kende /school/aanwezigheid/zet al,
   maar er was geen knop -- en presentie is het ding dat een leraar elke dag
   doet, niet een randfunctie.

   Drie dingen die dit scherm van de server overneemt en zichtbaar maakt:

   1. EEN REGISTRATIE IS EEN WAARNEMING. De standen staan er feitelijk
      (aanwezig, te laat, afwezig, ziek, verlof) en er staat geen "reden"-veld
      dat een oordeel uitnodigt; de opmerking is er voor een feit ("kwam met
      de bus van 9:12").
   2. DEZELFDE LES TWEE KEER ZETTEN IS EEN CORRECTIE, geen tweede les. De
      server vervangt hem; hier zeggen we dat ook hardop, want verzuim uit een
      typefout is een van de vervelendste fouten die een school kan maken.
   3. HET BEELD STAAT OP NAAM. De server sorteert alfabetisch en niet op
      "meeste verzuim eerst"; dit scherm doet er geen eigen ordening overheen.

   Zelfde SPart-patroon als toetsen.js; app.js roept SPart.presentie() aan in
   de werkbank. Gebruikt sk() (schoolcode + klas + personeelstoken), want de
   presentielijst loopt via de rollenpoort en niet via het klas-token. */
window.SPart = window.SPart || {};
window.SPart.presentie = function () {
  var P = window.SPart, sk = P.sk, kl = P.kl, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };
  var STANDEN = [['aanwezig', 'Aanwezig'], ['telaat', 'Te laat'], ['afwezig', 'Afwezig'],
    ['ziek', 'Ziek'], ['verlof', 'Verlof']];
  var vandaag = new Date().toISOString().slice(0, 10);

  function uren() {
    var uit = '';
    for (var u = 1; u <= 12; u++) uit += '<option value="' + u + '">Uur ' + u + '</option>';
    return uit;
  }

  Promise.all([kl('/school/klas'), sk('/school/aanwezigheid/klas')]).then(function (r) {
    var klas = r[0].body, beeld = r[1].body;
    if (beeld.error) {
      $('#presLijst').innerHTML = '<p class="stil">' + esc(beeld.error) + '</p>';
      return;
    }
    var lln = klas.leerlingen || [];
    $('#presLijst').innerHTML = !lln.length
      ? '<p class="stil">Nog geen leerlingen in deze klas.</p>'
      : '<div class="rij h-mb60">' +
          '<input class="veld h-kolom11" id="presDatum" type="date" value="' + vandaag + '" aria-label="Datum van de les">' +
          '<select class="veld h-kolom7" id="presUur" aria-label="Lesuur">' + uren() + '</select>' +
          '<input class="veld" id="presVak" placeholder="Vak (mag leeg)" maxlength="40" aria-label="Vak">' +
        '</div>' +
        lln.map(function (l) {
          var sl = esc(l.sleutel), naam = esc(l.naam);
          return '<div class="item"><span>' + naam + '</span><span class="rij">' +
            '<select class="veld h-kolom9" data-leerling="' + sl + '" aria-label="Stand voor ' + naam + '">' +
            STANDEN.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') +
            '</select>' +
            '<input class="veld h-kolom8" type="number" min="0" max="240" step="5" data-minuten="' + sl + '" hidden ' +
            'placeholder="min. te laat" aria-label="Minuten te laat voor ' + naam + '">' +
            '</span></div>';
        }).join('') +
        '<div class="rij h-mt70">' +
          '<button class="knop p" id="presZet" type="button">Zet de presentie</button>' +
          '<button class="knop" id="presAlle" type="button">Iedereen aanwezig</button>' +
        '</div>';
    beeldTekenen(beeld);
    knoppen();
  });

  function beeldTekenen(beeld) {
    var rijen = (beeld.leerlingen || []).map(function (x) {
      var mist = x.afwezig + x.ziek;
      return '<div class="item"><span>' + esc(x.naam) + '</span><span class="stil">' +
        x.lessen + ' lessen · ' + mist + ' gemist · ' + x.telaat + ' keer te laat' +
        (x.minutenTeLaat ? ' (' + x.minutenTeLaat + ' min)' : '') +
        (x.verlof ? ' · ' + x.verlof + ' verlof' : '') + '</span></div>';
    }).join('');
    var laatste = (beeld.laatste || []).map(function (l) {
      return '<div class="item"><span>' + esc(l.datum) + ' · uur ' + l.uur + (l.vak ? ' · ' + esc(l.vak) : '') +
        '</span><span class="stil">gezet door ' + esc(l.door) + '</span></div>';
    }).join('');
    $('#presBeeld').innerHTML = (rijen || '<p class="stil">Nog geen presentie geregistreerd voor deze klas.</p>') +
      (laatste ? '<div class="kop h-mt90">Laatst gezet</div>' + laatste : '');
  }

  function knoppen() {
    var zet = $('#presZet');
    if (!zet) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-leerling]'), function (s) {
      s.addEventListener('change', function () {
        var min = document.querySelector('[data-minuten="' + s.dataset.leerling.replace(/"/g, '\\"') + '"]');
        if (min) min.hidden = s.value !== 'telaat';
      });
    });
    $('#presAlle').addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-leerling]'), function (s) {
        s.value = 'aanwezig';
        var min = document.querySelector('[data-minuten="' + s.dataset.leerling.replace(/"/g, '\\"') + '"]');
        if (min) { min.hidden = true; min.value = ''; }
      });
    });
    zet.addEventListener('click', function () {
      var regels = Array.prototype.map.call(document.querySelectorAll('[data-leerling]'), function (s) {
        var min = document.querySelector('[data-minuten="' + s.dataset.leerling.replace(/"/g, '\\"') + '"]');
        return { leerling: s.dataset.leerling, stand: s.value,
          minuten: s.value === 'telaat' && min ? Number(min.value) || 0 : 0 };
      });
      if (!regels.length) return meld('Er staat niemand in deze klas.');
      sk('/school/aanwezigheid/zet', { datum: $('#presDatum').value, uur: Number($('#presUur').value),
        vak: $('#presVak').value, regels: regels }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        var t = r.body.telling || {};
        meld((r.body.les.gecorrigeerd ? 'Gecorrigeerd: de eerdere registratie van dit uur is vervangen. ' : 'Presentie vastgelegd. ') +
          t.aanwezig + ' aanwezig, ' + t.telaat + ' te laat, ' + (t.afwezig + t.ziek) + ' afwezig.');
        sk('/school/aanwezigheid/klas').then(function (r2) { if (!r2.body.error) beeldTekenen(r2.body); });
      });
    });
  }
};
