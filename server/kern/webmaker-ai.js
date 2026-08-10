/* AI in de Website-maker: "maak het luxer", "maak een pagina voor bruiloften",
   "herschrijf de intro zakelijker". De AI is een assistent en geen black box:
   hij geeft een AANGEPAST ONTWERP terug dat de maker op het doek zet -- de
   gebruiker ziet elke wijziging, kan verder verfijnen en bepaalt zelf of hij
   bewaart. Er wordt hier dus niets opgeslagen; opslaan loopt daarna langs de
   gewone weg (en dus langs dezelfde schoonmaak en grenzen).

   Zonder AI-sleutel draait de demostand: een paar vaste, eerlijke
   transformaties -- en voor de rest de mededeling dat de demostand het niet
   kan, in plaats van doen alsof. */
module.exports = ({ anthropic, schoon }) => {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));

  const SYS = 'Je bent de ontwerpassistent van de RTG Website-maker. Je krijgt een website-ontwerp als JSON en een opdracht. ' +
    'Antwoord ALLEEN met het volledige aangepaste ontwerp als JSON-object, zelfde vorm als de invoer: ' +
    '{"titel","thema":"licht|donker","accent":"#rrggbb","kleuren":{"bg","txt","card"}|null,"blokken":[...],"paginas":[{"naam","slug","blokken":[...]}]}. ' +
    'Bloktypen: hero{kop,sub,knop}, kop{tekst}, tekst{tekst}, knop{tekst,href}, beeld{src,bijschrift}, kolommen{lk,lt,rk,rt}, ' +
    'galerij{beelden:[]}, citaat{tekst,bron}, ruimte{hoogte}, voettekst{tekst}, formulier{kop,knop}, ' +
    'faq{kop,vragen:[{v,a}]}, prijzen{kop,regels:[{naam,prijs,wat}]}, ' +
    'zaakdata{bron} (LIVE blok: bron is een van menu|diensten|kamers|agenda|events|vacatures|openingstijden|fotos|reviews|contact; de inhoud komt bij ieder bezoek uit het bedrijfsprofiel, dus NIET invullen en niet vervangen door vaste tekst). ' +
    'Behoud de id\'s van blokken die je houdt; nieuwe blokken zonder id. Maximaal 60 blokken per pagina en 7 extra pagina\'s. ' +
    'Verzin geen beeld-URL\'s: gebruik alleen src-waarden die al in het ontwerp staan. ' +
    'Schrijfstijl: ingetogen en premium, geen uitroeptekens en geen superlatieven-stapeling. Nederlands, tenzij de opdracht om een andere taal vraagt.';

  /* de demostand: alleen wat we echt waar kunnen maken */
  function demo(design, opdracht) {
    const q = opdracht.toLowerCase();
    const d = JSON.parse(JSON.stringify(design));
    if (/lux|chic|premium/.test(q)) {
      d.thema = 'donker'; d.accent = '#857007';
      return { design: d, antwoord: 'Demostand: thema op donker en het accent op goud gezet. Voor echte herschrijf-opdrachten is een AI-sleutel nodig.', gedaan: true };
    }
    if (/\blicht\b/.test(q)) { d.thema = 'licht'; return { design: d, antwoord: 'Demostand: thema op licht gezet.', gedaan: true }; }
    if (/\bdonker\b/.test(q)) { d.thema = 'donker'; return { design: d, antwoord: 'Demostand: thema op donker gezet.', gedaan: true }; }
    const pm = q.match(/pagina (?:voor|over) (.{2,40})/);
    if (pm && (d.paginas || []).length < 7) {
      const naam = pm[1].trim().replace(/\.$/, '');
      d.paginas = d.paginas || [];
      d.paginas.push({ naam: naam.charAt(0).toUpperCase() + naam.slice(1), slug: '', blokken: [
        { type: 'kop', tekst: naam.charAt(0).toUpperCase() + naam.slice(1) },
        { type: 'tekst', tekst: 'Schrijf hier over ' + naam + '.' }
      ] });
      return { design: d, antwoord: 'Demostand: pagina "' + naam + '" toegevoegd met een kop en een tekstblok.', gedaan: true };
    }
    return { design: null, antwoord: 'De demostand kan alleen: "maak het luxer", "maak het licht/donker" en "maak een pagina voor ...". Voor de rest is een AI-sleutel nodig (ANTHROPIC_API_KEY).', gedaan: false };
  }

  /* het aangepaste ontwerp; opslaan doet de aanroeper (of niet) */
  async function schrijf(design, opdrachtIn) {
    const opdracht = scho(opdrachtIn, 500);
    if (!opdracht) return { design: null, antwoord: 'Vertel wat ik aan het ontwerp moet veranderen.', gedaan: false };
    if (!anthropic) return demo(design, opdracht);
    try {
      const invoer = { titel: design.titel, thema: design.thema, accent: design.accent, kleuren: design.kleuren || null,
        blokken: design.blokken || [], paginas: (design.paginas || []).map(p => ({ naam: p.naam, slug: p.slug, blokken: p.blokken || [] })) };
      const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 8000, system: SYS,
        messages: [{ role: 'user', content: 'ONTWERP:\n' + JSON.stringify(invoer) + '\n\nOPDRACHT: ' + opdracht }] });
      const tekst = (r && r.content && r.content[0] && r.content[0].text) || '';
      const jm = tekst.match(/\{[\s\S]*\}/);
      if (!jm) return { design: null, antwoord: 'Ik kreeg geen bruikbaar ontwerp terug. Probeer de opdracht anders te formuleren.', gedaan: false };
      const uit = JSON.parse(jm[0]);
      if (!Array.isArray(uit.blokken)) return { design: null, antwoord: 'Het antwoord miste de blokken. Probeer het nog eens.', gedaan: false };
      return { design: uit, antwoord: 'Aangepast. Bekijk het op het doek; bewaren doe je zelf.', gedaan: true };
    } catch (e) {
      return { design: null, antwoord: 'De AI is even niet bereikbaar. Probeer het zo nog eens.', gedaan: false };
    }
  }

  return { schrijf };
};
