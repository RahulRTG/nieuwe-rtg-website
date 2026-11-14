/* Formulierdeel van dezelfde werktafel. Geen opslag, sessie of eigen API.
   Een herstelconcept verandert nooit de bron zonder nieuwe menselijke keuze. */
(function (w) {
  'use strict';
  function node(tag, tekst, klasse) {
    var n = document.createElement(tag); if (tekst != null) n.textContent = tekst;
    if (klasse) n.className = klasse; return n;
  }
  function veld(form, naam, label, waarde, opties) {
    var wrap = node('label', null, 'ds-veldlabel'); wrap.appendChild(node('span', label));
    var input = node(opties && opties.gebied ? 'textarea' : 'input', null, 'ds-invoer');
    input.name = naam; input.value = waarde == null ? '' : waarde; input.required = true;
    if (opties && opties.type) input.type = opties.type;
    input.maxLength = opties && opties.max || 160;
    if (opties && opties.type === 'number') { input.min = '0'; input.step = '1'; input.max = '10000000'; }
    wrap.appendChild(input); form.appendChild(wrap); return input;
  }
  function knop(tekst) { var n = node('button', tekst, 'ds-knop ds-knop--stil'); n.type = 'button'; return n; }
  function maak(reis, concept, opslaan) {
    var form = node('form', null, 'ds-velden'), o = concept || reis.offerte || {};
    form.dataset.reisref = reis.ref; form._gewijzigd = !!concept;
    form.addEventListener('input', function () { form._gewijzigd = true; });
    var rol = node('label', null, 'ds-veldlabel'); rol.appendChild(node('span', 'Uw hoedanigheid in deze transactie'));
    var select = node('select', null, 'ds-invoer'); select.name = 'hoedanigheid';
    ['reisagent', 'touroperator', 'bemiddelaar', 'leverancier'].forEach(function (r) { var opt = node('option', r); opt.value = r; select.appendChild(opt); });
    rol.appendChild(select); form.appendChild(rol);
    var rollen = o.rollen || {}; select.value = rollen.hoedanigheid || 'reisagent';
    veld(form, 'contractpartij', 'Contractpartij van de reiziger', rollen.contractpartij);
    veld(form, 'factureert', 'Wie factureert aan de reiziger?', rollen.factureert);
    veld(form, 'aansprakelijk', 'Verantwoordelijkheid en aansprakelijkheid', rollen.aansprakelijk, { gebied: true, max: 500 });
    veld(form, 'voorwaarden', 'Volledige offertevoorwaarden en reisspecificatie (data, gezelschap en annulering)', o.voorwaarden, { gebied: true, max: 4000 });
    veld(form, 'geldigTot', 'Offerte geldig tot', concept && concept.geldigTot, { type: 'datetime-local' });
    var regels = node('div'), n = 0; form.appendChild(regels);
    function regel(p) {
      n++; var rij = node('fieldset', null, 'ds-velden'); rij.dataset.onderdeel = p && p.id || 'deel-' + crypto.randomUUID();
      rij.appendChild(node('legend', 'Reisonderdeel ' + n));
      veld(rij, 'wat', 'Omschrijving', p && p.wat);
      veld(rij, 'supplierCode', 'Aanbiedercode', p && p.supplierCode);
      veld(rij, 'productRef', 'Referentie in de administratie van de aanbieder', p && p.productRef);
      var label = node('label', null, 'ds-veldlabel'); label.appendChild(node('span', 'Soort onderdeel'));
      var soort = node('select', null, 'ds-invoer'); soort.name = 'soort';
      ['verblijf', 'vervoer', 'activiteit', 'dienst'].forEach(function (s) { var opt = node('option', s); opt.value = s; soort.appendChild(opt); });
      soort.value = p && p.soort || 'verblijf'; label.appendChild(soort); rij.appendChild(label);
      veld(rij, 'centen', 'Verkoopbedrag in eurocenten (100 = € 1)', p && String(p.centen), { type: 'number' });
      veld(rij, 'verschuldigdCenten', 'Verschuldigd aan aanbieder in eurocenten', p && String(p.verschuldigdCenten), { type: 'number' });
      var weg = knop('Onderdeel verwijderen'); weg.addEventListener('click', function () { rij.remove(); form._gewijzigd = true; });
      rij.appendChild(weg); regels.appendChild(rij);
    }
    (o.onderdelen && o.onderdelen.length ? o.onderdelen : [null]).forEach(regel);
    var erbij = knop('Reisonderdeel toevoegen'); erbij.addEventListener('click', function () { if (regels.children.length < 20) { regel(null); form._gewijzigd = true; } });
    form.appendChild(erbij);
    if (concept) {
      form.appendChild(node('p', 'Uw onopgeslagen concept uit bronversie ' + concept.basisVersie + '. Actuele bronversie: ' + reis.versie + '. Geen automatische samenvoeging. Sluiten of sessiewisselen wist dit concept.', 'ds-meta'));
      var label = node('label', null, 'ds-veldlabel'), oordeel = node('input'); oordeel.type = 'checkbox'; oordeel.required = true;
      label.append(oordeel, document.createTextNode(' Ik heb de actuele bron vergeleken en beoordeel mijn volledige concept opnieuw.'));
      form.appendChild(label);
    }
    var verzend = knop('Offerte ter beoordeling aanbieden'); verzend.type = 'submit'; form.appendChild(verzend);
    var pending = concept && concept.pending;
    form._concept = function () {
      var v = function (naam) { return form.elements.namedItem(naam).value; };
      return { ref: reis.ref, versie: reis.versie, basisVersie: concept ? concept.basisVersie : reis.versie, valuta: 'EUR',
        geldigTot: v('geldigTot'), voorwaarden: v('voorwaarden'), pending: pending,
        rollen: { hoedanigheid: v('hoedanigheid'), contractpartij: v('contractpartij'), factureert: v('factureert'), aansprakelijk: v('aansprakelijk') },
        onderdelen: Array.from(regels.children).map(function (rij) {
          var waarde = function (naam) { return rij.querySelector('[name="' + naam + '"]').value; };
          return { id: rij.dataset.onderdeel, wat: waarde('wat'), supplierCode: waarde('supplierCode'), productRef: waarde('productRef'),
            soort: waarde('soort'), centen: waarde('centen'), verschuldigdCenten: waarde('verschuldigdCenten') };
        }) };
    };
    form.addEventListener('submit', function (event) {
      event.preventDefault(); if (verzend.disabled || (oordeel && !oordeel.checked)) return;
      var body = form._concept(); delete body.basisVersie; delete body.pending;
      body.geldigTot = new Date(body.geldigTot).toISOString();
      body.onderdelen.forEach(function (p) { p.centen = Number(p.centen); p.verschuldigdCenten = Number(p.verschuldigdCenten); });
      var afdruk = JSON.stringify(body);
      if (!pending || pending.afdruk !== afdruk) pending = { afdruk: afdruk, idem: crypto.randomUUID() };
      body.idem = pending.idem; form._gewijzigd = true; opslaan(body, form);
    });
    return form;
  }
  function ontvangen(reis, concept) {
    if (!concept || !concept.pending || !reis.offerte) return false;
    var body = concept, o = reis.offerte, geldig = Date.parse(body.geldigTot);
    if (!Number.isFinite(geldig)) return false;
    function gelijk(a, b) { return Object.keys(a).every(function (k) {
      if (typeof b[k] === 'number') return a[k] !== '' && Number(a[k]) === b[k];
      return typeof a[k] === 'string' ? a[k].trim() === b[k] : a[k] === b[k];
    }); }
    return new Date(geldig).toISOString() === o.geldigTot && body.voorwaarden.trim() === o.voorwaarden && gelijk(body.rollen, o.rollen) &&
      body.onderdelen.length === o.onderdelen.length && body.onderdelen.every(function (p, i) { return gelijk(p, o.onderdelen[i]); });
  }
  w.RTGReisketenOfferte = { maak: maak, ontvangen: ontvangen };
})(window);
