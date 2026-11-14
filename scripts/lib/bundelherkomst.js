/* Een brondeel krijgt uitsluitend het bestaande budget van zijn bytegelijke
   browserowner. Ruwe metingen blijven intact; geen opgeslagen attest vertrouwen.
   Dit consolideert uitsluitend BRONBUDGET, niet runtime-uitvoering. De beperkte
   literalcontrole bewijst geen afwezigheid van berekende directe partloads.
   DS-laadgraaf en contractFouten blijven zelfstandig fail-closed: bronherkomst
   mag hun onzekerheid/injecties nooit wissen of een scherm kwalificeren. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
function herkomst({publiek,register,injectie,norm,tel,verwijzingen}){
 const eigenaars=new Map(),rijen=[],fouten=[],delen=new Set();
 for(const [owner,map] of Object.entries(register)){
  const dir=path.join(publiek,map);let files=[];
  try{files=fs.readdirSync(dir).filter(n=>n.endsWith('.js')).sort().map(n=>path.join(dir,n));}catch{}
  const rij={owner:'public/'+owner,file:path.join(publiek,owner),files};rijen.push(rij);
  for(const f of files){const p='public/'+path.relative(publiek,f).split(path.sep).join('/');if(!eigenaars.has(p))eigenaars.set(p,[]);eigenaars.get(p).push(rij);}
 }
 for(const rij of rijen){
  const kandidaten=rij.files.map(f=>'public/'+path.relative(publiek,f).split(path.sep).join('/')).filter(p=>injectie[p]&&norm[p]===undefined);
  if(!kandidaten.length)continue;
  function fout(waarom){fouten.push(rij.owner+': ongeldige bundelherkomst: '+waarom);}
  if(norm[rij.owner]===undefined){fout('owner heeft geen bestaand injectiebudget');continue;}
  if(!rij.files.length||!fs.existsSync(rij.file)){fout('owner of delen ontbreken');continue;}
  const content=fs.readFileSync(rij.file),parts=rij.files.map(f=>fs.readFileSync(f));
  if(!content.equals(Buffer.concat(parts))){fout('browserbestand wijkt af van bronparts');continue;}
  if(injectie[rij.owner]!==tel(content.toString())){fout('ownermeting ontbreekt of is verouderd');continue;}
  let geldig=true;
  for(let i=0;i<rij.files.length;i++){
   const p='public/'+path.relative(publiek,rij.files[i]).split(path.sep).join('/'),n=tel(parts[i].toString());
   if(eigenaars.get(p).length!==1){fout('deel heeft meerdere owners: '+p);geldig=false;}
   if((injectie[p]||0)!==n){fout('deelmeting ontbreekt of is verouderd: '+p);geldig=false;}
   if((typeof verwijzingen==='function'?verwijzingen():verwijzingen).has(p)){fout('deel wordt rechtstreeks geladen: '+p);geldig=false;}
  }
  if(geldig)kandidaten.forEach(p=>delen.add(p));
 }
 return {delen,fouten};
}
module.exports={herkomst};
