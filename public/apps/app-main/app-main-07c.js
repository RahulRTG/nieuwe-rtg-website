  /* ---------- de herkomstvraag op het welkomstscherm (besluit C6) ----------
     De eigenaar koos voor NA de registratie: het aanmeldformulier blijft even
     kort, en wie de vraag overslaat is gewoon lid. De server zegt bij de
     registratie OF de vraag open is en geeft de antwoorden mee (er is geen
     tweede lijst hier); de vraag komt pas als de onboarding klaar is, zodat hij
     het verplichte gesprek niet onderbreekt. Een keer: het antwoord en het
     overslaan sluiten hem allebei, op de server. */
  var aanmeldkanaalVraag = null;
  function vraagAanmeldkanaal(){
    const v = aanmeldkanaalVraag; aanmeldkanaalVraag = null;
    if (!v || !Array.isArray(v.kanalen) || !v.kanalen.length || !API.live || document.getElementById('kanaalVraag')) return;
    const d = document.createElement('section');
    d.id = 'kanaalVraag'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'kanaalVraagTitel');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--card);color:var(--txt);border-top:1px solid var(--line);padding:1.25rem 1rem calc(1.25rem + env(safe-area-inset-bottom));';
    d.innerHTML = '<div style="max-width:32rem;margin:0 auto;">' +
      '<div id="kanaalVraagTitel" class="big" style="font-size:1.02rem;">' + escT(T('kanaal.vraag', 'Hoe kent u RTG?')) + '</div>' +
      '<div class="meta" style="margin:0.25rem 0 0.9rem;">' + escT(T('kanaal.uitleg', 'Eén vraag, en niet verplicht. We tellen alleen hoeveel mensen elk antwoord gaven; bij uw account komt het niet te staan.')) + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
      v.kanalen.map(function(k){ return '<button class="go" data-kanaal="' + escT(k.id) + '">' + escT(k.label) + '</button>'; }).join('') +
      '</div><button class="go" data-kanaal="" style="margin-top:0.75rem;background:transparent;color:var(--muted);">' + escT(T('kanaal.over', 'Overslaan')) + '</button></div>';
    document.body.appendChild(d);
    d.querySelectorAll('[data-kanaal]').forEach(function(b){ b.addEventListener('click', async function(){
      d.querySelectorAll('button').forEach(function(x){ x.disabled = true; });
      try {
        await API.call('/auth/aanmeldkanaal', { kanaal: b.dataset.kanaal || null });
        if (b.dataset.kanaal) toast(T('kanaal.dank', 'Dank u.'));
      } catch (e) { /* een telling is een extra; de vraag gaat hoe dan ook dicht */ }
      d.remove();
    }); });
  }
