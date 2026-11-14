/* Reisonderdelen in de bestaande leverancierswerkplek. De API projecteert
   uitsluitend eigen opdrachten; een verklaring verandert geen andere bron. */
(function (w) {
  'use strict';
  function n(tag, tekst, klasse) {
    const el = document.createElement(tag);
    if (tekst != null) el.textContent = tekst;
    if (klasse) el.className = klasse;
    return el;
  }
  function mount(host, api) {
    if (!host) return;
    const generatie = (host._reisOpdrachtGeneratie || 0) + 1; host._reisOpdrachtGeneratie = generatie;
    const actueel = () => host.isConnected && host._reisOpdrachtGeneratie === generatie;
    const status = n('p', 'Uw reisopdrachten laden…', 'ds-meta'); status.setAttribute('role', 'status');
    const lijst = n('div', null, 'ds-velden');
    const ververs = n('button', 'Reisopdrachten controleren', 'ds-knop ds-knop--stil'); ververs.type = 'button';
    let bezig = false, onzeker = false;
    host.replaceChildren(n('h3', 'Eigen reisopdrachten', 'ds-titel'),
      n('p', 'Lokale kwalificatieproef. Leg alleen uw eigen acceptatie, weigering of levering vast, met een bronreferentie uit uw administratie.', 'ds-meta'), status, lijst, ververs);
    function slot(v) {
      bezig = v; ververs.disabled = v;
      lijst.querySelectorAll('button').forEach(b => { b.disabled = v || onzeker; });
    }
    async function laden() {
      if (bezig) return;
      slot(true);
      try {
        const r = await api('opdrachten', {});
        if (!actueel()) return;
        onzeker = false; lijst.replaceChildren();
        (r.reizen || []).forEach(reis => (reis.opdrachten || []).forEach(p => lijst.appendChild(teken(reis, p))));
        status.textContent = lijst.children.length ? 'Alleen opdrachten voor uw eigen organisatie.' : 'Er zijn geen reisopdrachten voor uw organisatie.';
      } catch (e) { if (actueel()) { lijst.replaceChildren(); status.textContent = e.message || 'Controleren lukt nu niet.'; } }
      finally { if (actueel()) slot(false); }
    }
    function teken(reis, p) {
      const vak = n('section', null, 'ds-velden'); vak.dataset.reisopdracht = p.id; vak.dataset.reisref = reis.ref;
      vak.append(n('h4', p.wat, 'ds-titel'), n('p', 'Opdrachtgever: ' + reis.verkoper.naam + ' · bron: ' + p.productRef, 'ds-meta'));
      const stand = n('p', p.status, 'ds-meta'); stand.dataset.opdrachtStatus = ''; vak.appendChild(stand);
      vak.appendChild(n('p', 'Verschuldigd bij levering: ' + new Intl.NumberFormat(document.documentElement.lang || 'nl', {
        style: 'currency', currency: p.valuta || 'EUR'
      }).format(p.verschuldigdCenten / 100), 'ds-meta'));
      if (p.bewijsRef) vak.appendChild(n('p', 'Bronreferentie: ' + p.bewijsRef, 'ds-meta'));
      const acties = reis.status === 'herstel-vereist' ? [] : p.status === 'aangevraagd'
        ? [['accepteer', 'Accepteer eigen onderdeel'], ['weiger', 'Weiger eigen onderdeel']]
        : p.status === 'bevestigd' ? [['lever', 'Leg eigen levering vast']] : [];
      if (acties.length) {
        const label = n('label', null, 'ds-veldlabel'), bron = n('input', null, 'ds-invoer');
        bron.name = 'bewijsRef'; bron.maxLength = 160;
        label.append(n('span', 'Bronreferentie van dit besluit of deze levering'), bron); vak.appendChild(label);
        acties.forEach(([besluit, tekst]) => {
          const b = n('button', tekst, 'ds-knop ds-knop--stil'); b.type = 'button'; b.dataset.opdrachtBesluit = besluit;
          b.addEventListener('click', async () => {
            if (bezig || onzeker) return;
            if (!bron.value.trim()) { status.textContent = 'Vul eerst de bronreferentie uit uw administratie in.'; bron.focus(); return; }
            slot(true);
            try {
              await api('opdracht/besluit', { ref: reis.ref, versie: reis.versie, onderdeel: p.id,
                besluit, bewijsRef: bron.value.trim(), idem: crypto.randomUUID() });
              if (!actueel()) return;
              slot(false); await laden();
            } catch (e) {
              if (!actueel()) return;
              lijst.replaceChildren();
              onzeker = !e.status || e.status >= 500;
              status.textContent = (e.message || 'De verbinding is onderbroken.') + (onzeker
                ? ' Uitkomst onbekend. Controleer eerst uw opdrachten; er wordt niet opnieuw verstuurd.'
                : ' Controleer de actuele opdracht.');
              slot(false);
            }
          }); vak.appendChild(b);
        });
      }
      return vak;
    }
    ververs.addEventListener('click', laden); laden();
  }
  w.RTGReisketenLeverancier = { mount };
})(window);
