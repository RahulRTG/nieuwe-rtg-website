/* ============================================================================
   MEELEZEN: EEN TEKSTBAAN IN EEN LIVE GESPREK.

   WAAROM DIT ER IS. TOEGANKELIJK.md zegt het zo hard als het is: acht live
   vormen -- zes gesprekken en twee uitzendingen -- hebben geen weg naar tekst,
   en zolang die er niet is kan een dove deelnemer NIET MEEDOEN aan een gesprek
   in dit huis. Een <track> kan daar niet bestaan, want het beeld ontstaat nu.

   WAT DIT WEL IS. Een baan onder het gesprek waarin deelnemers meeschrijven, en
   die bij iedereen live meeloopt. Daarmee kan wie doof is het gesprek volgen en
   eraan meedoen: lezen wat er getypt wordt, en zelf typen. Dat is een echte
   voorziening en niet een knop die ergens heen wijst.

   WAT DIT NADRUKKELIJK NIET IS, en dat hoort er even hard bij te staan:
   ONDERTITELING. Er wordt hier niets van spraak naar tekst omgezet. Wat er in de
   baan staat, staat er omdat een MENS het heeft getypt. WCAG 1.2.4 (live
   ondertiteling) is hiermee dus niet gehaald, en dit register mag daar niet voor
   worden opgepoetst. Wat het wel doet is de afhankelijkheid verplaatsen: van
   "kan niet meedoen" naar "kan meedoen als de anderen meetypen".

   WAAROM ER GEEN AUTOMATISCHE ONDERTITELING IN ZIT. Dat is een BESLUIT en geen
   ontbrekende regel code. Spraakherkenning in de browser (de Web Speech API)
   stuurt het geluid van het gesprek naar een server van de leverancier, en dit
   huis draait op codenamen met de echte namen in een aparte kluis -- het
   gesprek van twee leden naar buiten sturen om er tekst van te maken is precies
   wat dat ontwerp voorkomt. De weg die hier wel past loopt langs een LOKAAL
   model (LOCAL_AI_URL), en dat is een inrichtingskeuze. Deze module laat die
   deur open met een naad die niets aanneemt: `voed(regel, { bron })`. Wie een
   lokale herkenner aansluit, roept dezelfde functie aan met bron 'machine', en
   de baan laat dan zien dat het machinetekst is.

   DE NAAD NAAR HET GESPREK. Elk gesprek in dit huis heeft al een seinfunctie
   die getypte signalen doorgeeft aan de andere kant (offer, answer, ice,
   hangup). Een tekstregel is gewoon een kind erbij; er hoeft geen tweede kanaal
   naast. Vandaar twee haken en verder niets: `stuur` geeft een regel aan het
   gesprek mee, en de omgeving roept `voed` aan als er een binnenkomt.

   VEILIGHEID. Wat binnenkomt is tekst van een andere deelnemer en gaat NOOIT
   als HTML het scherm op -- alleen textContent. De lengte wordt hier afgekapt
   en niet op de server: dezelfde payload draagt ook SDP-blokken, en die zijn
   groot; een grens daarop zou het gesprek breken.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var MAX = 400;            // een regel meelezen, geen opstel
  var BEWAAR = 60;          // zoveel regels blijven staan; ouder schuift eruit

  function schoon(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX); }

  /* De baan zelf. Hij hangt in het gespreksvenster en niet als los paneel: wie
     meeleest kijkt naar het gesprek, niet ernaast. */
  function maak(opties) {
    opties = opties || {};
    var wrap = d.createElement('div');
    wrap.className = 'meelees';
    wrap.setAttribute('data-meelees', '1');
    wrap.style.cssText = 'margin-top:.6rem;font-family:Inter,system-ui,sans-serif;';

    var kop = d.createElement('div');
    kop.className = 'meelees-kop';
    kop.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;';
    var knop = d.createElement('button');
    knop.type = 'button';
    knop.className = 'meelees-knop';
    knop.textContent = 'Meelezen';
    knop.setAttribute('aria-expanded', 'false');
    knop.style.cssText = 'padding:.35rem .7rem;border:1px solid rgba(255,255,255,.22);border-radius:999px;' +
      'background:transparent;color:inherit;font:inherit;font-size:.85rem;cursor:pointer;';
    kop.appendChild(knop);
    wrap.appendChild(kop);

    var baan = d.createElement('div');
    baan.className = 'meelees-baan';
    baan.hidden = true;
    /* Een LOG met aria-live: nieuwe regels worden voorgelezen zonder dat de
       focus verspringt, en een schermlezer krijgt ze in volgorde. `polite`, want
       dit is meelezen en geen alarm. */
    baan.setAttribute('role', 'log');
    baan.setAttribute('aria-live', 'polite');
    baan.setAttribute('aria-label', 'Meelezen: wat er getypt wordt in dit gesprek');
    baan.style.cssText = 'max-height:9rem;overflow-y:auto;padding:.5rem .6rem;border-radius:10px;' +
      'background:rgba(255,255,255,.06);font-size:.9rem;line-height:1.45;';
    wrap.appendChild(baan);

    var rij = d.createElement('form');
    rij.hidden = true;
    rij.className = 'meelees-rij';
    rij.style.cssText = 'display:flex;gap:.4rem;margin-top:.4rem;';
    var veld = d.createElement('input');
    veld.type = 'text';
    veld.className = 'meelees-veld';
    veld.maxLength = MAX;
    veld.placeholder = 'Typ mee zodat iedereen meeleest';
    veld.setAttribute('aria-label', 'Typ een regel mee in dit gesprek');
    veld.style.cssText = 'flex:1;min-width:0;padding:.45rem .6rem;border-radius:8px;border:1px solid rgba(255,255,255,.22);' +
      'background:rgba(0,0,0,.25);color:inherit;font:inherit;';
    var zend = d.createElement('button');
    zend.type = 'submit';
    zend.textContent = 'Stuur';
    zend.style.cssText = 'padding:.45rem .8rem;border:0;border-radius:8px;background:#7F1634;color:#fff;font:inherit;cursor:pointer;';
    rij.appendChild(veld); rij.appendChild(zend);
    wrap.appendChild(rij);

    var open = false;
    function zetOpen(aan) {
      open = !!aan;
      baan.hidden = !open; rij.hidden = !open;
      knop.setAttribute('aria-expanded', open ? 'true' : 'false');
      knop.textContent = open ? 'Meelezen sluiten' : 'Meelezen';
      if (open) veld.focus();
    }
    knop.addEventListener('click', function () { zetOpen(!open); });

    /* Een regel erbij. `bron` zegt waar hij vandaan komt: 'mens' (iemand typte
       hem) of 'machine' (een lokale herkenner). Dat verschil staat op het
       scherm, want tekst die een machine heeft geraden is iets anders dan tekst
       die iemand heeft geschreven, en wie meeleest hoort dat te weten. */
    function voeg(tekst, info) {
      var t = schoon(tekst);
      if (!t) return null;
      info = info || {};
      var r = d.createElement('p');
      r.className = 'meelees-regel';
      r.style.cssText = 'margin:0 0 .3rem;';
      if (info.wie) {
        var wie = d.createElement('strong');
        wie.textContent = String(info.wie).slice(0, 60) + ': ';
        wie.style.cssText = 'font-weight:600;';
        r.appendChild(wie);
      }
      r.appendChild(d.createTextNode(t));      // NOOIT innerHTML: dit komt van een ander
      if (info.bron === 'machine') {
        var merk = d.createElement('span');
        merk.textContent = ' (automatisch)';
        merk.style.cssText = 'opacity:.6;font-size:.85em;';
        r.appendChild(merk);
      }
      baan.appendChild(r);
      while (baan.children.length > BEWAAR) baan.removeChild(baan.firstChild);
      baan.scrollTop = baan.scrollHeight;
      return r;
    }

    rij.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = schoon(veld.value);
      if (!t) return;
      veld.value = '';
      voeg(t, { wie: opties.ik || 'Jij', bron: 'mens' });
      /* De eigen regel staat er al voordat het sein de deur uit is: wie meeleest
         moet zien dat zijn regel is verzonden, ook als de ander wegvalt. */
      if (typeof opties.stuur === 'function') { try { opties.stuur(t); } catch (err) {} }
    });

    return {
      el: wrap,
      open: function () { zetOpen(true); },
      sluit: function () { zetOpen(false); },
      get isOpen() { return open; },
      /* Een regel van de andere kant, of van een lokale herkenner. Vouwt de baan
         vanzelf open: een binnenkomende regel die niemand ziet omdat het paneel
         dicht staat, is geen weg naar tekst. */
      voed: function (tekst, info) {
        var r = voeg(tekst, info || { bron: 'mens' });
        if (r && !open) zetOpen(true);
        return r;
      },
      regels: function () {
        return Array.prototype.map.call(baan.children, function (x) { return x.textContent; });
      },
      leeg: function () { while (baan.firstChild) baan.removeChild(baan.firstChild); }
    };
  }

  w.RTGMeelezen = { maak: maak, MAX: MAX, BEWAAR: BEWAAR, schoon: schoon };
}(window, document));
