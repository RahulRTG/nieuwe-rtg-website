/* De drie publieke adresregels door de volledige HTTP- en ontvangstketen. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { startServer }=require('./helper');

let child, base;
const map=fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-publieke-adressen-'));
const post=(pad,body,token) => fetch(base+pad,{ method:'POST', headers:{
  'Content-Type':'application/json', ...(token ? { Authorization:'Bearer '+token } : {})
}, body:JSON.stringify(body || {}) });
const json=async r => ({ status:r.status, body:await r.json() });
const ruw=(naar,onderwerp) => 'From: afzender@voorbeeld.nl\r\nTo: '+naar+
  '\r\nSubject: '+onderwerp+'\r\nDate: Thu, 20 Aug 2026 10:00:00 +0000\r\n\r\nVeilig ontvangen.';

test.before(async () => {
  ({ child, base }=await startServer({ env:{ RTG_DATA_DIR:map, SMTP_URL:'',
    RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com',
    RTF_MAIL_PUBLIEK_DOMEIN:'rahultravelfoundation.com' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(map,{ recursive:true, force:true }); } catch (_) {}
});

async function lid(naam,n) {
  return (await json(await post('/api/auth/register',{ name:naam,
    email:'publiek'+n+'@voorbeeld.test', password:'veilig-geheim',
    geboortedatum:'1990-01-01', tier:'rtg', pasApp:'rtg' }))).body;
}

test('lid krijgt voor.achternaam op het server-bewezen pasniveau', async () => {
  const a=await lid('Ada Maria Lovelace',1);
  const adres=await json(await post('/api/member/rtmail/adres',{},a.token));
  assert.equal(adres.status,200);
  assert.equal(adres.body.publiekAdres,'ada.lovelace@rtgpass.rahultravelgroup.com');
  assert.match(adres.body.adres,/^[^@]+@rtgpass\.rtg$/);

  const binnen=await post('/api/mail/binnen',{ bericht:ruw(adres.body.publiekAdres,'Ledenalias') });
  assert.equal(binnen.status,200,await binnen.text());
  const inbox=await json(await post('/api/member/rtmail/inbox',{},a.token));
  assert.ok(inbox.body.berichten.some(m => m.onderwerp === 'Ledenalias'));
});

test('gelijke namen botsen niet en het pasdomein is niet zelf te kiezen', async () => {
  const b=await lid('Ada Maria Lovelace',2);
  const adres=await json(await post('/api/member/rtmail/adres',{},b.token));
  assert.equal(adres.body.publiekAdres,'ada.lovelace-2@rtgpass.rahultravelgroup.com');
});

test('RTF-lid houdt de codenaam op het aparte Foundation-domein', async () => {
  const g=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Mailgezin', naam:'Beheerder', pin:'2468',
    bevoegdGezin:true, privacyAkkoord:true }));
  const sess={ code:g.body.code, token:g.body.token };
  const overzicht=await json(await post('/api/foundation/mail/overzicht',sess));
  assert.equal(overzicht.status,200);
  assert.match(overzicht.body.publiekAdres,/^[a-z0-9-]+@rahultravelfoundation\.com$/);
  assert.equal(overzicht.body.publiekAdres.includes('beheerder'),false,
    'de echte naam staat niet in het Foundation-adres');

  const binnen=await post('/api/mail/binnen',{
    bericht:ruw(overzicht.body.publiekAdres,'Foundationalias') });
  assert.equal(binnen.status,200,await binnen.text());
  const inbox=await json(await post('/api/foundation/mail/inbox',sess));
  assert.ok(inbox.body.berichten.some(m => m.onderwerp === 'Foundationalias'));
});

/* /mail/lees was de enige Foundation-mailroute die de hele suite nooit aanraakte.
   Lezen is geen kijken: het zet het bericht op gelezen en telt de ongelezen-
   teller af. En het postvak is van EEN mens -- een tweede gezin dat het id van
   het eerste kent, hoort niets te krijgen (geen 200 met inhoud). */
