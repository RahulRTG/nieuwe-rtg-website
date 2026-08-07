/* RTF Living Lab, deel "themas": de vragen die bewoners zelf aandragen, en de
   stemmen erop.

   Dit staat met opzet LOS van een studie: het is de trechter ervóór. Een bewoner
   hoeft geen onderzoeksplan te kunnen schrijven om te weten wat er in zijn
   straat speelt, en een lab dat alleen onderzoekt wat de professionals bedenken,
   is geen Living Lab.

   Twee dingen die hier vastliggen:

   - DE TELLER HANGT AAN HET THEMA, niet aan de stemmer (regel 7 van de lat). De
     lijst met stemmers zit ín het thema en dedupliceert daarop. Wie tien
     aliassen aanmaakt, koopt daar dus geen tien stemmen mee -- terwijl een
     teller per stemmer precies dat wel had gedaan.
   - DE HERKOMST BLIJFT STAAN. Wordt een thema een onderzoek, dan houden allebei
     de verwijzing vast. Een bewoner kan daardoor terugzien dat zijn vraag echt
     is opgepakt, en op de studie is te zien met hoeveel draagvlak hij begon.
     Zonder die twee kanten is "bewoners mogen meedenken" een formulier dat in
     een la verdwijnt.

   Afgesplitst uit ./mensen.js toen die de 10 KB passeerde; de naad zat er al,
   want dit gaat over mensen die nog GEEN deelnemer zijn. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, vindLab, vindStudie, save } = ctx;

  const pub = t => ({ id: t.id, labId: t.labId, vraag: t.vraag, soort: t.soort, door: t.door,
    stemmen: t.stemmen.length, studieId: t.studieId, at: t.at });

  function themaBij(b) {
    b = b || {};
    const lab = vindLab(b.labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const vraag = schoon(b.vraag, 300);
    if (vraag.length < 10) return { status: 400, error: 'Welke vraag leeft er in de buurt? Schrijf hem als vraag op.' };
    if (S().themas.filter(t => t.labId === lab.id).length >= 5000) return { status: 400, error: 'Het themaregister van dit lab zit vol.' };
    const t = { id: rid(), labId: lab.id, vraag, soort: (kader.soort(b.soort) || {}).soort || null,
      door: schoon(b.alias, 40) || 'bewoner', stemmen: [], studieId: null, at: nu() };
    S().themas.unshift(t);
    audit(lab.id, 'thema.bij', t.door, t.id, vraag.slice(0, 60));
    save();
    return { ok: true, thema: pub(t) };
  }

  function themaStem(b) {
    b = b || {};
    const t = S().themas.find(x => x.id === String(b.id || ''));
    if (!t) return { status: 404, error: 'Dit thema bestaat niet.' };
    const wie = schoon(b.alias, 40) || '';
    if (wie.length < 2) return { status: 400, error: 'Een stem draagt een naam of alias.' };
    if (t.stemmen.includes(wie)) return { status: 409, error: 'U heeft al op dit thema gestemd.' };
    if (t.stemmen.length >= 100000) return { status: 400, error: 'Dit thema heeft genoeg stemmen.' };
    t.stemmen.push(wie);
    save();
    return { ok: true, thema: pub(t) };
  }

  function themas(labId) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const rijen = S().themas.filter(t => t.labId === lab.id)
      .sort((a, b) => b.stemmen.length - a.stemmen.length || String(b.at).localeCompare(String(a.at)));
    return { ok: true, totaal: rijen.length, themas: rijen.slice(0, 200).map(pub) };
  }

  function themaKoppel(themaId, studieId, wie) {
    const t = S().themas.find(x => x.id === String(themaId || ''));
    if (!t) return { status: 404, error: 'Dit thema bestaat niet.' };
    const s = vindStudie(studieId); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (t.labId !== s.labId) return { status: 400, error: 'Thema en onderzoek horen bij verschillende labs.' };
    if (t.studieId) return { status: 409, error: 'Dit thema is al aan een onderzoek gekoppeld.' };
    t.studieId = s.id; s.uit = { thema: t.id, vraag: t.vraag, stemmen: t.stemmen.length };
    audit(s.labId, 'thema.koppel', wie, s.id, t.id);
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Dit onderzoek komt uit een vraag van de buurt (' + t.stemmen.length + ' stemmen).', wie: 'lab', at: nu() });
    save();
    return { ok: true, thema: pub(t) };
  }

  return { themaBij, themaStem, themas, themaKoppel };
};
