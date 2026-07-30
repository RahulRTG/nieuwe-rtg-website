/* De collegachat: een direct 1-op-1 bericht tussen collega's van dezelfde
   zaak, in elke werk-app hetzelfde (PDA en zaak-app laden deze module).

   Gebruik (na inloggen):
     CollegaChat.init({ API, T, toast, mij: () => me });
     src.addEventListener('dm', CollegaChat.event);
     CollegaChat.open(staffId, naam);   // opent het gesprek
     CollegaChat.badges();              // vult [data-dmbadge="<id>"] met ongelezen */
(function (w) {
  'use strict';
  let API = null, T = (k, nl) => nl, toast = () => {}, mij = () => null;
  let openMet = null; // { staffId, naam } zolang het paneel open staat

  function esc(x){ return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function stijl(){
    if (document.getElementById('ccStijl')) return;
    const s = document.createElement('style');
    s.id = 'ccStijl';
    s.textContent = '#ccPaneel{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;}' +
      '#ccKaart{background:#151312;border:1px solid rgba(255,255,255,0.12);border-radius:20px 20px 0 0;width:100%;max-width:560px;height:min(70vh,560px);display:flex;flex-direction:column;color:#F4F1EC;font-family:Inter,sans-serif;}' +
      '#ccKop{display:flex;align-items:center;gap:0.6rem;padding:0.9rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:600;font-size:0.9rem;}' +
      '#ccKop button{margin-left:auto;background:none;border:none;color:#F4F1EC;font-size:1.2rem;cursor:pointer;padding:0.2rem 0.5rem;}' +
      '#ccLijst{flex:1;overflow-y:auto;padding:0.8rem 1rem;display:flex;flex-direction:column;gap:0.45rem;}' +
      '.cc-msg{max-width:82%;padding:0.5rem 0.8rem;border-radius:14px;font-size:0.84rem;line-height:1.45;background:#221E1C;align-self:flex-start;}' +
      '.cc-msg.mijn{background:#2E2A3F;align-self:flex-end;}' +
      '.cc-msg time{display:block;font-size:0.62rem;opacity:0.55;margin-top:0.2rem;}' +
      '#ccVoet{display:flex;gap:0.5rem;padding:0.7rem 1rem;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 0.7rem);border-top:1px solid rgba(255,255,255,0.08);}' +
      '#ccVoet input{flex:1;background:#221E1C;border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:0.6rem 1rem;color:#F4F1EC;font-size:0.85rem;outline:none;}' +
      '#ccVoet button{background:#B99A5F;border:none;border-radius:999px;padding:0.6rem 1.1rem;font:600 0.82rem Inter,sans-serif;color:#141210;cursor:pointer;}';
    document.head.appendChild(s);
  }
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
    ).join('') : '<div style="font-size:0.8rem;opacity:0.6;text-align:center;margin-top:1rem;">' + T('cc.leeg', 'Nog geen berichten. Zeg hallo.') + '</div>';
    el.scrollTop = el.scrollHeight;
  }
  function sluit(){
    const el = document.getElementById('ccPaneel');
    if (el) el.remove();
    openMet = null;
    badges();
  }

  async function open(staffId, naam){
    stijl();
    sluit();
    openMet = { staffId: Number(staffId), naam };
    const el = document.createElement('div');
    el.id = 'ccPaneel';
    el.innerHTML = '<div id="ccKaart"><div id="ccKop">' + esc(naam) + '<button id="ccDicht" aria-label="' + T('cc.dicht', 'Sluiten') + '">✕</button></div>' +
      '<div id="ccLijst"></div>' +
      '<div id="ccVoet"><input id="ccInput" placeholder="' + T('cc.ph', 'Bericht aan') + ' ' + esc(naam) + '"><button id="ccStuur">' + T('cc.stuur', 'Stuur') + '</button></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) sluit(); });
    el.querySelector('#ccDicht').addEventListener('click', sluit);
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
          el.style.display = c.ongelezen ? '' : 'none';
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