test('RTF-lid leest zijn eigen bericht; het postvak van een ander blijft dicht', async () => {
  const a=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Leesgezin', naam:'Beheerder', pin:'1357',
    bevoegdGezin:true, privacyAkkoord:true }));
  const sessA={ code:a.body.code, token:a.body.token };
  const overzichtA=await json(await post('/api/foundation/mail/overzicht',sessA));
  assert.equal(overzichtA.status,200);

  const binnen=await post('/api/mail/binnen',{
    bericht:ruw(overzichtA.body.publiekAdres,'Leesbewijs') });
  assert.equal(binnen.status,200,await binnen.text());

  const inbox=await json(await post('/api/foundation/mail/inbox',sessA));
  const m=(inbox.body.berichten || []).find(x => x.onderwerp === 'Leesbewijs');
  assert.ok(m,'het bezorgde bericht staat in het eigen postvak');
  assert.equal(m.gelezen,false,'de inbox opent een bericht niet uit zichzelf');
  const ongelezenVoor=(await json(await post('/api/foundation/mail/overzicht',sessA))).body.ongelezen;

  const gelezen=await json(await post('/api/foundation/mail/lees',{ ...sessA, id:m.id }));
  assert.equal(gelezen.status,200,JSON.stringify(gelezen.body));
  assert.equal(gelezen.body.ok,true);
  assert.equal(gelezen.body.bericht.id,m.id);
  assert.equal(gelezen.body.bericht.onderwerp,'Leesbewijs');
  assert.match(gelezen.body.bericht.tekst,/Veilig ontvangen/);
  assert.equal(gelezen.body.bericht.naar,m.naar,'het bericht blijft aan hetzelfde postvak hangen');
  assert.equal(gelezen.body.bericht.gelezen,true,'lezen zet het bericht op gelezen');

  const na=await json(await post('/api/foundation/mail/overzicht',sessA));
  assert.equal(na.body.ongelezen,ongelezenVoor - 1,'de ongelezen-teller loopt een af');

  const onbekend=await json(await post('/api/foundation/mail/lees',{ ...sessA, id:'bestaat-niet' }));
  assert.equal(onbekend.status,404);
  assert.ok(onbekend.body.error,'een onbekend id krijgt een reden, geen leeg bericht');
  assert.equal(onbekend.body.ok,undefined);

  const b=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Buurgezin', naam:'Buurbeheerder', pin:'2469',
    bevoegdGezin:true, privacyAkkoord:true }));
  const inbraak=await json(await post('/api/foundation/mail/lees',{
    code:b.body.code, token:b.body.token, id:m.id }));
  assert.equal(inbraak.status,404,'het id van een ander postvak opent niets');
  assert.equal(inbraak.body.ok,undefined);
  assert.equal(inbraak.body.bericht,undefined);

  const zonderSessie=await json(await post('/api/foundation/mail/lees',{
    code:a.body.code, token:'geen-geldig-token', id:m.id }));
  assert.equal(zonderSessie.status,403,'zonder geldige gezinssessie geen postvak');
  assert.equal(zonderSessie.body.bericht,undefined);
});

/* /mail/stuur was de laatste Foundation-mailroute die de suite nooit aanraakte,
   en van de vijf is hij de gevoeligste: hier VERLAAT post het postvak. Vier
   dingen horen daarbij vast te staan.

   De afzender komt uit de SESSIE en niet uit het lijf. De route leest
   `req.body.van` bewust nergens; zou hij dat ooit wel doen, dan mailt elk lid
   onder de codenaam van een ander en is het hele codenaam-ontwerp een sierrand.
   Daarom gaat er hier een verzonnen `van` mee die genegeerd moet worden.

   Een .rtg-adres blijft BINNEN (buiten:false, bron 'lid' en dus vertrouwd), een
   adres buiten het huis gaat via de buitenpost (buiten:true) en zegt er eerlijk
   bij of hij echt de deur uit ging -- zonder SMTP_URL is dat `echt:false` en
   niet stilzwijgend "verstuurd". En een leeg bericht gaat helemaal nergens
   heen. */
