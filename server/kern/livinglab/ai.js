/* RTF Living Lab, deel "ai": Rahul als onderzoekscoach.

   Wat hij WEL doet: een vraagstuk scherper maken, wijzen op wat het tegendeel
   zou bewijzen, methoden voorstellen die bij de vraag passen, en meedenken over
   een steekproef die klein maar eerlijk is.

   WAT HIJ NIET DOET, en waarom dat niet in deze prompt staat maar in de code
   ernaast: hij tekent geen ethische review, verlaagt geen risicoklasse, hangt
   geen bewijsgraad boven "indicatie" aan een conclusie en legt geen onderzoek
   stil of aan. Die grenzen staan in ./ethiek.js en ./bewijs.js als poort. Een
   systeemprompt is een verzoek aan een taalmodel; een poort is een muur. Het
   verschil is dat de muur er ook nog staat als de prompt ooit wordt bijgewerkt,
   als het model verandert, of als iemand een andere aanbieder inschakelt.

   Wat hier bovendien met opzet gebeurt: een conclusie die de coach voorstelt,
   komt binnen als `voorstel: true` op graad `aanname`. Hij kan dus wel meedenken
   over WAT er te concluderen valt, maar het optillen naar een echte bewijsgraad
   is en blijft een handeling van een mens met een naam.

   Bij een MENSELIJK onderwerp (welzijn, gedrag, cohesie, onderwijs) doet de
   coach nog iets: hij zegt er zelf bij dat een professional meekijkt, en hij
   geeft geen inhoudelijk oordeel over individuele deelnemers. Dat is punt 3 van
   de opdracht, en het is ook de reden dat hij het dossier nooit met namen ziet:
   hij krijgt aliassen, want die staan in de opslag. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { schoon, S, vindStudie, anthropic } = ctx;

  /* Het beeld dat de coach meekrijgt. Bewust samengevat en niet ruw: geen
     citaten, geen observatieteksten, geen klachten. Wat hij nodig heeft om te
     kunnen coachen is de VORM van het onderzoek, niet de inhoud die de
     deelnemers hebben toevertrouwd. */
  function beeld(s) {
    const d = s.dossier, so = kader.soort(s.soort) || {}, kl = kader.klasse(d.ethiek.klasse) || {};
    const stap = kader.CYCLUS.find(c => c.stap === s.stap) || {};
    return [
      'Onderzoek: "' + s.titel + '" (' + (so.naam || s.soort) + ').',
      'Vraagstuk: ' + String(s.vraagstuk || '').slice(0, 400),
      'Stap in de cyclus: ' + (stap.naam || s.stap) + '.',
      'Risicoklasse: ' + (kl.naam || d.ethiek.klasse) + (kl.review ? ' (ethische review vereist)' : '') + '.',
      d.hypothese.at ? 'Hypothese: ' + d.hypothese.tekst + ' -- tegendeel: ' + d.hypothese.tegendeel : 'Nog geen hypothese.',
      d.plan.at ? 'Plan: ' + d.plan.methoden.join(', ') + ', steekproef ' + d.plan.steekproef + ', ' + d.plan.meetmomenten + ' meetmomenten.' : 'Nog geen onderzoeksplan.',
      d.deelnemers.length + ' deelnemers, ' + d.observaties.length + ' observaties, ' + d.bronnen.length + ' bronnen (' + d.bronnen.filter(b => b.nagetrokken).length + ' nagetrokken).',
      d.conclusies.length + ' conclusies: ' + (d.conclusies.map(c => c.graad).join(', ') || 'nog geen') + '.',
      d.reflectie.length ? 'Reflectie: ' + d.reflectie.map(r => r.soort).join(', ') + '.' : 'Nog geen reflectie.'
    ].join(' ');
  }

  const opdracht = (s) => {
    const so = kader.soort(s.soort) || {};
    return 'je bent de onderzoekscoach van het RTF Living Lab. Je helpt gemengde teams -- buurtbewoners, ' +
      'studenten, professionals en onderzoekers -- hun onderzoek scherper maken. Je spreekt gewone taal en ' +
      'nooit neerbuigend: de zestienjarige in het team is een medeonderzoeker, geen publiek.\n' +
      'Je helpt met: de vraag scherpstellen, benoemen wat het tegendeel zou bewijzen, een passende methode ' +
      'kiezen uit ' + kader.METHODEN.map(m => m.naam).join(', ') + ', en een steekproef die klein maar eerlijk is.\n' +
      'Je doet NOOIT: een ethische review tekenen, een risicoklasse bepalen of verlagen, beloven dat iets ' +
      'bewezen is, of een uitkomst voorspellen. Vraagt iemand daarom, dan zeg je dat een mens dat beslist en ' +
      'wie dat is.\n' +
      (so.menselijk
        ? 'Dit onderwerp gaat over mensen zelf. Zeg er expliciet bij dat een professional meekijkt, ' +
          'geef geen oordeel over individuele deelnemers, en trek geen conclusies over iemands gezondheid, ' +
          'gedrag of omstandigheden.\n'
        : '') +
      'Als een conclusie zwakker is dan het team denkt, zeg je dat -- vriendelijk en zonder eromheen te draaien. ' +
      'Een onderzoek dat wordt gestopt omdat het bewijs tegenviel, is hier een goed onderzoek.\n' +
      'Beeld van dit onderzoek: ' + beeld(s);
  };

  async function coach(id, vraag) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const q = schoon(vraag, 600);
    if (!q) return { status: 400, error: 'Wat wilt u vragen?' };
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 600,
          system: require('../rahul').RAHUL_LEAD + opdracht(s),
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug op het vaste antwoord hieronder */ }
    }
    return { ok: true, demo: true, antwoord: demo(s) };
  }

  /* Het vaste antwoord zonder AI-sleutel. Het is met opzet GEEN placeholder maar
     het echte advies dat bij de huidige stap hoort, uit het dossier gerekend.
     Zonder sleutel moet dit systeem gewoon bruikbaar zijn -- een coach die
     "geen sleutel gevonden" zegt, laat een team met lege handen staan. */
  function demo(s) {
    const d = s.dossier, tips = [];
    if (!d.hypothese.at) tips.push('Begin bij de hypothese, en schrijf er meteen bij wat het tegendeel zou bewijzen. Als u dat niet kunt bedenken, is de vraag nog niet onderzoekbaar.');
    else if (!d.plan.at) tips.push('Kies uw methoden voordat u mensen benadert. Het systeem rekent dan uit hoe groot de steekproef minstens moet zijn en hoe vaak u moet meten.');
    else if (!d.deelnemers.length) tips.push('Voordat er deelnemers bij kunnen, moet de ethische kant rond zijn: klasse vastgesteld, toestemming gekozen en minstens één stopcriterium.');
    else if (!d.observaties.length) tips.push('Meet uw eerste moment voordat er iets verandert. Zonder nulmeting kunt u straks niets vergelijken.');
    else if (!d.reflectie.length) tips.push('Leg vast wat er misging en wat u niet had verwacht. Dat is hier geen bijzaak: het weegt in dit lab zwaarder dan een extra observatie.');
    else if (!d.conclusies.length) tips.push('Schrijf uw conclusies op als beweringen en hang het bewijs eronder. De graad die eruit komt is de graad die u heeft verdiend.');
    else {
      const zwak = d.conclusies.filter(c => !(c.bewijs || []).length).length;
      tips.push(zwak ? zwak + ' van uw conclusies hebben nog geen enkele drager. Die blijven een aanname, hoe goed ze ook klinken.'
        : 'Uw conclusies dragen bewijs. Kijk nog eens of er één bij zit die u zou moeten herzien -- dat telt hier als het beste werk dat er is.');
    }
    const so = kader.soort(s.soort) || {};
    if (so.menselijk) tips.push('Dit onderwerp gaat over mensen zelf; laat een professional meekijken voordat u iets sterker formuleert dan een waarneming.');
    return tips.join(' ');
  }

  /* Een conclusie die de coach voorstelt. Hij komt binnen als voorstel op de
     laagste graad; het optillen is mensenwerk (./bewijs.js). */
  async function conclusieVoorstel(id, vraag, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const r = await coach(id, 'Formuleer op basis van dit onderzoek één voorzichtige conclusie als bewering, ' +
      'in maximaal twee zinnen, zonder een bewijsgraad te noemen. Context: ' + schoon(vraag, 300));
    if (r.error) return r;
    const tekst = String(r.antwoord || '').slice(0, 600);
    if (tekst.length < 10) return { status: 502, error: 'De coach kwam niet tot een bruikbare formulering.' };
    return ctx.bewijs.conclusieBij(s.id, { tekst, voorstel: true }, 'coach (voorstel van ' + (schoon(wie, 60) || 'onbekend') + ')');
  }

  /* Methodeadvies zonder AI: welke methoden passen bij deze soort en deze stap.
     Puur uit ./kader.js, dus altijd beschikbaar en altijd in de pas met wat de
     poorten straks eisen. */
  function methodeAdvies(soort, ambitie) {
    const so = kader.soort(soort);
    if (!so) return { status: 400, error: 'Kies een projectsoort.' };
    const doel = kader.graad(ambitie) || kader.graad('indicatie');
    const passend = kader.METHODEN.filter(m => (kader.graad(m.maxBewijs) || {}).rang >= doel.rang);
    return { ok: true, soort: so.soort, ambitie: doel.graad,
      menselijk: so.menselijk,
      passend: passend.map(m => ({ methode: m.methode, naam: m.naam, minN: m.minN, meetmomenten: m.meetmomenten, aard: m.aard })),
      teLicht: kader.METHODEN.filter(m => (kader.graad(m.maxBewijs) || {}).rang < doel.rang)
        .map(m => ({ methode: m.methode, naam: m.naam, maxBewijs: m.maxBewijs })),
      let: so.menselijk
        ? 'Bij dit onderwerp weegt het oordeel van een professional zwaarder dan de methode; alles boven een waarneming vraagt een handtekening.'
        : 'Alles boven een indicatie vraagt een handtekening van een tekenbevoegde.' };
  }

  // het beeld van een heel lab, voor de coach op de overzichtspagina
  function labBeeld(labId) {
    const studies = S().studies.filter(s => s.labId === String(labId || ''));
    if (!studies.length) return 'Dit lab heeft nog geen onderzoeken.';
    const perStap = kader.CYCLUS.map(c => { const n = studies.filter(s => s.stap === c.stap).length; return n ? n + 'x ' + c.naam : null; }).filter(Boolean);
    return studies.length + ' onderzoeken (' + perStap.join(', ') + '), ' +
      studies.filter(s => s.besluit && s.besluit.soort === 'gestopt').length + ' bewust gestopt.';
  }

  return { coach, conclusieVoorstel, methodeAdvies, labBeeld, demo };
};
