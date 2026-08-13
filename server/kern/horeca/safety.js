/* Harde veiligheidsgrens voor Hospitality Spatial Command. Rahul krijgt alleen
   een oordeel terug; hij kan deze regels niet aanpassen. */
'use strict';
const ALCOHOL=/bar|barman|sommelier|bedien|manager|chef/i, KEUKEN=/kok|chef|keuken|pas|sous/i;
function beoordeel({ medewerker, acties, allergie, noodrouteVrij=true, ingeklokt }){
  const bezwaren=[];const func=String(medewerker&&medewerker.func||'');
  if(!medewerker||!ingeklokt)bezwaren.push('medewerker is niet ingeklokt');
  if((acties||[]).some(a=>a.soort==='alcohol')&&!ALCOHOL.test(func))bezwaren.push('alcoholhandeling valt buiten de functie');
  if((acties||[]).some(a=>a.soort==='keuken')&&!KEUKEN.test(func))bezwaren.push('keukenhandeling valt buiten de functie');
  if(allergie)bezwaren.push('allergie vereist een menselijke dubbelcheck vóór uitserveren');
  if(!noodrouteVrij)bezwaren.push('de voorgestelde route raakt een geblokkeerde noodroute');
  return {mag:bezwaren.length===0,bezwaren,menselijkeCheck:!!allergie};
}
module.exports={beoordeel};
