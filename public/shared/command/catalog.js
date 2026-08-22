/* De ene productcatalogus en contexttaal van RTG Command. De vele bestaande
   domeinen blijven bereikbaar, maar een lid opent nog maar vier producten:
   LIFE, WORK, FOUNDATION en INSTELLINGEN. */
(function(w){
  'use strict';
  var APPS=[['LIFE','/apps/rtg.html','home'],['WORK','/apps/kantoor.html','reis'],['FOUNDATION','/apps/foundation/index.html','home'],['INSTELLINGEN','/apps/ik.html','instel']],
      HOOFDAPPS=APPS.slice(0,3),INSTELLINGEN=APPS[3],openTeller={};
  function appMetNaam(naam){for(var i=0;i<APPS.length;i++)if(APPS[i][0]===naam)return APPS[i];return null}
  function titelVan(url,t){if(t)return t;for(var i=0;i<APPS.length;i++)if(url.indexOf(APPS[i][1])===0)return APPS[i][0];return 'Werkblad'}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return h}
  function context(p){var t=(p&&p.titel)||'deze werkruimte',u=(p&&p.url)||'',z=[];if(/reis|vlucht|hotel/.test(u))z=['Ik zie je reiswerkblad. Zal ik planning en aandachtspunten naast elkaar leggen?','Deze reis staat open. Ik kan de planning, gasten of betalingen vergelijken.','Zal ik controleren wat in deze reis nog op bevestiging wacht?'];else if(/geld|pay|balans|wbw/.test(u))z=['Ik kijk mee met '+t+'. Zal ik afwijkingen of open posten controleren?','De financiële context staat open. Waar wil je op inzoomen?','Zal ik deze bedragen koppelen aan de zichtbare dossiers?'];else if(/salon|sociaal|comm/.test(u))z=['Je bent in '+t+'. Zal ik reacties of relevante gesprekken ordenen?','Ik zie de sociale context. Wat wil je hieruit meenemen?','Zal ik samenvatten wat in '+t+' aandacht verdient?'];else if(/vandaag/.test(u))z=['Goedemiddag. Ik heb uw dag bekeken. Zal ik openen wat nu aandacht verdient?','Uw dag staat klaar. Zeg gewoon welke software u wilt zien, dan breng ik u erheen.','Ik kijk met u mee. Zal ik uw eerstvolgende moment voorbereiden?'];else z=['Goedemiddag. Wat zullen we vanuit '+t+' doen?','Ik kijk mee met '+t+'. Zeg maar wat je wilt vergelijken of openen.','Alles staat klaar. Waar wil je mee beginnen?'];var sleutel=p?p.url:'algemeen';openTeller[sleutel]=(openTeller[sleutel]||0)+1;return z[(Math.abs(hash(sleutel))+openTeller[sleutel]-1)%z.length]}
  function appUit(naam){naam=String(naam||'').toLowerCase();for(var i=0;i<APPS.length;i++){var n=APPS[i][0].toLowerCase();if(naam.indexOf(n)>=0)return APPS[i]}
    if(/foundation|rtf|stichting|gezin|campus/.test(naam))return appMetNaam('FOUNDATION');
    if(/instelling|profiel|voorkeur|passkey|privacy|identiteit|account|wie ben ik/.test(naam))return appMetNaam('INSTELLINGEN');
    if(/instant reality|private office|living os/.test(naam))return appMetNaam('LIFE');
    if(/werk|kantoor|office|ondernem|bedrijf|partner|leverancier|personeel|loon|school|restaurant|horeca|bestel|bezorg|club|voorraad|kassa/.test(naam))return appMetNaam('WORK');
    if(/vandaag|thuis|home|dag|salon|bericht|sociaal|tijdlijn|kring|pulse|media|muziek|video|studio|release|podcast|live|gast|dossier|reis|vlucht|hotel|geld|bank|betaling|wallet|leven|veilig/.test(naam))return appMetNaam('LIFE');
    return null}
  w.RTGCommandCatalog={APPS:APPS,HOOFDAPPS:HOOFDAPPS,INSTELLINGEN:INSTELLINGEN,titelVan:titelVan,context:context,appUit:appUit};
})(window);
