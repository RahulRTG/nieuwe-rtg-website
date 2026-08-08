/* RTF Living Lab, scherm deel 7: het labbeheer. Tekenbevoegden, budget,
   partners, bewaartermijn en het auditspoor.

   DIT IS DE EERSTE STAP DIE NIEMAND VERWACHT. Zonder een tekenbevoegde in het
   register kan er in dit hele systeem niets ondertekend worden: geen
   risicoklasse, geen ethische review, geen privacytoets, geen bewijsgraad boven
   een indicatie. Dat is de bedoeling -- maar dan moet het scherm ook zeggen dát
   het de eerste stap is, en niet een leeg keuzemenu tonen waar de gebruiker
   naar staat te kijken.

   Het auditspoor staat hier bewust naast: het is de tegenhanger van alle
   handtekeningen hierboven. Wie mag tekenen, hoort ook zichtbaar te maken wat
   er getekend is -- en vooral wat er is GEWEIGERD. */
(function () {
  'use strict';
  var api, KADER, esc, meld, huidigLab, herlaad;

  function init(o) {
    api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld;
    huidigLab = o.huidigLab; herlaad = o.herlaad;
  }

  var ROLLEN_TEKENEN = ['professional', 'reviewer', 'toezichthouder'];

  function teken(doel) {
    var lab = huidigLab();
    if (!lab) { doel.innerHTML = '<div class="leeg">Kies eerst een lab.</div>'; return; }
    var t = lab.tekenaars || [];
    doel.innerHTML =
      '<div class="sec">Tekenbevoegden van ' + esc(lab.naam) + '</div>' +
      (t.length
        ? t.map(function (x) {
            return '<div class="log" data-tk="' + esc(x.naam) + '|' + esc(x.rol) + '"><b>' + esc(x.naam) + '</b> &middot; ' +
              esc(x.rol) + (x.onafhankelijk ? ' &middot; <span class="pil ok">onafhankelijk</span>' : '') +
              ' <button class="knop stil" data-tkweg type="button" style="font-size:.7rem;padding:.15rem .5rem;">verwijderen</button></div>';
          }).join('')
        : '<div class="gebrek">Nog niemand. Zolang dit register leeg is, kan in dit lab niets ondertekend worden ' +
          'en komt geen enkel onderzoek voorbij de deelnemersstap. Dit is dus de eerste stap.</div>') +
      '<div class="rij" style="margin-top:.4rem;">' +
        '<input class="veld" data-tknaam placeholder="Naam" maxlength="80">' +
        '<select class="veld" data-tkrol aria-label="Rol" style="max-width:12rem;">' +
          KADER.rollen.filter(function (r) { return ROLLEN_TEKENEN.indexOf(r.rol) >= 0; })
            .map(function (r) { return '<option value="' + esc(r.rol) + '">' + esc(r.naam) + '</option>'; }).join('') +
        '</select>' +
        '<label class="chip"><input type="checkbox" data-tkonaf> onafhankelijk</label>' +
        '<button class="knop" data-tkbij type="button">Voeg toe</button></div>' +
      '<div class="leeg">Bij risicoklasse hoog tekenen er twee, waarvan minstens één onafhankelijk. ' +
        'Alleen een toezichthouder kan een onderzoek stilleggen.</div>' +

      '<div class="sec" style="margin-top:1rem;">Budget en partners</div>' +
      '<div class="rij">' +
        '<input class="veld" data-btoeg type="number" min="0" placeholder="toegekend" value="' + ((lab.budget || {}).toegekend || 0) + '">' +
        '<input class="veld" data-bbest type="number" min="0" placeholder="besteed" value="' + ((lab.budget || {}).besteed || 0) + '">' +
        '<input class="veld" data-bbron placeholder="bron" maxlength="120" value="' + esc((lab.budget || {}).bron || '') + '">' +
        '<button class="knop stil" data-budzet type="button">Vastleggen</button></div>' +
      ((lab.partners || []).length
        ? lab.partners.map(function (p) { return '<div class="log">' + esc(p.naam) + ' &middot; ' + esc(p.soort) + '</div>'; }).join('')
        : '<div class="leeg">Nog geen partners.</div>') +
      '<div class="rij" style="margin-top:.35rem;">' +
        '<input class="veld" data-pnaam placeholder="Partner" maxlength="80">' +
        '<input class="veld" data-psoort placeholder="soort" maxlength="40" style="max-width:9rem;">' +
        '<button class="knop stil" data-pbij type="button">Voeg toe</button></div>' +

      '<div class="sec" style="margin-top:1rem;">Bewaartermijn</div>' +
      '<div class="rij"><input class="veld" data-bewaar type="number" min="0" value="' + (lab.bewaarMaanden || 0) + '" style="max-width:8rem;">' +
        '<button class="knop stil" data-bewaarzet type="button">Zet bewaartermijn (maanden)</button></div>' +
      '<div class="leeg">De RTF-ondergrens is ' + (KADER.bewaar.min) + ' maanden; daar kan een lab lokaal niet onder. ' +
        'Na die termijn verliezen studies hun ruwe data maar houden ze hun conclusies.</div>' +

      '<div class="sec" style="margin-top:1rem;">Auditspoor</div>' +
      '<button class="knop stil" data-audit type="button">Toon de laatste honderd handelingen</button>' +
      '<div data-auditlijst></div>';

    bind(doel, lab);
  }

  function bind(el, lab) {
    var q = function (s) { return el.querySelector(s); };
    var w = function (s) { return q(s) ? q(s).value : ''; };
    var na = function (belofte) {
      return belofte.then(function () { return herlaad(); })
        .then(function () { teken(el); }).catch(function (e) { meld(e.message); });
    };

    q('[data-tkbij]').addEventListener('click', function () {
      na(api('lab/tekenaar', { id: lab.id, naam: w('[data-tknaam]'), rol: w('[data-tkrol]'),
        onafhankelijk: q('[data-tkonaf]').checked }));
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-tkweg]'), function (b) {
      b.addEventListener('click', function () {
        var stuk = b.closest('[data-tk]').dataset.tk.split('|');
        na(api('lab/tekenaar', { id: lab.id, naam: stuk[0], rol: stuk[1], weg: true }));
      });
    });
    q('[data-budzet]').addEventListener('click', function () {
      na(api('lab/budget', { id: lab.id, toegekend: w('[data-btoeg]'), besteed: w('[data-bbest]'), bron: w('[data-bbron]') }));
    });
    q('[data-pbij]').addEventListener('click', function () {
      na(api('lab/partner', { id: lab.id, naam: w('[data-pnaam]'), soort: w('[data-psoort]') }));
    });
    q('[data-bewaarzet]').addEventListener('click', function () {
      na(api('lab/zet', { id: lab.id, bewaarMaanden: w('[data-bewaar]') }));
    });
    q('[data-audit]').addEventListener('click', function () {
      api('lab/audit', { id: lab.id, max: 100 }).then(function (r) {
        q('[data-auditlijst]').innerHTML = r.regels.length
          ? r.regels.map(function (a) {
              return '<div class="log">' + esc(String(a.at).slice(0, 16).replace('T', ' ')) + ' &middot; <b>' +
                esc(a.wat) + '</b> door ' + esc(a.wie) + (a.detail ? ' &middot; ' + esc(a.detail) : '') + '</div>';
            }).join('')
          : '<div class="leeg">Nog niets vastgelegd.</div>';
      }).catch(function (e) { meld(e.message); });
    });
  }

  window.LivingLabBeheer = { init: init, teken: teken };
})();
