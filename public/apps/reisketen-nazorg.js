/* Dezelfde nazorgvraag in de bestaande reizigers- en verkoperswerktafel.
   Alleen een vraag/verklaring: geen annulering, terugbetaling of mandaat.
   De ouder bewaakt sessie, bronversie, netwerkherstel en mutatieslot. */
(function (w) {
  'use strict';
  function n(tag, tekst, klasse) {
    const el = document.createElement(tag);
    if (tekst != null) el.textContent = tekst;
    if (klasse) el.className = klasse;
    return el;
  }
  function veld(form, naam, label, opties) {
    const wrap = n('label', null, 'ds-veldlabel');
    const el = n(opties ? 'select' : 'textarea', null, 'ds-invoer');
    el.name = naam; el.required = true;
    if (opties) opties.forEach(([v, tekst]) => { const o = n('option', tekst); o.value = v; el.appendChild(o); });
    else { el.classList.add('ds-invoer--tekst'); el.minLength = 8; el.maxLength = 2000; el.rows = 3; }
    wrap.append(n('span', label), el); form.appendChild(wrap); return el;
  }
  function verzenden(form, label, maak, pad, verstuur) {
    const b = n('button', label, 'ds-knop ds-knop--stil'); b.type = 'submit';
    b.dataset.nazorgVerstuur = ''; form.appendChild(b);
    let laatste;
    form.addEventListener('submit', e => {
      e.preventDefault(); const body = maak(); if (!body) return;
      const afdruk = JSON.stringify(body);
      if (!laatste || laatste.afdruk !== afdruk) laatste = { afdruk, idem: crypto.randomUUID() };
      verstuur(pad, { ...body, idem: laatste.idem });
    });
  }
  function teken(host, reis, rol, verstuur) {
    if (!reis.akkoord || !reis.offerte) return;
    const vak = n('section', null, 'ds-velden'); vak.dataset.nazorgReis = reis.ref;
    vak.append(n('h4', 'Wijziging of annulering vragen', 'ds-titel'),
      n('p', 'Een vraag of antwoord verandert uw reis en betaling niet. Uitvoering is niet bevestigd; financiële uitvoering blijft geblokkeerd.', 'ds-meta'));
    const lijst = reis.nazorg || [], onderdelen = reis.offerte.onderdelen;
    lijst.forEach(v => {
      const rij = n('section', null, 'ds-velden'); rij.dataset.nazorgId = v.id;
      rij.append(n('h5', v.soort + ' · ' + v.status, 'ds-titel'),
        n('p', 'Offerte ' + v.offerteVersie + ' · ' + v.onderdelen.map(id => onderdelen.find(p => p.id === id)?.wat || id).join(', '), 'ds-meta'),
        n('p', v.toelichting, 'ds-meta'), n('p', 'Uitvoering: ' + v.uitvoering + '. Financieel: ' + v.financieleUitvoering + '.', 'ds-meta'));
      if (v.antwoord) rij.append(n('p', v.antwoord.soort + ': ' + v.antwoord.toelichting, 'ds-meta'),
        n('p', 'Bronverwijzing van uw verkoper: ' + v.antwoord.bronRef + '. Dit is een verklaring, geen geverifieerde contractgoedkeuring.', 'ds-meta'));
      else if (rol === 'verkoper' && v.status === 'aangevraagd') {
        const form = n('form', null, 'ds-velden'); form.dataset.nazorgAntwoord = v.id;
        const soort = veld(form, 'soort', 'Soort antwoord', [['voorstel', 'Voorstel, nog niet uitgevoerd'], ['toelichting', 'Toelichting']]);
        const bron = veld(form, 'bronRef', 'Bronreferentie van uw verklaring'); bron.minLength = 1; bron.maxLength = 160; bron.rows = 1;
        const tekst = veld(form, 'toelichting', 'Antwoord aan de reiziger');
        verzenden(form, 'Verstuur antwoord, zonder reis of geld te wijzigen', () => ({ ref: reis.ref, versie: reis.versie,
          nazorgId: v.id, soort: soort.value, bronRef: bron.value.trim(), toelichting: tekst.value.trim() }), 'keten/nazorg/antwoord', verstuur);
        rij.appendChild(form);
      }
      vak.appendChild(rij);
    });
    if (rol === 'lid') {
      const open = new Set(lijst.filter(v => v.status === 'aangevraagd').flatMap(v => v.onderdelen));
      const beschikbaar = onderdelen.filter(p => !open.has(p.id));
      if (beschikbaar.length && lijst.length < 50) {
        const form = n('form', null, 'ds-velden'); form.dataset.nazorgVraag = '';
        const soort = veld(form, 'soort', 'Wat wilt u vragen?', [['wijziging', 'Een wijziging aanvragen'], ['annulering', 'Een annulering aanvragen']]);
        const groep = n('fieldset', null, 'ds-velden'); groep.appendChild(n('legend', 'Voor welke reisonderdelen?'));
        const keuzes = beschikbaar.map(p => {
          const label = n('label', null, 'ds-veld'), input = n('input'); input.type = 'checkbox'; input.value = p.id;
          input.name = 'onderdelen'; label.append(input, n('span', p.wat, 'ds-veld__label')); groep.appendChild(label); return input;
        });
        form.appendChild(groep);
        const tekst = veld(form, 'toelichting', 'Uw vraag aan uw reisadviseur');
        const status = n('p', '', 'ds-meta'); status.setAttribute('role', 'status'); form.appendChild(status);
        verzenden(form, 'Verstuur nazorgvraag', () => {
          const ids = keuzes.filter(el => el.checked).map(el => el.value);
          if (!ids.length) { status.textContent = 'Kies minstens één reisonderdeel.'; keuzes[0].focus(); return null; }
          return { ref: reis.ref, versie: reis.versie, offerteHash: reis.offerte.hash,
            soort: soort.value, onderdelen: ids, toelichting: tekst.value.trim() };
        }, 'keten/nazorg', verstuur);
        vak.appendChild(form);
      } else vak.appendChild(n('p', 'Uw reisadviseur moet eerst de openstaande nazorgvragen behandelen.', 'ds-meta'));
    }
    host.appendChild(vak);
  }
  w.RTGReisNazorg = { teken };
})(window);
