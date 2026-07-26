/* De Salon (deelmodule): inzicht voor de maker, en het archief.

   HET UITGANGSPUNT VAN DEZE RONDE: wat elders achter een betaalmuur zit, zit
   hier in de pas. Dit is daar het eerste stuk van.

   Op Instagram krijg je "inzichten" pas met een creator- of bedrijfsaccount, en
   op LinkedIn kost het geld. Wij geven het gewoon, aan ieder lid. Maar wel op de
   manier van dit huis, en dat betekent drie dingen:

   1. HET IS JOUW SPIEGEL, NIET EEN SCOREBORD. Je ziet je eigen cijfers, en die
      van niemand anders. Er is geen ranglijst en geen vergelijking met andere
      leden -- dat is precies het mechanisme dat mensen laat jagen.
   2. GEEN NAMEN BIJ DE CIJFERS. Je ziet DAT tien mensen iets bewaarden, niet
      wie. Wie iets bewaart doet dat voor zichzelf (kern/salon/profiel.js), en
      dat blijft zo, ook nu er een cijfer bij komt.
   3. GEEN ADVIES OM VAKER TE PLAATSEN. De cijfers staan er om te begrijpen wat
      aansloeg, niet om je aan te sporen. Er is dus geen "je plaatste deze week
      minder dan vorige week".

   Het archief is het tweede stuk: een post uit je etalage halen zonder hem weg
   te gooien. Elders heet dat archiveren en het is een premium-gemak; hier is het
   gewoon een knop. Wat gearchiveerd is verdwijnt uit elke feed en uit je raster,
   maar blijft van jou en kan terug. */
module.exports = ({ db, save, salon }) => {

  const mijnPosts = (key) => {
    salon.S();
    return db.data.posts.filter(p => p.authorKey && p.authorKey === key);
  };

  /* Het overzicht: per post wat er gebeurde, en een optelsom erboven. De
     bewaar-tellingen komen uit de prive-planken van andere leden; we tellen ze
     wel, maar we noemen nooit wie. */
  function overzicht(key) {
    const s = salon.S();
    const posts = mijnPosts(key);
    const bewaardTel = (id) => {
      let n = 0;
      for (const k of Object.keys(s.bewaard || {})) if ((s.bewaard[k] || []).includes(id)) n++;
      return n;
    };
    const rijen = posts.map(p => ({
      id: p.id,
      tekst: String(p.text || '').slice(0, 80),
      at: p.at || null,
      gearchiveerd: !!p.archief,
      mooi: (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length,
      reacties: (p.comments || []).length,
      bewaard: bewaardTel(p.id),
      onderwerpen: p.onderwerpen || []
    }));
    const som = (veld) => rijen.reduce((n, r) => n + r[veld], 0);

    /* Welk onderwerp raakte iets? Geteld over je eigen posts, aflopend. Dit is
       het enige "advies" dat er is, en het gaat over de INHOUD, niet over hoe
       vaak je moet posten. */
    const perOnderwerp = new Map();
    for (const r of rijen) {
      for (const t of r.onderwerpen) {
        const b = perOnderwerp.get(t) || { onderwerp: t, posts: 0, mooi: 0, reacties: 0, bewaard: 0 };
        b.posts++; b.mooi += r.mooi; b.reacties += r.reacties; b.bewaard += r.bewaard;
        perOnderwerp.set(t, b);
      }
    }
    return {
      ok: true,
      posts: rijen.sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 100),
      totaal: { posts: rijen.length, mooi: som('mooi'), reacties: som('reacties'), bewaard: som('bewaard') },
      onderwerpen: [...perOnderwerp.values()].sort((a, b) => (b.mooi + b.reacties + b.bewaard) - (a.mooi + a.reacties + a.bewaard)).slice(0, 12)
    };
  }

  /* Archiveren: uit de etalage, niet uit je leven. De post blijft bestaan, de
     reacties blijven eronder staan, en terugzetten kan altijd. */
  function archiveer(key, postId, aan) {
    const p = salon.postMet(postId);
    if (!p) return { error: 'Deze post bestaat niet.' };
    if (p.authorKey !== key) return { error: 'Dit is niet jouw post.' };
    p.archief = aan !== false ? new Date().toISOString() : null;
    save();
    return { ok: true, gearchiveerd: !!p.archief };
  }

  return { overzicht, archiveer, mijnPosts };
};
