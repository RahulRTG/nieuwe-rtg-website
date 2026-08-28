/* RTG School Partner: de rapporten. De motor rekende ze al uit, maar er was
   geen scherm -- en daarmee was de strengste belofte van de enterprise-laag
   onzichtbaar: EEN RAPPORT WORDT DOOR EEN MENS VASTGESTELD.

   Daarom staat die belofte hier in de vorm van het scherm zelf en niet in een
   zin eronder: de knop "stel vast" is pas te gebruiken als u met een vinkje
   zegt dat u de teksten hebt gelezen, en het vinkje staat naast de teksten en
   niet in een dialoogvenster ergens anders. De server weigert zonder
   `gelezen: true` sowieso; dit scherm doet niet alsof dat een formaliteit is.

   De concepttekst is een VOORSTEL: hij komt uit de cijfers (of uit een AI, en
   dan staat de bron erbij), en hij is bedoeld om overschreven te worden.
   Zelfde SPart-patroon als toetsen.js; app.js roept SPart.rapport() aan. */
window.SPart = window.SPart || {};
window.SPart.rapport = function () {
  var P = window.SPart, sk = P.sk, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };

  sk('/school/rapport/lijst').then(function (r) {
    if (r.body.error) { $('#rapLijst').innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
    $('#rapLijst').innerHTML = (r.body.rapporten || []).map(function (x) {
      return '<div class="item"><span>' + esc(x.klas) + ' <span class="stil">· ' + esc(x.periode) + ' · ' +
        x.leerlingen + ' leerlingen</span></span><span class="rij">' +
        (x.vastgesteld ? '<span class="tag aan">vastgesteld</span>' : '<span class="tag">concept</span>') +
        '<button class="knop" data-rap="' + esc(x.id) + '">Open</button></span></div>';
    }).join('') || '<p class="stil">Nog geen rapport. Zet er hierboven een klaar met een periode.</p>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-rap]'), function (b) {
      b.addEventListener('click', function () { open(b.dataset.rap); });
    });
  });

  function open(id) {
    sk('/school/rapport/lijst', { rapportId: id }).then(function (r) {
      var rap = r.body.rapport;
      if (!rap) return meld(r.body.error || 'Dat rapport kennen we niet.');
      var vast = !!rap.vastgesteld;
      $('#rapDetail').innerHTML = '<div class="kop">' + esc(rap.klas) + ' · ' + esc(rap.periode) + '</div>' +
        (vast ? '<p class="stil">Vastgesteld door ' + esc(rap.vastgesteldDoor || '-') + ' op ' +
          esc(String(rap.vastgesteldAt || '').slice(0, 10)) + '. De gezinnen van deze klas zien dit rapport.</p>'
          : '<p class="stil">Concept. Zolang dit niet is vastgesteld, ziet geen enkel gezin het.</p>') +
        (rap.leerlingen || []).map(function (l) {
          var vakken = (l.vakken || []).map(function (v) {
            return esc(v.vak) + ' ' + (v.gemiddelde == null ? '-' : v.gemiddelde);
          }).join(' · ') || 'nog geen cijfers';
          var a = l.aanwezigheid || {};
          return '<div class="item h-boven"><span class="h-rek14">' +
            '<b>' + esc(l.naam) + '</b> <span class="stil">gemiddeld ' + (l.gemiddelde == null ? '-' : l.gemiddelde) + '</span><br>' +
            '<span class="stil">' + vakken + '<br>' + (a.lessen || 0) + ' lessen · ' + (a.gemist || 0) +
            ' gemist · ' + (a.telaat || 0) + ' keer te laat</span>' +
            (l.tekstBron ? '<br><span class="tag">' + esc(l.tekstBron) + '</span>' : '') +
            '</span><span class="rij h-rek14">' +
            '<textarea class="veld" rows="3" data-tekst="' + esc(l.sleutel) + '" maxlength="1200" ' +
            'aria-label="Rapporttekst voor ' + esc(l.naam) + '"' + (vast ? ' readonly' : '') + '>' +
            esc(l.tekst || '') + '</textarea>' +
            (vast ? '' : '<button class="knop" data-concept="' + esc(l.sleutel) + '">Concepttekst</button>' +
              '<button class="knop p" data-bewaar="' + esc(l.sleutel) + '">Bewaar</button>') +
            '</span></div>';
        }).join('') +
        (vast ? '' : '<div class="rij h-mt80">' +
          '<label class="stil h-rij-mid">' +
          '<input type="checkbox" id="rapGelezen"> Ik heb alle teksten gelezen.</label>' +
          '<button class="knop p" id="rapVast" type="button">Stel vast en deel met de gezinnen</button></div>');
      knoppen(rap.id);
    });
  }

  function knoppen(id) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-concept]'), function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        sk('/school/rapport/tekst', { rapportId: id, sleutel: b.dataset.concept }).then(function (r) {
          b.disabled = false;
          if (r.body.error) return meld(r.body.error);
          var vak = document.querySelector('[data-tekst="' + b.dataset.concept.replace(/"/g, '\\"') + '"]');
          if (vak) vak.value = r.body.tekst;
          meld('Voorstel ingevuld (' + r.body.bron + '). Lees het na en pas het aan.');
        });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-bewaar]'), function (b) {
      b.addEventListener('click', function () {
        var vak = document.querySelector('[data-tekst="' + b.dataset.bewaar.replace(/"/g, '\\"') + '"]');
        sk('/school/rapport/tekst/zet', { rapportId: id, sleutel: b.dataset.bewaar, tekst: vak ? vak.value : '' })
          .then(function (r) { meld(r.body.error || 'Tekst bewaard.'); });
      });
    });
    var vast = $('#rapVast');
    if (vast) vast.addEventListener('click', function () {
      var gelezen = $('#rapGelezen');
      if (!gelezen || !gelezen.checked) return meld('Zet eerst het vinkje: een rapport dat niemand heeft nagekeken, gaat hier niet de deur uit.');
      sk('/school/rapport/stel-vast', { rapportId: id, gelezen: true }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld('Vastgesteld. Vanaf nu zichtbaar voor de gezinnen van deze klas.');
        P.rapport();
        open(id);
      });
    });
  }
};

window.SPart.rapportMaken = function () {
  var P = window.SPart, sk = P.sk, meld = P.meld;
  var periode = document.querySelector('#rapPeriode');
  if (!periode || !periode.value.trim()) return meld('Welke periode is dit rapport? Bijvoorbeeld "Periode 2".');
  sk('/school/rapport/maak', { periode: periode.value.trim() }).then(function (r) {
    if (r.body.error) return meld(r.body.error);
    meld('Concept klaargezet voor ' + r.body.rapport.leerlingen + ' leerlingen. Het gezin ziet het pas na vaststelling.');
    P.rapport();
  });
};
