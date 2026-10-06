'use strict';
// Een handmatige vastlegging van buiten RTG; dit voert geen externe boeking uit.
const V = require('./praktijk-vorm');
module.exports = ({ rid, nu, log }) => (w, actor, p, b) => {
  const x = V.details(w, p);
  if (['afgerond','geannuleerd'].includes(x.stand)) return V.fout('Dit werk is gesloten.',409);
  if (!['onbekend','aangevraagd','bevestigd','uitgevoerd','geannuleerd'].includes(b.externeStand)) return V.fout('Kies de werkelijke externe stand.');
  if (!V.tekst(b.leverancier,80) || !V.tekst(b.onderdeel,120)) return V.fout('Geef de uitvoerende partij en het onderdeel.');
  if (b.datum && !V.datum(b.datum)) return V.fout('Geef een geldige datum.');
  const bron = V.tekst(b.bron,200);
  if (['bevestigd','uitgevoerd','geannuleerd'].includes(b.externeStand) && !bron) return V.fout('Noteer de bevestiging of bewijsreferentie.');
  const oud = b.taakId && V.pak(w.taken,b.taakId);
  if (oud?.externeAfspraak?.herkomst === 'rtg-aanvraag') return V.fout('Deze opdracht wordt door de leverancier bevestigd. Gebruik de leveranciersbediening.',409);
  if (b.taakId && (!oud || oud.projectId !== p.id || !oud.externeAfspraak)) return V.fout('Dit onderdeel hoort niet bij deze vraag.',404);
  if (!oud && Object.values(w.taken || {}).filter(t=>t.projectId===p.id).length>=100) return V.fout('Maximaal 100 onderdelen per vraag.',429);
  const t = oud || {id:rid(8),projectId:p.id,ouderId:null,wachtOp:[],uren:0,urenlijst:[],prioriteit:'normaal',at:nu()};
  t.titel=V.tekst(b.onderdeel,120);t.deadline=b.datum||null;t.wie=V.tekst(b.leverancier,80);
  t.kolom=b.externeStand==='uitgevoerd'?'klaar':'te doen';t.geannuleerd=b.externeStand==='geannuleerd';
  t.externeAfspraak={stand:b.externeStand,bron,herkomst:'handmatig',vastgelegdDoor:actor.id||actor.naam,at:nu()};
  if(t.kolom==='klaar'){t.klaarAt=nu();t.klaarDoor=actor.id||actor.naam;}else{t.klaarAt=null;}
  (w.taken||(w.taken={}))[t.id]=t;x.versie++;
  log(w,actor,'praktijk-extern-'+b.externeStand,p.id,bron);
  return {ok:true,projectId:p.id,taakId:t.id,versie:x.versie};
};
