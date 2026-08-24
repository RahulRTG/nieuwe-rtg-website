/* RTG Werk OS (scherm): RTG Bijstand -- wie u binnenlaat, en wat u ziet terwijl
   het gebeurt.

   DIT SCHERM IS DE ANDERE HELFT VAN EEN BELOFTE. Aan de RTG-kant staat geen knop
   die een sessie opent; die staat hier. Wat u hier kiest -- het niveau, het
   onderwerp, de looptijd -- is de hele grens waarbinnen iemand van RTG mag
   werken. Daarna leest u live mee wat hij doet, keurt u elke handeling apart
   goed, en kunt u op elk moment intrekken, zonder reden.

   DRIE DINGEN DIE DIT SCHERM NIET MAG BREKEN

   1. NIETS WORDT HIER BEDACHT. De vier niveaus, hun looptijd en hun uitleg komen
      van de server. Staat er een niveau bij, dan verschijnt het hier vanzelf;
      staat er iets anders in de tekst, dan is dat de server die van gedachten
      veranderde en niet dit bestand.
   2. INTREKKEN VRAAGT NIETS. Geen bevestiging, geen reden. Een uitnodiging die
      je niet zonder uitleg kunt terugnemen, is geen uitnodiging.
   3. DE AFLOOPTIJD STAAT ERBIJ EN NIET IN EEN VOETNOOT. De sessie stopt hoe dan
      ook vanzelf; dat is het enige wat u niet hoeft te onthouden. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  function $(id) { return document.getElementById(id); }
  function esc(t) { return K.esc(t); }
  var NIVEAUS = [];

  function api(pad, body) {
    var s = K.sessie();
    if (!s) return Promise.reject(new Error('geen sessie'));
    var b = {}; for (var k in s) b[k] = s[k];
    for (var j in (body || {})) b[j] = body[j];
    return fetch('/api/tenant/bijstand' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().catch(function () { return {}; })
        .then(function (d) { return { status: r.status, body: d }; }); });
  }

  function vraagvorm() {
    return '<div class="item"><span>Waarmee mogen wij helpen?</span></div>' +
      '<p class="stil">Kies een niveau. Op elk niveau geldt: de sessie verloopt vanzelf, u leest live mee, ' +
      'en de inhoud van uw gegevens blijft dicht tenzij u daar apart toestemming voor geeft.</p>' +
      NIVEAUS.map(function (n) {
        return '<div class="item"><span><b>' + esc(n.naam) + '</b> &middot; hooguit ' + n.maxMinuten +
          ' min' + (n.voorafAkkoord ? ' &middot; akkoord vooraf' : '') + '</span>' +
          '<span class="stil">' + esc(n.wat) + '</span></div>';
      }).join('') +
      '<label class="stil" for="bjNiveau">Niveau</label>' +
      '<select id="bjNiveau">' + NIVEAUS.map(function (n) {
        return '<option value="' + esc(n.id) + '">' + esc(n.naam) + '</option>';
      }).join('') + '</select>' +
      '<label class="stil" for="bjWat">Onderwerp</label>' +
      '<input id="bjWat" placeholder="bijvoorbeeld: de kassakoppeling doet niets">' +
      '<label class="stil" for="bjMin">Hoeveel minuten</label>' +
      '<input id="bjMin" type="number" min="5" value="30">' +
      '<label class="stil" for="bjReden">Reden (alleen bij nood: u geeft dan vooraf toestemming om te handelen)</label>' +
      '<input id="bjReden" placeholder="waarom mag RTG nu zonder te wachten handelen?">' +
      '<button class="knop p" id="bjVraag" type="button">Bijstand vragen</button>';
  }

  function sessieVorm(s) {
    var u = '<div class="item"><span><b>' + esc(s.id) + '</b> &middot; ' + esc(s.niveau) + '</span>' +
      '<span class="stil">' + esc(s.status) + ' &middot; tot ' + esc(String(s.tot).slice(11, 16)) + ' UTC</span></div>' +
      '<div class="item"><span>' + esc(s.onderwerp) + '</span>' +
      '<span class="stil">' + (s.medewerker ? esc(s.medewerker) + ' van RTG is verbonden' : 'nog niemand van RTG') + '</span></div>' +
      '<p class="stil">' + esc(s.let || '') + '</p>';

    u += '<div class="kop">Wat RTG voorstelt</div>';
    u += s.handelingenLijst.length ? s.handelingenLijst.map(function (h) {
      return '<div class="item"><span><b>' + esc(h.wat) + '</b>' +
        (h.waarom ? '<br><span class="stil">' + esc(h.waarom) + '</span>' : '') + '</span>' +
        '<span class="stil">' + esc(h.status) +
        (h.status === 'voorgesteld'
          ? ' <button class="knop p" data-ja="' + h.index + '" type="button">Goedkeuren</button>' +
            ' <button class="knop" data-nee="' + h.index + '" type="button">Weigeren</button>'
          : '') + '</span></div>';
    }).join('') : '<p class="stil">Nog niets. Zolang hier niets staat, is er niets aan uw gegevens veranderd.</p>';

    u += '<div class="kop">Inhoud van uw gegevens</div>' +
      '<p class="stil">' + esc(s.inhoud.let) + '</p>';
    if (s.inhoud.verzoek && !s.inhoud.besluitAt) {
      u += '<div class="item"><span>' + esc(s.inhoud.verzoek.door) + ' vraagt toegang: ' +
        esc(s.inhoud.verzoek.reden) + '</span><span class="stil">' +
        '<button class="knop p" id="bjInhJa" type="button">Toestaan</button> ' +
        '<button class="knop" id="bjInhNee" type="button">Dicht houden</button></span></div>';
    } else {
      u += '<div class="item"><span>Stand</span><span class="stil">' +
        (s.inhoud.open ? 'open, met uw toestemming' : 'dicht') + '</span></div>';
    }

    u += '<div class="kop">Wat er gebeurt</div>' +
      s.spoor.map(function (x) {
        return '<div class="item"><span>' + esc(x.wat) + '</span><span class="stil">' +
          esc(String(x.at).slice(11, 19)) + '</span></div>';
      }).join('');
    if (s.verslag) {
      u += '<div class="kop">Verslag</div><p>' + esc(s.verslag.tekst) + '</p>' +
        '<p class="stil">' + s.verslag.duurMinuten + ' minuten &middot; ' + s.verslag.uitgevoerd +
        ' uitgevoerd, ' + s.verslag.geweigerd + ' geweigerd &middot; inhoud ' +
        (s.verslag.inhoudGeopend ? 'geopend' : 'dicht gebleven') + '.</p>';
    }
    if (s.status === 'open' || s.status === 'bezig') {
      u += '<button class="knop" id="bjStop" type="button">Toegang intrekken</button>';
    }
    return u;
  }

  function bind(id) {
    var el = $('stBijstand');
    if ($('bjVraag')) $('bjVraag').onclick = function () {
      api('/vraag', { niveau: $('bjNiveau').value, onderwerp: $('bjWat').value,
        minuten: Number($('bjMin').value) || null, reden: $('bjReden').value })
        .then(function (r) {
          if (r.body.error) return K.meld(r.body.error);
          window.RTGWerkBijstand.laad();
        });
    };
    if ($('bjStop')) $('bjStop').onclick = function () {
      api('/intrekken', { id: id }).then(function () { window.RTGWerkBijstand.laad(); });
    };
    if ($('bjInhJa')) $('bjInhJa').onclick = function () {
      api('/inhoud', { id: id, akkoord: true }).then(function () { window.RTGWerkBijstand.laad(); });
    };
    if ($('bjInhNee')) $('bjInhNee').onclick = function () {
      api('/inhoud', { id: id, akkoord: false }).then(function () { window.RTGWerkBijstand.laad(); });
    };
    el.querySelectorAll('[data-ja],[data-nee]').forEach(function (b) {
      b.onclick = function () {
        var ja = b.hasAttribute('data-ja');
        api('/besluit', { id: id, index: Number(ja ? b.dataset.ja : b.dataset.nee), akkoord: ja })
          .then(function () { window.RTGWerkBijstand.laad(); });
      };
    });
  }

  window.RTGWerkBijstand = {
    laad: function () {
      var el = $('stBijstand');
      if (!el || !K.sessie()) return;
      return api('', {}).then(function (r) {
        if (r.status === 403 || r.status === 404) {
          el.innerHTML = '<p class="stil">' + esc((r.body && r.body.error) || 'Niet zichtbaar zonder het recht "werkruimte".') + '</p>';
          return;
        }
        NIVEAUS = r.body.niveaus || [];
        var lopend = (r.body.sessies || []).find(function (s) { return s.status === 'open' || s.status === 'bezig'; });
        if (!lopend) { el.innerHTML = vraagvorm(); bind(null); return; }
        return api('/dossier', { id: lopend.id }).then(function (d) {
          el.innerHTML = sessieVorm(d.body.sessie);
          bind(lopend.id);
        });
      }).catch(function () {
        el.innerHTML = '<p class="stil">De stand van de bijstand is nu niet op te halen. Er staat hier met opzet niets in de plaats.</p>';
      });
    }
  };
})();
