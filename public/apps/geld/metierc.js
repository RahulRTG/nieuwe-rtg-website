/* Stand -- Metier, deel 3: laden, de knoppen, Rahul en de aanmelding.
   Laadt als laatste (bestandsnaamvolgorde) en mag dus overal bij. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var M = (w.RTGGeldDeel = w.RTGGeldDeel || {}).metier;
  function val(id) { var el = d.getElementById(id); return el ? el.value : ''; }
  function toon(html) { var el = d.getElementById('mtVak'); if (el) el.innerHTML = html; }
  function tekenTabs() { var el = d.getElementById('mtTabs'); if (el) el.innerHTML = M.tabsKnoppen(); }

  /* De AI-routes weigeren netjes met een niet-2xx en een 'reden'; Geld.api
     gooit dan kaal. Dit haalt de reden terug, zodat het lid leest WAAROM. */
  function reden(e) { return (e && e.data && e.data.reden) || (e && e.message) || 'Geen antwoord.'; }

  async function laad() {
    tekenTabs();
    var Geld = w.Geld;
    try {
      if (M.tab === 'ik') { M.ik = await Geld.api('/api/metier/ik'); toon(M.ikHtml(M.ik)); }
      else if (M.tab === 'naam') toon(M.naamHtml(await Geld.api('/api/metier/naam-log')));
      else if (M.tab === 'register') toon(M.registerHtml(null));
      else if (M.tab === 'loon') {
        toon(M.loonHtml(await Geld.api('/api/metier/loon', { land: M.loonland })));
        var s = d.getElementById('mtLland');
        if (s) s.value = M.loonland;
      } else toon(M.coachHtml());
    } catch (e) {
      toon('<p class="stil">' + Geld.esc(e.message) + ' Log eerst in via de leden-app.</p>');
    }
  }

  async function zoekNu(alleenOpen) {
    try {
      toon(M.registerHtml(await w.Geld.api('/api/metier/zoek',
        { zoek: val('mtZveld'), plaats: val('mtZplaats'), open: !!alleenOpen })));
    } catch (e) { w.Geld.melding(e.message); }
  }

  async function opendLid(codenaam) {
    try { toon(M.lidHtml((await w.Geld.api('/api/metier/lid', { wie: codenaam })).profiel)); }
    catch (e) { w.Geld.melding(e.message); }
  }

  /* Een doe-knop: aanroepen, melden, opnieuw tekenen. Een fout komt als
     melding en het scherm blijft staan. */
  async function doe(pad, body, tekst, herlaad) {
    var Geld = w.Geld;
    try {
      await Geld.api(pad, body);
      if (tekst) Geld.melding(tekst);
      (herlaad || laad)();
    } catch (e) { Geld.melding(e.message); }
  }

  async function ai(pad, body, vak, maak) {
    var el = d.getElementById(vak);
    if (el) { el.hidden = false; el.textContent = 'Rahul denkt na…'; }
    try { maak(await w.Geld.api(pad, body), el); }
    catch (e) { if (el) el.textContent = reden(e); }
  }

  // twee lijsten, een knop: eerst de vaardigheden, dan de talen, dan laden
  async function lijsten() {
    var Geld = w.Geld;
    var v = val('mtFvaardig').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var t = val('mtFtalen').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    try {
      await Geld.api('/api/metier/lijst', { veld: 'vaardigheden', waarden: v });
      await Geld.api('/api/metier/lijst', { veld: 'talen', waarden: t });
      Geld.melding('Bewaard.');
    } catch (e) { Geld.melding(e.message); }
    laad();
  }

  // de loontoets: de uitslag hoort in het vak, ook als het een fout is
  async function toets() {
    var Geld = w.Geld, u = d.getElementById('mtUtoets');
    if (!u) return;
    u.hidden = false;
    try {
      var r = await Geld.api('/api/metier/loon-toets', { vak: val('mtTvak'), land: M.loonland, uurloon: val('mtTuur') });
      u.innerHTML = '<b>&euro; ' + Geld.esc(r.uurloon) + ' per uur' +
        (r.perMaand ? ' · &plusmn; &euro; ' + Geld.esc(r.perMaand) + ' bruto per maand' : '') + '</b><br>' +
        (r.punten || []).map(function (p) { return Geld.esc(p); }).join('<br>');
    } catch (e) { u.textContent = e.message; }
  }

  /* Een keer aan document, want het paneel wordt steeds opnieuw getekend;
     alle haken dragen mt, dus buiten deze stand vangt dit niets. */
  d.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-mtt]');
    if (t) { M.tab = t.getAttribute('data-mtt'); return laad(); }
    var id = ev.target.id || '';
    if (id === 'mtBkaart') return doe('/api/metier/kaart',
      { kop: val('mtFkop'), over: val('mtFover'), plaats: val('mtFplaats') }, 'Je kaart is bewaard.');
    if (id === 'mtBopen') {
      var aan = ev.target.getAttribute('aria-pressed') !== 'true';
      return doe('/api/metier/kaart', { open: aan }, aan ? 'Je staat open voor werk.' : 'Staat weer uit.');
    }
    if (id === 'mtBrol') return doe('/api/metier/rol',
      { wat: val('mtRwat'), waar: val('mtRwaar'), van: val('mtRvan'), tot: val('mtRtot') },
      'Rol toegevoegd, als zelf opgegeven.');
    if (id === 'mtBlijst') return lijsten();
    if (id === 'mtBvrij') return doe('/api/metier/naam-vrij',
      { code: val('mtNzaak'), waarvoor: val('mtNwaarvoor') },
      'Deze zaak kan je naam nu zien. Je kunt dat altijd intrekken.');
    if (id === 'mtBzoek') return zoekNu(false);
    if (id === 'mtBopenwerk') return zoekNu(true);
    if (id === 'mtBterug') { M.tab = 'register'; return laad(); }
    if (id === 'mtBaanbeveel') return doe('/api/metier/beveel-aan',
      { wie: M.bekeken.codenaam, tekst: val('mtAtekst') },
      'Je aanbeveling staat op zijn profiel.', function () { opendLid(M.bekeken.codenaam); });
    if (id === 'mtBkritiek') return ai('/api/metier/ai/profiel', {}, 'mtUkritiek', function (r, el) {
      el.textContent = r.kritiek || 'Geen antwoord.';
    });
    if (id === 'mtBbrief') return ai('/api/metier/ai/brief', { vacature: val('mtCvac') }, 'mtUbrief', function (r, el) {
      el.textContent = r.brief || 'Geen antwoord.';
    });
    if (id === 'mtBoefen') {
      M.oefen.rol = val('mtCrol');
      return ai('/api/metier/ai/oefen', { rol: M.oefen.rol }, 'mtUoefen', function (r, el) {
        el.textContent = r.vraag || 'Geen antwoord.';
        if (r.vraag) { M.oefen.vraag = r.vraag; d.getElementById('mtOefenveld').hidden = false; }
      });
    }
    if (id === 'mtBantw') return ai('/api/metier/ai/oefen',
      { rol: M.oefen.rol, vraag: M.oefen.vraag, antwoord: val('mtCantw') }, 'mtUoefen', function (r, el) {
        el.textContent = (r.feedback || '') + (r.vraag ? '\n\n' + r.vraag : '');
        if (r.vraag) M.oefen.vraag = r.vraag;
        var c = d.getElementById('mtCantw'); if (c) c.value = '';
      });
    if (id === 'mtBtoets') return toets();

    var el;
    if ((el = ev.target.closest('[data-mtrolweg]')))
      return doe('/api/metier/rol-weg', { id: el.getAttribute('data-mtrolweg') }, 'Weg.');
    if ((el = ev.target.closest('[data-mtverberg]')))
      return doe('/api/metier/aanbeveling-verberg',
        { id: el.getAttribute('data-mtverberg'), aan: el.textContent === 'verbergen' }, 'Aangepast.');
    if ((el = ev.target.closest('[data-mtintrek]')))
      return doe('/api/metier/naam-intrekken', { code: el.getAttribute('data-mtintrek') },
        'Ingetrokken. Er lag nergens een kopie, dus er is niets meer te lezen.');
    if ((el = ev.target.closest('[data-mtlid]'))) return opendLid(el.getAttribute('data-mtlid'));
    if ((el = ev.target.closest('[data-mtonder]')))
      return doe('/api/metier/onderschrijf',
        { wie: M.bekeken.codenaam, vaardigheid: el.getAttribute('data-mtonder'),
          aan: el.getAttribute('aria-pressed') !== 'true' },
        '', function () { opendLid(M.bekeken.codenaam); });
    if ((el = ev.target.closest('[data-mtatrek]')))
      return doe('/api/metier/aanbeveling-intrekken',
        { wie: M.bekeken.codenaam, id: el.getAttribute('data-mtatrek') },
        'Ingetrokken.', function () { opendLid(M.bekeken.codenaam); });
  });

  d.addEventListener('change', function (ev) {
    if (ev.target.id === 'mtLland') { M.loonland = ev.target.value; laad(); }
  });

  /* De vaste Rahul-balk onderin het origineel is hier de kaart onder de
     stand: hij voert uit wat je vraagt, daarna tekent het scherm opnieuw. */
  async function chat(ev) {
    ev.preventDefault();
    var Geld = w.Geld, u = d.getElementById('mtAiUit'), t = val('mtAiIn').trim();
    if (!t) return;
    d.getElementById('mtAiIn').value = '';
    u.hidden = false;
    u.textContent = 'Rahul denkt mee…';
    try {
      var r = await Geld.api('/api/chat/send', { text: t });
      u.textContent = r.reply || 'Geen antwoord.';
      laad();
    } catch (e) { u.textContent = e.status ? e.message : 'Rahul is nu niet bereikbaar.'; }
  }

  function start() {
    M.stijl();
    M.tab = 'ik'; M.ik = null; M.bekeken = null; M.register = null; M.loon = null;
    M.oefen = { rol: '', vraag: '' };
    // Meenemen: de bron volgt het scherm waar je staat (metierb.js)
    if (w.RTGUitvoer) w.RTGUitvoer.bron(M.uitvoer);
    d.getElementById('mtAiForm').addEventListener('submit', chat);
    laad();
  }

  /* Geen interval of stream hier, maar de meeneembron blijft anders hangen
     en zou metier-rijen afgeven op een stand die er niet meer staat. */
  function stop() {
    if (w.RTGUitvoer) w.RTGUitvoer.bron(null);
  }

  V.standen.push({
    id: 'metier',
    naam: 'Métier',
    uitleg: 'Je beroepsprofiel op codenaam: werk met RTG-bevestiging, het register, de loonspiegel en Rahul als coach.',
    html:
      '<div class="mt-tabs" id="mtTabs" role="group" aria-label="Onderdelen"></div>' +
      '<div id="mtVak"><p class="stil">Laden…</p></div>' +
      '<div class="kaart"><h2>Vraag Rahul</h2>' +
      '<div class="mt-uit" id="mtAiUit" hidden aria-live="polite"></div>' +
      '<form id="mtAiForm" class="mt-vraag">' +
      '<input id="mtAiIn" placeholder="Zeg wat er moet gebeuren" aria-label="Zeg Rahul wat er moet gebeuren" autocomplete="off">' +
      '<button class="knop hoofd" type="submit">Vraag</button></form></div>',
    start: start,
    stop: stop
  });
})(window, document);
