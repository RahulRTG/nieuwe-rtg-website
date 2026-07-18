        const laad = async () => {
          const d = await API.call('/zakelijk/kansen', { q: $('#kansZoek').value, soort: $('#kansSoortF').value || undefined });
          const kaart = (k) => '<div class="zak-kaart">' +
            '<div style="display:flex;gap:0.5rem;align-items:baseline;"><span>' + (SOORT_ICO[k.soort] || k.icon || '✨') + '</span>' +
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
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.k.leeg','Nog geen kansen. Plaats de eerste: een opdracht, samenwerking of investeringsvraag.') + '</div>';
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
          opt('opdracht','🛠️ ' + T('zak.k.opdracht','Opdracht')) + opt('samenwerking','🤝 ' + T('zak.k.samen','Samenwerking')) +
          opt('vacature','📋 ' + T('zak.k.vac','Vacature')) + opt('investering','💶 ' + T('zak.k.inv','Investering')) + opt('anders','✨ ' + T('zak.k.anders','Anders')) + '</select>' +
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
