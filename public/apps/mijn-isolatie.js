/* Mijn bescherming: het ledenscherm van de isolatiemodus.

   TOON: "je/jij". Dit is de RTG Pass-kant, en de kop van CLAUDE.md zegt daarover
   ingetogen en zeker. Het kantoorscherm (/apps/isolatie.html) doet hetzelfde
   werk in de taal van een cockpit; dat is met opzet niet dezelfde pagina met een
   vlag erbij.

   Hij rekent niets uit. Welke standen er zijn, wat ze doen en wat een ontsluiting
   vraagt, komt allemaal van de server -- ook de lijst stappen. Een scherm dat
   zijn eigen lijst eisen meebrengt, laat een verzwaring van die eisen ongemerkt
   voorbijgaan. */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var TOELICHTING = {
    normaal:   'alles werkt zoals altijd',
    waakzaam:  'we letten extra op, en er gaat niets dicht',
    beschermd: 'lezen blijft, maar geld, rechten en nieuwe koppelingen gaan op slot',
    isolatie:  'alleen wat bewezen niets verandert blijft open; de rest gaat dicht'
  };
  var AANBOD = [
    { stand: 'waakzaam',  t: 'Extra opletten',   u: 'Er gaat niets dicht. Handig als je twijfelt.' },
    { stand: 'beschermd', t: 'Op slot',          u: 'Je kunt alles blijven lezen. Geld, rechten en nieuwe koppelingen gaan dicht.' },
    { stand: 'isolatie',  t: 'Alles dicht',      u: 'Het strengst wat we hebben. Alleen wat bewezen niets verandert, blijft werken.' }
  ];

  function maak(tag, klas, tekst) {
    var e = document.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = String(tekst);
    return e;
  }
  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function meld(soort, tekst) {
    var m = $('melding');
    leeg(m);
    m.className = 'melding' + (soort ? ' ' + soort : '');
    m.appendChild(document.createTextNode(String(tekst)));
    m.hidden = false;
    m.scrollIntoView({ block: 'nearest' });
  }
  function haal(pad, lijf) {
    return fetch(pad, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(lijf || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error || (r.status === 401
            ? 'Je bent uitgelogd. Log opnieuw in.' : 'Er ging iets mis.'));
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }

  var stand = null;

  function tekenNu(d) {
    var nu = $('nu');
    leeg(nu);
    var s = d.mijn.identiteit || 'normaal';
    nu.appendChild(maak('span', 'stip ' + s));
    var mid = maak('div');
    mid.appendChild(maak('div', 'naam', s));
    mid.appendChild(maak('div', 'bij', TOELICHTING[s] || ''));
    nu.appendChild(mid);

    /* HET PLATFORM STAAT ERBIJ ALS HET NIET NORMAAL IS. Verzwijgen maakt dit
       scherm onbegrijpelijk: "waarom kan ik dit niet, ik sta toch op normaal". */
    var voet = [];
    if (d.platform && d.platform !== 'normaal') {
      voet.push('Er loopt op dit moment iets bij RTG zelf (stand: ' + d.platform +
        '). Dat kan meer dichtzetten dan jouw eigen keuze.');
    }
    if (d.mijn.sessie && d.mijn.sessie !== 'normaal') voet.push('Deze inlog staat apart op ' + d.mijn.sessie + '.');
    if (d.mijn.apparaat && d.mijn.apparaat !== 'normaal') voet.push('Dit toestel staat apart op ' + d.mijn.apparaat + '.');
    $('nuvoet').textContent = voet.join(' ');
  }

  /* WAT ER DAN NOG WERKT. Hij staat bij de KEUZE en niet ergens onderaan: wie
     overweegt zichzelf dicht te zetten, wil dat weten voordat hij drukt en niet
     erna. */
  function watWerktNog(d, stand) {
    var w = d.werktNog && d.werktNog[stand];
    if (!w) return null;
    var uit = maak('div', 'voet');
    var dicht = w.rijen.filter(function (r) { return r.stand !== 'werkt'; });
    uit.textContent = dicht.length
      ? 'Dan werkt niet meer: ' + dicht.map(function (r) { return r.wat; }).join(', ') + '. De rest blijft.'
      : 'Alles wat je dagelijks doet blijft werken.';
    return uit;
  }

  function tekenKeuzes(d) {
    var doos = $('keuzes');
    leeg(doos);
    var nu = d.mijn.identiteit || 'normaal';
    doos.appendChild(maak('p', 'voet', 'Strenger zetten gaat meteen. Terug is met opzet lastiger ' +
      '- als iemand anders in je account zit, moet die het niet zomaar kunnen terugdraaien.'));

    var reden = maak('input', 'veld');
    reden.id = 'reden';
    reden.placeholder = 'Bijvoorbeeld: ik kreeg een vreemde inlogmelding';
    reden.autocomplete = 'off';
    var lab = maak('label', null, 'Waarom (dit blijft bij je account staan)');
    lab.setAttribute('for', 'reden');
    doos.appendChild(lab);
    doos.appendChild(reden);

    AANBOD.forEach(function (a) {
      var k = maak('button', 'keuze');
      k.type = 'button';
      k.appendChild(maak('span', 't', a.t));
      k.appendChild(maak('span', 'u', a.u));
      if (a.stand === nu) {
        k.disabled = true;
        k.querySelector('.u').textContent = 'Hier sta je nu op.';
      } else {
        var gevolg = watWerktNog(d, a.stand);
        if (gevolg) k.appendChild(gevolg);
      }
      k.addEventListener('click', function () {
        var r = ($('reden').value || '').trim();
        if (r.length < 8) { meld('fout', 'Schrijf even in een zin waarom. Dat helpt je later terug te lezen wat er speelde.'); return; }
        haal('/api/isolatie/mijn/zet', { drager: 'identiteit', naar: a.stand, reden: r })
          .then(function () { meld('goed', 'Je staat nu op ' + a.stand + '.'); laad(); })
          .catch(function (e) { meld('fout', e.message); });
      });
      doos.appendChild(k);
    });
  }

  /* De weg terug staat ernaast, in ./mijn-isolatie-terug.js. De helpers gaan
     mee in plaats van te worden nagebouwd -- twee `haal`-functies zouden binnen
     een jaar twee verschillende foutmeldingen geven. */
  var tekenTerug = function (d) {
    window.RTGIsolatieTerug({ $: $, maak: maak, leeg: leeg, meld: meld, haal: haal, laad: laad })(d);
  };

  function laad() {
    haal('/api/isolatie/mijn', {}).then(function (d) {
      stand = d;
      tekenNu(d); tekenKeuzes(d); tekenTerug(d);
    }).catch(function (e) { meld('fout', e.message); });
  }

  document.addEventListener('DOMContentLoaded', laad);
})();
