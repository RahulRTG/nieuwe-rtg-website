/* Een expliciete tijdelijke avond; het formulier blijft de invoerbron. */
(function (w,d) {
  'use strict';
  var store, active, readFields, applyFields, session;
  function status(text) { d.querySelector('#intentStatus').textContent = text; }
  function validSession() {
    if (w.localStorage.getItem('rtg_member_token') === session) return true;
    if (store) store.clear(); active = null; store = null;
    status('Uw sessie is gewijzigd. Open de pagina opnieuw.'); return false;
  }
  async function init(token, read, apply) {
    session = token; readFields = read; applyFields = apply;
    try {
      store = await w.RTGIntent.forSession(w,token);
      if (!store || !validSession()) return;
      active = store.list().filter(function (x) { return x.status === 'ACTIVE'; }).pop();
      if (active) { applyFields(active.fields); d.querySelector('#intentRemember').checked = true; status('Uw avond is hervat. U kunt alle gegevens aanpassen.'); }
    } catch (e) { store = null; status('Bewaren is hier niet beschikbaar. U kunt wel reserveren.'); }
  }
  function changed() {
    if (!store || !validSession()) return;
    try {
      if (!d.querySelector('#intentRemember').checked) {
        if (active) store.end(active.id,'REVOKED'); active = null;
        status('Deze context wordt niet meegenomen.'); return;
      }
      if (active) {
        active = store.update(active.id,readFields());
        if (!active) { d.querySelector('#intentRemember').checked = false; status('De bewaartijd is voorbij. Kies opnieuw of u deze avond wilt bewaren.'); return; }
      } else active = store.begin(readFields());
      status('Alleen voor deze avond, in dit tabblad, maximaal twee uur.');
    } catch (e) { status('Uw invoer staat nog in het formulier, maar kon niet worden bewaard.'); }
  }
  function finish() {
    try { if (store && active && validSession()) store.end(active.id,'FULFILLED'); }
    catch (e) { status('Aanvraag ontvangen. Tijdelijke context kon niet worden gewist.'); return; }
    active = null; d.querySelector('#intentRemember').checked = false;
    status('De aanvraag is ontvangen. Tijdelijke context is gewist.');
  }
  d.querySelector('#intentRemember').addEventListener('change',changed);
  d.querySelector('#intentForget').addEventListener('click',function () {
    if (store && active && validSession()) store.end(active.id,'REVOKED');
    active = null; d.querySelector('#intentRemember').checked = false;
    applyFields({}); status('Een nieuwe avond. De vorige context is verwijderd.');
  });
  w.addEventListener('storage',function(e) { if (e.key === 'rtg_member_token') validSession(); });
  w.RTGDinnerIntent = {init:init,changed:changed,finish:finish};
}(window,document));
