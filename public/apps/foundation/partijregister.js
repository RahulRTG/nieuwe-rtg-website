/* Het partijenregister op het kwestiekantoor (kern/democratie/partijen.js,
   POLITIEK.md par. 7.1).

   Inschrijven gaat op naam en op de bron van een officiele registratie. Er is
   met opzet geen veld voor ideologie, grootte of betrouwbaarheid: het register
   oordeelt niet. De sleutel die de partij nodig heeft, staat hier EEN keer; de
   server bewaart alleen een hash. Leest window.KwestieKantoor (api, esc, zeg). */
(function () {
  'use strict';
  const K = window.KwestieKantoor;
  if (!K) return;
  const $ = s => document.querySelector(s);
  const esc = K.esc;
  const CAT = { geregistreerd: 'geregistreerd', deelnemer: 'deelnemer' };

  function rij(p) {
    const id = esc(p.id);
    return '<div class="kwestie"><div class="rij"><div class="kern"><b>' + esc(p.aanduiding) + '</b>' +
      '<div class="meta">' + id + ' · ' + esc(p.niveau) + ' · ' + esc(CAT[p.categorie] || p.categorie) +
      ' · bron: ' + esc(p.bron.verwijzing) + ', nagekeken ' + esc(p.bron.gecontroleerd) + '</div></div>' +
      '<span class="stand">' + esc(p.stand) + '</span></div>' +
      (p.stand === 'actief' ? '<div class="werk"><div class="rij"><button class="kknop" type="button" data-psleutel="' + id + '">Nieuwe sleutel</button>' +
        '<input class="kveld" data-preden="' + id + '" maxlength="300" placeholder="Waarom uitschrijven? Met de bron." aria-label="Reden om uit te schrijven">' +
        '<button class="kknop" type="button" data-puit="' + id + '">Uitschrijven</button></div></div>' : '') + '</div>';
  }

  function toonSleutel(d) {
    $('#pSleutel').innerHTML = '<div class="melder goed"><b>' + esc(d.partij.aanduiding) + '</b>: ' + esc(d.let_op) +
      '<br><code>' + esc(d.sleutel) + '</code></div>';
  }

  async function teken() {
    try {
      const d = await K.api('partij/lijst');
      if (!$('#pNiveau').options.length) {
        $('#pNiveau').innerHTML = d.niveaus.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
      }
      $('#partijen').innerHTML = d.partijen.length ? d.partijen.map(rij).join('')
        : '<div class="leeg">Er staat nog geen partij in het register.</div>';
    } catch (e) { $('#partijen').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  async function doe(werk, klaar) {
    try { const d = await werk(); if (d && d.sleutel) toonSleutel(d); K.zeg(klaar, true); await teken(); K.lijst(); }
    catch (e) { K.zeg(e.message); }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.id === 'pRegistreer') {
      doe(() => K.api('partij/registreer', { aanduiding: $('#pAanduiding').value.trim(), niveau: $('#pNiveau').value,
        categorie: $('#pCategorie').value, bron: $('#pBron').value.trim(), gecontroleerd: $('#pGecontroleerd').value }),
      'Ingeschreven. Geef de sleutel hierboven aan de partij.');
    } else if (t.dataset.psleutel) {
      doe(() => K.api('partij/sleutel', { id: t.dataset.psleutel }), 'Nieuwe sleutel uitgegeven. De vorige werkt niet meer.');
    } else if (t.dataset.puit) {
      const reden = (document.querySelector('[data-preden="' + t.dataset.puit + '"]') || {}).value || '';
      doe(() => K.api('partij/uitschrijf', { id: t.dataset.puit, reden: reden.trim() }), 'Uitgeschreven. Wat de partij plaatste, blijft staan.');
    }
  });

  if (K.aan()) teken();
})();
