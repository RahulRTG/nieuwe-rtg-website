        const veld = (label, id, val, ph) => '<div class="field"><label>' + label + '</label><input id="' + id + '" value="' + escT(val || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
        body.innerHTML =
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.6rem;line-height:1.5;">' + T('zak.uitleg','Uw profiel is pas zichtbaar in de gids als u het bewaart. U kiest zelf welke naam u zakelijk gebruikt.') + '</div>' +
          (d.cvSuggestie ? '<button id="zakUitCv" class="zak-chip klik" style="margin-top:0.5rem;">' + T('zak.uitcv','Vul aan vanuit mijn RTG-cv') + '</button>' : '') +
          veld(T('zak.naam','Professionele naam'), 'zakNaam', p.naam, T('zak.naamph','Standaard: uw codenaam')) +
          veld(T('zak.kop','Kop'), 'zakKop', p.kop, T('zak.kopph','Bijv. Oprichter, Fotograaf, Jurist')) +
          veld(T('zak.sector','Sector'), 'zakSector', p.sector) +
          veld(T('zak.plaats2','Plaats'), 'zakPlaats', p.plaats) +
          '<div class="field"><label>' + T('zak.bio','Over u') + '</label><textarea id="zakBio" style="min-height:70px;">' + escT(p.bio || '') + '</textarea></div>' +
          veld(T('zak.skills','Vaardigheden (komma’s)'), 'zakSkills', (p.vaardigheden || []).map(v => v.naam).join(', ')) +
          '<div class="field"><label>' + T('zak.erv','Ervaring (een regel per rol)') + '</label><textarea id="zakErv" style="min-height:80px;">' + escT((p.ervaring || []).join('\n')) + '</textarea></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.4rem;"><input type="checkbox" id="zakOpenWerk"' + (p.openVoorWerk ? ' checked' : '') + '> ' + T('zak.openwerk','Open voor werk of opdrachten') + '</label>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.3rem;"><input type="checkbox" id="zakZicht"' + (d.zichtbaar !== false ? ' checked' : '') + '> ' + T('zak.zicht','Zichtbaar in de gids') + '</label>' +
          '<button class="ms-order" id="zakBewaar" style="margin-top:0.8rem;width:100%;">' + T('zak.bewaar','Bewaar mijn profiel') + '</button>';
        if (d.cvSuggestie) $('#zakUitCv').addEventListener('click', () => {
          const s = d.cvSuggestie;
          if (!$('#zakKop').value && s.kop) $('#zakKop').value = s.kop;
          if (!$('#zakSkills').value && s.vaardigheden.length) $('#zakSkills').value = s.vaardigheden.join(', ');
          if (!$('#zakErv').value && s.ervaring.length) $('#zakErv').value = s.ervaring.join('\n');
          if (!$('#zakBio').value && s.bio) $('#zakBio').value = s.bio;
          toast(T('zak.cvok','Aangevuld vanuit uw cv. Controleer en bewaar.'));
        });
        $('#zakBewaar').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/profiel/zet', {
              naam: $('#zakNaam').value, kop: $('#zakKop').value, sector: $('#zakSector').value,
              plaats: $('#zakPlaats').value, bio: $('#zakBio').value,
              vaardigheden: $('#zakSkills').value.split(',').map(s => s.trim()).filter(Boolean),
              ervaring: $('#zakErv').value.split('\n').map(s => s.trim()).filter(Boolean),
              openVoorWerk: $('#zakOpenWerk').checked, zichtbaar: $('#zakZicht').checked
            });
            toast(T('zak.bewaard','Profiel bewaard.'));
          } catch(e){ toast(e.message); }
        });
      }
    } catch(e){
      body.innerHTML = '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + escT(e.message) + '</div>';
    }
  }

  /* ---------- interactieve AI-agenda in de backoffice + ballon op boBtn ---------- */
  let memberAgenda = null;
  function agendaBadgeLid(n){
    const btn = document.getElementById('boBtn'); if (!btn) return;
    btn.style.position = 'relative';
    let b = btn.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); btn.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#E0736A;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaLid(){ if (!API.live || !API.token) return; try { memberAgenda = await API.call('/agenda/mijn-lijst', {}); } catch(e){ return; } agendaBadgeLid(memberAgenda.telling || 0); }
  function agendaToeLid(r){ if (r && r.items){ memberAgenda = r; agendaBadgeLid(r.telling || 0); } renderAgendaLid(); }
  function renderAgendaLid(){
    const el = document.getElementById('boAgendaCard'); if (!el) return;
    if (!memberAgenda){ el.innerHTML = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('ag.titel','Agenda') + '</b><div class="fineprint">…</div></div>'; laadAgendaLid().then(renderAgendaLid); return; }
    const o = memberAgenda, items = o.items || [];
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('ag.titel','Agenda') + (o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'') + '</b>';
    h += items.length ? items.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.45rem;opacity:'+(i.gedaan?'0.55':'1')+';"><span>'+(i.gedaan?'✓ ':'')+esc(i.titel)+'<span style="color:var(--muted);"> · '+esc(dagLbl(i.datum))+(i.tijd?' '+esc(i.tijd):'')+'</span></span><span style="white-space:nowrap;">'+(!i.gedaan?'<button class="ag-done" data-agdone="'+i.id+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">✓</button> ':'')+'<button class="ag-del" data-agdel="'+i.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></span></div>').join('') : '<div class="fineprint" style="margin-top:0.4rem;">'+T('ag.leeg','Nog niets gepland. Typ het of laat de AI het inplannen.')+'</div>';
    h += '<div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="agLidTitel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:7rem;"><input id="agLidDatum" type="date" '+inp+'><input id="agLidTijd" type="time" '+inp+'><button id="agLidAdd" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">+</button></div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div style="font-size:0.68rem;color:var(--soft);margin-bottom:0.3rem;">'+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="agLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="agLidAiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button id="agLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('ag.plan','Plan')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-agdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/wijzig', { id: b.dataset.agdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-agdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/verwijder', { id: b.dataset.agdel })); } catch(e){ toast(e.message); } }));
    const add = document.getElementById('agLidAdd'); if (add) add.addEventListener('click', async () => { const titel = document.getElementById('agLidTitel').value.trim(); const datum = document.getElementById('agLidDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeLid(await API.call('/agenda/toevoegen', { titel, datum, tijd: document.getElementById('agLidTijd').value })); } catch(e){ toast(e.message); } });
