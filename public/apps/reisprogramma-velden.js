/* Dezelfde vrije reisvelden voor Rome, rondreizen en intercontinentale reizen. */
(function(w){
'use strict';
const velden=[['titel','Omschrijving'],['soort','Soort'],['status','Status'],['datum','Vertrek / begin','date'],['tijd','Lokale begintijd','time'],['zone','Tijdzone vertrek / begin'],['eindDatum','Aankomst / einde','date'],['eindTijd','Lokale eindtijd','time'],['eindZone','Tijdzone aankomst / einde'],['vertrek','Vertrekadres / ontmoetingspunt'],['aankomst','Aankomstadres / locatie'],['aanbieder','Aanbieder / hotel / luchtvaartmaatschappij'],['contact','Contactpersoon en bereikbaarheidsgegevens'],['kenmerk','Vlucht- of reserveringsnummer'],['klasse','Kamertype / voertuig / serviceklasse'],['bevestiging','Bevestigingsbron (bijv. e-mail van aanbieder)'],['instructies','Praktische instructies','textarea']];
const soorten={'transfer':'Transfer','vlucht':'Vlucht','verblijf':'Hotel / villa','activiteit':'Activiteit','taxi':'Taxi / privéchauffeur','tafel':'Restaurant','lounge':'Lounge','meet-greet':'Meet & greet','concierge':'Concierge','charter':'Privéjet / charter','spoor':'Trein','huurauto':'Huurauto','vrij':'Eigen onderdeel'};
const standen={voorstel:'Voorstel',aangevraagd:'Aangevraagd',bevestigd:'Bevestigd',gewijzigd:'Gewijzigd',geannuleerd:'Geannuleerd'};
function veld(k,label,type,value,prefix='rp'){
 const wrap=document.createElement('label');wrap.textContent=label;
 const el=document.createElement(type==='textarea'?'textarea':k==='soort'||k==='status'?'select':'input');
 el.id=prefix+'-'+k;el.name=k;el.className='veld';
 if(el.tagName==='INPUT')el.type=type||'text';
 if(el.tagName==='SELECT')for(const [v,n]of Object.entries(k==='soort'?soorten:standen)){const o=document.createElement('option');o.value=v;o.textContent=n;el.append(o);}
 if(k==='zone'||k==='eindZone'){el.setAttribute('list','rp-zones');el.placeholder='Europe/Rome, Asia/Tokyo…';}
 el.value=value==null?'':value;el.maxLength=type==='textarea'?2000:300;wrap.append(el);return wrap;
}
function nieuw(){return {soort:'transfer',titel:'',status:'voorstel',zone:'',eindZone:''};}
function basis(){return {titel:'',bestemming:'',personen:1,intro:'',contactNaam:'',contactTelefoon:'',contactEmail:'',onderdelen:[]};}
function sjabloon(){return [['transfer','Van huis naar de luchthaven'],['vlucht','Heenvlucht'],['taxi','Van luchthaven naar verblijf'],['verblijf','Uw verblijf'],['activiteit','Activiteiten op bestemming'],['taxi','Van verblijf naar luchthaven'],['vlucht','Terugvlucht'],['transfer','Van luchthaven naar huis']].map(([soort,titel])=>({...nieuw(),soort,titel}));}
w.RTGReisVelden={velden,soorten,standen,veld,nieuw,basis,sjabloon};
})(window);
