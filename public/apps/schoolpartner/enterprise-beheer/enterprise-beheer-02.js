/* de export van de school: alles plat en leesbaar, met het zorgdeel als aparte keuze */
        '<input type="checkbox" id="enExportZorg"> met het zorgdeel</label></div>' +
        '<div id="enExportUit" class="stil" style="margin-top:.4rem;"></div>',
        'Alles wat de school van zichzelf heeft, plat en leesbaar. Vraagt u het zorgdeel erbij, dan staat dat als zodanig in het journaal.');

      h += kaart('Laatste inzage', (journaal.rijen || []).map(function (j) {
        return rij(esc(j.wat) + ' <span class="stil">· ' + esc(j.rol) + '</span>',
          esc(j.reden || '') + ' · ' + esc(String(j.at).slice(0, 16).replace('T', ' ')));
      }).join('') || '<p class="stil">Nog niets gelogd.</p>',
      'Het journaal legt vast dát er is gekeken, door wie en waarom -- nooit wat er stond.');

      wortel.innerHTML = h;
      document.getElementById('enPMaak').addEventListener('click', function () {
        var titel = document.getElementById('enPTitel').value.trim();
        var stelling = document.getElementById('enPStelling').value.trim();
        if (!titel || !stelling) return meld('Geef de peiling een titel en een stelling.');
        A('/school/peiling/maak', sleutels({ titel: titel, stellingen: [stelling],
          doelgroep: document.getElementById('enPDoel').value })).then(function (r2) {
          meld(r2.body.error || 'De peiling staat uit.');
          if (!r2.body.error) teken();
        });
      });
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-haak]'), function (b) {
        b.addEventListener('click', function () {
          var pad = b.dataset.haak === 'proef' ? '/school/webhook/proef' : '/school/webhook/wek';
          A(pad, sleutels({ webhookId: b.dataset.id })).then(function (r2) {
            meld(r2.body.error || (r2.body.ok ? 'Afgeleverd (' + (r2.body.status || 'ok') + ').' : 'Niet afgeleverd: ' + (r2.body.fout || 'onbekend')));
            teken();
          });
        });
      });
      document.getElementById('enExport').addEventListener('click', function () {
        var metZorg = document.getElementById('enExportZorg').checked;
        A('/school/export', sleutels({ metZorg: metZorg })).then(function (r2) {
          if (r2.body.error) return meld(r2.body.error);
          var d = r2.body;
          document.getElementById('enExportUit').textContent = d.leerlingen.length + ' leerlingen, ' +
            d.personeel.length + ' personeelsleden, ' + d.facturen.length + ' facturen. ' + d.uitleg;
          if (window.RTGUitvoer) RTGUitvoer.bron(function () {
            return { naam: 'school-export', kolommen: ['id', 'naam', 'status', 'klas', 'opleiding'],
              rijen: d.leerlingen.map(function (l) { return [l.id, l.naam, l.status, l.klasCode || '', l.opleiding || '']; }) };
          });
        });
      });
      document.getElementById('enKZet').addEventListener('click', function () {
        var velden = Array.prototype.map.call(wortel.querySelectorAll('[data-koppelvelden] input:checked'), function (i) { return i.value; });
        if (!velden.length) return meld('Kies welke velden deze koppeling mag ontvangen; zonder dat gaat hij niet aan.');
        A('/school/koppeling/zet', sleutels({ soort: document.getElementById('enKSoort').value,
          url: document.getElementById('enKUrl').value, velden: velden }))
          .then(function (r2) { meld(r2.body.error || 'De koppeling staat aan met de gekozen velden.'); if (!r2.body.error) teken(); });
      });
      document.getElementById('enWZet').addEventListener('click', function () {
        var geb = Array.prototype.map.call(wortel.querySelectorAll('[data-webhookgeb] input:checked'), function (i) { return i.value; });
        A('/school/webhook/zet', sleutels({ url: document.getElementById('enWUrl').value, gebeurtenissen: geb }))
          .then(function (r2) { meld(r2.body.error || 'Webhook staat aan.'); if (!r2.body.error) teken(); });
      });
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-haakweg]'), function (b) {
        b.addEventListener('click', function () {
          A('/school/webhook/weg', sleutels({ webhookId: b.dataset.haakweg }))
            .then(function (r2) { meld(r2.body.error || 'Webhook weggehaald.'); if (!r2.body.error) teken(); });
        });
      });
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-peilsluit]'), function (b) {
        b.addEventListener('click', function () {
          A('/school/peiling/sluit', sleutels({ peilingId: b.dataset.peilsluit }))
            .then(function (r2) { meld(r2.body.error || 'De peiling is gesloten.'); if (!r2.body.error) teken(); });
        });
      });
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-rol]'), function (b) {
        b.addEventListener('click', function () {
          var vak = wortel.querySelector('[data-rolrij="' + b.dataset.rol + '"]');
          var gekozen = Array.prototype.slice.call(vak.querySelectorAll('input:checked')).map(function (i) { return i.value; });
          A('/school/personeel/rollen', sleutels({ personeelId: b.dataset.rol, rollen: gekozen }))
            .then(function (r2) { meld(r2.body.error || 'Rollen bewaard.'); });
        });
      });
    });
  }

  window.RTGSchoolBeheer = { bind: bind };
})();
