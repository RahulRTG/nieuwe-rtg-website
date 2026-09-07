/* De inhoud en sluitbeslissing blijven van de route. Deze controller bewaakt
   de toetsenbordgrens en brengt focus terug naar de oorspronkelijke ingang. */
(function (w) {
  'use strict';
  var SELECT = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function attach(element, close) {
    if (!element || element.dataset.rtgSheetBound) return;
    element.dataset.rtgSheetBound = 'true';
    var previous = null, wasOpen = false;
    function visible(el) { return el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'; }
    function sync() {
      var open = visible(element);
      element.setAttribute('aria-modal', open ? 'true' : 'false');
      if (open && !wasOpen) {
        previous = w.RTGSideSheet.lastTrigger;
        if (!element.contains(document.activeElement)) {
          var first = Array.from(element.querySelectorAll(SELECT)).find(visible);
          if (first) first.focus({ preventScroll: true });
        }
      }
      if (!open && wasOpen && previous && previous.isConnected) {
        requestAnimationFrame(function () { if (!visible(element) && !previous.inert) previous.focus({ preventScroll: true }); });
      }
      wasOpen = open;
    }
    element.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && visible(element)) { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var items = Array.from(element.querySelectorAll(SELECT)).filter(visible);
      if (!items.length) { e.preventDefault(); element.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    new MutationObserver(sync).observe(element, { attributes: true, attributeFilter: ['class', 'hidden', 'open', 'style'] });
    sync();
  }
  w.RTGSideSheet = { attach: attach, lastTrigger: null };
  document.addEventListener('focusin', function (e) {
    if (!e.target.closest('[data-rtg-sheet-bound],[aria-modal="true"]')) w.RTGSideSheet.lastTrigger = e.target;
  }, true);
}(window));
