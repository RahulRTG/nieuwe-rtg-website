/* De presentatieneutrale kern van een TravelOS-reisaanvraag.

   De controller bezit geen DOM, router, opslag of autorisatie. Hij bewaakt
   uitsluitend de bestaande volgorde rond controleren, expliciet versturen en
   antwoordverlies. De API en de actuele sessie worden door de host geleverd;
   de server blijft de bron van waarheid. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGTravelRequestController = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function schoonNotitie(value) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').trim().slice(0, 300);
  }

  function aanvraagVoor(reis, invoer) {
    invoer = invoer || {};
    if (!reis || !reis.id) return null;
    return {
      tripId: reis.id,
      personen: Number(invoer.participants),
      vertrek: invoer.date || undefined,
      notitie: schoonNotitie(invoer.note)
    };
  }

  function nieuweMatches(lijst, eerder, aanvraag) {
    if (!Array.isArray(lijst) || !aanvraag) return [];
    eerder = Array.isArray(eerder) ? eerder : [];
    return lijst.filter(function (a) {
      return eerder.indexOf(a.ref) < 0 && a.tripId === aanvraag.tripId &&
        a.personen === aanvraag.personen &&
        (a.vertrek || '') === (aanvraag.vertrek || '') &&
        (a.notitie || '') === aanvraag.notitie;
    });
  }

  function maak(opties) {
    opties = opties || {};
    if (typeof opties.api !== 'function') throw new TypeError('Travel request-controller vereist een API-functie.');
    var sessieActueel = typeof opties.sameSession === 'function' ? opties.sameSession : function () { return true; };
    var verander = typeof opties.onChange === 'function' ? opties.onChange : function () {};
    var reis = null, fase = 'idle', bezig = false, eerder = [], verstuurd = null;

    function stand() {
      return Object.freeze({
        phase: fase,
        busy: bezig,
        uncertain: fase === 'uncertain',
        received: fase === 'received',
        trip: reis,
        submitted: verstuurd && Object.freeze(Object.assign({}, verstuurd))
      });
    }

    function meld(reden) { verander(stand(), reden); }
    function geldig() { return sessieActueel() !== false; }

    function open(value) {
      if (bezig) return { ok: false, reason: 'busy' };
      if (!value || !value.id) return { ok: false, reason: 'trip' };
      if (fase === 'uncertain' && reis && reis.id !== value.id) return { ok: false, reason: 'uncertain' };
      reis = value;
      if (fase !== 'uncertain') {
        fase = 'editing';
        eerder = [];
        verstuurd = null;
      }
      meld('open');
      return { ok: true, trip: reis };
    }

    function edit() {
      if (bezig || fase === 'uncertain' || fase === 'received' || !reis) return false;
      fase = 'editing';
      meld('edit');
      return true;
    }

    function review(invoer) {
      if (bezig || fase === 'uncertain' || fase === 'received' || !reis) return { ok: false, reason: 'state' };
      if (!geldig()) return { ok: false, reason: 'session' };
      var aanvraag = aanvraagVoor(reis, invoer);
      fase = 'review';
      meld('review');
      return { ok: true, type: 'review', trip: reis, request: aanvraag };
    }

    async function submit(invoer) {
      if (bezig || fase !== 'review' || !reis) return { ok: false, type: 'ignored', reason: 'state' };
      if (!geldig()) return { ok: false, type: 'ignored', reason: 'session' };
      bezig = true;
      verstuurd = aanvraagVoor(reis, invoer);
      meld('checking-existing');
      var verzonden = false;
      try {
        var antwoord = await opties.api('/api/reisbureau/mijn');
        var lijst = antwoord && antwoord.aanvragen;
        if (!Array.isArray(lijst)) throw new Error('Uw aanvragen konden niet worden gecontroleerd.');
        eerder = lijst.map(function (a) { return a.ref; });
        var bestaand = lijst.find(function (a) { return a.tripId === verstuurd.tripId && a.status === 'aangevraagd'; });
        if (bestaand) {
          fase = 'review';
          return { ok: false, type: 'existing', application: bestaand };
        }
        meld('submitting');
        verzonden = true;
        antwoord = await opties.api('/api/reisbureau/boek', verstuurd);
        if (!antwoord || !antwoord.aanvraag || !antwoord.aanvraag.ref) throw new Error('Geen ontvangstbewijs');
        fase = 'received';
        meld('received');
        return { ok: true, type: 'received', application: antwoord.aanvraag, matched: false };
      } catch (e) {
        if (verzonden && (!e.status || e.status >= 500 || e.status === 409)) {
          fase = 'uncertain';
          meld('uncertain');
          return { ok: false, type: 'uncertain', error: e };
        }
        fase = 'review';
        meld('rejected');
        return { ok: false, type: 'rejected', sent: verzonden, error: e };
      } finally {
        bezig = false;
        meld('settled');
      }
    }

    async function check() {
      if (bezig || fase !== 'uncertain' || !verstuurd) return { ok: false, type: 'ignored', reason: 'state' };
      if (!geldig()) return { ok: false, type: 'ignored', reason: 'session' };
      bezig = true;
      meld('checking-source');
      try {
        var antwoord = await opties.api('/api/reisbureau/mijn');
        var lijst = antwoord && antwoord.aanvragen;
        if (!Array.isArray(lijst)) throw new Error('Ongeldig antwoord');
        var gevonden = nieuweMatches(lijst, eerder, verstuurd);
        if (gevonden.length === 1) {
          fase = 'received';
          meld('received');
          return { ok: true, type: 'received', application: gevonden[0], matched: true };
        }
        return { ok: false, type: 'unmatched' };
      } catch (e) {
        return { ok: false, type: 'check-failed', error: e };
      } finally {
        bezig = false;
        meld('settled');
      }
    }

    return Object.freeze({ state: stand, open: open, edit: edit, review: review, submit: submit, check: check });
  }

  return Object.freeze({ create: maak, requestFor: aanvraagVoor, matches: nieuweMatches, sanitizeNote: schoonNotitie });
}));
