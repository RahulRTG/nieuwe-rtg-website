/* de ongelezen-teller */
      telOngelezen(el);
    }
  };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function telOngelezen(el) {
    var s = lees(); if (!s) return;
    fetch('/api/foundation/gezin/' + s.code + '/mij', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (!d) return; var t = el.querySelector('#sbTel'); if (d.ongelezen > 0) { t.textContent = d.ongelezen; t.hidden = false; } else t.hidden = true; })
      .catch(function () {});
  }
  function laadBerichten(el) {
    var s = lees(); var box = el.querySelector('#sbBerichten');
    box.innerHTML = '<div class="sb-leeg">Berichten laden...</div>';
    fetch('/api/foundation/gezin/' + s.code + '/berichten', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lijst = (d.berichten || []);
        if (!lijst.length) { box.innerHTML = '<div class="sb-leeg">Nog geen berichten. Je gezin kan hier iets achterlaten.</div>'; return; }
        box.innerHTML = lijst.map(function (b) {
          var extra = b.soort === 'reis' ? '<a class="sb-reisknop" href="reis.html">Naar de reis</a>' : '';
          var kop = b.soort === 'hulp' ? '<div class="sb-hulplabel">SOS Vraagt om hulp</div>' : '';
          var wie = b.vanMij ? 'Jij' : esc(b.vanNaam);
          var aan = b.naar === 'allen' ? '' : '<span class="sb-aan"> aan ' + esc(b.naarNaam) + '</span>';
          return '<div class="sb-b ' + (b.soort || '') + '">' + kop + '<div class="sb-bkop">' + (b.vanAvatar || '') + ' <b>' + wie + '</b>' + aan + '</div><div class="sb-btxt">' + esc(b.tekst) + '</div>' + extra + '</div>';
        }).join('');
        api('/gezin/bericht/gelezen', { code: s.code, token: s.token }).then(function () { var t = el.querySelector('#sbTel'); if (t) t.hidden = true; }).catch(function () {});
      }).catch(function () { box.innerHTML = '<div class="sb-leeg">Kon berichten niet laden.</div>'; });
  }
  var cssGedaan = false;
  function injectCss() {
    if (cssGedaan) return; cssGedaan = true;
    var css = '.sb-balk{display:flex;align-items:center;gap:.6rem;padding:.6rem 1rem;border-bottom:1px solid var(--lijn);position:relative;}' +
      '.sb-brand{font-family:var(--serif);font-weight:500;background:#7F1634;color:#fff;padding:.18rem .6rem .22rem;border-radius:4px;}.sb-brand b{color:#F4E9C8;}' +
      '.sb-terug{color:var(--zacht);text-decoration:none;font-size:.85rem;}' +
      '.sb-bel{margin-left:auto;background:transparent;color:var(--txt);font-size:1.15rem;position:relative;line-height:1;padding:.2rem;}' +
      '.sb-bel .rtg-glyf{width:1.15rem;height:1.15rem;display:block;}' +
      '.sb-tel{position:absolute;top:-4px;right:-6px;background:var(--rood);color:#fff;font-size:.62rem;font-weight:700;border-radius:999px;min-width:1.1rem;height:1.1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 3px;}' +
      '.sb-tel[hidden]{display:none;}' +
      '.sb-prof{display:flex;align-items:center;gap:.45rem;background:transparent;color:var(--txt);}' +
      '.sb-av{width:1.8rem;height:1.8rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;}' +
      '.sb-nm{font-size:.9rem;font-weight:600;max-width:7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      /* Op een telefoon is je eigen naam naast je eigen avatar geen informatie
         maar breedte: hij kostte 62 punten in een balk die er 390 heeft, en
         duwde daarmee een andere actie naar de tweede rij. De avatar zegt
         hetzelfde. Vanaf een tablet is er ruimte en staat hij er weer. */
      '@media (max-width:640px){.sb-nm{display:none;}}' +
      '.sb-menu{position:absolute;top:100%;right:1rem;z-index:40;background:var(--paneel);border:1px solid var(--lijn);border-radius:12px;padding:.4rem;display:flex;flex-direction:column;min-width:12rem;box-shadow:0 12px 30px rgba(0,0,0,.5);}' +
      '.sb-menu[hidden],.sb-berichten[hidden]{display:none;}' +
      '.sb-menu a{color:var(--txt);text-decoration:none;padding:.6rem .7rem;border-radius:8px;font-size:.9rem;}.sb-menu a:hover{background:var(--paneel2);color:var(--goud);}' +
      '.sb-berichten{position:absolute;top:100%;right:1rem;z-index:40;background:var(--paneel);border:1px solid var(--lijn);border-radius:12px;padding:.5rem;width:min(92vw,22rem);max-height:70vh;overflow:auto;box-shadow:0 12px 30px rgba(0,0,0,.5);}' +
      '.sb-leeg{color:var(--zacht);font-size:.85rem;padding:.8rem;text-align:center;}' +
      '.sb-b{padding:.6rem .7rem;border-radius:10px;background:var(--paneel2);margin-bottom:.4rem;}' +
      '.sb-b.reis{border:1px solid var(--goud);}' +
      '.sb-b.hulp{border:1px solid var(--rood);background:#2a1512;}' +
      '.sb-hulplabel{color:#e88;font-weight:700;font-size:.78rem;margin-bottom:.25rem;}' +
      '.sb-bkop{font-size:.78rem;color:var(--zacht);margin-bottom:.2rem;}.sb-bkop b{color:var(--txt);}' +
      '.sb-btxt{font-size:.92rem;line-height:1.4;white-space:pre-wrap;}' +
      '.sb-reisknop{display:inline-block;margin-top:.5rem;background:var(--goud);color:#1a1710;font-weight:700;font-size:.82rem;text-decoration:none;padding:.35rem .7rem;border-radius:8px;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }
  w.Sessie = Sessie;
  /* Draait meteen wanneer sessie.js wordt gelezen, dus nog voordat de pagina
     bruikbaar wordt. De server beslist; bij storing blijft de deur dicht. */
  controleerToegang();
})(window);
