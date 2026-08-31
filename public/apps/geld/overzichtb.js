/* Stand Overzicht, deel 2 van 3: de vlakken en het geheugen. Deel 1 zet de
   naamruimte en het paneel neer, deel 3 registreert de stand en de kliks;
   hier staat wat tekent en onthoudt: het Waarom-vlak, de tijdlijn, het
   vraagvak en de meeneembron. Gesplitst om de maatregel van de repo
   (bestanden onder de 10 KB) te halen; het is samen een stand.

   Routes van dit deel, letterlijk: /api/geld/actielog en /api/geld/rahul.
   De cockpit zelf haalt deel 1 op; dit deel krijgt hem als argument en
   haalt niets dubbel op (een waarheid, een plek). */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var O = Deel.overzicht = Deel.overzicht || {};
  var $ = function (s) { return d.querySelector(s); };

  /* Het geheugen voor de meeneembron: de laatst getekende tijdlijn, met de
     rauwe centen. Niet uit de DOM terugschrapen, want de export hoort het
     gegeven te dragen en niet de opmaak van het scherm. */
  var laatste = [];

  /* De richting bepaalt het teken, niet het toevallige teken van de bron:
     'uit' toont altijd een min (Geld.euro zet die zelf), ook als een bron
     zijn centen positief aanlevert. Zonder richting blijft het getal met
     rust -- dan weet alleen de bron wat het teken betekent. */
  function tekenCenten(r) {
    var c = Math.round(Number(r.centen) || 0);
    if (r.richting === 'uit') return -Math.abs(c);
    if (r.richting === 'in') return Math.abs(c);
    return c;
  }

  /* De dagkop is de LOKALE dag: een betaling om 23:40 hoort bij vandaag,
     ook als hij in UTC al op morgen staat. Een onleesbare tijd valt terug
     op de tekst zelf, zodat een rare bron zichtbaar raar is en niet stil
     onder een verkeerde kop schuift. */
  function dagVan(iso) {
    var x = new Date(iso);
    if (isNaN(x)) return String(iso || '').slice(0, 10);
    return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) +
      '-' + ('0' + x.getDate()).slice(-2);
  }

  function uurVan(iso) {
    var x = new Date(iso);
    if (isNaN(x)) return '';
    return ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2);
  }

  function verant(regels) {
    return '<div class="ovVerant stil">' + regels.map(function (g) {
      return '<div>' + w.Geld.esc(g) + '</div>';
    }).join('') + '</div>';
  }

  /* Het Waarom-vlak (GELD.md par. 5): elk signaal is uitlegbaar met de
     uitleg, de gebruikte gegevens en het actielog. Het log komt vers van de
     server, want het vlak is juist de plek waar verouderd niet mag; het is
     niet per uitzondering, dus twee snelle opens die elkaar inhalen tonen
     hetzelfde en kunnen elkaar niets fout vullen. */
  O.waarom = async function (c, id) {
    var Geld = w.Geld, esc = Geld.esc;
    var vak = $('#ovWaarom');
    if (!vak) return;
    var u = null, ll = (c && c.uitzonderingen) || [];
    for (var i = 0; i < ll.length; i++) if (ll[i].id === id) u = ll[i];
    vak.hidden = false;
    if (!u) {
      /* kan echt gebeuren: het beeld is net ververst en de uitzondering is
         opgelost -- dat eerlijk zeggen is beter dan stil niets doen */
      vak.innerHTML = '<p class="stil">Deze uitzondering staat niet meer in het beeld.</p>' +
        '<button class="knop" type="button" data-ovdicht>Sluiten</button>';
      return;
    }
    vak.innerHTML =
      '<div class="ovWkop"><h3>' + esc(u.titel || '') + '</h3>' +
        '<button class="knop" type="button" data-ovdicht>Sluiten</button></div>' +
      '<p>' + esc(u.uitleg || '') + '</p>' +
      '<h4>Gebruikte gegevens</h4>' +
      ((u.gegevens || []).length ? verant(u.gegevens)
        : '<p class="stil">Geen brongegevens meegegeven.</p>') +
      '<h4>Actielog</h4><div class="ovVerant stil" id="ovWLog">Laden...</div>';
    try {
      var r = await Geld.api('/api/geld/actielog');
      var log = (r.log || []).slice(0, 8);
      var el = d.getElementById('ovWLog');
      if (!el) return; /* het vlak is intussen gesloten of hertekend */
      el.innerHTML = log.length ? log.map(function (l) {
        return '<div>' + esc(Geld.datum(l.tijd) + ' ' + uurVan(l.tijd)) + ' · <b>' +
          esc(l.wie === 'rahul' ? 'Rahul' : l.wie === 'lid' ? 'u' : l.wie) +
          '</b> · ' + esc(l.wat) + '</div>';
      }).join('') : 'Nog geen handelingen.';
    } catch (e) {
      var stuk = d.getElementById('ovWLog');
      if (stuk) stuk.textContent = e.message;
    }
  };

  /* De tijdlijn (GELD.md par. 6): het financiele geheugen, per dag. De
     server geeft hoogstens twintig regels en dat is het hele verhaal: geen
     laad-meer en geen oneindige scroll, want de dagstart is een moment en
     geen feed (huisregel, GELD.md par. 7). */
  O.tijdlijn = function (c) {
    var Geld = w.Geld, esc = Geld.esc;
    var vak = $('#ovTijd');
    if (!vak) return;
    var rs = (c && c.tijdlijn) || [];
    laatste = rs;
    if (!rs.length) {
      vak.innerHTML = RTGLeeg.html({ ey: 'Logboek', titel: 'Nog geen gebeurtenissen.',
        wat: 'Zodra er geld beweegt of een besluit valt, staat het hier met datum en bron.' });
      return;
    }
    var vandaag = dagVan(new Date());
    var g = new Date(); g.setDate(g.getDate() - 1);
    var gisteren = dagVan(g);
    var html = '', vorige = null;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i], dag = dagVan(r.tijd);
      if (dag !== vorige) {
        html += '<div class="ovTdag">' +
          esc(dag === vandaag ? 'Vandaag' : dag === gisteren ? 'Gisteren' : dag) + '</div>';
        vorige = dag;
      }
      var geld = (r.centen == null || !isFinite(Number(r.centen))) ? '' : Geld.euro(tekenCenten(r));
      html += '<a class="ovTr" href="' + esc(r.link || '#overzicht') + '">' +
        '<span class="ovTu">' + esc(uurVan(r.tijd)) + '</span>' +
        '<span class="ovTt">' + esc(r.titel || '') +
          '<span class="ovTbron">' + esc(r.bron || '') + '</span></span>' +
        (geld ? '<span class="ovTb">' + esc(geld) + '</span>' : '') +
      '</a>';
    }
    vak.innerHTML = html;
  };

  /* Het vraagvak: het antwoord en de verantwoording horen samen op het
     scherm (GELD.md par. 5, ONTWERP.md) -- een antwoord zonder bronregels
     is een orakel, en orakels horen niet in een geldscherm. */
  O.rahulVraag = async function () {
    var Geld = w.Geld;
    var inEl = $('#ovRahulIn'), uit = $('#ovRahulUit');
    if (!inEl || !uit) return;
    var vraag = inEl.value.trim();
    if (!vraag) return;
    uit.textContent = 'Een ogenblik...';
    try {
      var r = await Geld.api('/api/geld/rahul', { vraag: vraag });
      var gg = r.gegevens || [];
      uit.innerHTML = '<p>' + Geld.esc(r.antwoord || '') + '</p>' + (gg.length ? verant(gg) : '');
      inEl.value = '';
    } catch (e) {
      /* de hint hoort alleen bij "niet ingelogd" (401); een 500 of
         netwerkfout tegen een ingelogd lid "log eerst in" noemen is een
         leugen -- dezelfde regel als logboekb.js */
      uit.textContent = e.message + (e.status === 401 ? ' Log eerst in via de leden-app.' : '');
    }
  };

  /* De meeneembron voor shared/uitvoer.js. Bedragen met een punt en met het
     teken van de richting: de centen zijn het gegeven, de komma en het
     euroteken van het scherm zijn opmaak. Deel 3 meldt dit model per start
     aan en wist het in stop -- het document heeft EEN bron-slot (zie het
     waarom in wbwb.js). Zonder regels null, dan doet de tabellezer zijn
     gewone werk voor de rest van het scherm. */
  O.bron = function () {
    if (!d.getElementById('ovTijd')) return null;
    var rijen = laatste.map(function (r) {
      var b = (r.centen == null || !isFinite(Number(r.centen))) ? '' : (tekenCenten(r) / 100).toFixed(2);
      return [dagVan(r.tijd), r.titel || '', b, r.bron || ''];
    });
    return rijen.length
      ? { naam: 'geld-tijdlijn', kolommen: ['datum', 'titel', 'bedrag', 'bron'], rijen: rijen }
      : null;
  };

  /* Alleen de vormen die de schil niet kent; alles hangt aan de eigen
     ov-klassen, dus een blok te veel in head stoort niemand. Via
     createElement en niet als <style> in een html-string: de voordeur
     stempelt alleen echte elementen met de CSP-nonce (zie rtgcodeb.js).
     Meteen bij het laden, want dit deel heeft geen eigen start-moment. */
  if (!d.getElementById('ovbStijl')) {
    var st = d.createElement('style');
    st.id = 'ovbStijl';
    st.textContent =
      '#paneel .ovTdag{margin:1rem 0 .15rem;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--rtg-soft);}' +
      '#paneel .ovTr{display:flex;gap:.7rem;align-items:baseline;padding:.5rem 0;border-top:1px solid var(--rtg-line);color:var(--rtg-txt);text-decoration:none;}' +
      '#paneel .ovTu{flex:0 0 auto;color:var(--rtg-soft);font-variant-numeric:tabular-nums;font-size:.8rem;}' +
      '#paneel .ovTt{flex:1;font-size:.9rem;}' +
      '#paneel .ovTbron{display:block;font-size:.72rem;color:var(--rtg-soft);}' +
      '#paneel .ovTb{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;}' +
      '#paneel .ovVerant{font-size:.78rem;line-height:1.55;display:flex;flex-direction:column;gap:.15rem;}' +
      '#paneel .ovWkop{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem;}' +
      '#paneel #ovWaarom h4{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--rtg-soft);margin:.9rem 0 .25rem;}';
    d.head.appendChild(st);
  }
})(window, document);
