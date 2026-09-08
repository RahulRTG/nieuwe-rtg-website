/* Meedoen & Ontdekken gebruikt alleen de poster-veilige publieke RTF-bron.
   Belangstelling blijft lokaal: deze bron heeft bewust geen deelnemersdeur. */
(function (w, d) {
  'use strict';
  if (!w.Sessie || !Sessie.eisProfiel()) return;
  var W = w.RTGMeedoenWeergave, vandaag = new Date(), sleutel = 'rtf-meedoen-interesse-v1';
  var staat = { steden:[], stadId:'', stadData:null, campagnes:[], filter:'week', gefilterd:[], interesses:leesInteresses(), gekozen:null };
  function leesInteresses() { try { var x = JSON.parse(localStorage.getItem(sleutel) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
  function bewaarInteresses() { try { localStorage.setItem(sleutel, JSON.stringify(staat.interesses.slice(-50))); } catch (e) {} }
  function api(pad, body) {
    return fetch('/api/rtfos/publiek/' + pad, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok || x.ok === false) throw new Error(x.error || 'Het buurtaanbod is nu niet bereikbaar.'); return x; }); });
  }
  function dag(v) { var x = new Date(v + 'T12:00:00'); return isNaN(x.getTime()) ? null : x; }
  function zelfdeDag(a, b) { return a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function filter() {
    var einde = new Date(vandaag); einde.setDate(einde.getDate() + 7);
    staat.gefilterd = (staat.stadData && staat.stadData.activiteiten || []).filter(function (a) {
      var dte = dag(a.wanneer);
      if (staat.filter === 'vandaag') return zelfdeDag(dte, vandaag);
      if (staat.filter === 'nu') {
        if (!zelfdeDag(dte, vandaag)) return false;
        if (!a.tijd) return true;
        var m = /^(\d{1,2}):(\d{2})/.exec(a.tijd);
        return !m || Number(m[1]) * 60 + Number(m[2]) >= vandaag.getHours() * 60 + vandaag.getMinutes();
      }
      return dte && dte >= new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate()) && dte <= einde;
    });
    W.alles(staat);
  }
  function open(naam) {
    d.querySelectorAll('[data-mo-view]').forEach(function (v) { var aan = v.dataset.moView === naam; v.hidden = !aan; v.classList.toggle('is-actief', aan); });
    d.querySelectorAll('[data-mo-tab]').forEach(function (b) { var aan = b.dataset.moTab === naam || (naam === 'detail' && b.dataset.moTab === 'buurt'); b.classList.toggle('is-actief', aan); if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    w.scrollTo({ top:0, behavior:'smooth' });
  }
  function laadStad(id) {
    staat.stadId = id; try { localStorage.setItem('rtf-meedoen-stad-v1', id); } catch (e) {}
    var dlg = d.getElementById('moStadDialoog'); if (dlg.open) dlg.close();
    return api('stad', { id:id }).then(function (r) { staat.stadData = r; filter(); }).catch(function (e) { staat.stadData = { activiteiten:[], projecten:[], meedoen:{} }; filter(); melding(e.message); });
  }
  function kiesStad() {
    var dlg = d.getElementById('moStadDialoog');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function vindActiviteit(s) { return (staat.stadData && staat.stadData.activiteiten || []).find(function (a) { return W.key(a) === s; }); }
  function toonDetail(a) { if (!a) return; staat.gekozen = a; W.detail(a, staat); open('detail'); }
  function interesse() {
    var a = staat.gekozen;
    if (!a || a.vol) return;
    var k = W.key(a), i = staat.interesses.indexOf(k);
    if (i < 0) staat.interesses.push(k); else staat.interesses.splice(i, 1);
    bewaarInteresses(); W.detail(a, staat); W.alles(staat);
  }
  function vraag() {
    var a = staat.gekozen || {}, dlg = d.getElementById('moDialoog'), bron = staat.stadData && staat.stadData.meedoen;
    d.getElementById('moVraagTekst').textContent = bron && bron.hulp ? bron.hulp : 'Vraag bij het buurthuis naar deze activiteit. Er wordt vanuit dit scherm niets verstuurd.';
    d.getElementById('moVraagGegevens').textContent = [a.naam, a.wanneer, a.tijd, a.locatie].filter(Boolean).join(' · ');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function melding(tekst) { var x = d.getElementById('moActiviteiten'); x.innerHTML = '<div class="mo-leeg"><b>Dat lukte niet.</b><span>' + W.esc(tekst) + '</span></div>'; }
  d.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-mo-tab],[data-mo-open]'), stad = e.target.closest('[data-mo-stad]'), fil = e.target.closest('[data-mo-filter]'), act = e.target.closest('[data-mo-activiteit]');
    if (nav) { open(nav.dataset.moTab || nav.dataset.moOpen); return; }
    if (stad) { laadStad(stad.dataset.moStad); return; }
    if (e.target.closest('[data-mo-kies-stad]')) { kiesStad(); return; }
    if (fil) { staat.filter = fil.dataset.moFilter; d.querySelectorAll('[data-mo-filter]').forEach(function (b) { b.classList.toggle('is-actief', b === fil); }); filter(); return; }
    if (act) { toonDetail(vindActiviteit(act.dataset.moActiviteit)); return; }
    if (e.target.closest('#moInteresse')) { interesse(); return; }
    if (e.target.closest('[data-mo-vraag]')) vraag();
  });
  Promise.allSettled([api('steden'), api('campagnes')]).then(function (uit) {
    if (uit[0].status === 'fulfilled') staat.steden = uit[0].value.steden || [];
    if (uit[1].status === 'fulfilled') staat.campagnes = uit[1].value.campagnes || [];
    var bewaard = ''; try { bewaard = localStorage.getItem('rtf-meedoen-stad-v1') || ''; } catch (e) {}
    var geldig = staat.steden.some(function (s) { return s.id === bewaard; });
    W.alles(staat);
    if (geldig) laadStad(bewaard);
  });
  W.alles(staat);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function () {});
})(window, document);
