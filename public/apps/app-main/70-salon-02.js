      const deal = p.deal
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">🎁 ' + T('sal.deal','Exclusief voor leden') + (p.deal.geldigTot ? ' · t/m ' + p.deal.geldigTot : '') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + p.deal.titel + '</div>' +
          (p.deal.mijnCode
            ? '<div style="margin-top:0.45rem;font-size:0.8rem;color:var(--gold);letter-spacing:0.08em;">' + T('sal.uwcode','Uw code') + ': <b>' + p.deal.mijnCode + '</b> <span style="color:var(--soft);font-size:0.68rem;">· ' + T('sal.toon','toon aan de kassa') + '</span></div>'
            : '<button class="js-claim" style="margin-top:0.5rem;background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.45rem 0.95rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('sal.claim','Claim deze aanbieding') + '</button>') +
          '<div style="margin-top:0.35rem;font-size:0.62rem;color:var(--soft);">' + p.deal.claims + ' ' + T('sal.geclaimd','keer geclaimd') + '</div></div>'
        : '';
      const poll = p.poll
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">📊 ' + T('sal.poll','Poll') + ' · ' + p.poll.totaal + ' ' + T('sal.stemmen','stem(men)') + '</div>' +
          p.poll.opties.map((o, i) => {
            const pct = p.poll.totaal ? Math.round(o.stemmen / p.poll.totaal * 100) : 0;
            return p.poll.gestemd
              ? '<div style="margin-top:0.45rem;"><div style="display:flex;justify-content:space-between;font-size:0.76rem;"><span>' + (o.mijn ? '✓ ' : '') + o.tekst + '</span><span style="color:var(--soft);">' + pct + '%</span></div>' +
                '<div style="height:4px;border-radius:99px;background:rgba(255,255,255,0.08);margin-top:0.25rem;overflow:hidden;"><i style="display:block;height:100%;width:' + pct + '%;background:' + (o.mijn ? 'var(--gold)' : 'var(--soft)') + ';border-radius:99px;"></i></div></div>'
              : '<button class="js-stem" data-optie="' + i + '" style="display:block;width:100%;margin-top:0.45rem;background:none;border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;color:var(--txt);font-size:0.78rem;font-family:inherit;text-align:left;cursor:pointer;">' + o.tekst + '</button>';
          }).join('') + '</div>'
        : '';
      const folder = p.folder
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">📖 ' + T('sal.folder','Folder') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + escT(p.folder.titel) + '</div>' +
          ((p.folder.fotos && p.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">' + p.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:96px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
          ((p.folder.items && p.folder.items.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.2rem;">' + p.folder.items.slice(0, 12).map(it => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(it.naam) + (it.tekst ? ' <span style="color:var(--soft);">· ' + escT(it.tekst) + '</span>' : '') + '</span>' + (it.prijs != null ? '<span style="color:var(--gold);white-space:nowrap;">' + eur(it.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '') +
          '</div>'
        : '';
      const etalageBtn = p.partnerCode
        ? '<button class="pa js-etalage" data-code="' + p.partnerCode + '" title="' + T('sal.etalage','Etalage') + '">🏬 ' + T('sal.etalage','Etalage') + '</button>'
        : '';
      return '<article class="post" data-post="' + p.id + '">' +
        '<div class="head">' +
          '<div class="avatar a-' + p.tier + '">' + escT((p.author || ' ')[0]) + '</div>' +
          '<div><b>' + escT(p.author) + (p.partner ? '<span class="partner-badge">' + T('app.partner','Partner') + '</span>' : '') + '</b><span>' + escT(meta) + (p.partnerCode && p.volgers != null ? ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') : '') + '</span></div>' +
          volg +
        '</div>' +
        visual +
        '<div class="body">' + msgHTML(p.text, p.lang) + '</div>' +
        folder + deal + poll +
        '<div class="acts">' +
          '<button class="pa js-like' + (p.liked ? ' liked' : '') + '"' + (mayLike ? '' : ' disabled') + '>♥ <span class="lc">' + p.likes + '</span></button>' +
          '<button class="pa js-comm"' + (engage ? '' : ' disabled') + '>' + T('app.salon.comment','Reageren') + ' (' + p.comments.length + ')</button>' +
          etalageBtn +
          '<button class="pa js-share" title="' + T('sal.deel','Delen met een connectie') + '">↗</button>' +
        '</div>' +
        '<div class="comments">' +
          '<div class="clist">' + p.comments.map(c => '<div class="comment"><b>' + escT(c.who) + '</b>, ' + msgHTML(c.text, c.lang) + '</div>').join('') + '</div>' +
          '<div class="cform"><input placeholder="' + T('app.salon.write','Schrijf een reactie…') + '"><button>' + T('app.salon.post','Plaats') + '</button></div>' +
        '</div>' +
      '</article>';
    }).join('');
    hydrateMsgs($('#feed'));

    document.querySelectorAll('.post').forEach(el => {
      const post = posts.find(p => p.id === Number(el.dataset.post));
      el.querySelector('.js-like').addEventListener('click', ev => {
        // zonder pas kun je berichten van leden wel zien, maar niet liken
        if (user && user.tier === 'guest' && !post.partner){ toast(T('sal.guestlike','Zonder pas bekijk je de Salon; liken en reageren bij leden is voor leden.')); return; }
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        ev.currentTarget.classList.toggle('liked', post.liked);
        el.querySelector('.lc').textContent = post.likes;
        if (API.live) API.call('/like', {postId: post.id, liked: post.liked}).catch(() => {});
      });
      const shareBtn = el.querySelector('.js-share');
      if (shareBtn) shareBtn.addEventListener('click', () => openShare(post.id));
      const volgBtn = el.querySelector('.js-volg');
      if (volgBtn) volgBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/volg', { code: volgBtn.dataset.code });
          toast(d.volgIk ? '✦ ' + T('sal.volgok','U volgt') + ' ' + post.author + '.' : T('sal.ontvolgd','Niet meer gevolgd.'));
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const claimBtn = el.querySelector('.js-claim');
      if (claimBtn) claimBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/deal/claim', { postId: post.id });
          toast('🎁 ' + T('sal.claimok','Geclaimd. Uw code:') + ' ' + d.code);
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const etaBtn = el.querySelector('.js-etalage');
      if (etaBtn) etaBtn.addEventListener('click', () => openEtalage(etaBtn.dataset.code));
      el.querySelectorAll('.js-stem').forEach(sb => sb.addEventListener('click', async () => {
        try {
          await API.call('/salon/poll/stem', { postId: post.id, optie: Number(sb.dataset.optie) });
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      }));
