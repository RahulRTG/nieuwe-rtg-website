/* de zakelijke lade voor Business en Lifestyle */
    if (user && (user.tier === 'business' || user.tier === 'lifestyle')){
      zakL.style.display = 'block';
      zakL.innerHTML = '<button id="zakOpenBtn" style="display:flex;align-items:center;gap:0.7rem;width:100%;text-align:left;background:none;border:1px solid var(--gold);border-radius:14px;padding:0.75rem 1rem;margin-bottom:0.75rem;color:var(--txt);font-family:inherit;cursor:pointer;">' +
        '<span style="font-size:1.2rem;"></span><span class="h-flex1"><b style="font-size:0.85rem;">' + T('zak.h','RTG Zakelijk') + '</b>' +
        '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('zak.launch','Uw professionele netwerk: profiel, gids, feed en aanbevelingen.') + '</span></span>' +
        '<span style="color:var(--gold);">›</span></button>';
      $('#zakOpenBtn').addEventListener('click', zakOpen);
    } else { zakL.style.display = 'none'; }
    $('#feed').innerHTML = posts.map(p => {
      const engage = canEngage(p);
      // gratis gebruikers (zonder pas) liken/reageren niet bij particulieren
      const mayLike = !(isGuest && !p.partner);
      // waarom staat dit bericht in De Salon? Vreemden zien alleen wat viraal
      // gaat of maatschappelijk belangrijk is; van een vriend of iemand die je
      // volgt zie je het sowieso. Een klein, ingetogen chipje maakt de reden
      // zichtbaar (partner-etalage en uitgelichte posts dragen geen chip).
      const REDEN_LABEL = {
        vriend: T('sal.reden.vriend', 'Vriend'),
        volgend: T('sal.reden.volgend', 'Je volgt'),
        belangrijk: T('sal.reden.belangrijk', 'Belangrijk'),
        viraal: T('sal.reden.viraal', 'Trending')
      };
      const redenChip = (p.reden && REDEN_LABEL[p.reden])
        ? '<span class="salon-reden salon-reden-' + p.reden + '">' + REDEN_LABEL[p.reden] + '</span>'
        : '';
      const visual = p.photo
        ? '<div class="visual"><img src="' + p.photo + '" alt="">' + redenChip + '<span class="place">' + escT(p.place) + '</span></div>'
        : '<div class="visual ' + (p.visual || 'v-partner') + '">' + redenChip + '<span class="place">' + escT(p.place) + '</span></div>';
      // partners posten zonder wachttijd: hun bericht staat er direct, met
      // tijdstempel; de 7-dagen-privacyregel geldt alleen voor ledenposts
      const meta = p.partner
        ? TIER_LABEL.partner + ' · ' + p.place + ' · ' + (p.at ? timeAgo(p.at) : T('app.salon.direct','direct geplaatst'))
        : TIER_LABEL[p.tier] + ' · ' + p.place + ' · ' + T('app.salon.7days','7 dagen na verblijf');
      // bedrijfslaag: volg-knop, exclusieve aanbieding en poll
      const volg = p.partnerCode
        ? '<button class="js-volg" data-code="' + p.partnerCode + '" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.25rem 0.75rem;font-size:0.66rem;font-weight:600;font-family:inherit;flex-shrink:0;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button>'
        : '';
      const deal = p.deal
        ? '<div style="margin:0.5rem 1.25rem 0;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">' + T('sal.deal','Exclusief voor leden') + (p.deal.geldigTot ? ' · t/m ' + p.deal.geldigTot : '') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + p.deal.titel + '</div>' +
          (p.deal.mijnCode
            ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--gold);letter-spacing:0.08em;">' + T('sal.uwcode','Uw code') + ': <b>' + p.deal.mijnCode + '</b> <span style="color:var(--soft);font-size:0.68rem;">· ' + T('sal.toon','toon aan de kassa') + '</span></div>'
            : '<button class="js-claim" style="margin-top:0.5rem;background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.45rem 0.95rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('sal.claim','Claim deze aanbieding') + '</button>') +
          '<div style="margin-top:0.25rem;font-size:0.62rem;color:var(--soft);">' + p.deal.claims + ' ' + T('sal.geclaimd','keer geclaimd') + '</div></div>'
        : '';
      const poll = p.poll
        ? '<div style="margin:0.5rem 1.25rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">' + T('sal.poll','Poll') + ' · ' + p.poll.totaal + ' ' + T('sal.stemmen','stem(men)') + '</div>' +
          p.poll.opties.map((o, i) => {
            const pct = p.poll.totaal ? Math.round(o.stemmen / p.poll.totaal * 100) : 0;
            return p.poll.gestemd
              ? '<div class="h-mt45"><div style="display:flex;justify-content:space-between;font-size:0.76rem;"><span>' + (o.mijn ? '✓ ' : '') + o.tekst + '</span><span style="color:var(--soft);">' + pct + '%</span></div>' +
                '<div style="height:4px;border-radius:99px;background:rgba(255,255,255,0.08);margin-top:0.25rem;overflow:hidden;"><i style="display:block;height:100%;width:' + pct + '%;background:' + (o.mijn ? 'var(--gold)' : 'var(--soft)') + ';border-radius:99px;"></i></div></div>'
              : '<button class="js-stem" data-optie="' + i + '" style="display:block;width:100%;margin-top:0.5rem;background:none;border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;color:var(--txt);font-size:0.78rem;font-family:inherit;text-align:left;cursor:pointer;">' + o.tekst + '</button>';
          }).join('') + '</div>'
        : '';
      const folder = p.folder
        ? '<div style="margin:0.5rem 1.25rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">' + T('sal.folder','Folder') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + escT(p.folder.titel) + '</div>' +
          ((p.folder.fotos && p.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">' + p.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:96px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
          ((p.folder.items && p.folder.items.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.2rem;">' + p.folder.items.slice(0, 12).map(it => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(it.naam) + (it.tekst ? ' <span style="color:var(--soft);">· ' + escT(it.tekst) + '</span>' : '') + '</span>' + (it.prijs != null ? '<span style="color:var(--gold);white-space:nowrap;">' + eur(it.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '') +
          '</div>'
        : '';
      const etalageBtn = p.partnerCode
        ? '<button class="pa js-etalage" data-code="' + p.partnerCode + '" title="' + T('sal.etalage','Etalage') + '">' + T('sal.etalage','Etalage') + '</button>'
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
          '<button class="pa js-like' + (p.liked ? ' liked' : '') + '"' + (mayLike ? '' : ' disabled') + '>' + RTGGlyf.svgHTML('hart', p.liked ? { fill: true } : {}) + ' <span class="lc">' + p.likes + '</span></button>' +
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

