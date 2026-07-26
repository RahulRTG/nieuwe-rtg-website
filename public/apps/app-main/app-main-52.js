    body.innerHTML = '<div style="color:var(--soft);font-size:0.8rem;padding:1rem 0;">…</div>';
    try {
      if (zakView === 'feed'){
        const d = await API.call('/zakelijk/feed');
        body.innerHTML =
          '<div class="zak-kaart"><textarea id="zakPostTekst" placeholder="' + T('zak.postph','Deel een inzicht, vraag of mijlpaal met het netwerk…') + '" style="width:100%;min-height:64px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;"></textarea>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.45rem;">' +
          '<span style="font-size:0.62rem;color:var(--soft);">' + (d.mijnProfiel ? T('zak.alsprof','U post onder uw professionele naam.') : T('zak.eerstprof','Maak eerst uw profiel aan (tab Mijn profiel).')) + '</span>' +
          '<button class="go" id="zakPost" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          (d.posts.length ? d.posts.map(x =>
            '<div class="zak-kaart"><div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="font-size:0.82rem;">' + escT(x.naam) + '</b>' +
            '<span style="font-size:0.64rem;color:var(--soft);">' + escT(x.kop) + ' · ' + timeAgo(x.at) + '</span>' +
            (x.openVoorWerk ? '<span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') + '</div>' +
            '<div style="font-size:0.8rem;line-height:1.55;margin-top:0.35rem;white-space:pre-wrap;">' + msgHTML(x.tekst, x.lang) + '</div>' +
            '<div style="display:flex;gap:0.9rem;margin-top:0.5rem;font-size:0.7rem;color:var(--muted);">' +
            '<button class="js-zlike" data-id="' + x.id + '" style="background:none;border:none;color:' + (x.mijnLike ? 'var(--gold)' : 'var(--muted)') + ';font-family:inherit;cursor:pointer;">' + x.likes + '</button>' +
            '<span>' + x.reactiesTotaal + '</span></div>' +
            x.reacties.map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> ' + msgHTML(r.tekst, r.lang) + '</div>').join('') +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-zretxt" data-id="' + x.id + '" placeholder="' + T('zak.reageer','Reageer…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
            '<button class="js-zre" data-id="' + x.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div></div>').join('')
          : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.leeg','Nog geen posts. Wees de eerste: deel waar u aan werkt.') + '<br><button class="rahul-leeg-knop" data-rahul-leeg="Stel een korte zakelijke post voor me op over waar ik aan werk" style="margin-top:0.6rem;">' + T('zak.leegdoe','Laat Rahul een post opstellen') + '</button></div>');
        $('#zakPost').addEventListener('click', async () => {
          try { await API.call('/zakelijk/post', { tekst: $('#zakPostTekst').value }); zakRender(); }
          catch(e){ if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); } toast(e.message); }
        });
        body.querySelectorAll('.js-zlike').forEach(b => b.addEventListener('click', async () => {
          try { await API.call('/zakelijk/like', { id: b.dataset.id }); zakRender(); } catch(e){ toast(e.message); }
        }));
        body.querySelectorAll('.js-zre').forEach(b => b.addEventListener('click', async () => {
          const inp = body.querySelector('.js-zretxt[data-id="' + b.dataset.id + '"]');
          try { await API.call('/zakelijk/reactie', { id: b.dataset.id, tekst: inp.value }); zakRender(); } catch(e){ toast(e.message); }
        }));
        hydrateMsgs(body); // zakelijke feed leest per kijker in de eigen taal
      } else if (zakView === 'netwerk'){
        const zoek = async (q) => {
          const d = await API.call('/zakelijk/gids', { q, openVoorWerk: $('#zakFilterWerk') ? $('#zakFilterWerk').checked : false });
          $('#zakGids').innerHTML = d.resultaten.length ? d.resultaten.map(zakProfielKaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.geen','Geen profielen gevonden. Leden verschijnen hier zodra ze hun zakelijke profiel aanzetten.') + '</div>';
          $('#zakGids').querySelectorAll('.js-zcon').forEach(b => b.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/connect', { key: b.dataset.key }); toast(r.status === 'aangevraagd' ? T('zak.gevraagd','Verzoek gestuurd. De ander accepteert in Contacten.') : r.status); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
          $('#zakGids').querySelectorAll('.js-zaanb').forEach(ch => ch.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/aanbevelen', { key: ch.dataset.key, vaardigheid: ch.dataset.v });
              toast(r.aanbevolen ? T('zak.aanbevolen','Aanbevolen') + ': ' + ch.dataset.v : T('zak.ingetrokken','Aanbeveling ingetrokken.')); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
        };
        body.innerHTML = '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
          '<input id="zakZoek" placeholder="' + T('zak.zoekph','Zoek op naam, sector of vaardigheid…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.5rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
          '<button class="go" id="zakZoekGo" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.zoek','Zoek') + '</button></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.7rem;color:var(--muted);margin-top:0.5rem;"><input type="checkbox" id="zakFilterWerk"> ' + T('zak.filterwerk','Alleen leden die open voor werk zijn') + '</label>' +
          '<div id="zakGids"></div>';
        $('#zakZoekGo').addEventListener('click', () => zoek($('#zakZoek').value));
        $('#zakZoek').addEventListener('keydown', e => { if (e.key === 'Enter') zoek(e.target.value); });
        $('#zakFilterWerk').addEventListener('change', () => zoek($('#zakZoek').value));
        zoek('');
      } else if (zakView === 'kansen'){
        const SOORT_ICO = { opdracht:'', samenwerking:'', vacature:'', investering:'', anders:'' };
        const laad = async () => {
          const d = await API.call('/zakelijk/kansen', { q: $('#kansZoek').value, soort: $('#kansSoortF').value || undefined });
          const kaart = (k) => '<div class="zak-kaart">' +
            '<div style="display:flex;gap:0.5rem;align-items:baseline;"><span>' + (SOORT_ICO[k.soort] || k.icon || '') + '</span>' +
            '<div class="grow-min"><b style="font-size:0.84rem;">' + escT(k.titel) + '</b>' +
            (!k.open ? ' <span class="zak-chip">' + T('zak.k.dicht','vervuld') + '</span>' : '') +
            '<div style="font-size:0.66rem;color:var(--soft);">' +
            (k.bron === 'partner' ? T('zak.k.partner','Vacature bij RTG-partner') : escT(k.naam) + (k.kop ? ' · ' + escT(k.kop) : '')) +
            (k.plaats ? ' · ' + escT(k.plaats) : '') + (k.land ? ' · ' + escT(k.land) : '') + ' · ' + timeAgo(k.at) + '</div></div></div>' +
            (k.omschrijving ? '<div style="font-size:0.76rem;color:var(--muted);line-height:1.5;margin-top:0.35rem;">' + escT(k.omschrijving) + '</div>' : '') +
            ((k.skills || []).length ? '<div style="margin-top:0.3rem;">' + k.skills.map(s => '<span class="zak-chip">' + escT(s) + '</span>').join('') + '</div>' : '') +
            (k.bron === 'partner'
              ? '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.45rem;">' + T('zak.k.sollhint','Solliciteren gaat met uw RTG-cv via Werk & vacatures op het thuisscherm.') + '</div>'
              : (k.vanMij
                ? ((k.reacties || []).map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> <span style="color:var(--soft);">(' + escT(r.kop || '') + ')</span> ' + escT(r.tekst) + '</div>').join('') +
                  (k.open ? '<button class="js-ksluit" data-id="' + k.id + '" style="margin-top:0.5rem;background:none;border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.8rem;color:var(--muted);font-family:inherit;font-size:0.66rem;cursor:pointer;">✓ ' + T('zak.k.sluit','Markeer als vervuld') + '</button>' : ''))
                : (k.open
                  ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-kretxt" data-id="' + k.id + '" placeholder="' + T('zak.k.reageerph','Reageer met wat u kunt betekenen…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
                    '<button class="js-kre" data-id="' + k.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div>' +
                    (k.reactiesTotaal ? '<div style="font-size:0.62rem;color:var(--soft);margin-top:0.3rem;">' + k.reactiesTotaal + ' ' + T('zak.k.reacties','reactie(s)') + '</div>' : '')
                  : ''))) +
            '</div>';
          const alle = (d.kansen || []).concat(d.partnerVacatures || []);
          $('#kansLijst').innerHTML = alle.length ? alle.map(kaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.k.leeg','Nog geen kansen. Plaats de eerste: een opdracht, samenwerking of investeringsvraag.') + '<br><button class="rahul-leeg-knop" data-rahul-leeg="Stel een kans op (een opdracht, samenwerking of investeringsvraag) en plaats hem voor me" style="margin-top:0.6rem;">' + T('zak.k.leegdoe','Laat Rahul een kans opstellen') + '</button></div>';
          $('#kansLijst').querySelectorAll('.js-kre').forEach(b => b.addEventListener('click', async () => {
            const inp = $('#kansLijst').querySelector('.js-kretxt[data-id="' + b.dataset.id + '"]');
            try { await API.call('/zakelijk/kans/reageer', { id: b.dataset.id, tekst: inp.value }); toast(T('zak.k.gereageerd','Reactie geplaatst; de plaatser ziet hem direct.')); laad(); }
            catch(e){ toast(e.message); }
          }));
          $('#kansLijst').querySelectorAll('.js-ksluit').forEach(b => b.addEventListener('click', async () => {
            try { await API.call('/zakelijk/kans/sluit', { id: b.dataset.id }); laad(); } catch(e){ toast(e.message); }
          }));
        };
        const opt = (v, l) => '<option value="' + v + '">' + l + '</option>';
        body.innerHTML =
          '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('zak.k.nieuw','Plaats een kans') + '</b>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
          '<select id="kansSoort" aria-label="' + T('zak.k.soort','Soort kans') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          opt('opdracht','' + T('zak.k.opdracht','Opdracht')) + opt('samenwerking','' + T('zak.k.samen','Samenwerking')) +
          opt('vacature','' + T('zak.k.vac','Vacature')) + opt('investering','' + T('zak.k.inv','Investering')) + opt('anders','' + T('zak.k.anders','Anders')) + '</select>' +
          '<input id="kansTitel" placeholder="' + T('zak.k.titelph','Titel, bijv. Fotograaf gezocht voor merkcampagne') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;"></div>' +
          '<textarea id="kansOms" placeholder="' + T('zak.k.omsph','Omschrijf kort wat u zoekt of biedt…') + '" style="width:100%;min-height:52px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;margin-top:0.4rem;"></textarea>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;align-items:center;">' +
          '<input id="kansPlaats" placeholder="' + T('zak.k.plaatsph','Plaats (optioneel)') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<button class="go" id="kansPlaatsBtn" style="padding:0.4rem 0.95rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;">' +
          '<input id="kansZoek" placeholder="' + T('zak.k.zoekph','Zoek in kansen en vacatures…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.45rem 0.8rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<select id="kansSoortF" aria-label="' + T('zak.k.filter','Filter op soort') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.7rem;">' +
          '<option value="">' + T('zak.k.alles','Alles') + '</option>' +
          opt('opdracht',T('zak.k.opdracht','Opdracht')) + opt('samenwerking',T('zak.k.samen','Samenwerking')) +
          opt('vacature',T('zak.k.vac','Vacature')) + opt('investering',T('zak.k.inv','Investering')) + '</select></div>' +
          '<div id="kansLijst"></div>';
        $('#kansPlaatsBtn').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/kans', { soort: $('#kansSoort').value, titel: $('#kansTitel').value,
              omschrijving: $('#kansOms').value, plaats: $('#kansPlaats').value });
            $('#kansTitel').value = ''; $('#kansOms').value = ''; toast(T('zak.k.geplaatst','Kans geplaatst.')); laad();
          } catch(e){
            if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); }
            toast(e.message);
          }
        });
        $('#kansZoek').addEventListener('keydown', e => { if (e.key === 'Enter') laad(); });
        $('#kansSoortF').addEventListener('change', laad);
        laad();
      } else {
        const d = await API.call('/zakelijk/profiel');
        const p = d.profiel || {};
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
