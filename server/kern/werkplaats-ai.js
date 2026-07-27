/* RTG Werkplaats, het AI-deel: de chef die een nieuw app-idee uitwerkt of een
   bestaand onderdeel doorlicht, en de eerlijke kritiek op een plan. Zonder
   API-sleutel valt alles terug op een net sjabloon, zodat de werkplaats ook in
   de demo werkt. De basis (opslag, statussen, uitgifte) staat in
   ./werkplaats.js en geeft zijn helpers hier door. */
function maakWerkplaatsAI(basis) {
  const { vind, publiek, scho, lijst, lead, nu, save, anthropic, DOELSOORT } = basis;

  async function claudeJSON(sys, user, max) {
    if (!anthropic) return null;
    try {
      const r = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: max || 900, system: sys, messages: [{ role: 'user', content: user }] });
      const t = (r && r.content && r.content[0] && r.content[0].text) || '';
      const jm = t.match(/\{[\s\S]*\}/); if (jm) return JSON.parse(jm[0]);
    } catch (e) { /* val terug op het sjabloon */ }
    return null;
  }

  function sjabloon(o) {
    if (o.soort === 'nieuw') return {
      soort: 'nieuw',
      doel: scho(o.brief, 240) || ('Een nieuwe RTG-app: ' + o.naam),
      doelgroep: 'RTG-leden die dit dagelijks gebruiken',
      schermen: ['Startscherm met de kern in één blik', 'Actiescherm om het te doen', 'Overzicht en geschiedenis'],
      functies: ['Werkt op codenaam (privacy by design)', 'Rahul helpt en voert uit', 'Sluit aan op RTG Pay waar geld speelt'],
      huisstijl: 'Bordeaux accent, Bodoni-koppen, Inter voor tekst, veel lucht, geen emoji',
      eersteStappen: ['Server: kern-module + routes', 'App-pagina in de huisstijl', 'In de App Store zetten en testen']
    };
    return {
      soort: 'verbeter', doel: o.doel || '',
      analyse: 'Waar dit onderdeel nu sterk in is en waar het schuurt voor de gebruiker.',
      verbeteringen: ['Duidelijker eerste scherm', 'Minder stappen tot de kernactie', 'Een vriendelijke lege-toestand met een nudge'],
      nieuweFuncties: ['Een AI-knop die het werk uit handen neemt'],
      risicos: ['Let op de huidige gebruikers; klein en omkeerbaar uitrollen'],
      eersteStappen: ['Schrijf het voorstel uit', 'Bouw de kleinste omkeerbare wijziging', 'Test en meet']
    };
  }

  async function aiUitwerken(i) {
    const o = vind(i); if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    let plan = null;
    if (o.soort === 'nieuw') {
      const sys = lead() + 'Je bent de chef van RTG Werkplaats, het app-bureau van RTG. Werk een NIEUW app-idee uit binnen de RTG-huisstijl (privacy op codenamen, Rahul als AI-hart, bordeaux accent, geen emoji, veel lucht). Antwoord ALLEEN met JSON: {"doel":"..","doelgroep":"..","schermen":[".."],"functies":[".."],"huisstijl":"..","eersteStappen":[".."]}. Kort en concreet, in het Nederlands.';
      const p = await claudeJSON(sys, 'App-naam: ' + o.naam + '. Brief: ' + (o.brief || o.naam), 950);
      if (p && (p.doel || p.functies)) plan = {
        soort: 'nieuw', doel: scho(p.doel, 300), doelgroep: scho(p.doelgroep, 160),
        schermen: lijst(p.schermen, 140, 7), functies: lijst(p.functies, 140, 8),
        huisstijl: scho(p.huisstijl, 240), eersteStappen: lijst(p.eersteStappen, 160, 7)
      };
    } else {
      const sys = lead() + 'Je bent de chef van RTG Werkplaats. Verbeter een BESTAAND onderdeel van RTG (' + (DOELSOORT[o.doelSoort] || 'onderdeel') + '). Blijf binnen de huisstijl en het principe "klein en omkeerbaar". Antwoord ALLEEN met JSON: {"analyse":"..","verbeteringen":[".."],"nieuweFuncties":[".."],"risicos":[".."],"eersteStappen":[".."]}. Kort en concreet, in het Nederlands.';
      const p = await claudeJSON(sys, 'Onderdeel: ' + (o.doel || o.naam) + ' (' + (DOELSOORT[o.doelSoort] || '') + '). Wens: ' + (o.brief || o.naam), 950);
      if (p && (p.analyse || p.verbeteringen)) plan = {
        soort: 'verbeter', doel: o.doel || '', analyse: scho(p.analyse, 400),
        verbeteringen: lijst(p.verbeteringen, 160, 8), nieuweFuncties: lijst(p.nieuweFuncties, 160, 6),
        risicos: lijst(p.risicos, 160, 6), eersteStappen: lijst(p.eersteStappen, 160, 7)
      };
    }
    o.plan = plan || sjabloon(o);
    if (o.status === 'idee') o.status = 'uitgewerkt';
    o.updatedAt = nu(); save();
    return { ok: true, item: publiek(o) };
  }

  async function aiKritiek(i) {
    const o = vind(i); if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (!o.plan) return { status: 400, error: 'Werk het idee eerst uit.' };
    let k = null;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 500,
          system: lead() + 'Je bent de scherpe chef van RTG Werkplaats. Geef in 3 tot 5 zinnen eerlijke kritiek op dit plan: wat is sterk, wat mist, wat is het grootste risico en wat is de eerste stap. Nederlands, geen JSON.',
          messages: [{ role: 'user', content: 'Plan: ' + JSON.stringify(o.plan).slice(0, 2000) }]
        });
        k = scho((r && r.content && r.content[0] && r.content[0].text) || '', 900);
      } catch (e) { /* val terug */ }
    }
    o.kritiek = k || 'Sterk begin. Zorg dat de kernactie in één tik bereikbaar is, houd de lege-toestand vriendelijk, en rol klein en omkeerbaar uit. Grootste risico: te veel tegelijk willen. Eerste stap: bouw de kleinste versie die al waarde geeft.';
    o.updatedAt = nu(); save();
    return { ok: true, item: publiek(o) };
  }

  return { aiUitwerken, aiKritiek };
}

module.exports = { maakWerkplaatsAI };
