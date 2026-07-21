/* Kern-module "office": RTG Office, het eigen kantoorpakket voor het hele
   ecosysteem. Leden (RTG, Lifestyle en Business Pass) werken op hun eigen
   account; elke leverancier en partner heeft een team-drive per zaak
   (sleutel 'sup:CODE', het hele team werkt in dezelfde map) en de eigen
   RTG-kantoren delen de kantoor-drive ('rtg:kantoor'). Drie soorten:
   tekstdocument, rekenblad en presentatie.

   Modern, maar privacyvast: delen gaat op codenaam (nooit op echte naam),
   met leesrechten of meeschrijf-rechten; elke wijziging bewaart een
   versiegeschiedenis met terugzetten; sjablonen geven een vliegende start;
   en de AI-schrijfhulp stelt alleen voor, de mens voegt in of niet.

   maakOffice(state) volgt het vaste kern-patroon. */

const SOORTEN = ['tekst', 'blad', 'presentatie'];
const MAX_DOCS = 200;            // per eigenaar (lid, zaak of kantoor)
const MAX_BYTES = 500000;        // per document (ruime kantoortekst, blad of deck)
const MAX_TITEL = 120;
const MAX_VERSIES = 15;
const MAX_DIAS = 60;

/* Sjablonen: een vliegende start per soort; pure inhoud, geen logica. */
const SJABLONEN = {
  brief: { soort: 'tekst', titel: 'Zakelijke brief', inhoud: { tekst: '<p>[Uw naam of zaak]<br>[Adres]</p><p>Betreft: </p><p>Geachte ,</p><p><br></p><p>Met vriendelijke groet,</p>' } },
  notulen: { soort: 'tekst', titel: 'Notulen', inhoud: { tekst: '<p><b>Notulen</b> · [datum]</p><p>Aanwezig: </p><ul><li>Opening</li><li>Besluiten</li><li>Actiepunten (wie, wat, wanneer)</li><li>Rondvraag</li></ul>' } },
  factuurblad: { soort: 'blad', titel: 'Factuurregels', inhoud: { cellen: {
    A1: 'Omschrijving', B1: 'Aantal', C1: 'Prijs', D1: 'Regel',
    D2: '=B2*C2', D3: '=B3*C3', D4: '=B4*C4',
    C6: 'Totaal', D6: '=SOM(D2:D4)'
  }, rijen: 20, kolommen: 6 } },
  weekplan: { soort: 'blad', titel: 'Weekplanning', inhoud: { cellen: {
    A1: 'Dag', B1: 'Ochtend', C1: 'Middag', D1: 'Avond',
    A2: 'Maandag', A3: 'Dinsdag', A4: 'Woensdag', A5: 'Donderdag', A6: 'Vrijdag', A7: 'Zaterdag', A8: 'Zondag'
  }, rijen: 12, kolommen: 5 } },
  pitch: { soort: 'presentatie', titel: 'Pitch', inhoud: { dias: [
    { titel: 'De titel van uw verhaal', tekst: 'Wie u bent, in een zin.' },
    { titel: 'Het probleem', tekst: 'Wat lost u op, en voor wie?' },
    { titel: 'De oplossing', tekst: 'Hoe u het oplost; een zin per punt.' },
    { titel: 'De vraag', tekst: 'Wat heeft u nodig van de zaal?' }
  ] } }
};

