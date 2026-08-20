/* DE REGIE VAN DE ZAAK -- één weergave, twee huizen.

   Dit scherm hangt in de zaak-app (leverancier.html) én in de personeels-app
   (personeel.html, de PDA). Dat is met opzet één module en geen twee: de
   uitzonderingenrij die een medewerker op de vloer ziet, MOET dezelfde lijst
   zijn die de manager op kantoor ziet. Twee implementaties van hetzelfde
   scherm lopen uiteen -- niet misschien, maar zeker, en dan wijst de een naar
   de ander.

   WAT WEL VERSCHILT IS DE WEERGAVE, niet de inhoud. Met `compact: true` wordt
   het een telefoonscherm: één kolom, grote raakvlakken, en alleen de drie
   dingen die je met een duim doet -- kijken wat er speelt, iets op de lijst
   zetten, en een uitzondering oppakken. Instellingen en het spoor staan daar
   niet; die horen op een scherm waar je bij zit.

   EN HET SCHERM VERZINT NIETS OVER RECHTEN. Wat een medewerker mag, bepaalt de
   server (managerOnly). Dit scherm vraagt het één keer op en verbergt wat niet
   mag -- maar als het zich zou vergissen, weigert de server alsnog. Een knop
   verbergen is netheid; de grendel zit aan de andere kant. */
(function (w, d) {
  'use strict';
  if (w.RTGZaakCommand) return;

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tijd(s) {
    if (!s) return '';
    var x = new Date(s);
    if (isNaN(x)) return String(s).slice(0, 16);
    return x.getDate() + ' ' + MND[x.getMonth() + 1] + ' ' + x.getHours() + ':' + String(x.getMinutes()).padStart(2, '0');
  }
  var NIVEAU = { auto: 'vanzelf', assist: 'met hulp', hand: 'zelf doen' };
  function nv(n) { return '<span class="zc-nv zc-' + esc(n) + '">' + esc(NIVEAU[n] || n) + '</span>'; }

  var CSS =
    '.zc{font-family:Inter,system-ui,sans-serif;color:var(--txt,#F4F1EC);}' +
    '.zc h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.05rem;margin:0 0 .3rem;}' +
    '.zc .zc-rail{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem;}' +
    '.zc .zc-rail button{background:transparent;border:1px solid var(--line,rgba(255,255,255,.16));border-radius:0;' +
      'color:inherit;font:inherit;font-size:.8rem;padding:.4rem .9rem;cursor:pointer;}' +
    '.zc .zc-rail button[aria-current]{background:var(--card2,rgba(255,255,255,.06));border-color:var(--gold,#A98F1C);}' +
    '.zc .zc-kaart{background:var(--card,rgba(255,255,255,.04));border:1px solid var(--line,rgba(255,255,255,.16));' +
      'border-radius:0;padding:.9rem 1rem;margin-bottom:.7rem;}' +
    '.zc .zc-meta{font-size:.76rem;color:var(--soft,rgba(244,241,236,.55));line-height:1.5;}' +
    '.zc .zc-rij{display:flex;gap:.45rem;flex-wrap:wrap;align-items:center;margin-top:.6rem;}' +
    '.zc .zc-knop{background:transparent;border:1px solid var(--line,rgba(255,255,255,.16));border-radius:0;' +
      'color:inherit;font:inherit;font-size:.8rem;padding:.4rem .85rem;cursor:pointer;}' +
    '.zc .zc-knop.vol{background:var(--gold,#A98F1C);border-color:var(--gold,#A98F1C);color:#1C1608;font-weight:600;}' +
    '.zc .zc-knop:disabled{opacity:.45;cursor:default;}' +
    '.zc .zc-veld{background:var(--card2,rgba(255,255,255,.06));border:1px solid var(--line,rgba(255,255,255,.16));' +
      'border-radius:0;color:inherit;font:inherit;font-size:.85rem;padding:.45rem .7rem;}' +
    '.zc .zc-tegels{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.6rem;margin-bottom:.9rem;}' +
    '.zc .zc-tegel{background:var(--card,rgba(255,255,255,.04));border:1px solid var(--line,rgba(255,255,255,.16));' +
      'border-radius:0;padding:.7rem .8rem;}' +
    '.zc .zc-tegel b{display:block;font-family:"Bodoni Moda",Georgia,serif;font-size:1.5rem;font-variant-numeric:tabular-nums;}' +
    '.zc .zc-tegel span{display:block;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;' +
      'color:var(--soft,rgba(244,241,236,.55));}' +
    '.zc .zc-sig{border-left:3px solid var(--line,rgba(255,255,255,.16));padding-left:.7rem;margin:.55rem 0;}' +
    '.zc .zc-sig.rood{border-left-color:#C23A5E;} .zc .zc-sig.amber{border-left-color:#C99A2E;}' +
    '.zc .zc-nv{display:inline-block;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;' +
      'border:1px solid var(--line,rgba(255,255,255,.16));border-radius:0;padding:.05rem .45rem;}' +
    '.zc .zc-auto{border-color:#4C9A75;color:#4C9A75;} .zc .zc-assist{border-color:#C99A2E;color:#C99A2E;}' +
    '.zc .zc-hand{border-color:#C23A5E;color:#C23A5E;}' +
    '.zc .zc-leeg{color:var(--soft,rgba(244,241,236,.55));padding:1.6rem 0;font-size:.88rem;}' +
    /* de duimstand: één kolom, grotere raakvlakken, geen tabelwerk */
    '.zc.zc-klein .zc-tegels{grid-template-columns:1fr 1fr;}' +
    '.zc.zc-klein .zc-knop{padding:.6rem 1rem;font-size:.85rem;}' +
    '.zc.zc-klein .zc-rail button{padding:.55rem 1rem;font-size:.85rem;}';

  var stijlGezet = false;
  function stijl() {
    if (stijlGezet) return;
    stijlGezet = true;
    var s = d.createElement('style'); s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  w.RTGZaakCommand = { esc: esc, tijd: tijd, nv: nv, stijl: stijl, delen: {} };
})(window, document);
