/* Boardroomdeur voor de Magnaat-leerkring. Lezen en besluiten kan hier;
   automatische codewijziging of productie-uitrol bestaat bewust niet. */
'use strict';
module.exports=ctx=>{const{app,boardroomAuth,veilig,kern,sseToOffice}=ctx;
  app.post('/api/office/boardroom/magnaat/leren',boardroomAuth,(req,res)=>
    veilig(res,()=>kern.magnaatLeren.overzicht()));
  app.post('/api/office/boardroom/magnaat/besluit',boardroomAuth,(req,res)=>veilig(res,()=>{
    const r=kern.magnaatLeren.besluit(req.body.id,String(req.body.keuze||''),
      kern.boardroomWie(req)||'boardroom');
    if(r.ok)sseToOffice('sync',{scope:'magnaat-leren'});return r;
  }));
};
