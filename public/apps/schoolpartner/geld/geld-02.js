/* de kantinekaart: het saldo per leerling en wat de school erover mag zetten */
  function kantineKaart(kies) {
    return '<div class="kaart"><div class="kop">Kantinesaldo</div>' +
      '<div class="rij"><select class="veld" id="glKLeerling" aria-label="Voor welke leerling">' + kies + '</select>' +
      '<input class="veld h-kolom9" id="glKBij" type="number" min="0" step="0.5" placeholder="Opwaarderen" aria-label="Opwaarderen met">' +
      '<input class="veld h-kolom8" id="glKAf" type="number" min="0" step="0.5" placeholder="Besteed" aria-label="Besteed bedrag">' +
      '<button class="knop" id="glKantine" type="button">Boek</button></div>' +
      '<div id="glKUit" class="stil h-mt40"></div>' +
      '<p class="stil">Een leeg saldo weigert nooit eten; het verschil wordt een factuur voor de ouders.</p></div>';
  }

  function rapportKaart(rap) {
    var t = rap.totalen || {};
    var soorten = (rap.perSoort || []).map(function (s) {
      return '<div class="item"><span>' + esc(s.soort) + ' <span class="stil">· ' + s.aantal + ' facturen</span></span>' +
        '<span class="stil">' + euro(s.gefactureerd) + ' · betaald ' + euro(s.betaald) + ' · open ' + euro(s.open) + '</span></div>';
    }).join('') || '<p class="stil">Nog niets gefactureerd.</p>';

    return '<div class="kaart enterprise-breed"><div class="kop">Rapportage</div>' +
      '<div class="kpis h-mb60">' +
      [['Gefactureerd', euro(t.gefactureerd)], ['Betaald', euro(t.betaald)],
       ['Terugbetaald', euro(t.terugbetaald)], ['Open', euro(t.open)]]
        .map(function (x) { return '<div class="kpi"><b style="font-size:1.05rem;">' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
      soorten + '<p class="stil">' + (rap.export || []).length + ' regels staan klaar voor de boekhouding, plat en compleet: soort, bedrag, betaald, open, datum.</p></div>';
  }

  function knoppen() {
    var q = function (x) { return document.getElementById(x); };
    var na = function (r, bericht) { meld(r.body.error || bericht); if (!r.body.error) teken(); };

    q('glFactuur').addEventListener('click', function () {
      if (!q('glOms').value.trim() || !q('glBedrag').value) return meld('Vul in waarvoor de factuur is en welk bedrag.');
      A('/school/factuur/maak', sleutels({ leerlingId: q('glLeerling').value, soort: q('glSoort').value,
        omschrijving: q('glOms').value, bedrag: Number(q('glBedrag').value), vervalt: q('glVervalt').value }))
        .then(function (r) { na(r, 'Factuur ' + (r.body.factuur || {}).nummer + ' gemaakt. ' + (r.body.let || '')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-boek]'), function (b) {
      b.addEventListener('click', function () {
        var bedrag = window.prompt('Welk bedrag is er betaald? (openstaand: ' + (Number(b.dataset.open) / 100).toFixed(2) + ')',
          (Number(b.dataset.open) / 100).toFixed(2));
        if (bedrag == null) return;
        A('/school/factuur/boek', sleutels({ factuurId: b.dataset.boek, bedrag: Number(String(bedrag).replace(',', '.')) }))
          .then(function (r) { na(r, 'Geboekt; nog open: ' + euro((r.body.factuur || {}).open)); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-herinner]'), function (b) {
      b.addEventListener('click', function () {
        A('/school/factuur/herinner', sleutels({ factuurId: b.dataset.herinner })).then(function (r) { na(r, 'Herinnering genoteerd.'); });
      });
    });
    q('glMachtiging').addEventListener('click', function () {
      A('/school/machtiging/zet', sleutels({ leerlingId: q('glMLeerling').value, houder: q('glMHouder').value,
        ibanEinde: q('glMIban').value, max: Number(q('glMMax').value) }))
        .then(function (r) { na(r, 'Machtiging vastgelegd.'); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-intrek]'), function (b) {
      b.addEventListener('click', function () {
        A('/school/machtiging/intrek', sleutels({ machtigingId: b.dataset.intrek })).then(function (r) { na(r, 'Ingetrokken.'); });
      });
    });
    q('glBudget').addEventListener('click', function () {
      if (!q('glBNaam').value.trim()) return meld('Geef het budget een naam.');
      A('/school/budget/zet', sleutels({ naam: q('glBNaam').value, bedrag: q('glBBedrag').value || undefined,
        besteding: q('glBBesteed').value || undefined, wat: q('glBWat').value }))
        .then(function (r) { na(r, 'Budget bijgewerkt.'); });
    });
    q('glSubsidie').addEventListener('click', function () {
      if (!q('glSNaam').value.trim()) return meld('Geef de subsidie een naam.');
      A('/school/subsidie/zet', sleutels({ naam: q('glSNaam').value, verstrekker: q('glSVer').value,
        bedrag: Number(q('glSBedrag').value), ontvangen: Number(q('glSOnt').value) }))
        .then(function (r) { na(r, 'Subsidie genoteerd.'); });
    });
    q('glKantine').addEventListener('click', function () {
      A('/school/kantine/saldo', sleutels({ leerlingId: q('glKLeerling').value,
        bij: Number(q('glKBij').value) || 0, af: Number(q('glKAf').value) || 0 }))
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          q('glKUit').textContent = 'Saldo: ' + euro(r.body.saldo) + '. ' + (r.body.let || '');
        });
    });
  }

  return { bind: bind };
})();
