/* Tijdelijke Live Circles rond een reis of afspraak.

   Dit is nadrukkelijk geen tweede vriendenlijst en geen permanent volgspoor.
   Een Moment legt vier dingen vast: wie, wat, waarvoor en tot wanneer. De
   ontvanger krijgt een afgeleid beeld; nooit de volledige opgeslagen rij.
   Exacte locatie kan alleen naar een bestaande RTG-connectie, nooit naar een
   bedrijf. Aankomsttijd en voortgang mogen wel naar een betrokken bedrijf.
   Na de eindtijd levert de kern niets meer uit en een stop wist de laatste plek. */

/* De tijd komt van de tijdmachine (server/lib/klok.js) en niet van het
   besturingssysteem. Wie rechtstreeks aan het OS vraagt hoe laat het is, doet
   niet mee aan RTG_KLOK en is dus niet te beproeven op een schrikkeldag, een
   zomertijdgrens of een verlopen mandaat -- en dan is de tijdmachine precies
   zoveel waard als het aantal modules dat meedoet (scripts/klok.js). */
const klok = require('../../lib/klok');
module.exports = ({ db, save, crypto, schoon, sociaal, plek }) => {
  const MAX_DUUR_MIN = 48 * 60;
  const STATUSSEN = new Set(['gepland', 'onderweg', 'vertraagd', 'bijna-aangekomen', 'aangekomen', 'geannuleerd']);
  const NIVEAUS = new Set(['plan', 'voortgang', 'locatie']);
  const nu = () => klok.datum().toISOString();

  function lijst() {
    if (!db.data.veilig) db.data.veilig = {};
    if (!db.data.veilig.momenten) db.data.veilig.momenten = [];
    return db.data.veilig.momenten;
  }
  const actief = m => m.status !== 'gestopt' && m.tot > klok.nu();
  const codenaam = h => sociaal.codenaamVan(h) || h;
  function ontvanger(r) { return { soort: r.soort, id: r.id, naam: r.naam, niveau: r.niveau }; }
  function eigenBeeld(m) {
    return { id:m.id, titel:m.titel, doel:m.doel, status:m.status, eta:m.eta || null, van:m.van, tot:new Date(m.tot).toISOString(),
      gepauzeerd:!!m.gepauzeerd, ritRef:m.ritRef || null, ontvangers:m.ontvangers.map(ontvanger), bijgewerkt:m.bijgewerkt };
  }
  function gedeeldBeeld(m, r) {
    const b={ id:m.id, titel:m.titel, doel:m.doel, status:m.status, eta:m.eta || null, niveau:r.niveau,
      eigenaar:codenaam(m.handle), bijgewerkt:m.bijgewerkt, tot:new Date(m.tot).toISOString() };
    if (r.niveau === 'plan') delete b.status;
    if (r.niveau === 'locatie' && r.soort === 'contact') b.plek=plek.plekVoorContact(m.handle,true);
    return b;
  }
  function schoonOntvangers(handle, invoer) {
    const uit=[];
    for (const x of Array.isArray(invoer)?invoer:[]) {
      const soort=x && x.soort === 'bedrijf'?'bedrijf':'contact';
      const id=schoon(x && (x.id || x.handle || x.code),40).trim();
      if (!id || uit.some(r=>r.soort===soort&&r.id===id)) continue;
      let niveau=NIVEAUS.has(x.niveau)?x.niveau:'voortgang';
      if (soort==='contact') {
        if (id===handle || !sociaal.zijnVrienden(handle,id)) continue;
        uit.push({soort,id,naam:codenaam(id),niveau});
      } else {
        if (niveau==='locatie') niveau='voortgang';
        uit.push({soort,id:id.toUpperCase(),naam:schoon(x.naam,60)||id.toUpperCase(),niveau});
      }
      if (uit.length>=12) break;
    }
    return uit;
  }
  function maak(handle, body) {
    const ontvangers=schoonOntvangers(handle,body.ontvangers);
    if (!ontvangers.length) return {status:400,error:'Kies minstens één verbonden persoon of betrokken bedrijf.'};
    const minuten=Math.max(5,Math.min(MAX_DUUR_MIN,Math.round(Number(body.minuten)||180)));
    const m={id:crypto.randomBytes(6).toString('hex'),handle,titel:schoon(body.titel,80)||'Onderweg',doel:schoon(body.doel,100)||null,
      status:'gepland',eta:body.eta?schoon(body.eta,35):null,van:nu(),tot:klok.nu()+minuten*60000,ontvangers,gepauzeerd:false,
      ritRef:schoon(body.ritRef,30)||null,bijgewerkt:nu(),log:[{at:nu(),soort:'gemaakt'}]};
    lijst().push(m);save();return {status:200,ok:true,moment:eigenBeeld(m)};
  }
  function mijn(handle) { return {momenten:lijst().filter(m=>m.handle===handle&&actief(m)).map(eigenBeeld),voorMij:voorContact(handle)}; }
  function vind(handle,id){return lijst().find(m=>m.id===id&&m.handle===handle)}
  function zetStatus(handle,id,body) {
    const m=vind(handle,id);if(!m)return {status:404,error:'Dit Moment bestaat niet.'};
    if(!actief(m))return {status:409,error:'Dit Moment is afgelopen.'};
    const status=String(body.status||'');if(!STATUSSEN.has(status))return {status:400,error:'Onbekende voortgang.'};
    m.status=status;if(body.eta!==undefined)m.eta=schoon(body.eta,35)||null;m.bijgewerkt=nu();m.log.push({at:m.bijgewerkt,soort:'status',status});
    if(status==='aangekomen'||status==='geannuleerd'){m.tot=Math.min(m.tot,klok.nu()+15*60000);delete m.laatstePlek}
    save();return {status:200,ok:true,moment:eigenBeeld(m)};
  }
  function pauze(handle,id,aan) { const m=vind(handle,id);if(!m)return {status:404,error:'Dit Moment bestaat niet.'};m.gepauzeerd=aan!==false;m.bijgewerkt=nu();save();return {status:200,ok:true,moment:eigenBeeld(m)}; }
  function stop(handle,id) { const m=vind(handle,id);if(!m)return {status:404,error:'Dit Moment bestaat niet.'};m.status='gestopt';m.tot=klok.nu();m.gepauzeerd=true;m.bijgewerkt=nu();delete m.laatstePlek;save();return {status:200,ok:true}; }
  function voorContact(handle) { return lijst().filter(m=>actief(m)&&!m.gepauzeerd).flatMap(m=>m.ontvangers.filter(r=>r.soort==='contact'&&r.id===handle).map(r=>gedeeldBeeld(m,r))); }
  function voorBedrijf(code) { const c=String(code||'').toUpperCase();return lijst().filter(m=>actief(m)&&!m.gepauzeerd).flatMap(m=>m.ontvangers.filter(r=>r.soort==='bedrijf'&&r.id===c).map(r=>gedeeldBeeld(m,r))); }
  return { momentMaak:maak,momentMijn:mijn,momentStatus:zetStatus,momentPauze:pauze,momentStop:stop,momentVoorContact:voorContact,momentVoorBedrijf:voorBedrijf };
};
