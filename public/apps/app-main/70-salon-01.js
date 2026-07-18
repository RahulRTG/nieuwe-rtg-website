  /* ---------- salon ---------- */

  // De publieke Salon-etalage van een partner: bio, foto's, folders, deals, polls
  async function openEtalage(code){
    let d;
    try { d = await API.call('/salon/profiel', { code }); } catch(e){ toast(e.message); return; }
    const p = d.partner;
    await laadBetaalVerzoeken();
    const vz = betaalVerzoeken.filter(v => v.supplierCode === code);
    const kanBetalen = user && user.tier !== 'guest';
    let ov = document.getElementById('etalage-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'etalage-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    const eur2 = n => '€ ' + Number(n||0).toLocaleString('nl-NL');
    const items = d.items || [];
    const html =
      '<div style="width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);">' +
      '<div style="position:relative;">' +
        (p.foto ? '<img src="' + p.foto + '" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:20px 20px 0 0;">' : '<div style="height:80px;"></div>') +
        '<button id="etaClose" style="position:absolute;top:0.7rem;right:0.7rem;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:999px;width:34px;height:34px;font-size:1rem;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="padding:1rem 1.1rem 1.4rem;">' +
        '<div style="display:flex;align-items:center;gap:0.6rem;"><b style="font-size:1.1rem;font-family:\'Bodoni Moda\',serif;">' + escT(p.name) + '</b>' +
          '<button id="etaVolg" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.3rem 0.9rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button></div>' +
        '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">' + (p.icon ? p.icon + ' ' : '') + escT(p.typeLabel || '') + ' · ' + escT(p.city || '') + ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') + '</div>' +
        (p.bio ? '<div style="font-size:0.86rem;margin-top:0.6rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
        (kanBetalen ? '<button id="etaBetaal" class="mo-pay" style="width:100%;justify-content:center;margin-top:0.8rem;padding:0.7rem;">' + FID_MINI + T('dp.betaaldirect','Betaal direct met Face ID') + '</button>' : '') +
        (vz.length ? '<div style="margin-top:0.8rem;">' + vz.map(v =>
          '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.5rem;background:var(--card);">' +
          '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">' + FID_MINI + T('dp.verzoek','Betaalverzoek') + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.3rem;"><span style="font-size:0.85rem;">' + escT(v.omschrijving || '') + '</span><b style="color:var(--gold);white-space:nowrap;">' + eur2((v.bedrag||0)/100) + '</b></div>' +
          '<button class="mo-pay js-vzpay" data-vz="' + v.ref + '" style="width:100%;justify-content:center;margin-top:0.5rem;padding:0.6rem;">' + FID_MINI + T('dp.betaalverzoek','Betaal dit verzoek') + '</button></div>').join('') + '</div>' : '') +
        (items.length
          ? items.map(it =>
            '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.7rem;">' +
            '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">' + (it.soort === 'folder' ? '📖 ' + T('sal.folder','Folder') : it.soort === 'deal' ? '🎁 ' + T('sal.deal','Aanbieding') : it.soort === 'poll' ? '📊 Poll' : '📣 ' + T('sal.bericht','Bericht')) + '</div>' +
            (it.folder ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.folder.titel) + '</div>' +
              ((it.folder.fotos && it.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.45rem;">' + it.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:90px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
              ((it.folder.items && it.folder.items.length) ? '<div style="margin-top:0.45rem;display:grid;gap:0.2rem;">' + it.folder.items.map(x => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(x.naam) + '</span>' + (x.prijs != null ? '<span style="color:var(--gold);">' + eur2(x.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '')
              : (it.deal ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.deal.titel) + (it.deal.mijnCode ? ' · <span style="color:var(--gold);">' + it.deal.mijnCode + '</span>' : '') + '</div>'
              : '<div style="font-size:0.85rem;margin-top:0.2rem;">' + escT(it.text || '') + '</div>')) +
            '</div>').join('')
          : '<div style="text-align:center;color:var(--soft);font-size:0.82rem;padding:1.4rem 0;">' + T('sal.etaleeg','Nog geen folders of aanbiedingen.') + '</div>') +
      '</div></div>';
    ov.innerHTML = html;
    ov.querySelector('#etaClose').addEventListener('click', () => ov.remove());
    ov.querySelector('#etaVolg').addEventListener('click', async () => {
      try { await API.call('/salon/volg', { code }); await refreshState(); renderSalon(); openEtalage(code); } catch(e){ toast(e.message); }
    });
    const eb = ov.querySelector('#etaBetaal');
    if (eb) eb.addEventListener('click', () => { ov.remove(); betaalPartner(code, p.name, { bron: 'salon' }); });
    ov.querySelectorAll('.js-vzpay').forEach(b => b.addEventListener('click', () => {
      const v = vz.find(x => x.ref === b.dataset.vz); if (!v) return;
      ov.remove(); betaalVerzoekPay(v);
    }));
  }

  function renderSalon(){
    const isGuest = user && user.tier === 'guest';
    // RTG Zakelijk: de ingang staat aan voor de Lifestyle en Business Pass
    const zakL = $('#zakLauncher');
    if (user && (user.tier === 'business' || user.tier === 'lifestyle')){
      zakL.style.display = 'block';
      zakL.innerHTML = '<button id="zakOpenBtn" style="display:flex;align-items:center;gap:0.7rem;width:100%;text-align:left;background:none;border:1px solid var(--gold);border-radius:14px;padding:0.75rem 1rem;margin-bottom:0.8rem;color:var(--txt);font-family:inherit;cursor:pointer;">' +
        '<span style="font-size:1.2rem;">💼</span><span style="flex:1;"><b style="font-size:0.85rem;">' + T('zak.h','RTG Zakelijk') + '</b>' +
        '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('zak.launch','Uw professionele netwerk: profiel, gids, feed en aanbevelingen.') + '</span></span>' +
        '<span style="color:var(--gold);">›</span></button>';
      $('#zakOpenBtn').addEventListener('click', zakOpen);
    } else { zakL.style.display = 'none'; }
    $('#feed').innerHTML = posts.map(p => {
      const engage = canEngage(p);
      // gratis gebruikers (zonder pas) liken/reageren niet bij particulieren
      const mayLike = !(isGuest && !p.partner);
      const visual = p.photo
        ? '<div class="visual"><img src="' + p.photo + '" alt=""><span class="place">' + escT(p.place) + '</span></div>'
        : '<div class="visual ' + (p.visual || 'v-partner') + '"><span class="place">' + escT(p.place) + '</span></div>';
      // partners posten zonder wachttijd: hun bericht staat er direct, met
      // tijdstempel; de 7-dagen-privacyregel geldt alleen voor ledenposts
      const meta = p.partner
        ? TIER_LABEL.partner + ' · ' + p.place + ' · ' + (p.at ? timeAgo(p.at) : T('app.salon.direct','direct geplaatst'))
        : TIER_LABEL[p.tier] + ' · ' + p.place + ' · ' + T('app.salon.7days','7 dagen na verblijf');
      // bedrijfslaag: volg-knop, exclusieve aanbieding en poll
      const volg = p.partnerCode
        ? '<button class="js-volg" data-code="' + p.partnerCode + '" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.25rem 0.75rem;font-size:0.66rem;font-weight:600;font-family:inherit;flex-shrink:0;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button>'
        : '';