test('RTF-lid stuurt onder de eigen codenaam; het lijf kiest de afzender niet', async () => {
  const a=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Stuurgezin', naam:'Verzender', pin:'3571',
    bevoegdGezin:true, privacyAkkoord:true }));
  const b=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Ontvanggezin', naam:'Ontvanger', pin:'8642',
    bevoegdGezin:true, privacyAkkoord:true }));
  const sessA={ code:a.body.code, token:a.body.token };
  const sessB={ code:b.body.code, token:b.body.token };
  const mijnAdres=(await json(await post('/api/foundation/mail/overzicht',sessA))).body.adres;
  const zijnAdres=(await json(await post('/api/foundation/mail/inbox',sessB))).body.adres;
  assert.match(mijnAdres,/@rahultravelfoundation\.rtg$/);
  assert.notEqual(mijnAdres,zijnAdres,'twee leden delen geen postvak');

  const leeg=await json(await post('/api/foundation/mail/stuur',sessA));
  assert.equal(leeg.status,400,'zonder ontvanger en tekst gaat er niets weg');
  assert.ok(leeg.body.error,'de weigering draagt een reden');
  assert.equal(leeg.body.ok,undefined);
  const zonderTekst=await json(await post('/api/foundation/mail/stuur',{
    ...sessA, naar:zijnAdres, onderwerp:'Alleen een kop' }));
  assert.equal(zonderTekst.status,400,'een kop zonder bericht is geen bericht');

  const onderwerp='Stuurbewijs-'+Date.now();
  const verstuurd=await json(await post('/api/foundation/mail/stuur',{
    ...sessA, van:zijnAdres, naar:zijnAdres, onderwerp, tekst:'Intern bezorgd.' }));
  assert.equal(verstuurd.status,200,JSON.stringify(verstuurd.body));
  assert.equal(verstuurd.body.ok,true);
  assert.equal(verstuurd.body.buiten,false,'een .rtg-adres blijft binnen het huis');
  assert.equal(verstuurd.body.bericht.van,mijnAdres,'de afzender komt uit de sessie, niet uit het lijf');
  assert.equal(verstuurd.body.bericht.naar,zijnAdres);
  assert.equal(verstuurd.body.bericht.bron,'lid');
  assert.equal(verstuurd.body.bericht.vertrouwd,true);
  assert.deepEqual(verstuurd.body.bericht.bijlagen,[],'RTMAIL draagt nooit een te openen bijlage');

  const inboxB=await json(await post('/api/foundation/mail/inbox',sessB));
  const aangekomen=(inboxB.body.berichten || []).find(m => m.onderwerp === onderwerp);
  assert.ok(aangekomen,'het bericht staat in het postvak van de ontvanger');
  assert.equal(aangekomen.van,mijnAdres);
  assert.equal(aangekomen.tekst,'Intern bezorgd.');
  const inboxA=await json(await post('/api/foundation/mail/inbox',sessA));
  assert.equal((inboxA.body.berichten || []).some(m => m.onderwerp === onderwerp),false,
    'verzonden post landt niet in het eigen postvak in');
  const verzondenA=await json(await post('/api/foundation/mail/verzonden',sessA));
  assert.ok((verzondenA.body.berichten || []).some(m => m.onderwerp === onderwerp),
    'het bericht staat bij de eigen verzonden post');

  const naarBuiten=await json(await post('/api/foundation/mail/stuur',{
    ...sessA, naar:'ontvanger@voorbeeld.nl', onderwerp:'Buitenpost-'+onderwerp,
    tekst:'Deze gaat het huis uit.' }));
  assert.equal(naarBuiten.status,200,JSON.stringify(naarBuiten.body));
  assert.equal(naarBuiten.body.buiten,true,'een adres buiten .rtg gaat via de buitenpost');
  assert.equal(naarBuiten.body.echt,false,'zonder SMTP-koppeling heet het niet "echt verstuurd"');
  assert.equal(naarBuiten.body.bericht.soort,'buitenpost');
  assert.equal(naarBuiten.body.bericht.van,mijnAdres);

  const zonderSessie=await json(await post('/api/foundation/mail/stuur',{
    code:a.body.code, token:'geen-geldig-token', naar:zijnAdres, tekst:'Ongevraagd.' }));
  assert.equal(zonderSessie.status,403,'zonder geldige gezinssessie vertrekt er geen post');
  assert.equal(zonderSessie.body.ok,undefined);
  const naSpoof=await json(await post('/api/foundation/mail/inbox',sessB));
  assert.equal((naSpoof.body.berichten || []).some(m => m.tekst === 'Ongevraagd.'),false,
    'de geweigerde poging is ook niet stilletjes bezorgd');
});

