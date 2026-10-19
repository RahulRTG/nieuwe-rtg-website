/* RTG Airport, het bord: vluchtleiding, platform (de draai) en toren.
   Dezelfde /api/lucht/*-aanroepen als ervoor; luchthaven.js geeft de
   gedeelde bouwstenen mee (L) en roept deze schermen aan. */
(function (w) {
  'use strict';
  w.RTGLuchtBord = function (L) {
    var R = w.RTGWerk, $ = R.$, esc = R.esc, item = R.item, knop = R.knop;
    var api = L.api, meld = L.meld, klik = L.klik, stap = L.stap, zetUit = L.zetUit;
    function plekkenVoor(cat) { return cat === 'helikopter' ? L.C().helipads : cat === 'privejet' ? L.C().stands : L.C().gates; }
    function vertrekStap(v) { return v.status === 'gepland' ? 'inchecken' : v.status === 'inchecken' ? 'boarding' : v.status === 'boarding' ? 'vertrokken' : null; }
    function aankomstStap(v) { return v.status === 'onderweg' ? 'geland' : v.status === 'geland' ? 'bagage-op-band' : v.status === 'bagage-op-band' ? 'afgerond' : null; }

    /* ---- vluchtleiding ---- */
    function schermVluchtleiding() {
      $('#app').innerHTML = L.kopStuk('Vluchtleiding') +
        L.uitleg('', 'Nieuwe vlucht op het bord', '<div class="ds-veldgroep">' +
           L.veld('Vluchtnummer', '<input class="ds-invoer" id="nNr" placeholder="RT123" maxlength="8">') +
           L.veld('Soort', '<select class="ds-invoer" id="nSoort">' + L.opties([['vertrek'], ['aankomst']]) + '</select>') +
           L.veld('Categorie', '<select class="ds-invoer" id="nCat">' + L.opties([['lijn', 'lijnvlucht'], ['privejet', 'privejet'], ['helikopter', 'helikopter']]) + '</select>') +
           L.veld('Bestemming / herkomst', '<input class="ds-invoer" id="nBest" placeholder="Bestemming / herkomst" maxlength="60">') +
           L.veld('Tijd', '<input class="ds-invoer" id="nTijd" type="time" value="12:00">') +
           L.veld('Gate', '<select class="ds-invoer" id="nGate"></select>') + '</div>' +
          '<button class="ds-knop ds-knop--primair ds-taak__actie" type="button" id="nMaak" data-ds-actie="Op het bord">Op het bord</button>') +
        '<ul class="ds-lijst" id="vlLijst"></ul>' + L.aiBlok('Bijv. welke kist verdient nu voorrang?');
      L.koppelBasis();
      var vulPlekken = function () { $('#nGate').innerHTML = plekkenVoor($('#nCat').value).map(function (g) { return '<option>' + esc(g) + '</option>'; }).join(''); };
      vulPlekken();
      $('#nCat').addEventListener('change', vulPlekken);
      $('#nMaak').addEventListener('click', function () {
        stap(api('/api/lucht/vlucht/maak', { nummer: $('#nNr').value, soort: $('#nSoort').value, categorie: $('#nCat').value,
          bestemming: $('#nBest').value, tijd: $('#nTijd').value, gate: $('#nGate').value })
          .then(function () { meld('Op het bord.'); laadVluchten(); }));
      });
      laadVluchten();
    }
    function vluchtRegel(v, acties) {
      var stand = v.geannuleerd ? 'geannuleerd' : v.status;
      var meta = [esc(v.tijd), esc(v.categorie), 'gate ' + esc(v.gate), esc(v.toestel)];
      if (v.vertraging) meta.push('+' + v.vertraging.minuten + ' min · ' + esc(v.vertraging.reden));
      if (v.klaring) meta.push('klaring ' + esc(v.klaring.baan));
      if (v.band) meta.push('band ' + v.band);
      if (v.vip) meta.push(esc(v.vip.soort) + (v.vip.rond ? ' · gereed' : ' · protocol loopt'));
      if (v.draai) meta.push('draai ' + (v.draai.klaar ? 'rond' : v.draai.taken.filter(function (t) { return !t.klaar; }).length + ' open'));
      return item({ aandacht: v.geannuleerd || !!v.vertraging, kop: esc(v.nummer) + ' · ' + esc(v.bestemming) + ' · ' + esc(v.soort),
        meta: meta.join(' · '), acties: acties, stand: esc(stand) });
    }
    function laadVluchten() {
      stap(api('/api/lucht/bord', {}).then(function (r) {
        $('#vlLijst').innerHTML = r.vluchten.length ? r.vluchten.map(function (v) {
          var naar = v.geannuleerd ? null : (v.soort === 'vertrek' ? vertrekStap(v) : aankomstStap(v));
          var acties = (naar ? knop('→ ' + naar, 'data-stap="' + v.id + '" data-naar="' + naar + '"', true) : '') +
            (!v.geannuleerd && ['vertrokken', 'afgerond'].indexOf(v.status) < 0 ? knop('Vertraging', 'data-ver="' + v.id + '"') +
              knop('Gate', 'data-gate="' + v.id + '"') + knop('Annuleer', 'data-ann="' + v.id + '"') : '');
          return vluchtRegel(v, acties);
        }).join('') : R.leegRegel('Geen vluchten op het bord.');
        zetUit('vluchten', ['nummer', 'soort', 'categorie', 'bestemming', 'tijd', 'gate', 'status'],
          r.vluchten.map(function (v) { return [v.nummer, v.soort, v.categorie, v.bestemming, v.tijd, v.gate, v.geannuleerd ? 'geannuleerd' : v.status]; }));
        klik('#vlLijst', '[data-stap]', function (b) { stap(api('/api/lucht/vlucht/status', { id: b.dataset.stap, status: b.dataset.naar }).then(function () { meld('Bijgewerkt.'); laadVluchten(); })); });
        klik('#vlLijst', '[data-ver]', function (b) {
          var m = w.prompt('Hoeveel minuten vertraging?', '30'); if (!m) return;
          var reden = w.prompt('Reden (komt op het bord):', 'late aankomst toestel') || '';
          stap(api('/api/lucht/vlucht/vertraag', { id: b.dataset.ver, minuten: m, reden: reden }).then(function () { meld('Vertraging op het bord.'); laadVluchten(); }));
        });
        klik('#vlLijst', '[data-gate]', function (b) {
          var g = w.prompt('Nieuwe gate (' + L.C().gates.join(', ') + '):', L.C().gates[0]); if (!g) return;
          stap(api('/api/lucht/vlucht/gate', { id: b.dataset.gate, gate: g }).then(function () { meld('Gate gewijzigd.'); laadVluchten(); }));
        });
        klik('#vlLijst', '[data-ann]', function (b) {
          if (!w.confirm('Deze vlucht annuleren?')) return;
          stap(api('/api/lucht/vlucht/status', { id: b.dataset.ann, status: 'geannuleerd' }).then(function () { meld('Geannuleerd.'); laadVluchten(); }));
        });
      }));
    }

    /* ---- platform: de draai ---- */
    function schermPlatform() {
      $('#app').innerHTML = L.kopStuk('Platform · de draai') +
        L.uitleg('Elke vertrekkende kist heeft zes platformtaken. Pas als de draai rond is, mag de gate het boarden starten.') +
        '<ul class="ds-lijst" id="drLijst"></ul>' + L.aiBlok('Bijv. welke draai pak ik als eerste?');
      L.koppelBasis();
      stap(api('/api/lucht/bord', { soort: 'vertrek' }).then(function (r) {
        var actief = r.vluchten.filter(function (v) { return !v.geannuleerd && v.status !== 'vertrokken'; });
        $('#drLijst').innerHTML = actief.length ? actief.map(function (v) {
          var open = v.draai.taken.filter(function (t) { return !t.klaar; }).length;
          return item({ aandacht: !v.draai.klaar, kop: esc(v.nummer) + ' · ' + esc(v.bestemming) + ' · ' + esc(v.tijd),
            meta: v.draai.taken.filter(function (t) { return t.klaar; }).map(function (t) { return esc(t.taak) + ' ✓'; }).join(' · '),
            acties: v.draai.taken.filter(function (t) { return !t.klaar; }).map(function (t) { return knop(esc(t.taak), 'data-vl="' + v.id + '" data-taak="' + esc(t.taak) + '"'); }).join(''),
            stand: v.draai.klaar ? 'draai rond' : open + ' taken open' });
        }).join('') : R.leegRegel('Geen kisten op het platform.');
        klik('#drLijst', '[data-taak]', function (b) {
          stap(api('/api/lucht/draai/taak', { id: b.dataset.vl, taak: b.dataset.taak }).then(function (r2) {
            meld(r2.rond ? 'De draai is rond; de kist mag boarden.' : 'Afgevinkt.'); schermPlatform();
          }));
        });
      }));
    }

    /* ---- toren ---- */
    function schermToren() {
      $('#app').innerHTML = L.kopStuk('Toren · verkeersleiding') +
        L.uitleg('Zonder klaring van de toren vertrekt er niets. Klaring volgt pas als de kist aan het boarden is; de mens in de toren beslist. Banen: ' + L.C().banen.map(esc).join(' en ') + '.') +
        '<ul class="ds-lijst" id="toLijst"></ul>' + L.aiBlok('Bijv. welke baan geef ik de volgende vertrekker?');
      L.koppelBasis();
      stap(api('/api/lucht/bord', { soort: 'vertrek' }).then(function (r) {
        var wacht = r.vluchten.filter(function (v) { return !v.geannuleerd && v.status !== 'vertrokken'; });
        $('#toLijst').innerHTML = wacht.length ? wacht.map(function (v) {
          var keuze = v.categorie === 'helikopter' ? L.C().helipads : L.C().banen;
          var kan = !v.klaring && v.status === 'boarding';
          return item({ aandacht: kan, kop: esc(v.nummer) + ' · ' + esc(v.tijd) + ' · ' + esc(v.status) + (v.categorie === 'helikopter' ? ' · helikopter' : ''),
            meta: v.klaring ? 'klaring ' + esc(v.klaring.baan) : v.status === 'boarding' ? 'wacht op klaring' : 'nog niet aan het boarden',
            acties: kan ? keuze.map(function (b) { return knop('Klaring ' + esc(b), 'data-kl="' + v.id + '" data-baan="' + esc(b) + '"', true); }).join('') : '' });
        }).join('') : R.leegRegel('Geen vertrekkers in de wacht.');
        klik('#toLijst', '[data-kl]', function (b) {
          stap(api('/api/lucht/toren/klaring', { id: b.dataset.kl, baan: b.dataset.baan }).then(function () { meld('Klaring gegeven.'); schermToren(); }));
        });
      }));
    }
    return { vluchtleiding: schermVluchtleiding, platform: schermPlatform, toren: schermToren };
  };
}(window));
