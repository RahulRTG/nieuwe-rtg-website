      if (!(totaal > 0) || !(mijn >= 0) || mijn > totaal) { toast(T('sy.bedrag','Controleer de bedragen.')); return; }
      try {
        await API.call('/supplier/synergie/maak', { naam: w('#synNaam'),
          prijsCenten: totaal, aandelen: [
            { code: (S && S.code) || '', centen: mijn },
            { code: String(w('#synPartner')).toUpperCase().trim(), centen: totaal - mijn }
          ] });
        toast(''+T('sy.voorgesteld','Voorgesteld; de partner tekent in het eigen kantoor.'));
        await synVer();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-khire]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/apply/decide', { id: b.dataset.khire, action: 'aannemen' });
        kantoorMsg = '\u2705 '+T('kt.hired','Aangenomen.')+' <b>'+escT(d.invite.naam)+'</b> '+T('kt.hired.geef','meldt zich zelf aan met bedrijfsnaam')+' <b>'+escT(d.bedrijf)+'</b> + '+T('kt.invite.code','Kassacode')+' <b style="color:var(--gold);font-family:monospace;letter-spacing:0.14em;">'+escT(d.invite.kassacode)+'</b>';
        invData = null;
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kreset]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/staff/reset-pin', { staffId: b.dataset.kreset });
        kantoorMsg = '\ud83d\udd11 '+T('kt.resetdone','Code gereset voor')+' <b>'+escT(d.staff.name)+'</b> \u00b7 '+T('kt.newpin','nieuwe pincode')+': <b style="color:var(--gold);">'+escT(d.pin)+'</b> ('+T('kt.pinonce','geef eenmalig door')+')';
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kinv]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/invite/intrek', { kassacode: b.dataset.kinv });
        invData = null; toast(T('kt.ingetrokken','Uitnodiging ingetrokken.')); renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kno]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/apply/decide', { id: b.dataset.kno, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/remove', { staffId: b.dataset.kdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktInvite = el.querySelector('#ktInvite'); if (ktInvite) ktInvite.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/staff/invite', { name: el.querySelector('#ktName').value.trim(), func: el.querySelector('#ktFunc').value.trim(), role: el.querySelector('#ktRole').value });
        kantoorMsg = T('kt.invite.done','Uitnodiging klaar. Geef deze twee dingen door aan uw medewerker:')+'<br>'+
          '<b>'+T('kt.invite.biz','Bedrijfsnaam')+':</b> '+escT(d.bedrijf)+'<br>'+
          '<b>'+T('kt.invite.code','Kassacode')+':</b> <span style="font-family:monospace;font-size:1.25rem;letter-spacing:0.18em;color:var(--gold);">'+escT(d.invite.kassacode)+'</span><br>'+
          '<span class="sub">'+T('kt.invite.note','Eenmalig, 30 dagen geldig.')+'</span>';
        toast(T('kt.invite.toast','Kassacode aangemaakt.'));
        invData = null; laadInvites();
      } catch(e){ toast(e.message); }
    });
    const ktBuzz = el.querySelector('#ktBuzz'); if (ktBuzz) ktBuzz.addEventListener('click', async () => {
      try { await API.call('/supplier/team/buzz', { all: true }); toast(T('kt.buzzed','Iedereen opgeroepen.')); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-kst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.kst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // de kaart-bewerker openen/sluiten en opslaan (alles per gerecht, ook het vuurplan)
    el.querySelectorAll('[data-kedit]').forEach(b => b.addEventListener('click', () => {
      kantoorEdit = kantoorEdit === b.dataset.kedit ? null : b.dataset.kedit;
      renderStation();
    }));
    el.querySelectorAll('[data-ksave]').forEach(b => b.addEventListener('click', async () => {
      const form = el.querySelector('[data-kedit-form="'+b.dataset.ksave+'"]'); if (!form) return;
      const v = k => { const inp = form.querySelector('[data-kf="'+k+'"]'); return inp ? inp.value : null; };
      const menu = (state.menu||[]).map(x => {
        if (x.id !== b.dataset.ksave) return x;
        const naam = (v('name')||'').trim();
        return { ...x,
          name: naam || x.name,
          cat: (v('cat')||'').trim() || x.cat,
          price: Number(v('price')) > 0 ? Number(v('price')) : x.price,
          desc: (v('desc')||'').trim(),
          sectie: v('sectie') != null ? v('sectie') : x.sectie,
          prepMin: v('prepMin') != null ? (parseInt(v('prepMin'), 10) || 0) : x.prepMin,
          allergens: v('allergens') != null ? v('allergens').split(',').map(a=>a.trim()).filter(Boolean) : x.allergens
        };
      });
      try { await API.call('/supplier/menu', { menu }); kantoorEdit = null; toast(T('kt.m.saved','Kaart bijgewerkt; het vuurplan rekent er direct mee.')); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/menu', { menu: (state.menu||[]).filter(x=>x.id!==b.dataset.kmdel) }); await refresh(); } catch(e){ toast(e.message); }
    }));
