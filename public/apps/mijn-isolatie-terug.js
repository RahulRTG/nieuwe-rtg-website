/* MIJN BESCHERMING, DEEL TWEE: DE WEG TERUG.

   Los van ./mijn-isolatie.js langs dezelfde naad als aan de serverkant
   (routes/isolatie.js tegenover routes/isolatie-ceremonie.js): het ene scherm
   toont je stand en zet hem strenger, dit voert de CEREMONIE waarmee hij omlaag
   kan. Twee onderwerpen, en samen boven de leesgrens van 10 KB.

   HET SCHERM REKENT NIETS UIT. Welke stappen er nodig zijn komt uit `vereisten`
   van de server, ook de volgorde en of ze klaar zijn. Een scherm dat zijn eigen
   lijst eisen meebrengt, laat een verzwaring van die eisen ongemerkt
   voorbijgaan.

   DE PASSKEY-STAP WORDT ECHT GETEKEND, en dat is het verschil met de eerste
   versie. Die stuurde alleen "ik heb het gedaan" -- precies wat een aanvaller
   met een overgenomen sessie ook stuurt. Het tekenen zelf staat in
   /shared/passkey.js, want de binaire vertaling stond al op drie plekken. */
'use strict';
window.RTGIsolatieTerug = function (ctx) {
  var $ = ctx.$, maak = ctx.maak, leeg = ctx.leeg, meld = ctx.meld, haal = ctx.haal, laad = ctx.laad;
  return function tekenTerug(d) {
    var doos = $('terug');
    leeg(doos);
    var nu = d.mijn.identiteit || 'normaal';
    if (nu === 'normaal') {
      doos.appendChild(maak('p', 'voet', 'Je staat op normaal; er valt niets terug te zetten.'));
      return;
    }
    var lopend = (d.open || [])[0];
    if (!lopend) {
      doos.appendChild(maak('p', 'voet', 'Terugzetten doen we in stappen: je bevestigt met een passkey, ' +
        'en soms wachten we even. Zolang dat loopt, blijft je bescherming gewoon aan.'));
      var start = maak('button', 'knop', 'Terug naar normaal aanvragen');
      start.type = 'button';
      start.addEventListener('click', function () {
        var r = ($('reden') && $('reden').value || '').trim();
        if (r.length < 8) { meld('fout', 'Schrijf even in een zin waarom je terug wilt.'); return; }
        haal('/api/isolatie/mijn/ontsluiting', { drager: 'identiteit', naar: 'normaal', reden: r })
          .then(function () { meld('goed', 'Aangevraagd. Je bescherming blijft aan tot alle stappen rond zijn.'); laad(); })
          .catch(function (e) { meld('fout', e.message); });
      });
      doos.appendChild(start);
      return;
    }

    doos.appendChild(maak('p', 'voet', 'Je vroeg aan om terug te gaan naar ' + lopend.naar +
      '. Je bescherming blijft aan tot dit rond is.'));
    (lopend.vereisten || []).forEach(function (eis) {
      var klaar = eis === 'wachttijd' ? lopend.wachttijdVerstreken : !!(lopend.voltooid && lopend.voltooid[eis]);
      var rij = maak('div', 'stap');
      rij.appendChild(maak('span', 'vink' + (klaar ? ' klaar' : '')));
      var mid = maak('div');
      mid.appendChild(maak('div', null, eis === 'wachttijd'
        ? 'Even wachten (' + lopend.wachttijdMinuten + ' minuten)' : eis));
      mid.appendChild(maak('div', 'u', klaar ? 'klaar' : 'nog te doen'));
      rij.appendChild(mid);
      if (!klaar && eis !== 'wachttijd') {
        var b = maak('button', 'knop grijs', eis === 'passkey' ? 'Bevestigen met je passkey' : 'Bevestigen');
        b.type = 'button';
        b.style.marginLeft = 'auto';
        b.addEventListener('click', function () {
          /* DE PASSKEY-STAP WORDT ECHT GETEKEND. Vroeger stuurde deze knop
             alleen "ik heb het gedaan", en dat is precies wat een aanvaller met
             een overgenomen sessie ook stuurt. Nu vraagt hij eerst een ceremonie
             die aan DIT verzoek en DEZE stap hangt, laat de browser tekenen, en
             stuurt de assertie mee. De andere stappen tekenen zichzelf af, en de
             server schrijft er de reden bij dat ze niet bewezen zijn. */
          if (eis !== 'passkey') {
            haal('/api/isolatie/mijn/ontsluiting/stap', { id: lopend.id, soort: eis })
              .then(function () { laad(); })
              .catch(function (e) { meld('fout', e.message); });
            return;
          }
          b.disabled = true;
          window.RTGPasskey.bevestig(function () {
            return haal('/api/isolatie/mijn/ontsluiting/stap/opties', { id: lopend.id, soort: 'passkey' })
              .catch(function (e) { return { error: e.message }; });
          }).then(function (uit) {
            b.disabled = false;
            if (uit.fout) { meld('fout', uit.fout); return; }
            return haal('/api/isolatie/mijn/ontsluiting/stap',
              { id: lopend.id, soort: 'passkey', ceremonie: uit.ceremonie, antwoord: uit.antwoord })
              .then(function () { laad(); })
              .catch(function (e) { meld('fout', e.message); });
          });
        });
        rij.appendChild(b);
      }
      doos.appendChild(rij);
    });

    var rij2 = maak('div');
    rij2.style.marginTop = '1rem';
    rij2.style.display = 'flex';
    rij2.style.gap = '.6rem';
    rij2.style.flexWrap = 'wrap';
    var af = maak('button', 'knop', 'Terugzetten afronden');
    af.type = 'button';
    af.disabled = (lopend.ontbreekt || []).length > 0;
    af.addEventListener('click', function () {
      haal('/api/isolatie/mijn/ontsluiting/commit', { id: lopend.id })
        .then(function () { meld('goed', 'Je staat weer op normaal.'); laad(); })
        .catch(function (e) { meld('fout', e.message); });
    });
    rij2.appendChild(af);
    var stop = maak('button', 'knop grijs', 'Toch niet');
    stop.type = 'button';
    stop.addEventListener('click', function () {
      haal('/api/isolatie/mijn/ontsluiting/afbreken', { id: lopend.id, reden: 'toch niet' })
        .then(function () { meld('goed', 'Afgebroken. Je bescherming staat gewoon nog aan.'); laad(); })
        .catch(function (e) { meld('fout', e.message); });
    });
    rij2.appendChild(stop);
    doos.appendChild(rij2);
  };
};
