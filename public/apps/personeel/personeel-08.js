      if (!pkDorp) return;
      const naar = prompt(T('pd.dorp.stuurwaar','Naar welke afdeling?')+' ('+pkDorp.afdelingen.map(a=>a.key).join(', ')+')');
      if (!naar) return;
      try {
        await API.call('/supplier/dorp/stuurdoor', { id: b.dataset.pkdstuur, naar: naar.trim().toLowerCase() });
        toast('↪ '+T('pd.dorp.gestuurd','Doorgestuurd.'));
        pkDorpAt = 0; pkToolsKant = null; pkLaadDorp();
      } catch(e){ toast(e.message); }
    }));
    // de buurt: een tik zet de naam alvast in de wens
    if (pkDorpKant === 'concierge') pkLaadBuurt();
    wrap.querySelectorAll('[data-pkdbuurt]').forEach(b => b.addEventListener('click', async () => {
      const afd = pkDorp && pkDorp.afdelingen.find(a => a.key === 'concierge');
      const waar = prompt(afd ? afd.waarHint : 'Kamer') || '';
      const tekst = prompt(T('pd.dorp.regelwat','Wat regelen we bij')+' '+b.dataset.pkdbuurt+' ('+b.dataset.soort+', '+b.dataset.km+' km)?');
      if (!tekst) return;
      try {
        await API.call('/supplier/dorp/post', { afdeling: 'concierge', waar, tekst: b.dataset.pkdbuurt+': '+tekst });
        toast(''+T('pd.dorp.gezet','Staat op de lijst.'));
        pkDorpAt = 0; pkToolsKant = null; pkLaadDorp();
      } catch(e){ toast(e.message); }
    }));
    const dn = wrap.querySelector('[data-pkdnieuw]'); if (dn) dn.addEventListener('click', async () => {
      const afd = pkDorp && (pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0]);
      if (!afd) return;
      const waar = prompt(afd.waarHint) || '';
      const tekst = prompt(afd.watHint);
      if (!tekst) return;
      try { await API.call('/supplier/dorp/post', { afdeling: afd.key, waar, tekst }); toast(afd.icon+' '+T('pd.dorp.gezet','Staat op de lijst.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-khk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/hk', { id: b.dataset.khk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-vrij]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/vrij', { id: b.dataset.vrij, op: b.dataset.op === 'aan' }); toast(b.dataset.op==='aan' ? ''+T('hk.vrijtoast','Vrijgegeven; de receptie ziet het direct.') : T('hk.vrijaf','Vrijgave intrekken')); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-defect]').forEach(b => b.addEventListener('click', async () => {
      const note = prompt(T('hk.defectq','Wat is er kapot?'), '');
      if (note === null) return;
      try { await API.call('/supplier/room/hk', { id: b.dataset.defect, status: 'defect', note }); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mb]').forEach(b => b.addEventListener('click', () => {
      mbOpen = mbOpen === b.dataset.mb ? null : b.dataset.mb;
      mbTel = {};
      renderKamers();
    }));
    wrap.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbTel[b.dataset.mbplus] = (mbTel[b.dataset.mbplus]||0)+1; renderKamers(); }));
    wrap.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbTel[b.dataset.mbmin] = Math.max(0,(mbTel[b.dataset.mbmin]||0)-1); renderKamers(); }));
    wrap.querySelectorAll('[data-mbboek]').forEach(b => b.addEventListener('click', async () => {
      const items = Object.entries(mbTel).filter(([,q]) => q > 0).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;
      try { await API.call('/supplier/minibar/count', { room: b.dataset.mbboek, items }); mbOpen = null; mbTel = {}; toast(''+T('hk.geboekt','Geboekt op de kamer.')); await refresh(); } catch(e){ toast(e.message); }
    }));
  }

  /* Hulp & zaken: EHBO-kennis direct bij de hand, de vertrouwenspersoon van
     RTG (volledig buiten de werkgever om) en de eigen administratie. */
  let hulpOpen = null, ziekArm = false;
  const EHBO_GIDS = () => lang() === 'en' ? [
    { t: 'Resuscitation (CPR)', i: '', s: ['Check consciousness and breathing; shout for help.', 'Call 112 (or have someone call) and ask for an AED.', '30 chest compressions: centre of the chest, 5-6 cm deep, 100-120 per minute.', '2 rescue breaths, then keep alternating 30 to 2.', 'Use the AED as soon as it arrives and follow its instructions.', 'Continue until professional help takes over.'] },
    { t: 'Choking', i: '', s: ['Encourage coughing first.', 'Not working? Give up to 5 firm blows between the shoulder blades.', 'Still stuck? Up to 5 abdominal thrusts (Heimlich manoeuvre).', 'Keep alternating 5 blows and 5 thrusts; call 112 if it does not clear.'] },
    { t: 'Burns', i: '', s: ['Cool 10 to 20 minutes with lukewarm, gently running water.', 'No ice, no butter, no ointments.', 'Never pull off clothing that sticks to the skin.', 'Cover loosely with a sterile dressing; blisters or a large area: see a doctor.'] },
    { t: 'Severe bleeding', i: '', s: ['Press firmly on the wound with a clean cloth.', 'Keep pressing; do not lift it to look.', 'Raise the arm or leg if possible.', 'Call 112 for severe or spurting bleeding.'] },
    { t: 'Allergic reaction', i: '', s: ['Known allergy with an adrenaline pen? Use it on the outside of the thigh.', 'Call 112 for swelling of face or throat, or trouble breathing.', 'Loosen tight clothing; let the person sit or lie comfortably.', 'Stay with them; a second dose can be needed after 5 to 15 minutes.'] },
    { t: 'Unconscious but breathing', i: '', s: ['Place the person on their side (recovery position), head tilted back.', 'Call 112.', 'Keep checking the breathing until help arrives.'] },
    { t: 'Heart attack or stroke', i: '', s: ['Heart attack: pressure on the chest, pain to arm or jaw, sweating. Call 112 and let the person rest half-sitting.', 'Stroke, think FAST: Face (drooping mouth), Arm (weakness), Speech (confused), Time: call 112 at once.', 'Note the time the symptoms started; the hospital needs it.'] }
  ] : [
    { t: 'Reanimatie', i: '', s: ['Controleer bewustzijn en ademhaling; roep om hulp.', 'Bel 112 (of laat bellen) en vraag om een AED.', '30 borstcompressies: midden op de borst, 5-6 cm diep, 100-120 per minuut.', '2 beademingen, en blijf wisselen: 30 om 2.', 'Gebruik de AED zodra die er is en volg de gesproken instructies.', 'Ga door tot professionele hulp het overneemt.'] },
    { t: 'Verslikking', i: '', s: ['Laat eerst flink hoesten.', 'Helpt dat niet? Geef maximaal 5 stevige klappen tussen de schouderbladen.', 'Zit het nog vast? Maximaal 5 buikstoten (Heimlich-greep).', 'Blijf wisselen: 5 klappen, 5 stoten. Bel 112 als het niet loskomt.'] },
    { t: 'Brandwond', i: '', s: ['Koel 10 tot 20 minuten met lauw, zacht stromend water.', 'Geen ijs, geen boter, geen zalf.', 'Trek kleding die aan de huid plakt nooit los.', 'Dek losjes af met steriel verband; blaren of een groot oppervlak: naar een arts.'] },
    { t: 'Ernstige bloeding', i: '', s: ['Druk stevig op de wond met een schone doek.', 'Blijf drukken; til de doek niet op om te kijken.', 'Houd de arm of het been omhoog als dat kan.', 'Bel 112 bij een ernstige of spuitende bloeding.'] },
    { t: 'Allergische reactie', i: '', s: ['Bekende allergie met een adrenalinepen? Zet die op de buitenkant van het bovenbeen.', 'Bel 112 bij een opgezwollen gezicht of keel, of moeite met ademen.', 'Maak knellende kleding los; laat rustig zitten of liggen.', 'Blijf erbij; na 5 tot 15 minuten kan een tweede dosis nodig zijn.'] },
    { t: 'Bewusteloos, maar ademt', i: '', s: ['Leg de persoon op de zij (stabiele zijligging), hoofd iets achterover.', 'Bel 112.', 'Blijf de ademhaling controleren tot er hulp is.'] },
    { t: 'Hartaanval of beroerte', i: '', s: ['Hartaanval: drukkende pijn op de borst, uitstraling naar arm of kaak, zweten. Bel 112 en laat halfzittend rusten.', 'Beroerte, denk aan FAST: Face (scheve mond), Arm (uitvalt), Speech (verwarde spraak), Time: bel direct 112.', 'Noteer hoe laat de klachten begonnen; het ziekenhuis heeft dat nodig.'] }
  ];
  // Training & tips: micro-learning in de PDA. Rol-bewuste tips, een tip van de
  // dag, een AI-coach en (voor de manager) eigen huistips van de zaak.
  // De trainingskaart is met het componentframework (Util.el) gebouwd: tekst
  // wordt structureel als tekstknoop gezet (dus altijd veilig ge-escaped) en de
  // knoppen dragen hun eigen handler. renderHulp laat er een plek voor open
  // (#trainKaart); vulTrainingKaart() tekent hem daarin, ook na een klik.
  function trainingKaart(){ return trainData ? '<div id="trainKaart"></div>' : ''; }
  function vulTrainingKaart(){
    const c = document.getElementById('trainKaart');
    if (!c || !window.Util) return;
    const node = bouwTrainingKaart();
    Util.vervang(c, node || document.createTextNode(''));
  }
  function bouwTrainingKaart(){
    if (!trainData) return null;
    const E = Util.el, t = trainData, tvd = t.tipVanDeDag;
    const alle = t.tips || [], eigen = t.eigen || [], gelezen = t.gelezen || [];
    const totaal = alle.length, klaar = gelezen.filter(g => alle.some(x => x.t === g)).length;
