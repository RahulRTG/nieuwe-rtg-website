/* TREASURY: geld dat binnenkomt is niet hetzelfde als geld dat van u is.

   De klassieke manier waarop een horecazaak omvalt, is niet dat er te weinig
   binnenkwam maar dat er te veel uitging omdat het saldo eruitzag als winst. Er
   zat btw in die nog afgedragen moest worden en er kwam een loonrun aan.

   Dit bord houdt daarom VIER getallen uit elkaar die op elk ander scherm een
   getal zijn -- saldo, apart gezet, vastgezet en beschikbaar -- en zet daar het
   enige antwoord onder dat een ondernemer echt zoekt: hoeveel kan ik vandaag
   uitgeven zonder dat het straks pijn doet.

   HET HEEFT TANDEN, en dat is geen schermkwestie: `uitbetaal` op de server
   betaalt BESCHIKBAAR uit en niet het saldo (kern/pay/kassa.js). Zonder die
   helft zou dit bord een geruststelling tonen die de volgende uitbetaling
   meeneemt.

   WAT ER GESCHAT IS, ZEGT DAT OOK. De percentages zijn een instelling van de
   zaak, geen aangifte; kern/fiscaal rekent de werkelijke btw. Dat staat op het
   scherm en niet alleen in de code -- een apart gezet bedrag dat zich voordoet
   als een afdracht is gevaarlijker dan geen bedrag. */
    if (kantoorSec === 'treasury'){
      if (!tresData){
        laadTreasury();
        html += '<div class="tkc h-volbreed"><h3>'+T('kt.treasury','Treasury')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (tresData.error){
        html += '<div class="tkc h-volbreed"><h3>'+T('kt.treasury','Treasury')+'</h3><div class="tkc-who">'+tresData.error+'</div></div>';
      } else {
        const tr = tresData;
        if (tresMsg){ html += '<div class="tkc h-volbreed h-goudrand">'+tresMsg+'</div>'; }
        /* De vier getallen naast elkaar, en met opzet niet opgeteld tot een
           "totaal". Wie ze optelt, krijgt het saldo terug -- en dat getal was
           nou juist het misverstand. */
        html += '<div class="tkc h-volbreed"><h3>'+T('kt.trstand','Wat er staat')+'</h3>'+
          '<div class="st-row"><span>'+T('kt.trsaldo','Op uw RTG-rekening')+'</span><b>'+eur(tr.saldo/100)+'</b></div>'+
          '<div class="st-row"><span>'+T('kt.trapart','Zelf apart gezet')+'<span class="sub">'+T('kt.trapartsub','btw, loonreserve')+'</span></span><b>'+eur(tr.apartGezet/100)+'</b></div>'+
          (tr.gereserveerd ? '<div class="st-row"><span>'+T('kt.trvast','Vastgezet bij een lid')+'<span class="sub">'+T('kt.trvastsub','borgen die nog lopen')+'</span></span><b>'+eur(tr.gereserveerd/100)+'</b></div>' : '')+
          '<div class="st-row"><span><b>'+T('kt.trvrij','Beschikbaar')+'</b><span class="sub">'+T('kt.trvrijsub','dit kan worden uitbetaald')+'</span></span><b>'+eur(tr.beschikbaar/100)+'</b></div>'+
          (tr.onderBuffer
            ? '<div class="tkc-who">'+T('kt.tronder','U zit onder de bodem die u zelf heeft ingesteld. Dat is geen storing, maar het is wel het signaal waar u de bodem voor heeft gezet.')+'</div>'
            : '<div class="st-row"><span>'+T('kt.trliq','Vrij boven uw eigen bodem')+'</span><b>'+eur(tr.vrijeLiquiditeit/100)+'</b></div>')+
          '<div class="tkc-who">'+T('kt.trvandaag','Vandaag ontvangen')+': '+eur(tr.ontvangenVandaag/100)+'</div></div>';

        /* De oormerken zelf, elk met een knop om vrij te geven -- dat is de
           handeling die erbij hoort: de btw is afgedragen, dus het geld is weer
           van u. Zonder die knop is apart zetten een eenrichtingsweg. */
        const om = tr.oormerken || [];
        html += '<div class="tkc"><h3>'+T('kt.troorm','Apart gezet')+'</h3>'+
          (om.length ? om.map(o => '<div class="st-row"><span>'+o.naam+
            (o.doel ? '<span class="sub">'+o.doel+'</span>' : '')+'</span>'+
            '<span><b>'+eur(o.centen/100)+'</b> <button class="obtn" data-trvrij="'+o.id+'">'+T('kt.trvrijgeef','Vrijgeven')+'</button></span></div>').join('')
            : '<div class="tkc-who">'+T('kt.trgeenoorm','U heeft nog niets apart gezet.')+'</div>')+
          '<div class="st-form"><div class="row-gap"><input class="st-in h-flex2" id="trNaam" placeholder="'+T('kt.trnaam','Waarvoor, bijv. Btw Q3')+'"><input class="st-in h-flex1" id="trBedrag" type="number" inputmode="decimal" placeholder="€"></div>'+
          '<button class="bigbtn h-mt20" id="trApart">'+T('kt.trapartzet','Apart zetten')+'</button></div>'+
          '<div class="tkc-who">'+T('kt.troormnote','Er beweegt geen geld: apart gezet geld staat gewoon op uw rekening. Het telt alleen niet mee als beschikbaar, en gaat dus niet mee bij een uitbetaling.')+'</div></div>';

        /* De regels die het automatisch doen. Per ONTVANGST en niet een keer per
           dag: een dagelijkse taak is een taak die kan uitvallen, en dan is er
           een dag waarop het saldo weer als winst leest. */
        const b = tr.beleid || {};
        html += '<div class="tkc"><h3>'+T('kt.trregels','Automatisch bij elke ontvangst')+'</h3>'+
          '<div class="st-form"><div class="row-gap">'+
          '<input class="st-in h-flex1" id="trBtw" type="number" inputmode="decimal" placeholder="'+T('kt.trbtwpct','Btw %')+'" value="'+(b.btwPct||0)+'">'+
          '<input class="st-in h-flex1" id="trLoon" type="number" inputmode="decimal" placeholder="'+T('kt.trloonpct','Loon %')+'" value="'+(b.payrollPct||0)+'">'+
          '<input class="st-in h-flex1" id="trBuffer" type="number" inputmode="decimal" placeholder="'+T('kt.trbuffer','Bodem €')+'" value="'+((b.bufferCenten||0)/100)+'">'+
          '</div><button class="bigbtn h-mt20" id="trBeleid">'+T('kt.trbewaar','Bewaren')+'</button></div>'+
          '<div class="tkc-who">'+T('kt.trschat','Deze percentages zijn een schatting die u zelf instelt. De werkelijke btw-aangifte rekent uw boekhouding; dit zet alleen geld apart.')+'</div></div>';

        /* WAAR DE EURO HEEN GING. Let op de vlag per regel: de kosten staan echt
           in het grootboek, het btw- en loondeel zijn een percentage. Een
           schatting die zich voordoet als een afdracht is gevaarlijker dan geen
           bedrag, dus staat het verschil op het scherm. */
        if (tresGraaf && tresGraaf.opsplitsing){
          html += '<div class="tkc h-volbreed"><h3>'+T('kt.trgraaf','Waar uw omzet heen ging')+'</h3>'+
            '<div class="tkc-who">'+T('kt.trperiode','Laatste')+' '+tresGraaf.sindsDagen+' '+T('kt.trdagen','dagen')+' · '+
              tresGraaf.aantal+' '+T('kt.trbetalingen','betalingen')+' · '+eur(tresGraaf.ontvangen/100)+'</div>'+
            tresGraaf.opsplitsing.map(o => '<div class="st-row"><span>'+o.wat+
              '<span class="sub">'+(o.afgeleid ? T('kt.trafgeleid','geschat &middot; ')+o.uitleg : T('kt.trecht','uit het grootboek'))+'</span></span>'+
              '<b>'+eur(o.centen/100)+'</b></div>').join('')+
            '</div>';
        }
      }
    }
