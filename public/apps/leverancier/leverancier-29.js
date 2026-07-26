    if (canEdit) h += '<div class="card" style="border-color:var(--gold);"><div class="tt-h">\u2728 '+T('onb.ai','Aanpassen met AI')+'</div>'+
      '<p class="sub">'+T('onb.ai.s','Beschrijf in gewone taal wat u wilt. Bijv. "voeg het veld BSN toe" of "zet in het contract dat annuleren tot 24 uur vooraf kan".')+'</p>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="onbAiIn" class="st-in" style="flex:1;" placeholder="'+T('onb.ai.ph','Wat wilt u aanpassen?')+'"><button class="obtn primary" id="onbAiGo">'+T('onb.ai.go','Aanpassen')+'</button></div>'+
      '<div id="onbAiUit" class="sub" style="margin-top:0.5rem;"></div></div>';
    h += '<div class="card"><div class="tt-h">\ud83d\udccb '+T('onb.velden','Verplichte gegevens')+'</div>'+
      c.velden.map(v => '<div class="st-row"><span>'+esc(v.label)+'<span class="sub">'+esc(v.type)+' \u00b7 '+(v.voorWie||[]).map(w=>ONB_WIE[w]||w).join(', ')+'</span></span></div>').join('')+'</div>';
    h += '<div class="card"><div class="tt-h">\ud83d\udcc4 '+esc(c.contract.titel)+' <span class="sub">v'+c.contract.versie+'</span></div>'+
      '<div style="max-height:15rem;overflow:auto;white-space:pre-wrap;font-size:0.8rem;line-height:1.6;color:var(--soft);margin-top:0.4rem;">'+esc(c.contract.tekst)+'</div></div>';
    h += '<div class="card"><div class="tt-h">\u270d\ufe0f '+T('onb.get','Ondertekend')+' ('+cnt.length+')</div>'+
      (cnt.length ? cnt.slice(0,30).map(o=>'<div class="st-row"><span>'+esc(o.naam)+'<span class="sub">v'+o.versie+' \u00b7 '+new Date(o.at).toLocaleDateString('nl-NL')+'</span></span></div>').join('') : '<p class="sub">'+T('onb.niemand','Nog niemand heeft getekend.')+'</p>')+'</div>';
    el.innerHTML = h;
    const go = $('#onbAiGo'); if (go) go.addEventListener('click', async () => {
      const opdracht = (($('#onbAiIn')||{}).value || '').trim();
      if (opdracht.length < 3){ toast(T('onb.ai.kort','Beschrijf iets uitgebreider.')); return; }
      go.disabled = true; $('#onbAiUit').textContent = T('onb.ai.bezig','Bezig...');
      try { const r = await API.call('/supplier/onboarding/ai', { opdracht }); onbCfg = { config: r.config, ondertekenaars: cnt }; renderOnbCfg(); toast('\u2728 ' + (r.uitleg || T('onb.klaar','Aangepast.'))); }
      catch(e){ $('#onbAiUit').textContent = e.message; go.disabled = false; }
    });
  }
  function renderContracten(){
    const el = $('#contractWrap'); if (!el) return;
    if (contracten === null){ el.innerHTML = '<div class="empty">\u2026</div>'; laadContracten(); return; }
    const canEdit = actor().manager;
    let html = '';
    html += '<div class="card"><div class="tt-h">'+T('ct.lijst','Contracten')+' ('+contracten.length+')</div>'+
      (contracten.length ? contracten.map(c => {
        const ontv = c.partij.kind === 'lid' ? c.partij.codename : c.partij.naam;
        const zaakGetekend = !!c.tekenZaak, partijGetekend = !!c.tekenPartij;
        const magZaakTekenen = canEdit && !zaakGetekend && c.status !== 'geweigerd';
        const magIkTekenen = !partijGetekend && c.partij.kind === 'staff' && c.status !== 'geweigerd' && !canEdit;
        return '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.titel)+'</span><span class="pr" style="font-size:0.7rem;">'+T('ct.st.'+c.status, CON_ST[c.status]||c.status)+'</span></div>'+
          '<div class="ds">'+T('ct.soort.'+c.soort, c.soort)+' \u00B7 '+esc(ontv)+' \u00B7 '+(zaakGetekend?'\u2705':'\u25CB')+' '+T('ct.zaak','zaak')+' / '+(partijGetekend?'\u2705':'\u25CB')+' '+T('ct.partij','ontvanger')+'</div>'+
          (c.velden && c.velden.length ? '<div class="ds">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
          '<details style="margin-top:0.3rem;"><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">'+T('ct.tekst','Voorwaarden')+'</summary><div style="font-size:0.78rem;color:var(--muted);white-space:pre-wrap;margin-top:0.3rem;">'+esc(c.tekst)+'</div></details>'+
          ((magZaakTekenen||magIkTekenen)?'<div style="margin-top:0.5rem;"><button class="obtn primary" data-cteken="'+c.ref+'">'+T('ct.teken','Onderteken')+'</button></div>':'')+
          '</div>';
      }).join('') : '<div class="empty">'+T('ct.geen','Nog geen contracten.')+'</div>')+'</div>';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">'+T('ct.nieuw','Nieuw contract')+'</div>'+
        '<div class="field"><label>'+T('ct.f.soort','Soort')+'</label><select id="ctSoort" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="verhuur">'+T('ct.soort.verhuur','Verhuur')+'</option><option value="personeel">'+T('ct.soort.personeel','Personeel')+'</option><option value="algemeen">'+T('ct.soort.algemeen','Algemeen')+'</option></select></div>'+
        '<div class="field"><label>'+T('ct.f.ontv','Voor wie')+'</label><select id="ctOntv" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"><option value="lid">'+T('ct.f.lid','Een lid (codenaam)')+'</option><option value="staff">'+T('ct.f.staff','Een personeelslid')+'</option></select></div>'+
        '<div class="field" id="ctLidVeld"><label>'+T('ct.f.code','Codenaam van het lid')+'</label><input id="ctCode" placeholder="'+T('ct.f.codeph','Bijv. Zilveren Valk 12')+'"></div>'+
        '<div class="field" id="ctStaffVeld" style="display:none;"><label>'+T('ct.f.wie','Personeelslid')+'</label><select id="ctStaff" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"></select></div>'+
        '<div class="field"><label>'+T('ct.f.titel','Titel')+'</label><input id="ctTitel" placeholder="'+T('ct.f.titelph','Bijv. Huurovereenkomst')+'"></div>'+
        '<div class="field"><label>'+T('ct.f.tekst','Voorwaarden')+'</label><textarea id="ctTekst" rows="4" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;" placeholder="'+T('ct.f.tekstph','De afspraken en voorwaarden\u2026')+'"></textarea></div>'+
        '<button class="obtn primary" id="ctMaak">'+T('ct.f.maak','Contract versturen')+'</button></div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-cteken]').forEach(k => k.addEventListener('click', async () => {
      const naam = prompt(T('ct.tekenvraag','Typ uw naam om digitaal te ondertekenen:'));
      if (!naam) return;
      try { await API.call('/supplier/contract/teken', { ref: k.dataset.cteken, naam, akkoord: true }); toast(T('ct.tekenok','Ondertekend.')); await laadContracten(); openTab('contract'); } catch(e){ toast(e.message); }
    }));
    const ontvSel = document.getElementById('ctOntv');
    if (ontvSel){
      const staffSel = document.getElementById('ctStaff');
      if (staffSel) staffSel.innerHTML = (Array.isArray(state.team) ? state.team : []).map(m => '<option value="'+m.id+'">'+esc(m.name)+' ('+esc(m.func||m.role||'')+')</option>').join('');
      ontvSel.addEventListener('change', () => {
        document.getElementById('ctLidVeld').style.display = ontvSel.value === 'lid' ? '' : 'none';
        document.getElementById('ctStaffVeld').style.display = ontvSel.value === 'staff' ? '' : 'none';
      });
    }
    const maak = document.getElementById('ctMaak');
    if (maak) maak.addEventListener('click', async () => {
      const soort = $('#ctSoort').value, ontv = $('#ctOntv').value;
      const body = { soort, titel: $('#ctTitel').value, tekst: $('#ctTekst').value };
      if (ontv === 'staff') body.staffId = $('#ctStaff') ? $('#ctStaff').value : null;
      else body.codenaam = $('#ctCode').value;
      try { await API.call('/supplier/contract/maak', body); toast(T('ct.maakok','Contract verstuurd; de ontvanger tekent in de app.')); await laadContracten(); openTab('contract'); } catch(e){ toast(e.message); }
    });
  }

  // ---- boerderij: de slimme boer-backoffice (percelen, dieren, taken, AI) ----
  let boer = null;
  const FASE_LBL = { 'leeg':'leeg', 'gezaaid':'net gezaaid', 'groeit':'groeit', 'te-oogsten':'oogstklaar', 'geoogst':'geoogst' };
  const FASE_KL = { 'te-oogsten':'#7EE0A3', 'groeit':'var(--gold)', 'gezaaid':'#8FB8D8', 'geoogst':'var(--soft)', 'leeg':'var(--soft)' };
  const URG_KL = { 'hoog':'#E0736A', 'midden':'var(--gold)', 'laag':'var(--soft)' };
  async function laadBoerderij(){
    if (!has('boerderij') || !API.live) return;
    try { boer = await API.call('/supplier/boerderij/overzicht', {}); } catch(e){ boer = null; }
    renderBoerderij();
  }
  function boerToe(r){ if (r && r.overzicht){ boer = r.overzicht; } else if (r && r.percelen){ boer = r; } renderBoerderij(); }
  function renderBoerderij(){
    const el = $('#boerWrap'); if (!el) return;
    if (!has('boerderij')){ el.innerHTML = ''; return; }
    if (!boer){ el.innerHTML = '<div class="empty">…</div>'; laadBoerderij(); return; }
    const canEdit = actor().manager;
