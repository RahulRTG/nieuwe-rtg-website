(function () {
  'use strict';
  const K = window.RTGWerk;
  if (/^#(?:(gast|leverancier)=|betaling-terug$)/.test(location.hash)) return;
  const aansluiten = document.createElement('details'); aansluiten.className = 'praktijk';
  aansluiten.innerHTML = '<summary>Aansluiten bij uw organisatie</summary><form><label>Werkruimtecode van uw organisatie<input name="werkruimte" required maxlength="8" autocomplete="off"></label><label>Uw naam<input name="naam" required maxlength="60" autocomplete="name"></label><button type="submit" class="knop">Toegang aanvragen</button><p role="status"></p></form>';
  document.querySelector('#inlog').append(aansluiten);
  aansluiten.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault(); const f=ev.target,k=f.querySelector('button'),uit=f.querySelector('[role=status]');
    if(k.disabled)return;k.disabled=true;
    const b=Object.fromEntries(new FormData(f));b.werkruimte=b.werkruimte.trim().toUpperCase();
    try {
      const r=await K.api('/lid/aanmeld',b);if(!r.body.ok)throw new Error(r.body.error||'Aanmelden is niet gelukt.');
      const toegang={werkruimte:b.werkruimte,...(r.body.lidToken?{lidToken:r.body.lidToken}:{})};
      uit.textContent='Uw aanvraag staat klaar. Uw beheerder moet u toelaten en rechten geven.';
      k.textContent='Controleer mijn toegang';k.type='button';
      k.onclick=async()=>{k.disabled=true;try{const x=await K.api('/praktijk/beeld',toegang);if(!x.body.ok)throw new Error(x.body.error||'Uw toegang is nog niet toegekend.');K.bewaar(toegang);K.poort();window.RTGPraktijk.laad();window.RTGWerkStart.laad();}catch(err){uit.textContent=err.message;}finally{k.disabled=false;}};
    } catch(err){uit.textContent=err.message;} finally{k.disabled=false;}
  });
  async function laad(houder) {
    const [r,rollen] = await Promise.all([K.api('/leden',{}),K.api('/rollen',{})]);
    if (!r.body.ok || !rollen.body.ok) { houder.textContent = r.body.error || rollen.body.error; return; }
    houder.innerHTML = '<p>Werkruimtecode: <b>' + K.esc(K.sessie().werkruimte) + '</b>. Een collega meldt zich met een eigen account aan; u laat die persoon daarna toe. Een gastlink geeft nooit personeelsrechten.</p>' +
      r.body.leden.map(l => '<details><summary>' + K.esc(l.naam) + ' · ' + K.esc(l.status) + '</summary>' +
      '<p>Actuele rollen: ' + K.esc(l.rollen.map(x=>x.id+(x.tot?' tot '+x.tot:'')).join(', ') || 'geen') + '</p>' +
      (l.status === 'wacht' ? '<button type="button" class="knop" data-pr-toelaten="' + K.esc(l.id) + '">Persoon toelaten</button>' : '') +
      (l.status === 'actief' ? '<form data-pr-rollen="' + K.esc(l.id) + '"><p>Kies de volledige nieuwe set rechten. Niet aangevinkte rollen vervallen bij bewaren.</p>' +
        rollen.body.rollen.map(x=>'<label class="pr-keuze"><input type="checkbox" name="rollen" value="' + K.esc(x.id) + '"' +
          (l.rollen.some(z=>z.id===x.id)?' checked':'') + '> ' + K.esc(x.naam) + '</label>').join('') +
        '<label>Geldig vanaf (optioneel)<input type="date" name="van"></label><label>Geldig tot en met (optioneel)<input type="date" name="tot"></label>' +
        '<button type="submit" class="knop">Rechten vervangen</button><p role="status"></p></form>' : '') + '</details>').join('');
    houder.querySelectorAll('[data-pr-toelaten]').forEach(k=>k.addEventListener('click',async()=>{
      k.disabled=true;
      try { const x=await K.api('/lid/besluit',{lidId:k.dataset.prToelaten,akkoord:true});if(!x.body.ok)throw new Error(x.body.error);await laad(houder); }
      catch(err){K.meld(err.message);k.disabled=false;}
    }));
    houder.querySelectorAll('[data-pr-rollen]').forEach(f=>f.addEventListener('submit',async ev=>{
      ev.preventDefault();ev.stopPropagation();const k=f.querySelector('button');if(k.disabled)return;k.disabled=true;
      const d=new FormData(f),b={lidId:f.dataset.prRollen,rollen:d.getAll('rollen').map(id=>{const oud=(r.body.leden.find(l=>l.id===f.dataset.prRollen)?.rollen||[]).find(x=>x.id===id);return {id,van:d.get('van')||(oud?.van)||null,tot:d.get('tot')||(oud?.tot)||null};})};
      try { const x=await K.api('/lid/rollen',b);if(!x.body.ok)throw new Error(x.body.error);await laad(houder); }
      catch(err){f.querySelector('[role=status]').textContent=err.message;k.disabled=false;}
    }));
  }
  document.addEventListener('click',async ev=>{
    const k=ev.target.closest('[data-pr-team]');if(!k)return;
    const houder=document.getElementById('prTeam');if(!houder)return;
    k.disabled=true;try{await laad(houder);}catch(err){houder.textContent=err.message;}finally{k.disabled=false;}
  });
})();
