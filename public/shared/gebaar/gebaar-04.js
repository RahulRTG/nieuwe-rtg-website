/* Slot van de gebarenlaag: DE ACTIELADE en de deur naar buiten.

   De actielade is het oppervlak waar de acties gewoon als LIJST staan: met
   echte knoppen, echte namen en echte focus. Hij gaat open bij vasthouden, bij
   een rechtermuisklik, met de menutoets, met de pijltjes en via de greep -- vijf
   wegen naar hetzelfde. Dat is geen stapeling: het is dezelfde deur, die op elk
   toestel anders heet.

   EEN <dialog> MET showModal() EN GEEN ZWEVEND PANEELTJE. De bovenlaag van de
   browser staat buiten elke stackingcontext, dus hij werkt ook binnen een
   voorouder met een transform -- en dat is op deze schermen geen zeldzaamheid.
   Escape, de achtergrond en het opsluiten van de focus zijn er gratis bij. */

  var blad = null, vanRij = null;

  function knopVoor(a, rij) {
    var b = d.createElement('button');
    b.type = 'button';
    if (a.sig) b.setAttribute('data-sig', a.sig);
    b.innerHTML = svg(a.teken);
    var s = d.createElement('span');
    s.textContent = a.borg
      ? a.naam + ' · ' + T('gebaar.houd', 'houd vast', 'hold')
      : a.naam;
    b.appendChild(s);
    if (a.borg) houdVast(b, function () { sluitBlad(); voerUit(a, rij); });
    else b.addEventListener('click', function () { sluitBlad(); voerUit(a, rij); });
    return b;
  }

  function groep(titel, lijst, rij) {
    if (!lijst.length) return null;
    var wrap = d.createDocumentFragment();
    var k = d.createElement('div'); k.className = 'gb-kant'; k.textContent = titel;
    wrap.appendChild(k);
    var m = d.createElement('menu');
    lijst.forEach(function (a) {
      var li = d.createElement('li');
      li.appendChild(knopVoor(a, rij));
      m.appendChild(li);
    });
    wrap.appendChild(m);
    return wrap;
  }

  function opendActielade(rij, kant, alleen) {
    var acties = actiesVan(rij);
    if (!acties) return;
    sluitAlles(true);
    sluitBlad();
    vanRij = rij;
    blad = d.createElement('dialog');
    blad.className = 'gb-blad';
    var h = d.createElement('h2');
    h.textContent = alleen
      ? T('gebaar.bevestig', 'Bevestigen', 'Confirm')
      : T('gebaar.acties2', 'Acties', 'Actions');
    blad.appendChild(h);
    var titel = acties.titel || (rij.textContent || '').trim().split('\n')[0].slice(0, 90);
    if (titel) {
      var t = d.createElement('span'); t.className = 'gb-titel'; t.textContent = titel;
      blad.appendChild(t);
    }
    if (alleen) {
      var g1 = groep(T('gebaar.nietterug', 'Dit is niet terug te draaien', 'This cannot be undone'), [alleen], rij);
      if (g1) blad.appendChild(g1);
    } else {
      /* De kant heet naar het GEBAAR en niet naar de lade: "veeg naar links" is
         wat een hand doet, "de rechterlade" is hoe de code het noemt. */
      if (kant !== 'links') {
        var g2 = groep(T('gebaar.naarlinks', 'Veeg naar links', 'Swipe left'), acties.rechts, rij);
        if (g2) blad.appendChild(g2);
      }
      if (kant !== 'rechts') {
        var g3 = groep(T('gebaar.naarrechts', 'Veeg naar rechts', 'Swipe right'), acties.links, rij);
        if (g3) blad.appendChild(g3);
      }
    }
    blad.addEventListener('close', function () {
      if (blad) blad.remove();
      blad = null;
      /* De focus terug naar de regel waar hij vandaan kwam. Zonder deze regel
         valt een toetsenbordgebruiker terug naar het begin van het document --
         het klassieke gat na een dialoog. */
      try { if (vanRij && vanRij.isConnected) vanRij.focus({ preventScroll: true }); } catch (e) {}
      vanRij = null;
    });
    d.body.appendChild(blad);
    if (blad.showModal) blad.showModal(); else blad.setAttribute('open', '');
    var eerste = blad.querySelector('button');
    if (eerste) try { eerste.focus(); } catch (e) {}
  }
  function sluitBlad() { if (blad) { try { blad.close(); } catch (e) { blad.remove(); blad = null; } } }

