/* De vrachtkaart met etappetijdlijn, documenten en klantcode-acties. */
  function vrTijdlijn(z){
    return '<div class="vr-tijdlijn">'+z.etappes.map(e => {
      const stand = e.status==='bezig' ? ' bezig' : e.status==='klaar' ? ' klaar' : '';
      return '<span title="'+escAttr(e.document)+'" class="vr-etappe'+stand+'">'+
        T('vr.mod.'+e.modaliteit, VR_MOD[e.modaliteit].label)+' · '+esc(e.van)+' → '+esc(e.naar)+(e.status==='klaar'?' · '+T('vr.et.klaar','klaar'):e.status==='bezig'?' · '+T('vr.et.nu','nu'):'')+'</span>';
    }).join('')+'</div>';
  }
  function vrKaart(z){
    const docs = z.etappes.map(e => esc(e.document)).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
    let acties = '';
