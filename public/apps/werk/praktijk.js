(function () {
  'use strict';
  const K = window.RTGWerk, UI = window.RTGPraktijkUI;
  if (location.hash.startsWith('#gast=')) return;
  const paneel = document.createElement('section'); paneel.className = 'praktijk'; paneel.id = 'praktijk';
  paneel.setAttribute('aria-label','Dagelijks werk');
  document.querySelector('#vStart').prepend(paneel);
  let stand, bezig = false, offset = 0, laadNummer = 0, ruimte = '';
  const concepten = new Map();
  const formulierSleutel = f => [f.dataset.pr,f.dataset.project||'',f.dataset.stap||''].join('|');
  paneel.addEventListener('input', ev => { const f = ev.target.closest('form[data-pr]');
    if (f) concepten.set(formulierSleutel(f), Object.fromEntries(new FormData(f))); });
  addEventListener('beforeunload', ev => { if (concepten.size) { ev.preventDefault(); ev.returnValue = ''; } });
  async function api(pad, b) {
    const r = await K.api('/praktijk/' + pad, b);
    if (r.status >= 400 || r.body.error) throw new Error(r.body.error || 'Opslaan is niet gelukt. Uw invoer blijft staan.');
    return r.body;
  }
  async function laad() {
    if (!K.sessie() || bezig) return;
    const gekozen = K.sessie().werkruimte;
    if (ruimte !== gekozen) { concepten.clear(); ruimte = gekozen; offset = 0; }
    const nummer = ++laadNummer;
    try {
      const data = await api('beeld', {offset});
      if (nummer !== laadNummer || K.sessie()?.werkruimte !== gekozen) return;
      stand = data; paneel.innerHTML = UI.teken(stand);
      paneel.querySelectorAll('form[data-pr]').forEach(f => {
        const waarden = concepten.get(formulierSleutel(f)); if (!waarden) return;
        for (const [naam, waarde] of Object.entries(waarden)) { const el = f.elements.namedItem(naam); if (el) el.value = waarde; }
        let ouder = f.parentElement; while (ouder && ouder !== paneel) { if (ouder.tagName === 'DETAILS') ouder.open = true; ouder = ouder.parentElement; }
      });
      paneel.querySelectorAll('[name=bedrag]').forEach(el => el.step = String(10**-(stand.profiel?.decimalen ?? 2)));
    } catch (err) { paneel.textContent = err.message; }
  }
  paneel.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-pr]'); if (!f) return;
    ev.preventDefault(); if (bezig) return;
    const b = Object.fromEntries(new FormData(f)), soort = f.dataset.pr;
    if ('bedrag' in b) { b.bedragMinor = Math.round(Number(b.bedrag)*10**(stand.profiel?.decimalen ?? 2)); delete b.bedrag; }
    if (soort === 'inrichten') { b.versie = stand.profiel?.versie || 0; b.land = b.land.toUpperCase(); b.valuta = b.valuta.toUpperCase(); }
    if (soort === 'stap') { b.projectId = f.dataset.project; b.stap = f.dataset.stap; b.versie = stand.werk.find(x => x.id === b.projectId).versie; }
    const afdruk = JSON.stringify(b);
    if (f._afdruk !== afdruk) { f._idem = crypto.randomUUID(); f._afdruk = afdruk; }
    b.idem = f._idem;
    bezig = true; const knop = f.querySelector('button[type=submit]'); knop.disabled = true;
    let uit = f.querySelector('[role=status]'); if (!uit) { uit = document.createElement('p'); uit.setAttribute('role','status'); f.append(uit); }
    uit.textContent = 'Bewaren…';
    try { await api(soort,b); concepten.delete(formulierSleutel(f)); bezig = false; await laad(); K.meld('Bewaard.'); }
    catch (err) { uit.textContent = err.message; }
    finally { bezig = false; knop.disabled = false; }
  });
  paneel.addEventListener('click', async ev => {
    const pagina = ev.target.closest('[data-pr-pagina]');
    if (pagina && !bezig) { offset = Number(pagina.dataset.prPagina); await laad(); return; }
    const k = ev.target.closest('[data-pr-deel],[data-pr-intrek]'); if (!k || bezig) return;
    const id = k.dataset.prDeel || k.dataset.prIntrek, x = stand.werk.find(w => w.id === id);
    const uit = k.closest('details').querySelector('.pr-uit'); bezig = true; k.disabled = true;
    try {
      const r = await api('delen', { projectId: id, versie: x.versie, intrekken: !!k.dataset.prIntrek, idem: crypto.randomUUID() });
      uit.textContent = '';
      if (r.link) {
        const a = document.createElement('a'); a.href = r.link; a.textContent = new URL(r.link,location.origin).href; a.className = 'pr-link';
        uit.append(a, document.createElement('br'), document.createTextNode(r.let + ' Geldig tot ' + new Date(r.verloopt).toLocaleString(document.documentElement.lang || navigator.language) + '.'));
      } else uit.textContent = 'Alle klantlinks voor deze afspraak zijn ingetrokken.';
    } catch (err) { uit.textContent = err.message; }
    finally { bezig = false; k.disabled = false; }
  });
  const begin = document.createElement('details'); begin.className = 'praktijk';
  begin.innerHTML = '<summary>Begin zonder bestaande software</summary><form id="prBegin">' + UI.veld('naam','Naam van uw organisatie') + UI.knop('Eigen werkruimte maken') + '<p role="status"></p></form>';
  document.querySelector('#inlog').prepend(begin);
  begin.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const f = ev.target, k = f.querySelector('button'), uit = f.querySelector('[role=status]'); if (k.disabled) return;
    k.disabled = true; f._idem = f._idem || crypto.randomUUID();
    try {
      const r = await K.api('/werkruimte/maak',{ naam:new FormData(f).get('naam'), idem:f._idem });
      if (!r.body.ok) throw new Error(r.body.error || 'De werkruimte is niet gemaakt.');
      K.bewaar(r.body.beheerToken ? { werkruimte:r.body.werkruimte, beheerToken:r.body.beheerToken } : { werkruimte:r.body.werkruimte });
      K.poort(); await laad(); window.RTGWerkStart.laad();
    } catch (err) { uit.textContent = err.message; } finally { k.disabled = false; }
  });
  window.RTGPraktijk = { laad };
  laad();
})();
