/* Een reiswens blijft een wens totdat de bron een aanvraag teruggeeft.
   Antwoordverlies leidt tot lezen bij de bron, nooit automatisch opnieuw boeken. */
(function (w,d) {
  'use strict';
  w.RTGTravelExperience = function (options) {
    var q = function (id) { return d.getElementById(id); };
    var trip, store, active, busy = false, uncertain = false, received = false, before = [], submitted;
    var ready = false, touched = false;
    function say(text) { q('rStatus').textContent = text; }
    function fields() { return {date:q('rDatum').value,participants:Number(q('rAantal').textContent)}; }
    function sameSession() {
      try { if (w.localStorage.getItem('rtg_member_token') === options.token) return true; } catch(e) {}
      if (store) try { store.clear(); } catch(e) {}
      store = null; active = null;
      say('Uw sessie is gewijzigd. Open deze pagina opnieuw voordat u verdergaat.');
      return false;
    }
    function lock() {
      ['rDatum','rMin','rPlus','rNotitie','travelRemember','travelForget'].forEach(function (id) { q(id).disabled = busy || uncertain || received; });
      q('rBoek').disabled = busy || uncertain || received;
      q('rReview').disabled = busy || uncertain || received;
      q('rCheck').disabled = busy;
      q('bladTerug').disabled = busy;
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
      uncertain = false; received = true; q('rCheck').hidden = true;
      var description = a.status === 'aangevraagd' ? 'Aangevraagd, nog niet bevestigd.' : 'Actuele status: ' + a.status + '.';
      say((matched ? 'Uw aanvraag is teruggevonden. ' : 'Uw aanvraag is ontvangen. ') + description + ' Referentie: ' + a.ref);
      if (a.besluit && a.besluit.bericht) q('rStatus').textContent += ' ' + a.besluit.bericht;
      q('rTrips').hidden = false; finishIntent(); options.refresh(); lock();
    }
    async function check() {
      if (busy || !submitted || !sameSession()) return;
      busy = true; lock(); say('We controleren uw aanvragen bij het reisbureau.');
      try {
        var list = (await options.api('/api/reisbureau/mijn')).aanvragen;
        if (!Array.isArray(list)) throw new Error('Ongeldig antwoord');
        var found = list.filter(function (a) {
          return before.indexOf(a.ref)<0 && a.tripId===submitted.tripId && a.personen===submitted.personen &&
            (a.vertrek||'')===(submitted.vertrek||'') && (a.notitie||'')===submitted.notitie;
        });
        if (found.length===1) result(found[0],true);
        else say('De uitkomst is nog onbekend. Er is geen unieke nieuwe aanvraag teruggevonden. Controleer straks opnieuw of bekijk Mijn aanvragen; we versturen niets opnieuw.');
      } catch(e) { say('De uitkomst is nog onbekend. Controleren lukt nu niet. Uw invoer blijft staan; probeer de controle opnieuw.'); }
      finally { busy = false; lock(); }
    }
    async function book() {
      if (busy || uncertain || received || q('rBoek').hidden || !trip || !sameSession()) return;
      busy = true; lock(); var sent = false;
      submitted = {tripId:trip.id,personen:fields().participants,vertrek:fields().date || undefined,
        notitie:q('rNotitie').value.replace(/[<>]/g,'').trim().slice(0,300)};
      try {
        // De bestaande refs onderscheiden een nieuwe ontvangst van een oudere reis.
        var list = (await options.api('/api/reisbureau/mijn')).aanvragen;
        if (!Array.isArray(list)) throw new Error('Uw aanvragen konden niet worden gecontroleerd.');
        before = list.map(function (a) { return a.ref; });
        var existing = list.find(function (a) { return a.tripId===submitted.tripId && a.status==='aangevraagd'; });
        if (existing) { say('Voor deze reis staat al een aanvraag open ('+existing.ref+'). Bekijk Mijn aanvragen. Uw nieuwe invoer is niet verstuurd.'); options.refresh(); return; }
        say('Uw aanvraag wordt verstuurd. Het reisbureau moet deze nog beoordelen.');
        sent = true;
        var response = await options.api('/api/reisbureau/boek',submitted);
        if (!response.aanvraag || !response.aanvraag.ref) throw new Error('Geen ontvangstbewijs');
        result(response.aanvraag,false);
      } catch(e) {
        if (sent && (!e.status || e.status>=500 || e.status===409)) {
          uncertain = true; q('rCheck').hidden = false;
          say('De uitkomst is onbekend. Controleer eerst of uw aanvraag is ontvangen. We versturen niets opnieuw.');
        } else say((sent?'Aanvraag geweigerd. ':'Niet verstuurd. ') + e.message + ' Uw invoer blijft staan.');
      } finally { busy = false; lock(); }
    }
    q('rReview').addEventListener('click',function () {
      if (!trip || busy || uncertain || received || !sameSession() || !q('rDatum').reportValidity()) return;
      q('rSummary').textContent = trip.titel + ' · ' + (fields().date || 'Datum in overleg') + ' · ' + fields().participants +
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
      if (busy) return false;
      if (uncertain && trip && trip.id!==value.id) { say('Controleer eerst de uitkomst van uw vorige aanvraag.'); return false; }
      if (!uncertain) {
        received = false; q('rStatus').textContent = ''; q('rSummary').textContent = '';
        q('rTrips').hidden = true; q('rCheck').hidden = true; q('rBoek').hidden = true; q('rReview').hidden = false;
      }
      trip = value; q('rDatum').min = new Date().toISOString().slice(0,10); total(); lock();
      if (!ready) q('travelRemember').disabled = true;
      return true;
    }};
  };
}(window,document));
