/* ============================================================================
   DE BRUGKLANT -- het enige stuk RTG-code dat in de cel van een derde draait.

   WAAROM DIT EEN EIGEN BESTAND IS. Hij stond als tekenreeks in
   routes/appstore/cel.js, en dat werkte zolang de cel de enige was die hem
   nodig had. Dat is voorbij: `rtg dev` serveert dezelfde cel op de machine van
   een ontwikkelaar, en die MOET dezelfde brugklant en dezelfde CSP gebruiken.
   Zou de CLI ze kopiëren, dan is er een tweede brug (LAT-regel 4) -- en de
   eerste keer dat ze uiteenlopen, is de fout "werkt lokaal, geblokkeerd in de
   cel", precies de ervaring die dit kanaal niet moet geven.

   DRIE DINGEN LIGGEN HIER VAST, EN ZE HANGEN SAMEN.

   1. DE KLANT WORDT GEÏNJECTEERD, niet opgevraagd. Elk celdocument krijgt het
      script in de <head> voordat de eigen code van de app draait. Zo kan een app
      hem niet vergeten en niet vervangen. Zelf naar `parent` reiken is bij de
      keuring al afgekeurd (./keuring.js, VERBODEN_JS).

   2. DE CSP STAAT OP 'none' EN WAT NODIG IS KOMT ERBIJ. Niet andersom, want dan
      is elke nieuwe browserfunctie stilzwijgend toegestaan. `connect-src 'none'`
      is de kern: de app heeft geen netwerk, en de enige weg naar RTG loopt via
      het lid.

   3. EEN WEIGERING KOMT HEEL AAN. Dit is de reparatie waar dit bestand voor is
      gemaakt. De brug schrijft een weigering die vier dingen zegt -- welke
      machtiging nodig was, wat het lid WEL gaf, wat het manifest vroeg, en hoe
      het op te lossen is. Die reisde tot voor kort tot aan de celpagina en werd
      daar `new Error(d.error)`: drie regels verderop was alles weg behalve de
      zin. Nu draagt de fout in de cel dezelfde velden als op de server, plus
      `code` en `herhaalbaar`.

   WAT DE APP ZIET:

     try { await RTG.roep('bericht.zet', { tekst: 'hallo' }); }
     catch (e) {
       e.code         'RTG_MACHTIGING_NIET_VERLEEND'
       e.machtiging   'bericht.klaarzetten'
       e.verleend     ['profiel.basis']
       e.hoe          'Alleen het lid kan dit aanzetten, in de App Store ...'
       e.herhaalbaar  false
     }
   ========================================================================== */
'use strict';

/* De velden die een fout uit de cel meeneemt. Ze staan hier als lijst zodat de
   celpagina precies deze doorgeeft en niet "alles wat er toevallig in zit" -- een
   antwoord van de server kan meer dragen dan een derde hoort te zien. */
const FOUTVELDEN = ['code', 'error', 'herhaalbaar', 'methode', 'methodes',
  'machtiging', 'verleend', 'gevraagd', 'hoe', 'perMinuut'];

/* De CSP van de cel. Alles op 'none', en wat een app nodig heeft komt er stuk
   voor stuk bij. `'self'` matcht niet in een naamloze herkomst; daarom staat de
   eigen herkomst er expliciet bij. */
const celCsp = (herkomst) =>
  "default-src 'none'; script-src " + herkomst + "; style-src " + herkomst + " 'unsafe-inline'; " +
  "img-src " + herkomst + " data:; font-src " + herkomst + "; media-src " + herkomst + " data:; " +
  "connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; " +
  "frame-ancestors " + herkomst + "; sandbox allow-scripts";

/* De klant zelf. Klein houden is hier een eigenschap en geen zuinigheid: dit
   script staat in ELK celdocument en telt mee in wat de telefoon van een lid
   moet uitvoeren voordat er iets op het scherm staat. */
const BRUGKLANT = `(function(){'use strict';
var nr=0,open={};
var VELDEN=${JSON.stringify(FOUTVELDEN)};
function maakFout(d){
  var e=new Error(d && d.error ? d.error : 'De brug weigerde deze aanroep.');
  e.naam='RTGFout';
  for(var i=0;i<VELDEN.length;i++){ var k=VELDEN[i]; if(d && d[k]!==undefined) e[k]=d[k]; }
  return e;
}
function terug(e){ if(e.source!==window.parent) return; var d=e.data;
  if(!d||d.rtgcel!==1) return;
  if(d.context!==undefined){ contextBinnen(d.context); return; }
  if(typeof d.nr!=='number') return; var w=open[d.nr]; if(!w) return; delete open[d.nr];
  if(d.fout) w.nee(maakFout(d.fout)); else if(d.error) w.nee(maakFout({error:d.error})); else w.ja(d.uit); }
window.addEventListener('message',terug,false);
function roep(methode,args){ return new Promise(function(ja,nee){
  var n=++nr; open[n]={ja:ja,nee:nee};
  setTimeout(function(){ if(open[n]){ delete open[n];
    nee(maakFout({code:'RTG_GEEN_ANTWOORD',error:'De brug antwoordde niet op tijd.',herhaalbaar:true,methode:String(methode)})); } },15000);
  window.parent.postMessage({rtgcel:1,nr:n,methode:String(methode),args:args||{}},'*'); }); }
/* DE CONTEXT VAN DEZE OPENING. Hij komt van de celpagina en alleen als het lid
   hem daar heeft doorgegeven; hij komt EEN keer en er is niets op te vragen.
   RTG.context() geeft een belofte die vervult met de waarden of met null --
   null is de gewone toestand, want de meeste keren dat een app opengaat, is er
   niets doorgegeven. */
var ctxWachters=[],ctxWaarde=null,ctxKlaar=false;
function contextBinnen(v){ ctxWaarde=v||null; ctxKlaar=true;
  for(var i=0;i<ctxWachters.length;i++){ try{ ctxWachters[i](ctxWaarde); }catch(e){} } ctxWachters=[]; }
function context(){ return new Promise(function(ja){ if(ctxKlaar) return ja(ctxWaarde); ctxWachters.push(ja);
  setTimeout(function(){ if(!ctxKlaar){ ctxKlaar=true; ja(null); } },3000); }); }
window.RTG={ roep:roep, context:context, versie:1,
  /* Wat een app NIET van de brug krijgt, staat hier zodat het in de console van
     de bouwer zichtbaar is en niet in een document dat hij nooit opent. */
  nietGebouwd:{ netwerk:'Een cel heeft geen netwerk. Alles loopt via RTG.roep().',
    naam:'Een app van derden krijgt een codenaam, nooit een echte naam.',
    push:'Er is geen kanaal dat een telefoon laat trillen.' } };
})();`;

/* Het brugscript in een celdocument zetten. Eerst in de <head>, zodat de app
   RTG.roep() al heeft voordat zijn eigen code draait. Geen <head>? Dan vooraan;
   de browser hangt hem alsnog in de head die hij zelf maakt. */
function metBrug(html, pad) {
  const tag = '<script src="' + (pad || '/appcel/brug.js') + '"></script>';
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
}

module.exports = { BRUGKLANT, celCsp, metBrug, FOUTVELDEN };
