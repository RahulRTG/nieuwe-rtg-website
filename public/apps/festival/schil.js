/* RTG Festival, het scherm: DE SCHIL.

   De bank, het werkvlak en de tabbalk komen uit shared/reizen-veilig.css --
   dezelfde schil als RTG Geld en RTG Leven. Op een breed scherm staat de bank
   links, onder de 760px klapt hij naar een onderbalk. Dit bestand doet daar
   maar drie dingen aan: bladeren wisselen, de zaakpoort openen, en de gedeelde
   staat bijhouden.

   WAAROM DE STAAT HIER WOONT EN NIET PER BLAD. Poort en Beeld hebben allebei
   het festival, de editie, het terrein en de lopende dag nodig. Twee bladen die
   dat elk zelf ophalen, zijn twee waarheden die uit elkaar lopen zodra er een
   scan tussendoor komt (LAT-regel 4). Er is er dus een, en de bladen lezen hem.

   WAT DIT SCHERM NIET ZELF UITREKENT: welke dag het is. Een festivaldag loopt
   over middernacht heen; de server bepaalt dat (kern/festival/model.js,
   dagOpMoment). De schil leest de dag UIT het antwoord van de eerste geslaagde
   scan en niet uit zijn eigen klok.

   window.RTGFestival = { api, staat, opBlad, zetStand } */
(function () {
  'use strict';

  var token = null;
  try { token = localStorage.getItem('rtg_sup_token'); } catch (e) {}

  var staat = { fid: null, eid: null, dagId: null, dagDatum: null, naam: '', plekken: [], dagen: [] };
  var luisteraars = {};

  function api(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (b) { return { status: r.status, body: b }; });
    });
  }

  /* De ene leesbare zin in de tabbalk (kern/festival/index.js, festivalStand).
     Hij wordt op EEN plek gezet; een blad dat zijn eigen samenvatting maakt,
     laat twee cijfers over hetzelfde terrein rondlopen. */
  function zetStand() {
    var el = document.getElementById('fpStand');
    if (!el || !staat.dagId) return Promise.resolve(null);
    return api('/api/festival/stand', { festival: staat.fid, editie: staat.eid, dag: staat.dagId })
      .then(function (r) {
        var b = r.body || {};
        if (b.zin) el.textContent = b.zin;
        return b;
      })
      .catch(function () { return null; });
  }

  /* Bladeren wisselen. Op een smal scherm is precies een blad zichtbaar; op een
     breed scherm zou de schil er meer naast elkaar kunnen zetten, maar dat is de
     werkbladen-laag en die bestaat hier nog niet. Een blad tegelijk dus, en dat
     staat er zo omdat het anders een halve belofte is (LAT-regel 6). */
  function toonBlad(naam) {
    var knoppen = document.querySelectorAll('.rv-bank button');
    for (var i = 0; i < knoppen.length; i++) {
      knoppen[i].classList.toggle('actief', knoppen[i].getAttribute('data-blad') === naam);
    }
    var panes = document.querySelectorAll('.rv-pane');
    for (var j = 0; j < panes.length; j++) {
      var mijn = panes[j].id === 'blad' + naam.charAt(0).toUpperCase() + naam.slice(1);
      panes[j].hidden = !mijn;
      panes[j].classList.toggle('actief', mijn);
    }
    (luisteraars[naam] || []).forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function opBlad(naam, fn) {
    (luisteraars[naam] = luisteraars[naam] || []).push(fn);
  }

  function plat(knopen, uit) {
    (knopen || []).forEach(function (k) { uit.push(k); plat(k.in, uit); });
    return uit;
  }

  /* De zaakpoort. Zonder token of zonder festival heeft geen enkel blad iets te
     tonen, dus dat wordt EEN keer gezegd en niet drie keer half.

     HIJ IS HERLAADBAAR, en dat is geen luxe. Het blad Inrichten maakt een
     festival aan terwijl dit scherm al open staat; zonder een tweede ronde
     blijft de tabbalk "Nog geen festival ingericht" zeggen boven een festival
     dat er wel degelijk is. Elk blad dat de wereld verandert, roept dit aan. */
  function start() {
    var wie = document.getElementById('fpWie');
    if (!token) { if (wie) wie.textContent = 'Log eerst in op de zaak'; return Promise.resolve(); }

    return api('/api/festival/mijn', {}).then(function (r) {
      var f = ((r.body || {}).festivals || [])[0];
      var e = f && (f.edities || [])[0];
      if (!f || !e) { if (wie) wie.textContent = 'Nog geen festival ingericht'; return; }
      staat.fid = f.id; staat.eid = e.id; staat.naam = f.naam; staat.dagen = e.dagen || [];
      if (wie) wie.textContent = f.naam + ' · ' + e.jaar;
      return Promise.all([
        api('/api/festival/terrein', { festival: staat.fid, editie: staat.eid }),
        /* De lopende dag komt van de SERVER en niet uit de klok van dit
           toestel: een festivaldag loopt over middernacht heen. Zonder deze
           vraag kon het beeld pas iets tonen na een geslaagde scan in dezelfde
           sessie, en dat is geen eigenschap van een terrein maar van een
           browser. */
        api('/api/festival/dag/nu', { festival: staat.fid, editie: staat.eid })
      ]).then(function (uit) {
        staat.plekken = plat(((uit[0].body || {}).boom || []), []);
        var d = (uit[1].body || {}).dag;
        staat.dagId = d ? d.id : null;
        staat.dagDatum = d ? d.datum : null;
        zetStand();
        (luisteraars.terrein || []).forEach(function (fn) { try { fn(); } catch (err) {} });
        (luisteraars.poort || []).forEach(function (fn) { try { fn(); } catch (err) {} });
      });
    }).catch(function () { if (wie) wie.textContent = 'Geen verbinding'; });
  }

  document.addEventListener('click', function (ev) {
    var knop = ev.target.closest && ev.target.closest('.rv-bank button[data-blad]');
    if (!knop) return;
    toonBlad(knop.getAttribute('data-blad'));
  });

  /* DE GASTENKANT IS GEEN BLAD MAAR EEN PAGINA, en daarom staat hij hier en niet
     bij de bladen hierboven: hij heeft geen bank, geen tabs en geen gedeelde
     staat -- een gast heeft een kaartje en een dag. Wie inricht hoort wel te
     kunnen zien wat die gast dan ziet, anders is de gastenkant alleen te
     bereiken met de link uit een pas en staat hij nergens in het huis aan te
     tikken. */
  var gastKnop = document.getElementById('fpGast');
  if (gastKnop) gastKnop.addEventListener('click', function () {
    location.href = '/apps/festival-gast.html';
  });

  window.RTGFestival = { api: api, staat: staat, opBlad: opBlad, zetStand: zetStand,
    toonBlad: toonBlad, herlaad: start };
  start();
})();
