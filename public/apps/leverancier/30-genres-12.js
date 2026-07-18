    const artBewaar = el.querySelector('#rArtBewaar');
    if (artBewaar) artBewaar.addEventListener('click', async () => {
      const naam = $('#rArtNaam').value.trim();
      if (!naam) return toast(T('rt.geefnaam','Geef het artikel een naam.'));
      const maten = [...el.querySelectorAll('[data-rmaat].primary')].map(b => b.dataset.rmaat);
      if (!maten.length) return toast(T('rt.kiesmaat','Kies minstens een maat.'));
      const kleuren = $('#rArtKleuren').value.split(',').map(s => s.trim()).filter(Boolean);
      if (!kleuren.length) kleuren.push('Zwart');
      const start = Math.max(0, parseInt($('#rArtVoorraad').value, 10) || 0);
      const bestaand = retailArtBewerk === 'nieuw' ? null : (retailData.artikelen||[]).find(x => x.id === retailArtBewerk);
      const bestaandeV = {}; if (bestaand) (bestaand.varianten||[]).forEach(v => { bestaandeV[v.kleur+'|'+v.maat] = v.voorraad; });
      const varianten = [];
      for (const kl of kleuren) for (const m of maten) varianten.push({ kleur: kl, maat: m, voorraad: bestaand ? (bestaandeV[kl+'|'+m] != null ? bestaandeV[kl+'|'+m] : start) : start });
      const dropDatum = $('#rArtDrop').value;
      const artikel = { naam, sku: $('#rArtSku').value, categorie: $('#rArtCat').value, materiaal: $('#rArtMat').value,
        omschrijving: $('#rArtOms').value, publiekePrijs: Number($('#rArtPrijs').value) || 0, collectieId: $('#rArtColl').value || null,
        varianten, drop: dropDatum ? { datum: dropDatum, tijd: '10:00' } : null };
      if (artFotoData) artikel.foto = artFotoData;
      const body = { artikel }; if (bestaand) body.id = bestaand.id;
      try { await API.call('/supplier/retail/artikel', body); toast(T('rt.artok','Artikel bewaard.')); retailArtBewerk = null; await laadRetail(); openTab('retail'); } catch(e){ toast(e.message); }
    });
    // voorraad
    const zoekBtn = el.querySelector('#rZoekBtn');
    const doeZoek = async () => {
      try { const r = await API.call('/supplier/retail/zoek', { q: $('#rZoek').value }); const uit = $('#rZoekUit');
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr" style="color:'+(v.laag?'var(--amber)':'var(--txt)')+';">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+geld(v.price)+'</div></div>').join('') : '<div class="empty">'+T('rt.nietsgevonden','Niets gevonden.')+'</div>';
      } catch(e){ toast(e.message); }
    };
    if (zoekBtn) zoekBtn.addEventListener('click', doeZoek);
    const zoekIn = el.querySelector('#rZoek'); if (zoekIn) zoekIn.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    const pasVoorraad = async (vsku, delta) => { try { await API.call('/supplier/retail/voorraad', { vsku, delta }); await laadRetail(); } catch(e){ toast(e.message); } };
    el.querySelectorAll('[data-rvmin]').forEach(b => b.addEventListener('click', () => pasVoorraad(b.dataset.rvmin, -1)));
    el.querySelectorAll('[data-rvplus]').forEach(b => b.addEventListener('click', () => pasVoorraad(b.dataset.rvplus, 1)));
    // clienteling
    el.querySelectorAll('[data-rklant]').forEach(b => b.addEventListener('click', async () => {
      try { retailKlant = (await API.call('/supplier/retail/klant', { key: b.dataset.rklant })).klant; renderRetail(); } catch(e){ toast(e.message); }
    }));
    const klTerug = el.querySelector('#rKlantTerug'); if (klTerug) klTerug.addEventListener('click', () => { retailKlant = null; renderRetail(); });
    const matBew = el.querySelector('#rMatenBewaar');
    if (matBew) matBew.addEventListener('click', async () => {
      const maten = {}; el.querySelectorAll('.rMaatIn').forEach(i => { if (i.value.trim()) maten[i.dataset.rmaatcat] = i.value.trim(); });
      try { await API.call('/supplier/retail/klant/maten', { key: retailKlant.key, maten, voorkeuren: $('#rVoorkeuren').value }); toast(T('rt.matenok','Maten bewaard.')); retailKlant = (await API.call('/supplier/retail/klant', { key: retailKlant.key })).klant; renderRetail(); } catch(e){ toast(e.message); }
    });
    const notAdd = el.querySelector('#rNotitieAdd');
    if (notAdd) notAdd.addEventListener('click', async () => {
      const tekst = $('#rNotitie').value.trim(); if (!tekst) return;
      try { await API.call('/supplier/retail/klant/notitie', { key: retailKlant.key, tekst }); retailKlant = (await API.call('/supplier/retail/klant', { key: retailKlant.key })).klant; renderRetail(); } catch(e){ toast(e.message); }
    });
    const stylStuur = el.querySelector('#rStylStuur');
    if (stylStuur) stylStuur.addEventListener('click', async () => {
      const artikelIds = [...el.querySelectorAll('.rStylPick:checked')].map(c => c.value);
      if (!artikelIds.length) return toast(T('rt.kiesart','Kies minstens een artikel.'));
      try { await API.call('/supplier/retail/styling', { key: retailKlant.key, artikelIds, titel: $('#rStylTitel').value, bericht: $('#rStylBericht').value }); toast(T('rt.stylok','Voorstel verstuurd naar de klant.')); renderRetail(); } catch(e){ toast(e.message); }
    });
  }

  // ---- identiteit & leeftijd: het gecontroleerde paspoortkanaal ----
  let paspoortData = null;      // eigen verzoeken + incidenten
  let paspoortBevestiging = null;  // laatste ja/nee-uitslag
  let paspoortInzage = null;    // geopende inzage (id-kaart of scan)
  async function laadPaspoort(){
    if (!API.live) return;
    try { paspoortData = await API.call('/supplier/paspoort/overzicht', {}); } catch(e){ paspoortData = { verzoeken:[], incidenten:[], niveaus:[] }; }
    renderPaspoort();
  }
  function pnBadge(st){
    const kleur = st==='goedgekeurd'?'var(--green)':st==='geweigerd'||st==='afgewezen'?'var(--burgundy)':st==='verlopen'||st==='ingetrokken'?'var(--soft)':'var(--amber)';
    return '<span class="pill" style="color:'+kleur+';border-color:'+kleur+';">'+T('pn.st.'+st, st)+'</span>';
  }
  function renderPaspoort(){
    const el = $('#paspoortWrap'); if (!el) return;
    if (!paspoortData){ el.innerHTML = '<div class="empty">…</div>'; laadPaspoort(); return; }
    const sel = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // aanvraagformulier
    html += '<div class="card"><div class="tt-h">'+T('pn.vraag','Identiteit opvragen')+'</div>'+
      '<div class="field"><label>'+T('pn.codenaam','Codenaam van de gast')+'</label><input id="pnCode" placeholder="'+T('pn.codeph','Bijv. Zilveren Valk 12')+'" autocomplete="off"></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">'+
        '<div class="field" style="margin:0;"><label>'+T('pn.minleeftijd','Leeftijdseis (optioneel)')+'</label><input id="pnLeeftijd" type="number" placeholder="18" inputmode="numeric"></div>'+
        '<div class="field" style="margin:0;"><label>'+T('pn.reden','Reden (optioneel)')+'</label><input id="pnReden" placeholder="'+T('pn.redenph','Bijv. leeftijdscontrole')+'"></div>'+
      '</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.8rem;">'+
        '<button class="obtn primary" data-pnvraag="bevestiging">'+T('pn.jaNee','Ja/nee-check')+'</button>'+
        '<button class="obtn" data-pnvraag="idkaart">'+T('pn.idkaart','ID-kaart vragen')+'</button>'+
        '<button class="obtn" data-pnvraag="paspoort">'+T('pn.paspoort','Paspoort vragen')+'</button>'+
      '</div>'+
      '<div id="pnUitslag" style="margin-top:0.7rem;"></div></div>';
    // geopende inzage
    if (paspoortInzage) html += paspoortInzageKaart(paspoortInzage);
    // lopende en afgehandelde verzoeken
    const vz = paspoortData.verzoeken || [];
    html += '<div class="card"><div class="tt-h">'+T('pn.verzoeken','Mijn verzoeken')+'</div>'+
      (vz.length ? '<div style="margin-top:0.5rem;display:grid;gap:0.4rem;">'+vz.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.codenaam||'\u2013')+'</span>'+pnBadge(v.status)+'</div>'+
        '<div class="ds">'+T('pn.niveau.'+v.niveau, v.niveau)+(v.incident?' · '+T('pn.viaIncident','via incident'):'')+(v.reden?' · '+esc(v.reden):'')+'</div>'+
        (v.status==='goedgekeurd'?'<div style="margin-top:0.4rem;"><button class="obtn primary" data-pnbekijk="'+v.id+'">'+T('pn.bekijk','Inzage openen')+'</button>'+(v.vervalt?' <span class="ds">'+T('pn.tot','geldig tot')+' '+new Date(v.vervalt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})+'</span>':'')+'</div>':'')+
        '</div>').join('')+'</div>'
        : '<div class="empty">'+T('pn.geenverzoek','Nog geen verzoeken.')+'</div>')+'</div>';
