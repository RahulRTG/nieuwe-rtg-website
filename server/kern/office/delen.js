/* RTG Office, samenwerken: de versiegeschiedenis met terugzetten, delen
   op codenaam (lezen of meeschrijven, en weer intrekken), delen met de
   eigen RTF-gezinskring, en de AI-schrijfhulp die alleen voorstelt;
   de mens voegt in of niet. */

const { MAX_VERSIES } = require('./basis');

module.exports = ({ save, schoon, keyVanCodenaam, sseToCustomer, anthropic }, basis) => {
  const { nu, docMet, naamVan, magSchrijven, magLezen } = basis;

  /* ---- versiegeschiedenis: bekijken en terugzetten ---- */
  function versies(key, did, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
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

  /* ---- delen met de eigen kring (het RTF-gezin): uit, meelezen of samen schrijven ---- */
  function kringDeel(key, did, stand) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de maker deelt met het gezin.' };
    if (!d.kring) return { status: 400, error: 'Dit document hoort niet bij een gezin.' };
    if (![null, '', 'uit', 'lezen', 'bewerken'].includes(stand)) return { status: 400, error: 'Kies uit, lezen of bewerken.' };
    d.kringDeel = (stand === 'lezen' || stand === 'bewerken') ? stand : null;
    d.gewijzigd = nu();
    save();
    return { status: 200, ok: true, kringDeel: d.kringDeel };
  }

  /* ---- de AI-schrijfhulp: stelt alleen voor, de mens voegt in of niet ---- */
  const AI_OPDRACHTEN = ['samenvatten', 'herschrijven', 'doorschrijven', 'formule'];
  async function aiHulp(key, did, opdracht, vraag, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magSchrijven(d, key, kring)) return { status: 403, error: 'AI-hulp is er voor wie mag schrijven.' };
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

  return { officeVersies: versies, officeTerug: terug, officeDeel: deel, officeKring: kringDeel, officeAI: aiHulp };
};
