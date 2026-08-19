/* Vervolg van gebaar-01: WAT ER ONDER EEN REGEL LIGT -- de lade zelf, het
   openen en sluiten, het uitvoeren en de weg terug. Hoe een hand daar bij komt
   staat in gebaar-02b. Alle delen zitten in EEN gesloten IIFE, dus wat in het
   ene deel staat is in het andere gewoon bekend.

   DE DRIE MATEN. Ze staan hier bij elkaar omdat ze samen bepalen hoe het VOELT,
   en dat is geen som van drie losse keuzes: een lade van 84 breed met een
   drempel op 40% veegt heel anders dan dezelfde lade met een drempel op 70%. */
  var KNOP = 84;        // px per actie -- ruim genoeg voor een woord in kapitalen
  var RICHTING = 8;     // px voordat we weten of dit een veeg of een scroll is
  var STIL = 6;         // px waarboven de klik erna wordt ingeslikt

  var g = null;         // het lopende gebaar
  /* De lade die openstaat. Hij heet BEWUST niet `open`: dat is de naam van
     window.open, en een gedeelde laag die die naam in zijn eigen scope
     wegneemt, zet een val voor de volgende die hier iets bijschrijft. */
  var openLade = null;
  var netGeveegd = false;

  function px(el, naam, waarde) { el.style.setProperty(naam, waarde); }
  function tik(patroon) {
    if (rustig()) return;
    try {
      if (window.RTGWauw && window.RTGWauw.tik) window.RTGWauw.tik(patroon || 6);
      else if (navigator.vibrate) navigator.vibrate(patroon || 6);
    } catch (e) {}
  }

  /* ------------------------------------------------------------- de lade --
     ARIA-HIDDEN, EN DAT IS EEN BESLUIT EN GEEN VERGETELHEID. Bijna elke regel
     in dit huis is zelf een <a>; een <button> daarbinnen is ongeldige HTML en
     levert een schermlezer een knop IN een link op. De lade is daarom de weg
     voor een HAND (vinger, muis), en de weg voor een toets of een schermlezer
     is de actielade uit deel 3 -- met echte knoppen, in de bovenlaag, met
     dezelfde acties. Twee oppervlakken, een bediening; niet twee bedieningen. */
  function bouwLade(rij, kant, lijst, max) {
    var lade = d.createElement('span');
    lade.className = 'gb-lade';
    lade.setAttribute('data-kant', kant);
    lade.setAttribute('aria-hidden', 'true');
    var binnen = d.createElement('span');
    binnen.className = 'gb-binnen';
    lijst.forEach(function (a, i) {
      var b = d.createElement('span');
      b.className = 'gb-doe' + (i === 0 ? ' gb-eerste' : '');
      b.setAttribute('data-i', String(i));
      if (a.sig) b.setAttribute('data-sig', a.sig);
      b.innerHTML = svg(a.teken) + '<span>' + String(a.naam).replace(/[&<>]/g, '') + '</span>';
      binnen.appendChild(b);
    });
    lade.appendChild(binnen);
    rij.appendChild(lade);
    /* DE LADE IS ZO BREED ALS ZIJN WOORDEN. Een vaste maat per knop leek genoeg
       tot er een actie langskwam die 'Plan met Rahul' heet: die stond half in
       beeld, en een half woord op een knop is geen knop. Hier krijgt hij een tel
       lang zijn natuurlijke breedte, wordt hij gemeten, en daarna binnen de grens
       gehouden -- want een lade die de halve regel opeet is ook geen lade. */
    binnen.style.width = 'max-content';
    var vol = Math.round(Math.min(Math.max(lijst.length * KNOP, binnen.offsetWidth), max));
    binnen.style.width = '';
    px(lade, '--gb-vol', vol + 'px');
    lade.vol = vol;
    return lade;
  }

  function sluit(rij, meteen) {
    if (!rij) return;
    var lade = rij.querySelector(':scope > .gb-lade');
    px(rij, '--gb-duur', meteen || rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
    px(rij, '--gb-x', '0px');
    if (lade) {
      px(lade, '--gb-duur', meteen || rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
      px(lade, '--gb-lade', '0px');
      lade.removeAttribute('data-gereed');
    }
    if (openLade && openLade.rij === rij) openLade = null;
    /* Pas opruimen als de beweging klaar is: een lade die halverwege uit de DOM
       verdwijnt springt dicht in plaats van te sluiten. */
    setTimeout(function () {
      if (rij.querySelector(':scope > .gb-lade[data-gereed]')) return;
      if (openLade && openLade.rij === rij) return;
      var l = rij.querySelector(':scope > .gb-lade');
      if (l) l.remove();
      rij.removeAttribute('data-gb');
      var vast = rij.querySelectorAll('[data-gb-vast]');
      for (var i = 0; i < vast.length; i++) vast[i].removeAttribute('data-gb-vast');
      rij.style.removeProperty('--gb-x');
      rij.style.removeProperty('--gb-duur');
    }, meteen || rustig() ? 0 : 200);
  }
  function sluitAlles(meteen) { if (openLade) sluit(openLade.rij, meteen); }

  /* ---------------------------------------------------------- uitvoeren --
     DOORVEGEN VOERT UIT, dus er hoort een weg terug te zijn. Een actie die iets
     teruggeeft, geeft daarmee zijn terugweg: een functie wordt de knop
     'Terugdraaien', een tekst wordt een rustige bevestiging. Geeft hij niets
     terug, dan gebeurt er ook niets zichtbaars -- een 'Openen' die navigeert
     hoort geen melding achter te laten op een scherm dat je net verliet. */
  function voerUit(actie, rij) {
    if (!actie || typeof actie.doe !== 'function') return;
    var uit;
    try { uit = actie.doe(rij); } catch (e) { uit = null; }
    if (typeof uit === 'function') melding(actie.melding || actie.naam, uit);
    else if (typeof uit === 'string' && uit) melding(uit, null);
  }

  var toost = null;
  function melding(tekst, terug) {
    if (toost) { toost.remove(); toost = null; }
    var t = d.createElement('div');
    t.className = 'gb-terug';
    t.setAttribute('role', 'status');
    var s = d.createElement('span'); s.textContent = tekst; t.appendChild(s);
    if (typeof terug === 'function') {
      var b = d.createElement('button');
      b.type = 'button';
      b.textContent = T('gebaar.terug', 'Terugdraaien', 'Undo');
      b.addEventListener('click', function () {
        try { terug(); } catch (e) {}
        t.remove(); if (toost === t) toost = null;
      });
      t.appendChild(b);
    }
    d.body.appendChild(t);
    toost = t;
    setTimeout(function () { if (t.parentNode) t.remove(); if (toost === t) toost = null; }, 7000);
  }

