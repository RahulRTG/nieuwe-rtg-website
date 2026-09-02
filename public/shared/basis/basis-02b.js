/* Vervolg van basis-02: de hulplaag van de app-gids, plus de afsluiting van
   start() en van de omhulling. Geknipt omdat basis-02.js met 15,6 KB over de
   grens van keuringsregel 13 ging; de delen worden rauw aaneengeplakt op
   alfabet, dus dit bestand begint en eindigt midden in een scope. Zelfde vorm
   als de knip tussen basis-01, -01b en -01c.

   WAT HIER STAAT is de ledenkant van RTG Service: wat er klaarstaat om te
   bevestigen, welke zaken er lopen, iets melden, en de knop die er niet was --
   "ik wil een mens". Zie server/kern/service/mens.js voor waarom die knop een
   contract is en geen beleefdheid. */
    /* ---- 4b. HULP, IN DEZELFDE LA ALS DE UITLEG ----

       WAAROM HIER EN NIET IN EEN EIGEN APP. Hulp is Core (WERELDEN.md): hij
       zit in elke doelgroep en reist met de mens mee, dus hij hoort niet in een
       wereld en al helemaal niet in een 84e app. PLATFORM.md par. 0 telt apps,
       en een los /apps/hulp.html zou er een zijn die niets eigen bezit. Deze la
       staat al op elk scherm, en dat is precies wat een servicevoordeur nodig
       heeft.

       EN HIJ WEET WAAR JE STOND. Dat is het punt van RTG Service: wie vanuit een
       betaling om hulp vraagt, hoeft niet te horen "waarmee kunnen wij u
       helpen?" terwijl het systeem al weet welk scherm hij openhad. Het pad
       reist mee als VERWIJZING (soort plus code) en niet als gegevens; de server
       gooit al het andere weg (kern/service/zaak.js).

       DRIE DINGEN DIE DEZE LAAG NIET DOET:
       - hij verschijnt niet zonder lid-token. Zonder account is er geen kanaal
         om iemand terug te bereiken, en een knop die een wachtrij vult waar
         niemand uit komt is erger dan geen knop;
       - hij toont niemand een bevestigingscode die er niet om vroeg: die komt
         uit /api/service/bevestigingen en dus uit de eigen sessie;
       - hij zwijgt bij een storing. Deze la is de UITLEG van een scherm; loopt
         de servicelaag niet, dan hoort die uitleg gewoon te blijven werken. */
    function tok() { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } }
    function svc(pad, lijf) {
      var t = tok();
      if (!t) return Promise.reject(new Error('geen lid'));
      return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(lijf || {}) }).then(function (r) { return r.json(); });
    }
    function el(soort, klasse, tekst) {
      var n = document.createElement(soort);
      if (klasse) n.className = klasse;
      if (tekst != null) n.textContent = tekst;
      return n;
    }
    function knop(klasse, tekst, doe) {
      var b = el('button', klasse, tekst);
      b.type = 'button';
      b.addEventListener('click', doe);
      return b;
    }
    function hulplaag() {
      if (!tok() || !sheet) return;
      var blok = el('div', 'bss-hulp');
      blok.appendChild(el('b', null, 'Hulp nodig?'));
      sheet.appendChild(blok);
      Promise.all([
        svc('/api/service/bevestigingen').catch(function () { return null; }),
        svc('/api/service/mijn').catch(function () { return null; })
      ]).then(function (uit) { teken(blok, uit[0], uit[1]); })
        .catch(function () { blok.remove(); });
    }

    function teken(blok, verzoeken, mijn) {
      if (!sheet || !blok.isConnected) return;
      /* HET VERZOEK OM EEN BEVESTIGING GAAT VOOR. Er zit een medewerker aan de
         telefoon te wachten; al het andere kan wachten. */
      ((verzoeken && verzoeken.verzoeken) || []).forEach(function (v) {
        var z = el('div', 'bss-zaak');
        z.appendChild(el('i', null, v.mens + ' vraagt toegang'));
        z.appendChild(el('p', null, v.reden));
        z.appendChild(el('p', null, 'Opent: ' + v.capabilities.join(', ') + '. Zaak ' + v.zaak + '.'));
        var rij = el('div', 'bss-rij');
        rij.appendChild(knop('bss-ja', 'Bevestigen', function () {
          svc('/api/service/bevestig', { id: v.id }).then(function () { z.textContent = 'Bevestigd.'; });
        }));
        rij.appendChild(knop(null, 'Nee', function () {
          svc('/api/service/weiger', { id: v.id }).then(function () { z.textContent = 'Geweigerd.'; });
        }));
        z.appendChild(rij);
        z.appendChild(el('p', null, 'Of lees de code voor: ' + (v.code || '?') +
          ' (' + v.minuten + ' minuten, een keer).'));
        blok.appendChild(z);
      });

      var lopend = ((mijn && mijn.zaken) || []).filter(function (z) {
        return z.stand !== 'opgelost' && z.stand !== 'gesloten';
      });
      lopend.slice(0, 3).forEach(function (z) {
        var r = el('div', 'bss-zaak');
        r.appendChild(el('i', null, z.id + ' / ' + z.standNaam));
        r.appendChild(el('p', null, z.titel));
        blok.appendChild(r);
      });

      var rij = el('div', 'bss-rij');
      rij.appendChild(knop(null, lopend.length ? 'Nog iets melden' : 'Iets melden', function () { meldForm(blok); }));
      /* "IK WIL EEN MENS", en dit is de knop die er niet was. Een lid kon wel
         geholpen worden en niet zelf om een mens vragen; kern/service/mens.js
         legt uit waarom dat twee verschillende dingen waren. */
      if (lopend.length) {
        rij.appendChild(knop(null, 'Ik wil een mens', function () {
          svc('/api/service/mens', { id: lopend[0].id }).then(function (d) {
            rij.replaceWith(el('p', null, (d && d.let) || 'Doorgezet.'));
          });
        }));
      }
      blok.appendChild(rij);
    }

    /* Het formulier is met opzet EEN veld. Een melder die eerst een categorie,
       een prioriteit en een subonderwerp moet kiezen, kiest ze verkeerd, en de
       routering leest ze toch liever uit wat hij typt plus waar hij stond
       (kern/service/router.js). */
    function meldForm(blok) {
      var f = el('div', 'bss-zaak');
      var veld = el('textarea', 'bss-veld');
      veld.rows = 3;
      veld.setAttribute('aria-label', 'Wat is er aan de hand?');
      veld.placeholder = 'Wat is er aan de hand?';
      f.appendChild(veld);
      f.appendChild(knop('bss-ja', 'Versturen', function () {
        var t = String(veld.value || '').trim();
        if (t.length < 3) { veld.focus(); return; }
        svc('/api/service/open', { titel: t.slice(0, 110), tekst: t,
          betrokken: { soort: 'scherm', code: location.pathname } })
          .then(function (d) {
            f.textContent = (d && d.zaak)
              ? 'Genoteerd als ' + d.zaak.id + '. U hoort van ons.'
              : ((d && d.error) || 'Er ging iets mis.');
          });
      }));
      blok.appendChild(f);
      veld.focus();
    }

    window.RTGGids = { open: openGids, sluit: sluit };
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') sluit(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
