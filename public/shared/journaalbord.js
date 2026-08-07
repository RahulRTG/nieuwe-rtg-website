/* HET DOORGEEFJOURNAAL OP HET SCHERM.

   De grafiek in het techniekscherm zegt HOEVEEL er langskwam; dit bord zegt WAT.
   Dat verschil kostte een nacht: een sms die stil op de grond viel is in een
   grafiek onzichtbaar, in een regel wel te zien.

   Een eigen bestand, om twee redenen. techniek-02.js ging er anders over de
   10 KB-lat, en dit is een op zichzelf staand bord: het heeft niets van de rest
   van dat scherm nodig behalve een manier om de server te vragen.

   Wat er te zien IS, bepaalt de server (kern/doorgeefjournaal.js): op codenaam
   en op domein, nooit een naam, adres of nummer. Dit bord toont wat het krijgt
   en verzint er niets bij.

   Gebruik:
     RTGJournaalbord.koppel($, opnieuw)   de knoppen aan een herlaadfunctie
     RTGJournaalbord.laad(api, $, toast)  ophalen en tekenen */
(function () {
  'use strict';
  if (window.RTGJournaalbord) return;

  var filter = 'alles';

  function regel(r) {
    var el = document.createElement('div');
    el.style.cssText = 'display:flex;gap:.5rem;padding:.25rem 0;border-bottom:1px solid var(--line);align-items:baseline;';
    var t = document.createElement('span');
    t.style.cssText = 'color:var(--soft);min-width:5.2rem;font-variant-numeric:tabular-nums;';
    t.textContent = String(r.t || '').slice(11, 19);
    var pijl = document.createElement('span');
    pijl.style.cssText = 'min-width:1.6rem;color:' + (r.richting === 'uit' ? 'var(--gold,#857007)' : 'var(--soft)') + ';';
    pijl.textContent = r.richting === 'uit' ? 'uit' : 'in';
    var wat = document.createElement('span');
    wat.style.cssText = 'flex:1;' + (r.mislukt ? 'color:var(--burgundy-on-dark,#C23A5E);' : '');
    wat.textContent = (r.methode ? r.methode + ' ' : '') + (r.wat || '') + (r.wie ? '  ' + r.wie : '');
    var st = document.createElement('span');
    st.style.cssText = 'color:var(--soft);min-width:4.5rem;text-align:right;font-variant-numeric:tabular-nums;';
    st.textContent = (r.status != null ? r.status : (r.mislukt ? 'fout' : '')) + (r.ms != null ? '  ' + r.ms + 'ms' : '');
    el.append(t, pijl, wat, st);
    return el;
  }

  function laad(api, $, toast) {
    var lijst = $('#journaalLijst');
    if (!lijst) return;
    var body = { max: 200 };
    if (filter === 'fouten') body.alleenMislukt = true;
    if (filter === 'uit') body.richting = 'uit';
    api('/api/office/journaal', { method: 'POST', body: body }).then(function (d) {
      lijst.textContent = '';
      var regels = (d && d.regels) || [];
      if (!regels.length) {
        var leeg = document.createElement('div');
        leeg.className = 'muted';
        leeg.style.padding = '.6rem 0';
        /* Een lege lijst betekent iets ANDERS per filter, en dat hoort er te
           staan. "Geen fouten" is nieuws; "nog niets langsgekomen" niet. */
        leeg.textContent = filter === 'fouten'
          ? 'Geen enkele mislukking in het venster. Dat is het bericht.'
          : 'Nog niets langsgekomen.';
        lijst.appendChild(leeg);
      } else {
        for (var i = 0; i < regels.length; i++) {
          lijst.appendChild(regel(regels[i]));
          if (regels[i].reden) {
            var rd = document.createElement('div');
            rd.style.cssText = 'color:var(--soft);padding:0 0 .3rem 6.8rem;';
            rd.textContent = regels[i].reden;
            lijst.appendChild(rd);
          }
        }
      }
      var tel = $('#journaalTel');
      if (tel) tel.textContent = regels.length + ' van ' + ((d && d.totaal) || 0);
    }).catch(function (e) { if (toast) toast(e.message); });
  }

  function koppel($, opnieuw) {
    var knoppen = [['#journaalAlles', 'alles'], ['#journaalFouten', 'fouten'], ['#journaalUit', 'uit']];
    knoppen.forEach(function (paar) {
      var b = $(paar[0]);
      if (!b) return;
      b.addEventListener('click', function () {
        filter = paar[1];
        knoppen.forEach(function (p2) { var k = $(p2[0]); if (k) k.setAttribute('aria-pressed', p2[1] === filter ? 'true' : 'false'); });
        opnieuw();
      });
    });
    var v = $('#journaalVernieuw');
    if (v) v.addEventListener('click', opnieuw);
  }

  window.RTGJournaalbord = { laad: laad, koppel: koppel };
})();
