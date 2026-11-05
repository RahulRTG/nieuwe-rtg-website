/* Bouwt de gedeelde wereldnavigatie met toegankelijke bediening. */\n    balk.className = 'ws-balk' + (ds ? ' ds-wereldnav' : '');
    balk.setAttribute('aria-label', wereld.naam ? ('Navigatie ' + wereld.naam) : 'Hoofdnavigatie');

    var actief = actieveBestemming();
    wereld.bestemmingen.forEach(function (b) {
      var adres = veiligAdres(b.href);
      if (!adres) return;
      var a = d.createElement('a');
      a.className = 'ws-doel' + (ds ? ' ds-knop ds-knop--klein' : '');
      a.setAttribute('href', adres);
      if (b.id === actief) a.setAttribute('aria-current', 'page');
      glyfIn(a, b.glyf);
      var lab = d.createElement('span');
      lab.textContent = b.naam;
      a.appendChild(lab);
      /* Gewapend om ernaast te openen? Dan is deze tik geen navigatie maar een
         paneel. De link blijft een link, dus zonder JS en met een middelklik
         werkt hij gewoon zoals hij eruitziet. */
      a.addEventListener('click', function (e) {
        if (!naastAan) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openNaast(adres, b.naam);
        wapen(false);
      });
      balk.appendChild(a);
    });

    var voet = d.createElement('div');
    voet.className = 'ws-voet' + (ds ? ' ds-wereldnav-voet' : '');

    splitsKnop = d.createElement('button');
    splitsKnop.type = 'button';
    splitsKnop.className = 'ws-splits' + (ds ? ' ds-knop ds-knop--klein' : '');
    splitsKnop.setAttribute('aria-pressed', 'false');
    splitsKnop.title = 'Open de volgende bestemming in een tweede paneel';
    glyfIn(splitsKnop, 'paneel');
    var sl = d.createElement('span'); sl.textContent = 'Naast'; splitsKnop.appendChild(sl);
    splitsKnop.addEventListener('click', function () {
      if (paneel) { sluitNaast(); return; }
      wapen(!naastAan);
    });
    voet.appendChild(splitsKnop);

    var handKnop = d.createElement('button');
    handKnop.type = 'button';
    handKnop.className = 'ws-hand' + (ds ? ' ds-knop ds-knop--klein' : '');
    handKnop.title = 'Zet de balk aan de andere kant';
    glyfIn(handKnop, 'navigatie');
    var hl = d.createElement('span'); hl.textContent = 'Kant'; handKnop.appendChild(hl);
    handKnop.addEventListener('click', function () {
      var nu = d.documentElement.getAttribute('data-hand');
      zetHand(nu === 'rechts' ? 'links' : 'rechts');
    });
    voet.appendChild(handKnop);

    balk.appendChild(voet);
    var plek = ds && d.querySelector('.ds-foundation-balk');
    (plek || d.body).appendChild(balk);
    d.body.setAttribute('data-ws', wereld.sleutel || '');
  }

  function wapen(aan) {
    naastAan = !!aan;
    if (splitsKnop) splitsKnop.setAttribute('aria-pressed', naastAan ? 'true' : 'false');
  }

  /* ------------------------------------------------------- tweede paneel -- */
  function openNaast(href, naam) {
    sluitNaast();
    paneel = d.createElement('aside');
    paneel.className = 'ws-paneel' + (ds ? ' ds-wereldnav-paneel' : '');
    paneel.setAttribute('aria-label', 'Tweede paneel: ' + naam);

    var kop = d.createElement('div');
    kop.className = 'ws-paneel-kop' + (ds ? ' ds-wereldnav-kop' : '');
    var t = d.createElement('b'); t.textContent = naam; kop.appendChild(t);
    var x = d.createElement('button');
    x.type = 'button'; x.className = 'ws-paneel-dicht' + (ds ? ' ds-knop ds-knop--klein' : '');
    x.setAttribute('aria-label', 'Sluit het tweede paneel');
    x.textContent = '×';
    x.addEventListener('click', sluitNaast);
    kop.appendChild(x);
    paneel.appendChild(kop);

    var f = document.createElement('iframe');
    f.src = href;
    if (window.RTGMedia && window.RTGMedia.kader) window.RTGMedia.kader(f);  // camera/microfoon doorgeven
    f.title = naam;
    paneel.appendChild(f);

    d.body.appendChild(paneel);
    d.body.setAttribute('data-ws-split', '');
    if (ds) d.body.classList.add('ds-wereldnav-split');
    if (splitsKnop) splitsKnop.setAttribute('aria-pressed', 'true');
    meetRuimte();
  }

  function sluitNaast() {
    if (paneel) { paneel.remove(); paneel = null; }
    d.body.removeAttribute('data-ws-split');
    if (ds) d.body.classList.remove('ds-wereldnav-split');
    wapen(false);
    meetRuimte();
  }

  /* ----------------------------------------------------------- de ruimte -- */
  /* De balk staat vast en neemt dus nergens ruimte in. Zonder deze meting ligt
     hij over de laatste regels van elke pagina -- dezelfde fout die de
     cookiemelding hier al eens maakte. Op een breed scherm staat hij naast de
     inhoud en is de hoogte nul. */
  function meetRuimte() {
    if (!balk) return;
    var breed = w.matchMedia && w.matchMedia('(min-width:900px)').matches;
    var h = breed ? 0 : Math.ceil(balk.getBoundingClientRect().height);
    d.documentElement.style.setProperty('--ws-ruimte', h + 'px');
  }

  /* ------------------------------------------------------------- opstarten */
  function start() {
    if (!d.body) return;
    zetHand(leesHand());
    bouw();
    meetRuimte();
    if (w.requestAnimationFrame) w.requestAnimationFrame(meetRuimte);
    w.addEventListener('resize', meetRuimte);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  w.RTGWereldSchil = {
    hand: leesHand,
    zetHand: zetHand,
    opendNaast: function () { return !!paneel; }
  };
})(window, document);
