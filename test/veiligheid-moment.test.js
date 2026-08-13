const test=require('node:test');
const assert=require('node:assert/strict');
const maak=require('../server/kern/veiligheid/moment');

function kern(){
  const db={data:{}},vrienden=new Set(['a:b','b:a']);
  const m=maak({db,save(){},crypto:{randomBytes(){return Buffer.from('123456789012')}},schoon(v,n){return String(v||'').slice(0,n)},
    sociaal:{codenaamVan(h){return h==='a'?'ALFA':'BRAVO'},zijnVrienden(a,b){return vrienden.has(a+':'+b)}},
    plek:{plekVoorContact(){return {lat:52.1,lon:4.3,live:true}}}});
  return {m,db};
}

test('Live Circle deelt per ontvanger alleen het toegestane beeld',()=>{
  const {m}=kern();
  const r=m.momentMaak('a',{titel:'Diner',doel:'Maison',minuten:60,ontvangers:[
    {soort:'contact',id:'b',niveau:'locatie'},{soort:'bedrijf',id:'resto',naam:'Maison',niveau:'locatie'}]});
  assert.equal(r.status,200);
  const vriend=m.momentVoorContact('b')[0],bedrijf=m.momentVoorBedrijf('RESTO')[0];
  assert.equal(vriend.plek.lat,52.1,'verbonden contact krijgt tijdelijk locatiebeeld');
  assert.equal(bedrijf.plek,undefined,'een bedrijf krijgt nooit exacte locatie');
  assert.equal(bedrijf.niveau,'voortgang','locatie wordt voor bedrijven teruggebracht tot voortgang');
});

test('pauzeren en stoppen trekken toegang direct in',()=>{
  const {m}=kern();
  const r=m.momentMaak('a',{titel:'Naar huis',ontvangers:[{soort:'contact',id:'b',niveau:'voortgang'}]});
  assert.equal(m.momentVoorContact('b').length,1);
  m.momentPauze('a',r.moment.id,true);
  assert.equal(m.momentVoorContact('b').length,0);
  m.momentPauze('a',r.moment.id,false);
  assert.equal(m.momentVoorContact('b').length,1);
  m.momentStop('a',r.moment.id);
  assert.equal(m.momentVoorContact('b').length,0);
});

test('onverbonden personen kunnen niet als ontvanger worden toegevoegd',()=>{
  const {m}=kern();
  const r=m.momentMaak('a',{ontvangers:[{soort:'contact',id:'vreemd',niveau:'locatie'}]});
  assert.equal(r.status,400);
});
