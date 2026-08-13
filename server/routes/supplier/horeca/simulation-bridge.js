/* Eenrichtingspoorten rond Magnaat. Export is geanonimiseerd; terug komt alleen
   een voorstel dat een manager kan lezen, nooit een mutatie van de zaak. */
'use strict';
module.exports=kern=>{const{app,supplierAuth,managerOnly,db,crypto,save,horeca}=kern,{H,nu}=horeca;
  const B=()=>db.data.magnaatBrug=db.data.magnaatBrug||{};
  app.post('/api/supplier/horeca/simulatie/maak',supplierAuth,(req,res)=>{
    if(!managerOnly(req,res))return;
    const h=H(req.supplier.code),code=crypto.randomBytes(4).toString('hex').toUpperCase();
    const open=Object.values(h.rekeningen||{}).filter(r=>r.status==='open');
    B()[code]={code,supplierCode:req.supplier.code,vervaltAt:Date.now()+24*3600000,gebruikt:false,
      bron:{soort:'live-geanonimiseerd',tafels:(req.supplier.tables||[]).length,
        menu:(req.supplier.menu||[]).length,openRekeningen:open.length,
        gasten:open.reduce((n,r)=>n+(r.gasten||0),0),medewerkers:(req.supplier.staff||[]).length},
      voorstellen:[],gemaaktAt:nu()};
    save();
    res.json({ok:true,code,vervaltAt:B()[code].vervaltAt,
      let:'Deze code bevat alleen tellingen en verloopt binnen 24 uur.'});
  });
  app.post('/api/supplier/horeca/simulatie/voorstellen',supplierAuth,(req,res)=>{
    if(!managerOnly(req,res))return;
    const x=B()[String(req.body.code||'').toUpperCase()];
    if(!x||x.supplierCode!==req.supplier.code)return res.status(404).json({error:'Simulatiebrug niet gevonden.'});
    res.json({ok:true,voorstellen:x.voorstellen||[],bron:x.bron,
      let:'Dit zijn voorstellen; er is niets live gewijzigd.'});
  });
};
