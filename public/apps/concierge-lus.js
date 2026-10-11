/* Het concierge-bureau, de kant van de CASE-EIGENAAR in de concierge-lus
   (CONCIERGE.md par. 0a en 2).

   De routes stonden sinds 30 september 2026 (routes/office/concierge.js:
   /api/office/bureau en /api/office/bureau/lus/*), maar geen enkel scherm riep
   ze aan. Het kantoor zag een lus-case dus nergens, en kon geen aanbod, geen
   vertraging en geen herstel zetten. Dit bestand hangt die werkvloer in
   apps/concierge.html, de eigenaar van kantoor.concierge (SCHERMEIGENAAR.json):
   geen tweede bureau, een sectie op het bestaande.

   Vier dingen die het scherm niet zelf beslist en dus ook niet nabootst:

   1. OF IETS BINNEN HET MANDAAT VALT. "Kiezen" vraagt het de server; die zet
      het vast of legt het voorstel bij het lid, en het scherm zegt welke van de
      twee het werd -- met de reden die de server gaf.
   2. OF EEN AANBOD NOG GELDT. De stand komt uit aanbodStand() met de klok van
      de server. Een verlopen aanbod krijgt geen kiesknop.
   3. WIE ER BERICHT KRIJGT. Een vertraging zet berichten KLAAR. Versturen kan
      pas als de mens elk klaargezet bericht heeft aangevinkt, en de server
      controleert dat de lijst gelijk is (CON-06). Bij een verrassing weigert de
      server elke ontvanger die de verraste kan zien (CON-08).
   4. OF DE ZAAK "GEREGELD" MAG HETEN. Dat beslist afsluitbaar() op de server;
      het scherm toont de reden waarom niet.

   De naam van wie een zaak oppakt komt uit de SESSIE (AUTHORITY.md). Met de
   gedeelde kantoorcode is er geen naam, en dan ziet het lid een rol.

   Wat de werkvloer TOONT staat in ./concierge-lus-vorm.js; dit bestand bedient
   hem. Gebruikt de globale helpers van concierge.html ($, esc, api, meld); alles
   staat in een IIFE. */
