/* The same crop editor serves desktop and touch; native dialog traps focus. */
(function (w, d) {
  'use strict';
  var dialog, trigger;
  function node(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function close() { if (!dialog) return; dialog.close(); dialog.remove(); dialog = null; delete d.body.dataset.imageEditor; if (trigger && trigger.isConnected) trigger.focus(); }
  function open(id) {
    close(); trigger = d.activeElement;
    var P = w.RTGPersonalImages, all = P.list(); if (!all.length) return;
    var busy = false;
    dialog = node('dialog', 'pi-editor'); var active = dialog; dialog.setAttribute('aria-labelledby', 'piTitle');
    var current = all.find(function (r) { return r.id === id; }) || all[0], draft, src, view = w.innerWidth < 1000 ? 'mobile' : 'desktop', revision = 0;
    var head = node('header', 'pi-head'), title = node('h2', '', 'Uw eigen beelden'); title.id = 'piTitle'; head.appendChild(title);
    var exit = button('Sluiten', close); head.appendChild(exit);
    var content = node('div', 'pi-content'), picker = node('select', 'pi-slots'); picker.setAttribute('aria-label', 'Beeldplek');
    all.forEach(function (r) { var opt = node('option', '', r.label); opt.value = r.id; picker.appendChild(opt); });
    var main = node('div', 'pi-main'), tools = node('div', 'pi-tools'), mine = button('Mijn foto’s', loadFiles), defaults = button('RTG-beeld', restore);
    var upload = node('input'); upload.type = 'file'; upload.accept = 'image/jpeg,image/png,image/webp'; upload.id = 'piUpload'; upload.hidden = true;
    var uploadButton = button('Upload foto', function () { upload.click(); }); tools.append(mine, defaults, uploadButton, upload);
    var crop = node('div', 'pi-crop'), img = node('img'); img.alt = 'Voorbeeld van uw uitsnede'; img.draggable = false; crop.appendChild(img);
    var note = node('p', 'pi-note', 'Versleep de foto of gebruik de schuifregelaars voor de uitsnede.');
    var sliders = node('div', 'pi-sliders'), inputs = {};
    [['zoom', 'Vergroten', 1, 3, .01], ['x', 'Horizontaal', 0, 100, 1], ['y', 'Verticaal', 0, 100, 1]].forEach(function (r) {
      var label = node('label', '', r[1]), input = node('input'); input.type = 'range'; input.min = r[2]; input.max = r[3]; input.step = r[4];
      input.oninput = function () { if (!draft) return; draft[view][r[0]] = Number(input.value); paint(); }; inputs[r[0]] = input; label.appendChild(input); sliders.appendChild(label);
    });
    var previews = node('div', 'pi-tools'), desktop = button('Desktop', function () { view = 'desktop'; paint(); }), mobile = button('Mobiel', function () { view = 'mobile'; paint(); }); previews.append(desktop, mobile);
    var gallery = node('div', 'pi-gallery'), status = node('p', 'pi-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    var restoreButton = button('Herstel RTG-beeld', restore);
    main.append(tools, crop, note, sliders, previews, gallery, restoreButton, status); content.append(picker, main);
    var foot = node('footer', 'pi-foot'), privacy = node('span', '', 'Alleen zichtbaar voor u'), cancel = button('Annuleren', close), save = button('Opslaan', function () {
      if (busy) return; busy = true; save.disabled = true; status.textContent = 'Opslaan…';
      P.save(current.id, draft).then(function () { if (dialog === active) close(); }).catch(function (e) { status.textContent = e.message; }).finally(function () { busy = false; save.disabled = !P.authenticated(); });
    }); save.className = 'pi-save'; foot.append(privacy, cancel, save); dialog.append(head, content, foot); d.body.appendChild(dialog);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    picker.onchange = function () { current = all.find(function (r) { return r.id === picker.value; }); choose(); };
    function button(label, run) { var b = node('button', '', label); b.type = 'button'; b.onclick = run; return b; }
    function paint() {
      img.src = src || current.original; crop.dataset.preview = view;
      var c = draft ? draft[view] : { x: 50, y: 50, zoom: 1 };
      img.style.objectPosition = c.x + '% ' + c.y + '%'; img.style.transform = 'scale(' + c.zoom + ')'; img.style.transformOrigin = c.x + '% ' + c.y + '%';
      Object.keys(inputs).forEach(function (key) { inputs[key].value = c[key]; inputs[key].disabled = !draft; });
      desktop.setAttribute('aria-pressed', String(view === 'desktop')); mobile.setAttribute('aria-pressed', String(view === 'mobile'));
    }
    function choose() {
      var seq = ++revision; picker.value = current.id; draft = P.choice(current.id); draft = draft ? JSON.parse(JSON.stringify(draft)) : null;
      src = current.original; paint(); if (draft) P.file(draft.file).then(function (url) { if (seq === revision) { src = url; paint(); } }).catch(function (e) { status.textContent = e.message; });
    }
    function restore() { revision++; draft = null; src = current.original; paint(); status.textContent = 'RTG-beeld gekozen. Kies Opslaan om dit te bevestigen.'; }
    function selectFile(file) {
      var seq = ++revision; status.textContent = 'Foto laden…';
      return P.file(file).then(function (url) { if (seq !== revision) return;
        src = url; draft = { file: file, desktop: { x: 50, y: 50, zoom: 1 }, mobile: { x: 50, y: 50, zoom: 1 } }; paint(); status.textContent = '';
      }).catch(function (e) { status.textContent = e.message; });
    }
    function loadFiles() {
      if (!P.authenticated()) { status.textContent = 'Log in met uw RTG-account om uw foto’s te gebruiken.'; return; }
      status.textContent = 'Uw foto’s laden…';
      P.api('/api/bestanden/mijn').then(function (j) {
        gallery.textContent = ''; var files = j.items.filter(function (f) { return f.vanMij && !f.weg && /^image\/(jpeg|png|webp|gif)$/.test(f.mime); });
        files.slice(0, 60).forEach(function (f) {
          var b = button(f.naam, function () { selectFile(f.id); }); gallery.appendChild(b);
          P.file(f.id).then(function (url) { var thumbnail = node('img'); thumbnail.src = url; thumbnail.alt = ''; b.prepend(thumbnail); }).catch(function () { b.disabled = true; });
        }); status.textContent = files.length ? '' : 'Nog geen eigen foto’s. Kies Upload foto.';
      }).catch(function (e) { status.textContent = e.message; });
    }
    upload.onchange = function () {
      var f = upload.files[0]; if (!f) return;
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) { status.textContent = 'Kies een JPG-, PNG- of WebP-foto van maximaal 15 MB.'; return; }
      uploadButton.disabled = true; save.disabled = true; status.textContent = 'Foto veilig uploaden…';
      w.RTGBestandUpload(f, function (action, body) { return P.api('/api/bestanden/' + action, body).then(function (j) { return { status: 200, body: j }; }); }, { chunkBytes: 3 * 1024 * 1024 }).then(function (j) { return selectFile(j.body.id); })
        .catch(function (e) { status.textContent = e.message; }).finally(function () { uploadButton.disabled = !P.authenticated(); save.disabled = !P.authenticated(); upload.value = ''; });
    };
    var drag;
    crop.onpointerdown = function (e) { if (!draft) return; drag = { x: e.clientX, y: e.clientY, cx: draft[view].x, cy: draft[view].y }; crop.setPointerCapture(e.pointerId); };
    crop.onpointermove = function (e) { if (!drag || !draft) return; draft[view].x = Math.max(0, Math.min(100, drag.cx - (e.clientX - drag.x) / crop.clientWidth * 100));
      draft[view].y = Math.max(0, Math.min(100, drag.cy - (e.clientY - drag.y) / crop.clientHeight * 100)); paint(); };
    crop.onpointerup = crop.onpointercancel = function () { drag = null; };
    choose(); save.disabled = !P.authenticated(); uploadButton.disabled = !P.authenticated();
    if (!P.authenticated()) status.textContent = 'Log in met uw RTG-account om persoonlijke beelden te bewaren.';
    d.body.dataset.imageEditor = 'open'; dialog.showModal();
  }
  w.RTGPersonalImageEditor = { open: open, close: close };
})(window, document);
