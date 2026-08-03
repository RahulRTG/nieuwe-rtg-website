/* De kantoorkant van RTG Klankwerk: de enige plek waar de RTG-naam onder een
   uitgave kan komen.

   Er staat hier met opzet GEEN inlogformulier. Wie bij het kantoor hoort, is al
   ingelogd via de ene aanmeldplek; dit scherm leest dat token en stuurt u
   anders terug. Een tweede inlogscherm zou een tweede plek zijn om een
   kantoorcode in te typen, en dat is er precies één te veel.

   Wat dit scherm NIET kan: iets goedkeuren zonder dat er een aanvraag ligt, of
   een uitgave weghalen. Weigeren betekent hier "niet onder onze naam", niet
   "weg ermee" -- het werk blijft van de maker. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_office_token'); } catch (e) { TOKEN = null; }

  // wat er nu ter beslissing ligt; haal() vult dit
  var AANVRAGEN = [];
  /* Meenemen: de openstaande aanvragen, op codenaam -- echte namen staan in de
     kluis en horen ook in een uitvoer niet mee. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!AANVRAGEN.length) return null;
    return { naam: 'naamaanvragen', kolommen: ['uitgave', 'aangevraagd', 'makers', 'toelichting'],
      rijen: AANVRAGEN.map(function (u) {
        return [u.naam, String(u.at || '').slice(0, 10),
          (u.makers || []).map(function (m) { return m.codenaam + ' (' + m.rol + ')'; }).join(', '),
          u.toelichting || ''];
      }) };
  });

  function api(pad, body) {
    return fetch('/api/office/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  var meldTimer = null;
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldTimer); meldTimer = setTimeout(function () { m.classList.remove('zie'); }, 2800);
  }
  function el(soort, klasse, wat) {
    var e = document.createElement(soort);
    if (klasse) e.className = klasse;
    if (wat != null) e.textContent = wat;
    return e;
  }

  if (!TOKEN) {
    var vlak = $('#lijst');
    vlak.textContent = '';
    var k = el('div', 'kaart');
    k.appendChild(el('h2', null, 'Nog niet aangemeld'));
    k.appendChild(el('p', 'stil', 'Meld u aan bij de backoffice; daarna staan de aanvragen hier.'));
    var a = document.createElement('a');
    a.className = 'knop'; a.href = '/apps/backoffice.html'; a.textContent = 'Naar de backoffice';
    a.style.marginTop = '.6rem';
    k.appendChild(a);
    vlak.appendChild(k);
    return;
  }

  function haal() {
    api('muziek').then(function (d) {
      var vlak = $('#lijst');
      vlak.textContent = '';
      if (d.error) { vlak.appendChild(el('p', 'stil', d.error)); return; }
      var rij = d.aanvragen || [];
      AANVRAGEN = rij;
      if (!rij.length) {
        vlak.appendChild(el('p', 'stil', 'Geen openstaande aanvragen. Er is niets te beslissen, ' +
          'en dat is een prima toestand.'));
        return;
      }
      rij.forEach(function (u) { vlak.appendChild(kaart(u)); });
    });
  }

  function kaart(u) {
    var k = el('div', 'kaart');
    k.appendChild(el('h2', null, u.naam));
    k.appendChild(el('p', 'stil', 'Aangevraagd op ' + new Date(u.at).toLocaleString('nl-NL')));
    if (u.toelichting) k.appendChild(el('p', null, u.toelichting));
    // De makers, met codenaam en rol. Echte namen staan in de kluis en horen
    // hier niet: ook het kantoor beslist op het werk, niet op de persoon.
    var cr = el('div', 'credits');
    (u.makers || []).forEach(function (m) {
      cr.appendChild(el('span', 'credit', m.codenaam + ' · ' + m.rol));
    });
    k.appendChild(cr);

    var rij = el('div', 'rij');
    rij.style.marginTop = '.7rem';
    var reden = document.createElement('input');
    reden.className = 'veld'; reden.maxLength = 300;
    reden.style.flex = '1'; reden.style.minWidth = '10rem';
    reden.id = 'r' + u.id;
    reden.placeholder = 'Uw reden (de maker leest hem)';
    var label = document.createElement('label');
    label.className = 'stil'; label.setAttribute('for', reden.id);
    label.textContent = 'Reden';
    rij.appendChild(label); rij.appendChild(reden);

    var ja = document.createElement('button');
    ja.type = 'button'; ja.className = 'knop vol'; ja.textContent = 'De RTG-naam eronder';
    ja.addEventListener('click', function () {
      if (!confirm('RTG komt dan als uitgever onder "' + u.naam + '" te staan. Doorgaan?')) return;
      beslis(u, true, reden.value);
    });
    var nee = document.createElement('button');
    nee.type = 'button'; nee.className = 'knop rood'; nee.textContent = 'Niet onder onze naam';
    nee.addEventListener('click', function () { beslis(u, false, reden.value); });
    rij.appendChild(ja); rij.appendChild(nee);
    k.appendChild(rij);
    k.appendChild(el('p', 'stil', 'Zegt u nee, dan blijft de uitgave gewoon staan onder de codenaam ' +
      'van de maker.'));
    return k;
  }

  function beslis(u, jaNee, reden) {
    api('muziek/beslis', { id: u.id, ja: jaNee === true, reden: reden }).then(function (d) {
      if (d.error) return zeg(d.error);
      zeg(jaNee ? '"' + u.naam + '" komt uit onder de RTG-naam.'
        : '"' + u.naam + '" blijft onder de codenaam van de maker staan.');
      haal();
    });
  }

  haal();
})();
