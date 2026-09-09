(function (w) {
  'use strict';
  function veilig(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initialen(v) {
    var naam = String(v || 'RTG').split('@')[0].replace(/[^a-z0-9]+/gi, ' ').trim();
    var delen = naam.split(/\s+/).filter(Boolean);
    return (delen.length > 1 ? delen[0][0] + delen[delen.length - 1][0] : naam.slice(0, 2)).toUpperCase() || 'RTG';
  }
  function tijd(v) {
    if (!v) return 'Geen tijd';
    var x = new Date(v);
    if (!Number.isFinite(x.getTime())) return String(v);
    var nu = new Date();
    if (x.toDateString() === nu.toDateString()) return x.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
  function teken(root, draad, samenvatting, acties, bericht, adres) {
    var berichten = Array.isArray(draad.berichten) ? draad.berichten : [];
    var huidig = bericht || berichten[berichten.length - 1] || {};
    var deelnemers = samenvatting && Array.isArray(samenvatting.deelnemers) ? samenvatting.deelnemers : berichten.reduce(function (acc, b) {
      [b.van, b.naar].forEach(function (naam) { if (naam && acc.indexOf(naam) < 0) acc.push(naam); });
      return acc;
    }, []);
    root.querySelector('#rtmGesprekMeta').textContent = berichten.length + (berichten.length === 1 ? ' bericht' : ' berichten') + (samenvatting && samenvatting.aanZet ? ' · aan zet: ' + samenvatting.aanZet : '');
    root.querySelector('#rtmGesprekMensen').innerHTML = deelnemers.slice(0, 3).map(function (naam) {
      return '<span class="rtm-mini" title="' + veilig(naam) + '">' + veilig(initialen(naam)) + '</span>';
    }).join('');
    root.querySelector('#rtmGesprekOnderwerp').textContent = huidig.onderwerp || 'Gesprek';
    root.querySelector('#rtmDraad').innerHTML = berichten.length ? berichten.slice(-8).map(function (b) {
      var vanMij = adres && String(b.van || '').toLowerCase() === String(adres).toLowerCase();
      return '<article class="rtm-bubbel' + (vanMij ? ' ik' : '') + '"><div class="rtm-bubbelkop"><b>' + veilig(b.van || 'Onbekend') + '</b><time>' + veilig(tijd(b.at)) + '</time></div><p>' + veilig(b.tekst || '') + '</p></article>';
    }).join('') : '<div class="rtm-leeg">Dit gesprek bevat geen leesbare berichten.</div>';
    var samenvattingTekst = samenvatting && samenvatting.aantal
      ? samenvatting.aantal + ' berichten met ' + samenvatting.deelnemers.length + ' deelnemer(s). ' + (samenvatting.aanZet === 'u' ? 'De volgende reactie ligt bij u.' : 'De volgende reactie ligt bij de ander.')
      : 'De samenvatting blijft dicht bij de oorspronkelijke berichten en verzint geen conclusie.';
    var actieLijst = acties && Array.isArray(acties.acties) ? acties.acties.slice(0, 4) : [];
    root.querySelector('#rtmGesprekHulp').innerHTML = '<b>In één oogopslag</b><p>' + veilig(samenvattingTekst) + '</p>' +
      (actieLijst.length ? '<div class="rtm-actiepunten">' + actieLijst.map(function (a) { return '<div class="rtm-actiepunt">' + veilig(a.zin) + '</div>'; }).join('') + '</div>' : '<div class="rtm-bronnoot">Geen duidelijke actiezin gevonden. Liever niets dan verzonnen werk.</div>') +
      '<div class="rtm-bronnoot">Elk inzicht is terug te voeren op het oorspronkelijke gesprek.</div>';
  }
  async function open(root, mail, bericht, adres) {
    root.querySelector('#rtmGesprekOnderwerp').textContent = bericht.onderwerp || 'Gesprek';
    root.querySelector('#rtmDraad').innerHTML = '<div class="rtm-leeg">Gesprek en herkomst laden…</div>';
    root.querySelector('#rtmGesprekHulp').innerHTML = '<b>In één oogopslag</b><p>De brongebonden samenvatting wordt geladen.</p>';
    try {
      var resultaten = await Promise.all([
        mail.api('draad', { id: bericht.id }),
        mail.api('hulp', { id: bericht.id, wat: 'samenvatting' }).catch(function () { return null; }),
        mail.api('hulp', { id: bericht.id, wat: 'acties' }).catch(function () { return null; })
      ]);
      teken(root, resultaten[0], resultaten[1], resultaten[2], bericht, adres);
    } catch (e) {
      root.querySelector('#rtmDraad').innerHTML = '<div class="rtm-leeg">' + veilig(e && e.message ? e.message : 'Het gesprek kon niet worden geladen.') + '</div>';
    }
  }
  w.RTGMailGesprek = Object.freeze({ open: open });
}(window));
