  /* De Vooruit-kaart: uw termijnen, voor elke pas. Afgesplitst van 53.js toen
     dat over de 10 kB ging; de snede loopt langs een echte grens -- 53 gaat over
     de AGENDA (wat u zelf plant), dit over wat er VANZELF op u afkomt.
     Deelt de IIFE-scope met 53: API, T, esc, lang komen daarvandaan. */
  /* ---------- "Vooruit": uw termijnen, voor ELKE pas ----------
     Alles wat een datum heeft en van u is: uw paspoort uit de kluis, uw
     boekingen, uw agenda, en -- als u een Lifestyle Pass heeft -- ook uw
     verzekeringen, keuringen en visa. De motor (kern/levensgraaf) kent geen
     pas-controle; de bronnen die het premium-dossier lezen geven vanzelf niets
     terug voor wie dat dossier niet heeft.

     NIEMAND TYPT DIT. Dat is de hele reden dat deze kaart bestaat, en daarom
     staat er ook bij WAAR het vandaan komt: een lid dat ziet dat zijn paspoort
     er vanzelf in staat, vertrouwt de rest van de lijst ook. */
  let vooruitData = null;
  async function laadVooruit(){
    if (!API.live || !API.token) return;
    try { vooruitData = await API.call('/member/vooruit', {}); } catch(e){ vooruitData = { fout: true }; }
  }
  function renderVooruit(){
    const el = document.getElementById('boVooruitCard'); if (!el) return;
    if (!vooruitData){ el.innerHTML = '<div class="zak-kaart"><b class="vo-kop">' + T('vo.titel','Vooruit') + '</b><div class="fineprint">…</div></div>'; laadVooruit().then(renderVooruit); return; }
    const d = vooruitData;
    if (d.fout){ el.innerHTML = ''; return; }
    const dagLbl = x => { try { return new Date(x+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{day:'numeric',month:'short'}); } catch(e){ return x; } };
    const regel = r => '<div class="vo-rij">'
      + '<span>' + esc((r.waarvan ? r.waarvan + ' · ' : '') + r.naam) + '</span>'
      + '<span class="vo-dag">' + esc(dagLbl(r.datum)) + '</span></div>';
    let h = '<div class="zak-kaart"><b class="vo-kop">' + T('vo.titel','Vooruit')
      + (d.achterstallig.length ? ' <span class="vo-let">(' + d.achterstallig.length + ')</span>' : '') + '</b>';
    if (!d.totaal){
      h += '<div class="fineprint vo-mt">' + T('vo.leeg','Er staat nog niets met een datum op uw naam. Zodra u iets boekt of uw paspoort scant, verschijnt het hier vanzelf.') + '</div>';
    } else {
      if (d.achterstallig.length){
        h += '<div class="vo-groep laat">' + T('vo.laat','Al voorbij') + '</div>';
        h += d.achterstallig.slice(0,4).map(regel).join('');
      }
      for (const v of d.vensters){
        if (!v.aantal) continue;
        h += '<div class="vo-groep">' + esc(v.label) + '</div>';
        h += v.items.slice(0,5).map(regel).join('');
        break;   // alleen het eerstvolgende venster met inhoud; dit is een kaart, geen lijst
      }
      h += '<div class="fineprint vo-mt2">'
        + T('vo.bron','Automatisch verzameld uit') + ': ' + esc(d.bronnen.join(', ')) + '.</div>';
    }
    for (const a of (d.afgekapt || [])) h += '<div class="fineprint vo-dak">' + T('vo.dak','Wij tonen de eerste') + ' ' + a.dak + ' ' + T('vo.uit','uit') + ' ' + esc(a.bron) + '.</div>';
    for (const s2 of (d.stuk || [])) h += '<div class="fineprint vo-let">' + T('vo.stuk','Wij kunnen dit deel nu niet uitlezen') + ': ' + esc(s2) + '.</div>';
    h += '</div>';
    el.innerHTML = h;
  }
