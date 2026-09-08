/* De hoofdingang combineert bestaande zorgbronnen zonder nieuwe medische
   conclusies te trekken. Slaap, beweging, eten, rust en gevoel blijven lokaal. */
(function (w, d) {
  'use strict';
  if (!w.Sessie || !Sessie.eisProfiel()) return;
  var sessie = Sessie.huidig(), W = w.RTGFoundationGezondheidBeeld;
  var profielId = sessie.profiel && (sessie.profiel.id || sessie.profiel.pid) || 'ik';
  var RITME_KEY = 'rtf_gezondheid_ritme_v1_' + sessie.code + '_' + profielId;
  var staat = { gezondheid:null, care:[], ritme:leesRitme() };
  function json(r) { return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok) throw new Error(x.error || 'Deze gegevens zijn nu niet bereikbaar.'); return x; }); }
  function lidToken() { try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function leesRitme() { try { return Object.assign({ slaap:'', beweging:'', eten:'', rust:'', gevoel:'' }, JSON.parse(localStorage.getItem(RITME_KEY) || '{}')); } catch (e) { return { slaap:'', beweging:'', eten:'', rust:'', gevoel:'' }; } }
  function bewaarRitme() { try { localStorage.setItem(RITME_KEY, JSON.stringify(staat.ritme)); } catch (e) {} }
  function gezondheid() {
    return fetch('/api/foundation/gezin/' + encodeURIComponent(sessie.code) + '/gezondheid', { headers:{ Authorization:'Bearer ' + sessie.token } }).then(json);
  }
  function care() {
    var token = lidToken(); if (!token) return Promise.resolve({ boekingen:[] });
    return fetch('/api/care/mijn', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token }, body:'{}' }).then(json);
  }
  function laad() {
    return Promise.allSettled([gezondheid(), care()]).then(function (uit) {
      staat.gezondheid = uit[0].status === 'fulfilled' ? uit[0].value : null;
      staat.care = uit[1].status === 'fulfilled' ? (uit[1].value.boekingen || []) : [];
      W.alles(staat); bindMedicatie(); gevoelStatus(); vulVorm();
    });
  }
  function open(naam) {
    d.querySelectorAll('[data-gw-view]').forEach(function (v) { var aan = v.dataset.gwView === naam; v.hidden = !aan; v.classList.toggle('is-actief', aan); });
    d.querySelectorAll('[data-gw-tab]').forEach(function (b) { var aan = b.dataset.gwTab === naam; b.classList.toggle('is-actief', aan); if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    w.scrollTo({ top:0, behavior:'smooth' });
  }
  function bindMedicatie() {
    d.querySelectorAll('[data-gw-med]').forEach(function (knop) {
      knop.onclick = function () {
        knop.disabled = true;
        Sessie.api('/gezin/gezondheid/medicijn/gegeven', { code:sessie.code, token:sessie.token, voor:staat.gezondheid && staat.gezondheid.mijnId, medId:knop.dataset.gwMed, gegeven:knop.dataset.gwGegeven !== 'true' })
          .then(laad).catch(function (e) { w.alert(e.message); knop.disabled = false; });
      };
    });
  }
  function schoonGetal(v, max, decimalen) {
    if (String(v).trim() === '') return '';
    var n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > max) return null;
    return decimalen ? Math.round(n * 10) / 10 : Math.round(n);
  }
  function vulVorm() {
    d.getElementById('gwSlaap').value = staat.ritme.slaap;
    d.getElementById('gwBeweging').value = staat.ritme.beweging;
    d.getElementById('gwEten').value = staat.ritme.eten;
    d.getElementById('gwRust').value = staat.ritme.rust;
  }
  function bewaar(e) {
    e.preventDefault(); var fout = d.getElementById('gwRitmeFout'); fout.textContent = '';
    var slaap = schoonGetal(d.getElementById('gwSlaap').value, 24, true), beweging = schoonGetal(d.getElementById('gwBeweging').value, 1440, false);
    if (slaap === null) { fout.textContent = 'Gebruik voor slaap een getal van 0 tot 24 uur.'; return; }
    if (beweging === null) { fout.textContent = 'Gebruik voor beweging een getal van 0 tot 1440 minuten.'; return; }
    staat.ritme = Object.assign(staat.ritme, { slaap:slaap, beweging:beweging, eten:d.getElementById('gwEten').value, rust:d.getElementById('gwRust').value.trim().slice(0, 80) });
    bewaarRitme(); W.ritme(staat); W.vandaag(staat); bindMedicatie(); fout.className = 'gw-fout is-gelukt'; fout.textContent = 'Uw ritme is op dit toestel bewaard.';
  }
  function gevoelStatus() {
    var labels = { goed:'Goed', zoso:'Zo zo', lastig:'Lastig' };
    d.querySelectorAll('[data-gw-gevoel]').forEach(function (b) { var aan = b.dataset.gwGevoel === staat.ritme.gevoel; b.classList.toggle('is-actief', aan); b.setAttribute('aria-checked', String(aan)); });
    d.getElementById('gwGevoelStatus').textContent = staat.ritme.gevoel ? labels[staat.ritme.gevoel] + ' is alleen op dit toestel onthouden. U kunt altijd opnieuw kiezen.' : 'Uw keuze blijft alleen op dit toestel.';
  }
  d.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-gw-tab],[data-gw-open]'), gevoel = e.target.closest('[data-gw-gevoel]');
    if (nav) { open(nav.dataset.gwTab || nav.dataset.gwOpen); return; }
    if (gevoel) { staat.ritme.gevoel = gevoel.dataset.gwGevoel; bewaarRitme(); gevoelStatus(); }
  });
  d.getElementById('gwRitmeVorm').addEventListener('submit', bewaar);
  d.getElementById('gwBekijkDag').onclick = function () { d.getElementById('gwDagBegin').scrollIntoView({ behavior:'smooth' }); };
  W.alles(staat); gevoelStatus(); vulVorm(); laad();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function () {});
})(window, document);
