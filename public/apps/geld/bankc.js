/* Stand -- Bank, deel 3: laden, de AI-bankier, de eventstream en de
   aanmelding van de stand. Sluitstuk van bank.js en bankb.js; dit bestand
   laadt als laatste (bestandsnaamvolgorde) en mag dus overal bij. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var B = (w.RTGGeldDeel = w.RTGGeldDeel || {}).bank;
  var $ = function (s) { return d.querySelector(s); };
  var ES = null, EST = null;

  function render() {
    var Geld = w.Geld, el = $('#bkApp');
    if (!B.ov.online) { el.innerHTML = B.offline(); return; }
    if (!B.ov.akkoord) {
      el.innerHTML = B.akkoordVraag();
      $('#bkAkk').addEventListener('click', async function () {
        try { await Geld.api('/api/bank/akkoord'); await B.herlaad(); }
        catch (e) { Geld.melding(e.message); }
      });
      return;
    }
    el.innerHTML = B.vol();
    B.bind();
    hartLaad();
    // na een seintje van de stream ververst het paneel stil: de AI-bankier
    // hoeft niet bij elke binnenkomende boeking opnieuw het woord te nemen
    if (!B.stil) B.ai();
    B.stil = false;
  }

  B.herlaad = async function () { B.ov = await w.Geld.api('/api/bank/overzicht'); render(); };

  async function laad() {
    try { B.ov = await w.Geld.api('/api/bank/overzicht'); render(); }
    catch (e) {
      $('#bkApp').innerHTML = RTGLeeg.html(RTGLeeg.vanFout({ status: 401, message: w.Geld.esc(e.message) }));
    }
  }

  function vang(sel, e) {
    var el = $(sel);
    if (el) el.innerHTML = '<p class="stil">' + w.Geld.esc(e.message) + '</p>';
  }

  // het financiele hart en de premium-kaarten; elk vangt zijn eigen fout,
  // zodat een haperende kaart de rest niet leegtrekt
  async function hartLaad() {
    var Geld = w.Geld;
    try {
      var h = await Geld.api('/api/bank/hart', { limit: 25 });
      B.hart = h.regels || [];
      $('#bkHart').innerHTML = B.hart.length ? B.hart.map(B.hrow).join('') : '<p class="leeg">Nog geen boekingen.</p>';
    } catch (e) { vang('#bkHart', e); }
    try { $('#bkInz').innerHTML = B.inzicht(await Geld.api('/api/bank/inzichten')); }
    catch (e) { vang('#bkInz', e); }
    try {
      var v = await Geld.api('/api/bank/vastelasten');
      $('#bkVast').innerHTML = (v.vasteLasten && v.vasteLasten.length)
        ? v.vasteLasten.map(B.vrow).join('') : '<p class="leeg">Nog geen vaste lasten herkend.</p>';
    } catch (e) { vang('#bkVast', e); }
    $('#bkVeeg').addEventListener('click', async function () {
      try {
        var r = await Geld.api('/api/bank/veeg');
        $('#bkVeegUit').textContent = r.geveegdCenten
          ? Geld.euro(r.geveegdCenten) + ' naar je spaarpot geveegd.' : (r.melding || 'Niets te vegen.');
        if (r.geveegdCenten) await B.herlaad();
      } catch (e) { $('#bkVeegUit').textContent = e.message; }
    });
  }

  // de AI-bankier: bij het openen meteen een analyse, daarna vraag en antwoord
  B.ai = async function (vraag) {
    var Geld = w.Geld, we = $('#bkAiWe'), tips = $('#bkAiTips');
    if (!we) return;
    we.textContent = 'Even kijken…';
    try {
      var r = await Geld.api('/api/bank/advies', vraag ? { vraag: vraag } : {});
      we.textContent = r.antwoord || r.samenvatting || '';
      tips.innerHTML = (r.tips || []).map(function (t) { return '<li>' + Geld.esc(t) + '</li>'; }).join('');
    } catch (e) { we.textContent = e.message; }
  };

  /* Live: de server stuurt een seintje (SSE, scope 'bank') bij elke boeking
     die deze rekeninghouder raakt: rente, een binnenkomende overboeking. Met
     een korte demper, zodat een reeks boekingen een verversing wordt. Het
     token gaat als query mee omdat EventSource geen headers kan sturen; de
     server doet dat op /api/stream bewust zo. */
  function live() {
    if (!w.EventSource || ES) return;
    try { ES = new EventSource('/api/stream?token=' + encodeURIComponent(w.Geld.token() || '')); }
    catch (e) { return; }
    ES.addEventListener('sync', function (e) {
      var scope = null;
      try { scope = JSON.parse(e.data).scope; } catch (x) { /* geen json, geen seintje */ }
      if (scope !== 'bank' || !B.ov) return;
      clearTimeout(EST);
      EST = setTimeout(function () {
        B.stil = true;
        B.herlaad().catch(function () { B.stil = false; });
      }, 400);
    });
  }

  // de schil eist dit: zonder stop blijft de stream herladen op een paneel
  // dat er niet meer staat, en houdt de uitvoer-bron bankdata vast
  function stop() {
    clearTimeout(EST);
    if (ES) { try { ES.close(); } catch (e) { /* al dicht */ } ES = null; }
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  function start() {
    B.stijl();
    B.ov = null; B.hart = null; B.stil = false;
    /* Meenemen (shared/uitvoer.js): het financiele hart als CSV/JSON, met de
       velden los. De datum komt als getal (ms) uit het grootboek; dus via
       new Date(), anders staat er "1785764826" in het bestand. Bij stop()
       gaat de bron weer weg: er is maar een bron per pagina. */
    if (w.RTGUitvoer) w.RTGUitvoer.bron(function () {
      if (!B.hart || !B.hart.length) return null;
      return {
        naam: 'financieel-hart',
        kolommen: ['datum', 'omschrijving', 'soort', 'bron', 'tegenrekening', 'af of bij', 'bedrag'],
        rijen: B.hart.map(function (r) {
          var x = new Date(r.at);
          return [isNaN(x) ? '' : x.toISOString().slice(0, 10), r.oms || '', r.soort || '', r.bron || '',
            r.tegen || '', r.af ? 'af' : 'bij', ((Number(r.centen) || 0) / 100).toFixed(2)];
        })
      };
    });
    laad();
    live();
  }

  V.standen.push({
    id: 'bank',
    naam: 'Bank',
    uitleg: 'Je eigen RTG Rekening: rekeningen en passen, het financiële hart over alles heen, en de AI-bankier.',
    html: '<div id="bkApp"><p class="stil">Laden…</p></div>',
    start: start,
    stop: stop
  });
})(window, document);
