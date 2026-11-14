/* De nieuwe bediening blijft opt-in. Een onzeker antwoord behoudt dezelfde
   UUID en inhoud; een verversing vraagt alleen de stand en int nooit geld. */
(function (w, d) {
  'use strict';
  var generatie = 0, BASIS = '/api/mijn/abonnement/automatisch/';
  var beeld = w.RTGGeldAbonnementBeeld;
  function start(vak) {
    var eigen = ++generatie, bezig = false, contracten = {}, opslagSleutel = null, opdracht = null, stopIntake = null;
    function levend() { return eigen === generatie && vak && vak.isConnected; }
    function meld(tekst) {
      if (!levend()) return;
      var el = vak.querySelector('#lmAutoMelding');
      if (el) el.textContent = tekst;
    }
    function knoppen(uit) { if (levend()) vak.querySelectorAll('button').forEach(function (b) { b.disabled = uit; }); }
    async function sleutel() {
      if (opslagSleutel) return opslagSleutel;
      if (!w.crypto || !w.crypto.subtle || !w.crypto.randomUUID) throw Error('Deze browser kan geen veilige opdrachtsleutel bewaren.');
      var digest = await w.crypto.subtle.digest('SHA-256', new TextEncoder().encode(w.Geld.token() || ''));
      opslagSleutel = 'rtg-abonnement-opdracht-v1-' + Array.from(new Uint8Array(digest)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
      return opslagSleutel;
    }
    async function herstelOpdracht() {
      var key = await sleutel(), raw = w.sessionStorage.getItem(key);
      if (raw) {
        var r = JSON.parse(raw);
        if (!r || typeof r.idempotencyKey !== 'string' || !['maand', 'jaar'].includes(r.frequentie))
          throw Error('De bewaarde opdracht is onleesbaar. Vraag RTG om controle vóór een nieuwe poging.');
        opdracht = r;
      }
    }
    function vulOpdracht() {
      if (!opdracht || !levend()) return;
      vak.querySelector('#lmAanbodPas').value = opdracht.pas;
      vak.querySelector('#lmAanbodFrequentie').value = opdracht.frequentie;
      vak.querySelector('#lmAanbodAanvraag').value = opdracht.aanmeldingId || '';
    }
    async function laad() {
      var r = await w.Geld.api(BASIS + 'stand');
      if (!levend()) return;
      if (!r.beschikbaar) { if (stopIntake) stopIntake(); stopIntake = null; vak.innerHTML = ''; return; }
      if (!vak.querySelector('#lmAutoContracten')) {
        vak.innerHTML = beeld.formulier(r.intake);
        if (w.RTGGeldAbonnementIntake) stopIntake = w.RTGGeldAbonnementIntake.start(vak,
          { sleutel: sleutel, levend: levend, meld: meld, ontvangen: function (id, nieuw) {
            if (!levend() || opdracht) return;
            vak.querySelector('#lmAanbodPas').value = 'business-lite';
            vak.querySelector('#lmAanbodAanvraag').value = id;
            if (nieuw) meld('Uw bedrijfsaanvraag is ontvangen. Kies nu Persoonlijk aanbod lezen; er is nog niets getekend of betaald.');
          } });
      }
      contracten = {};
      var rijen = r.contracten || [];
      rijen.forEach(function (c) { contracten[c.id] = c; });
      vak.querySelector('#lmAutoContracten').innerHTML = rijen.map(beeld.contract).join('');
      vulOpdracht();
    }
    async function vraag(form) {
      var inhoud = { pas: form.elements.pas.value, frequentie: form.elements.frequentie.value };
      var aanvraag = form.elements.aanmeldingId.value.trim();
      if (aanvraag) inhoud.aanmeldingId = aanvraag;
      if (inhoud.pas !== 'rtg' && !aanvraag) throw Error('Deze pas vereist de referentie van uw eigen aanvraag. Een paskeuze is geen toelating.');
      if (!opslagSleutel) await herstelOpdracht();
      if (opdracht && (opdracht.pas !== inhoud.pas || opdracht.frequentie !== inhoud.frequentie ||
          (opdracht.aanmeldingId || '') !== (inhoud.aanmeldingId || '')))
        throw Error('Er staat nog een onzekere opdracht. Herhaal de oorspronkelijke keuze met dezelfde sleutel of laat RTG die controleren.');
      if (!opdracht) opdracht = Object.assign({}, inhoud, { idempotencyKey: w.crypto.randomUUID() });
      // Eerst bewaren, dan versturen. Bij een gesloten opslagdeur geen opdracht.
      w.sessionStorage.setItem(opslagSleutel, JSON.stringify(opdracht));
      await w.Geld.api(BASIS + 'aanbod', opdracht);
      w.sessionStorage.removeItem(opslagSleutel); opdracht = null;
      await laad(); meld('Het persoonlijke aanbod staat klaar. Lees het voordat u tekent.');
    }
    async function teken(form) {
      var c = contracten[form.dataset.aboTeken];
      if (!c) throw Error('Haal eerst het eigen aanbod opnieuw op.');
      await w.Geld.api(BASIS + 'teken', { contractId: c.id, aanbodHash: c.aanbod.hash,
        naam: form.elements.naam.value, akkoord: form.elements.akkoord.checked,
        doorlopendeBetalingAkkoord: form.elements.mandaat.checked });
      await laad(); meld('De ondertekening is vastgelegd. Dit is nog geen betaalbevestiging of pasactivatie.');
    }
    async function doe(werk) {
      if (bezig) return;
      bezig = true; knoppen(true);
      try { await werk(); }
      catch (e) { meld(e.message || 'De opdracht is niet bevestigd. Herhaal met dezelfde gegevens.'); }
      finally { bezig = false; knoppen(false); }
    }
    function submit(e) {
      var form = e.target;
      if (form.id !== 'lmAanbodVraag' && !form.dataset.aboTeken) return;
      e.preventDefault();
      doe(function () { return form.id === 'lmAanbodVraag' ? vraag(form) : teken(form); });
    }
    function klik(e) {
      var b = e.target.closest('button[data-abo-actie]');
      if (!b || !vak.contains(b)) return;
      doe(async function () {
        var actie = b.dataset.aboActie;
        if (actie !== 'ververs') {
          var c = contracten[b.dataset.aboId];
          if (!c || !['betalen', 'herstel', 'intrekken', 'opzeggen'].includes(actie)) throw Error('Haal eerst de eigen overeenkomst opnieuw op.');
          if (actie === 'opzeggen') {
            var v = await w.Geld.api('/api/mijn/abonnement/opzegvoorbeeld', { contractId: c.id });
            if (v.contractId !== c.id || !v.opzegVersie) throw Error('De afspraak is gewijzigd. Haal de stand opnieuw op.');
            if (!v.alOpgezegd && w.confirm('Deze overeenkomst loopt na opzegging tot ' + v.eindigtOpTekst +
                '. De contractuele termijnen tot die datum blijven verschuldigd. Facturen, bewijsstukken en uw gratis account blijven beschikbaar. Deze overeenkomst opzeggen?'))
              await w.Geld.api('/api/mijn/abonnement/opzeggen', { contractId: c.id, opzegVersie: v.opzegVersie });
            await laad(); return;
          }
          if (actie === 'intrekken' && !w.confirm('Dit trekt alleen het nieuwe voorstel in. Uw bestaande lopende overeenkomst blijft ongewijzigd. Doorgaan?')) return;
          var r = await w.Geld.api(BASIS + actie, Object.assign({ contractId: c.id }, actie === 'intrekken' ? { aanbodHash: c.aanbod.hash } : {}));
          if (r.klantactie) {
            if (!w.RTGGeldAbonnementKaart) throw Error('De beveiligde kaartcontrole is niet beschikbaar.');
            var afgerond = await w.RTGGeldAbonnementKaart.bevestig(vak, c.id, r.klantactie);
            if (!levend()) return;
            if (afgerond) await w.Geld.api(BASIS + 'herstel', { contractId: c.id });
          }
        }
        await laad(); meld('De actuele stand is opgehaald. Alleen de bevestigde contractstand bepaalt de toegang.');
      });
    }
    if (!vak) return;
    vak.addEventListener('submit', submit); vak.addEventListener('click', klik);
    laad().then(function () {
      if (levend() && vak.querySelector('#lmAanbodVraag'))
        return herstelOpdracht().then(vulOpdracht).catch(function (e) { meld(e.message); });
    }).catch(function (e) {
      if (levend()) vak.innerHTML = '<p>' + w.Geld.esc(e.message || 'De aanbodbediening kon niet laden.') + '</p>';
    });
    return function () {
      if (eigen === generatie) generatie++;
      if (stopIntake) stopIntake();
      if (w.RTGGeldAbonnementKaart) w.RTGGeldAbonnementKaart.stop();
      vak.removeEventListener('submit', submit); vak.removeEventListener('click', klik);
    };
  }
  w.RTGGeldAbonnement = { start: start };
})(window, document);
