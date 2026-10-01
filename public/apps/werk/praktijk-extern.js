(function () {
  'use strict';
  const e=window.RTGWerk.esc;
  window.RTGPraktijkExtern={formulier:x=>{
    const taken=x.taken.filter(t=>t.externeAfspraak && t.externeAfspraak.herkomst !== 'rtg-aanvraag');
    return '<details data-pr-open="extern"><summary>Externe afspraken en onderdelen · '+taken.length+'</summary><p>Noteer wat u zelf buiten RTG heeft geregeld, zoals een levering, verhuur, vervoer of ingehuurde specialist.</p>'+taken.map(t=>'<p><b>'+e(t.titel)+'</b> · '+e(t.wie)+' · '+e(t.externeAfspraak.stand)+'<br>'+e(t.externeAfspraak.bron)+'</p>').join('')+
      '<form data-pr="stap" data-project="'+e(x.id)+'" data-stap="extern">'+
      '<label>Onderdeel kiezen<select aria-label="Onderdeel kiezen" name="taakId"><option value="">Nieuw onderdeel</option>'+taken.map(t=>'<option value="'+e(t.id)+'">'+e(t.titel)+'</option>').join('')+'</select></label>'+
      '<label>Wat wordt geregeld?<input name="onderdeel" maxlength="120" required></label><label>Uitvoerende partij<input name="leverancier" maxlength="80" required></label>'+
      '<label>Datum (optioneel)<input type="date" name="datum"></label><label>Stand<select aria-label="Externe stand" name="externeStand">'+['onbekend','aangevraagd','bevestigd','uitgevoerd','geannuleerd'].map(s=>'<option>'+s+'</option>').join('')+'</select></label>'+
      '<label>Bevestiging of bewijsreferentie<input name="bron" maxlength="200"></label><p>RTG registreert uw opgave. Deze handeling reserveert, verstuurt of betaalt niets bij de externe partij.</p>'+
      '<button class="knop" type="submit">Extern onderdeel bewaren</button></form></details>';
  }};
})();
