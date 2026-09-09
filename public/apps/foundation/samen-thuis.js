/* Samen Thuis is een voorzijde op bestaande gezinsfuncties. Hij bewaart geen
   tweede agenda of tweede takenlijst: elke handeling landt in Agenda, Klusjes
   of Gezinsberichten en is daar direct terug te zien. */
(function () {
  'use strict';
  if (!window.Sessie || !Sessie.eisProfiel()) return;
  var sessie = Sessie.huidig(), api = Sessie.api, soort = 'taak', gekozen = lokaleDag(new Date());
  var W = window.RTGSamenThuisWeergave;
  var staat = { vandaag:gekozen, dagen:maakDagen(gekozen), agenda:[], profielen:[], klussen:[], ochtend:{ bord:[] }, keuken:{ dagen:[], lijst:[] }, profiel:{} };
  function lokaleDag(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function plusDag(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return lokaleDag(d); }
  function maakDagen(van) { return Array.from({ length:7 }, function (_, i) { return plusDag(van, i); }); }
  function get(pad) { return fetch(pad, { headers:{ Authorization:'Bearer ' + sessie.token } }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Kon de gezinsinformatie niet ophalen.'); return d; }); }); }
  function gelukt(r) { return r.status === 'fulfilled' ? r.value : {}; }
  function laad() {
    var tot = plusDag(staat.vandaag, 6);
    return Promise.allSettled([
      api('/gezin/agenda/bereik', { code:sessie.code, token:sessie.token, van:staat.vandaag, tot:tot }),
      get('/api/foundation/gezin/' + encodeURIComponent(sessie.code) + '/mij'),
      get('/api/foundation/gezin/' + encodeURIComponent(sessie.code) + '/klussen'),
      get('/api/foundation/gezin/' + encodeURIComponent(sessie.code) + '/ochtend'),
      get('/api/foundation/gezin/' + encodeURIComponent(sessie.code) + '/keuken')
    ]).then(function (r) {
      var agenda = gelukt(r[0]), gezin = gelukt(r[1]), klussen = gelukt(r[2]), ochtend = gelukt(r[3]), keuken = gelukt(r[4]);
      staat.agenda = agenda.items || []; staat.profielen = gezin.profielen || []; staat.profiel = gezin.profiel || {};
      staat.klussen = klussen.klussen || []; staat.ochtend = ochtend; staat.keuken = keuken;
      W.alles(staat, gekozen); bindNaTekenen();
    }).catch(function () { W.alles(staat, gekozen); bindNaTekenen(); });
  }
  function openView(naam) {
    document.querySelectorAll('[data-st-view]').forEach(function (v) { var aan = v.dataset.stView === naam; v.hidden = !aan; v.classList.toggle('is-actief', aan); });
    document.querySelectorAll('[data-st-tab]').forEach(function (b) { var aan = b.dataset.stTab === naam; b.classList.toggle('is-actief', aan); if (aan) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo({ top:0, behavior:'smooth' });
  }
  function bindNaTekenen() {
    document.querySelectorAll('[data-st-dag]').forEach(function (b) { b.onclick = function () { gekozen = b.dataset.stDag; W.dagen(staat, gekozen); W.gezin(staat, gekozen); bindNaTekenen(); }; });
    var leeg = document.querySelector('[data-st-leeg-regel]'); if (leeg) leeg.onclick = function () { openView('regelen'); };
  }
  function kiesSoort(nieuw) {
    soort = nieuw;
    document.querySelectorAll('[data-st-soort]').forEach(function (b) { var aan = b.dataset.stSoort === soort; b.classList.toggle('is-actief', aan); b.setAttribute('aria-checked', String(aan)); });
    var vorm = {
      taak:['Taak verdelen','Zet samen een taak op de dag.','Wat moet er gebeuren?','Bijvoorbeeld boodschappen doen','Zet op onze dag'],
      hulp:['Hulp vragen','Laat het gezin weten wat u nodig heeft.','Waar kunt u hulp bij gebruiken?','Bijvoorbeeld: kan iemand mij ophalen?','Vraag hulp aan gezin'],
      herinnering:['Herinnering maken','Bewaar iets op de gezamenlijke dag.','Waaraan wilt u herinnerd worden?','Bijvoorbeeld bibliotheekboeken terugbrengen','Zet op onze dag']
    }[soort];
    document.getElementById('stVormKicker').textContent = vorm[0]; document.getElementById('stVormTitel').textContent = vorm[1];
    document.getElementById('stWatLabel').textContent = vorm[2]; document.getElementById('stWat').placeholder = vorm[3]; document.getElementById('stBewaar').childNodes[0].nodeValue = vorm[4] + ' ';
    var wanneer = document.getElementById('stWanneerVelden'); wanneer.hidden = soort === 'hulp'; document.getElementById('stDatum').required = soort !== 'hulp';
    document.getElementById('stFout').textContent = ''; document.getElementById('stBevestiging').hidden = true;
  }
  function agendaPunt(wat, wie, datum, tijd, voorvoegsel) {
    return api('/gezin/agenda', { code:sessie.code, token:sessie.token, titel:(voorvoegsel || '') + wat, wie:wie, datum:datum, tijd:tijd, herhaal:'geen' });
  }
  async function bewaar(e) {
    e.preventDefault();
    var wat = document.getElementById('stWat').value.trim(), wie = document.getElementById('stWie').value;
    var datum = document.getElementById('stDatum').value, tijd = document.getElementById('stTijd').value;
    var fout = document.getElementById('stFout'), knop = document.getElementById('stBewaar'), klaar = document.getElementById('stBevestiging');
    fout.textContent = ''; klaar.hidden = true; if (!wat) { fout.textContent = 'Vertel eerst wat er nodig is.'; return; }
    knop.disabled = true;
    try {
      if (soort === 'hulp') {
        await api('/gezin/bericht', { code:sessie.code, token:sessie.token, tekst:wat, naar:wie, soort:'hulp' });
        klaar.textContent = 'Uw hulpvraag staat veilig bij het gezin.';
      } else if (soort === 'herinnering') {
        await agendaPunt(wat, wie, datum, tijd, 'Herinnering: '); klaar.textContent = 'De herinnering staat op de gezamenlijke dag.';
      } else {
        if (!['beheerder','ouder'].includes(staat.profiel.rol)) throw new Error('Een ouder of beheerder verdeelt taken. Kies Hulp vragen om het gezin iets te vragen.');
        await api('/gezin/klus', { code:sessie.code, token:sessie.token, titel:wat, voor:wie || 'iedereen', sterren:1 });
        try { await agendaPunt(wat, wie, datum, tijd, 'Taak: '); klaar.textContent = 'De taak staat bij Klusjes en op de gezamenlijke dag.'; }
        catch (agendaFout) { klaar.textContent = 'De taak staat bij Klusjes. De dagplanning kon niet worden bijgewerkt.'; }
      }
      klaar.hidden = false; document.getElementById('stWat').value = ''; await laad();
    } catch (err) { fout.textContent = err.message || 'Dit kon nu niet worden bewaard.'; }
    finally { knop.disabled = false; }
  }
  document.querySelectorAll('[data-st-tab],[data-st-open]').forEach(function (b) { b.onclick = function () { openView(b.dataset.stTab || b.dataset.stOpen); }; });
  document.querySelectorAll('[data-st-soort]').forEach(function (b) { b.onclick = function () { kiesSoort(b.dataset.stSoort); }; });
  document.getElementById('stBekijkDag').onclick = function () { document.getElementById('stDagBegin').scrollIntoView({ behavior:'smooth' }); };
  document.getElementById('stDatum').value = gekozen; document.getElementById('stVorm').addEventListener('submit', bewaar);
  kiesSoort('taak'); laad();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
