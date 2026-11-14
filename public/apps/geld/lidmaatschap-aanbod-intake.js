/* Lite gebruikt de bestaande aanvraagdeur, inclusief haar UUID-ontvangst.
   Dit formulier maakt geen zaak, contract, betaling of menselijke goedkeuring. */
(function (w) {
  'use strict';
  function html(types) {
    var esc = w.Geld.esc;
    if (!Array.isArray(types) || !types.length) return '';
    return '<details class="kaart h-mt60"><summary>Nieuwe bedrijfsaanvraag voor Business Lite</summary>' +
      '<form id="lmLiteIntake"><p>De aanvraag hoort bij uw ingelogde account. Verplichte beroeps- en bedrijfsbewijzen blijven gelden. ' +
      'Na ontvangst leest en tekent u eerst het persoonlijke aanbod; deze aanvraag is geen betaling of toegang.</p>' +
      '<p><label for="lmLiteNaam">Uw volledige naam</label> <input id="lmLiteNaam" name="naam" autocomplete="name" required minlength="2" maxlength="80"></p>' +
      '<p><label for="lmLiteContact">Uw e-mailadres</label> <input id="lmLiteContact" name="contact" type="email" autocomplete="email" required maxlength="120"></p>' +
      '<p><label for="lmLiteBedrijf">Bedrijfsnaam</label> <input id="lmLiteBedrijf" name="bedrijf" required maxlength="60"></p>' +
      '<p><label for="lmLiteType">Branche</label> <select id="lmLiteType" name="type" required><option value="">Kies de branche</option>' +
      types.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>'; }).join('') + '</select></p>' +
      '<p><label for="lmLitePlaats">Vestigingsplaats</label> <input id="lmLitePlaats" name="plaats" required maxlength="60"></p>' +
      '<p><label for="lmLiteBehoefte">Wat heeft de zaak nodig? (optioneel, één punt per regel)</label> ' +
      '<textarea id="lmLiteBehoefte" name="behoeften" maxlength="960" rows="3"></textarea></p>' +
      '<button class="knop" type="submit">Bedrijfsaanvraag indienen</button></form></details>';
  }
  function start(vak, ctx) {
    var form = vak.querySelector('#lmLiteIntake'), opdracht = null, key = null, bezig = false;
    if (!form) return function () {};
    function vul() {
      if (!opdracht || !ctx.levend()) return;
      form.elements.naam.value = opdracht.naam; form.elements.contact.value = opdracht.contact;
      form.elements.bedrijf.value = opdracht.bedrijf.naam; form.elements.type.value = opdracht.bedrijf.type;
      form.elements.plaats.value = opdracht.bedrijf.plaats; form.elements.behoeften.value = opdracht.bedrijf.behoeften.join('\n');
    }
    async function laden() {
      key = (await ctx.sleutel()) + ':lite-intake';
      var raw = w.sessionStorage.getItem(key);
      if (raw) { opdracht = JSON.parse(raw); vul(); }
      var laatste = w.sessionStorage.getItem(key + ':ontvangst');
      if (laatste && !opdracht) ctx.ontvangen(laatste, false);
    }
    async function verzend(e) {
      e.preventDefault();
      if (bezig) return;
      bezig = true; var button = form.querySelector('button'); button.disabled = true;
      try {
        if (!key) await laden();
        var inhoud = { pas: 'business-lite', naam: form.elements.naam.value.trim(), contact: form.elements.contact.value.trim(),
          bedrijf: { naam: form.elements.bedrijf.value.trim(), type: form.elements.type.value,
            plaats: form.elements.plaats.value.trim(), behoeften: form.elements.behoeften.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8) } };
        if (opdracht) {
          var eerder = Object.assign({}, opdracht); delete eerder.idem;
          if (JSON.stringify(eerder) !== JSON.stringify(inhoud))
            throw Error('Een eerdere bedrijfsaanvraag is nog onzeker. Herhaal dezelfde inhoud of vraag RTG om controle.');
        } else opdracht = Object.assign({}, inhoud, { idem: w.crypto.randomUUID() });
        w.sessionStorage.setItem(key, JSON.stringify(opdracht));
        var r = await w.Geld.api('/api/aanmelding/aanvraag', opdracht);
        var id = r.ontvangst && r.ontvangst.aanvraagId;
        if (!id) throw Error('Geen aanvraagreferentie bevestigd. Bewaar dezelfde opdracht voor herstel.');
        w.sessionStorage.setItem(key + ':ontvangst', id);
        w.sessionStorage.removeItem(key); opdracht = null;
        if (ctx.levend()) { form.reset(); ctx.ontvangen(id, true); }
      } catch (err) { ctx.meld(err.message || 'De bedrijfsaanvraag is niet bevestigd.'); }
      finally { bezig = false; if (ctx.levend()) button.disabled = false; }
    }
    form.addEventListener('submit', verzend);
    laden().catch(function (e) { ctx.meld(e.message); });
    return function () { form.removeEventListener('submit', verzend); };
  }
  w.RTGGeldAbonnementIntake = { html: html, start: start };
})(window);
