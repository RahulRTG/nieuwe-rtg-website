/* De persoonlijke reiscontracten in het bestaande reisbureau. De server blijft
   bron van prijs, versie, bevoegdheid en betaalstand; een antwoordverlies is
   onbekend totdat de eigen reis opnieuw is gelezen. Geen lokale dossiercache. */
(function (w) {
  'use strict';
  function n(tag, tekst, klasse) {
    const el = document.createElement(tag);
    if (tekst != null) el.textContent = tekst;
    if (klasse) el.className = klasse;
    return el;
  }
  const geld = (centen, valuta) => new Intl.NumberFormat(document.documentElement.lang || 'nl', {
    style: 'currency', currency: valuta || 'EUR'
  }).format(centen / 100);
  function knop(tekst, actie) {
    const b = n('button', tekst, 'ds-knop ds-knop--stil ds-knop--breed'); b.type = 'button';
    if (actie) b.dataset.ketenActie = actie;
    return b;
  }
  function mount(host, api) {
    if (!host) return;
    let generatie = 0, bezig = false, onzeker = false, pendingStart = null;
    const status = n('p', 'Uw reiscontracten laden…', 'ds-meta'); status.setAttribute('role', 'status');
    const lijst = n('div', null, 'ds-velden'); lijst.dataset.ketenLijst = '';
    const form = n('form', null, 'ds-velden'); form.hidden = true;
    const titel = veld('titel', 'Wat wilt u voor uw reis laten samenstellen?', true);
    const bestemming = veld('bestemming', 'Bestemming of gebied', true);
    const supplierCode = veld('supplierCode', 'Reisbureaucode (optioneel; leeg is RTG Travel)', false);
    const start = knop('Stuur mijn reiswens', 'start'); start.type = 'submit'; form.appendChild(start);
    const ververs = knop('Controleer mijn reiscontracten', 'ververs');
    host.replaceChildren(n('h2', 'Mijn reiscontracten', 'ds-titel ds-titel--scherm'),
      n('p', 'Lokale kwalificatieproef. Een aanvraag is nog geen bevestigde reis. Financiële afsluiting en externe leveranciers zijn nog niet gekwalificeerd.', 'ds-meta'),
      status, form, lijst, ververs);
    function veld(naam, label, required) {
      const wrap = n('label', null, 'ds-veldlabel'), input = n('input', null, 'ds-invoer');
      input.name = naam; input.required = required; input.maxLength = 160;
      wrap.append(n('span', label), input); form.appendChild(wrap); return input;
    }
    function slot(v) {
      bezig = v; start.disabled = v || onzeker;
      lijst.querySelectorAll('button').forEach(b => { b.disabled = v || onzeker; });
      ververs.disabled = v;
    }
    async function laden() {
      if (bezig) return;
      const eigen = ++generatie; onzeker = true; slot(true);
      try {
        const r = await api('/api/reisbureau/keten', {});
        if (eigen !== generatie || !host.isConnected) return;
        onzeker = false; form.hidden = false; lijst.replaceChildren();
        (r.reizen || []).forEach(reis => lijst.appendChild(teken(reis)));
        status.textContent = r.reizen.length ? 'Uw actuele reiscontracten staan hieronder.' : 'U kunt hier uw eerste reiswens versturen.';
      } catch (e) {
        if (eigen !== generatie || !host.isConnected) return;
        status.textContent = e.message || 'Controleren lukt nu niet. Probeer opnieuw.';
        if ([401, 403].includes(e.status)) { form.hidden = true; lijst.replaceChildren(); }
      } finally { if (eigen === generatie) slot(false); }
    }
    async function verstuur(pad, body, succes) {
      if (bezig || onzeker) return;
      slot(true); status.textContent = 'Uw handeling wordt verwerkt…';
      try {
        await api(pad, body);
        if (succes) succes();
        slot(false); await laden();
      } catch (e) {
        if ([401, 403].includes(e.status)) { form.hidden = true; lijst.replaceChildren(); }
        const onbekend = !e.status || e.status >= 500;
        onzeker = onbekend || e.status === 409;
        status.textContent = (e.message || 'De verbinding is onderbroken.') + (onbekend
          ? ' De uitkomst is onbekend. Controleer eerst uw reiscontracten; er wordt niet opnieuw verstuurd.'
          : ' Controleer de actuele reis voordat u opnieuw handelt.');
        slot(false);
      }
    }
    function teken(reis) {
      const vak = n('article', null, 'ds-kaart'); vak.dataset.reiscontract = reis.ref;
      const inhoud = n('div', null, 'ds-kaart__inhoud'); vak.appendChild(inhoud);
      inhoud.append(n('h3', reis.titel, 'ds-kaart__titel'),
        n('p', reis.bestemming + ' · ' + reis.verkoper.naam, 'ds-meta'));
      const stand = n('p', reis.status, 'ds-detail__status'); stand.dataset.ketenStatus = ''; inhoud.appendChild(stand);
      const o = reis.offerte;
      if (o) {
        inhoud.append(n('p', 'Offerte ' + o.versie + ' · ' + geld(o.totaalCenten, o.valuta), 'ds-meta'),
          n('p', 'Geldig tot ' + new Date(o.geldigTot).toLocaleString(document.documentElement.lang || 'nl'), 'ds-meta'));
        const regels = n('ul', null, 'ds-detail__gegevens');
        (o.onderdelen || []).forEach(p => regels.appendChild(n('li', p.wat + ' · ' + geld(p.centen, o.valuta), 'ds-detail__gegeven')));
        inhoud.append(regels, n('p', o.voorwaarden, 'ds-meta'));
        if (o.rollen) inhoud.append(n('p', 'Contractpartij: ' + o.rollen.contractpartij + '. Factuur: ' +
          o.rollen.factureert + '. Rol: ' + o.rollen.hoedanigheid + '. ' + o.rollen.aansprakelijk, 'ds-meta'));
        if (reis.status === 'aangeboden') {
          const label = n('label', null, 'ds-veldlabel'), check = n('input'); check.type = 'checkbox';
          check.dataset.ketenAkkoord = ''; label.append(check, document.createTextNode(' Ik ga akkoord met deze offerteversie, de prijs en de getoonde voorwaarden.'));
          const b = knop('Accepteer deze offerte', 'akkoord');
          b.addEventListener('click', () => {
            if (!check.checked) { status.textContent = 'Bevestig eerst dat u akkoord gaat met de getoonde offerte.'; return; }
            verstuur('/api/reisbureau/keten/akkoord', { ref: reis.ref, versie: reis.versie, offerteHash: o.hash, idem: crypto.randomUUID() });
          }); inhoud.append(label, b);
        }
      }
      (reis.leveringen || []).forEach(p => inhoud.appendChild(n('p', p.wat + ': ' + p.status, 'ds-meta')));
      if (reis.betaling) inhoud.appendChild(n('p', 'Betaling: ' + reis.betaling.status + ' · ' + geld(reis.betaling.centen, 'EUR'), 'ds-meta'));
      if (reis.status === 'bevestigd' && (!reis.betaling || reis.betaling.status !== 'betaald')) {
        const b = knop('Betaal ' + geld(o.totaalCenten, o.valuta) + ' via RTG Pay', 'betaal');
        b.addEventListener('click', () => verstuur('/api/reisbureau/keten/betaal', {
          ref: reis.ref, versie: reis.versie, idem: crypto.randomUUID()
        })); inhoud.appendChild(b);
      } else if (['geaccepteerd', 'gedeeltelijk-bevestigd'].includes(reis.status)) {
        inhoud.appendChild(n('p', 'Betalen kan zodra alle aanbieders hun onderdeel hebben bevestigd.', 'ds-meta'));
      } else if (reis.status === 'herstel-vereist') inhoud.appendChild(n('p', 'Uw reisadviseur moet deze reis herstellen. Er wordt geen nieuwe betaling uitgevoerd.', 'ds-meta'));
      w.RTGReisNazorg.teken(inhoud, reis, 'lid', (pad, body) => verstuur('/api/reisbureau/' + pad, body));
      return vak;
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      const body = { titel: titel.value.trim(), bestemming: bestemming.value.trim(), supplierCode: supplierCode.value.trim() };
      const afdruk = JSON.stringify(body);
      if (!pendingStart || pendingStart.afdruk !== afdruk) pendingStart = { afdruk, idem: crypto.randomUUID() };
      verstuur('/api/reisbureau/keten/start', { ...body, idem: pendingStart.idem }, () => { form.reset(); pendingStart = null; });
    });
    ververs.addEventListener('click', laden); laden();
  }
  w.RTGReisbureauKeten = { mount };
})(window);
