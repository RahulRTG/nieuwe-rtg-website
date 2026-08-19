/* RTG School (leden), deel 1: het leerpaspoort op de officiële ladder, de
   leerlijn per groep of fase, de les in gewone taal en de oefensessie van
   vijf opgaven. Antwoorden blijven op de server; hier staat alleen de stroom.
   Bewust geen scores buiten de sessie, geen reeksen, geen ranglijsten. */
(function () {
  'use strict';
  var LADDER = null, MIJN = null;

  function kpi() {
    var el = document.getElementById('schoolKpi');
    if (!el || !MIJN) return;
    var doelen = Object.keys(MIJN.doelen || {}).length;
    el.innerHTML =
      '<div class="kpi"><b>' + (MIJN.fase ? esc(MIJN.fase.naam) : 'nog geen') + '</b><span>Mijn fase</span></div>' +
      '<div class="kpi"><b>' + (MIJN.fase ? 'jaar ' + MIJN.jaar : '-') + '</b><span>Leerjaar</span></div>' +
      '<div class="kpi"><b>' + doelen + '</b><span>Leerdoelen behaald</span></div>' +
      '<div class="kpi"><b>' + (MIJN.historie || []).length + '</b><span>Stappen op de ladder</span></div>';
  }

  /* De namen horen bij de ladder, niet bij de schermen: een fase-id is een
     verwijzing voor machines, geen tekst voor mensen. */
  function faseNaam(id) {
    var f = (LADDER.fasen || []).find(function (x) { return x.id === id; });
    return f ? f.naam : id;
  }
  function trapNaam(t) { return (LADDER.trappen && LADDER.trappen[t] && LADDER.trappen[t].naam) || t; }

  function toonPaspoort() {
    var el = document.getElementById('paspoort');
    if (!MIJN.fase) {
      el.innerHTML = 'Je staat nog niet op de ladder. Kies hieronder je fase; elke fase mag het begin zijn, en een stap terug is soms de beste stap.';
    } else {
      var verder = MIJN.verder || {};
      el.innerHTML = 'Je bent ingeschreven op <b>' + esc(MIJN.fase.naam) + '</b> (' + esc(trapNaam(MIJN.fase.trap)) + '), leerjaar ' + MIJN.jaar +
        (verder.volgende ? '. De normale trede hierna: ' + esc(faseNaam(verder.volgende)) + '.' : '.') +
        ((verder.doorstroom || []).length ? ' Vanuit hier kun je door naar: ' + verder.doorstroom.map(function (id) { return esc(faseNaam(id)); }).join(', ') + '.' : '');
    }
    document.getElementById('jaarKnop').hidden = !(MIJN.fase && MIJN.fase.jaren > MIJN.jaar);
    document.getElementById('eerlijk').textContent = MIJN.eerlijk || '';
    kpi();
  }

  /* Een fasekiezer is altijd per trap geordend: eerst de schoolsoort
     (Basisschool, Voortgezet onderwijs, Mbo, ...), daarbinnen de fasen.
     Hier stond een platte lijst van alle zesentwintig fasen -- Groep 1 naast
     Vwo naast Promotie -- en dat leest als een hoop, niet als een ladder.
     De trap-indeling bestond al in de data (fase.trap + LADDER.trappen);
     alleen het scherm gooide hem weg. */
  function faseOpties(eersteRegel, filter) {
    var perTrap = {};
    (LADDER.fasen || []).filter(filter || function () { return true; }).forEach(function (f) {
      (perTrap[f.trap] = perTrap[f.trap] || []).push(f);
    });
    return '<option value="">' + esc(eersteRegel) + '</option>' + Object.keys(perTrap)
      .sort(function (a, b) {
        return ((LADDER.trappen[a] || {}).volgorde || 99) - ((LADDER.trappen[b] || {}).volgorde || 99);
      })
      .map(function (t) {
        return '<optgroup label="' + esc(trapNaam(t)) + '">' +
          perTrap[t].map(function (f) {
            return '<option value="' + esc(f.id) + '">' + esc(f.naam) +
              (f.leeftijd ? ' · ' + esc(f.leeftijd) + ' jaar' : (f.jaren ? ' · ' + f.jaren + ' jaar' : '')) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
  }

  function vulKiezers() {
    document.getElementById('ladderKies').innerHTML = faseOpties('Kies je fase...');
    // een kiezer voor de leerlijn: de basisschoolfasen sturen de groep-leerlijn
    // aan, de rest de fase-leerlijn -- dat onderscheid is techniek en hoort
    // niet als twee losse lijsten op het scherm
    document.getElementById('leerKies').innerHTML = faseOpties('Kies je fase...');
    document.getElementById('examenKies').innerHTML =
      faseOpties('Kies je fase...', function (f) { return f.trap !== 'po' && f.trap !== 'leven'; });
  }

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
            '<span class="rij">' +
            (doel.behaald ? '<button class="knop stil" data-waarom="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Waarom?</button>' : '') +
            '<button class="knop stil" data-les="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Les</button>' +
            '<button class="knop" data-oefen="' + esc(doel.id) + '" style="padding:.3rem .6rem;font-size:.76rem;">Oefenen</button></span></div>' +
            '<div class="leeg" id="waarom-' + esc(doel.id).replace(/[^A-Za-z0-9-]/g, '_') + '" hidden></div>';
        }).join('');
      }).join('') || '<div class="leeg">Voor deze keuze staat er nog geen leerlijn klaar.</div>';
      el.querySelectorAll('[data-les]').forEach(function (b) { b.addEventListener('click', function () { toonLes(b.dataset.les); }); });
      el.querySelectorAll('[data-oefen]').forEach(function (b) { b.addEventListener('click', function () { oefenStart(b.dataset.oefen); }); });
      el.querySelectorAll('[data-waarom]').forEach(function (b) { b.addEventListener('click', function () { toonBewijs(b.dataset.waarom); }); });
    } catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  /* PROOF OF LEARNING: "waarom denkt RTG dat ik dit kan?"

     Een leerdoel stond hier als "behaald" -- een bewering zonder onderbouwing,
     en precies de zwarte doos die een leerling niet kan navragen. Deze knop
     geeft het antwoord: het bewijs zelf, op volgorde, met wie het zag. Er komt
     geen cijfer uit en er wordt niets vergeleken met een ander. */
  var BEWIJSNAAM = { oefening: 'Zelf geoefend', huiswerk: 'Oefen-huiswerk', praktijk: 'Praktijkopdracht',
    toets: 'Toets op school', observatie: 'Gezien door een leraar' };

  async function toonBewijs(doelId) {
    var vak = document.getElementById('waarom-' + doelId.replace(/[^A-Za-z0-9-]/g, '_'));
    if (!vak) return;
    if (!vak.hidden) { vak.hidden = true; return; }
    vak.hidden = false;
    vak.innerHTML = 'Bewijs wordt opgehaald...';
    try {
      var d = await api('/api/onderwijs/bewijs', { doel: doelId });
      vak.innerHTML = '<b>Beheersing: ' + esc(d.beheersing.woord) + '</b> &mdash; ' + esc(d.beheersing.uitleg) +
        '<div style="margin-top:.35rem;">' + (d.bewijs || []).map(function (b) {
          return '&bull; ' + esc(BEWIJSNAAM[b.soort] || b.soort) +
            (b.detail ? ': ' + esc(b.detail) : '') +
            (b.door ? ' <span style="opacity:.8;">(' + esc(b.door) + ')</span>' : '') +
            ' <span style="opacity:.7;">' + esc(String(b.at).slice(0, 10)) + '</span>';
        }).join('<br>') + '</div>' +
        '<div style="margin-top:.35rem;opacity:.85;">' + esc(d.uitleg) + '</div>';
    } catch (e) { vak.textContent = e.message; }
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

  /* ---- oefenen: vijf opgaven, een tegelijk ---- */
  function vraagToon(kaartId, vraag, opties, standId, stand) {
    document.getElementById(standId).textContent = stand;
    document.getElementById(kaartId === 'oefenKaart' ? 'oefenVraag' : 'examenVraag').textContent = vraag;
    var oEl = document.getElementById(kaartId === 'oefenKaart' ? 'oefenOpties' : 'examenOpties');
    var inEl = document.getElementById(kaartId === 'oefenKaart' ? 'oefenIn' : 'examenIn');
    oEl.innerHTML = '';
    inEl.value = '';
    if (opties && opties.length) {
      inEl.parentElement.hidden = true;
      oEl.innerHTML = opties.map(function (o) { return '<button class="knop stil" data-antw="' + esc(o) + '" type="button">' + esc(o) + '</button>'; }).join('');
    } else {
      inEl.parentElement.hidden = false;
      inEl.focus();
    }
  }

  /* ---- de Memory Engine: wat komt er terug ----

     Drie dingen die dit scherm met opzet NIET doet. Er staat niet bij hoe lang
     iets geleden is (de server stuurt dat niet eens mee bij wat openstaat), er
     komt geen merkteken bij dat zegt "dit had je moeten weten", en de vragen
     zelf lopen door precies dezelfde kaart en dezelfde functies als een gewone
     oefensessie -- een herhaalvraag hoort er hetzelfde uit te zien als een
     nieuwe vraag. */
  async function toonHerhalingen() {
    var el = document.getElementById('herhaalLijst');
    if (!el) return;
    try {
      var d = await api('/api/leerstof/herhalen');
      el.innerHTML = d.open.length
        ? d.open.slice(0, 12).map(function (o) {
            return '<div class="doel"><span>' + esc(o.naam) + ' <span style="color:var(--soft);font-size:.72rem;">(' + esc(o.vak) + ')</span></span>' +
              '<span class="rij"><button class="knop" data-herhaal="' + esc(o.doel) + '" style="padding:.3rem .6rem;font-size:.76rem;">' + d.vragen + ' vragen</button></span></div>';
          }).join('')
        : '<div class="leeg">Er staat vandaag niets klaar om terug te halen.' +
          (d.later.length ? ' Het eerstvolgende komt op ' + esc(String(d.later[0].volgende).slice(0, 10)) + '.' : '') + '</div>';
      el.querySelectorAll('[data-herhaal]').forEach(function (b) {
        b.addEventListener('click', function () { herhaalStart(b.dataset.herhaal); });
      });
    } catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  /* Zelfde kaart, zelfde vraagweergave, zelfde antwoordknop als hierboven:
     alleen het STARTEN gaat langs een andere route, en het aantal vragen is
     kleiner. Vanaf de eerste vraag is er geen verschil meer. */
  async function herhaalStart(doelId) {
    try {
      var d = await api('/api/leerstof/herhaal', { doel: doelId });
      var k = document.getElementById('oefenKaart');
      k.hidden = false;
      document.getElementById('oefenUit').textContent = '';
      vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + '/' + d.totaal + ' \u00b7 ' + d.naam);
      k.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { meld(e.message); }
  }

  async function oefenStart(doelId) {
    try {
      var d = await api('/api/leerstof/oefen', { doel: doelId });
      var k = document.getElementById('oefenKaart');
      k.hidden = false;
      document.getElementById('oefenUit').textContent = '';
      vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + '/' + d.totaal + ' · ' + d.naam);
      k.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { meld(e.message); }
  }

  async function oefenAntwoord(antw) {
    try {
      var d = await api('/api/leerstof/antwoord', { antwoord: antw });
      var uit = document.getElementById('oefenUit');
      var regel = d.goed ? 'Goed zo.' : 'Bijna: het juiste antwoord was "' + esc(d.juisteAntwoord) + '". Een fout is gewoon de volgende stap in de les.';
      if (d.klaar) {
        document.getElementById('oefenOpties').innerHTML = '';
        document.getElementById('oefenIn').parentElement.hidden = true;
        /* Een herhaling eindigt anders dan een oefensessie: er valt niets bij
           te schrijven, want het doel stond er al. Het slotwoord komt van de
           server, zodat er hier geen tweede versie van diezelfde toon ontstaat. */
        uit.innerHTML = regel + '<br><b>' + d.aantalGoed + ' van de ' + d.totaal + ' goed.</b> ' +
          (d.slot ? esc(d.slot) : (d.behaald ? 'Dit leerdoel staat nu in je leerpaspoort.' : esc(d.advies || '')));
        laadPaspoort();
        toonHerhalingen();
      } else {
        uit.innerHTML = regel;
        vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + 1 + '/' + d.totaal);
      }
    } catch (e) { meld(e.message); }
  }


  async function laadPaspoort() {
    MIJN = await api('/api/onderwijs/mijn');
    toonPaspoort();
  }

  /* Meenemen: het leerpaspoort is van de leerling en gaat een leven lang mee,
     dus hoort het ook het huis uit te kunnen. De app kent zijn eigen model, dus
     geeft hij dat door in plaats van de gedeelde laag het scherm te laten
     raden: per behaald leerdoel de naam, het vak, de fase en de dag. Geen
     scores en geen rangorde -- die houdt deze app bewust ook niet bij. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    var ids = MIJN && MIJN.doelen ? Object.keys(MIJN.doelen) : [];
    if (!ids.length) return null;
    return {
      naam: 'leerpaspoort',
      kolommen: ['leerdoel', 'vak', 'fase', 'datum'],
      rijen: ids.map(function (id) {
        var w = MIJN.doelen[id] || {}, i = DOELINFO[id] || {};
        return [i.naam || id, i.vak || '',
          w.fase ? (LADDER ? faseNaam(w.fase) : w.fase) : '', String(w.op || '').slice(0, 10)];
      })
    };
  });

  async function start() {
    try {
      LADDER = await api('/api/onderwijs/ladder');
      vulKiezers();
      await laadPaspoort();
    } catch (e) { meld(e.message); }
    /* De opties worden per vraag opnieuw getekend; een luisteraar op de
       container vangt ze allemaal, zonder per knop opnieuw te binden.

       Hij stond hierboven, BUITEN start(), en dat was de fout waar de
       paginascan al een ronde over klaagde. Uitgelogd vervangt het scherm
       zijn hele #main door de inlogkaart -- #oefenOpties bestaat dan niet
       meer, en een getElementById op niets kreeg alsnog een addEventListener.
       Dat is geen fout van start(): die draaide helemaal niet. Alles wat aan
       de DOM hangt hoort binnen start(), zoals in examen.js en bijles.js. */
    document.getElementById('oefenOpties').addEventListener('click', function (e) {
      var b = e.target.closest('[data-antw]');
      if (b) oefenAntwoord(b.dataset.antw);
    });
    document.getElementById('inschrijfKnop').addEventListener('click', async function () {
      var f = document.getElementById('ladderKies').value;
      if (!f) { meld('Kies eerst een fase op de ladder.'); return; }
      try { await api('/api/onderwijs/inschrijf', { fase: f }); meld('Ingeschreven; je paspoort loopt vanaf hier mee.'); laadPaspoort(); }
      catch (e) { meld(e.message); }
    });
    document.getElementById('jaarKnop').addEventListener('click', async function () {
      try { await api('/api/onderwijs/jaar-over', {}); meld('Een leerjaar erbij.'); laadPaspoort(); }
      catch (e) { meld(e.message); }
    });
    document.getElementById('leerKies').addEventListener('change', function () {
      if (!this.value) return;
      // de basisschool-leerlijn hangt aan de groep (po-g3 -> groep 3), de
      // rest aan de fase; de server kent beide vormen met hetzelfde antwoord
      var po = /^po-g(\d)$/.exec(this.value);
      toonVakken(po ? { groep: po[1] } : { fase: this.value });
    });
    document.getElementById('oefenStuur').addEventListener('click', function () { oefenAntwoord(document.getElementById('oefenIn').value); });
    document.getElementById('oefenIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') oefenAntwoord(this.value); });
    toonHerhalingen();
    if (window.RTGSchoolMeer) RTGSchoolMeer.start();
  }

  window.RTGSchool = { start: start, laadPaspoort: laadPaspoort, oefenAntwoord: oefenAntwoord };
})();
