/* RTG Meldkamer: het werkscherm van de zes hulpdienst-korpsen. Inloggen op
   naam met PIN (personeelslogin van de zaak), daarna het bord: meldingen
   aannemen en toewijzen, eenheden over land, water en door de lucht,
   bijstand, het beddenbord van het ziekenhuis, de consulten van de
   huisarts, en de meldkamer-AI. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let token = '';
  try { token = sessionStorage.getItem('rtg_meldkamer_token') || ''; } catch (e) {}
  let korps = null;

  async function api(pad, body) {
    const r = await fetch('/api/supplier/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {})
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
    return d;
  }

  /* ---------- aanmelden ---------- */
  $('#lZoek').addEventListener('click', async () => {
    $('#lFout').textContent = '';
    try {
      const d = await api('roster', { code: $('#lCode').value.trim().toUpperCase() });
      $('#lWie').innerHTML = d.staff.map(m => '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.func || m.role) + ')</option>').join('');
      $('#lWieRij').hidden = false;
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lIn').addEventListener('click', async () => {
    $('#lFout').textContent = '';
    try {
      const d = await api('login', { code: $('#lCode').value.trim().toUpperCase(), staffId: Number($('#lWie').value), pin: $('#lPin').value });
      token = d.token;
      try { sessionStorage.setItem('rtg_meldkamer_token', token); } catch (e) {}
      start();
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lPin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lIn').click(); });

  /* ---------- het bord ---------- */
  async function laad() {
    let d;
    try {
      d = await api('hulp/overzicht');
    } catch (e) {
      // de zorg-zaken (apotheek, specialist, beauty medical) hebben geen
      // meldkamer; zij draaien alleen op het zorg-bord hieronder
      d = null;
    }
    document.querySelectorAll('#kMeldkamer, #kEenheden, #kAi').forEach(el => { el.hidden = !d; });
    await laadZorg(d);
    if (!d) return;
    korps = d;
    $('#titel').textContent = '🚨 ' + d.korps.naam;
    $('#wie').textContent = d.korps.label;
    // special forces nemen zelf niets aan; hun werk komt via bijstand binnen
    $('#rNieuw').hidden = ['specials', 'ziekenhuis', 'huisarts'].includes(d.korps.soort);
    const alle = [...(d.bijstand || []).map(m => ({ ...m, viaBijstand: true })), ...(d.meldingen || [])];
    $('#meldingen').innerHTML = alle.length ? alle.map(m => {
      const vrij = (d.eenheden || []).filter(e => e.status === 'vrij');
      const kanWijzen = m.status !== 'afgerond';
      return '<div class="melding"><span class="prio p' + m.prio + '">P' + m.prio + '</span><b>' + esc(m.tekst) + '</b>' +
        (m.plek ? ' · ' + esc(m.plek) : '') + ' · ' + esc(m.status) + (m.viaBijstand ? ' · <span style="color:var(--gold);">bijstandsverzoek</span>' : '') +
        '<div class="rij">' +
        (kanWijzen && vrij.length ? '<select data-wijs-e="' + m.id + '">' + vrij.map(e => '<option value="' + e.id + '">' + esc(e.naam) + ' (' + e.soort + ')</option>').join('') + '</select>' +
          '<button class="knop klein" data-wijs="' + m.id + '" type="button">Stuur</button>' : '') +
        (kanWijzen ? '<button class="knop klein" data-status="ter-plaatse" data-m="' + m.id + '" type="button">Ter plaatse</button>' +
          '<button class="knop klein" data-status="afgerond" data-m="' + m.id + '" type="button">Rond af</button>' : '') +
        (!m.viaBijstand && kanWijzen && (d.korpsen || []).length ? '<select data-bij-k="' + m.id + '">' + d.korpsen.map(k => '<option value="' + k.code + '">' + esc(k.naam) + '</option>').join('') + '</select>' +
          '<button class="knop klein" data-bij="' + m.id + '" type="button">Vraag bijstand</button>' : '') +
        '</div>' +
        '<div class="log">' + (m.logboek || []).slice(-3).map(l => esc(l.wat)).join(' · ') + '</div></div>';
    }).join('') : '<p class="stil">Geen meldingen op het bord.</p>';
    $('#eenheden').innerHTML = (d.eenheden || []).map(e =>
      '<span class="eenheid ' + e.status + '">' + esc(e.naam) + ' · ' + e.soort + ' · ' + e.status +
      (e.status === 'vrij' ? ' <button class="knop klein" data-ezet="buiten-dienst" data-e="' + e.id + '" type="button">buiten dienst</button>'
        : e.status === 'buiten-dienst' ? ' <button class="knop klein" data-ezet="vrij" data-e="' + e.id + '" type="button">weer vrij</button>' : '') +
      '</span>').join('') || '<span class="stil">Nog geen eenheden; zet ze hieronder op het bord.</span>';
    // de kaarten per soort korps
    $('#kZiekenhuis').hidden = d.korps.soort !== 'ziekenhuis';
    if (d.bedden) {
      $('#bedden').textContent = 'Bedden: ' + d.bedden.bezet + ' bezet van ' + d.bedden.totaal + '.';
      $('#opnames').innerHTML = (d.opnames || []).map(o =>
        '<div class="melding">' + esc(o.triage) + ' · van ' + esc(o.van) + ' · ' + esc(o.status) +
        (o.status === 'aangekondigd' ? '<div class="rij"><button class="knop klein" data-op="opgenomen" data-o="' + o.id + '" type="button">Neem op</button>' +
          '<button class="knop klein" data-op="geweigerd" data-o="' + o.id + '" type="button">Weiger</button></div>' :
          o.status === 'opgenomen' ? '<div class="rij"><button class="knop klein" data-op="ontslagen" data-o="' + o.id + '" type="button">Ontsla</button></div>' : '') +
        '</div>').join('') || '<p class="stil">Geen opnames aangekondigd.</p>';
    }
    $('#kOverdracht').hidden = !(d.ziekenhuizen && d.ziekenhuizen.length);
    if (d.ziekenhuizen) $('#oZiekenhuis').innerHTML = d.ziekenhuizen.map(z =>
      '<option value="' + z.code + '">' + esc(z.naam) + ' (' + z.bedden.bezet + '/' + z.bedden.totaal + ' bezet)</option>').join('');
    $('#kConsulten').hidden = d.korps.soort !== 'huisarts';
    if (d.consulten) $('#consulten').innerHTML = d.consulten.map(c =>
      '<div class="melding">' + esc(c.klacht) + ' · ' + esc(c.urgentie) + (c.wanneer ? ' · ' + esc(c.wanneer) : '') + ' · ' + esc(c.status) +
      (c.status === 'gepland' ? '<div class="rij"><button class="knop klein" data-cz="afgerond" data-c="' + c.id + '" type="button">Rond af</button>' +
        '<button class="knop klein" data-cz="verwezen" data-c="' + c.id + '" type="button">Verwijs door</button></div>' : '') +
      '</div>').join('') || '<p class="stil">Geen consulten gepland.</p>';
    bind();
  }
  /* ---------- het zorg-bord: recepten, SEH, verwijzingen, afspraken ---------- */
  const TRIAGE_KLEUR = { rood: 'var(--rood)', oranje: '#E08A3C', geel: 'var(--gold)', groen: 'var(--groen)', blauw: '#6FA8DC' };
  async function laadZorg(hulpBord) {
    let z = null;
    try { z = await api('zorg/overzicht'); } catch (e) { z = null; }
    ['#kReceptie', '#kSeh', '#kRecepten', '#kVoorschrijf', '#kVerwijs', '#kInbox', '#kAfspraken'].forEach(s => { $(s).hidden = true; });
    if (!z) return;
    if (!hulpBord) { $('#titel').textContent = '🩺 ' + z.zaak.naam; $('#wie').textContent = z.zaak.label; }
    if (z.receptie) {
      $('#kReceptie').hidden = false;
      $('#wachtkamer').innerHTML = z.receptie.length ? z.receptie.map(p =>
        '<div class="melding"><b>' + esc(p.aanduiding) + '</b>' + (p.reden ? ' · ' + esc(p.reden) : '') + ' · ' + esc(p.status) + (p.kamer ? ' (' + esc(p.kamer) + ')' : '') +
        '<div class="rij">' +
        (p.status === 'wacht' ? '<input class="veld" data-pkamer="' + p.id + '" placeholder="Kamer" maxlength="30" style="max-width:8rem;">' +
          '<button class="knop klein" data-proep="' + p.id + '" type="button">Roep op</button>' : '') +
        '<button class="knop klein" data-pklaar="' + p.id + '" type="button">Klaar</button></div></div>').join('')
        : '<p class="stil">De wachtkamer is leeg.</p>';
    }
    if (z.seh) {
      $('#kSeh').hidden = false;
      $('#sehRij').innerHTML = z.seh.length ? z.seh.map(p =>
        '<div class="melding"><span class="prio" style="color:' + TRIAGE_KLEUR[p.triage] + ';border-color:' + TRIAGE_KLEUR[p.triage] + ';">' + esc(p.triage) + '</span>' +
        esc(p.klacht) + ' · via ' + esc(p.via) + ' · ' + esc(p.status) +
        '<div class="rij"><button class="knop klein" data-seh="in-behandeling" data-p="' + p.id + '" type="button">In behandeling</button>' +
        '<button class="knop klein" data-seh="opgenomen" data-p="' + p.id + '" type="button">Neem op</button>' +
        '<button class="knop klein" data-seh="naar-huis" data-p="' + p.id + '" type="button">Naar huis</button></div></div>').join('')
        : '<p class="stil">De wachtkamer is leeg.</p>';
    }
    if (z.recepten) {
      $('#kRecepten').hidden = false;
      $('#recepten').innerHTML = z.recepten.length ? z.recepten.map(r =>
        '<div class="melding"><b>' + esc(r.middel) + '</b>' + (r.dosering ? ' · ' + esc(r.dosering) : '') + ' · van ' + esc(r.van) + ' · ' + esc(r.status) +
        (r.status !== 'uitgereikt' ? '<div class="rij"><button class="knop klein" data-rz="klaar" data-r="' + r.id + '" type="button">Zet klaar</button>' +
          '<button class="knop klein" data-rz="uitgereikt" data-r="' + r.id + '" type="button">Reik uit</button></div>' : '') +
        '</div>').join('') : '<p class="stil">Geen recepten in de rij.</p>';
    }
