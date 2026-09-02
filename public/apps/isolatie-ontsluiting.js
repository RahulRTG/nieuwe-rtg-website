/* DE ISOLATIECOCKPIT, DEEL TWEE: DE LOPENDE ONTSLUITINGEN.

   Los van ./isolatie.js langs dezelfde naad als aan de serverkant
   (routes/techniek/isolatie.js tegenover routes/techniek/isolatie-ceremonie.js):
   dat scherm toont de standen en zet ze strenger, dit voert de CEREMONIE waarmee
   een stand omlaag kan. Twee onderwerpen, en samen boven de leesgrens van 10 KB.

   AFTEKENEN KON HIER HELEMAAL NIET, en dat gat viel pas op toen de passkey-stap
   echt iets ging doen: de cockpit toonde de stappen en bood geen enkele manier
   om er een te zetten, dus een huis-ceremonie was van dit scherm af nooit rond
   te krijgen. De knoppen staan er nu, en voor `passkey` tekenen ze echt. */
'use strict';
window.RTGIsolatieOntsluiting = function (ctx) {
  var maak = ctx.maak, meld = ctx.meld, haal = ctx.haal, laad = ctx.laad, leeg = ctx.leeg;
  var $ = function (id) { return document.getElementById(id); };

  /* EEN STAP AFTEKENEN VANAF DE COCKPIT. `passkey` gaat langs de echte
     ceremonie (/shared/passkey.js, gebonden aan DIT verzoek en DEZE stap); de
     andere stappen tekenen zichzelf af en de server schrijft er de reden bij dat
     ze niet bewezen zijn. Het onderscheid wordt hier niet bedacht maar
     opgevraagd: welke stap bewijs vraagt, staat in de kern. */
  function tekenStap(v, eis, knop) {
    if (eis !== 'passkey') {
      return haal('/api/techniek/isolatie/ontsluiting/stap', { id: v.id, soort: eis })
        .then(function () { laad(); })
        .catch(function (e) { meld('fout', e.message); });
    }
    knop.disabled = true;
    return window.RTGPasskey.bevestig(function () {
      return haal('/api/techniek/isolatie/ontsluiting/stap/opties', { id: v.id, soort: 'passkey' })
        .catch(function (e) { return { error: e.message }; });
    }).then(function (uit) {
      knop.disabled = false;
      if (uit.fout) { meld('fout', uit.fout); return; }
      return haal('/api/techniek/isolatie/ontsluiting/stap',
        { id: v.id, soort: 'passkey', ceremonie: uit.ceremonie, antwoord: uit.antwoord })
        .then(function () { laad(); })
        .catch(function (e) { meld('fout', e.message); });
    });
  }

  function tekenOntsluitingen(o) {
    var kaart = $('ontsluitkaart');
    leeg(kaart);
    var open = o.openOntsluitingen || [];
    if (!open.length) {
      kaart.appendChild(maak('p', 'voetnoot', 'Er loopt geen ontsluiting. Een verzoek verlaagt overigens ' +
        'niets: pas de laatste, geautoriseerde stap levert een nieuwe stand op.'));
      return;
    }
    open.forEach(function (v) {
      var blok = maak('div');
      blok.style.paddingBottom = '1rem';
      var kop = maak('div');
      kop.appendChild(maak('strong', null, v.drager + ' · ' + (v.sleutel || '-')));
      kop.appendChild(document.createTextNode('  ' + v.van + ' → ' + v.naar));
      blok.appendChild(kop);
      blok.appendChild(maak('div', 'voetnoot', v.reden));
      /* HET MERK STAAT ERBIJ EN NIET ALLEEN HET WOORD. Een noodontsluiting ziet
         er zonder de grond precies zo uit als een gewone, en juist die twee
         horen op een cockpit niet op elkaar te lijken. */
      if (v.noodontsluiting) {
        var nood = maak('div', 'voetnoot', 'NOODONTSLUITING · ' +
          (v.noodGronden || []).map(function (g) { return g.grond; }).join(', '));
        nood.style.color = 'var(--burgundy-on-dark)';
        blok.appendChild(nood);
      }
      (v.vereisten || []).forEach(function (eis) {
        var klaar = eis === 'wachttijd' ? v.wachttijdVerstreken : !!(v.voltooid && v.voltooid[eis]);
        var r = maak('div', 'stap');
        r.appendChild(maak('span', 'vink' + (klaar ? ' klaar' : '')));
        r.appendChild(maak('span', null, eis + (klaar ? '' : ': nog open')));
        /* AFTEKENEN KON HIER HELEMAAL NIET, en dat is een gat dat pas opviel toen
           de passkey-stap echt iets ging doen: de cockpit toonde de stappen en
           bood geen enkele manier om er een te zetten, dus een huis-ceremonie was
           van dit scherm af nooit rond te krijgen. De knop staat er nu, en voor
           `passkey` tekent hij echt -- dezelfde weg als aan de ledenkant. */
        if (!klaar && eis !== 'wachttijd') {
          var kn = maak('button', 'knop grijs klein', eis === 'passkey' ? 'Tekenen' : 'Aftekenen');
          kn.style.marginLeft = 'auto';
          kn.addEventListener('click', function () { tekenStap(v, eis, kn); });
          r.appendChild(kn);
        }
        blok.appendChild(r);
      });
      var rij = maak('div');
      rij.style.marginTop = '.7rem';
      rij.style.display = 'flex';
      rij.style.gap = '.5rem';
      rij.style.flexWrap = 'wrap';
      var af = maak('button', 'knop grijs klein', 'Afbreken');
      af.addEventListener('click', function () {
        haal('/api/techniek/isolatie/ontsluiting/afbreken', { id: v.id, reden: 'afgebroken vanaf de cockpit' })
          .then(function () { meld('goed', 'Ontsluiting afgebroken.'); laad(); })
          .catch(function (e) { meld('fout', e.message); });
      });
      rij.appendChild(af);
      var klaarKnop = maak('button', 'knop klein', 'Voltooien');
      klaarKnop.disabled = (v.ontbreekt || []).length > 0;
      klaarKnop.addEventListener('click', function () {
        haal('/api/techniek/isolatie/ontsluiting/commit', { id: v.id })
          .then(function (j) { meld('goed', 'Stand verlaagd naar ' + j.uit.nieuweStand + '.'); laad(); })
          .catch(function (e) { meld('fout', e.message); });
      });
      rij.appendChild(klaarKnop);
      blok.appendChild(rij);
      kaart.appendChild(blok);
    });
  }

  /* De tabellen staan in ./isolatie-tabellen.js; zie daar waarom. */
  return { tekenOntsluitingen: tekenOntsluitingen };
};
