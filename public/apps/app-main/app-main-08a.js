  /* Vervolg van app-main-08: het meebouwen aan het eind van de onboarding.
     Apart bestand omdat deel 08 over de 10 kB van het modulebeleid ging; de
     naad ligt op een top-niveau-grens, dus de functies staan nog gewoon in
     dezelfde omhulling als de rest van de poort. */
  /* Meebouwen: het eerste Salon-bericht en het eigen bedrijf. Hier staat WEL een
     vinkje en bij het inrichten niet, en dat is het verschil: deze twee verlaten
     het lid echt. Uit staat uit. Zie server/kern/onboarding/meebouwen.js. */
  let onbMb = [], onbMbHuidig = null, onbMbJa = false;
  async function onbMeebouwen(){
    let st; try { st = await API.call('/onboarding/meebouwen'); } catch(e){ return onbKlaar(); }
    if (!st || st.klaar || !(st.open || []).length) return onbKlaar();
    onbMb = st.open.slice(); onbMbVolgende();
  }
  function onbMbVolgende(){
    if (!onbMb.length) return onbKlaar();
    onbMbHuidig = onbMb.shift(); onbMbJa = false; onbStap = 'meebouw';
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = 'text'; inp.value = '';
      inp.placeholder = onbMbHuidig.id === 'salon' ? T('onb.mb.ph1','Schrijf iets') : T('onb.mb.ph2','Naam van je bedrijf'); }
    onbZeg(onbMbHuidig.vraag);
    onbMbKnoppen();
    if (inp) inp.focus();
  }
  /* Het vinkje als knop: uit is uit, en je ziet wat aan staat. Kan het gegeven
     niet -- de gratis laag mag geen bedrijf aanmelden voor de catalogus -- dan
     is er geen schakelaar maar een zin: een vinkje dat niets doet is erger dan
     geen vinkje. De server zegt dat met catalogusMag. */
  function onbMbKnoppen(){
    if (onbMbHuidig.catalogusMag === false){
      onbZeg(onbMbHuidig.vraag + ' ' + onbMbHuidig.toestemming);
      return onbActies([{ txt: T('onb.mb.sla','Sla dit over'), doe: onbMbVolgende }]);
    }
    onbActies([
      { txt: (onbMbJa ? '\u2713 ' : '') + onbMbHuidig.toestemming, doe: function(){ onbMbJa = !onbMbJa; onbMbKnoppen(); } },
      { txt: T('onb.mb.sla','Sla dit over'), doe: onbMbVolgende }
    ]);
  }
  async function onbMbOpslaan(t){
    onbBezig = true;
    const fout = onbEl('onbFout');
    try {
      if (onbMbHuidig.id === 'salon') await API.call('/onboarding/salonpost', { tekst: t, promoMag: onbMbJa });
      else {
        const r = await API.call('/onboarding/bedrijf', { naam: t, catalogus: onbMbJa });
        // Rahul zegt wat er NU gebeurt; nooit "geregeld"
        if (r && r.vervolg) toast(r.vervolg);
      }
    } catch(e){ if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet, probeer het nog eens.'); }
    onbBezig = false; onbMbVolgende();
  }

