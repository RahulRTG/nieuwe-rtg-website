/* RTG Office, samenwerken: de versiegeschiedenis met terugzetten, delen
   op codenaam (lezen of meeschrijven, en weer intrekken), delen met de
   eigen RTF-gezinskring, en de AI-schrijfhulp die alleen voorstelt;
   de mens voegt in of niet. */

const { MAX_VERSIES } = require('./basis');
const { samenvat, actiepunten, zinnen } = require('../../lib/lokale-taal');

module.exports = ({ save, schoon, keyVanCodenaam, sseToCustomer, anthropic }, basis) => {
  const { nu, docMet, naamVan, magSchrijven, magLezen, faseVan, schrijfAudit } = basis;

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
    const oudeFase = faseVan(d);
    d.fase = 'concept';
    d.laatstDoor = naamVan(key);
    d.gewijzigd = nu();
    schrijfAudit(d, key, 'versie-teruggezet', { van: oudeFase, naar: 'concept' });
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
    if (aan !== false && d.beheer && d.beheer.classificatie === 'strikt')
      return { status: 409, error: 'Een strikt document kan niet worden gedeeld. Pas eerst de classificatie aan.' };
    d.gedeeldMet = (d.gedeeldMet || []).filter(k => k !== doelKey);
    d.bewerkers = (d.bewerkers || []).filter(k => k !== doelKey);
    if (aan !== false) {
      if (d.gedeeldMet.length + d.bewerkers.length >= 100) return { status: 409, error: 'Dit document is al met veel mensen gedeeld.' };
      if (rechten === 'bewerken') d.bewerkers.push(doelKey); else d.gedeeldMet.push(doelKey);
      try { sseToCustomer(doelKey, 'office', { kind: 'gedeeld', id: d.id, titel: d.titel, door: naamVan(key), rechten: rechten === 'bewerken' ? 'bewerken' : 'lezen' }); } catch (e) {}
    }
    d.gewijzigd = nu();
    d.laatstDoor = naamVan(key);
    schrijfAudit(d, key, aan === false ? 'deling-ingetrokken' : 'gedeeld',
      { rechten: aan === false ? 'uit' : (rechten === 'bewerken' ? 'bewerken' : 'lezen'), met: naamVan(doelKey) });
    save();
    return { status: 200, ok: true, gewijzigd: d.gewijzigd,
      gedeeldMet: d.gedeeldMet.map(naamVan), bewerkers: d.bewerkers.map(naamVan) };
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
    d.laatstDoor = naamVan(key);
    schrijfAudit(d, key, d.kringDeel ? 'gedeeld' : 'deling-ingetrokken',
      { rechten: d.kringDeel || 'uit', met: 'gezin' });
    save();
    return { status: 200, ok: true, kringDeel: d.kringDeel, gewijzigd: d.gewijzigd };
  }

  /* ---- de AI-schrijfhulp: stelt alleen voor, de mens voegt in of niet ---- */
  const AI_OPDRACHTEN = ['samenvatten', 'herschrijven', 'doorschrijven', 'formule',
    'actiepunten', 'inkorten', 'engels', 'kritisch'];
  async function aiHulp(key, did, opdracht, vraag, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magSchrijven(d, key, kring)) return { status: 403, error: 'AI-hulp is er voor wie mag schrijven.' };
    if (!AI_OPDRACHTEN.includes(opdracht)) return { status: 400, error: 'Deze opdracht kent RTG Office niet.' };
    const kaal = d.soort === 'tekst' ? String(d.inhoud.tekst || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
      : d.soort === 'presentatie' ? (d.inhoud.dias || []).map(x => x.titel + ': ' + x.tekst).join('\n').slice(0, 6000)
      : '';
    const w = schoon(vraag, 300);

    /* Selecteren, inkorten, rekenen en vaste kwaliteitscontroles zijn lokale
       documentbewerkingen. Ze draaien voor een beschikbaar model langs, zodat
       de inhoud niet zonder noodzaak naar een provider gaat. */
    if (opdracht === 'formule') {
      const refs = w.toUpperCase().match(/\b[A-Z]{1,2}\d{1,3}\b/g) || [];
      const bereik = refs.length >= 2 ? refs[0] + ':' + refs[1] : refs[0] ? refs[0] + ':' + refs[0] : 'A1:A10';
      const formule = /gemiddel/i.test(w) ? '=GEM(' + bereik + ')'
        : /afrond/i.test(w) ? '=AFRONDEN(' + (refs[0] || 'A1') + ';2)'
        : /als|indien|drempel/i.test(w) ? '=ALS(' + (refs[0] || 'A1') + '>100;"boven";"onder")'
        : /minim/i.test(w) ? '=MIN(' + bereik + ')'
        : /maxim|hoogste/i.test(w) ? '=MAX(' + bereik + ')'
        : /aantal|tel hoeveel/i.test(w) ? '=AANTAL(' + bereik + ')'
        : '=SOM(' + bereik + ')';
      return { status: 200, opdracht, stand: 'lokaal', voorstel: formule };
    }
    if (opdracht === 'samenvatten') return { status: 200, opdracht, stand: 'lokaal',
      voorstel: samenvat(kaal, { maxZinnen: 5, maxTekens: 1000 }) || 'Dit document bevat nog geen tekst om samen te vatten.' };
    if (opdracht === 'inkorten') {
      const regels = zinnen(kaal);
      return { status: 200, opdracht, stand: 'lokaal', voorstel:
        samenvat(kaal, { maxZinnen: Math.max(1, Math.ceil(regels.length / 2)), maxTekens: Math.max(120, Math.ceil(kaal.length / 2)) })
          || 'Dit document bevat nog geen tekst om in te korten.' };
    }
    if (opdracht === 'actiepunten') {
      const acties = actiepunten(kaal, { max: 8 });
      const voorstel = acties.map(a => '- ' + a.wat + (a.wanneer && !a.wat.toLowerCase().includes(a.wanneer.toLowerCase()) ? ' · ' + a.wanneer : '')).join('\n');
      return { status: 200, opdracht, stand: 'lokaal', voorstel: voorstel ||
        'Geen concrete actiepunten gevonden. Voeg per actie een verantwoordelijke, handeling en datum toe.' };
    }
    if (opdracht === 'kritisch') {
      const punten = [];
      if (!/[€%]|\b\d+[.,]?\d*\b/.test(kaal)) punten.push('Cijfers of meetbare onderbouwing ontbreken.');
      if (!/\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|vandaag|morgen|\d{1,2}[-/]\d{1,2})\b/i.test(kaal)) punten.push('Er staat geen concrete datum of termijn bij.');
      if (!/\b(besluit|akkoord|keuze|goedkeuring)\b/i.test(kaal)) punten.push('De gevraagde beslissing staat niet expliciet in de tekst.');
      return { status: 200, opdracht, stand: 'lokaal', voorstel:
        (punten.length ? punten : ['Geen vaste structurele lacunes gevonden.']).map((x, i) => (i + 1) + ') ' + x).join('\n') };
    }

    // Alleen deze drie opdrachten maken werkelijk nieuwe taal.
    if (anthropic) {
      try {
        const prompt = opdracht === 'herschrijven' ? 'Herschrijf deze tekst zakelijk en helder, in het Nederlands, ongeveer even lang:\n' + kaal
          : opdracht === 'engels' ? 'Translate this business document into professional British English. Keep the structure. Return only the translation:\n' + kaal
          : 'Schrijf twee tot vier zinnen die dit stuk logisch voortzetten, in het Nederlands' + (w ? ' (wens: ' + w + ')' : '') + ':\n' + kaal;
        const uit = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 600,
          messages: [{ role: 'user', content: prompt }] });
        const tekst = (uit.content || []).map(c => c.text || '').join('').trim();
        if (tekst) return { status: 200, opdracht, voorstel: tekst.slice(0, 4000) };
      } catch (e) {}
    }
    return { status: 503, error: 'Rahul is nu niet beschikbaar voor deze creatieve opdracht. U kunt het document zonder AI blijven bewerken.',
      code: 'AI_NIET_BESCHIKBAAR', handmatig: true, opdracht };
  }

  return { officeVersies: versies, officeTerug: terug, officeDeel: deel, officeKring: kringDeel, officeAI: aiHulp };
};