(function () {
  'use strict';

  var open = null;      // {key, id} van de case die openligt
  var tijdOk = function (t) { return /^\d{1,2}:\d{2}$/.test(t); };

  function sectie(d) {
    var zaken = (d && d.zaken) || [];
    var h = '<div class="sectie"><span>Privékantoor</span><h2>Zaken van De Rechterhand</h2></div>';
    if (!zaken.length) return h + '<div class="leeg">Geen open zaken.</div>';
    return h + zaken.map(function (z) {
      return '<div class="kaart" data-bureau="' + esc(z.id) + '" data-key="' + esc(z.key) + '">'
        + '<div class="kop"><span class="nm">' + esc(z.titel) + '</span><span class="status' + (z.wachtOpLid ? ' aangevraagd' : '') + '">'
        + esc(z.wachtOpLid ? 'wacht op het lid' : z.status) + '</span></div>'
        + '<div class="cn">' + esc(z.codenaam || 'lid') + ' · ' + esc(z.soort) + ' · ' + esc(z.domein) + (z.lus ? ' · concierge-lus' : '') + '</div>'
        + (z.laatste ? '<div class="meta">Laatste stap: ' + esc(z.laatste) + '</div>' : '')
        + (z.lus
          ? '<div class="acties"><button class="knop" data-lus-open>Openen</button></div><div class="lus-werk"></div>'
          : '<input class="veld notitie" placeholder="Notitie voor het lid (optioneel)"><div class="acties">'
            + ((d.statussen || []).map(function (s) {
              return '<button class="knop' + (s === 'afgewezen' ? ' af' : s === 'geregeld' ? ' doe' : '') + '" data-bureau-s="' + esc(s) + '">' + esc(s) + '</button>';
            }).join('')) + '</div>')
        + '</div>';
    }).join('');
  }

  function bind(herlaad) {
    document.querySelectorAll('[data-bureau]').forEach(function (k) {
      var key = k.dataset.key, id = k.dataset.bureau;
      var o = k.querySelector('[data-lus-open]');
      if (o) o.onclick = function () { open = { key: key, id: id }; werk(k); };
      k.querySelectorAll('[data-bureau-s]').forEach(function (b) {
        b.onclick = async function () {
          try {
            await api('bureau/voortgang', { key: key, id: id, status: b.dataset.bureauS, notitie: k.querySelector('.notitie').value });
            meld('Bijgewerkt: ' + b.dataset.bureauS); herlaad();
          } catch (e) { meld(e.message); }
        };
      });
      if (open && open.id === id && open.key === key && o) werk(k);
    });
  }

  async function werk(kaart) {
    var el = kaart.querySelector('.lus-werk');
    var key = kaart.dataset.key, id = kaart.dataset.bureau;
    var d;
    try { d = await api('bureau/lus', { key: key, id: id }); }
    catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
    window.RTGLusVorm.tekenWerk(el, d);

    var doe = function (pad, body, klaar) {
      return async function () {
        this.disabled = true;
        var bericht;
        try {
          var r = await api('bureau/lus' + pad, Object.assign({ key: key, id: id }, body()));
          bericht = klaar ? klaar(r) : 'Bijgewerkt.';
        } catch (e) { bericht = e.message; }
        /* Eerst de werkvloer opnieuw, dan de melding: wie na de melding verder
           typt, typt dan niet in een veld dat een tel later wordt vervangen. */
        await werk(kaart);
        meld(bericht);
      };
    };
    var w = function (sel) { var x = el.querySelector(sel); return x ? x.value.trim() : ''; };
    var knop = function (sel, fn) { var b = el.querySelector(sel); if (b) b.onclick = fn; };

    knop('[data-l-neem]', doe('/neem', function () { return {}; }, function (r) {
      return r.eigenaar && r.eigenaar.naam ? 'Op uw naam.' : 'Opgepakt. Met de gedeelde kantoorcode ziet het lid een rol en geen naam.';
    }));
    knop('[data-l-weigering]', doe('/weigering', function () { return { reden: w('.js-weigering') }; },
      function (r) { return 'In de tijdlijn gezet. Soort: ' + r.soort + '.'; }));
    knop('[data-l-aanbod]', function () {
      var van = w('.js-a-van');
      if (van && !tijdOk(van)) return meld('Schrijf de tijd als uu:mm.');
      return doe('/aanbod', function () {
        return { wat: w('.js-a-wat'), van: van, duurMin: Number(w('.js-a-duur')) || 0,
          bedragCenten: Math.round((Number(w('.js-a-bedrag')) || 0) * 100), zaak: w('.js-a-zaak'),
          geldigMin: Number(w('.js-a-geldig')) || 0, bron: w('.js-a-bron') || 'normaal', vervangt: w('.js-a-vervangt') };
      }, function (r) { return 'Vastgelegd: ' + (r.aanbod && r.aanbod.stand) + '.'; }).call(this);
    });
    el.querySelectorAll('[data-aanbod]').forEach(function (a) {
      var b = a.querySelector('[data-l-kies]');
      if (b) b.onclick = doe('/kies', function () { return { aanbod: a.dataset.aanbod }; }, function (r) {
        return r.vastgezet ? 'Binnen het mandaat: vastgezet. ' + (r.reden || '') : 'Buiten het mandaat: het voorstel ligt bij het lid. ' + (r.reden || '');
      });
    });
    knop('[data-l-onderdeel]', function () {
      var van = w('.js-o-van');
      if (van && !tijdOk(van)) return meld('Schrijf de tijd als uu:mm.');
      return doe('/onderdeel', function () {
        return { wat: w('.js-o-wat'), van: van, duurMin: Number(w('.js-o-duur')) || 0, reisMin: Number(w('.js-o-reis')) || 0,
          zaak: w('.js-o-zaak'), bevestigd: !!(el.querySelector('.js-o-bev') || {}).checked };
      }).call(this);
    });
    el.querySelectorAll('[data-onderdeel]').forEach(function (r) {
      var oid = r.dataset.onderdeel;
      var b1 = r.querySelector('[data-l-bevestig]');
      if (b1) b1.onclick = doe('/bevestig', function () { return { onderdeel: oid }; });
      var b2 = r.querySelector('[data-l-vertraging]');
      if (b2) b2.onclick = doe('/vertraging', function () { return { onderdeel: oid, minuten: Number(r.querySelector('.js-min').value) || 0 }; },
        function (x) { return (x.klaar ? x.klaar.berichten.length : 0) + ' bericht(en) klaargezet. Er is nog niets verstuurd.'; });
      var b3 = r.querySelector('[data-l-kapot]');
      if (b3) b3.onclick = doe('/kapot', function () { return { onderdeel: oid, reden: r.querySelector('.js-reden').value.trim() }; },
        function () { return 'In herstel. Leg een alternatief vast dat dit onderdeel vervangt.'; });
    });
    var vinkjes = el.querySelectorAll('.js-gezien'), verstuur = el.querySelector('[data-l-verstuur]');
    vinkjes.forEach(function (v) {
      v.onchange = function () { verstuur.disabled = Array.prototype.some.call(vinkjes, function (x) { return !x.checked; }); };
    });
    if (verstuur) verstuur.onclick = doe('/verstuur', function () {
      return { klaar: (el._klaar || {}).id, gezien: Array.prototype.filter.call(vinkjes, function (x) { return x.checked; }).map(function (x) { return x.value; }) };
    }, function (r) {
      var uit = r.uitslag || [];
      var niet = uit.filter(function (x) { return !x.bezorgd; });
      return (uit.length - niet.length) + ' van ' + uit.length + ' bezorgd' + (niet.length ? '. Niet: ' + niet.map(function (x) { return x.reden; }).join(' ') : '.');
    });
    el._klaar = d.klaar;
    var sluit = function (status) {
      return async function () {
        this.disabled = true;
        try {
          await api('bureau/voortgang', { key: key, id: id, status: status, notitie: w('.js-slot') });
          meld(status === 'geregeld' ? 'Geregeld, met de uitkomst erbij.' : 'Afgewezen. Het lid krijgt bericht.');
          open = null;
          if (window.RTGLusKantoor.herlaad) window.RTGLusKantoor.herlaad();
        } catch (e) { meld(e.message); werk(kaart); }
      };
    };
    knop('[data-l-geregeld]', sluit('geregeld'));
    knop('[data-l-afgewezen]', sluit('afgewezen'));
  }

  window.RTGLusKantoor = { sectie: sectie, bind: function (herlaad) { window.RTGLusKantoor.herlaad = herlaad; bind(herlaad); } };
})();
