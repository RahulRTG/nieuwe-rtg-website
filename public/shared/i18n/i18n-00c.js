/* De SCHRIJVER van de automatische vertaallaag: tonen, herstellen, groeperen,
   opvragen en de taalwissel. Dit is de tweede helft van de IIFE die in
   i18n-00b.js opent -- de lezer daar bepaalt WAT vertaald mag worden en waar
   het staat, deze helft doet er iets mee. Ze delen hun toestand, en de bundel
   plakt ze terug aaneen tot een bestand (scripts/bundel.js). */
  function toon(st, vertaling) {
    if (taal === 'nl' || !st || st.bron == null) return;
    vertaling = String(vertaling == null || vertaling === '' ? st.bron : vertaling);
    if (st.soort === 'tekst') {
      if (!st.node.isConnected) return;
      st.weergave = st.voor + vertaling + st.na;
      if (st.node.nodeValue !== st.weergave) st.node.nodeValue = st.weergave;
    } else {
      if (!st.el.isConnected) return;
      st.weergave = vertaling;
      if (st.el.getAttribute(st.naam) !== vertaling) st.el.setAttribute(st.naam, vertaling);
    }
  }

  function herstel() {
    tekstStaten.forEach(function (st) {
      if (!st.node.isConnected) return tekstStaten.delete(st);
      var nu = st.node.nodeValue || '';
      if (st.weergave != null && nu === st.weergave) st.node.nodeValue = st.bronVol;
      else if (nu !== st.bronVol) vernieuwTekst(st, nu);
      st.weergave = null;
    });
    attribStaten.forEach(function (st) {
      if (!st.el.isConnected) return attribStaten.delete(st);
      var nu = st.el.getAttribute(st.naam) || '';
      if (st.weergave != null && nu === st.weergave) st.el.setAttribute(st.naam, st.bron);
      else if (nu !== st.bron) st.bron = nu;
      st.weergave = null;
    });
  }

  function groepenVan(bronnen, groepen) {
    var uit = [], nu = [], tekens = 0;
    bronnen.forEach(function (bron) {
      if (nu.length && (nu.length >= 300 || tekens + bron.length > 18000)) {
        uit.push(nu); nu = []; tekens = 0;
      }
      nu.push(bron); tekens += bron.length;
    });
    if (nu.length) uit.push(nu);
    return uit.map(function (regels) { return { regels: regels, doelen: regels.map(function (r) { return groepen.get(r); }) }; });
  }

  function vraag(groep, gekozenTaal, gekozenBeurt) {
    var koppen = { 'Content-Type': 'application/json' };
    return fetch(apiPad('/api/vertaal/ui'), { method: 'POST', headers: koppen,
      body: JSON.stringify({ naar: gekozenTaal, bron: location.pathname, teksten: groep.regels }) })
      .then(function (r) { if (!r.ok) throw new Error('ui-vertaling ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.naar !== gekozenTaal || !Array.isArray(d.teksten)) return;
        groep.regels.forEach(function (bron, i) {
          var vertaling = d.teksten[i] || bron;
          if (vertaling !== bron) KAST.zet(gekozenTaal, bron, vertaling);
          if (taal === gekozenTaal && beurt === gekozenBeurt)
            groep.doelen[i].forEach(function (st) { if (st.bron === bron) toon(st, vertaling); });
        });
      });
  }

  function voerUit() {
    timer = null;
    eersteRonde = false;
    if (taal === 'nl') return;
    var groepen = new Map(), lijst = Array.from(wortels); wortels.clear();
    if (!lijst.length) lijst = [document.documentElement];
    lijst.forEach(function (root) { verzamelTekst(root, groepen); verzamelAttributen(root, groepen); });
    if (!groepen.size) return;
    var gekozenTaal = taal, gekozenBeurt = beurt;
    groepenVan(Array.from(groepen.keys()), groepen).forEach(function (groep) {
      keten = keten.then(function () { return vraag(groep, gekozenTaal, gekozenBeurt); })
        .catch(function () { /* de brontekst blijft heel; een volgende DOM-wijziging probeert opnieuw */ });
    });
  }
  /* De 80 ms bundelt een uitbarsting van DOM-wijzigingen tot EEN aanvraag. Bij
     een warme kast is er geen aanvraag, en is die wachttijd alleen nog zichtbaar
     Nederlands op een scherm dat we al kunnen vertalen: de EERSTE ronde loopt
     daarom kort zodra de kast van deze taal gevuld is. */
  function plan(root) {
    if (root) wortels.add(root.nodeType === 3 ? root.parentElement : root);
    if (timer || taal === 'nl') return;
    var warm = eersteRonde && KAST.van(taal).size > 0;
    timer = setTimeout(voerUit, warm ? 0 : 80);
  }

  function observeer() {
    if (waarnemer || !document.documentElement) return;
    try {
      waarnemer = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.type === 'characterData') plan(m.target);
          else if (m.type === 'attributes') plan(m.target);
          else Array.from(m.addedNodes || []).forEach(plan);
        });
      });
      waarnemer.observe(document.documentElement, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS.concat(['value']) });
    } catch (e) {}
  }

  function pasToe(nieuweTaal) {
    taal = /^[a-z]{2}$/.test(String(nieuweTaal || '')) ? nieuweTaal : 'nl';
    beurt++;
    if (RTL.has(taal)) document.documentElement.setAttribute('dir', 'rtl');
    else if (taal === 'nl' && oorspronkelijkeRichting == null) document.documentElement.removeAttribute('dir');
    else document.documentElement.setAttribute('dir', oorspronkelijkeRichting || 'ltr');
    document.documentElement.setAttribute('data-rtg-taal', taal);
    if (taal !== 'nl') KAST.van(taal);   // de kast van deze taal alvast van het toestel halen
    eersteRonde = true;
    observeer();
    if (taal === 'nl') { if (timer) { clearTimeout(timer); timer = null; } wortels.clear(); herstel(); }
    else plan(document.documentElement);
  }

  /* De kast staat er ook naar buiten toe bij, want de sleutelweg in i18n-03.js
     praat met dezelfde voorraad. Twee lagen die hetzelfde woord twee keer laten
     vertalen was precies de dubbeling die deze ronde wegneemt. */
  w.RTGAutoVertaling = {
    apply: pasToe, scan: plan, kandidaat: kandidaat, rtl: RTL, kast: KAST,
    stand: function () { var s = KAST.stand(); s.taal = taal; return s; }
  };
})(window);
