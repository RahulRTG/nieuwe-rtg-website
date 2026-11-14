/* Eén eigenaar voor de app-API en volledige accountprojecties. De factory is
   gehoist binnen de bestaande bundel; 02 initialiseert haar vóór pasconfiguratie
   en de vroege verify-email-aanroep. Geen tweede client of globale testdeur. */
  function maakAppState(){
    const API = RTGApp.maakAPI({ foutTekst: 'API-fout' });
    const bindingen = new WeakMap(), apiCall = API.call.bind(API);
    let generatie = 0;
    function verwerpOudeState(){ generatie++; }
    API.call = function(pad, body, herkans){
      const token = API.token, begonnen = generatie;
      return apiCall(pad, body, herkans).then(function(data){
        if (data.state){
          if (token !== API.token || begonnen !== generatie) throw new Error('Deze accountprojectie is niet meer actueel.');
          // Login levert het nieuwe token; aanvaardSessie neemt token en state samen aan.
          bindingen.set(data.state, { token: data.token || token, bronToken: token, generatie: begonnen });
        }
        return data;
      }).catch(function(e){
        // Een echte KYC-weigering blijft de bestaande onboarding openen.
        if (e && e.data && e.data.kyc && typeof checkOnboarding === 'function') { try { checkOnboarding(); } catch (x) {} }
        throw e;
      });
    };
    function aanvaardSessie(data){
      const binding = data && bindingen.get(data.state);
      // Ontvangst kan vóór een andere login zijn voltooid. Controleer opnieuw
      // vóór token én projectie samen veranderen, niet pas na de tokenwissel.
      if (!binding || !data.token || binding.token !== data.token ||
          binding.bronToken !== API.token || binding.generatie !== generatie) {
        throw new Error('Deze accountprojectie is niet meer actueel.');
      }
      API.token = data.token;
      applyState(data.state);
    }
    function applyState(state){
      if (!state) return false;
      const binding = bindingen.get(state);
      if (!binding || binding.token !== API.token || binding.generatie !== generatie) return false;
      if (state.user) user = state.user;
      if (state.invoices) invoices = state.invoices;
      if (state.trip) trip = state.trip;
      if (state.posts) posts = state.posts;
      if (typeof state.creatorLikes === 'number') creatorLikes = state.creatorLikes;
      if (state.myApplications) myApps = state.myApplications;
      // stateFor is volledig; ontbreken trekt de vorige gezinsprojectie in.
      rtf = state.foundation || { gekoppeld: [], meldingen: [] };
      syncGezinContext();
      return true;
    }
    async function refreshState(){
      try { return applyState((await API.call('/api/state')).state); } catch(e){ return false; }
    }
    return { API, applyState, refreshState, verwerpOudeState, aanvaardSessie };
  }
