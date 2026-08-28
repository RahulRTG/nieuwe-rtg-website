/* RTG Scan: de scanknop van de leden-app. Stond in ./app-main-56.js naast het
   zegel, en dat waren twee onderwerpen in een bestand -- de omvangregel van de
   keuring wees dat aan zodra deze laag er inhoud bij kreeg. */
  /* ---------- RTG Scan: EEN weg voor elke code (LINK.md par. 4, stap 4) ----------

     HIER STOND EEN KETEN VAN ALS-DANS: is het een tafel, dan het menu; is het
     een kascode, dan een tekstje; is het een entree, dan een ander tekstje; en
     anders de ruwe tekst. Elke nieuwe soort code kwam er als een tak bij, en
     elke app had zijn eigen keten -- precies de versnippering waar RTG Link voor
     bestaat. De vraag "wat is dit en wat kan ik ermee" wordt nu EEN keer
     gesteld, aan de laag die het weet.

     De weg is die van LINK.md par. 2: oplossen, laten zien wat er gaat gebeuren
     (shared/linkkaart.js), een mens laten bevestigen, en dan pas uitvoeren.

     WAT ER NIET VERANDERT: de handelingen zelf. Een tafel opent nog steeds het
     menu, een verzoek gaat nog steeds langs /member/pin/connect. De laag zegt
     alleen WELKE weg erbij hoort; deze tabel weet hoe die weg er in dit scherm
     uitziet -- soms een aanroep, soms een la die opengaat. */
  const LINK_ACTIES = {
    // een mens toevoegen: de vaste pin draagt hij leesbaar, de levende code niet
    'contact.verbinden': async (kaart, tekst, intentie) => {
      const g = window.RTGCode ? RTGCode.lees(tekst) : { soort: 'tekst' };
      const lijf = kaart.vorm === 'levend'
        ? { livecode: tekst, bevestiging: kaart.bevestiging }
        : { pin: g.pin || tekst, bevestiging: kaart.bevestiging };
      const r = await API.call(intentie.weg.replace(/^\/api/, ''), lijf);
      toast(T('scan.verzoekuit','Verzoek verstuurd naar ') + (kaart.onderwerp.codename || r.codename || ''));
      if (typeof loadSocial === 'function') loadSocial();
    },
    // al verbonden: dan is de volgende stap een gesprek, geen tweede verzoek
    'contact.gesprek': async (kaart) => {
      if (!kaart.onderwerp.key) { toast(T('scan.geenchat','Open het gesprek vanuit je vriendenlijst.')); return; }
      openDm(kaart.onderwerp.key, kaart.onderwerp.codename || '');
    },
    // de tafel-QR: hetzelfde als altijd, alleen nu met de kaart ervoor
    'plaats.bestellen': async (kaart) => {
      await openMenu(kaart.onderwerp.code);
      if (menuState){ menuState.table = kaart.onderwerp.plek || ''; renderMenuSheet(); }
      toast('\u{1FA91} ' + (kaart.onderwerp.plek ? T('scan.tafel','Tafel') + ' ' + kaart.onderwerp.plek : T('scan.zaakopen','Menu geopend')));
    },
    /* Een capability: iemand vraagt je iets te doen -- vandaag "betaal mij" uit
       kern/pay/vraagcode.js. Wat er precies gebeurt stond op de kaart; hier
       wordt het alleen nog uitgevoerd. */
    'capability.aanvaarden': async (kaart, tekst, intentie) => {
      const r = await API.call(intentie.weg.replace(/^\/api/, ''), { capcode: tekst });
      toast((r.kaart && r.kaart.wat ? r.kaart.wat + ': ' : '') + T('scan.gedaan','gelukt.'));
      if (typeof ververs === 'function') ververs();
    }
  };

  async function scanRoute(tekst){
    if (!window.RTGLinkKaart){ toast(T('scan.nietklaar','De scanner is nog niet geladen.')); return; }
    let kaart;
    try {
      kaart = await API.call('/link/los', { tekst });
    } catch(e){
      /* 422 = dit is geen code van ons. Dan is de eerlijkste uitkomst nog steeds
         wat er stond: een QR van de bushalte hoort geen foutmelding te geven. */
      if (e && e.status === 422) { toast(String(tekst || '').slice(0, 90)); return; }
      toast(e.message || T('scan.nietgevonden','Deze code kon niet worden geopend.'));
      return;
    }
    const keuze = await RTGLinkKaart.toon(kaart, {});
    if (!keuze) return;
    const doen = LINK_ACTIES[keuze.id];
    /* Een knop zonder handeling hoort niet te bestaan: de lijst van de server en
       deze tabel gaan over dezelfde intenties, en test/linkscan.test.js zakt
       zodra er een bijkomt die hier ontbreekt. */
    if (!doen){ toast(T('scan.nognietkan','Dit kan in deze app nog niet.')); return; }
    try { await doen(kaart, tekst, keuze); }
    catch(e){ toast(e.message || T('scan.mislukt','Dat lukte niet.')); }
  }
  const _scanBtn = document.getElementById('scanBtn');
  if (_scanBtn) _scanBtn.addEventListener('click', () => {
    if (!window.RTGScanknop){ toast(T('scan.nietklaar','De scanner is nog niet geladen.')); return; }
    RTGScanknop.open({
      titel: T('scan.titel','Scan een RTG-code'),
      hint: T('scan.hint','Richt op de QR op je tafel om te bestellen, of op een andere RTG-code.'),
      onCode: (c) => { scanRoute(c.tekst); }
    });
  });
