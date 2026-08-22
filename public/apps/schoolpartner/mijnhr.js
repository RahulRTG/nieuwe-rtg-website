/* RTG School Partner: "mijn zaken" -- de kant van het personeelsdossier die
   van de medewerker zelf is. Vier dingen die de server bewust NIET aan HR
   heeft gegeven staan hier, bij de persoon om wie het gaat:

   - het eigen dossier opvragen (geen gunst maar het inzagerecht);
   - ziek of beter melden, en verlof aanvragen. Er is geen redenveld bij een
     ziekmelding en dat is opzet: een werkgever hoeft niet te weten wat iemand
     heeft, en mag het niet vastleggen;
   - de eigen uren boeken -- uren die iemand anders voor je invult zijn geen
     urenregistratie maar een aanname;
   - een reactie zetten bij een gespreksverslag. Die blijft staan en niemand
     kan hem weghalen.

   Zelfde SPart-patroon als presentie.js; app.js roept SPart.mijnhr() aan in de
   werkbank. Loopt via sk(), want personeelVan() wil de schoolcode erbij. */
window.SPart = window.SPart || {};
window.SPart.mijnhr = function () {
  var P = window.SPart, sk = P.sk, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };

  sk('/school/hr/mijn').then(function (r) {
    if (r.body.error) { $('#mijnHR').innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
    var d = r.body.dossier, c = d.contract;
    var ziek = (d.verlof || []).find(function (v) { return v.soort === 'ziek' && !v.tot; });
    var verlof = (d.verlof || []).slice(0, 8).map(function (v) {
      return '<div class="item"><span>' + esc(v.soort) + ' <span class="stil">van ' + esc(v.van) +
        (v.tot ? ' tot ' + esc(v.tot) : ' (loopt)') + '</span></span><span class="tag">' + esc(v.status) +
        (v.besluitReden ? '</span><span class="stil">' + esc(v.besluitReden) : '') + '</span></div>';
    }).join('') || '<p class="stil">Niets genoteerd.</p>';
    var gesprekken = (d.gesprekken || []).slice(0, 5).map(function (x) {
      return '<div class="item h-boven"><span><b>' + esc(x.soort) + '</b> <span class="stil">' +
        esc(x.op) + ' · ' + esc(x.door) + '</span><br>' + esc(x.besproken) +
        ((x.afspraken || []).length ? '<br><span class="stil">afspraken: ' + esc(x.afspraken.join(' · ')) + '</span>' : '') +
        (x.reactie ? '<br><span class="stil">jouw reactie: ' + esc(x.reactie.tekst) + '</span>' : '') + '</span>' +
        (x.reactie ? '' : '<button class="knop" data-reactie="' + esc(x.id) + '">Reageer</button>') + '</div>';
    }).join('') || '<p class="stil">Nog geen gesprekken.</p>';

    $('#mijnHR').innerHTML =
      '<div class="item"><span>Contract</span><span class="stil">' +
      (c ? esc(c.soort) + ' · ' + c.uren + ' uur' + (c.functie ? ' · ' + esc(c.functie) : '') : 'nog niet vastgelegd') + '</span></div>' +
      ((d.bevoegdheden || []).map(function (b) {
        return '<div class="item"><span>' + esc(b.wat) + '</span><span class="stil">' +
          (b.geldigTot ? 'geldig tot ' + esc(b.geldigTot) : 'geen einddatum') + '</span></div>';
      }).join('')) +
      '<div class="kop h-mt80">Ziek en verlof</div>' + verlof +
      '<div class="rij h-mt50">' +
      (ziek ? '<button class="knop p" id="mhBeter" type="button">Ik ben weer beter</button>'
            : '<button class="knop" id="mhZiek" type="button">Ziek melden</button>') +
      '<input class="veld h-kolom10" id="mhVan" type="date" aria-label="Verlof van">' +
      '<input class="veld h-kolom10" id="mhTot" type="date" aria-label="Verlof tot">' +
      '<input class="veld" id="mhToe" maxlength="200" placeholder="Toelichting bij het verlof" aria-label="Toelichting">' +
      '<button class="knop" id="mhVerlof" type="button">Vraag verlof aan</button></div>' +
      '<p class="stil">Een ziekmelding vraagt geen reden en legt geen medische gegevens vast. Over verlof beslist een mens.</p>' +
      '<div class="kop h-mt80">Mijn uren</div>' +
      '<div id="mhUren" class="stil">Laden...</div>' +
      '<div class="rij h-mt50">' +
      '<input class="veld h-kolom10" id="mhDatum" type="date" aria-label="Datum">' +
      '<input class="veld h-kolom7" id="mhAantal" type="number" min="0" max="24" step="0.5" placeholder="Uren" aria-label="Aantal uren">' +
      '<input class="veld" id="mhWat" maxlength="80" placeholder="Waaraan" aria-label="Waaraan">' +
      '<button class="knop" id="mhBoek" type="button">Boek</button></div>' +
      '<div class="kop h-mt80">Gesprekken</div>' + gesprekken +
      '<div class="kop h-mt80">Wat ik mag</div><div id="mhRechten" class="stil">Laden...</div>' +
      '<div class="kop h-mt80">Peiling</div><div id="mhPeiling" class="stil">Laden...</div>';
    uren();
    rechten();
    peiling();
    knoppen();
  });

  /* Wat mag ik hier eigenlijk? Die vraag stond nergens op een scherm, terwijl
     hij bij een rollenmodel de eerste is die iemand stelt -- en het antwoord
     bespaart een 403 die niemand begrijpt. */
  function rechten() {
    sk('/school/mijn-rechten').then(function (r) {
      var vak = $('#mhRechten');
      if (!vak) return;
      if (r.body.error) { vak.textContent = r.body.error; return; }
      vak.innerHTML = 'Rol: <b>' + esc((r.body.rollen || []).join(', ')) + '</b> · status ' + esc(r.body.status) +
        '<br>Rechten: ' + esc((r.body.rechten || []).join(', ') || 'geen');
    });
  }

  /* De anonieme peiling. Alleen de scores gaan mee; er is geen tekstveld, want
     een open antwoord van een klein team is bijna een naam. */
  function peiling() {
    sk('/school/peiling/mijn-personeel').then(function (r) {
      var vak = $('#mhPeiling');
      if (!vak) return;
      if (r.body.error) { vak.textContent = r.body.error; return; }
      vak.innerHTML = (r.body.peilingen || []).map(function (p) {
        return '<div class="h-my40"><b>' + esc(p.titel) + '</b>' +
          (p.alGeantwoord ? ' <span class="tag aan">beantwoord</span>'
            : p.stellingen.map(function (st, i) {
                return '<div class="rij" style="margin:.25rem 0;"><span style="flex:1;min-width:12rem;">' + esc(st) + '</span>' +
                  '<select class="veld h-kolom7" data-peil="' + esc(p.id) + '" data-nr="' + i + '" aria-label="' + esc(st) + '">' +
                  [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') +
                  '</select></div>';
              }).join('') + '<button class="knop" data-peilstuur="' + esc(p.id) + '" type="button">Verstuur anoniem</button>') +
          '</div>';
      }).join('') || 'Geen peiling die op u wacht.';
      Array.prototype.forEach.call(document.querySelectorAll('[data-peilstuur]'), function (b) {
        b.addEventListener('click', function () {
          var scores = Array.prototype.map.call(
            document.querySelectorAll('[data-peil="' + b.dataset.peilstuur.replace(/"/g, '\\"') + '"]'),
            function (sel) { return Number(sel.value); });
          sk('/school/peiling/antwoord-personeel', { peilingId: b.dataset.peilstuur, scores: scores })
            .then(function (r2) { meld(r2.body.error || 'Anoniem verstuurd; de school ziet pas een uitslag vanaf vijf antwoorden.'); peiling(); });
        });
      });
    });
  }

  function uren(body) {
    sk('/school/hr/uren', body || {}).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var vak = $('#mhUren');
      if (!vak) return;
      vak.innerHTML = '<b>' + r.body.totaal + ' uur</b> geboekt in ' + esc(r.body.maand) + '. ' +
        (r.body.regels || []).slice(0, 5).map(function (u) {
          return esc(u.datum) + ': ' + u.uren + (u.wat ? ' (' + esc(u.wat) + ')' : '');
        }).join(' · ');
    });
  }

  function knoppen() {
    var q = function (x) { return document.getElementById(x); };
    var ziek = q('mhZiek'), beter = q('mhBeter');
    if (ziek) ziek.addEventListener('click', function () {
      sk('/school/hr/afwezig', { soort: 'ziek' }).then(function (r) { meld(r.body.error || 'Ziekmelding genoteerd.'); P.mijnhr(); });
    });
    if (beter) beter.addEventListener('click', function () {
      sk('/school/hr/afwezig', { soort: 'beter' }).then(function (r) { meld(r.body.error || 'Fijn dat je er weer bent.'); P.mijnhr(); });
    });
    q('mhVerlof').addEventListener('click', function () {
      if (!q('mhVan').value) return meld('Vanaf welke dag vraag je verlof aan?');
      sk('/school/hr/afwezig', { soort: 'verlof', van: q('mhVan').value, tot: q('mhTot').value, toelichting: q('mhToe').value })
        .then(function (r) { meld(r.body.error || 'Aanvraag ingediend; een mens beslist erover.'); P.mijnhr(); });
    });
    q('mhBoek').addEventListener('click', function () {
      if (!q('mhAantal').value) return meld('Vul het aantal uren in.');
      uren({ datum: q('mhDatum').value, uren: Number(q('mhAantal').value), wat: q('mhWat').value });
      q('mhAantal').value = ''; q('mhWat').value = '';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-reactie]'), function (b) {
      b.addEventListener('click', function () {
        var tekst = window.prompt('Jouw reactie bij dit gesprek. Die blijft staan; niemand kan hem weghalen.');
        if (tekst == null || !tekst.trim()) return;
        sk('/school/hr/gesprek/reactie', { gesprekId: b.dataset.reactie, reactie: tekst })
          .then(function (r) { meld(r.body.error || 'Je reactie staat erbij.'); P.mijnhr(); });
      });
    });
  }
};
