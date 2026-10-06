/* De Salon: de etalage van een partner en de tijdlijn. Stond in ./app-main-56.js,
   samen met het zegel en de scanknop -- drie onderwerpen in een bestand, wat de
   omvangregel van de keuring aanwees zodra RTG Scan er inhoud bij kreeg. */
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
      ov.className = 'salon-etalage';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    const eur2 = n => '€ ' + Number(n||0).toLocaleString(lang());
    const items = d.items || [];
    const html =
      '<div class="salon-etalage-blad" >' +
      '<div class="salon-etalage-beeld" >' +
        (p.foto ? '<img src="' + p.foto + '" alt="" class="salon-etalage-foto" >' : '<div class="salon-etalage-zonder-foto" ></div>') +
        '<button id="etaClose" class="salon-etalage-sluit" >✕</button>' +
      '</div>' +
      '<div class="salon-etalage-inhoud" >' +
        '<div class="salon-etalage-kop" ><b class="salon-etalage-naam" >' + escT(p.name) + '</b>' +
          '<button id="etaVolg" class="salon-etalage-volg' + (p.volgIk ? ' volgt' : '') + '">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button></div>' +
        '<div class="salon-etalage-meta" >' + (p.icon ? p.icon + ' ' : '') + escT(p.typeLabel || '') + ' · ' + escT(p.city || '') + ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') + '</div>' +
        (p.bio ? '<div class="salon-etalage-bio" >' + escT(p.bio) + '</div>' : '') +
        (kanBetalen ? '<button id="etaBetaal" class="mo-pay salon-etalage-betaal" >' + FID_MINI + T('dp.betaaldirect','Betaal direct met Face ID') + '</button>' : '') +
        (vz.length ? '<div class="h-mt80">' + vz.map(v =>
          '<div class="salon-etalage-verzoek" >' +
          '<div class="salon-etalage-soort" >' + FID_MINI + T('dp.verzoek','Betaalverzoek') + '</div>' +
          '<div class="salon-etalage-bedragrij" ><span class="salon-etalage-omschrijving" >' + escT(v.omschrijving || '') + '</span><b class="salon-etalage-bedrag" >' + eur2((v.bedrag||0)/100) + '</b></div>' +
          '<button class="mo-pay js-vzpay salon-etalage-betaalverzoek" data-vz="' + v.ref + '" >' + FID_MINI + T('dp.betaalverzoek','Betaal dit verzoek') + '</button></div>').join('') + '</div>' : '') +
        (items.length
          ? items.map(it =>
            '<div class="salon-etalage-item" >' +
            '<div class="salon-etalage-soort" >' + (it.soort === 'folder' ? '' + T('sal.folder','Folder') : it.soort === 'deal' ? '' + T('sal.deal','Aanbieding') : it.soort === 'poll' ? 'Poll' : '' + T('sal.bericht','Bericht')) + '</div>' +
            (it.folder ? '<div class="salon-etalage-titel" >' + escT(it.folder.titel) + '</div>' +
              ((it.folder.fotos && it.folder.fotos.length) ? '<div class="salon-etalage-fotos" >' + it.folder.fotos.map(f => '<img src="' + f + '" alt="" class="salon-etalage-folderfoto" >').join('') + '</div>' : '') +
              ((it.folder.items && it.folder.items.length) ? '<div class="salon-etalage-producten" >' + it.folder.items.map(x => '<div class="salon-etalage-product" ><span>' + escT(x.naam) + '</span>' + (x.prijs != null ? '<span class="h-leesgoud">' + eur2(x.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '')
              : (it.deal ? '<div class="salon-etalage-titel" >' + escT(it.deal.titel) + (it.deal.mijnClaim ? ' · <span class="h-leesgoud">' + escT(it.deal.mijnClaim.status || '') + '</span>' : '') + '</div>'
              : '<div class="salon-etalage-bericht" >' + escT(it.text || '') + '</div>')) +
            '</div>').join('')
          : '<div class="salon-etalage-leeg" >' + T('sal.etaleeg','Nog geen folders of aanbiedingen.') + '</div>') +
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
