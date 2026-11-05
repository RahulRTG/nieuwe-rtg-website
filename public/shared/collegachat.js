/* De collegachat: een direct 1-op-1 bericht tussen collega's van dezelfde
   zaak, in elke werk-app hetzelfde (PDA en zaak-app laden deze module).

   Gebruik (na inloggen):
     CollegaChat.init({ API, T, toast, mij: () => me });
     src.addEventListener('dm', CollegaChat.event);
     CollegaChat.open(staffId, naam);   // opent het gesprek
     CollegaChat.badges();              // vult [data-dmbadge="<id>"] met ongelezen */
(function (w) {
  'use strict';
  var doc = w.document;
  if (doc && doc.documentElement && !doc.documentElement.hasAttribute('data-ds') && !doc.getElementById('rtgDsRuntimeCss')) {
    var link = doc.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    doc.head.appendChild(link);
  }
  let API = null, T = (k, nl) => nl, toast = () => {}, mij = () => null;
  let openMet = null; // { staffId, naam } zolang het paneel open staat
  let focusVoorOpen = null;

  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function tijd(iso){
    const d = new Date(iso);
    return isNaN(d) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function teken(messages){
    const el = document.getElementById('ccLijst');
    if (!el) return;
    const me = mij() || {};
    el.innerHTML = messages.length ? messages.map(m =>
      '<div class="cc-msg' + (m.van === me.staffId ? ' mijn' : '') + '">' + esc(m.text) + '<time>' + tijd(m.at) + '</time></div>'
    ).join('') : '<div class="cc-leeg">' + T('cc.leeg', 'Nog geen berichten. Zeg hallo.') + '</div>';
    el.scrollTop = el.scrollHeight;
  }
  function sluit(){
    const el = document.getElementById('ccPaneel');
    if (el) el.remove();
    openMet = null;
    badges();
    const terug = focusVoorOpen;
    focusVoorOpen = null;
    if (terug && terug.isConnected && typeof terug.focus === 'function') terug.focus();
  }

  async function open(staffId, naam){
    sluit();
    focusVoorOpen = document.activeElement;
    openMet = { staffId: Number(staffId), naam };
    const el = document.createElement('div');
    el.id = 'ccPaneel';
    el.className = 'ds-collegachat';
    el.innerHTML = '<div id="ccKaart" role="dialog" aria-modal="true" aria-label="' + esc(T('cc.gesprek', 'Gesprek met') + ' ' + naam) + '"><div id="ccKop">' + esc(naam) + '<button id="ccDicht" type="button" aria-label="' + T('cc.dicht', 'Sluiten') + '">✕</button></div>' +
      '<div id="ccLijst"></div>' +
      '<div id="ccVoet"><input id="ccInput" aria-label="' + T('cc.ph', 'Bericht aan') + ' ' + esc(naam) + '" placeholder="' + T('cc.ph', 'Bericht aan') + ' ' + esc(naam) + '"><button id="ccStuur" type="button">' + T('cc.stuur', 'Stuur') + '</button></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) sluit(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') sluit(); });
    el.querySelector('#ccDicht').addEventListener('click', sluit);
    el.querySelector('#ccInput').focus();
    const stuur = async () => {
      const inp = el.querySelector('#ccInput');
      const text = (inp.value || '').trim();
      if (!text) return;
      inp.value = '';
      try { teken((await API.call('/staff/dm/send', { staffId: openMet.staffId, text })).messages); }
      catch (e2) { toast(e2.message); }
    };
    el.querySelector('#ccStuur').addEventListener('click', stuur);
    el.querySelector('#ccInput').addEventListener('keydown', e => { if (e.key === 'Enter') stuur(); });
    try { teken((await API.call('/staff/dm/history', { staffId: Number(staffId) })).messages); }
    catch (e3) { toast(e3.message); sluit(); }
  }

  // het binnenkomende bericht: open gesprek ververst, anders een tik en een toast
  async function event(e){
    let d;
    try { d = JSON.parse(e.data || '{}'); } catch (err) { return; }
    if (openMet && d.vanId === openMet.staffId) {
      try { teken((await API.call('/staff/dm/history', { staffId: openMet.staffId })).messages); } catch (e2) {}
      return;
    }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    toast('' + d.van + ': ' + String(d.text || '').slice(0, 70));
    badges();
  }

  // ongelezen-tellers naast de collegaknoppen: [data-dmbadge="<staffId>"]
  async function badges(){
    if (!API || !document.querySelector('[data-dmbadge]')) return;
    try {
      const d = await API.call('/staff/dm/lijst', {});
      for (const c of d.collegas || []) {
        document.querySelectorAll('[data-dmbadge="' + c.id + '"]').forEach(el => {
          el.textContent = c.ongelezen ? String(c.ongelezen) : '';
          el.hidden = !c.ongelezen;
        });
      }
    } catch (e) {}
  }

  function init(opts){
    API = opts.API;
    if (opts.T) T = opts.T;
    if (opts.toast) toast = opts.toast;
    if (opts.mij) mij = opts.mij;
  }

  w.CollegaChat = { init, open, event, badges };
})(window);
