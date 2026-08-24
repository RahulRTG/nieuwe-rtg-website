/* TeamCall, deel 1b: DE VORMGEVING van de gespreksoverlay.

   Stond in deel 1, en is er afgeknipt toen dat deel met de tekstbaan erbij over
   de tienkilobytelat ging. De naad is een echte: dit deel bepaalt hoe het
   gesprek ERUITZIET, deel 1 hoe het WERKT. De delen worden op naam gesorteerd
   aan elkaar geplakt binnen dezelfde omhulsel-functie, dus `stijl()` blijft
   gewoon zichtbaar voor `overlay()` in deel 1. */
  /* ---------- de gespreks-UI: een raster van tegels ---------- */
  function stijl(){
    if (document.getElementById('tcStijl')) return;
    const s = document.createElement('style');
    s.id = 'tcStijl';
    s.textContent = '#tcOverlay{position:fixed;inset:0;z-index:300;background:#0A0A09;display:flex;flex-direction:column;}' +
      '#tcGrid{flex:1;display:grid;gap:6px;padding:6px;overflow:hidden;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));align-content:center;}' +
      '.tc-tegel{position:relative;background:#151312;border-radius:14px;overflow:hidden;min-height:120px;}' +
      '.tc-tegel video{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.tc-tegel .nm{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,0.55);color:#fff;font:600 0.7rem Inter,sans-serif;padding:0.2rem 0.55rem;border-radius:999px;}' +
      '#tcBalk{display:flex;align-items:center;justify-content:center;gap:0.8rem;padding:0.8rem calc(env(safe-area-inset-bottom,0px) + 0.4rem);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 0.8rem);}' +
      '#tcBalk button{width:3.2rem;height:3.2rem;border-radius:50%;border:1px solid rgba(255,255,255,0.18);background:#1B1817;color:#fff;font-size:1.15rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}' +
      '#tcBalk button svg{width:1.4rem;height:1.4rem;}' +
      '#tcBalk button.uit{background:#7F1634;}#tcBalk #tcWeg{background:#C23A5E;border:none;}' +
      '#tcKop{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:0;right:0;text-align:center;color:#F4F1EC;font:500 0.85rem Inter,sans-serif;z-index:2;text-shadow:0 1px 6px rgba(0,0,0,0.6);}' +
      '#tcRing{position:fixed;inset:0;z-index:310;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;padding:2rem;}' +
      '#tcRing .kaart{background:#151312;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:1.6rem;max-width:320px;width:100%;text-align:center;color:#F4F1EC;font-family:Inter,sans-serif;}' +
      '#tcRing .knoppen{display:flex;gap:0.6rem;margin-top:1.1rem;}' +
      '#tcRing .knoppen button{flex:1;border:none;border-radius:999px;padding:0.7rem;font:600 0.85rem Inter,sans-serif;cursor:pointer;}' +
      '#tcRing .ja{background:#2E7D5B;color:#fff;}#tcRing .nee{background:#C23A5E;color:#fff;}';
    document.head.appendChild(s);
  }
