/* De bestaande redactie is eigenaar van schrijven, review en publiceren. */
(function (w) {
  'use strict';
  w.RTGRedactieArtikel = async function (ctx, id) {
    var api = ctx.api, esc = ctx.esc, meld = ctx.meld, $ = ctx.$;
    var a = { titel: '', chapo: '', inhoud: '', rubriek: ctx.rubrieken[0] || 'Voorpagina', beeld: '' };
    if (id) { try { a = (await api('artikel/haal', { id: id })).artikel; } catch (e) { meld(e.message); return; } }
    var gepubliceerd = !!a.publicatie || a.status === 'live';
    var opties = ctx.rubrieken.map(function (r) { return '<option' + (r === a.rubriek ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('');
    $('#hoofd').innerHTML = '<div class="kaart"><div class="rij"><button class="mini" id="a_terug">← terug</button>'
      + '<button class="knop" id="a_assist">Rahul: kop &amp; chapo</button><button class="knop" id="a_bewaar">Concept bewaren</button>'
      + '<button class="knop" id="a_review">Naar eindredactie</button><button class="knop groen" id="a_pub">'
      + (gepubliceerd ? 'Wijziging publiceren' : 'Publiceren') + '</button></div>'
      + '<p class="hint" id="a_stand" role="status">' + esc(a.status === 'live'
        ? 'De gepubliceerde editie blijft leesbaar. Bewaren en eindredactie veranderen alleen het interne concept.'
        : 'Dit artikel is alleen zichtbaar binnen uw redactie.') + ' Werkstand: ' + esc(a.redactiestand || 'concept') + '.</p>'
      + '<label class="lab" for="a_titel">Kop</label><input class="veld" id="a_titel" maxlength="160" value="' + esc(a.titel) + '">'
      + '<label class="lab" for="a_rubriek">Rubriek</label><select id="a_rubriek">' + opties + '</select>'
      + '<button class="knop" id="a_beeld">' + (a.beeld ? 'Beeld gekozen' : 'Kies beeld') + '</button>'
      + '<label class="lab" for="a_chapo">Chapo (samenvatting)</label><textarea id="a_chapo" rows="2" maxlength="300">' + esc(a.chapo) + '</textarea>'
      + '<label class="lab" for="a_inhoud">Tekst</label><textarea id="a_inhoud" rows="12" maxlength="20000">' + esc(a.inhoud) + '</textarea>'
      + '<label class="lab" for="a_notities">Interne research en verificatie</label><textarea id="a_notities" rows="4" maxlength="6000">' + esc(a.notities || '') + '</textarea>'
      + '<p class="hint">Voor uw redactie. Deze aantekeningen verschijnen niet in de krant of Saloon.</p>'
      + (gepubliceerd ? '<label class="lab" for="a_toelichting">Openbare toelichting op de wijziging</label><textarea id="a_toelichting" rows="2" maxlength="400"></textarea>'
        + '<p class="hint">Vermeld wat is gecorrigeerd of waarom het artikel opnieuw verschijnt. Deze toelichting komt bij het artikel.</p>' : '')
      + '<div id="a_ai" class="hint"></div><details><summary>Publicatie- en werkhistorie (laatste 100 handelingen)</summary>'
      + '<ol>' + (a.historie || []).slice().reverse().map(function (h) {
        return '<li>' + esc(h.soort) + ' · ' + esc(h.door) + ' · ' + esc(new Date(h.at).toLocaleString())
          + ' · werkversie ' + h.revisie + (h.versie ? ', editie ' + h.versie : '')
          + (h.toelichting ? '<p>' + esc(h.toelichting) + '</p>' : '') + '</li>';
      }).join('') + '</ol></details></div>';
    var beeld = a.beeld || '', bezig = false;
    function verzamel(review) { return { id: a.id, revisie: a.revisie || 0, titel: $('#a_titel').value,
      rubriek: $('#a_rubriek').value, chapo: $('#a_chapo').value, inhoud: $('#a_inhoud').value,
      notities: $('#a_notities').value, beeld: beeld, naarReview: review }; }
    async function bewaar(review, publiceren) {
      if (bezig) return; bezig = true;
      ['a_bewaar', 'a_review', 'a_pub'].forEach(function (k) { $('#' + k).disabled = true; });
      try {
        a = (await api('artikel/bewaar', verzamel(review))).artikel;
        if (publiceren) {
          a = (await api('artikel/publiceer', { id: a.id, revisie: a.revisie,
            toelichting: $('#a_toelichting') ? $('#a_toelichting').value : '' })).artikel;
          meld('Gepubliceerd. Saloon leest deze editie.'); ctx.laad();
        } else { meld(review ? 'Klaar voor eindredactie.' : 'Concept bewaard.'); w.RTGRedactieArtikel(ctx, a.id); }
      } catch (e) { $('#a_stand').textContent = e.message; meld(e.message); }
      finally { bezig = false; ['a_bewaar', 'a_review', 'a_pub'].forEach(function (k) { if ($('#' + k)) $('#' + k).disabled = false; }); }
    }
    $('#a_terug').onclick = function () { ctx.toon('artikelen'); };
    $('#a_beeld').onclick = function () { ctx.kiesBeeld({ zet: function (src) { beeld = src; $('#a_beeld').textContent = 'Beeld gekozen'; } }); };
    $('#a_bewaar').onclick = function () { bewaar(false, false); };
    $('#a_review').onclick = function () { bewaar(true, false); };
    $('#a_pub').onclick = function () { bewaar(false, true); };
    $('#a_assist').onclick = async function () {
      try { var r = await api('assist', { titel: $('#a_titel').value, inhoud: $('#a_inhoud').value });
        if (r.chapo && !$('#a_chapo').value) $('#a_chapo').value = r.chapo;
        $('#a_ai').textContent = 'Kop-ideeën: ' + (r.koppen || []).join(' · ') + (r.ai ? ' · ' + r.ai : '');
      } catch (e) { meld(e.message); }
    };
  };
}(window));
