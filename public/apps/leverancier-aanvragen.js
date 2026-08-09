/* De vraagkant voor een zaak: welke leden zoeken iets dat u kunt leveren.

   Wat de zaak ziet is beperkt en dat is met opzet: de vraag, de plaats, de dag
   en een eventueel budget, plus de codenaam van het lid. Geen adres -- een
   openstaande vraag is voor meerdere zaken zichtbaar, en dan hoort er niet in
   te staan wanneer iemand niet thuis is.

   Reageren kan een keer per aanvraag. Wie zich bedenkt wijzigt zijn eigen
   reactie in plaats van er een tweede naast te zetten; de server houdt dat vast
   en dit scherm laat de bestaande tekst dus terugkomen in het invoerveld. */

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = (n) => (n == null) ? '' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
let TOKEN = null; try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) {}

function meld(t) {
  const m = $('#melding'); m.textContent = t; m.style.opacity = '1';
  clearTimeout(m._t); m._t = setTimeout(() => { m.style.opacity = '0'; }, 2600);
}
const api = (pad, body) => fetch(pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
  body: JSON.stringify(body || {})
}).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
  return d;
});

// welke reactie is van deze zaak zelf? de server geeft de code mee
function mijnReactie(a, eigenCode) {
  return (a.reacties || []).find((r) => r.code === eigenCode) || null;
}

async function teken() {
  let d, code = null;
  try {
    d = await api('/api/supplier/mall/aanvragen', {});
    const spiegel = await api('/api/supplier/mall', {});
    code = spiegel.zaak.code;
  } catch (e) { $('#lijst').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }

  $('#uitleg').textContent = d.opmerking;
  if (!d.aanvragen.length) {
    $('#lijst').innerHTML = '<div class="leeg">Op dit moment staat er niets open dat bij uw vak en werkgebied past. ' +
      'Uw werkgebied staat op ' + esc((d.bereik && d.bereik.label) || 'onbekend') +
      ((d.bereik && d.bereik.aangenomen) ? ' (aangenomen op basis van uw genre; u kunt hem zelf instellen)' : '') + '.</div>';
    return;
  }

  $('#lijst').innerHTML = d.aanvragen.map((a) => {
    const mijn = mijnReactie(a, code);
    return '<div class="kaart">' +
      '<h3>' + esc(a.wat) + '</h3>' +
      '<div class="meta">' + esc(a.van) + ' &middot; ' + esc(a.plek || '') +
        (a.wanneer ? ' &middot; ' + esc(a.wanneer) : '') +
        (a.budget ? ' &middot; budget ' + euro(a.budget) : '') +
        ' &middot; ' + a.aantalReacties + (a.aantalReacties === 1 ? ' reactie' : ' reacties') + '</div>' +
      (mijn ? '<div class="mijn"><div class="oms">' + esc(mijn.tekst) + '</div>' +
        (mijn.prijs ? '<div class="meta">' + euro(mijn.prijs) + '</div>' : '') +
        (mijn.gekozen ? '<div class="meta goed">Gekozen. Het lid verwacht dat u contact opneemt.</div>'
          : '<div class="meta">Uw reactie staat er; u kunt hem hieronder wijzigen.</div>') + '</div>' : '') +
      '<div class="rij">' +
        '<input class="veld tekst groei" data-id="' + esc(a.id) + '" maxlength="400" ' +
          'placeholder="Wat kunt u bieden?" value="' + esc(mijn ? mijn.tekst : '') + '">' +
        '<input class="veld prijs smaller" data-id="' + esc(a.id) + '" type="number" min="0" ' +
          'placeholder="Prijs" value="' + (mijn && mijn.prijs ? mijn.prijs : '') + '" aria-label="Prijs in euro">' +
        '<button class="knop reageer" data-id="' + esc(a.id) + '" type="button">' + (mijn ? 'Bijwerken' : 'Reageren') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  $('#lijst').querySelectorAll('.reageer').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.id;
    const tekst = $('.tekst[data-id="' + id + '"]').value.trim();
    const prijs = Number($('.prijs[data-id="' + id + '"]').value) || null;
    try { await api('/api/supplier/mall/aanvraag/reageer', { id, tekst, prijs }); meld('Uw reactie staat bij het lid.'); teken(); }
    catch (e) { meld(e.message); }
  }));
}

if (!TOKEN) {
  $('#main').innerHTML = '<div class="inlog"><h2>Log eerst in</h2>' +
    '<p class="oms ruimer">Dit scherm is voor aangesloten zaken. Log in op het leveranciersportaal.</p>' +
    '<p class="ruimst"><a href="/apps/leverancier.html">Naar het portaal &rarr;</a></p></div>';
} else {
  teken();
}
