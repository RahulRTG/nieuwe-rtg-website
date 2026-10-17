/* Een reiswens blijft een wens totdat de bron een aanvraag teruggeeft.
   Antwoordverlies leidt tot lezen bij de bron, nooit automatisch opnieuw boeken. */
(function (w,d) {
  'use strict';
  w.RTGTravelExperience = function (options) {
    var q = function (id) { return d.getElementById(id); };
    var trip, store, active, controller;
    var ready = false, touched = false;
    function state() { return controller ? controller.state() : { busy:false, uncertain:false, received:false }; }
    function say(text) { q('rStatus').textContent = text; }
    function fields() { return {date:q('rDatum').value,participants:Number(q('rAantal').textContent)}; }
    function input() { return Object.assign(fields(), { note:q('rNotitie').value }); }
    function sameSession() {
      try { if (w.localStorage.getItem('rtg_member_token') === options.token) return true; } catch(e) {}
      if (store) try { store.clear(); } catch(e) {}
      store = null; active = null;
      say('Uw sessie is gewijzigd. Open deze pagina opnieuw voordat u verdergaat.');
      return false;
    }
    function lock() {
      var s = state(), dicht = s.busy || s.uncertain || s.received;
      ['rDatum','rMin','rPlus','rNotitie','travelRemember','travelForget'].forEach(function (id) { q(id).disabled = dicht; });
      q('rBoek').disabled = dicht;
      q('rReview').disabled = dicht;
      q('rCheck').disabled = s.busy;
      q('bladTerug').disabled = s.busy;
    }
    function total() {
      var n = fields().participants;
      q('rTotaal').textContent = trip ? 'Richtprijs: € ' + trip.prijs*n + ' voor ' + n + ' reiziger' + (n===1?'':'s') : '';
    }
    function apply(value) {
      q('rDatum').value = value.date || '';
      q('rAantal').textContent = value.participants || 2;
      total();
    }
    function remember() {
      if (!store || !sameSession()) return;
      try {
        if (!q('travelRemember').checked) {
          if (active) store.end(active.id,'REVOKED'); active = null;
          q('travelContext').textContent = 'Er wordt geen reiscontext bewaard.'; return;
        }
        active = active ? store.update(active.id,fields()) : store.begin(fields());
        if (!active) { q('travelRemember').checked = false; q('travelContext').textContent = 'De bewaartijd is voorbij. Kies opnieuw of u wilt bewaren.'; return; }
        q('travelContext').textContent = 'Datum en reizigers: alleen dit tabblad, maximaal twee uur. Uw vrije tekst wordt niet bewaard.';
      } catch(e) { q('travelContext').textContent = 'Bewaren lukt niet. Uw invoer staat nog in het formulier.'; }
    }
    function changed() {
      controller.edit();
      touched = true; q('rBoek').hidden = true; q('rReview').hidden = false; q('rSummary').textContent = '';
      total(); remember();
    }
    function finishIntent() {
      try { if (store && active && sameSession()) store.end(active.id,'FULFILLED'); }
      catch(e) { q('travelContext').textContent = 'Aanvraag ontvangen. Tijdelijke context kon niet worden gewist.'; return; }
      active = null; q('travelRemember').checked = false;
      q('travelContext').textContent = 'De aanvraag is ontvangen. Tijdelijke reiscontext is gewist.';
    }
    function result(a, matched) {
      q('rCheck').hidden = true;
      var description = a.status === 'aangevraagd' ? 'Aangevraagd, nog niet bevestigd.' : 'Actuele status: ' + a.status + '.';
      say((matched ? 'Uw aanvraag is teruggevonden. ' : 'Uw aanvraag is ontvangen. ') + description + ' Referentie: ' + a.ref);
      if (a.besluit && a.besluit.bericht) q('rStatus').textContent += ' ' + a.besluit.bericht;
      q('rTrips').hidden = false; finishIntent(); options.refresh(); lock();
    }
    async function check() {
      var s = state();
      if (s.busy || !s.uncertain) return;
      say('We controleren uw aanvragen bij het reisbureau.');
      var uitkomst = await controller.check();
      if (uitkomst.type === 'received') result(uitkomst.application,true);
      else if (uitkomst.type === 'unmatched') say('De uitkomst is nog onbekend. Er is geen unieke nieuwe aanvraag teruggevonden. Controleer straks opnieuw of bekijk Mijn aanvragen; we versturen niets opnieuw.');
      else if (uitkomst.type === 'check-failed') say('De uitkomst is nog onbekend. Controleren lukt nu niet. Uw invoer blijft staan; probeer de controle opnieuw.');
      lock();
    }
    async function book() {
      var s = state();
      if (s.busy || s.uncertain || s.received || q('rBoek').hidden || !trip) return;
      var uitkomst = await controller.submit(input());
      if (uitkomst.type === 'existing') {
        say('Voor deze reis staat al een aanvraag open ('+uitkomst.application.ref+'). Bekijk Mijn aanvragen. Uw nieuwe invoer is niet verstuurd.');
        options.refresh();
      } else if (uitkomst.type === 'received') result(uitkomst.application,false);
      else if (uitkomst.type === 'uncertain') {
        q('rCheck').hidden = false;
        say('De uitkomst is onbekend. Controleer eerst of uw aanvraag is ontvangen. We versturen niets opnieuw.');
      } else if (uitkomst.type === 'rejected') {
        say((uitkomst.sent?'Aanvraag geweigerd. ':'Niet verstuurd. ') + uitkomst.error.message + ' Uw invoer blijft staan.');
      }
      lock();
    }
    controller = w.RTGTravelRequestController.create({
      api: options.api,
      sameSession: sameSession,
      onChange: function (s, reason) {
        if (reason === 'submitting') say('Uw aanvraag wordt verstuurd. Het reisbureau moet deze nog beoordelen.');
        lock();
      }
    });
    q('rReview').addEventListener('click',function () {
      var s = state();
      if (!trip || s.busy || s.uncertain || s.received || !sameSession() || !q('rDatum').reportValidity()) return;
      var uitkomst = controller.review(input());
      if (!uitkomst.ok) return;
      q('rSummary').textContent = uitkomst.trip.titel + ' · ' + (uitkomst.request.vertrek || 'Datum in overleg') + ' · ' + uitkomst.request.personen +
        ' reizigers. Het RTG-reisbureau ontvangt deze aanvraag en uw eventuele wensen. Er wordt nu niets betaald of definitief geboekt.';
      q('rBoek').hidden = false; q('rReview').hidden = true; q('rBoek').focus();
    });
    q('rBoek').addEventListener('click',book); q('rCheck').addEventListener('click',check);
    q('rMin').addEventListener('click',function () { q('rAantal').textContent = Math.max(1,fields().participants-1); changed(); });
    q('rPlus').addEventListener('click',function () { q('rAantal').textContent = Math.min(20,fields().participants+1); changed(); });
    ['rDatum','rNotitie'].forEach(function (id) { q(id).addEventListener('input',changed); });
    q('travelRemember').addEventListener('change',remember);
    q('travelForget').addEventListener('click',function () {
      try { if (store && active && sameSession()) store.end(active.id,'REVOKED'); } catch(e) { say('Wissen lukt niet. Open een nieuw tabblad voor een nieuwe reiswens.'); return; }
      active = null; q('travelRemember').checked = false; q('rNotitie').value = ''; apply({}); changed();
    });
    q('travelRemember').disabled = true;
    w.RTGIntent.forSession(w,options.token,'travel').then(function (value) {
      store = value;
      if (store && sameSession()) {
        active = store.list().filter(function (r) { return r.status==='ACTIVE'; }).pop();
        if (active && !touched) { apply(active.fields); q('travelRemember').checked = true; q('travelContext').textContent = 'Uw reiswens is hervat. U kunt datum en reizigers aanpassen.'; }
      }
    }).catch(function () { q('travelContext').textContent = 'Bewaren is hier niet beschikbaar. U kunt wel een reis aanvragen.'; })
      .finally(function () { ready = true; lock(); });
    w.addEventListener('storage',function (e) { if (e.key==='rtg_member_token') sameSession(); });
    return {open:function (value) {
      var geopend = controller.open(value);
      if (!geopend.ok) {
        if (geopend.reason === 'uncertain') say('Controleer eerst de uitkomst van uw vorige aanvraag.');
        return false;
      }
      if (!state().uncertain) {
        q('rStatus').textContent = ''; q('rSummary').textContent = '';
        q('rTrips').hidden = true; q('rCheck').hidden = true; q('rBoek').hidden = true; q('rReview').hidden = false;
      }
      trip = value; q('rDatum').min = new Date().toISOString().slice(0,10); total(); lock();
      if (!ready) q('travelRemember').disabled = true;
      return true;
    }};
  };
}(window,document));
