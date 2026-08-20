/* DE BRONNEN VAN DE PLAATSLAAG (PLAATS.md fase 2b).

   Hier wordt bedraad WELKE domeinen hun eigen plaatsen leveren als hek. Dit is
   met opzet een bedradingsbestand en geen kernmodule: de plaatslaag mag niet
   weten hoe een beveiligingsteam zijn posten opslaat, en het beveiligingsteam
   hoeft niet te weten dat er zoiets als een hek bestaat. Het enige wat de twee
   verbindt is deze paar regels -- en dat is precies wat een opzet-laag hoort te
   zijn.

   DE HARDE REGEL VOOR ELKE BRON HIERONDER: hij mag alleen plaatsen teruggeven
   die dit lid sowieso al mag zien. De hekkenlijst gaat naar het TOESTEL, dus een
   bron die niet filtert lekt plaatsen aan iedereen die de route aanroept. Beide
   bronnen hieronder vertrekken daarom vanuit kern/werkplekken.js -- "bij welke
   organisaties hoort dit lid" is daar de enige waarheid, en die vraag twee keer
   beantwoorden is twee antwoorden die uit elkaar lopen.

   Na kern/plaats gemount (kernlaag6), en dat kan: werkplekken staat in
   kernlaag5 en de beveiligingslaag wordt in server.js gebouwd, ver voor alle
   kernlagen. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, findSupplier } = hulp;
  if (!kern.plaats || typeof kern.plaats.plaatsBron !== 'function') return;

  /* De zaken waar dit lid werkt. De SLEUTEL komt als invoer mee en wordt hier
     niet opgezocht: de vertaling codenaam -> sleutel loopt via de gids en die is
     async (kern/gids.js), terwijl een bron synchroon moet antwoorden. De
     aanroeper heeft beide al -- de sessie draagt ze allebei. */
  function zakenVan(key) {
    if (!key || !kern.werkplekken || typeof kern.werkplekken.zakenVan !== 'function') return [];
    try { return kern.werkplekken.zakenVan(key) || []; } catch (e) { return []; }
  }

  /* BRON 1 -- JE EIGEN WERKPLEKKEN. Het adres van de zaken waar dit lid
     werkelijk werkt. Hiervoor stond op het doel `dienst` gewoon de hele
     leverancierslaag van kern/navigatie: elk toestel kreeg elke zaak van het
     eiland als hek. Onschuldig, want openbare plaatsen -- maar verkeerd, want
     aanwezigheid op je werk gaat over jouw werkgevers en over niemand anders. */
  kern.plaats.plaatsBron('werkplek', 'dienst', (codenaam, key) => {
    const uit = [];
    for (const z of zakenVan(key)) {
      const s = findSupplier(z.code);
      const loc = s && (s.loc || (s.geo && { lat: s.geo.lat, lng: s.geo.lng }));
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) continue;
      uit.push({ id: 'leverancier:' + s.code, naam: s.name || s.code,
        soort: 'punt', punten: [{ lat: loc.lat, lng: loc.lng }] });
    }
    return uit;
  });

  /* BRON 2 -- DE POSTEN VAN JE BEVEILIGINGSTEAM. Een bewaker werkt niet op het
     kantooradres van zijn werkgever maar op een post, en dat is de plek waar
     zijn aanwezigheid iets betekent.

     Dit is de tegenhanger van wat er bij fase 2a wegging: kern/beveiliging/pda/
     patrouille.js bewaarde bij het inklokken de rauwe positie van de bewaker op
     zijn dienst, en niemand las hem ooit. Wat ervoor terugkomt is binnen of
     buiten met een tijd -- meer gebruikt en minder bewaard.

     Alleen posten van teams waar dit lid ZELF werkt: welke objecten een
     beveiligingsbedrijf bewaakt is bedrijfsgevoelig, en die lijst hoort niet op
     het toestel van een willekeurig lid te belanden. */
  kern.plaats.plaatsBron('bevpost', 'dienst', (codenaam, key) => {
    if (typeof kern.bevPosten !== 'function' || typeof kern.bevIsBeveiliging !== 'function') return [];
    const uit = [];
    for (const z of zakenVan(key)) {
      const s = findSupplier(z.code);
      if (!s || !kern.bevIsBeveiliging(s)) continue;
      for (const post of (kern.bevPosten(s) || [])) {
        if (!post || !Number.isFinite(post.lat) || !Number.isFinite(post.lng)) continue;
        uit.push({ id: 'bevpost:' + s.code + ':' + post.id, naam: post.naam || 'Post',
          soort: 'punt', punten: [{ lat: post.lat, lng: post.lng }] });
      }
    }
    return uit;
  });

  /* En de weg terug: van een bewaker naar zijn codenaam. Een bewaker IS een
     personeelsrecord (accounts.listStaff), en die draagt het member_id van zijn
     RTG-account als hij er een gekoppeld heeft. Zonder koppeling is er geen
     codenaam en dus niets waargenomen -- dat is een eigen stand en geen
     "nog niet gedaan".

     Hiermee sluit de kring die bij fase 2a openging: de rauwe positie die bij
     het inklokken op de dienst werd bewaard is weg, en wat ervoor terugkomt is
     binnen of buiten de post, met een tijd. */
  function codenaamVanGuard(s, gid) {
    if (!s || !accounts || typeof accounts.listStaff !== 'function') return null;
    let rij;
    try { rij = (accounts.listStaff(s.code) || []).find(x => String(x.id) === String(gid)); } catch (e) { return null; }
    if (!rij || rij.member_id == null || typeof kern.codenaamVan !== 'function') return null;
    try { return kern.codenaamVan('user-' + rij.member_id) || null; } catch (e) { return null; }
  }
  if (typeof kern.bevKoppelPlaats === 'function') kern.bevKoppelPlaats(kern.plaats, codenaamVanGuard);
};
