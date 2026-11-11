    /* PersonalOS-onboarding gebruikt dezelfde ene formulierlaag, maar de twee
       compositiestappen zijn keuzes en geen vrije profielvelden. */
    const PERSONAL_GOALS = ['dagelijks_leven','reizen','talent_ontwikkelen','ondernemen','werken_en_leren','ondersteuning','bijdragen'];
    const PERSONAL_LAYOUTS = ['simple','balanced','advanced'];
    function personalGoalLabel(id){return T('personalos.goal.'+id,({dagelijks_leven:'Dagelijks leven',reizen:'Reizen',talent_ontwikkelen:'Talent ontwikkelen',ondernemen:'Ondernemen',werken_en_leren:'Werken en leren',ondersteuning:'Ondersteuning',bijdragen:'Bijdragen'})[id]||id);}
    function personalLayoutLabel(id){return T('personalos.layout.'+id,({simple:'Eenvoudig',balanced:'Gebalanceerd',advanced:'Uitgebreid'})[id]||id);}
    let previewVolgorde = 0;
    function personalKeuzes(s){
      const vak=el('agPersonal'); vak.textContent=''; vak.hidden=false;
      const bron=s.kind==='goals'?PERSONAL_GOALS:PERSONAL_LAYOUTS;
      bron.forEach(function(key){
        const b=document.createElement('button'); b.type='button'; b.className='access-secondary';
        const gekozen=s.kind==='goals'?draft.goals.includes(key):draft.layout===key;
        const label=s.kind==='goals'?personalGoalLabel(key):personalLayoutLabel(key);
        b.setAttribute('aria-pressed',String(gekozen)); b.textContent=label+(gekozen?T('personalos.choice.selected_suffix',' · gekozen'):'');
        b.addEventListener('click',function(){
          if(s.kind==='goals') draft.goals=draft.goals.includes(key)?draft.goals.filter(function(x){return x!==key}):draft.goals.concat(key);
          else draft.layout=key;
          personalKeuzes(s); personalPreview();
        });
        vak.appendChild(b);
      });
      if(s.kind==='layout'){
        const preview=document.createElement('p'); preview.id='agPersonalPreview'; preview.className='access-description';
        preview.setAttribute('role','status'); preview.setAttribute('aria-live','polite');
        preview.textContent=T('personalos.onboarding.preview.loading','Uw persoonlijke RTG-preview wordt opgebouwd.'); vak.appendChild(preview);
      }
    }
    async function personalPreview(){
      const vak=el('agPersonalPreview'); if(!vak)return;
      const poging=++previewVolgorde;
      try{
        const antwoord=await API.call('/personalos/preview',{goals:draft.goals,layout:draft.layout});
        if(poging!==previewVolgorde||!antwoord||!antwoord.composition)return;
        const werelden=antwoord.composition.worlds.map(function(w){
          return w.id.replace('livingos','LivingOS').replace('travelos','TravelOS').replace('workos','WorkOS').replace('foundationos','FoundationOS');
        });
        vak.textContent=T('personalos.onboarding.preview.ready','Uw RTG begint met: {worlds}.')
          .replace('{worlds}',werelden.join(', '));
      }catch(e){if(poging===previewVolgorde)vak.textContent=T('personalos.onboarding.preview.unavailable','De preview is nu niet bereikbaar. Uw accountgegevens blijven hier staan.');}
    }
