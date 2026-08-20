/* Muisvrij bedienen, deel 4: het gesprek.

   Dit maakt van de balk een chat in plaats van een antwoordregel. Jij rechts in
   bordeaux, Rahul links op zwart met zijn signatuurmond ernaast, drie puntjes
   terwijl hij bezig is, en nieuwe beurten onderaan.

   Twee dingen die het gevoel maken, en die je makkelijk vergeet:

   - het gesprek begint niet leeg. Bij het openen halen we de doorlopende
     conversatie op (/api/chat/history). Dat is DEZELFDE conversatie als in de
     chat van de leden-app; de server legt sinds deze ronde ook de beurten van de
     assistent daarin vast. Zonder dat zou je in het OS met een vreemde praten
     die je nooit eerder gesproken hebt.
   - jouw woorden staan er meteen, nog voordat er een antwoord is. Anders zie je
     je eigen zin pas terug als hij klaar is, en dat leest als een formulier.

   Bij Lifestyle en Business is dit gesprek de lijn naar een MENS (de concierge).
   De server weigert daar assistent-beurten in het draadje te zetten; de beurten
   die je hier tikt blijven in beeld zolang de pagina open is, maar gaan niet het
   gesprek in dat de concierge leest. Anders zou het lijken alsof zij iets zei
   wat de AI zei. Beurten van een mens krijgen een gouden rand, zodat te zien is
   wie er aan het woord was. */
