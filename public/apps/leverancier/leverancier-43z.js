/* De vrachtkaart met etappetijdlijn, documenten en klantcode-acties. */
  function vrTijdlijn(z){
    return '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.5rem;">'+z.etappes.map(e => {
      const stijl = e.status==='bezig' ? 'border-color:var(--gold);background:rgba(201,162,75,0.12);' : e.status==='klaar' ? 'opacity:0.6;' : 'opacity:0.85;';
      return '<span title="'+escAttr(e.document)+'" style="border:1px solid var(--line);'+stijl+'border-radius:0;padding:0.2rem 0.6rem;font-size:0.72rem;">'+
        T('vr.mod.'+e.modaliteit, VR_MOD[e.modaliteit].label)+' · '+esc(e.van)+' → '+esc(e.naar)+(e.status==='klaar'?' · '+T('vr.et.klaar','klaar'):e.status==='bezig'?' · '+T('vr.et.nu','nu'):'')+'</span>';
    }).join('')+'</div>';
  }
  function vrKaart(z){
    const docs = z.etappes.map(e => esc(e.document)).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
    let acties = '';
