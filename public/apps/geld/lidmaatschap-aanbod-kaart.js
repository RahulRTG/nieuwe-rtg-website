/* Een expliciete klantactie op de BESTAANDE Stripe PaymentIntent. Geen eigen
   charge, bedrag, betaalstatus of opslag van clientSecret. De server controleert
   na afloop opnieuw; een browserantwoord verleent nooit abonnementsrechten. */
(function (w, d) {
  'use strict';
  var geladen = null, sluit = null;
  function stripeLaden() {
    if (typeof w.Stripe === 'function') return Promise.resolve(w.Stripe);
    if (geladen) return geladen;
    geladen = new Promise(function (resolve, reject) {
      var script = d.createElement('script'), klaar = false;
      function afronden(fout) {
        if (klaar) return; klaar = true; w.clearTimeout(timer);
        if (fout) { geladen = null; script.remove(); reject(Error('De beveiligde kaartcontrole kon niet laden. Er is geen nieuwe betaalopdracht gemaakt.')); }
        else resolve(w.Stripe);
      }
      var timer = w.setTimeout(function () { afronden(true); }, 15000);
      script.src = 'https://js.stripe.com/v3/'; script.async = true;
      script.onload = function () { afronden(typeof w.Stripe !== 'function'); };
      script.onerror = function () { afronden(true); };
      d.head.appendChild(script);
    });
    return geladen;
  }
  async function bevestig(vak, contractId, a) {
    if (!a || a.soort !== 'stripe-bevestigen' || !/^pk_(test|live)_/.test(a.publicKey || '') ||
        !/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/.test(a.clientSecret || '') ||
        typeof a.nieuweBetaalmethode !== 'boolean' ||
        (!a.nieuweBetaalmethode && !/^pm_[A-Za-z0-9]+$/.test(a.paymentMethodId || '')))
      throw Error('De beveiligde kaartcontrole is niet volledig bevestigd. Vraag RTG om controle.');
    var Stripe = await stripeLaden();
    if (!vak || !vak.isConnected) return false;
    if (sluit) sluit(false);
    var stripe = Stripe(a.publicKey), kaart = null, blok = d.createElement('section');
    blok.className = 'kaart'; blok.setAttribute('aria-label', 'Beveiligde kaartcontrole');
    blok.innerHTML = '<h3>Beveiligde kaartcontrole</h3><p>Overeenkomst ' + w.Geld.esc(contractId) +
      '. Dit herstelt dezelfde betalingsopdracht; er wordt geen tweede betaling gestart.</p>' +
      (a.nieuweBetaalmethode ? '<p>Voer een vervangende betaalkaart in via Stripe. Dit scherm ondersteunt alleen kaarten.</p>' +
        '<div data-abo-kaartveld></div><p><label><input type="checkbox" data-abo-kaartakkoord> Ik geef toestemming deze nieuwe kaart te gebruiken voor deze betaling en de toekomstige termijnen van mijn getekende abonnement.</label></p>' :
        '<p>Bevestig de betaling met uw eerder opgeslagen kaart. Uw bank kan om aanvullende controle vragen.</p>') +
      '<p data-abo-kaartmelding role="status" aria-live="polite"></p><p><button class="knop hoofd" type="button" data-abo-kaartbevestig>Kaartcontrole bevestigen</button> ' +
      '<button class="knop" type="button" data-abo-kaartstop>Nu sluiten</button></p>';
    vak.appendChild(blok);
    try {
      if (a.nieuweBetaalmethode) { kaart = stripe.elements().create('card'); kaart.mount(blok.querySelector('[data-abo-kaartveld]')); }
    } catch (_) { blok.remove(); if (kaart) kaart.destroy(); throw Error('Het beveiligde kaartveld is niet beschikbaar.'); }
    return new Promise(function (resolve) {
      var bezig = false, klaar = false;
      function einde(uit) {
        if (klaar) return; klaar = true;
        if (kaart) kaart.destroy(); blok.remove();
        if (sluit === einde) sluit = null;
        resolve(uit);
      }
      sluit = einde;
      blok.querySelector('[data-abo-kaartstop]').addEventListener('click', function () { if (!bezig) einde(false); });
      blok.querySelector('[data-abo-kaartbevestig]').addEventListener('click', async function () {
        if (bezig || klaar) return;
        var melding = blok.querySelector('[data-abo-kaartmelding]');
        if (a.nieuweBetaalmethode && !blok.querySelector('[data-abo-kaartakkoord]').checked) {
          melding.textContent = 'Geef eerst afzonderlijk toestemming voor de nieuwe kaart en toekomstige termijnen.'; return;
        }
        bezig = true; blok.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        try {
          var invoer = a.nieuweBetaalmethode ? { payment_method: { card: kaart }, setup_future_usage: 'off_session' } : { payment_method: a.paymentMethodId };
          var r = await stripe.confirmCardPayment(a.clientSecret, invoer);
          if (klaar) return;
          if (r.error) {
            melding.textContent = 'De kaartcontrole is niet afgerond. Controleer uw kaart of bank en probeer dezelfde opdracht opnieuw.';
          } else { einde(true); return; }
        } catch (_) { if (!klaar) melding.textContent = 'Het antwoord is onzeker. Sluit dit scherm en controleer de bestaande betaalstand; begin geen nieuwe opdracht.'; }
        finally {
          bezig = false;
          if (!klaar) blok.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
        }
      });
      blok.querySelector(a.nieuweBetaalmethode ? '[data-abo-kaartakkoord]' : '[data-abo-kaartbevestig]').focus();
    });
  }
  w.RTGGeldAbonnementKaart = { bevestig: bevestig, stop: function () { if (sluit) sluit(false); } };
})(window, document);
