/* DE LEVENSPAS: wie mag wat van mij zien (LEVEN.md par. 2.8, fase 2).

   EEN HERBRUIKBARE COMPONENT VOOR BEIDE SESSIEWERELDEN. De actieve pagina is
   het gezinsprofiel van de RTFoundation
   (/apps/foundation/mijnbanden.html, gezinscode plus profieltoken). Het
   routecontract ondersteunt daarnaast het RTG-lid achter een Bearer-token;
   daarom blijft de component zijn transport via `post` geïnjecteerd krijgen
   en bevat hij zelf geen inlog- of routekennis.

   Wat per wereld verschilt is uitsluitend HOE er gevraagd wordt. Dat komt via
   `post` binnen, met het pad al voluit ingevuld door de pagina zelf -- er
   wordt hier geen enkel routepad in elkaar geplakt.

   DE TWEE BESLUITEN STAAN HARDOP OP HET SCHERM, en dat is geen versiering. Ze
   zijn allebei anders dan mensen verwachten:

     1. een band ontstaat pas als de ANDER hem bevestigt -- dus wie zelf vroeg
        ziet "de ander is aan zet" en geen knop die hij zelf kan indrukken;
     2. van een minderjarige ziet een ouder standaard NIETS. Een ouder die dit
        scherm opent en een lege lijst ziet, hoort te lezen waarom die leeg is.
        Een lege lijst zonder uitleg leest als een storing, en dan gaat iemand
        zoeken naar de instelling die er niet is en ook niet komt.

   WAT HIER NIET STAAT, met opzet: geen knop "vraag toegang tot alles", geen
   overzicht van wat iemand OOIT deelde (par. 2.8: intrekken laat geen spoor
   na), en geen enkel getal dat mensen vergelijkt (par. 2.4).

   VERVALDATUM VERPLICHT BIJ DELEN. Het scherm stelt een half jaar voor omdat
   de server een datum eist; verzetten mag, weglaten niet. Toestemming die
   eeuwig duurt, wordt vergeten. */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* DE STIJL STAAT IN /shared/levenspas.css EN NIET HIER. Hij zat eerst als
     tekstblok in dit bestand, met een createElement-dans eromheen om de CSP
     te plezieren -- en daarmee ging dit bestand over de tienkilobyte-grens van
     scripts/check.js regel 13. Als eigen bestand is hij ook eerlijker: een
     stylesheet die als string in een script woont, leest niemand meer als
     stylesheet. Beide pagina's linken hem; ontbreekt hij, dan valt het scherm
     terug op de kale opmaak van de pagina en blijft alles leesbaar. */

  function overEenHalfJaar() {
    var t = new Date();
    t.setMonth(t.getMonth() + 6);
    return t.toISOString().slice(0, 10);
  }

  /* o.post(naam, body)  -- naam is 'kring' | 'vraag' | 'bevestig' | 'verbreek'
                            | 'deel' | 'in'; de PAGINA kent de paden voluit
     o.vak, o.fout, o.vorm, o.naamIn, o.soortIn, o.totIn  -- elementen
     o.tekst  -- de zinnen die per wereld verschillen (je/u, kind of lid) */
  function start(o) {
    var T = o.tekst || {};
    var STAND = null;

    function stukRij(s, eigen) {
      return '<div class="lp-stuk"><span>' + esc(s.wat) + '</span>' +
        '<span class="lp-tot">tot ' + esc(s.vervalt) + '</span>' +
        (eigen ? '<button class="knop lp-mini" data-in="' + esc(s.id) + '">' + esc(T.intrekken || 'Intrekken') + '</button>' : '') +
        '</div>';
    }

    /* De keuzelijst laat alleen zien wat nog NIET aan deze band gegeven is:
       "opnieuw delen" bestaat wel in de server (dat verzet dan de datum), maar
       als keuze op het scherm leest het als een tweede deling. */
    function keuzeVoor(b) {
      var gegeven = {};
      (b.ikDeel || []).forEach(function (x) { gegeven[x.stuk] = 1; });
      return Object.keys(STAND.stukken).filter(function (k) { return !gegeven[k]; })
        .map(function (k) { return '<option value="' + esc(k) + '">' + esc(STAND.stukken[k]) + '</option>'; }).join('');
    }

    function bandRij(b) {
      var open = b.staat === 'gevraagd';
      var keuze = keuzeVoor(b);
      return '<article class="lp-rij" data-staat="' + esc(b.staat) + '">' +
        '<div class="lp-kop"><span class="lp-wie">' + esc(b.ander) + '</span>' +
        '<span class="lp-soort">' + esc(b.soort) + '</span>' +
        '<span class="lp-staat">' + esc(open
          ? (b.ikVroeg ? (T.wacht || 'de ander is aan zet') : (T.aanZet || 'wacht op u'))
          : (b.staat === 'verlopen' ? 'verlopen' : (b.vervalt ? 'loopt tot ' + b.vervalt : 'loopt'))) +
        '</span></div>' +
        (open
          ? '<p class="lp-leeg">' + esc(b.ikVroeg ? (T.zelfGevraagd || '') : (T.vraagtBand || '')) + '</p>' +
            '<div class="lp-vorm">' +
              (b.ikVroeg ? '' : '<button class="knop hoofd lp-mini" data-ja="' + esc(b.id) + '">' + esc(T.bevestig || 'Bevestigen') + '</button>') +
              '<button class="knop lp-mini" data-weg="' + esc(b.id) + '">' +
              esc(b.ikVroeg ? (T.trekVerzoekIn || 'Verzoek intrekken') : (T.weiger || 'Weigeren')) + '</button>' +
            '</div>'
          : '<div class="lp-twee">' +
              '<div class="lp-vak"><h3>' + esc(T.ikGeef || 'U geeft') + '</h3>' +
                ((b.ikDeel || []).length
                  ? b.ikDeel.map(function (s) { return stukRij(s, true); }).join('')
                  : '<p class="lp-leeg">' + esc(T.geeftNiets || '') + '</p>') +
                (keuze
                  ? '<div class="lp-vorm" data-band="' + esc(b.id) + '">' +
                      '<select aria-label="' + esc(T.watGeef || 'Wat geeft u vrij') + '" data-stuk>' + keuze + '</select>' +
                      '<input type="date" aria-label="' + esc(T.totWanneer || 'Tot wanneer') + '" data-tot value="' + esc(overEenHalfJaar()) + '">' +
                      '<button class="knop lp-mini" data-deel>' + esc(T.geven || 'Geven') + '</button></div>'
                  : '') +
              '</div>' +
              '<div class="lp-vak"><h3>' + esc(T.ikZie || 'U ziet') + '</h3>' +
                ((b.ikZie || []).length
                  ? b.ikZie.map(function (s) { return stukRij(s, false); }).join('')
                  : '<p class="lp-leeg">' + esc(T.zietNiets || '') + '</p>') +
              '</div>' +
            '</div>' +
            '<div class="lp-vorm"><button class="knop lp-mini" data-weg="' + esc(b.id) + '">' +
              esc(T.verbreek || 'Band verbreken') + '</button></div>') +
        '</article>';
    }

    function teken(s) {
      STAND = s;
      var wacht = (s.banden || []).filter(function (b) { return b.staat === 'gevraagd' && !b.ikVroeg; });
      o.vak.innerHTML =
        (wacht.length
          ? '<p class="lp-leeg"><b>' + esc(wacht.length === 1 ? (T.eenWacht || '') : (T.velenWachten || '').replace('{n}', wacht.length)) + '</b></p>'
          : '') +
        ((s.banden || []).length ? s.banden.map(bandRij).join('') : '<p class="lp-leeg">' + esc(T.geenBanden || '') + '</p>') +
        '<p class="lp-nooit">' + esc(T.nooit || '') + ' ' + esc((s.nooit || []).join(', ')) + '.</p>';
      o.soortIn.innerHTML = (s.soorten || []).map(function (x) {
        return '<option value="' + esc(x) + '">' + esc(x) + '</option>';
      }).join('');
    }

    function meld(t) { o.fout.textContent = t || ''; o.fout.hidden = !t; }

    function laad() {
      return o.post('kring').then(teken, function (e) {
        o.vak.innerHTML = '<p class="lp-leeg">' + esc(e.message) + '</p>';
      });
    }
    function doe(naam, body) {
      meld('');
      return o.post(naam, body).then(laad, function (e) { meld(e.message); });
    }

    o.vak.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'BUTTON') return;
      if (t.dataset.ja) return doe('bevestig', { bandId: t.dataset.ja });
      if (t.dataset.weg) return doe('verbreek', { bandId: t.dataset.weg });
      if (t.dataset.in) return doe('in', { delingId: t.dataset.in });
      if (t.dataset.deel !== undefined) {
        var vak = t.closest('.lp-vorm');
        return doe('deel', { bandId: vak.dataset.band,
          stuk: vak.querySelector('[data-stuk]').value, vervalt: vak.querySelector('[data-tot]').value });
      }
    });
    o.vorm.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = o.naamIn.value.trim();
      if (!c) return;
      doe('vraag', { codenaam: c, soort: o.soortIn.value, vervalt: o.totIn.value })
        .then(function () { o.naamIn.value = ''; });
    });

    laad();
  }

  w.Levenspas = { start: start, esc: esc };
})(window, document);
