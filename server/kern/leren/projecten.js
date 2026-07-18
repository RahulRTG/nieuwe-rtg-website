/* Leren-projecten: samen aan een project werken (uitnodigen, taken,
   notities) en de AI die een projectplan voorstelt. nodigUit komt via de
   context binnen nadat kern/leren.js het overhoordeel heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, codenaamVan, zijnVrienden, socialZoek, isGeblokkeerd, sociaalRate, sseToCustomer, anthropic, leeftijdInstr,
    rid, nu, schoon, L, schud, opruimen, seintje, norm } = ctx;
  const { nodigUit } = ctx;
  function projectenVan(mij) {
    const alle = Object.values(L().projecten);
    return { status: 200,
      projecten: alle.filter(p => p.leden.includes(mij)).map(p => ({ id: p.id, titel: p.titel, wat: p.wat, leden: p.leden.map(codenaamVan),
        taken: p.taken.length, af: p.taken.filter(t => t.af).length, at: p.at }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20),
      uitnodigingen: alle.filter(p => p.uitgenodigd.includes(mij)).map(p => ({ id: p.id, titel: p.titel, van: codenaamVan(p.door) })) };
  }
  function projectMaak(mij, { titel, wat }) {
    titel = schoon(titel, 80);
    if (!titel) return { status: 400, error: 'Geef je project een naam (bijv. "Spreekbeurt over dolfijnen").' };
    if (Object.values(L().projecten).filter(p => p.door === mij).length >= 20) return { status: 400, error: 'Je hebt al twintig projecten; rond er eerst een af.' };
    const p = { id: rid(5), titel, wat: schoon(wat, 300), door: mij, leden: [mij], uitgenodigd: [], taken: [], notities: [], at: nu() };
    L().projecten[p.id] = p; save();
    return { status: 200, ok: true, id: p.id };
  }
  async function projectUitnodig(mij, { id, vrienden, codenamen }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    if (p.leden.length + p.uitgenodigd.length >= 6) return { status: 400, error: 'Een project heeft hooguit zes deelnemers.' };
    const wie = await nodigUit(mij, vrienden, codenamen, 6 - p.leden.length - p.uitgenodigd.length, 'project-uitnodiging');
    if (wie.error) return wie.error;
    if (!wie.uitgenodigd.length) return { status: 400, error: 'Nodig minstens een projectmaatje uit (vriend of codenaam).' };
    for (const h of wie.uitgenodigd) if (!p.leden.includes(h) && !p.uitgenodigd.includes(h)) { p.uitgenodigd.push(h); seintje(h, 'project', p.id); }
    save();
    return { status: 200, ok: true };
  }
  function projectAntwoord(mij, id, akkoord) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.uitgenodigd.includes(mij)) return { status: 404, error: 'Deze uitnodiging is er niet meer.' };
    p.uitgenodigd = p.uitgenodigd.filter(h => h !== mij);
    if (akkoord === true) p.leden.push(mij);
    save();
    p.leden.forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true, lid: akkoord === true };
  }
  function projectStaat(mij, id) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    return { status: 200, project: { id: p.id, titel: p.titel, wat: p.wat, ikMaakte: p.door === mij,
      leden: p.leden.map(codenaamVan), wachtOp: p.uitgenodigd.length,
      taken: p.taken, notities: p.notities.slice(-60), mijnCodenaam: codenaamVan(mij) } };
  }
  function projectWeg(mij, id) {
    const p = L().projecten[String(id || '')];
    if (!p || p.door !== mij) return { status: 404, error: 'Alleen wie het project startte kan het opruimen.' };
    delete L().projecten[String(id)]; save();
    return { status: 200, ok: true };
  }
  function taakMaak(mij, { id, tekst }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    tekst = schoon(tekst, 140);
    if (!tekst) return { status: 400, error: 'Wat moet er gebeuren?' };
    if (p.taken.length >= 40) return { status: 400, error: 'Veertig taken is echt genoeg; vink er eerst wat af.' };
    p.taken.push({ id: rid(3), tekst, wie: null, af: false }); save();
    return { status: 200, ok: true };
  }
  function taakZet(mij, { id, taakId, af, claim }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    const t = p.taken.find(x => x.id === String(taakId || ''));
    if (!t) return { status: 404, error: 'Deze taak is er niet meer.' };
    if (claim === true) t.wie = codenaamVan(mij);
    if (claim === false) t.wie = null;
    if (af === true || af === false) t.af = af;
    save();
    p.leden.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true };
  }
  function notitie(mij, { id, tekst }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    tekst = schoon(tekst, 500);
    if (!tekst) return { status: 400, error: 'Schrijf eerst iets op.' };
    p.notities.push({ id: rid(3), van: codenaamVan(mij), tekst, at: nu() });
    if (p.notities.length > 200) p.notities.shift();
    save();
    p.leden.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true };
  }
  // de AI stelt een projectplan voor als taken; zonder sleutel een net standaardplan
  const DEMO_PLANNEN = [
    { test: /spreekbeurt|presentatie/i, taken: ['Kies je onderwerp en schrijf op waarom je het koos', 'Zoek drie goede bronnen (boek, site, iemand die er veel van weet)', 'Maak een begin, een midden en een slot', 'Maak je poster of je dia-presentatie', 'Oefen hardop, ook op de tijd', 'Bedenk twee vragen voor je publiek'] },
    { test: /werkstuk|verslag/i, taken: ['Maak een hoofdstukindeling (inleiding, drie vragen, slot)', 'Zoek per hoofdstuk een bron en schrijf steekwoorden op', 'Schrijf de eerste versie zonder aan mooi te denken', 'Lees elkaars stukken en geef een tip en een top', 'Maak een voorkant en de bronnenlijst', 'Laat iemand anders de spelling controleren'] },
    { test: /knutsel|bouw|maak/i, taken: ['Teken eerst hoe het eruit moet zien', 'Maak een lijstje van alle spullen', 'Verdeel wie wat meeneemt', 'Bouw een proefversie en kijk wat beter kan', 'Maak de echte versie samen af', 'Ruim samen op en maak een foto van het resultaat'] }
  ];
  const DEMO_PLAN_ALGEMEEN = ['Schrijf samen op wat het doel is', 'Verdeel de eerste taken: wie doet wat', 'Spreek een moment af om elkaar bij te praten', 'Maak een eerste versie of proefopstelling', 'Vraag iemand om mee te kijken en verwerk de tips', 'Rond af en vier het samen'];
  async function projectAi(mij, { id, groep }) {
    const p = L().projecten[String(id || '')];
    if (!p || !p.leden.includes(mij)) return { status: 404, error: 'Dit project bestaat niet (meer).' };
    if (!sociaalRate(mij, 'leren-ai', 30, 3600000)) return { status: 429, error: 'Rustig aan; probeer het over een uurtje weer.' };
    let plan = null, demo = false;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 600,
          system: 'Je helpt kinderen en gezinnen een project in behapbare taken te verdelen. Concreet, kort, doe-taal. ' + (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: 'Project: "' + p.titel + '". ' + (p.wat ? 'Omschrijving: ' + p.wat + '. ' : '') + 'Stel 5 tot 7 taken voor. Antwoord ALLEEN met een JSON-array van strings.' }] });
        const tekst = (r.content || []).map(b => b.text || '').join('');
        const m = tekst.match(/\[[\s\S]*\]/);
        if (m) plan = JSON.parse(m[0]).map(t => schoon(t, 140)).filter(Boolean).slice(0, 8);
      } catch (e) { /* val terug op het standaardplan */ }
    }
    if (!plan || !plan.length) { plan = (DEMO_PLANNEN.find(k => k.test.test(p.titel + ' ' + p.wat)) || { taken: DEMO_PLAN_ALGEMEEN }).taken; demo = true; }
    const bestaand = new Set(p.taken.map(t => norm(t.tekst)));
    let erbij = 0;
    for (const tekst of plan) {
      if (bestaand.has(norm(tekst)) || p.taken.length >= 40) continue;
      p.taken.push({ id: rid(3), tekst, wie: null, af: false }); erbij++;
    }
    save();
    p.leden.filter(sp => sp !== mij).forEach(sp => seintje(sp, 'project', p.id));
    return { status: 200, ok: true, erbij, demo };
  }

  /* ================= schrijven ================= */
  return { projectenVan, projectMaak, projectUitnodig, projectAntwoord, projectStaat, projectWeg, taakMaak, taakZet, notitie, projectAi };
};
