(function () {
  'use strict';
  const e = window.RTGWerk.esc;
  const veld = (naam, label, type = 'text') => '<label>' + e(label) + '<input name="' + naam + '" type="' + type + '" required maxlength="1000"' + (type === 'number' ? ' min="0" step="0.01"' : '') + '></label>';
  function form(x, actie, tekst, taakId, inhoud = '') {
    return '<form data-pr="leverancier" data-project="' + e(x.id) + '" data-stap="' + actie + '-' + e(taakId || '') + '">' +
      '<input type="hidden" name="actie" value="' + actie + '"><input type="hidden" name="taakId" value="' + e(taakId || '') + '">' +
      inhoud + '<button type="submit" class="knop">' + tekst + '</button></form>';
  }
  window.RTGPraktijkLeverancier = { formulier: (x, rechten) => {
    if (!['bevestigd', 'ingepland'].includes(x.stand)) return '';
    const mag = ['werkruimte', 'project', 'klant', 'geld', 'geld.goedkeuren'].every(r => (rechten || []).includes(r));
    const taken = x.taken.filter(t => t.externeAfspraak?.herkomst === 'rtg-aanvraag');
    return '<details><summary>Boeken bij een leverancier · ' + taken.length + '</summary>' +
      '<p>De leverancier bevestigt uw opdracht via een eigen link. Alleen daarna staat de boeking op bevestigd. Deel uitsluitend gegevens die voor deze opdracht nodig zijn.</p>' +
      taken.map(t => {
        const a = t.externeAfspraak;
        return '<details><summary>' + e(t.titel) + ' · ' + e(a.stand) + '</summary><p>' + e(t.wie) + ' · ' + e(t.deadline) + '</p><p>' + e(a.voorwaarden) + '</p>' +
          (a.antwoord ? '<p>Antwoord leverancier: ' + e(a.antwoord.referentie) + '</p>' : '') +
          (mag && ['aangevraagd', 'annulering-gevraagd'].includes(a.stand) ? form(x, 'link', 'Nieuwe leverancierslink maken', t.id) : '') +
          (mag && a.stand === 'aangevraagd' ? form(x, 'intrekken', 'Aanvraag intrekken', t.id) : '') +
          (mag && a.stand === 'bevestigd' ? form(x, 'annuleren', 'Annulering aanvragen', t.id, veld('toelichting', 'Reden voor annulering')) +
            form(x, 'uitgevoerd', 'Leverancierswerk aftekenen', t.id, veld('toelichting', 'Bewijs van uitvoering')) : '') + '</details>';
      }).join('') + (mag ? '<details><summary>Nieuwe leveranciersopdracht</summary>' + form(x, 'aanvragen', 'Opdracht klaarzetten', '',
        veld('leverancier', 'Naam leverancier') + veld('onderdeel', 'Opdracht voor leverancier') + veld('datum', 'Datum van levering of uitvoering', 'date') +
        veld('locatie', 'Locatie voor leverancier') + veld('bedrag', 'Afgesproken inkoopbedrag in ' + x.valuta, 'number') +
        '<label>Afgesproken voorwaarden<textarea name="voorwaarden" maxlength="1000" required></textarea></label>') + '</details>' :
        '<p>Uw beheerder met financiële goedkeuringsrechten kan opdrachten klaarzetten.</p>') + '</details>';
  }};
  if (!location.hash.startsWith('#leverancier=')) return;
  const sleutel = location.hash.slice(13), el = document.createElement('main');
  document.body.classList.add('pr-gast'); el.id = 'praktijkGast'; el.className = 'praktijk'; document.body.append(el);
  async function api(pad, b = {}) {
    const r = await fetch('/api/werk-leverancier/' + pad, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...b, sleutel }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Dit is niet gelukt.'); return d;
  }
  async function laad() {
    try {
      const d = await api('beeld'), annulering = d.stand === 'annulering-gevraagd';
      el.innerHTML = '<p>Leveranciersopdracht van ' + e(d.organisatie) + '</p><h1>' + e(d.titel) + '</h1><p>' + e(d.leverancier) + '</p>' +
        '<p>' + e(d.datum) + ' · ' + e(d.tijdzone) + ' · ' + e(d.locatie) + '</p><p>' + e(d.voorwaarden) + '</p><p><b>' +
        e(new Intl.NumberFormat(document.documentElement.lang || navigator.language, { style: 'currency', currency: d.valuta }).format(d.bedragMinor / 10 ** d.decimalen)) +
        '</b></p><p>Status: ' + e(d.stand) + '</p>' + (annulering ? '<p>Verzoek om annulering: ' + e(d.annuleringsreden) + '</p>' : '') +
        '<p>Uw antwoord geldt voor deze opdracht en voorwaarden. Een bevestiging verwerkt geen betaling of terugbetaling.</p>' +
        (d.magAntwoorden ? '<form>' + veld('naam', 'Uw naam') + veld('referentie', 'Uw bevestigingsreferentie of toelichting') +
          '<label>Uw besluit<select name="keuze"><option value="bevestigen">' + (annulering ? 'Annulering bevestigen' : 'Opdracht bevestigen') +
          '</option><option value="weigeren">' + (annulering ? 'Annulering weigeren' : 'Opdracht weigeren') + '</option></select></label>' +
          '<button type="submit" class="knop">Antwoord bevestigen</button><p role="status"></p></form>' : '');
      el.querySelector('form')?.addEventListener('submit', async ev => {
        ev.preventDefault(); const f = ev.target, k = f.querySelector('button'); if (k.disabled) return; k.disabled = true;
        try { await api('besluit', { ...Object.fromEntries(new FormData(f)), versie: d.versie }); await laad(); }
        catch (err) { f.querySelector('[role=status]').textContent = err.message; k.disabled = false; }
      });
    } catch (err) { el.textContent = err.message; }
  }
  laad();
})();
