/* De bibliothecaris: de AI-assistent van de echte RTG Bibliotheek. Je
   vertelt wat je zoekt of wilt leren, en de bibliothecaris zoekt dwars door
   de bibliotheken heen en raadt een handvol apps aan, met een warme uitleg.

   Drie werelden:
   - mall:   de App-, Reis- en RTF-Bibliotheek (voor leden en gasten)
   - rtf:    kindveilig, uit de RTF-, School- en Beroepen-Bibliotheek, op de
             leeftijdsgroep van het profiel
   - geloof: de Geloof & Wijsheid-Bibliotheek; alle tradities als gelijken,
             neutraal, zonder partij te kiezen of te bekeren
   De aanraders komen altijd uit een echte catalogus-zoektocht (de AI kan
   dus niets verzinnen dat niet bestaat); met een API-sleutel schrijft
   Rahul de uitleg, zonder sleutel doet een nette demo-pen dat. */

module.exports = ({ appbieb, reisbieb, rtfbieb, schoolbieb, beroepenbieb, geloofbieb, anthropic, schoon }) => {

  // de zoektermen uit de vraag: losse woorden van vier letters of meer
  const termen = (vraag) => [...new Set(String(vraag).toLowerCase().split(/[^a-zà-ü]+/).filter(w => w.length >= 4))].slice(0, 6);

  const proef = (fn) => { try { return (fn().items || []).slice(0, 2); } catch (e) { return []; } };

  function zoekMall(vraag) {
    const uit = [];
    for (const t of termen(vraag)) {
      for (const a of proef(() => appbieb.catalogus({ zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'App-Bibliotheek', uitleg: a.uitleg });
      for (const a of proef(() => reisbieb.catalogus({ zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'Reis-Bibliotheek', uitleg: a.uitleg });
      for (const a of proef(() => rtfbieb.catalogus('volw', { zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'RTF-Bibliotheek', uitleg: a.uitleg });
      if (uit.length >= 10) break;
    }
    return uit;
  }
  function zoekRtf(vraag, groep) {
    const uit = [];
    for (const t of termen(vraag)) {
      for (const a of proef(() => rtfbieb.catalogus(groep, { zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'App-Bibliotheek', uitleg: a.uitleg });
      for (const a of proef(() => schoolbieb.catalogus(groep, { zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'School-Bibliotheek', uitleg: a.uitleg });
      for (const a of proef(() => beroepenbieb.catalogus('techniek', { zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'Beroepen-Bibliotheek', uitleg: a.uitleg });
      for (const a of proef(() => beroepenbieb.catalogus('zaken', { zoek: t, per: 2 }))) uit.push({ naam: a.naam, bieb: 'Beroepen-Bibliotheek', uitleg: a.uitleg });
      if (uit.length >= 10) break;
    }
    return uit;
  }

  function zoekGeloof(vraag, groep) {
    const uit = [];
    if (!geloofbieb) return uit;
    for (const t of termen(vraag)) {
      for (const a of proef(() => geloofbieb.catalogus(groep, { zoek: t, per: 4 }))) uit.push({ naam: a.naam, bieb: a.traditieLabel, uitleg: a.uitleg });
      if (uit.length >= 10) break;
    }
    return uit;
  }

  async function adviseer(vraag, { wereld = 'mall', groep = 'volw' } = {}) {
    const q = schoon(String(vraag || ''), 300);
    if (!q || q.length < 3) return { status: 400, error: 'Vertel eerst wat u zoekt of wilt leren.' };
    const rauw = wereld === 'geloof' ? zoekGeloof(q, groep) : wereld === 'rtf' ? zoekRtf(q, groep) : zoekMall(q);
    // ontdubbelen op naam en aftoppen op zes aanraders
    const gezien = new Set();
    const aanraders = rauw.filter(a => !gezien.has(a.naam) && gezien.add(a.naam)).slice(0, 6);
    if (!aanraders.length) {
      return { status: 200, antwoord: wereld === 'geloof'
        ? 'Daar vond ik zo snel niets bij. Probeer een traditie (bijv. boeddhisme of humanisme) of een thema als "vrede", "verhalen" of "meditatie"; dan zoek ik met je mee.'
        : wereld === 'rtf'
        ? 'Daar vond ik zo snel niets bij. Probeer een woord als "rekenen", "lezen" of een beroep dat je leuk lijkt; dan zoek ik opnieuw met je mee.'
        : 'Daar vond ik zo snel niets bij in de bibliotheken. Probeer een vak (bijv. ontwerp), een bestemming (bijv. Londen) of een gidssoort (bijv. metrokaart).', aanraders: [] };
    }
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 400,
          system: 'Je bent de warme bibliothecaris van de RTG Bibliotheek. Schrijf in het Nederlands een kort, persoonlijk advies (max 120 woorden) bij de gevonden boeken/apps. ' +
            'Noem ALLEEN titels uit de meegegeven lijst; verzin niets. Beloof nooit toegang of prijzen.' +
            (wereld === 'rtf' ? ' Je praat met een kind of gezin: warm, eenvoudig, je/jij, en alles in deze bibliotheek is gratis.' : '') +
            (wereld === 'geloof' ? ' Dit is de Geloof & Wijsheid-Bibliotheek: alle religies en levensbeschouwingen staan hier als gelijken naast elkaar. Blijf volstrekt neutraal en respectvol, kies nooit partij voor of tegen een traditie, bekeer nooit, en presenteer geen enkele overtuiging als "de waarheid". Alles is gratis.' : ''),
          messages: [{ role: 'user', content: 'De vraag: ' + q + '\n\nGevonden:\n' + aanraders.map(a => '- ' + a.naam + ' (' + a.bieb + ')').join('\n') }] });
        const uit = (r.content || []).map(b => b.text || '').join('').trim();
        if (uit) return { status: 200, antwoord: uit, aanraders };
      } catch (e) { /* val terug op de demo-pen */ }
    }
    const eerste = aanraders[0];
    return { status: 200, demo: true, aanraders,
      antwoord: (wereld === 'rtf' ? 'Goede vraag! ' : wereld === 'geloof' ? 'Mooie vraag. ' : 'Mooie vraag. ') +
        'Ik zou beginnen met "' + eerste.naam + '" uit ' + (wereld === 'geloof' ? 'de traditie ' : 'de ') + eerste.bieb +
        (aanraders.length > 1 ? ', en daarnaast vind je hieronder nog ' + (aanraders.length - 1) + ' aanraders die erbij passen.' : '.') +
        (wereld === 'rtf' ? ' Alles is gratis; installeer wat je helpt en haal weg wat je niet gebruikt.'
          : wereld === 'geloof' ? ' Alle tradities staan hier als gelijken naast elkaar; alles is gratis, kies vrij wat je aanspreekt.'
          : ' Installeren is bij de pas inbegrepen.') };
  }

  return { bibliothecaris: { adviseer } };
};
