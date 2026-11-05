  function vasteOnderbalk() {
    if (ds || !document.elementsFromPoint) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var stapel = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || [];
    for (var i = 0; i < stapel.length; i++) {
      for (var n = stapel[i]; n && n.nodeType === 1; n = n.parentElement) {
        if (n === el || el.contains(n)) continue;
        var b = n.getBoundingClientRect();
        if (getComputedStyle(n).position !== 'fixed') continue;
        if (b.bottom >= innerHeight - 2 && b.height > 24 && b.height < innerHeight / 2) {
          document.documentElement.style.setProperty(BODEM, Math.ceil(b.height) + 'px');
          return;
        }
      }
    }
    document.documentElement.style.removeProperty(BODEM);
  }

  function plaats() {
    if (ds) {
      /* Een DS-host reserveert ruimte in de documentstroom. */
      var vlak = document.querySelector('.ds-wereldwerkruimte .wd-page') || document.body;
      vlak.insertBefore(el, vlak.firstChild);
      return;
    }
    /* Oudere hosts behouden hun bestaande overlaypositie, maar de vormgeving
       en gereserveerde ruimte hebben nu een centrale DS-owner. */
    if (document.body.classList) document.body.classList.add('ds-cookie-host');
    document.body.appendChild(el);
    vasteOnderbalk();
    meetRuimte();
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () {
      vasteOnderbalk();
      meetRuimte();
    });
    window.addEventListener('resize', function () {
      vasteOnderbalk();
      meetRuimte();
    });
    if (window.ResizeObserver) {
      var maatkijker = new window.ResizeObserver(meetRuimte);
      maatkijker.observe(el);
    }
  }
  if (document.body) plaats(); else document.addEventListener('DOMContentLoaded', plaats);
})();
