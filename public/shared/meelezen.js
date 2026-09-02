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

   ER ZIT NU WEL AUTOMATISCHE TEKST IN. De deur die hier openstond
   (`voed(regel, { bron })`) is op 2 september 2026 gebruikt:
   shared/spraaktekst.js zet spraak om en voedt deze baan met bron 'machine'.
   Wat dat begrensd houdt staat in de kop van die module en komt op een zin
   neer: JE TRANSCRIBEERT JEZELF. Zet de ander hem niet aan, dan is er van diens
   spraak nog steeds geen tekst -- WCAG 1.2.4 is dus niet gehaald, en het
   register van check.js regel 49 telt deze acht nog steeds als OPEN.

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
    knop.style.cssText = 'padding:.35rem .7rem;border:1px solid rgba(255,255,255,.22);border-radius:0;' +
      'background:transparent;color:inherit;font:inherit;font-size:.85rem;cursor:pointer;';
    kop.appendChild(knop);

    /* De bediening van de spraak hangt in deze kop maar woont ernaast: deze
       module gaat over een baan met tekst en niet over een microfoon. */
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
    baan.style.cssText = 'max-height:9rem;overflow-y:auto;padding:.5rem .6rem;border-radius:0;' +
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
    veld.style.cssText = 'flex:1;min-width:0;padding:.45rem .6rem;border-radius:0;border:1px solid rgba(255,255,255,.22);' +
      'background:rgba(0,0,0,.25);color:inherit;font:inherit;';
    var zend = d.createElement('button');
    zend.type = 'submit';
    zend.textContent = 'Stuur';
    zend.style.cssText = 'padding:.45rem .8rem;border:0;border-radius:0;background:#7F1634;color:#fff;font:inherit;cursor:pointer;';
    rij.appendChild(veld); rij.appendChild(zend);
    wrap.appendChild(rij);

    var open = false;
    function zetOpen(aan) {
      open = !!aan;
      baan.hidden = !open; rij.hidden = !open;
      knop.setAttribute('aria-expanded', open ? 'true' : 'false');
      knop.textContent = open ? 'Meelezen sluiten' : 'Meelezen';
      if (open) veld.focus();
      /* DE BAAN DICHT IS DE MICROFOON UIT: een herkenner die doorluistert
         achter een paneel dat niemand ziet, is precies wat deze knop niet mag
         opleveren. (`spraak` is bij het bouwen nog undefined; deze tak loopt
         pas na een tik.) */
      if (!open && spraak) spraak.stop();
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

    /* EEN REGEL DE DEUR UIT, langs precies een weg. Getypt, gesproken en
       gevraagd komen alle drie hier langs, zodat er maar EEN plek is waar de
       eigen regel in de baan komt en naar de ander gaat. Drie kopieen hiervan
       was de vorm waarin het meest recente gat in dit huis ontstond. */
    function zendEigen(tekst, bron) {
      var t = schoon(tekst);
      if (!t) return;
      voeg(t, { wie: opties.ik || 'Jij', bron: bron || 'mens' });
      /* De eigen regel staat er al voordat het sein de deur uit is: wie meeleest
         moet zien dat zijn regel is verzonden, ook als de ander wegvalt. */
      if (typeof opties.stuur === 'function') { try { opties.stuur(t); } catch (err) {} }
    }

    rij.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = schoon(veld.value);
      if (!t) return;
      veld.value = '';
      zendEigen(t, 'mens');
    });

    /* Spraak en het verzoek erom zitten in shared/spraaktekst.js. Is die er
       niet, dan werkt de baan als eerst: meetypen. De goede kant om te
       ontbreken -- check.js regel 65 houdt vast dat elke pagina die hem
       gebruikt hem ook laadt. */
    var spraak = null;
    if (w.RTGSpraakTekst && typeof w.RTGSpraakTekst.koppel === 'function') {
      spraak = w.RTGSpraakTekst.koppel({
        kop: kop,
        na: kop,
        knopStijl: knop.style.cssText,
        /* Een herkende zin gaat dezelfde weg als een getypte, met bron
           'machine': wie meeleest hoort te weten dat dit geraden tekst is. */
        zend: function (regel, bron) { zendEigen(regel, bron); },
        open: function () { zetOpen(true); }
      });
    }

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
      leeg: function () { while (baan.firstChild) baan.removeChild(baan.firstChild); },
      /* Voor een toets en voor een scherm dat het gesprek afsluit: de herkenner
         hoort niet door te lopen als het gesprek weg is. */
      get spraakAan() { return !!(spraak && spraak.aan); },
      stopSpraak: function () { if (spraak) spraak.stop(); }
    };
  }

  w.RTGMeelezen = { maak: maak, MAX: MAX, BEWAAR: BEWAAR, schoon: schoon };
}(window, document));
