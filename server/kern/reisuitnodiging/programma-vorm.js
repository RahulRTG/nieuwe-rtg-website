/* Handmatige reisregie; geen boeking, klantprofiel of betalingsadministratie.
   Alleen expliciet toegestane velden kunnen in het gedeelde programma komen. */
'use strict';
const soorten = ['transfer','vlucht','verblijf','activiteit','taxi','tafel','lounge','meet-greet','concierge','charter','spoor','huurauto','vrij'];
const standen = ['voorstel','aangevraagd','bevestigd','gewijzigd','geannuleerd'];
const tekst = (v,n=160) => String(v == null ? '' : v).trim().slice(0,n);
const datum = v => {const d=new Date(String(v)+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(String(v))&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;};
function zone(v) { try { new Intl.DateTimeFormat(undefined,{timeZone:v}).format(); return !!v; } catch(e){return false;} }
function vorm(p,publiceer) {
  if (!p || typeof p!=='object' || !Array.isArray(p.onderdelen) || p.onderdelen.length>80)
    throw new Error('Een programma bevat maximaal 80 onderdelen.');
  const uit={titel:tekst(p.titel),bestemming:tekst(p.bestemming,80),personen:Number(p.personen),intro:tekst(p.intro,1500),
    contactNaam:tekst(p.contactNaam,100),contactTelefoon:tekst(p.contactTelefoon,40),contactEmail:tekst(p.contactEmail,160),onderdelen:[]};
  if(!uit.titel || !Number.isInteger(uit.personen)||uit.personen<1||uit.personen>50)throw new Error('Vul een reistitel en 1 tot 50 reizigers in.');
  if(uit.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uit.contactEmail))throw new Error('Controleer het contact-e-mailadres.');
  for(const o of p.onderdelen){
    if(!o||!soorten.includes(o.soort)||!standen.includes(o.status)||!tekst(o.titel))throw new Error('Elk onderdeel heeft een titel, soort en geldige status nodig.');
    const r={};
    for(const [k,n] of Object.entries({titel:160,soort:24,status:24,datum:10,eindDatum:10,tijd:5,eindTijd:5,zone:80,eindZone:80,
      vertrek:300,aankomst:300,aanbieder:160,contact:240,kenmerk:100,klasse:100,instructies:2000,bevestiging:300}))r[k]=tekst(o[k],n);
    if((r.datum&&!datum(r.datum))||(r.eindDatum&&!datum(r.eindDatum)))throw new Error('Controleer de datums van '+r.titel+'.');
    if(publiceer&&!r.datum)throw new Error('Vul de datum in voor '+r.titel+'.');
    for(const k of ['tijd','eindTijd'])if(r[k]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r[k]))throw new Error('Controleer de tijd van '+r.titel+'.');
    for(const k of ['zone','eindZone'])if(r[k]&&!zone(r[k]))throw new Error('Gebruik een geldige tijdzone, bijvoorbeeld Europe/Rome.');
    if((r.tijd&&!r.zone)||(r.eindTijd&&!r.eindZone))throw new Error('Vul bij iedere tijd de plaatselijke tijdzone in.');
    if(r.eindDatum&&r.datum&&r.zone===r.eindZone&&r.eindDatum<r.datum)throw new Error('De einddatum ligt vóór de begindatum.');
    if(r.status==='bevestigd'&&!r.bevestiging)throw new Error('Vermeld waarop de bevestiging van '+r.titel+' berust.');
    uit.onderdelen.push(r);
  }
  if(publiceer&&!uit.onderdelen.length)throw new Error('Voeg eerst een reisonderdeel toe.');
  return uit;
}
module.exports={vorm,datum};
