/* DE TERUGGAVEN VAN DE REISBALIE -- het scherm bij /api/office/reisbureau/teruggave.

   Een afgezegde of teruggeboekte BETAALDE reis laat een teruggaveRECHT achter
   (kern/reisbureau-teruggave.js). De server kon dat recht sinds 4 oktober 2026
   uitvoeren of afwijzen, maar er was geen scherm: de reisbalie zei bij afzeggen nog
   "het geld handelt u zelf af". Dit is dat scherm, en het doet niets wat de server
   niet zelf beslist:

   - uitvoeren vraagt een passkey (de server antwoordt 401 met `bevestigingNodig`, en
     /shared/zwaarstap.js laat de browser tekenen op het loket van DIT recht);
   - vanaf duizend euro zet de server een aanvraag klaar voor een TWEEDE mens, en dan
     zegt dit scherm dat er nog geen geld bewoog -- die collega tekent bij RTG Bank,
     onder "Wacht op een tweede handtekening";
   - afwijzen vraagt een reden van ten minste tien tekens, en die wordt bij het recht
     bewaard. Het scherm belooft NIET dat het lid hem leest: geen ledenroute toont de
     uitkomst van een teruggave (kern/reisbureau-teruggave.js#teruggavenVan heeft geen
     lezer), en een belofte die de code niet houdt hoort niet op een knop.

   Bij een aanvraag langs de geldketen (MACHINE.md) toont het scherm welke verplichte
   assen nog open staan, zoals het dossier ze telt -- en niet "klaar".

   Gebruik: RTGReisTeruggave({ api, kaal, meld, esc, wortel }) geeft { laad }. */
window.RTGReisTeruggave = function (o) {
  'use strict';
  const { api, kaal, meld, esc, wortel } = o;
  const euro = c => '€ ' + (Number(c || 0) / 100).toFixed(2).replace('.', ',');

  /* Uitvoeren met de passkey van DEZE medewerker, gebonden aan DIT recht: het loket is
     /reisbureau/teruggave/opties met het id, niet het algemene boardroomloket. */
  async function uitvoeren(id) {
    const r = await window.RTGZwaar.metVinger(
      extra => kaal('reisbureau/teruggave', Object.assign({ id, besluit: 'uitvoeren' }, extra)),
      () => kaal('reisbureau/teruggave/opties', { id }).then(x => x.body));
    if (r.status >= 400) throw new Error((r.body && r.body.error) || 'De teruggave ging niet door.');
    return r.body;
  }

  // het dossier van de geldketen: welke verplichte as staat nog open, en waarom
  async function dossierZin(voornemen) {
    if (!voornemen) return '';
    try {
      const d = (await api('bank/incasso/dossier', { voornemen })).dossier;
      if (!d) return '';
      const open = d.open || [];
      return 'Geldketen: ' + (d.verplicht.length - open.length) + ' van ' + d.verplicht.length +
        ' verplichte assen gelopen' + (open.length ? '; open: ' + open.join(', ') : '; rond') + '.';
    } catch (e) { return 'Het dossier van de geldketen is nu niet te lezen.'; }
  }

  async function laad() {
    if (!wortel) return;
    wortel.innerHTML = '<div class="leeg">Laden...</div>';
    let d;
    try { d = await api('reisbureau/teruggaven'); }
    catch (e) { wortel.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
    const open = d.open || [];
    const grens = d.vierOgenVanafCenten;
    if (!open.length) { wortel.innerHTML = '<div class="leeg">Er staat geen teruggave klaar.</div>'; return; }
    wortel.innerHTML = open.map(r =>
      '<div class="lijst rzRij">' +
        '<div class="rzTitel"><b>' + esc(euro(r.centen)) + '</b> · reis ' + esc(r.ref) +
          (r.volledig === false ? ' · gedeeltelijk' : '') + '</div>' +
        '<div class="stil rzMeta">' + esc(r.id) + ' · ' + esc(r.grond || '') +
          (r.codenaam ? '' : ' · <b>geen betaaladres op de bon</b>: uitvoeren kan niet, wijs af met die reden') +
          (grens && r.centen >= grens ? ' · vanaf ' + esc(euro(grens)) + ' tekent een tweede mens' : '') + '</div>' +
        '<div class="taakrij">' +
          '<input class="veld rzVeld" maxlength="400" data-treden="' + esc(r.id) + '" placeholder="Reden bij afwijzen (verplicht, ten minste tien tekens)">' +
          '<button class="knop" type="button" data-tuit="' + esc(r.id) + '">Voer uit</button>' +
          '<button class="knop stil" type="button" data-tweg="' + esc(r.id) + '">Wijs af</button>' +
        '</div>' +
        '<div class="stil rzMeta" data-tstand="' + esc(r.id) + '"></div>' +
      '</div>').join('');

    wortel.querySelectorAll('button[data-tuit]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.tuit, stand = wortel.querySelector('[data-tstand="' + id + '"]');
      b.disabled = true;
      try {
        const r = await uitvoeren(id);
        if (r.needsAuth) {
          const zin = await dossierZin(r.voornemen && r.voornemen.id);
          meld('Klaargezet voor een tweede mens. Er is nog geen geld bewogen; een collega tekent bij RTG Bank.');
          if (stand) stand.textContent = 'Wacht op een tweede handtekening. ' + zin;
          return;
        }
        meld('Uitgevoerd: ' + euro(r.recht && r.recht.centen) + ' terug naar het lid.');
        laad();
      } catch (e) { b.disabled = false; meld(e.message); }
    }));
    wortel.querySelectorAll('button[data-tweg]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.tweg, veld = wortel.querySelector('input[data-treden="' + id + '"]');
      b.disabled = true;
      try {
        await api('reisbureau/teruggave', { id, besluit: 'afgewezen', reden: veld ? veld.value : '' });
        meld('Afgewezen; uw reden staat bij het recht.');
        laad();
      } catch (e) { b.disabled = false; meld(e.message); }
    }));
  }

  return { laad };
};
