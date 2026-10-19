/* RTG Veilig (deelbestand): WAT VEILIG VAN EEN LID VERGEET (AVG art. 17).

   Alles in dit domein hangt aan de sessiesleutel van het lid (zie
   server/routes/veiligheid.js: `mij = req.session.key`), en de vergeetroute
   kende db.data.veilig niet. Na "verwijder mijn gegevens" bleven dus de
   laatste plek, het spoor van een open venster, de kring, het codewoord, de
   wachten en de verstuurde alarmen met hun plek gewoon staan.

   WEG, want het is alleen van dit lid: zijn kring, zijn laatste plek en
   vensters, zijn rust, zijn codewoord, zijn wachten en zijn eigen Momenten.

   DE PERSOON ERUIT, DE REST BLIJFT, en dat geldt op twee plekken:
     - een alarm dat dit lid STUURDE staat ook in het overzicht van wie het
       kreeg ("alarmen voor mij"). Dat blijft, maar zonder afzender, zonder
       notitie en zonder plek; een alarm dat nog openstond, sluit -- er is
       niemand meer om naar te kijken.
     - in de kring en de Momenten van ANDEREN staat dit lid als contact. Daar
       gaat hij uit, en uit de ontvangers van andermans alarmen ook. */
'use strict';

module.exports = ({ opslag, save }) => {
  const nu = () => new Date().toISOString();
  const EIGEN = ['kring', 'plek', 'vensters', 'rust', 'codewoord'];

  function veiligVergeet(handle) {
    if (!handle) return { weg: 0, anoniem: 0 };
    let weg = 0, anoniem = 0;
    for (const tak of EIGEN) {
      const k = opslag.tak(tak);
      if (Object.hasOwn(k, handle)) { delete k[handle]; weg++; }
    }
    for (const k of Object.values(opslag.tak('kring'))) {
      if (!k || !Array.isArray(k.contacten)) continue;
      const voor = k.contacten.length;
      k.contacten = k.contacten.filter(c => !c || c.handle !== handle);
      anoniem += voor - k.contacten.length;
    }
    for (const naam of ['wachten', 'momenten']) {
      const lijst = opslag.tak(naam);
      const houd = lijst.filter(x => !x || x.handle !== handle);
      weg += lijst.length - houd.length;
      if (houd.length !== lijst.length) opslag.zetTak(naam, houd);
    }
    for (const m of opslag.tak('momenten')) {
      if (m && Array.isArray(m.ontvangers))
        m.ontvangers = m.ontvangers.filter(r => !(r && r.soort === 'contact' && r.id === handle));
    }
    for (const a of opslag.tak('alarmen')) {
      if (!a) continue;
      if (Array.isArray(a.naar)) a.naar = a.naar.filter(h => h !== handle);
      if (a.handle !== handle) continue;
      a.handle = null; a.vanCodenaam = ''; a.notitie = ''; a.plek = null;
      if (!a.afgesloten) { a.afgesloten = true; a.afgeslotenAt = nu(); a.hoe = 'Het account is opgeheven.'; }
      a.vergeten = nu();
      anoniem++;
    }
    save();
    return { weg, anoniem };
  }

  return { veiligVergeet };
};
