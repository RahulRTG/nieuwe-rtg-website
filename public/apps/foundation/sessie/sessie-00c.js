/* Dezelfde coach-owner, in dezelfde sessiebundel. Geen eigen sessie of transport. */
  function coach(opts) {
      var s = lees(); if (!s) return;
      var gesprek = [], bezig = false;
      function zelfdeProfiel() { var nu = lees(); return !!(nu && nu.code === s.code && nu.token === s.token &&
        (nu.profiel && nu.profiel.id) === (s.profiel && s.profiel.id)); }
      var NM = { vrouw: 'Rahul', man: 'Rahul', nonbinair: 'Rahul' };
      function buddyKeuze() { try { return localStorage.getItem('rtf_buddy') || 'vrouw'; } catch (e) { return 'vrouw'; } }
      // de leeftijdsgroep stuurt taal en niveau van de AI; van het profiel, anders de app-ingang
      function groepVan() { try { return (s.profiel && s.profiel.groep) || document.documentElement.getAttribute('data-rtf-groep') || ''; } catch (e) { return ''; } }
      function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
      function verstuur() {
        var t = (opts.input.value || '').trim(); if (!t || (dsBijStart && (bezig || !zelfdeProfiel()))) return;
        if (dsBijStart) { bezig = true; opts.knop.disabled = true; }
        opts.input.value = '';
        opts.chat.insertAdjacentHTML('beforeend', '<div class="b ik' + (dsBijStart ? ' ds-gesprek__bericht ds-gesprek__bericht--eigen' : '') + '">' + esc2(t) + '</div>');
        gesprek.push({ role: 'user', content: t });
        var w = document.createElement('div'); w.className = 'b ai' + (dsBijStart ? ' ds-gesprek__bericht' : ''); w.textContent = opts.wacht || ((NM[buddyKeuze()] || 'Rahul') + ' denkt mee...');
        opts.chat.appendChild(w); opts.chat.scrollTop = opts.chat.scrollHeight;
        api('/hulp/ai', { code: s.code, token: s.token, kind: opts.kind, messages: gesprek, buddy: buddyKeuze(), groep: groepVan() })
          .then(function (d) {
            if (dsBijStart && !zelfdeProfiel()) { w.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
            if (dsBijStart && (!d || d.error || d.ok === false || typeof d.text !== 'string' || !d.text.trim())) throw new Error('Geen coachantwoord');
            w.textContent = d.text; gesprek.push({ role: 'assistant', content: d.text }); opts.chat.scrollTop = opts.chat.scrollHeight;
          })
          .catch(function () {
            if (dsBijStart && !zelfdeProfiel()) { w.textContent = 'Je profiel is gewijzigd. Open deze ruimte opnieuw.'; return; }
            w.textContent = 'Sorry, dat lukte even niet. Probeer het zo nog eens.';
            if (dsBijStart) { gesprek.pop(); if (!opts.input.value) opts.input.value = t; }
          }).finally(function () { if (dsBijStart) { bezig = false; opts.knop.disabled = false; } });
      }
      opts.knop.addEventListener('click', verstuur);
      opts.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); verstuur(); } });
    }