function maakOffice({ db, save, crypto, schoon, codenaamVan, keyVanCodenaam, sseToCustomer, anthropic }) {
  const id = () => 'doc' + crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!db.data.officeDocs || typeof db.data.officeDocs !== 'object') db.data.officeDocs = {};
    return db.data.officeDocs;
  }
  const docMet = did => Object.values(lijsten()).find(d => d.id === String(did || '')) || null;
  // de grootte van de inhoud (JSON), zodat een document niet ongelimiteerd groeit
  const grootteVan = inhoud => { try { return Buffer.byteLength(JSON.stringify(inhoud || null)); } catch (e) { return Infinity; } }
  // de naam bij een sleutel: leden op codenaam, teams op zaakcode, RTG als kantoor
  const naamVan = key => {
    const k = String(key || '');
    if (k.startsWith('sup:')) return 'Team ' + k.slice(4);
    if (k === 'rtg:kantoor') return 'RTG Kantoor';
    return codenaamVan(k);
  };
  const magSchrijven = (d, key) => d.key === key || (d.bewerkers || []).includes(key);
  const magLezen = (d, key) => magSchrijven(d, key) || (d.gedeeldMet || []).includes(key);

  /* ---- de mappenlijst: eigen documenten + wat met mij is gedeeld ---- */
  function mijn(key) {
    const alle = lijsten();
    const eigen = Object.values(alle).filter(d => d.key === key)
      .sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
    const gedeeld = Object.values(alle).filter(d => d.key !== key && magLezen(d, key))
      .sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
    const kop = d => ({ id: d.id, soort: d.soort, titel: d.titel, gewijzigd: d.gewijzigd,
      door: naamVan(d.key), gedeeld: (d.gedeeldMet || []).length + (d.bewerkers || []).length });
    return { status: 200, docs: eigen.map(kop), gedeeld: gedeeld.map(kop), max: MAX_DOCS,
      sjablonen: Object.entries(SJABLONEN).map(([k, s]) => ({ id: k, soort: s.soort, titel: s.titel })) };
  }

  /* ---- een nieuw document (leeg of vanuit een sjabloon) ---- */
  function maak(key, data) {
    const alle = lijsten();
    const sjab = SJABLONEN[data.sjabloon] || null;
    const soort = sjab ? sjab.soort : (SOORTEN.includes(data.soort) ? data.soort : 'tekst');
    if (Object.values(alle).filter(d => d.key === key).length >= MAX_DOCS)
      return { status: 409, error: 'U heeft het maximum van ' + MAX_DOCS + ' documenten; verwijder er eerst een.' };
    const titel = schoon(data.titel, MAX_TITEL) || (sjab ? sjab.titel
      : soort === 'blad' ? 'Nieuw rekenblad' : soort === 'presentatie' ? 'Nieuwe presentatie' : 'Nieuw document');
    const leeg = soort === 'blad' ? { cellen: {}, rijen: 20, kolommen: 8 }
      : soort === 'presentatie' ? { dias: [{ titel: 'Titelblad', tekst: '' }] }
      : { tekst: '' };
    const inhoud = sjab ? schoonInhoud(soort, JSON.parse(JSON.stringify(sjab.inhoud))) : leeg;
    const d = { id: id(), key, soort, titel, inhoud, gedeeldMet: [], bewerkers: [], versies: [], gemaakt: nu(), gewijzigd: nu() };
    alle[d.id] = d;
    save();
    return { status: 200, ok: true, id: d.id, soort, titel };
  }

  /* ---- een document openen (eigenaar, meeschrijver of meelezer) ---- */
  function open(key, did) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    const ikEigenaar = d.key === key;
    return { status: 200, id: d.id, soort: d.soort, titel: d.titel, inhoud: d.inhoud,
      magBewerken: magSchrijven(d, key), eigenaar: ikEigenaar, door: naamVan(d.key), gewijzigd: d.gewijzigd,
      versies: (d.versies || []).length,
      gedeeldMet: ikEigenaar ? (d.gedeeldMet || []).map(naamVan) : undefined,
      bewerkers: ikEigenaar ? (d.bewerkers || []).map(naamVan) : undefined };
  }

  /* ---- bewaren (autosave): eigenaar of meeschrijver; met versiegeschiedenis ---- */
  function bewaar(key, did, data) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magSchrijven(d, key)) return { status: 403, error: 'U heeft geen schrijfrechten op dit document.' };
    if (typeof data.titel === 'string' && d.key === key) d.titel = schoon(data.titel, MAX_TITEL) || d.titel;
    if (data.inhoud && typeof data.inhoud === 'object') {
      const schoon2 = schoonInhoud(d.soort, data.inhoud);
      if (grootteVan(schoon2) > MAX_BYTES) return { status: 413, error: 'Dit document is te groot; kort het in.' };
      // elke echte wijziging bewaart de vorige stand; de cap houdt het klein
      if (!d.versies) d.versies = [];
      if (JSON.stringify(schoon2) !== JSON.stringify(d.inhoud)) {
        d.versies.unshift({ om: d.gewijzigd, door: naamVan(key), inhoud: d.inhoud });
        if (d.versies.length > MAX_VERSIES) d.versies.length = MAX_VERSIES;
      }
      d.inhoud = schoon2;
    }
    d.gewijzigd = nu();
    save();
    // wie meeleest of meeschrijft krijgt een seintje dat er iets veranderd is
    for (const mk of [...(d.gedeeldMet || []), ...(d.bewerkers || []), d.key]) {
      if (mk === key) continue;
      try { sseToCustomer(mk, 'office', { kind: 'gewijzigd', id: d.id }); } catch (e) {}
    }
    return { status: 200, ok: true, gewijzigd: d.gewijzigd };
  }
  // de inhoud netjes begrenzen per soort (geen vreemde velden, geen enorme cellen)
  function schoonInhoud(soort, inhoud) {
    if (soort === 'blad') {
      const cellen = {};
      const bron = (inhoud.cellen && typeof inhoud.cellen === 'object') ? inhoud.cellen : {};
      let n = 0;
      for (const [ref, waarde] of Object.entries(bron)) {
        if (!/^[A-Z]{1,2}[0-9]{1,3}$/.test(ref) || n++ > 4000) continue;
        cellen[ref] = String(waarde == null ? '' : waarde).slice(0, 400);
      }
      const rijen = Math.min(200, Math.max(1, parseInt(inhoud.rijen, 10) || 20));
      const kolommen = Math.min(26, Math.max(1, parseInt(inhoud.kolommen, 10) || 8));
      return { cellen, rijen, kolommen };
    }
    if (soort === 'presentatie') {
      const bron = Array.isArray(inhoud.dias) ? inhoud.dias : [];
      const dias = bron.slice(0, MAX_DIAS).map(x => ({
        titel: String((x && x.titel) || '').slice(0, MAX_TITEL),
        tekst: String((x && x.tekst) || '').slice(0, 4000)
      }));
      return { dias: dias.length ? dias : [{ titel: 'Titelblad', tekst: '' }] };
    }
    return { tekst: String(inhoud.tekst || '').slice(0, MAX_BYTES) };
  }

  /* ---- versiegeschiedenis: bekijken en terugzetten ---- */
  function versies(key, did) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    return { status: 200, versies: (d.versies || []).map((v, i) => ({ nr: i, om: v.om, door: v.door })) };
  }
  function terug(key, did, nr) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar zet een versie terug.' };
    const v = (d.versies || [])[Math.round(Number(nr))];
    if (!v) return { status: 404, error: 'Deze versie bestaat niet (meer).' };
    d.versies.unshift({ om: d.gewijzigd, door: naamVan(key), inhoud: d.inhoud });
    if (d.versies.length > MAX_VERSIES) d.versies.length = MAX_VERSIES;
    d.inhoud = JSON.parse(JSON.stringify(v.inhoud));
    d.gewijzigd = nu();
    save();
    return { status: 200, ok: true, inhoud: d.inhoud, gewijzigd: d.gewijzigd };
  }

  /* ---- delen op codenaam: alleen-lezen of meeschrijven, en weer intrekken ---- */
  async function deel(key, did, codenaam, aan, rechten) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar kan delen.' };
    let doelKey = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null; doelKey = t && t.key; } catch (e) {}
    if (!doelKey) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (doelKey === key) return { status: 400, error: 'Uzelf toevoegen hoeft niet.' };
    d.gedeeldMet = (d.gedeeldMet || []).filter(k => k !== doelKey);
    d.bewerkers = (d.bewerkers || []).filter(k => k !== doelKey);
    if (aan !== false) {
      if (d.gedeeldMet.length + d.bewerkers.length >= 100) return { status: 409, error: 'Dit document is al met veel mensen gedeeld.' };
      if (rechten === 'bewerken') d.bewerkers.push(doelKey); else d.gedeeldMet.push(doelKey);
      try { sseToCustomer(doelKey, 'office', { kind: 'gedeeld', id: d.id, titel: d.titel, door: naamVan(key), rechten: rechten === 'bewerken' ? 'bewerken' : 'lezen' }); } catch (e) {}
    }
    d.gewijzigd = nu();
    save();
    return { status: 200, ok: true, gedeeldMet: d.gedeeldMet.map(naamVan), bewerkers: d.bewerkers.map(naamVan) };
  }

  /* ---- verwijderen (alleen de eigenaar) ---- */
  function weg(key, did) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar kan verwijderen.' };
    delete lijsten()[d.id];
    save();
    return { status: 200, ok: true };
  }

  /* ---- de AI-schrijfhulp: stelt alleen voor, de mens voegt in of niet ---- */
  const AI_OPDRACHTEN = ['samenvatten', 'herschrijven', 'doorschrijven', 'formule'];
  async function aiHulp(key, did, opdracht, vraag) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magSchrijven(d, key)) return { status: 403, error: 'AI-hulp is er voor wie mag schrijven.' };
    if (!AI_OPDRACHTEN.includes(opdracht)) return { status: 400, error: 'Kies samenvatten, herschrijven, doorschrijven of formule.' };
    const kaal = d.soort === 'tekst' ? String(d.inhoud.tekst || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
      : d.soort === 'presentatie' ? (d.inhoud.dias || []).map(x => x.titel + ': ' + x.tekst).join('\n').slice(0, 6000)
      : '';
    const w = schoon(vraag, 300);
    if (anthropic) {
      try {
        const prompt = opdracht === 'formule'
          ? 'Geef voor een eenvoudig rekenblad (functies: SOM, GEM, MIN, MAX, AANTAL over een bereik als =SOM(A1:A5), celverwijzingen en +-*/) precies een formule voor deze wens, alleen de formule zelf: ' + w
          : opdracht === 'samenvatten' ? 'Vat deze kantoortekst samen in drie tot vijf zinnen, in het Nederlands:\n' + kaal
          : opdracht === 'herschrijven' ? 'Herschrijf deze tekst zakelijk en helder, in het Nederlands, ongeveer even lang:\n' + kaal
          : 'Schrijf twee tot vier zinnen die dit stuk logisch voortzetten, in het Nederlands' + (w ? ' (wens: ' + w + ')' : '') + ':\n' + kaal;
        const uit = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 600,
          messages: [{ role: 'user', content: prompt }] });
        const tekst = (uit.content || []).map(c => c.text || '').join('').trim();
        if (tekst) return { status: 200, opdracht, voorstel: tekst.slice(0, 4000) };
      } catch (e) {}
    }
    // demostand: een vast, bruikbaar voorstel; de mens beslist wat ermee gebeurt
    const demo = {
      samenvatten: 'Samenvatting (demo): dit document beschrijft de kern in enkele alinea\'s; de belangrijkste punten staan bovenaan en de afspraken onderaan.',
      herschrijven: 'Herschreven (demo): ' + (kaal ? kaal.slice(0, 240) : 'Begin met een korte, heldere openingszin en sluit af met de afspraak.'),
      doorschrijven: 'Vervolg (demo): In de volgende stap werken we dit punt concreet uit, met een verantwoordelijke en een datum per actie.',
      formule: w && /som|totaal|optel/i.test(w) ? '=SOM(A1:A10)' : w && /gemiddel/i.test(w) ? '=GEM(A1:A10)' : '=SOM(A1:A5)'
    };
    return { status: 200, opdracht, voorstel: demo[opdracht], demo: true };
  }

  return { officeMijn: mijn, officeMaak: maak, officeOpen: open, officeBewaar: bewaar,
    officeDeel: deel, officeWeg: weg, officeVersies: versies, officeTerug: terug, officeAI: aiHulp };
}

module.exports = { maakOffice };