(function (root) {
  'use strict';
  if (root.__handenvrijChat) return; root.__handenvrijChat = true;
  var kamer = root.__handenvrijKamer;
  if (!kamer || !kamer.vak) return;
  var vak = kamer.vak;

  /* De opmaak hoort bij dit deel, niet bij de balk: jij rechts in bordeaux,
     Rahul links op zwart met zijn mond ernaast, nieuw onderaan, venster rolt mee. */
  var css =
    /* Een DEKKENDE achtergrond, niet doorschijnend: over de drukke OS-pagina heen
       werd het een modderige laag waarin je geen van beide meer las. */
    '.hv-chat{position:fixed;left:0;right:0;bottom:3.4rem;z-index:37;display:flex;flex-direction:column;gap:.5rem;' +
    'padding:.7rem .8rem;background:#0C0C0B;border-top:1px solid #2a2a28;' +
    'font-family:Inter,system-ui,sans-serif;max-height:46vh;overflow-y:auto;overscroll-behavior:contain;}' +
    '.hv-chat[hidden]{display:none;}body.hv-ruimte{padding-bottom:3.6rem;}' +
    '.hv-beurt{display:flex;gap:.5rem;align-items:flex-end;max-width:100%;}' +
    '.hv-beurt.ik{flex-direction:row-reverse;}' +
    '.hv-bel{max-width:76%;padding:.5rem .7rem;border-radius:0;font-size:.86rem;line-height:1.5;' +
    'white-space:pre-wrap;overflow-wrap:anywhere;}' +
    '.hv-beurt.hij .hv-bel{background:#1A1817;color:#e8e6e3;border:1px solid #2f2c29;border-bottom-left-radius:5px;}' +
    /* De bordeaux van het logo, VAST. Niet var(--burgundy): in het leden-OS
       verschuift die met de paletmotor (dagkleur/seizoen), en dan wordt een
       merkkleur door een stemmingskleur overschreven. Hier stond een lichtroze
       bubbel met wit erop; dat is noch de huisstijl noch leesbaar. */
    '.hv-beurt.ik .hv-bel{background:#7F1634;color:#fff;border-bottom-right-radius:5px;}' +
    '.hv-beurt.mens .hv-bel{border-color:#857007;}' +
    /* De signatuurmond als zijn gezicht. Kleiner dan dit wordt hij een vlekje in
       plaats van lippen, en dan is geen gezicht beter dan een slecht gezicht. */
    '.hv-kop{flex:0 0 auto;width:2.5rem;height:2.5rem;border-radius:0;background:#0C0C0B;' +
    'border:1px solid #857007;display:flex;align-items:center;justify-content:center;overflow:hidden;}' +
    '.hv-kop canvas{width:2.5rem;height:auto;display:block;}' +
    '.hv-wie{font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:#8A8680;margin-bottom:.15rem;}' +
    '.hv-tijd{font-size:.66rem;color:#6f6b66;margin-top:.2rem;}' +
    '.hv-beurt.ik .hv-tijd{color:rgba(255,255,255,.6);}' +
    /* hij is aan het typen: drie puntjes die om de beurt oplichten */
    '.hv-tikt{display:inline-flex;gap:.25rem;padding:.1rem 0;}' +
    '.hv-tikt i{width:.34rem;height:.34rem;border-radius:0;background:#8A8680;animation:hvTik 1.1s infinite;}' +
    '.hv-tikt i:nth-child(2){animation-delay:.16s;}.hv-tikt i:nth-child(3){animation-delay:.32s;}' +
    '@keyframes hvTik{0%,60%,100%{opacity:.25;transform:translateY(0);}30%{opacity:1;transform:translateY(-2px);}}' +
    '@media (prefers-reduced-motion: reduce){.hv-tikt i{animation:none;opacity:.6;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var klok = function (at) {
    try { return new Date(at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };

  /* De mond van Rahul naast zijn beurt. shared/mond.js tekent de signatuurlippen
     en kan ze laten bewegen; is die er niet, dan blijft er een gouden rondje
     staan en verandert er verder niets. */
  var monden = [];
  function kopje() {
    var d = document.createElement('div');
    d.className = 'hv-kop';
    d.setAttribute('aria-hidden', 'true');
    if (root.RTGMond) {
      /* Dezelfde canvasmaat als de metgezel gebruikt (440x200). Op een kleiner
         doek worden de puntjes van het lippenveld relatief te groot en zie je een
         vlekje in plaats van een mond; CSS schaalt het daarna netjes terug. */
      var c = document.createElement('canvas');
      c.width = 440; c.height = 200;
      d.appendChild(c);
      try { monden.push(root.RTGMond.maak(c)); } catch (e) {}
    }
    return d;
  }
  (function haalMond() {
    if (root.RTGMond) return;
    var s = document.createElement('script');
    s.src = '/shared/mond.js'; s.defer = true;
    document.head.appendChild(s);
  })();
  function praat(ms) { monden.forEach(function (m) { try { m.praat(ms || 1200); } catch (e) {} }); }

  function naarBeneden() { try { vak.scrollTop = vak.scrollHeight; } catch (e) {} }

  /* Wie het paneel omhoog of omlaag zet, is handenvrij-scherm.js: dat kent de
     standen en de regel "hij praat -> omhoog, jij antwoordt -> omlaag". Is die
     laag er niet (of nog niet geladen), dan doen we het oude, simpele: gewoon
     zichtbaar maken. Hier zelf .hidden zetten zou de standen omzeilen. */
  function inBeeld(van) {
    if (kamer.naStand) kamer.naStand(van);
    else vak.hidden = false;
  }

  /* Een beurt toevoegen. van: 'member' (jij), 'rahul' (de assistent) of iets
     anders (een mens: concierge, backoffice). */
  function beurt(van, tekst, at) {
    var t = String(tekst == null ? '' : tekst).trim();
    if (!t) return null;
    tikt(false);
    var ik = van === 'member';
    var mens = !ik && van !== 'rahul';
    var rij = document.createElement('div');
    rij.className = 'hv-beurt ' + (ik ? 'ik' : 'hij') + (mens ? ' mens' : '');
    if (!ik) rij.appendChild(kopje());
    var bel = document.createElement('div');
    bel.className = 'hv-bel';
    bel.innerHTML = (mens ? '<div class="hv-wie">RTG Concierge</div>' : '') +
      esc(t) + '<div class="hv-tijd">' + esc(klok(at || Date.now())) + '</div>';
    rij.appendChild(bel);
    vak.appendChild(rij);
    inBeeld(van);
    naarBeneden();
    if (!ik) praat(Math.min(4000, 500 + t.length * 22));  // even bewegen, naar lengte
    return rij;
  }

  /* De drie puntjes. Er is er altijd maar een, en hij verdwijnt zodra de
     volgende beurt komt (beurt() ruimt hem zelf op). */
  var puntjes = null;
  function tikt(aan) {
    if (!aan) { if (puntjes) { puntjes.remove(); puntjes = null; } return; }
    if (puntjes) return;
    puntjes = document.createElement('div');
    puntjes.className = 'hv-beurt hij';
    puntjes.appendChild(kopje());
    var bel = document.createElement('div');
    bel.className = 'hv-bel';
    bel.innerHTML = '<span class="hv-tikt" role="status" aria-label="Rahul is bezig"><i></i><i></i><i></i></span>';
    puntjes.appendChild(bel);
    vak.appendChild(puntjes);
    inBeeld('rahul');
    naarBeneden();
    praat(1500);
  }

  /* Het gesprek ophalen zoals het was. Alleen voor een lid (een zaak heeft deze
     conversatie niet); de laatste tien beurten zijn genoeg om de draad op te
     pakken zonder de halve pagina vol te zetten. */
  var geladen = false;
  function laadGesprek() {
    if (geladen || !kamer.tok) return;
    geladen = true;
    var isLid = false;
    try { isLid = !!localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!isLid) return;
    fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kamer.tok },
      body: JSON.stringify({ lang: kamer.taal ? kamer.taal() : 'nl' })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var m = (d && d.messages) || [];
        if (!m.length) return;
        m.slice(-10).forEach(function (b) { beurt(b.from, b.text, b.at); });
        /* Het opgehaalde gesprek staat er, maar hoeft niet in beeld te
           springen: je begint waar je was, niet met een openklappend paneel. */
        if (root.RTGChatScherm) root.RTGChatScherm.zet('min'); else vak.hidden = true;
      })
      .catch(function () {});
  }

  kamer.beurt = beurt;
  kamer.tikt = tikt;
  kamer.laadGesprek = laadGesprek;
  // het venster hangt pas in de body als die er is; wacht daar netjes op
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', laadGesprek);
  else laadGesprek();
})(typeof self !== 'undefined' ? self : this);
