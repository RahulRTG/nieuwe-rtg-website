/* RTG School Partner: de toets als meetinstrument.

   VOORAF. U kiest leerdoelen en een aantal vragen, en ziet wat die toets
   werkelijk meet: dekking per doel, vraagvorm, overlap, de verwachte tijd, en
   de taalbelasting van de opgaven zelf. Er wordt NIETS aan uw toets veranderd
   -- dit is een keuring en geen bouwer, en elke opmerking zegt wat het kost om
   hem te verhelpen. U beslist.

   ACHTERAF. Per leerdoel hoe het ging en of het onderscheid maakte tussen wie
   de stof beheerst en wie niet. Dat gaat over de TOETS: er staan geen
   leerlingen in, en onder de vijf gemaakte toetsen staat er niets, want dan is
   het getal in feite de uitslag van die paar kinderen met een ander etiket.

   Zelfde SPart-patroon; app.js roept SPart.toetskeuring() aan. */
window.SPart = window.SPart || {};
window.SPart.toetskeuring = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var q = function (id) { return document.getElementById(id); };

  function vooraf() {
    var vak = q('keurVorm');
    if (!vak) return;
    vak.innerHTML =
      '<div class="rij">' +
      '<input class="veld" id="kvDoelen" maxlength="300" placeholder="Leerdoelen, gescheiden door komma s" aria-label="Leerdoelen">' +
      '<input class="veld" id="kvPer" type="number" min="1" max="20" value="3" aria-label="Vragen per leerdoel" style="max-width:6rem;">' +
      '<button class="knop" id="kvKeur" type="button">Wat meet dit</button></div>' +
      '<div id="kvUit" class="stil" style="margin-top:.5rem;"></div>';
    q('kvKeur').addEventListener('click', function () {
      var doelen = q('kvDoelen').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!doelen.length) return meld('Kies de leerdoelen die u wilt meten.');
      kl('/school/toets/keuring', { doelen: doelen, perDoel: Number(q('kvPer').value) || 3 })
        .then(function (r) {
          if (r.body.error) return meld(r.body.error);
          var d = r.body;
          q('kvUit').innerHTML =
            '<div><b>' + d.aantalVragen + ' vragen, naar schatting ' + d.minuten + ' minuten.</b> ' + esc(d.oordeel) + '</div>' +
            d.perDoel.map(function (p) {
              return '<div class="item"><span><b>' + esc(p.naam) + '</b> <span class="stil">' + esc(p.vak) +
                ' &middot; ' + p.vragen + ' vragen &middot; ' + esc(p.vorm) + '</span><br><span class="stil">' + esc(p.meet) + '</span></span></div>';
            }).join('') +
            (d.opmerkingen.length
              ? '<div style="margin-top:.4rem;"><b>Wat er aan te merken valt:</b><br>' + d.opmerkingen.map(function (x) {
                  return '&bull; ' + esc(x.wat) + ' <span class="stil">' + esc(x.wat_nu) + '</span>';
                }).join('<br>') + '</div>'
              : '') +
            '<div class="stil" style="margin-top:.4rem;">' + esc(d.uitleg) + '</div>';
        });
    });
  }

  function achteraf() {
    var vak = q('spiegelVorm');
    if (!vak) return;
    kl('/school/toets/lijst').then(function (r) {
      var t = (r.body && r.body.toetsen) || [];
      if (!t.length) { vak.innerHTML = '<p class="stil">Er staat nog geen toets klaar.</p>'; return; }
      vak.innerHTML = '<div class="rij"><select class="veld" id="spKies" aria-label="Welke toets">' +
        t.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.naam) + '</option>'; }).join('') +
        '</select><button class="knop" id="spToon" type="button">Hoe deed de toets het</button></div>' +
        '<div id="spUit" class="stil" style="margin-top:.5rem;"></div>';
      q('spToon').addEventListener('click', function () {
        kl('/school/toets/spiegel', { toetsId: q('spKies').value }).then(function (r2) {
          var d = r2.body;
          if (d.error) return meld(d.error);
          if (!d.genoeg) { q('spUit').textContent = d.uitleg; return; }
          q('spUit').innerHTML = '<div class="stil">' + d.gemaakt + ' keer gemaakt</div>' +
            d.perDoel.map(function (p) {
              return '<div class="item" style="align-items:flex-start;"><span><b>' + esc(p.naam) + '</b> ' +
                '<span class="stil">' + Math.round(p.goedDeel * 100) + '% goed' +
                (p.onderscheid === null ? '' : ' &middot; onderscheid ' + p.onderscheid) + '</span>' +
                p.let_op.map(function (l) { return '<br><span class="stil">' + esc(l.wat) + ' ' + esc(l.wat_nu) + '</span>'; }).join('') +
                '</span></div>';
            }).join('') + '<p class="stil">' + esc(d.uitleg) + '</p>';
        });
      });
    });
  }

  vooraf();
  achteraf();
};