/* /mail/verzonden is de vijfde Foundation-mailroute, en de enige die de suite
   alleen nog in het VOORBIJGAAN aanraakte: een regel onderaan de stuurtoets die
   keek of een onderwerp ergens in de lijst stond. Dat raakt de route wel aan,
   maar het bewijst niet waarvoor hij er is.

   Verzonden post is namelijk het spiegelbeeld van het postvak IN. In
   kern/rtmail.js scheelt dat een enkel woord -- postvak() filtert op `naar`,
   verzonden() op `van` -- en verwissel je die twee, dan vult de bak zich met de
   post van ANDEREN: de inbox van het lid, maar dan onder een kop die
   "verzonden" heet. Precies de fout die niemand ziet, want er staat gewoon post
   in. Daarom staan hier drie kanten vast: wat erin staat draagt MIJN adres als
   afzender, wat ik ONTVING staat er niet in, en de post die ik naar een ander
   stuurde staat bij HEM niet onder verzonden.

   De poort ervoor is er een van leden-mail.js alleen: een gast (oppas, opa of
   oma) heeft geen Foundation-adres en krijgt 403 met een reden. Geen lege
   lijst, want een lege lijst leest als "u heeft nog niets verstuurd" en dat is
   iets anders dan "dit postvak is niet van u". */
