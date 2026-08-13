/* De publieke voordeur van Invisible Arrival. De route bewaart uitsluitend de
   hash van een tijdelijke bezitssleutel; deze laag remt, herkent en laat een
   geldige, niet-verlopen pass door. */
'use strict';
const rem=require('../../../rem');

module.exports=({crypto,db})=>{
  const interpretRem=rem({windowMs:60000,limit:30,key:req=>'arrival-interpret|'+req.ip});
  const requestRem=rem({windowMs:15*60000,limit:8,key:req=>'arrival-request|'+req.ip});
  const passRem=rem({windowMs:60000,limit:60,key:req=>'arrival-pass|'+req.ip});
  const pulseRem=rem({windowMs:60000,limit:20,key:req=>'arrival-pulse|'+req.ip});
  function hash(waarde){return crypto.createHash('sha256').update(String(waarde)).digest('hex')}
  function gelijk(a,b){const x=Buffer.from(String(a||''),'hex'),y=Buffer.from(String(b||''),'hex');return x.length===32&&y.length===32&&crypto.timingSafeEqual(x,y)}
  function toegang(raw){const token=String(raw||'');if(!/^[A-Za-z0-9_-]{20,80}\.[A-Za-z0-9_-]{20,80}$/.test(token))return null;return{token,id:token.split('.')[0]}}
  function vind(raw){const cred=toegang(raw);if(!cred)return null;for(const [code,h]of Object.entries(db.data.horeca||{})){const a=(h.arrivals||{})[cred.id];if(a&&gelijk(a.passHash,hash(cred.token)))return{code,a}}return null}
  function arrivalPassAuth(req,res,next){const v=vind((req.body||{}).pass);if(!v)return res.status(401).json({error:'Deze Arrival Pass is niet geldig.'});if(Date.parse(v.a.vervaltAt)<Date.now())return res.status(410).json({error:'Deze Arrival Pass is verlopen.'});req.arrival=v;next()}
  return{interpretRem,requestRem,passRem,pulseRem,hash,gelijk,toegang,arrivalPassAuth};
};
