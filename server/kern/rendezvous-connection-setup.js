'use strict';

module.exports = ({ R, db, save, crypto, media, schoon, mag, geblokkeerd, connectionBlocking,
  connectionMediaTicketSecret, notify, sseToCustomer }) => {
  const pair=(a,b)=>[a,b].sort().join('|');
  const isMatch=(a,b)=>!!(R().likes[a]&&R().likes[a][b]&&R().likes[b]&&R().likes[b][a]);
  const profileMedia=require('./connection-profile-media')({product:'rendezvous',db,save,crypto,media,schoon,
    gate:mag,isBlocked:(a,b)=>geblokkeerd(R(),a,b),isMatch,
    profileActive:owner=>!!(R().profielen[owner]&&R().profielen[owner].aan),
    deliveryBase:'/api/member/rendezvous/profile-photo/delivery/',ticketSecret:connectionMediaTicketSecret});
  const communication=require('./connection-communication')({product:'rendezvous',db,save,crypto,media,schoon,
    ticketSecret:connectionMediaTicketSecret,notify,signal:sseToCustomer,isBlocked:(a,b)=>geblokkeerd(R(),a,b),
    resolveContext:(actor,input)=>{
      const value=String(input&&input.id||'');
      if(value.includes('|')){const intro=(R().introducties||{})[value],parts=value.split('|');
        if(intro&&intro.geopend&&parts.includes(actor))return {counterpart:parts[0]===actor?parts[1]:parts[0],scope:value};
        const other=parts.length===2&&parts.includes(actor)?(parts[0]===actor?parts[1]:parts[0]):'';
        if(other&&isMatch(actor,other))return {counterpart:other,scope:value};}
      if(value&&isMatch(actor,value))return {counterpart:value,scope:pair(actor,value)};
      return null;
    }});
  if(connectionBlocking&&connectionBlocking.onBlock)connectionBlocking.onBlock((a,b)=>communication.terminatePair(a,b,'BLOCKED'));
  return {profileMedia,communication};
};
