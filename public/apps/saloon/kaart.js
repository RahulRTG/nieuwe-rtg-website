(function (w) {
  'use strict';
  w.RTGSaloonKaart = function (k, i, esc, bewaar, host) {
    k.dataset.saloonId = i.id;
    k.classList.add('saloon-verhaal');
    var kop = document.createElement('header'); kop.className = 'saloon-verhaalkop';
    var lint = document.createElement('p'); lint.className = 'saloon-bronlint';
    lint.textContent = (i.herkomst && i.herkomst.naam || i.uitgever || i.bronGroep) + (i.bronGroep === 'nieuws' ? ' · Journalistiek' : '');
    kop.appendChild(lint);
    if (i.titel) { var h = document.createElement('h3'); h.textContent = i.titel; kop.appendChild(h); }
    kop.appendChild(k.querySelector('.living-post-head'));
    k.querySelector('.living-post-copy').before(kop);
    var b = document.createElement('button'); b.type = 'button'; b.dataset.bewaar = '';
    b.textContent = i.bewaard ? 'Bewaard' : 'Bewaren'; b.setAttribute('aria-pressed', String(i.bewaard));
    b.addEventListener('click', function () { b.disabled = true; bewaar().catch(function () {}).finally(function () { b.disabled = false; }); });
    k.querySelector('.acties').appendChild(b);
    var open = k.querySelector('[data-open]');
    if (open && i.url) {
      open.removeAttribute('data-open'); open.textContent = i.actie || 'Open bericht';
      open.addEventListener('click', function () {
        if (i.artikel) host.openArtikel(i);
        else location.href = i.url;
      });
    } else if (open && !i.open) open.remove();
    if (i.bronGroep !== 'sociaal') {
      k.querySelectorAll('[data-chat],.tel').forEach(function (e) { e.remove(); });
    }
    if (i.volgMaker) {
      var volg = document.createElement('button'); volg.type = 'button'; volg.dataset.volgMaker = i.volgMaker;
      volg.textContent = i.volgIk ? 'Maker ontvolgen' : 'Maker gratis volgen';
      volg.setAttribute('aria-pressed', String(i.volgIk));
      volg.onclick = function () {
        volg.disabled = true;
        w.RTGSaloonActies.volgMaker(i).then(function () { host.laad(); })
          .catch(function (e) { host.fout(e.message); volg.disabled = false; });
      };
      k.querySelector('.acties').appendChild(volg);
    }
    if (i.bron === 'salon') {
      var reageer = document.createElement('button'); reageer.type = 'button'; reageer.textContent = 'Reacties';
      reageer.onclick = function () { w.RTGSaloonActies.reacties(i, host); };
      k.querySelector('.acties').appendChild(reageer);
    }
    if (i.bronActies && w.RTGAanvraagEdge) {
      k.tabIndex = 0;
      w.RTGAanvraagEdge(k, { id: i.id, wat: i.titel, acties: i.bronActies.map(function (x) {
        return { id: x.id, label: x.label + ' in Mijn Mall' };
      }) }, function () { location.href = i.url; });
    }
    var d = document.createElement('details'); d.className = 'saloon-herkomst';
    var bron = i.herkomst || {};
    d.innerHTML = '<summary>Bron en samenhang' + (i.prive ? ' · privé' : '') + '</summary><p>'
      + esc(bron.naam) + ' · ' + esc(bron.zicht) + '</p><p>' + esc(i.waarom) + '</p>'
      + (bron.gewijzigd ? '<p>Bron bijgewerkt: <time>' + esc(new Date(bron.gewijzigd).toLocaleString()) + '</time></p>' : '')
      + (i.verbanden || []).filter(function (v) { return v.url; }).map(function (v) {
        return '<a href="' + esc(v.url) + '">' + esc(v.relatie) + ': ' + esc(v.titel) + '</a>';
      }).join('');
    k.appendChild(d);
    var media = i.beeld && i.beeld[0], figure = k.querySelector('.living-post-media');
    if (figure && media && media.type === 'video') {
      // Zelfde speler en ondertitelband als bij de bronpublicatie.
      var img = figure.querySelector('img'), src = img && img.src;
      if (src) {
        figure.textContent = ''; var video = document.createElement('video');
        video.src = src; video.controls = true; video.playsInline = true; video.preload = 'metadata';
        video.setAttribute('aria-label', media.alt || 'Video uit Saloon'); figure.appendChild(video);
        w.RTGOndertitelband.zet(figure, video, media.ondertitels || []);
      }
    }
  };
}(window));
