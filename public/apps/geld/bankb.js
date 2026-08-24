/* Stand -- Bank, deel 2: het paneel en de knoppen. Hoort bij bank.js (de
   vormen) en bankc.js (laden, eventstream en de aanmelding van de stand).
   De delen praten via w.RTGGeldDeel.bank; wat hier B.herlaad of B.ai heet,
   zet bankc erop voordat een gebruiker kan klikken. */
(function (w, d) {
  'use strict';
  var B = (w.RTGGeldDeel = w.RTGGeldDeel || {}).bank;

  // de hele stand als hij open en akkoord is; het chrome van bank.html
  // (kop, terugknop) vervalt: dat doet de schil van RTG Geld nu
  B.vol = function () {
    var Geld = w.Geld, ov = B.ov, reks = ov.rekeningen || [];
    return '<h2>De AI-bankier</h2>' +
      '<div class="kaart">' +
        '<div id="bkAiWe" style="white-space:pre-wrap;font-size:.85rem;line-height:1.55;">' +
          'Ik kijk mee met je rekeningen en geef eerlijk advies. Ik adviseer; beslissen doe jij.</div>' +
        '<div class="bk-snel">' +
          '<button class="knop bk-mini" data-bkq="Hoe kan ik het beste sparen?">Beter sparen?</button>' +
          '<button class="knop bk-mini" data-bkq="Sta ik ergens rood en wat kan ik doen?">Sta ik rood?</button>' +
          '<button class="knop bk-mini" data-bkq="Wat kost een lening bij jullie en hoe werkt het?">Lening?</button>' +
        '</div>' +
        '<div class="bk-rij h-mt70">' +
          '<input id="bkAiV" placeholder="Vraag de AI-bankier iets…" style="flex:1;min-width:10rem;">' +
          '<button class="knop hoofd" id="bkAiB">Vraag</button></div>' +
        '<ul id="bkAiTips" class="stil" style="margin:.5rem 0 0 1.1rem;line-height:1.6;font-size:.8rem;"></ul>' +
      '</div>' +
      '<h2>Mijn rekeningen · totaal ' + Geld.euro(ov.totaalCenten) + '</h2>' +
      '<div class="kaart">' + (reks.length ? reks.map(B.rekHtml).join('') : '<p class="stil">Nog geen rekeningen.</p>') + '</div>' +
      '<h2>Nieuwe rekening</h2>' +
      '<div class="kaart"><div class="bk-rij">' +
        '<span><label class="lbl" for="bkNsoort">Soort</label><select id="bkNsoort">' +
          '<option value="betaal">Betaalrekening</option><option value="spaar">Spaarrekening</option>' +
          '<option value="zakelijk">Zakelijke rekening</option></select></span>' +
        '<button class="knop" id="bkNopen">Open rekening</button></div></div>' +
      '<h2>Overboeken tussen mijn rekeningen</h2>' +
      '<div class="kaart"><div class="bk-rij">' +
        '<span><label class="lbl" for="bkOvan">Van</label>' + B.rekSelect('bkOvan') + '</span>' +
        '<span><label class="lbl" for="bkOnaar">Naar</label>' + B.rekSelect('bkOnaar') + '</span>' +
        '<span><label class="lbl" for="bkObed">Bedrag (€)</label>' +
          '<input id="bkObed" type="number" min="0" step="0.01" style="width:7rem;"></span>' +
        '<button class="knop hoofd" id="bkOdoe">Overboek</button></div></div>' +
      '<h2>Het financiële hart</h2>' +
      '<div class="kaart"><p class="stil">Alles op één afschrift: je bankrekeningen, je RTG Pay-wallet en ' +
        'betalingen die via een derde lopen; die dragen alleen een klein bronlabel, verder staan ze er als ' +
        'elke eigen betaling.</p><div class="h-mt50" id="bkHart"><p class="stil">Laden…</p></div></div>' +
      '<h2>Premium, inbegrepen · gratis</h2>' +
      '<div class="kaart"><strong>Inzichten</strong><p class="stil">Je uitgaven van deze maand, per soort.</p>' +
        '<div class="h-mt50" id="bkInz"></div></div>' +
      '<div class="kaart"><strong>Vaste-lasten-radar</strong><p class="stil">Terugkerende afschrijvingen, ' +
        'automatisch herkend.</p><div class="h-mt50" id="bkVast"></div></div>' +
      '<div class="kaart"><strong>Wisselgeld sparen</strong><p class="stil">Elke uitgave rekenen we af naar de ' +
        'hele euro; één veeg zet het wisselgeld van deze maand op je spaarrekening. Geen spaarrekening? Die komt ' +
        'er dan automatisch bij.</p>' +
        '<div class="bk-rij h-mt60"><button class="knop" id="bkVeeg">Veeg mijn wisselgeld</button>' +
        '<span id="bkVeegUit" class="stil"></span></div></div>';
  };

  var $ = function (s) { return d.querySelector(s); };
  function elk(sel, f) {
    var l = d.querySelectorAll('#bkApp ' + sel), i;
    for (i = 0; i < l.length; i++) (function (b) {
      b.addEventListener('click', function () { f(b); });
    })(l[i]);
  }

  /* Bedragen vragen we net als het origineel met prompt(): een formulier per
     rekening zou het paneel verdrievoudigen voor een invoer van een getal. */
  B.bind = function () {
    var Geld = w.Geld;
    $('#bkNopen').addEventListener('click', async function () {
      try { await Geld.api('/api/bank/rekening/open', { soort: $('#bkNsoort').value }); await B.herlaad(); }
      catch (e) { Geld.melding(e.message); }
    });
    $('#bkOdoe').addEventListener('click', async function () {
      var centen = Math.round(Number($('#bkObed').value) * 100);
      try {
        await Geld.api('/api/bank/overboek', { vanIban: $('#bkOvan').value, naarIban: $('#bkOnaar').value, centen: centen, idem: B.sleutel('overboek') });
        $('#bkObed').value = ''; await B.herlaad();
      } catch (e) { Geld.melding(e.message); }
    });
    $('#bkAiB').addEventListener('click', function () {
      var q = $('#bkAiV').value.trim();
      if (q) { B.ai(q); $('#bkAiV').value = ''; }
    });
    $('#bkAiV').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#bkAiB').click(); });
    elk('[data-bkq]', function (b) { B.ai(b.dataset.bkq); });
    elk('[data-bkstort]', async function (b) {
      var euroS = prompt('Hoeveel storten op deze rekening? (euro)');
      if (euroS == null) return;
      try {
        var r = await Geld.api('/api/bank/storten',
          { iban: b.dataset.bkstort, centen: Math.round(Number(euroS) * 100), idem: B.sleutel('stort') });
        Geld.melding('Gestort via ' + r.via + '. Saldo: ' + Geld.euro(r.saldoCenten));
        await B.herlaad();
      } catch (e) { Geld.melding(e.message); }
    });
    elk('[data-bkwallet]', async function (b) {
      var euroS = prompt('Hoeveel naar je RTG Pay-wallet? (euro)');
      if (euroS == null) return;
      try {
        await Geld.api('/api/bank/naar-wallet', { iban: b.dataset.bkwallet, centen: Math.round(Number(euroS) * 100), idem: B.sleutel('naarwallet') });
        await B.herlaad();
      } catch (e) { Geld.melding(e.message); }
    });
    elk('[data-bkpas]', async function (b) {
      try {
        var r = await Geld.api('/api/bank/pas/uitgeven', { iban: b.dataset.bkpas, soort: 'debit', idem: B.sleutel('pasuit') });
        Geld.melding('Pas uitgegeven: ' + r.pas.nummer);
      } catch (e) { Geld.melding(e.message); }
    });
    elk('[data-bkdoel]', async function (b) {
      var euroS = prompt('Wat is je spaardoel? (euro)');
      if (euroS == null) return;
      try {
        var r = await Geld.api('/api/bank/spaardoel', { iban: b.dataset.bkdoel, euro: Number(euroS) });
        Geld.melding('Spaardoel gezet. Je bent op ' + r.pct + '%.');
      } catch (e) { Geld.melding(e.message); }
    });
    // het afschrift van een rekening: uitklapbaar, tweede tik klapt weer in
    elk('[data-bkaf]', async function (b) {
      var blad = d.querySelector('.bk-blad[data-bkblad="' + b.dataset.bkaf + '"]');
      if (!blad) return;
      if (!blad.hidden) { blad.hidden = true; return; }
      try {
        var r = await Geld.api('/api/bank/afschrift', { iban: b.dataset.bkaf, limit: 15 });
        blad.innerHTML = (r.regels && r.regels.length)
          ? r.regels.map(function (x) {
              return '<div>' + (x.af ? '− ' : '+ ') + Geld.euro(x.centen) + ' · ' +
                Geld.esc(x.oms || x.soort) + ' (' + Geld.esc(x.tegen) + ')</div>';
            }).join('')
          : '<div>Nog geen boekingen.</div>';
        blad.hidden = false;
      } catch (e) { Geld.melding(e.message); }
    });
    elk('[data-bkcsv]', function (b) { B.csv(b.dataset.bkcsv); });
  };
})(window, document);
