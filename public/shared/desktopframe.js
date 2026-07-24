/* Desktop-vensterlaag.

   Op een breed scherm wordt de kaart (de <main>) een echt venster:
   - VERGROTEN/VERKLEINEN: sleep de rechteronderhoek (dat regelt de CSS met
     resize:both -- werkt ook zonder deze JS).
   - VERPLAATSEN: sleep de rustige greep-balk bovenaan het venster.
   De stand (plek + grootte) wordt onthouden per pagina; de herstelknop zet het
   venster terug in het midden. Onder de 1000px doet dit niets -- de telefoon-
   beleving blijft ongemoeid. Zuivere progressive enhancement: gaat er iets mis,
   dan blijft de kaart gewoon een nette, herschaalbare omkadering. */
(function () {
  var main = document.querySelector('main');
  if (!main) return;
  var mq = window.matchMedia('(min-width: 1000px)');
  var KEY = 'rtg_venster_' + location.pathname.replace(/[^a-z0-9]/gi, '_');
  var st = null; try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  var greep = null, actief = false, ro = null, zetten = false, drag = null;

  function bewaar() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function standaard() {
    var w = Math.min(1080, window.innerWidth - 80);
    return { x: Math.round((window.innerWidth - w) / 2), y: 84, w: w, h: Math.min(main.scrollHeight + 80, window.innerHeight - 140) };
  }
  function klem() {
    st.w = Math.max(340, Math.min(st.w, window.innerWidth - 16));
    st.h = Math.max(260, Math.min(st.h, window.innerHeight - 16));
    st.x = Math.max(8, Math.min(st.x, window.innerWidth - Math.min(st.w, 200) - 8));
    st.y = Math.max(8, Math.min(st.y, window.innerHeight - 56));
  }
  function pas() {
    klem();
    zetten = true;
    main.style.position = 'fixed';
    main.style.left = st.x + 'px'; main.style.top = st.y + 'px';
    main.style.width = st.w + 'px'; main.style.height = st.h + 'px';
    // ontkoppel na de huidige frame, zodat de ResizeObserver onze eigen zet negeert
    requestAnimationFrame(function () { zetten = false; });
  }
  function bouwGreep() {
    greep = document.createElement('div');
    greep.className = 'rtg-greep';
    greep.innerHTML = '<span class="streep"></span><button type="button" class="herstel" aria-label="Venster terug naar het midden">Herstel</button>';
    main.appendChild(greep);
    greep.querySelector('.herstel').addEventListener('click', function (e) { e.stopPropagation(); st = standaard(); pas(); bewaar(); });
    greep.addEventListener('pointerdown', sleepStart);
  }
  function sleepStart(e) {
    if (e.target.closest('.herstel')) return;
    drag = { px: e.clientX, py: e.clientY, x: st.x, y: st.y };
    try { greep.setPointerCapture(e.pointerId); } catch (ee) {}
    document.addEventListener('pointermove', sleepMove);
    document.addEventListener('pointerup', sleepEnd);
  }
  function sleepMove(e) {
    if (!drag) return;
    st.x = drag.x + (e.clientX - drag.px);
    st.y = drag.y + (e.clientY - drag.py);
    pas();
  }
  function sleepEnd() {
    drag = null;
    document.removeEventListener('pointermove', sleepMove);
    document.removeEventListener('pointerup', sleepEnd);
    bewaar();
  }
  function aan() {
    if (actief) return; actief = true;
    if (!st) st = standaard();
    main.classList.add('rtg-venster');
    if (!greep) bouwGreep(); else greep.style.display = '';
    pas();
    if (window.ResizeObserver && !ro) {
      ro = new ResizeObserver(function () {
        if (!actief || drag || zetten) return;
        st.w = main.offsetWidth; st.h = main.offsetHeight; bewaar();
      });
      ro.observe(main);
    }
  }
  function uit() {
    if (!actief) return; actief = false;
    main.classList.remove('rtg-venster');
    ['position', 'left', 'top', 'width', 'height'].forEach(function (p) { main.style.removeProperty(p); });
    if (greep) greep.style.display = 'none';
  }
  function sync() { (mq.matches ? aan : uit)(); }
  sync();
  if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
  window.addEventListener('resize', function () { if (actief && !drag) pas(); });
})();
