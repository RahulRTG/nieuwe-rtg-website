  function methodLabel(m){ return m==='rtgpay'?'RTG Pay':m==='pin'?T('pos.pin','PIN'):m==='contant'?T('pos.cash','Contant'):m==='rtg'?T('pos.rtg','RTG-code'):m==='kamer'?T('pos.room','Op de kamer'):m==='tafel'?T('pos.table','Op de tafel'):m==='app'?T('pos.app','In de app'):m; }
/* HOE EEN BETAALCODE VAN EEN GAST BINNENKOMT, en daarna de kassa-opbouw.

   Dit is de tweede helft van ./leverancier-61.js. Dat bestand ging over de
   10 kB-lat toen het bedoelingsscherm bij de betaalcode kwam, en de knip loopt
   hier waar het onderwerp wisselt: daar de menukaart, hier de betaalcode en het
   scherm dat hem gebruikt.

   DE KNIP LOOPT OP DE PLEK ZELF EN VERPLAATST NIETS. De delen van een bundel
   worden achter elkaar geplakt (scripts/bundel.js) en ze splitsen NIET op
   functiegrenzen: dit bestand begint en eindigt gewoon midden in de app-functie.
   Een blok uit het midden knippen en achteraan bijplakken zet het daarmee in een
   ANDERE functie -- en dat is op het scherm een ReferenceError. Dat is hier een
   keer gebeurd; check.js regel 24 ving het op.

   Twee functies, en het verschil ertussen is de reden dat het er twee zijn:
   `vraagPayCode` HAALT de code op (tap to pay, scannen, typen) en
   `payCodeMetKaart` laat er eerst het bedoelingsscherm overheen gaan. De vier
   kassa-ingangen roepen de tweede aan; de eerste is alleen voor de tweede. */
  /* RTG Pay aan de kassa: tap to pay als het kan (de gast houdt zijn toestel
     hiertegen), met altijd de uitweg om de code te typen; werkt de NFC-chip
     niet of tikt er niemand, dan komt het typvenster vanzelf.

     DIT HAALT ALLEEN DE CODE OP. Wat ermee gebeurt voordat het een bon wordt,
     staat in payCodeMetKaart hieronder -- en dat is wat de kassa's aanroepen. */
  async function vraagPayCode(){
    if (window.TapPay && TapPay.kan()){
      const tap = window.confirm(T('pos.tapkeuze','Tap to pay: de gast tikt zijn toestel hiertegen. Liever de code scannen of typen? Kies dan Annuleren.'));
      if (tap){
        toast(''+T('pos.tap','Tap to pay: laat de gast het toestel hiertegen houden...'));
        const code = await TapPay.lees(12000);
        if (code){ toast(''+T('pos.tapok','Code ontvangen via tap to pay.')); return code; }
        toast(T('pos.tapmis','Geen tik ontvangen; scan of typ de code van de gast.'));
      }
    }
    // scan de betaal-QR op het scherm van de gast; het scanscherm biedt zelf een
    // typveld aan als er geen camera is of de code niet leesbaar is
    if (window.RTGScanknop){
      return await new Promise((resolve) => {
        let klaar = false;
        RTGScanknop.open({
          titel: T('pos.scanbetaal','Scan de betaalcode'),
          hint: T('pos.scanbetaalhint','Scan de QR op het scherm van de gast.'),
          handTekst: T('pos.oftyp','Of typ de betaalcode'),
          /* HOOFDLETTERS ALLEEN WAAR DAT MAG. Een getypte kassacode leest
             prettiger in kapitalen, maar een ondertekende RTG-code is
             hoofdlettergevoelig -- de regel staat in shared/rtgcode.js, want
             elke scanner heeft hem. */
          onCode: (c) => {
            klaar = true;
            var t = (c.tekst||'').trim();
            resolve((window.RTGCode && !RTGCode.hoofdlettersMogen(t) ? t : t.toUpperCase()) || null);
          },
          onSluit: () => { if (!klaar) resolve(null); }
        });
      });
    }
    const c = window.prompt(T('pos.paycode','Betaalcode van de gast (uit de app):'));
    return c ? c.trim().toUpperCase() : null;
  }

  /* DE ENE WEG WAARLANGS EEN BETAALCODE VAN EEN GAST BINNENKOMT. Het
     bedoelingsscherm stond eerst alleen in de POS-verkoop; de andere drie
     kassa-ingangen (uitchecken van een kamer of tafel, en de winkelvloer) namen
     dezelfde code zonder kaart. Een belofte uit LINK.md die op een van de vier
     plekken geldt, is geen belofte (LAT.md regel 4).

     Een getypte code van zes tekens gaat rechtstreeks door: daar valt niets te
     tonen wat de kassa niet al weet, en de gast staat ervoor. Gaat er iets mis
     bij het ophalen (geen netwerk, verlopen code), dan stopt het hier: liever
     geen bon dan een bon waarvan niemand zag wat hij deed.

     `bedrag` is optioneel en in euro's: staat het vast voordat de gast betaalt,
     dan komt het als "Deze bon" naast wat de code maximaal toestaat. Bij het
     uitchecken en op de winkelvloer rekent de server het totaal pas uit, dus
     daar blijft het leeg -- liever geen regel dan een verzonnen regel. */
  async function payCodeMetKaart(bedrag){
    const code = await vraagPayCode();
    if (!code) return null;
    if (String(code).slice(0,5) !== 'RTG1.' || !window.RTGLinkKaart) return code;
    let kaart = null;
    try { kaart = await API.call('/link/los', { tekst: code }); }
    catch(e){ toast(e.message); return null; }
    const extra = Number.isFinite(Number(bedrag)) && Number(bedrag) > 0
      ? [{ naam: T('pos.dezebon','Deze bon'), waarde: eur(Number(bedrag)), nadruk: true }] : [];
    const keuze = await RTGLinkKaart.toon(kaart, { extra });
    return keuze ? code : null;
  }

  function renderKassa(){
    const el = $('#kassaWrap'); if (!el) return;
    const type = S.type;
    let html = '';
    if (type==='restaurant'||type==='bar'||type==='club') html = kassaHoreca();
    else if (type==='hotel'||type==='apartment'||type==='villa') html = kassaHotel();
    else html = kassaVervoer();
    html += kassaDay();
    html += '<div id="zWrap"></div><div id="shiftWrap"></div>';
    el.innerHTML = html;
    bindKassa(type);
    laadZ();
