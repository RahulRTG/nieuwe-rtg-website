/* Bestaande kantoor-/partnerwerkplek. Concepten leven uitsluitend in deze
   mount; de bestaande sessiepoort bewaakt iedere bronlezing en handeling. */
(function () {
  'use strict';
  function node(tag, tekst, klasse) {
    var n = document.createElement(tag); if (tekst != null) n.textContent = tekst;
    if (klasse) n.className = klasse; return n;
  }
  function knop(tekst) { var n = node('button', tekst, 'ds-knop ds-knop--stil'); n.type = 'button'; return n; }
  function mount(host, api) {
    if (!host) return;
    var generatie = (host._reisGeneratie || 0) + 1; host._reisGeneratie = generatie;
    var leesGeneratie = 0, mutatieBezig = false, controleNodig = false, concepten = new Map();
    var staat = node('p', 'Reiscontracten laden…', 'ds-meta'); staat.setAttribute('role', 'status');
    var lijst = node('div'); host.replaceChildren(node('h3', 'Reiscontracten', 'ds-titel'),
      node('p', 'Lokale kwalificatieproef · aanvragen en leveranciersverklaringen, geen productieboekingen. Financiële afsluiting blijft geblokkeerd.', 'ds-meta'), staat, lijst);
    var herlaad = knop('Reiscontracten vernieuwen'); host.appendChild(herlaad);
    function actueel(lezing) {
      return host._reisGeneratie === generatie && host.isConnected && (lezing === undefined || lezing === leesGeneratie);
    }
    function onthoud() {
      lijst.querySelectorAll('form').forEach(function (f) {
        if (f._gewijzigd) concepten.set(f.dataset.reisref, f._concept());
      });
    }
    function slot(aan) {
      mutatieBezig = aan; herlaad.disabled = aan;
      lijst.querySelectorAll('button,input,select,textarea').forEach(function (b) {
        b.disabled = aan || controleNodig || !!b.closest('form[data-alleen-lezen]');
      });
    }
    function wis() { concepten.clear(); lijst.replaceChildren(); }
    // Een leveranciers-sync mag een geopend concept niet door een nieuwe
    // mount vervangen. Controleer wel opnieuw via dezelfde serverpoort;
    // dit antwoord tekent niets en kan geen lopende mutatie overschrijven.
    host._reisControle = async function () {
      if (!actueel()) return;
      var lezing = leesGeneratie;
      try {
        var r = await api('keten', {});
        if (!actueel(lezing)) return;
        if (r.error || !Array.isArray(r.reizen)) throw new Error(r.error || 'De broncontrole is niet geldig.');
        var refs = new Set(r.reizen.map(function (reis) { return reis.ref; }));
        if (Array.from(lijst.children).some(function (vak) { return !refs.has(vak.dataset.reisref); })) {
          ++leesGeneratie; wis(); controleNodig = true; slot(mutatieBezig);
          staat.textContent = 'De actuele werkruimte bevat niet meer alle getoonde reizen. Schermgegevens en concepten zijn verwijderd; controleer de bron opnieuw.';
        }
      }
      catch (e) {
        if (!actueel(lezing)) return;
        controleNodig = true;
        if ([401, 403].includes(e.status)) wis();
        staat.textContent = (e.message || 'De verbinding is onderbroken.') + ' Eerst een geslaagde broncontrole; er wordt niets opnieuw verstuurd.';
        slot(mutatieBezig);
      }
    };
    async function laden(naMutatie) {
      if (!actueel() || (mutatieBezig && naMutatie !== true)) return;
      var lezing = ++leesGeneratie; herlaad.disabled = true;
      try {
        var r = await api('keten', {});
        if (!actueel(lezing)) return;
        if (r.error) throw new Error(r.error);
        onthoud(); controleNodig = false; lijst.replaceChildren();
        var ontvangen = false, refs = new Set((r.reizen || []).map(function (reis) { return reis.ref; }));
        concepten.forEach(function (c, ref) { if (!refs.has(ref)) concepten.delete(ref); });
        (r.reizen || []).forEach(function (reis) {
          if (window.RTGReisketenOfferte.ontvangen(reis, concepten.get(reis.ref))) {
            concepten.delete(reis.ref); ontvangen = true;
          }
          lijst.appendChild(teken(reis));
        });
        staat.textContent = ontvangen ? 'De actuele bron bevat uw offertegegevens. Er is niets opnieuw aangeboden.' :
          r.reizen.length ? r.reizen.length + ' reiscontract(en) in uw eigen werkruimte.' : 'Nog geen reiscontracten voor uw werkruimte.';
      } catch (e) {
        if (actueel(lezing)) {
          controleNodig = true;
          if ([401, 403].includes(e.status)) wis();
          staat.textContent = (e.message || 'De contracten konden niet worden geladen.') + ' Eerst een geslaagde broncontrole; er wordt niets opnieuw verstuurd.';
        }
      } finally { if (actueel(lezing)) slot(mutatieBezig); }
    }
    async function opslaan(body, form, pad) {
      if (mutatieBezig || controleNodig || !actueel()) return;
      onthoud(); ++leesGeneratie; slot(true); staat.textContent = form ? 'Offerte opslaan…' : 'Antwoord vastleggen…';
      try {
        var r = await api(pad || 'keten/offerte', body);
        if (r.error) throw new Error(r.error);
        if (actueel()) { if (form) { form._gewijzigd = false; concepten.delete(body.ref); } await laden(true); }
      } catch (e) {
        if (actueel()) {
          controleNodig = true;
          if ([401, 403].includes(e.status)) wis();
          staat.textContent = (e.message || 'De verbinding is onderbroken.') +
            ((!e.status || e.status >= 500) ? ' Uitkomst onbekend.' : ' De handeling is niet opgeslagen.') +
            ([401, 403].includes(e.status) ? ' Schermgegevens en concepten zijn verwijderd.' :
              (form ? ' Uw concept blijft alleen in dit schermgeheugen.' : '') + ' Vernieuw de bron en beoordeel opnieuw; geen automatische herverzending.');
        }
      } finally { if (actueel()) slot(false); }
    }
    function teken(reis) {
      var vak = node('section', null, 'ds-velden'), concept = concepten.get(reis.ref);
      vak.dataset.reisref = reis.ref;
      vak.appendChild(node('h4', reis.titel, 'ds-titel'));
      vak.appendChild(node('p', reis.bestemming + ' · ' + reis.status + ' · versie ' + reis.versie, 'ds-meta'));
      if (reis.offerte) vak.appendChild(node('p', 'Offerte ' + reis.offerte.versie + ': ' +
        (reis.offerte.totaalCenten / 100).toLocaleString(document.documentElement.lang || navigator.language, { style: 'currency', currency: 'EUR' }), 'ds-meta'));
      (reis.leveringen || []).forEach(function (p) { vak.appendChild(node('p', p.wat + ': ' + p.status, 'ds-meta')); });
      if (reis.aansluiting) vak.appendChild(node('p', 'Settlement: ' + reis.aansluiting.settlement +
        '. Ontvangen: ' + (reis.aansluiting.ontvangenCenten / 100).toFixed(2) + ' EUR. Verschuldigd aan aanbieders: ' +
        (reis.aansluiting.verschuldigdCenten / 100).toFixed(2) + ' EUR.', 'ds-meta'));
      var bewerkbaar = ['aangevraagd', 'aangeboden'].includes(reis.status);
      if (concept) {
        var bron = node('details'); bron.appendChild(node('summary', 'Actuele bron vergelijken met uw concept'));
        if (reis.offerte) {
          bron.appendChild(node('p', reis.offerte.voorwaarden, 'ds-meta'));
          bron.appendChild(node('p', Object.values(reis.offerte.rollen).join(' · '), 'ds-meta'));
          reis.offerte.onderdelen.forEach(function (p) { bron.appendChild(node('p', p.wat + ' · ' + p.supplierCode +
            ' · ' + p.productRef + ' · verkoop ' + p.centen + ' cent · verschuldigd ' + p.verschuldigdCenten + ' cent', 'ds-meta')); });
        }
        bron.open = true; vak.appendChild(bron);
        var form = window.RTGReisketenOfferte.maak(reis, concept, opslaan); vak.appendChild(form);
        if (!bewerkbaar) {
          form.dataset.alleenLezen = '1';
          vak.appendChild(node('p', 'De actuele reis kan niet meer worden aangeboden. Dit concept is niet opgeslagen; bespreek de gewijzigde reis met de verantwoordelijke.', 'ds-meta'));
        }
      } else if (bewerkbaar) {
        var open = knop(reis.offerte ? 'Nieuwe offerteversie opstellen' : 'Offerte opstellen');
        open.addEventListener('click', function () { open.hidden = true; vak.appendChild(window.RTGReisketenOfferte.maak(reis, null, opslaan)); });
        vak.appendChild(open);
      }
      window.RTGReisNazorg.teken(vak, reis, 'verkoper', function (pad, body) { opslaan(body, null, pad); });
      return vak;
    }
    herlaad.addEventListener('click', laden); laden();
  }
  window.RTGReisketenWerktafel = { mount: mount };
})();
