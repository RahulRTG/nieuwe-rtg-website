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

  /* ---- de Daily Learning Guarantee: wat staat er vandaag klaar ----

     Dit scherm verzint niets: het toont wat de server heeft samengesteld uit
     de herhalingen en de leerlijn, met per stuk de reden erbij. Twee dingen
     die hier bewust NIET staan: een teller over dagen heen (die bestaat niet,
     de server bewaart geen plan) en enige vorm van tijdsdruk. Het is een
     voorstel; iets anders doen mag altijd, en dat staat er ook. */
  async function toonDag() {
    var el = document.getElementById('dagLijst');
    if (!el) return;
    try {
      var d = await api('/api/leerstof/dag');
      el.innerHTML = (d.stukken.length
        ? d.stukken.map(function (x) {
            var knop = x.soort === 'herhalen' ? 'herhaal' : 'oefen';
            return '<div class="doel"><span>' + esc(x.naam) +
              ' <span style="color:var(--soft);font-size:.72rem;">(' + esc(x.vak) + ')</span><br>' +
              '<span style="color:var(--soft);font-size:.76rem;">' + esc(x.waarom) + '</span></span>' +
              '<span class="rij"><button class="knop" data-' + knop + '="' + esc(x.doel) + '" style="padding:.3rem .6rem;font-size:.76rem;">Doen</button></span></div>';
          }).join('')
        : '<div class="leeg">' + esc(d.let || '') + '</div>') +
        '<p class="leeg" style="margin:.5rem 0 0;">' + esc(d.uitleg) + '</p>';
      el.querySelectorAll('[data-oefen]').forEach(function (b) {
        b.addEventListener('click', function () { oefenStart(b.dataset.oefen); });
      });
      el.querySelectorAll('[data-herhaal]').forEach(function (b) {
        b.addEventListener('click', function () { herhaalStart(b.dataset.herhaal); });
      });
    } catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
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
      /* De Misconception Graph: als de server heeft kunnen narekenen WAT er
         gedacht is, staat dat hier -- met daaronder dezelfde stof op een
         andere manier uitgelegd. Komt de server er niet uit, dan staat er
         niets extra's: een verzonnen duiding stuurt je de verkeerde kant op. */
      if (d.denkfout) regel += '<div style="margin-top:.4rem;"><b>' + esc(d.denkfout.naam) + '.</b> ' + esc(d.denkfout.uitleg) + '</div>';
      if (d.anders) regel += '<div style="margin-top:.35rem;opacity:.9;"><i>Anders uitgelegd (' + esc(d.anders.soort) + '):</i> ' + esc(d.anders.tekst) + '</div>';
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
        toonDag();
      } else {
        uit.innerHTML = regel;
        vraagToon('oefenKaart', d.vraag, d.opties, 'oefenStand', d.nr + 1 + '/' + d.totaal);
      }
    } catch (e) { meld(e.message); }
  }
