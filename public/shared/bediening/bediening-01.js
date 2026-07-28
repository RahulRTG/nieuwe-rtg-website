/* HET BEDIENINGSPANEEL -- één plek voor de instellingen van dit scherm.

   Er dreven vier losse knopjes over elk scherm, alle vier linksonder en drie
   ervan boven op elkaar: de bewegingspil ("Rustig"), de themakiezer, de
   taalknop en het vraagteken van de app-gids. Ze horen bij elkaar, dus staan
   ze nu bij elkaar: in één paneel, achter één ingang. Het leden-OS had dit al
   -- daar zit alles in het bedieningspaneel -- en dit is datzelfde idee voor
   elk ander scherm.

   De ingang zoekt een plek die de pagina al heeft, in deze volgorde:
     1. het leden-OS (#osCcScrim)  -> niets bouwen, dat paneel bestaat al
     2. [data-bediening]           -> de pagina wijst zelf een plek aan
     3. .rtg-scherm                -> als derde ronde knop bij "beeld draaien"
                                      en "volledig scherm": dat is al de groep
                                      voor dingen die over dit scherm gaan
     4. .topbar / .osbar / header  -> een knop tussen de knoppen die er staan
     5. anders                     -> één knop linksonder, op de plek die de
                                      vier oude knopjes hebben vrijgemaakt

   Elke rij verschijnt alleen als de bijbehorende laag echt geladen is. */
(function (w, d) {
  'use strict';
  if (w.RTGBediening) return;

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };
  // drie schuifjes: leest meteen als "instellingen". Een cirkel met stralen zou
  // als zon/helderheid lezen, en dat is maar een van de rijen.
  var GLYF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h8M16 17h4"/>' +
    '<circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="17" r="2"/></svg>';

  function stijl() {
    if (d.getElementById('bdnCss')) return;
    var s = d.createElement('style'); s.id = 'bdnCss';
    s.textContent =
      '.bdn-knop{display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;cursor:pointer;' +
        'font-family:Inter,system-ui,sans-serif;font-size:.72rem;font-weight:600;letter-spacing:.02em;' +
        'padding:.42rem .8rem;color:var(--txt,#F4F1EC);' +
        'background:color-mix(in srgb, var(--card,#151312) 82%, transparent);' +
        'border:1px solid var(--line,rgba(255,255,255,.14));}' +
      '.bdn-knop:hover{border-color:var(--gold,#A98F1C);}' +
      '.bdn-knop:focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}' +
      '.bdn-knop svg{flex:0 0 auto;color:var(--gold,#A98F1C);}' +
      /* als buurman van de schermknoppen: dezelfde ronde vorm, geen label */
      '.bdn-rond{width:2.1rem;height:2.1rem;padding:0;border:none;background:none;' +
        'border-radius:50%;justify-content:center;}' +
      '.bdn-rond:hover{background:rgba(255,255,255,.1);}' +
      '.bdn-rond span{display:none;}' +
      '.bdn-rond svg{color:#F4F1EC;}' +
      /* de terugval: linksonder, waar nu niets meer staat */
      '.bdn-los{position:fixed;z-index:36;left:calc(env(safe-area-inset-left,0px) + .8rem);' +
        'bottom:calc(env(safe-area-inset-bottom,0px) + .8rem);backdrop-filter:blur(14px);' +
        '-webkit-backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,.35);}' +
      '.bdn-scrim{position:fixed;inset:0;z-index:9995;display:none;align-items:flex-end;justify-content:center;' +
        'background:rgba(6,5,5,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}' +
      '.bdn-scrim.open{display:flex;}' +
      '.bdn-blad{width:min(430px,100%);max-height:86vh;overflow-y:auto;' +
        'background:linear-gradient(180deg,#151312,#0C0C0B);color:#F4F1EC;' +
        'border:1px solid var(--line,rgba(255,255,255,.14));border-bottom:none;' +
        'border-radius:20px 20px 0 0;padding:1rem 1.1rem calc(env(safe-area-inset-bottom,0px) + 1.1rem);' +
        'font-family:Inter,system-ui,sans-serif;box-shadow:0 -18px 50px rgba(0,0,0,.5);}' +
      '@media (min-width:640px){.bdn-scrim{align-items:center;}' +
        '.bdn-blad{border-radius:20px;border-bottom:1px solid var(--line,rgba(255,255,255,.14));}}' +
      '.bdn-kop{display:flex;align-items:center;justify-content:space-between;margin-bottom:.2rem;}' +
      '.bdn-kop b{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.18rem;letter-spacing:-.01em;}' +
      '.bdn-x{background:none;border:none;color:#8A8680;font-size:1rem;cursor:pointer;padding:.3rem .1rem;}' +
      '.bdn-x:hover{color:#F4F1EC;}' +
      '.bdn-uit{color:#8A8680;font-size:.73rem;line-height:1.5;margin:0 0 .7rem;}' +
      '.bdn-rij{display:flex;align-items:center;justify-content:space-between;gap:.8rem;' +
        'padding:.72rem 0;border-top:1px solid var(--line,rgba(255,255,255,.1));}' +
      '.bdn-rij > span{font-size:.86rem;}' +
      '.bdn-rij small{display:block;color:#8A8680;font-size:.7rem;line-height:1.45;margin-top:.12rem;}' +
      '.bdn-do{flex:0 0 auto;display:flex;gap:.35rem;align-items:center;}' +
      '.bdn-do button{background:rgba(255,255,255,.05);border:1px solid var(--line,rgba(255,255,255,.14));' +
        'color:#F4F1EC;border-radius:999px;padding:.4rem .8rem;font:600 .74rem Inter,system-ui,sans-serif;cursor:pointer;}' +
      '.bdn-do button:hover,.bdn-do button.actief{border-color:var(--gold,#A98F1C);}' +
      '.bdn-do button.actief{color:var(--gold,#A98F1C);}' +
      '.bdn-stip{width:22px;height:22px;border-radius:999px;padding:0;border:2px solid transparent;}' +
      '@media print{.bdn-knop,.bdn-scrim{display:none !important;}}';
    (d.head || d.documentElement).appendChild(s);
  }

  // deel 2 zet de rijen, het paneel en de ingang; zie bediening-02.js
