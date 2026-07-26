
  /* ---- het salongesprek: jouw Rahul kletst met die van je vriend ----

     Een gimmick, en zo staat het er ook. De knop zit in de kop van de DM,
     want daar zit je al met precies die ene persoon.

     Twee dingen die hier bewust in het scherm staan en niet alleen in de
     server: de schakelaar (standaard uit) en de zin dat alle plekken
     verzonnen zijn. Wie niet weet dat er iets over zijn dag verteld wordt,
     heeft geen keuze gemaakt, en dan is "aan" geen toestemming. */
  let kletsAan = false;

  async function kletsLaad(){
    try {
      const d = await API.call('/klets', {});
      kletsAan = !!d.aan;
      return d;
    } catch(e){ return { aan: false, gesprekken: [], uitleg: '' }; }
  }

  function kletsTekenLeeg(d){
    $('#kletsBody').innerHTML =
      '<p class="stil" style="font-size:.82rem;color:var(--soft);line-height:1.6;">' + escT(d.uitleg || '') + '</p>' +
      '<label style="display:flex;gap:.6rem;align-items:flex-start;margin:.9rem 0;font-size:.85rem;">' +
        '<input type="checkbox" id="kletsSchakel"' + (kletsAan ? ' checked' : '') + ' style="margin-top:.2rem;">' +
        '<span>Rahul mag met de Rahul van mijn vrienden kletsen over hoe mijn dag was.' +
        '<br><span style="color:var(--soft);font-size:.78rem;">Uit te zetten wanneer je wilt. Zolang het uit staat, gebeurt er niets.</span></span>' +
      '</label>' +
      '<button class="knop" id="kletsGo"' + (kletsAan ? '' : ' disabled') + '>Laat ze kletsen</button>' +
      (d.gesprekken && d.gesprekken.length
        ? '<div style="margin-top:1rem;border-top:1px solid var(--line);padding-top:.8rem;">' +
          d.gesprekken.slice(0, 8).map(g =>
            '<button class="klets-eerder" data-klets="' + escT(g.id) + '" style="display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:.5rem 0;font:inherit;cursor:pointer;">' +
            '<b style="font-size:.78rem;color:var(--gold);">' + escT(g.metCodenaam) + '</b>' +
            '<span style="display:block;font-size:.82rem;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escT(g.eerste) + '</span></button>'
          ).join('') + '</div>'
        : '');
    const schakel = $('#kletsSchakel');
    if (schakel) schakel.addEventListener('change', async () => {
      try { const r = await API.call('/klets/zet', { aan: schakel.checked }); kletsAan = !!r.aan; $('#kletsGo').disabled = !kletsAan; }
      catch(e){ toast(e.message); schakel.checked = kletsAan; }
    });
    const go = $('#kletsGo');
    if (go) go.addEventListener('click', kletsStart);
    $('#kletsBody').querySelectorAll('[data-klets]').forEach(b => b.addEventListener('click', async () => {
      try { kletsToon(await API.call('/klets/gesprek', { id: b.dataset.klets })); } catch(e){ toast(e.message); }
    }));
  }

  function kletsToon(g){
    $('#kletsBody').innerHTML =
      '<div class="klets-draad">' + (g.beurten || []).map(b =>
        '<div class="dm-m' + (b.mij ? ' mine' : '') + '">' + escT(b.tekst) + '</div>').join('') + '</div>' +
      '<p style="font-size:.75rem;color:var(--soft);line-height:1.6;margin-top:.9rem;">' + escT(g.noot || '') +
      (g.echt ? '' : ' Dit is een demogesprek: er staat geen AI-sleutel ingesteld.') + '</p>' +
      '<button class="knop" id="kletsTerug" style="margin-top:.7rem;">Terug</button>';
    const t = $('#kletsTerug');
    if (t) t.addEventListener('click', async () => kletsTekenLeeg(await kletsLaad()));
  }

  async function kletsStart(){
    if (!dmWith) return;
    const go = $('#kletsGo');
    if (go) { go.disabled = true; go.textContent = 'Ze zijn bezig...'; }
    try { kletsToon(await API.call('/klets/start', { vriend: dmWith })); }
    catch(e){ toast(e.message); if (go) { go.disabled = false; go.textContent = 'Laat ze kletsen'; } }
  }

  async function kletsOpen(){
    if (!dmWith) return;
    $('#kletsNaam').textContent = dmNaam || '';
    $('#klets-sheet').classList.add('open'); $('#klets-scrim').classList.add('open');
    $('#kletsBody').innerHTML = '<p style="color:var(--soft);font-size:.85rem;">Laden...</p>';
    kletsTekenLeeg(await kletsLaad());
  }
  const kletsDicht = () => { $('#klets-sheet').classList.remove('open'); $('#klets-scrim').classList.remove('open'); };
  if ($('#dmKlets')) $('#dmKlets').addEventListener('click', kletsOpen);
  if ($('#kletsClose')) $('#kletsClose').addEventListener('click', kletsDicht);
  if ($('#klets-scrim')) $('#klets-scrim').addEventListener('click', kletsDicht);
