/* ============ DE PRIVEBERICHTEN VERHUIZEN NAAR DE KERN ============

   De eerste ronde maakte een gespreksmodel (./index.js) en liet de bestaande
   voorraden waar ze stonden. Dat was de juiste volgorde -- eerst het model,
   dan de verhuizing -- maar het liet ook de grootste voorraad buiten de kern
   staan: db.data.memberChats, de priveberichten tussen leden. En zolang die
   erbuiten stond, was "communicatie is infrastructuur" een belofte en geen
   feit: de ene app kon de gesprekken van de sociale laag alleen LEZEN.

   Dit bestand doet die verhuizing, en het doet er precies drie dingen voor.

   1. EEN GESPREK PER PAAR, uit de kern (comm.tussen). Vanaf nu schrijft
      iedereen daarin: de sociale laag, de routes, en de communicatie-app.
      Twee schrijvers op twee voorraden is hoe berichten uit elkaar lopen
      zonder dat iemand het merkt.

   2. DE GESCHIEDENIS GAAT MEE, eenmalig, bij de eerste keer dat een paar
      wordt aangeraakt (importeer). Niet in een migratiescript dat over de hele
      database loopt: dat moet je durven draaien op een database die in gebruik
      is, en het valt om op het eerste rare bericht. Dit importeert per paar,
      op het moment dat het paar toch al wordt geopend, en zet een vlag zodat
      het nooit twee keer gebeurt. Wat er niet in past (een gedeelde post)
      verhuist als bijlage mee.

   3. DE OUDE VOORRAAD BLIJFT STAAN. Hij wordt niet meer gelezen en niet meer
      geschreven, maar hij wordt ook niet gewist. Data van mensen weggooien
      omdat de code er klaar mee is, is precies de handeling die je niet terug
      kunt draaien als er iets aan de import blijkt te mankeren.

   WAT HIER NIET IN ZIT: de controles. Of twee leden verbonden zijn, of iemand
   geblokkeerd is, of de tekst door de 9+-poort komt en of er niet te snel
   achter elkaar wordt gestuurd -- dat blijft staan waar het stond (de sociale
   laag en de routes). Die regels gaan over vriendschap en veiligheid, niet
   over berichten; ze hier naartoe halen zou ze verstoppen op de plek waar
   niemand ze zoekt. */
'use strict';

function maakCommDm({ db, save, comm, dmSleutel }) {
  /* De vlag staat op het GESPREK en niet in een aparte lijst: zo kan een
     gesprek nooit los raken van de wetenschap of zijn geschiedenis al binnen
     is. Een tweede tabel die dat bijhoudt, is een tweede ding dat kan missen. */
  function importeer(gesprek, a, b) {
    if (!gesprek || gesprek.meta.oudBinnen) return gesprek;
    gesprek.meta.oudBinnen = new Date().toISOString();
    let oud = null;
    try { oud = (db.data.memberChats || {})[dmSleutel(a, b)]; } catch (e) {}
    const berichten = (oud && Array.isArray(oud.messages)) ? oud.messages : [];
    if (berichten.length) {
      /* Rechtstreeks in de voorraad van de kern, en niet via comm.bericht():
         die zet elk bericht op NU en zou de hele geschiedenis op de dag van de
         verhuizing zetten. Een gesprek van twee jaar dat er ineens uitziet
         alsof het vanmiddag gebeurde, is geen migratie maar een vervalsing. */
      const lijst = comm.berichtenVan(gesprek.id);
      for (const m of berichten) {
        if (!m || (!m.text && !m.post)) continue;
        lijst.push({
          id: 'brc_oud_' + (lijst.length + 1) + '_' + gesprek.id.slice(-6),
          van: m.from, at: m.at || gesprek.op,
          tekst: m.text ? String(m.text).slice(0, 4000) : null,
          soort: m.post ? 'post' : 'tekst',
          antwoordOp: null,
          bijlage: m.post ? Object.assign({ soort: 'post' }, m.post) : null,
          lang: m.lang || null,
          reacties: {}
        });
      }
      lijst.sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
      const laatste = lijst[lijst.length - 1];
      if (laatste && laatste.at > gesprek.laatst) gesprek.laatst = laatste.at;
      /* De leesstand gaat mee: zonder dat springt bij iedereen elk oud gesprek
         op ongelezen, en dan is de verhuizing zichtbaar als een stapel rode
         bolletjes die niemand heeft veroorzaakt. */
      for (const [wie, at] of Object.entries((oud && oud.read) || {})) comm.leesZet(wie, gesprek.id, at);
    }
    save();
    return gesprek;
  }

  /* Het gesprek tussen twee leden, met zijn geschiedenis erin. Dit is de enige
     ingang: wie een DM wil lezen of schrijven, vraagt hier het gesprek op. */
  function gesprek(a, b) {
    return importeer(comm.tussen(a, b), a, b);
  }

  /* Sturen. De aanroeper heeft zijn eigen controles al gedaan (zie de kop);
     hier gaat het bericht de kern in, en komt het in de oude vorm terug zodat
     bestaande schermen niets merken. */
  function stuur(van, naar, opties) {
    const o = opties || {};
    const g = gesprek(van, naar);
    const m = comm.bericht({ gesprekId: g.id, van, tekst: o.tekst || '',
      bijlage: o.post ? Object.assign({ soort: 'post' }, o.post) : null,
      soort: o.post ? 'post' : 'tekst', lang: o.lang || null });
    return oudeVorm(m);
  }

  /* De oude berichtvorm ({ from, text, post, at, lang }). Schermen en routes
     die er al waren blijven werken; wat er in de kern bij is gekomen (id,
     reacties, antwoord-op) reist mee voor wie het wel wil gebruiken. */
  function oudeVorm(m) {
    return { id: m.id, from: m.van, text: m.tekst || '', post: (m.bijlage && m.bijlage.soort === 'post')
      ? m.bijlage : null, at: m.at, lang: m.lang || null };
  }

  function berichten(a, b, hoeveel) {
    const g = gesprek(a, b);
    const lijst = comm.berichtenVan(g.id).filter((m) => !m.weg);
    return lijst.slice(-(hoeveel || 80)).map(oudeVorm);
  }

  function markeerGelezen(mij, ander) {
    const g = gesprek(mij, ander);
    comm.leesZet(mij, g.id, new Date().toISOString());
    save();
  }

  /* Hoeveel er voor jou klaarstaat in dit ene gesprek. De sociale laag toonde
     dit uit zijn eigen voorraad; nu uit de kern, zodat de teller in de
     vriendenlijst en die in de communicatie-app niet uit elkaar kunnen lopen. */
  function ongelezen(mij, ander) {
    const g = gesprek(mij, ander);
    return comm.gesprek(mij, g.id, { aantal: 500 }).ongelezen;
  }

  function laatste(mij, ander) {
    const lijst = comm.berichtenVan(gesprek(mij, ander).id).filter((m) => !m.weg);
    const m = lijst[lijst.length - 1];
    return m ? oudeVorm(m) : null;
  }

  return { gesprek, stuur, berichten, markeerGelezen, ongelezen, laatste, oudeVorm };
}

module.exports = { maakCommDm };