test('verzonden post draagt alleen de eigen afzender; ontvangen post en een gast horen er niet in', async () => {
  const a=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Verzondengezin', naam:'Verzender', pin:'4826',
    bevoegdGezin:true, privacyAkkoord:true }));
  const b=await json(await post('/api/foundation/gezin/maak',{
    gezinsnaam:'Tegenpartij', naam:'Ontvanger', pin:'6284',
    bevoegdGezin:true, privacyAkkoord:true }));
  const sessA={ code:a.body.code, token:a.body.token };
  const sessB={ code:b.body.code, token:b.body.token };
  const overzichtA=await json(await post('/api/foundation/mail/overzicht',sessA));
  assert.equal(overzichtA.status,200);
  const adresA=overzichtA.body.adres, publiekA=overzichtA.body.publiekAdres;
  const adresB=(await json(await post('/api/foundation/mail/overzicht',sessB))).body.adres;
  assert.notEqual(adresA,adresB,'twee gezinnen delen geen adres');

  // 1. De vorm staat er ook zonder ook maar een verstuurd bericht.
  const leeg=await json(await post('/api/foundation/mail/verzonden',sessA));
  assert.equal(leeg.status,200,JSON.stringify(leeg.body));
  assert.equal(leeg.body.ok,true);
  assert.equal(leeg.body.adres,adresA,'de bak hoort bij het adres uit de sessie, niet uit het lijf');
  assert.ok(Array.isArray(leeg.body.berichten),'berichten is altijd een lijst');
  assert.equal(leeg.body.berichten.length,0,
    'wie nog niets verstuurde heeft niets in de verzonden post: '+JSON.stringify(leeg.body.berichten));

  // 2. ONTVANGEN is geen VERZONDEN: bezorgde post blijft aan de andere kant.
  const binnen=await post('/api/mail/binnen',{ bericht:ruw(publiekA,'Verzondenspiegel') });
  assert.equal(binnen.status,200,await binnen.text());
  const inboxA=await json(await post('/api/foundation/mail/inbox',sessA));
  assert.ok((inboxA.body.berichten || []).some(m => m.onderwerp === 'Verzondenspiegel'),
    'het bezorgde bericht staat wel in het postvak IN');
  const naOntvangst=await json(await post('/api/foundation/mail/verzonden',sessA));
  assert.equal(naOntvangst.body.berichten.length,0,
    'ontvangen post hoort niet in de verzonden bak; die filtert op afzender en niet op ontvanger');

  // 3. Wat ik zelf stuur komt erbij, en draagt mijn eigen adres als afzender.
  const onderwerp='Verzondenbewijs-'+Date.now();
  const verstuurd=await json(await post('/api/foundation/mail/stuur',{
    ...sessA, naar:adresB, onderwerp, tekst:'Voor de verzonden bak.' }));
  assert.equal(verstuurd.status,200,JSON.stringify(verstuurd.body));

  const naVersturen=await json(await post('/api/foundation/mail/verzonden',sessA));
  assert.equal(naVersturen.status,200);
  assert.equal(naVersturen.body.adres,adresA);
  assert.equal(naVersturen.body.berichten.length,1,'er is er precies een bijgekomen');
  const mijne=naVersturen.body.berichten.find(m => m.onderwerp === onderwerp);
  assert.ok(mijne,'het verstuurde bericht staat in de eigen verzonden post');
  assert.equal(mijne.van,adresA,'de afzender is het eigen Foundation-adres');
  assert.equal(mijne.naar,adresB,'en de ontvanger staat erbij');
  assert.equal(mijne.tekst,'Voor de verzonden bak.');
  assert.equal(mijne.soort,'foundationmail');
  assert.equal(mijne.bron,'lid');
  assert.equal(naVersturen.body.berichten.every(m => m.van === adresA),true,
    'geen enkel bericht in mijn verzonden post komt van een ander adres');

  // 4. Bij de ONTVANGER staat hetzelfde bericht in de inbox en niet bij verzonden.
  const inboxB=await json(await post('/api/foundation/mail/inbox',sessB));
  assert.ok((inboxB.body.berichten || []).some(m => m.onderwerp === onderwerp),
    'de ontvanger heeft het bericht wel degelijk gekregen');
  const verzondenB=await json(await post('/api/foundation/mail/verzonden',sessB));
  assert.equal(verzondenB.status,200);
  assert.equal(verzondenB.body.adres,adresB,'ieder ziet zijn eigen bak');
  assert.equal((verzondenB.body.berichten || []).some(m => m.onderwerp === onderwerp),false,
    'een bericht dat je ONTVING staat niet onder je verzonden post');

  // 5. De poort: zonder geldige gezinssessie gaat de bak niet open.
  const zonderSessie=await json(await post('/api/foundation/mail/verzonden',{
    code:a.body.code, token:'geen-geldig-token' }));
  assert.equal(zonderSessie.status,403,'zonder geldige gezinssessie geen verzonden post');
  assert.equal(zonderSessie.body.ok,undefined);
  assert.equal(zonderSessie.body.berichten,undefined,'en er lekt geen enkele regel post mee');
  assert.ok(zonderSessie.body.error,'de weigering draagt een reden');

  // 6. De gastpoort van leden-mail.js: een oppas heeft hier geen postvak.
  const gast=await json(await post('/api/foundation/gezin/profiel/maak',{
    ...sessA, naam:'Oppas Bo', rol:'gast' }));
  assert.equal(gast.status,200,JSON.stringify(gast.body));
  const gastToken=(await json(await post('/api/foundation/gezin/profiel/kies',{
    code:a.body.code, profielId:gast.body.profiel.id }))).body.token;
  assert.ok(gastToken,'de gast krijgt een eigen sessie in het gezin');
  const gastBak=await json(await post('/api/foundation/mail/verzonden',{
    code:a.body.code, token:gastToken }));
  assert.equal(gastBak.status,403,'een gast krijgt geen Foundation-postvak');
  assert.equal(gastBak.body.berichten,undefined,'ook niet als lege lijst');
  assert.match(gastBak.body.error,/gast/i,'de weigering zegt dat het om een gast gaat');
});
