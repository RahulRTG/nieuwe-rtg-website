// Rendert de hoofdapp en vangt ontbrekende onderdelen gecontroleerd op.
  function renderAll(){
    /* Ook deze aanloop liep zonder vangnet, en juist hier staan de regels die
       aannemen dat een element bestaat. Viel er een om, dan kwam de rest van
       renderAll niet eens op gang en hielp het afschermen van de stappen
       hieronder niets. */
    // gratis gebruiker (zonder pas): reizen, betalen en AI zijn voor leden
    const guest = user.tier === 'guest';
    stap('scherm-aanloop', () => {
    $('#codeChipTxt').textContent = user.codename;
    ['reizen','betalen','ai','assets'].forEach(t => { const b = document.querySelector('.tabbar button[data-tab="'+t+'"]'); if (b) b.style.display = guest ? 'none' : ''; });
    // zorg hoort bij FoundationOS: open voor elk eigen account, ook gratis
    { const b = document.querySelector('.tabbar button[data-tab="zorg"]'); if (b) b.style.display = (guest && !user.account) ? 'none' : ''; }
    // het OS-beginscherm leest dit: zonder pas geen wallet-tegel en geen balk
    // van Rahul, want allebei zijn ze voor leden
    document.getElementById('app').classList.toggle('os-gast', guest);
    });
    stap('renderHome', renderHome);
    // een pin-herstellink uit de mail opvangen (zie ./app-main-12.js)
    stap('pin-herstel', pinHerstelUitAdres);
    // Rahul opent het gesprek op het beginscherm zelf, met wat hij nu ziet
    stap('rahul-thuis', () => { if (!guest && window.RTGThuisRahul) RTGThuisRahul.opent(); });
    /* Terug waar je was, maar KORT. Dit venster stond op een half uur, en dat
       was te ver doorgeschoten: openTab schrijft de tijd bij elke schermwissel
       bij, dus het venster schoof steeds mee en in gewoon gebruik landde je
       vrijwel altijd weer in de app waar je was. Het beginscherm -- de tegels,
       de klok, het gezicht van het huis -- kreeg je dan nooit meer te zien.

       Waar dit voor bedoeld is, is de app die ONDER je vandaan wordt gedood:
       iOS ruimt een app in de achtergrond op, of je herlaadt per ongeluk, en
       dan hoor je niet je plek kwijt te raken. Dat gebeurt binnen seconden,
       niet binnen een half uur. Twee minuten dekt dat ruim, en alles wat
       later komt is een NIEUWE keer openen -- en die begint thuis. */
    const PLEK_VENSTER = 2 * 60000;
    let beginTab = 'home';
    try {
      const b = JSON.parse(localStorage.getItem('rtg_actieve_tab') || 'null');
      if (b && b.tab && Date.now() - (b.t || 0) < PLEK_VENSTER){
        const knop = document.querySelector('.tabbar button[data-tab="' + b.tab + '"]');
        if (knop && knop.style.display !== 'none') beginTab = b.tab;
      }
    } catch(e){}
    /* EEN ADRES MET EEN STAND (`#tab=salon`, of kort `#ai`): de sprong en
       andere schermen sturen een lid zo naar een stand van deze app. Hier, en
       niet met een timer ernaast: die drukte de knop soms vóór het account er
       was, en dan bleef de stand leeg. Alleen een knop die de pas toont telt;
       het adres wordt een keer gebruikt. */
    const adres = /^#(?:tab=([a-z]+)|(ai))$/.exec(location.hash);
    if (adres){
      const stand = adres[1] || adres[2];
      const knop = document.querySelector('.tabbar button[data-tab="' + stand + '"]');
      if (knop && knop.style.display !== 'none') beginTab = stand;
      try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
    }
    /* De tabbladen achter het beginscherm halen hun gegevens nu pas op als je
       ze opent -- zie LADERS_PER_TAB in ./app-main-12.js voor waarom, en wat
       er gemeten is. Hier blijven alleen de twee laders staan die aan geen
       enkel tabblad vastzitten; die gaan na het eerste beeld, een voor een.
       Zorg staat bewust niet meer hier: openTab vult die eigen tab via
       LADERS_PER_TAB, zodat een directe #tab=zorg-ingang niet afhankelijk is
       van een later idle-moment. */
    naBeeld([
      ['laadBestellen', laadBestellen], ['loadCv', loadCv]
    ]);

    openTab(beginTab);

    /* KIJKT DE APP OF ER IETS TE ZIEN IS. Een zwart scherm meldt zichzelf niet:
       er gooit niets, alle verzoeken slagen, en toch staat er niets. Daarom
       meten we het na het opbouwen gewoon na. Is het beginscherm leeg, dan
       gaan de MATEN naar het logboek (venster, hoogtes, aantal tegels, de
       rekeneenheid) -- genoeg om een layoutstoring te plaatsen zonder dat
       iemand een console hoeft te openen. Staat er wel wat, dan gebeurt er
       niets en weet niemand hiervan. */
    setTimeout(() => {
      try {
        /* WAT STAAT ER WERKELIJK MIDDEN OP HET SCHERM?

           De eerste versie van deze controle keek of er tegels BESTONDEN, en
           dat was te nauw: bij de melder stonden ze er wel en zag hij ze toch
           niet, dus zweeg de controle precies in het geval waarvoor hij bedoeld
           was. Bestaan is niet hetzelfde als zichtbaar zijn -- inhoud kan naast
           het scherm staan, nul hoog zijn, of achter iets anders liggen.

           elementFromPoint op het midden van het venster stelt de enige vraag
           die telt: kijkt de gebruiker naar iets van de app, of naar niets? */
        const thuis = document.querySelector('.os-thuisscherm');
        /* Deze gezondheidscontrole hoort uitsluitend bij Home. Op iedere
           interne appstand is de home-view bewust niet actief en heeft het
           thuisscherm dus hoogte nul. Dat als leeg scherm melden maakte iedere
           directe #tab-ingang na 2,5 s ten onrechte defect, terwijl de gekozen
           app gewoon zichtbaar was. */
        if (!thuis || !thuis.closest('.view[data-view="home"].active')) return;
        const tegels = document.querySelectorAll('.os-app').length;
        const hoog = thuis ? thuis.getBoundingClientRect().height : 0;
        const midden = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
        const leegMidden = !midden || midden === document.body || midden === document.documentElement;
        const buitenBeeld = thuis && (() => { const b = thuis.getBoundingClientRect();
          return b.bottom <= 0 || b.top >= innerHeight || b.width < 10; })();

        let reden = null;
        if (!tegels) reden = 'geen tegels';
        else if (hoog < 40) reden = 'thuisscherm zonder hoogte';
        else if (buitenBeeld) reden = 'thuisscherm buiten beeld';
        else if (leegMidden) reden = 'niets in het midden van het scherm';

        if (reden && window.RTGFoutmelder && RTGFoutmelder.meetLeeg) RTGFoutmelder.meetLeeg(reden);
      } catch (e) { /* een controle mag nooit de oorzaak van iets worden */ }
    }, 2500);
    if ((rtf.gekoppeld || []).length) ensurePush(false); // stil vernieuwen als het al aan staat
  }
