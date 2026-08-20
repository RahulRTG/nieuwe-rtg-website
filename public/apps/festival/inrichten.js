/* RTG Festival, het scherm: HET BLAD "INRICHTEN".

   Zonder dit blad bestond deze hele wereld alleen voor wie met curl overweg
   kan. Dat is de reden dat het er is, en meteen ook de maat ervan: het doet
   precies wat de kern kan en geen letter meer.

   HET TOONT WAT ER ECHT STAAT. Geen voorbeeldterrein, geen "typisch festival"
   dat alvast is ingevuld, geen suggesties. Wie hier drie plekken ziet, heeft er
   drie. Een scherm dat vast wat invult, maakt van een lege editie iets wat
   ingericht lijkt -- en dat is precies de tussenstand waarin iemand denkt dat
   het klaar is.

   DE STARTLIJST CONTROLS IS DE ENIGE UITZONDERING, en die zegt van zichzelf wat
   hij is: een begin, geen wet. Hij komt er alleen als iemand erop drukt.

   FOUTEN KOMEN VOLUIT IN BEELD. De kern geeft nette zinnen terug ("Deze zaak
   staat al als beveiliging", "Een bundel gaat tot 6 lagen diep"); die worden
   hier getoond zoals ze zijn. Een scherm dat er "er ging iets mis" van maakt,
   gooit het enige weg wat de gebruiker verder helpt. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var $ = function (s) { return document.querySelector(s); };
  var kop = $('#inrKop'), stil = $('#inrStil');
  var SOORTEN = ['terrein', 'zone', 'podium', 'camping', 'backstage', 'parking',
    'ingang', 'uitgang', 'hek', 'halte', 'bar', 'food', 'toilet', 'waterpunt',
    'locker', 'ehbo', 'magazijn', 'generator', 'camera', 'laadlos', 'route'];
  var ROLLEN = ['beveiliging', 'vervoer', 'horeca', 'techniek', 'zorg', 'schoonmaak'];

  function meld(t) { stil.textContent = t; }
  function vulKeuze(el, waarden, leeg) {
    el.textContent = '';
    if (leeg) { var o = document.createElement('option'); o.value = ''; o.textContent = leeg; el.appendChild(o); }
    waarden.forEach(function (w) {
      var opt = document.createElement('option');
      opt.value = w.value !== undefined ? w.value : w;
      opt.textContent = w.tekst !== undefined ? w.tekst : w;
      el.appendChild(opt);
    });
  }
  function regel(lijst, tekst, rechts) {
    var d = document.createElement('div');
    d.className = 'fp-regel';
    var s = document.createElement('span');
    s.textContent = tekst;
    d.appendChild(s);
    if (rechts) {
      var r = document.createElement('span');
      r.className = 'rek';
      r.textContent = rechts;
      d.appendChild(r);
    }
    lijst.appendChild(d);
  }

  /* Een aanroep die zijn fout LAAT ZIEN. Alles op dit blad loopt hierlangs, want
     een formulier dat stil faalt is erger dan een formulier dat weigert. */
  function doe(pad, body, daarna) {
    return F.api(pad, Object.assign({ festival: F.staat.fid, editie: F.staat.eid }, body))
      .then(function (r) {
        var b = r.body || {};
        if (!b.ok) { meld(b.error || 'Dat lukte niet.'); return null; }
        meld('Bijgewerkt.');
        if (daarna) daarna(b);
        return b;
      })
      .catch(function () { meld('Geen verbinding.'); return null; });
  }

  function tekenTerrein() {
    var lijst = $('#plekLijst');
    lijst.textContent = '';
    var ouders = F.staat.plekken.filter(function (p) { return !(p.rol && p.rol.poort); })
      .map(function (p) { return { value: p.id, tekst: p.naam }; });
    vulKeuze($('#plekOuder'), ouders, 'geen (dit is het terrein)');
    F.staat.plekken.forEach(function (p) {
      regel(lijst, p.naam + ' · ' + p.soort + (p.besloten ? ' · besloten' : ''),
        p.capaciteit ? p.veiligeCapaciteit + ' veilig van ' + p.capaciteit : 'geen capaciteit');
    });
  }

  function herlaadTerrein() {
    return F.api('/api/festival/terrein', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (t) {
        var plat = [];
        (function loop(k) { (k || []).forEach(function (x) { plat.push(x); loop(x.in); }); })(((t.body || {}).boom || []));
        F.staat.plekken = plat;
        tekenTerrein();
      });
  }

  function tekenDagen(dagen) {
    var lijst = $('#dagLijst');
    lijst.textContent = '';
    (dagen || []).forEach(function (d) {
      regel(lijst, d.datum, d.open + ' tot ' + d.sluit + (d.curfew ? ' · curfew ' + d.curfew : ''));
    });
  }

  function herlaadProducten() {
    return F.api('/api/festival/producten', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var lijst = $('#prodLijst');
        lijst.textContent = '';
        ((r.body || {}).producten || []).forEach(function (p) {
          regel(lijst, p.naam + ' · € ' + Number(p.prijs).toFixed(2).replace('.', ','),
            (p.ruimte === null ? 'geen grens' : p.ruimte + ' vrij')
            + ' · ' + p.rechten + ' recht(en)');
        });
      });
  }

  function herlaadPartners() {
    return F.api('/api/festival/partner/lijst', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var lijst = $('#prtLijst');
        lijst.textContent = '';
        ((r.body || {}).partners || []).forEach(function (p) {
          regel(lijst, p.zaak + ' · ' + p.rol,
            p.stand + ((p.deelt || []).length ? ' · deelt ' + p.deelt.length : ''));
        });
      });
  }

  function vulAlles() {
    var er = !!F.staat.fid;
    $('#inrStart').hidden = er;
    $('#inrRest').hidden = !er;
    if (!er) { kop.textContent = 'Een festival opzetten'; meld('Er staat nog geen festival op deze zaak.'); return; }
    kop.textContent = F.staat.naam;
    meld('Alles hieronder is van deze zaak. Wat er staat, staat er echt.');
    vulKeuze($('#plekSoort'), SOORTEN);
    vulKeuze($('#prtRol'), ROLLEN);
    tekenTerrein();
    tekenDagen(F.staat.dagen);
    herlaadProducten();
    herlaadPartners();
  }

  /* ---- de knoppen ---- */
  $('#inrBegin').addEventListener('click', function () {
    var naam = $('#inrNaam').value.trim(), jaar = parseInt($('#inrJaar').value, 10);
    if (!naam) { meld('Geef het festival een naam.'); return; }
    F.api('/api/festival/nieuw', { naam: naam }).then(function (r) {
      var b = r.body || {};
      if (!b.ok) { meld(b.error || 'Dat lukte niet.'); return; }
      return F.api('/api/festival/editie', { festival: b.festival.id, jaar: jaar || new Date().getUTCFullYear() })
        .then(function (e) {
          if (!(e.body || {}).ok) { meld(e.body.error || 'De editie lukte niet.'); return; }
          /* De SCHIL haalt opnieuw op, en dit blad niet: die houdt de staat en
             de tabbalk. Hier de velden zelf zetten zou een tweede waarheid
             maken die bij de eerste de beste verandering uit de pas loopt. */
          return F.herlaad().then(vulAlles);
        });
    });
  });

  $('#dagZet').addEventListener('click', function () {
    doe('/api/festival/dag', { datum: $('#dagDatum').value.trim(), open: $('#dagOpen').value.trim(),
      sluit: $('#dagSluit').value.trim(), curfew: $('#dagCurfew').value.trim() || null },
      function () { F.herlaad().then(function () { tekenDagen(F.staat.dagen); }); });
  });

  $('#plekZet').addEventListener('click', function () {
    doe('/api/festival/plek', { naam: $('#plekNaam').value.trim(), soort: $('#plekSoort').value,
      ouder: $('#plekOuder').value || null, capaciteit: $('#plekCap').value,
      veiligeCapaciteit: $('#plekVeilig').value, besloten: $('#plekBesloten').checked },
      function () { $('#plekNaam').value = ''; herlaadTerrein(); });
  });

  $('#prodZet').addEventListener('click', function () {
    var recht = $('#prodRecht').value.trim();
    doe('/api/festival/product', { naam: $('#prodNaam').value.trim(), prijs: $('#prodPrijs').value,
      voorraad: $('#prodVoorraad').value === '' ? null : $('#prodVoorraad').value,
      rechten: recht ? [{ soort: recht }] : [] },
      function () { $('#prodNaam').value = ''; herlaadProducten(); });
  });

  $('#ctlSeed').addEventListener('click', function () {
    doe('/api/festival/controls/seed', {}, function (b) { meld(b.aantal + ' controls klaargezet.'); });
  });

  $('#prtZet').addEventListener('click', function () {
    doe('/api/festival/partner', { rol: $('#prtRol').value, zaak: $('#prtZaak').value.trim() },
      function () { $('#prtZaak').value = ''; herlaadPartners(); });
  });

  F.opBlad('inrichten', vulAlles);
  F.opBlad('terrein', function () { if (!F.staat.fid) return; });
})();
