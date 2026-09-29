'use strict';

module.exports = ({ d, save, nu, geblokkeerd, codenaamVan, pay, reserveerTafel, notify, partnerEligible,
  PRIJS_CENTEN, RTG_CENTEN }) => async function betaal(key, mid) {
  const m=d().matches.find(x=>x.id===mid&&(x.a===key||x.b===key));
  if(!m)return {status:404,error:'Deze match bestaat niet.'};
  const ander=m.a===key?m.b:m.a;
  if(geblokkeerd(key,ander))return {status:403,error:'Dit contact is geblokkeerd.'};
  if(!m.tafel)return {status:409,error:'Er is geen tafel om te bevestigen; spreek zelf iets af in de chat.'};
  const boek=op=>pay.boekAsync(op);
  const deelname=()=>partnerEligible(m.tafel.supplierCode,{date:m.tafel.datum,time:m.tafel.tijd,service:m.tafel.soort||'diner'});
  const terug=async(wie,reden)=>{
    if(!m.betaald[wie]||(m.participationRefunded&&m.participationRefunded[wie]))return;
    const naam=codenaamVan(wie);
    await boek({van:'extern:vonk-rtg',naar:'lid:'+naam,centen:RTG_CENTEN,soort:'terug',oms:reden,
      ref:m.id+':'+wie+':participation-refund-rtg',economischeSleutel:'vonk:'+m.id+':'+wie+':participation-refund-rtg'});
    await boek({van:'partner:'+m.tafel.supplierCode,naar:'lid:'+naam,centen:PRIJS_CENTEN-RTG_CENTEN,soort:'terug',oms:reden,
      ref:m.id+':'+wie+':participation-refund-partner',economischeSleutel:'vonk:'+m.id+':'+wie+':participation-refund-partner'});
    m.participationRefunded=m.participationRefunded||{};m.participationRefunded[wie]=nu();delete m.betaald[wie];
  };
  const sluit=async()=>{
    for(const wie of [m.a,m.b])await terug(wie,'Vonk-date vervallen: partner neemt niet meer deel');
    m.participationClosedAt=nu();m.status='wacht-op-betaling';m.halfweg={opties:[],waarom:{deelname:1},keuzes:{}};m.tafel=null;save();
  };
  if(!m.reserveringId&&!deelname()){
    await sluit();
    return {status:409,code:'PARTNER_NOT_PARTICIPATING',error:'Deze partner neemt niet meer deel aan nieuwe Vonk-dates. Eventuele betaling is teruggedraaid.'};
  }
  if(m.betaald[key])return {status:200,ok:true,al:true,status2:m.status};
  m.paymentInFlight=m.paymentInFlight||{};
  if(m.paymentInFlight[key])return {status:409,code:'PAYMENT_IN_PROGRESS',error:'Uw betaling wordt al verwerkt.'};
  m.paymentInFlight[key]=nu();save();
  const naam=codenaamVan(key);
  const basis={van:'lid:'+naam,soort:'vonk'};
  try {
    const r1=await boek({...basis,naar:'extern:vonk-rtg',centen:RTG_CENTEN,oms:'Vonk-date, deel RTG',
      ref:m.id+':'+key+':rtg',economischeSleutel:'vonk:'+m.id+':'+key+':rtg'});
    if(r1&&r1.error)return {status:402,error:r1.error};
    if(!deelname()){
      await boek({van:'extern:vonk-rtg',naar:'lid:'+naam,centen:RTG_CENTEN,soort:'terug',oms:'Vonk-date vervallen: partner nam deelname in',ref:m.id+':'+key+':participation-race-rtg',economischeSleutel:'vonk:'+m.id+':'+key+':participation-race-rtg'});
      await sluit();return {status:409,code:'PARTNER_NOT_PARTICIPATING',error:'De partner heeft de deelname tijdens het betalen gepauzeerd. De betaling is teruggedraaid.'};
    }
    if(geblokkeerd(key,ander)){
      await boek({van:'extern:vonk-rtg',naar:'lid:'+naam,centen:RTG_CENTEN,soort:'terug',oms:'Vonk-date geblokkeerd, teruggeboekt',ref:m.id+':'+key+':block-refund',economischeSleutel:'vonk:'+m.id+':'+key+':block-refund'});
      return {status:409,error:'De verbinding is tijdens het betalen gesloten.'};
    }
    const r2=await boek({...basis,naar:'partner:'+m.tafel.supplierCode,centen:PRIJS_CENTEN-RTG_CENTEN,
      oms:'Vonk-date, aanbetaling zaak',ref:m.id+':'+key+':partner',economischeSleutel:'vonk:'+m.id+':'+key+':partner'});
    if(r2&&r2.error){await boek({van:'extern:vonk-rtg',naar:'lid:'+naam,centen:RTG_CENTEN,soort:'terug',oms:'Vonk-date niet doorgegaan, teruggeboekt',ref:m.id+':'+key+':refund',economischeSleutel:'vonk:'+m.id+':'+key+':refund'});return {status:402,error:r2.error};}
    if(!deelname()){
      await boek({van:'extern:vonk-rtg',naar:'lid:'+naam,centen:RTG_CENTEN,soort:'terug',oms:'Vonk-date vervallen: partner nam deelname in',ref:m.id+':'+key+':participation-race2-rtg',economischeSleutel:'vonk:'+m.id+':'+key+':participation-race2-rtg'});
      await boek({van:'partner:'+m.tafel.supplierCode,naar:'lid:'+naam,centen:PRIJS_CENTEN-RTG_CENTEN,soort:'terug',oms:'Vonk-date vervallen: partner nam deelname in',ref:m.id+':'+key+':participation-race2-partner',economischeSleutel:'vonk:'+m.id+':'+key+':participation-race2-partner'});
      await sluit();return {status:409,code:'PARTNER_NOT_PARTICIPATING',error:'De partner heeft de deelname tijdens het betalen gepauzeerd. De betaling is teruggedraaid.'};
    }
    if(geblokkeerd(key,ander)){
      await boek({van:'extern:vonk-rtg',naar:'lid:'+naam,centen:RTG_CENTEN,soort:'terug',oms:'Vonk-date geblokkeerd, teruggeboekt',ref:m.id+':'+key+':block-refund-rtg',economischeSleutel:'vonk:'+m.id+':'+key+':block-refund-rtg'});
      await boek({van:'partner:'+m.tafel.supplierCode,naar:'lid:'+naam,centen:PRIJS_CENTEN-RTG_CENTEN,soort:'terug',oms:'Vonk-date geblokkeerd, teruggeboekt',ref:m.id+':'+key+':block-refund-partner',economischeSleutel:'vonk:'+m.id+':'+key+':block-refund-partner'});
      return {status:409,error:'De verbinding is tijdens het betalen gesloten.'};
    }
    m.betaald[key]=nu();
    if(m.betaald[ander]&&!m.reserveringId&&!m.reservationInFlight){
      m.reservationInFlight=nu();save();let r;
      try{r=await Promise.resolve(reserveerTafel({key,tier:'rtg'},codenaamVan(m.a)+' & '+codenaamVan(m.b),{
        supplierCode:m.tafel.supplierCode,datum:m.tafel.datum,tijd:m.tafel.tijd,personen:2,
        notitie:'Vonk-date (aanbetaling voldaan)',idempotencyKey:'vonk:'+m.id+':reservation'}));}
      catch(e){r={error:'De reserveringsprovider reageerde niet.'};}
      delete m.reservationInFlight;m.status=r&&r.ok?'bevestigd':'betaald';m.reserveringId=r&&r.ok?r.reservering.id:null;
      if(r&&r.ok)for(const wie of [m.a,m.b])try{notify(wie,{icon:'bar',title:'De date staat',body:m.tafel.supplierName+', '+m.tafel.datum+' '+m.tafel.tijd+'. Veel plezier!'});}catch(e){}
    }
    return {status:200,ok:true,status2:m.status};
  } catch(e) { return {status:502,error:'De betaling kon niet veilig worden afgerond.'}; }
  finally { delete m.paymentInFlight[key];save(); }
};
