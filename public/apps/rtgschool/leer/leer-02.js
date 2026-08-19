  /* ---- de leerlijn: vakken en doelen, met wat je al behaald hebt ---- */
  /* Het paspoort bewaart per behaald leerdoel alleen een id; de naam en het vak
     staan in de leerlijn. Wat de app opvraagt, onthoudt hij hier -- alleen dat,
     zodat de uitvoer leesbare namen kan geven zonder er iets bij te verzinnen. */
  var DOELINFO = {};
  async function toonVakken(vraag) {
    var el = document.getElementById('vakken');
    el.innerHTML = '<div class="leeg">De leerlijn wordt gehaald...</div>';
    try {
      var d = await api('/api/leerstof/vakken', vraag);
      (d.vakken || []).forEach(function (v) {
        (v.doelen || []).forEach(function (doel) { DOELINFO[doel.id] = { naam: doel.naam, vak: v.vak }; });
      });
      el.innerHTML = (d.vakken || []).map(function (v) {
        return '<div class="vakkop">' + esc(v.vak) + '</div>' + v.doelen.map(function (doel) {
          return '<div class="doel"><span>' + (doel.behaald ? '<span class="pil ok">behaald</span> ' : '') + esc(doel.naam) +
            (doel.ref ? ' <span style="color:var(--soft);font-size:.72rem;">(' + esc(doel.ref) + ')</span>' : '') + '</span>' +
            '<span class="rij"><button class="knop stil" data-les="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Les</button>' +
            '<button class="knop" data-oefen="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Oefenen</button></span></div>';
        }).join('');
      }).join('') || '<div class="leeg">Voor deze keuze staat er nog geen leerlijn klaar.</div>';
      el.querySelectorAll('[data-les]').forEach(function (b) { b.addEventListener('click', function () { toonLes(b.dataset.les); }); });
      el.querySelectorAll('[data-oefen]').forEach(function (b) { b.addEventListener('click', function () { oefenStart(b.dataset.oefen); }); });
    } catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  /* De les draagt sinds de Learning Fabric twee dingen meer: wat er ONDER dit
     leerdoel ligt (en wat daarvan nog open is), en dezelfde stof in andere
     vormen. Beide staan hier niet als extraatje maar als het antwoord op de
     twee vragen die een kind werkelijk stelt: "waarom lukt dit niet" en "kan
     het ook anders". Er wordt niets automatisch opengeklapt: de eerste uitleg
     blijft de eerste uitleg. */
  var UITLEGNAAM = { eenvoudig: 'Eenvoudiger', stap: 'Stap voor stap', visueel: 'Voor je zien',
    praktijk: 'Uit het echte leven', verhaal: 'Als verhaal', analogie: 'Vergelijking', hoger: 'Een stap verder' };

  async function toonLes(doelId) {
    try {
      var d = await api('/api/leerstof/les', { doel: doelId });
      var k = document.getElementById('lesKaart');
      k.hidden = false;
      var uitleg = (d.doel.uitleg || []).map(function (u, i) {
        return '<button class="knop stil" data-uitleg="' + i + '" type="button">' + esc(UITLEGNAAM[u.soort] || u.soort) + '</button>';
      }).join('');
      var onder = (d.voorkennis || []).map(function (v) {
        return '<div class="doel"><span>' + esc(v.naam) + '</span>' +
          (v.behaald ? '<span class="pil ok">behaald</span>'
            : '<button class="knop stil" data-naar="' + esc(v.id) + '" type="button">Open</button>') + '</div>';
      }).join('');
      document.getElementById('lesInhoud').innerHTML = '<b>' + esc(d.doel.naam) + '</b> (' + esc(d.doel.vak) + ')' +
        '<p id="lesTekst" style="margin-top:.4rem;line-height:1.7;">' + esc(d.doel.les) + '</p>' +
        (uitleg ? '<div class="rij" style="margin-top:.5rem;"><span class="sec" style="margin:0;">Leg anders uit</span>' + uitleg + '</div>' : '') +
        (onder ? '<div class="sec" style="margin-top:.8rem;">Wat hier onder ligt</div>' + onder +
          ((d.ontbreekt || []).length
            ? '<p class="leeg">Hiervan staat nog open: ' + esc(d.ontbreekt.map(function (x) { return x.naam; }).join(', ')) +
              '. Dat eerst doen scheelt hier veel gepuzzel.</p>'
            : '<p class="leeg">Alles wat hieronder ligt, heb je al behaald.</p>')
          : '');
      var kern = d.doel.les;
      Array.prototype.forEach.call(document.querySelectorAll('[data-uitleg]'), function (b) {
        b.addEventListener('click', function () {
          var ix = Number(b.dataset.uitleg);
          var vak = document.getElementById('lesTekst');
          /* Nog eens op dezelfde knop zet de oorspronkelijke les terug: het
             leerdoel verandert niet, alleen de weg ernaartoe. */
          var aan = b.dataset.aan === '1';
          Array.prototype.forEach.call(document.querySelectorAll('[data-uitleg]'), function (x) { x.dataset.aan = '0'; });
          if (aan) { vak.textContent = kern; return; }
          b.dataset.aan = '1';
          vak.textContent = d.doel.uitleg[ix].tekst;
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-naar]'), function (b) {
        b.addEventListener('click', function () { toonLes(b.dataset.naar); });
      });
      k.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { meld(e.message); }
  }

