/* RTG Festival (deelmodule): DE UITZONDERINGEN. Het hart van Festival Command.

   WAT HIER NIET STAAT IS HET ONTWERP. Geen twintig dashboards, geen groene
   vinkjes, geen "alles in orde" per zone. Wat goed gaat komt niet in beeld.
   Wat in beeld komt is wat aandacht vraagt, met de tijd die er nog is.

   DE VOORUITBLIK IS HET PRODUCT, NIET DE STAND. "Alpha zit op 74%" is een
   mededeling; "Alpha raakt over 17 minuten aan de veilige capaciteit" is een
   beslissing. Het verschil tussen die twee is een deling -- resterende ruimte
   gedeeld door instroom per minuut -- en precies daarom staat de instroom in
   ./bezetting.js gemeten en niet geschat.

   RUST IS EEN UITKOMST, GEEN LEEGTE (PLATFORM.md, de cockpit-regel). Een lege
   lijst kan twee dingen betekenen: er is niets aan de hand, of er komt niets
   binnen. Die twee zijn levensgevaarlijk om te verwarren op een terrein met
   65.000 mensen. Daarom geeft deze laag ALTIJD terug hoeveel plekken er
   werkelijk gemeten zijn, en -- belangrijker -- welke plekken een capaciteit
   hebben maar geen enkele meting. Die ONGEMETEN lijst is zelf een bevinding:
   een zone met een drempel waar niets gescand wordt, is een blinde vlek en geen
   rustige plek. Dat is LAT-regel 3 op deze laag: een meter zonder invoer hoort
   niets te beweren.

   WAT ER VAN BUITEN BIJKOMT staat in ./signalen.js: onbezette beveiligingsposten
   en een door de vervoerder gemelde storing, gelezen bij BEVESTIGDE partners en
   alleen voor wat die partner zelf heeft vrijgegeven. Die twee lijsten worden
   hier SAMENGEVOEGD en niet naast elkaar getoond -- twee lijsten laten de
   leiding kiezen welke ze eerst leest, en dat is precies de keuze die een
   cockpit hoort weg te nemen.

   VOORRAAD EN WEER STAAN ER NOG NIET, en waarom niet staat in ./signalen.js:
   er is geen laag om te lezen. Een plausibel getal tonen zou erger zijn dan
   niets tonen. */
'use strict';

const ERNST = { kritiek: 3, hoog: 2, aandacht: 1 };

module.exports = (ctx) => {
  const { editieVind, dagVind, bezetting, instroom, signalen } = ctx;

  /* De horizon: hoe ver vooruit een uitzondering nog een uitzondering is. Een
     uur is de standaard omdat dat ongeveer de tijd is die een ingreep op een
     terrein kost -- personeel verplaatsen, een route omleggen, publiek sturen.
     Verder vooruit kijken geeft meldingen waar niemand iets mee doet, en dat is
     hoe een cockpit zijn geloofwaardigheid verliest. */
  const HORIZON = 60;

  /* EEN NEDERLANDS GETAL IN EEN NEDERLANDSE ZIN. Deze zinnen worden gelezen
     door een productieleider op een terrein, niet door een parser; "0.67 per
     minuut" is daar een tikfout en geen notatie. */
  const komma = (n) => String(n).replace('.', ',');

  function uitzonderingen(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dag = dagVind(e, v.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const horizon = Math.max(5, Math.min(240, parseInt(v.vooruit, 10) || HORIZON));

    const b = bezetting(fid, eid, dag.id);
    if (b.error) return b;
    const stroom = instroom(fid, eid, dag.id, v.datum, v.tijd, v.venster || 15);
    if (stroom.error) return stroom;

    const uit = [];
    const ongemeten = [];
    let gemeten = 0;

    for (const p of b.plekken) {
      if (!p.veiligeCapaciteit) continue;             // geen drempel: niets te overschrijden
      const s = stroom.plekken[p.id];
      const perMinuut = s ? s.perMinuut : 0;

      /* Een plek met een drempel waar in het hele venster niets is gescand EN
         waar niemand binnen staat: daar meet niemand. Dat is geen rust. */
      if (!s && !p.aanwezig) { ongemeten.push({ id: p.id, naam: p.naam, veiligeCapaciteit: p.veiligeCapaciteit }); continue; }
      gemeten++;

      if (p.capaciteit && p.aanwezig >= p.capaciteit) {
        uit.push({ plek: p.id, naam: p.naam, ernst: 'kritiek', over: 0,
          zin: p.naam + ' staat op de vergunde capaciteit (' + p.aanwezig + ' van ' + p.capaciteit + ').',
          bron: { aanwezig: p.aanwezig, capaciteit: p.capaciteit, perMinuut } });
        continue;
      }
      if (p.aanwezig >= p.veiligeCapaciteit) {
        uit.push({ plek: p.id, naam: p.naam, ernst: 'hoog', over: 0,
          zin: p.naam + ' is voorbij de veilige capaciteit (' + p.aanwezig + ' van ' + p.veiligeCapaciteit + ').',
          bron: { aanwezig: p.aanwezig, veiligeCapaciteit: p.veiligeCapaciteit, perMinuut } });
        continue;
      }
      if (perMinuut <= 0) continue;                   // gemeten, en er komt niemand bij

      const over = Math.ceil((p.veiligeCapaciteit - p.aanwezig) / perMinuut);
      if (over <= horizon) {
        uit.push({ plek: p.id, naam: p.naam, ernst: over <= 15 ? 'hoog' : 'aandacht', over,
          zin: p.naam + ' raakt over ' + over + ' minuten aan de veilige capaciteit ('
            + p.veiligeCapaciteit + '), bij ' + komma(perMinuut) + ' per minuut.',
          bron: { aanwezig: p.aanwezig, veiligeCapaciteit: p.veiligeCapaciteit, perMinuut } });
      }
    }

    /* Wat de domeinen van de partners melden, op dezelfde hoop. */
    const buiten = signalen(fid, eid, { datum: v.datum, tijd: v.tijd });
    if (!buiten.error) for (const s of buiten.signalen) uit.push(s);

    /* Het dringendste eerst: eerst de ernst, dan de tijd die er nog is. */
    uit.sort((a, b2) => (ERNST[b2.ernst] - ERNST[a.ernst]) || (a.over - b2.over));

    return { ok: true, dag: dag.id, tijd: String(v.tijd || ''), horizon,
      uitzonderingen: uit, gemeten, ongemeten,
      partners: buiten.partners || 0, zonderDeling: buiten.zonderDeling || 0,
      /* Rust is pas rust als er ook echt gemeten is EN er geen blinde vlekken
         zijn. Een bevestigde partner die niets deelt, is zo'n blinde vlek: hij
         levert stilte op, en stilte is geen rust. */
      rust: uit.length === 0 && gemeten > 0 && ongemeten.length === 0
        && !(buiten.zonderDeling || 0) };
  }

  return { uitzonderingen };
};
