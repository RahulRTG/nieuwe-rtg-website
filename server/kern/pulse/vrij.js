/* RTG Pulse (deelmodule): bewerken en bewaren.

   RONDE 5 -- wat elders geld kost, zit hier in de pas. Bij de bekende microblogs
   zijn dit precies de twee functies achter het abonnement: je bericht nog kunnen
   corrigeren, en je bladwijzers kunnen ordenen. Hier horen ze er gewoon bij.

   Deze deelmodule staat los omdat kern/pulse/index.js anders over de tien
   kilobyte gaat (check-regel 13). Hij krijgt de binnenkant van de feed mee --
   P, publiek, zichtbaar en tags -- en raakt niets anders aan. */
module.exports = ({ save, nu, keur, P, publiek, zichtbaar, tags }) => {

  /* BEWERKEN -- elders de bekendste betaalde functie van een microblog, hier
     gewoon in de pas. Maar wel op de manier van dit huis: een correctie mag,
     stiekem herschrijven niet.

     Waarom dat verschil telt: onder een bericht staan reacties en likes van
     anderen. Wie de tekst ongemerkt kan vervangen, kan mensen achteraf iets
     laten onderschrijven wat ze nooit gelezen hebben. Daarom bewaart deze
     functie elke vorige versie, staat er "bewerkt" bij, en kan IEDEREEN de
     geschiedenis opvragen -- niet alleen jij. Dat is geen boetedoening maar de
     voorwaarde waaronder bewerken eerlijk blijft. */
  function pulseBewerk(key, id, tekst) {
    const post = P().posts.find(x => x.id === id && zichtbaar(x));
    if (!post) return { status: 404, error: 'Bericht niet gevonden.' };
    if (post.key !== key) return { status: 403, error: 'Dit bericht is niet van jou.' };
    const t = String(tekst || '').trim().slice(0, 280);
    if (!t) return { status: 400, error: 'Schrijf eerst iets.' };
    if (t === post.tekst) return { status: 400, error: 'Dit is dezelfde tekst.' };
    const k = keur(t);
    if (!k.ok) return { status: 400, error: k.reden };
    if (!Array.isArray(post.versies)) post.versies = [];
    if (post.versies.length >= 10) return { status: 400, error: 'Dit bericht is al tien keer bewerkt. Schrijf liever een nieuw bericht.' };
    post.versies.push({ tekst: post.tekst, tot: post.bewerkt || post.at });
    post.tekst = t;
    post.tags = tags(t);
    post.bewerkt = nu();
    save();
    return { status: 200, ok: true, post: publiek(post, key) };
  }
  // De geschiedenis staat open voor iedereen die het bericht mag zien.
  function pulseVersies(key, id) {
    const post = P().posts.find(x => x.id === id && zichtbaar(x));
    if (!post) return { status: 404, error: 'Bericht niet gevonden.' };
    return { status: 200, nu: post.tekst, bewerkt: post.bewerkt || null,
      versies: (post.versies || []).map(v => ({ tekst: v.tekst, tot: v.tot })),
      uitleg: 'Elke vorige versie blijft staan, en iedereen kan hem lezen. Een correctie mag; ongemerkt herschrijven niet.' };
  }

  /* BEWAREN MET MAPPEN -- elders zijn losse bladwijzers gratis en is ze ORDENEN
     de betaalde functie. Hier is beide gewoon van jou. Wat je bewaart is prive:
     de schrijver merkt er niets van, want "X bewaarde jouw bericht" is een
     seintje dat niets toevoegt. */
  function pulseBewaar(key, id, map) {
    const p = P();
    const post = p.posts.find(x => x.id === id && zichtbaar(x));
    if (!post) return { status: 404, error: 'Bericht niet gevonden.' };
    if (!p.bewaard[key]) p.bewaard[key] = {};
    const mijn = p.bewaard[key];
    if (mijn[id]) { delete mijn[id]; save(); return { status: 200, ok: true, bewaard: false }; }
    if (Object.keys(mijn).length >= 1000) return { status: 400, error: 'Je plank zit vol; ruim er eerst iets af.' };
    mijn[id] = { map: String(map || 'Bewaard').replace(/[<>]/g, '').trim().slice(0, 40) || 'Bewaard', at: nu() };
    save();
    return { status: 200, ok: true, bewaard: true, map: mijn[id].map };
  }
  function pulseBewaard(key, map) {
    const p = P();
    const mijn = p.bewaard[key] || {};
    const mappen = {};
    for (const id of Object.keys(mijn)) mappen[mijn[id].map] = (mappen[mijn[id].map] || 0) + 1;
    const kies = map ? String(map).slice(0, 40) : null;
    const lijst = p.posts.filter(x => zichtbaar(x) && mijn[x.id] && (!kies || mijn[x.id].map === kies))
      .slice(0, 60)
      .map(x => Object.assign(publiek(x, key), { map: mijn[x.id].map, bewaardOp: mijn[x.id].at }));
    return { status: 200, bewaard: lijst, aantal: Object.keys(mijn).length,
      mappen: Object.keys(mappen).sort().map(naam => ({ naam, aantal: mappen[naam] })) };
  }

  return { pulseBewerk, pulseVersies, pulseBewaar, pulseBewaard };
};
