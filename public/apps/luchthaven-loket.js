/* RTG Airport, de loketten: bagagekelder, VIP en Royal, en de lounges. Dezelfde /api/lucht/*-aanroepen als ervoor; luchthaven.js geeft
   de gedeelde bouwstenen mee (L) en roept deze schermen aan. */
(function (w) {
  'use strict';
  w.RTGLuchtLoket = function (L) {
    var R = w.RTGWerk, $ = R.$, esc = R.esc, item = R.item, knop = R.knop;
    var api = L.api, meld = L.meld, klik = L.klik, stap = L.stap;

    /* ---- bagagekelder ---- */
    function bagage() {
      $('#app').innerHTML = L.kopStuk('Bagagekelder') +
        L.uitleg('De kofferketen: ingecheckt → gesorteerd → geladen → op de band → opgehaald. Achteruit draait hij nooit; vermist kan altijd gemeld en teruggevonden.') +
        '<div class="ds-veldgroep">' + L.veld('Welke koffers', '<select class="ds-invoer" id="bgFilter">' +
          L.opties([['', 'Alle koffers'], ['ingecheckt'], ['gesorteerd'], ['geladen'], ['op-band'], ['vermist', 'vermist']]) + '</select>') + '</div>' +
        '<ul class="ds-lijst" id="bgLijst"></ul>' + L.aiBlok('Bijv. hoe voorkom ik gemiste aansluitingen?');
      L.koppelBasis();
      $('#bgFilter').addEventListener('change', laadBagage);
      laadBagage();
    }
    function laadBagage() {
      stap(api('/api/lucht/bagage', { status: $('#bgFilter').value }).then(function (r) {
        var volgende = function (s) { return s === 'ingecheckt' ? 'gesorteerd' : s === 'gesorteerd' ? 'geladen' : s === 'op-band' ? 'opgehaald' : null; };
        $('#bgLijst').innerHTML = r.koffers.length ? r.koffers.map(function (k) {
          var naar = volgende(k.status);
          return item({ aandacht: k.status === 'vermist', kop: esc(k.tag) + ' · ' + esc(k.vlucht), meta: esc(k.codenaam),
            stand: esc(k.status) + (k.band ? ' · band ' + k.band : ''),
            acties: (naar ? knop('→ ' + naar, 'data-tag="' + esc(k.tag) + '" data-naar="' + naar + '"') : '') +
              (k.status !== 'vermist' && k.status !== 'opgehaald' ? knop('Vermist', 'data-tag="' + esc(k.tag) + '" data-naar="vermist"') : '') +
              (k.status === 'vermist' ? knop('Gevonden → band', 'data-tag="' + esc(k.tag) + '" data-naar="op-band"', true) : '') });
        }).join('') : R.leegRegel('Geen koffers in deze selectie.');
        L.zetUit('koffers', ['tag', 'vlucht', 'reiziger', 'status', 'band'],
          r.koffers.map(function (k) { return [k.tag, k.vlucht, k.codenaam, k.status, k.band || '']; }));
        klik('#bgLijst', '[data-tag]', function (b) {
          stap(api('/api/lucht/bagage/zet', { tag: b.dataset.tag, status: b.dataset.naar }).then(function () { meld('Bijgewerkt.'); laadBagage(); }));
        });
      }));
    }

    /* ---- VIP en Royal: het charterloket + de Koninklijke Vleugel ---- */
    function vip() {
      $('#app').innerHTML = L.kopStuk('VIP en Royal') +
        L.uitleg('Onder PROTOCOLNAAM, nooit de echte naam. Een vip-vlucht boardt pas als alle stappen zijn afgevinkt.', 'Nieuw vip-protocol',
          '<div class="ds-veldgroep">' +
          L.veld('Vlucht', '<input class="ds-invoer" id="vVlucht" placeholder="RT101" maxlength="8">') +
          L.veld('Protocolnaam', '<input class="ds-invoer" id="vNaam" placeholder="Protocolnaam, bijv. Valk Een" maxlength="60">') +
          L.veld('Soort', '<select class="ds-invoer" id="vSoort">' + L.opties([['koninklijk'], ['staatsbezoek'], ['vip']]) + '</select>') + '</div>' +
          '<button class="ds-knop ds-knop--primair ds-taak__actie" type="button" id="vMaak" data-ds-actie="Start protocol">Start protocol</button>') +
        '<ul class="ds-lijst" id="vipLijst"></ul>' +
        '<div class="ds-collectie__kop"><h3 class="ds-kaart__titel">Het charterloket</h3></div>' +
        L.uitleg('Leden vragen een privejet of helikopter aan via de Vluchten-app; OPERATIONS beslist, nooit de AI. Bij bevestiging komt de vlucht direct op het bord met een vrije stand of helipad.') +
        '<ul class="ds-lijst" id="chLijst"></ul>' + L.aiBlok('Bijv. hoe plan ik een staatsbezoek naast de middagpiek?');
      L.koppelBasis();
      $('#vMaak').addEventListener('click', function () {
        stap(api('/api/lucht/vip/maak', { vlucht: $('#vVlucht').value, protocolnaam: $('#vNaam').value, soort: $('#vSoort').value })
          .then(function () { meld('Protocol gestart.'); $('#vVlucht').value = $('#vNaam').value = ''; laadVips(); }));
      });
      laadVips(); laadCharters();
    }
    function laadVips() {
      stap(api('/api/lucht/vip/lijst').then(function (r) {
        $('#vipLijst').innerHTML = r.vips.length ? r.vips.map(function (v) {
          return item({ aandacht: !v.rond, kop: esc(v.protocolnaam), stand: v.rond ? 'gereed' : 'protocol loopt',
            meta: esc(v.soort) + ' · ' + esc(v.suite) + ' · ' + esc(v.vlucht) + ' ' + esc(v.tijd) +
              v.protocol.filter(function (p) { return p.klaar; }).map(function (p) { return ' · ' + esc(p.stap) + ' ✓'; }).join(''),
            acties: v.protocol.filter(function (p) { return !p.klaar; }).map(function (p) { return knop(esc(p.stap), 'data-vip="' + v.id + '" data-stap="' + esc(p.stap) + '"'); }).join('') });
        }).join('') : R.leegRegel('Geen lopende vip-protocollen.');
        klik('#vipLijst', '[data-vip]', function (b) {
          stap(api('/api/lucht/vip/taak', { id: b.dataset.vip, stap: b.dataset.stap }).then(function (r2) {
            meld(r2.rond ? 'Het protocol is rond; de Vleugel is gereed.' : 'Afgevinkt.'); laadVips();
          }));
        });
      }));
    }
    function laadCharters() {
      stap(api('/api/lucht/charters').then(function (r) {
        $('#chLijst').innerHTML = r.charters.length ? r.charters.map(function (c) {
          return item({ aandacht: c.status === 'aangevraagd', kop: esc(c.code) + ' · ' + esc(c.bestemming) + ' · ' + esc(c.soort),
            meta: esc(c.van) + ' · ' + esc(c.datum) + ' ' + esc(c.tijd), stand: esc(c.status),
            acties: c.status === 'aangevraagd' ? knop('Bevestig (uw besluit)', 'data-ok="' + c.id + '"', true) + knop('Wijs af', 'data-nee="' + c.id + '"') : '' });
        }).join('') : R.leegRegel('Geen charteraanvragen.');
        L.zetUit('charters', ['code', 'van', 'bestemming', 'datum', 'tijd', 'status'],
          r.charters.map(function (c) { return [c.code, c.van, c.bestemming, c.datum, c.tijd, c.status]; }));
        klik('#chLijst', '[data-ok]', function (b) {
          stap(api('/api/lucht/charter/beslis', { id: b.dataset.ok, akkoord: true }).then(function (r2) {
            meld('Bevestigd: ' + r2.vlucht.nummer + ' op ' + r2.vlucht.gate + '.'); laadCharters();
          }));
        });
        klik('#chLijst', '[data-nee]', function (b) {
          stap(api('/api/lucht/charter/beslis', { id: b.dataset.nee, akkoord: false }).then(function () { meld('Afgewezen.'); laadCharters(); }));
        });
      }));
    }

    /* ---- de lounges: binnen op de boarding pass ---- */
    function lounge() {
      $('#app').innerHTML = L.kopStuk('De lounges') +
        L.uitleg('Op vertoon van een geldige boarding pass. De Koninklijke Vleugel is uitsluitend voor gasten op een vlucht met een vip-protocol.', 'Gast ontvangen',
          '<div class="ds-veldgroep">' +
          L.veld('Boarding pass-code', '<input class="ds-invoer" id="lgCode" placeholder="Boarding pass-code (BP.… )" maxlength="80" autocomplete="off" spellcheck="false">') +
          L.veld('Lounge', '<select class="ds-invoer" id="lgWaar">' + L.opties([['salon', 'Salon Lounge'], ['royal', 'De Koninklijke Vleugel']]) + '</select>') + '</div>' +
          '<button class="ds-knop ds-knop--primair ds-taak__actie" type="button" id="lgIn" data-ds-actie="Gast ontvangen">Welkom ✓</button>') +
        '<ul class="ds-lijst" id="lgLijst"></ul>' + L.aiBlok('Bijv. hoe druk wordt het rond de avondvertrekken?');
      L.koppelBasis();
      $('#lgIn').addEventListener('click', function () {
        stap(api('/api/lucht/lounge/in', { lounge: $('#lgWaar').value, code: $('#lgCode').value }).then(function (r) {
          meld('Welkom in ' + r.lounge + ', ' + r.gast.codenaam + '.'); $('#lgCode').value = ''; laadLounge();
        }));
      });
      laadLounge();
    }
    function laadLounge() {
      stap(api('/api/lucht/lounge').then(function (r) {
        $('#lgLijst').innerHTML = r.lounges.map(function (l) {
          return item({ aandacht: l.binnen >= l.capaciteit, kop: esc(l.naam), stand: l.binnen + ' / ' + l.capaciteit,
            meta: l.gasten.length ? l.gasten.map(function (g) { return esc(g.codenaam) + ' · ' + esc(g.vlucht) + ' ' + esc(g.tijd); }).join('; ') : 'Nog geen gasten.',
            acties: l.gasten.map(function (g) { return knop('uitchecken ' + esc(g.codenaam), 'data-uit="' + g.id + '"'); }).join('') });
        }).join('');
        var gasten = [];
        r.lounges.forEach(function (l) { l.gasten.forEach(function (g) { gasten.push([l.naam, g.codenaam, g.vlucht, g.tijd]); }); });
        L.zetUit('loungegasten', ['lounge', 'gast', 'vlucht', 'tijd'], gasten);
        klik('#lgLijst', '[data-uit]', function (b) {
          stap(api('/api/lucht/lounge/uit', { id: b.dataset.uit }).then(function () { meld('Tot ziens.'); laadLounge(); }));
        });
      }));
    }
    return { bagage: bagage, vip: vip, lounge: lounge };
  };
}(window));
