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
    d.innerHTML = '<div class="kv-in">' +
      '<div id="kanaalVraagTitel" class="big kv-titel">' + escT(T('kanaal.vraag', 'Hoe kent u RTG?')) + '</div>' +
      '<div class="meta kv-meta">' + escT(T('kanaal.uitleg', 'Eén vraag, en niet verplicht. We tellen alleen hoeveel mensen elk antwoord gaven; bij uw account komt het niet te staan.')) + '</div>' +
      '<div class="kv-rij">' +
      v.kanalen.map(function(k){ return '<button class="go" data-kanaal="' + escT(k.id) + '">' + escT(k.label) + '</button>'; }).join('') +
      '</div><button class="go kv-over" data-kanaal="">' + escT(T('kanaal.over', 'Overslaan')) + '</button></div>';
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

