  /* De widget. Een KAART (geen knop), met daarin een open-knop voor de kop en
     het lijf, en eventueel losse actieknoppen eronder.

     Waarom geen knop-in-een-knop: dat is ongeldige HTML en het maakt de
     actieknoppen onbereikbaar met het toetsenbord. De kaart is een groep, de
     kop is de deur, de acties staan ernaast.

     "MIJN BRON HEEFT GEANTWOORD" IS EEN TOESTAND EN GEEN OPMAAK, en daarom is
     het hier een attribuut. Het was een klasse: `wing-klaar`. Die naam bestond
     al -- app.html regel 251 geeft hem aan de Klaar-KNOP van de instelkaart, en
     dat is een witte pil met border-radius 999px. Elke widget die zijn bron had
     opgehaald werd dus overgeschilderd tot een witte pil met onleesbare tekst.
     Niemand zag het, want de wings stonden achter body.rtg-command en die
     klasse hing op elke computer permanent op de body (shared/command.js).
     Twee betekenissen op een naam lopen altijd uiteen; een attribuut kan niet
     per ongeluk een uiterlijk erven. */
  function wingWidget(item) {
    const naamVan = it => it.startsWith('tab:') ? tabNaam(it.slice(4)) : ((itemDef(it) || {}).naam || it);
    const kaart = document.createElement('div');
    kaart.className = 'wing-widget'; kaart.dataset.sleutel = item;

    const open = document.createElement('button');
    open.type = 'button'; open.className = 'wing-open';
    open.setAttribute('aria-label', T('wings.open', 'Open') + ' ' + naamVan(item));
    const kop = document.createElement('span'); kop.className = 'wing-kop';
    const vak = document.createElement('span'); vak.className = 'os-tegel';
    const inhoud = tegelInhoud(item);
    if (inhoud) vak.appendChild(inhoud);
    const naam = document.createElement('span'); naam.className = 'wing-naam';
    naam.textContent = naamVan(item);
    const vol = document.createElement('span'); vol.className = 'wing-vol';
    vol.textContent = '\u2197'; vol.setAttribute('aria-hidden', 'true');   // uitklappen = de app
    kop.appendChild(vak); kop.appendChild(naam); kop.appendChild(vol);
    open.appendChild(kop);
    open.addEventListener('click', () => openItem(item));
    kaart.appendChild(open);

    const bron = WIDGETBRON[item];
    if (bron) {
      const lijf = document.createElement('span'); lijf.className = 'wing-lijf';
      open.appendChild(lijf);
      const onder = document.createElement('span'); onder.className = 'wing-onder';
      open.appendChild(onder);
      /* KLAAR-MARKERING. Een widget die zijn bron nog ophaalt en een widget die
         niets te melden heeft, zien er in de DOM identiek uit: een leeg lijf.
         Zonder markering kan niemand -- ook een schermtoets niet -- het verschil
         zien, en dan blijft alleen wachten-op-de-klok over. Die markering staat
         hier dus niet voor de toets maar omdat de toestand echt bestaat: de
         bron heeft geantwoord, ook als het antwoord leeg was. */
      widgetHaal(bron.pad).then(d => {
        const w = d ? bron.lees(d) : null;
        // niets gevonden of bron stuk: het lijf blijft leeg en onzichtbaar
        if (w != null) { lijf.textContent = String(w); kaart.classList.add('heeft-waarde'); }
        const o = (d && bron.onder) ? bron.onder(d) : null;
        if (o != null) { onder.textContent = String(o); kaart.classList.add('heeft-onder'); }
        const acties = (d && bron.acties) ? bron.acties(d) : [];
        if (acties.length) {
          const rij = document.createElement('div'); rij.className = 'wing-acties';
          for (const a of acties) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'wing-actie'; b.textContent = a.label;
            b.addEventListener('click', a.doe);
            rij.appendChild(b);
          }
          kaart.appendChild(rij);
        }
      }).catch(() => { /* een stukke bron laat het lijf leeg; dat is de bedoeling */ })
        .then(() => kaart.setAttribute('data-wing-bron', 'klaar'));
    } else {
      // geen bron om op te wachten: deze kaart is meteen af
      kaart.setAttribute('data-wing-bron', 'klaar');
    }
    return kaart;
  }

  function wingVul(kolom, items) {
    kolom.textContent = '';
    for (const item of items) {
      if (!itemZichtbaar(item)) continue;   // uit in de boardroom, of niet voor deze pas
      kolom.appendChild(wingWidget(item));
    }
  }
