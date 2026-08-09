/* RTG Mall, deelbestand "collecties": SAMENGESTELD AANBOD.

   Vier dingen van de wensenlijst -- collecties, bundels, evenementen en
   seizoenen -- zijn hier EEN ding met per soort een veld erbij. Dat is geen
   luiheid: het zijn alle vier "een benoemde set aanbod met een reden erbij", en
   ze los bouwen levert vier keer dezelfde vervaltermijn, vier keer dezelfde
   koppeling naar levend aanbod en vier kansen om ze uit elkaar te laten lopen.

     collectie  een gecureerde set              ("Een dag op Ibiza")
     bundel     koop je samen, met een prijs    ("Diner + vervoer")
     evenement  heeft een datum                 ("Oogstmarkt, 14 september")
     seizoen    geldt in een periode            ("Winterklaar")

   ================== DE PRIJS VAN EEN BUNDEL ==================

   Hier zit de enige echte val. Een bundelprijs die je opslaat, is morgen een
   leugen: als een onderdeel duurder wordt of verdwijnt, klopt de "korting" niet
   meer. Daarom wordt de losse-prijs ALTIJD uit het levende aanbod opgeteld en
   nooit bewaard. Wat er vastligt is alleen wat de bundel zelf kost.

   En de belangrijkste regel: EEN BUNDEL DIE EEN ONDERDEEL MIST, IS KAPOT.
   Hij wordt niet stilletjes goedkoper of stilletjes kleiner -- hij komt terug
   met `compleet: false`, zegt wat er ontbreekt, en er staat GEEN prijsvergelijk
   bij. Doorrekenen zonder een onderdeel is de duurste soort stilte die er is:
   iemand koopt dan een korting die hij niet krijgt (LAT-regel 5).

   ================== TIJD ==================

   Een evenement dat voorbij is en een seizoen dat afgelopen is, horen niet in
   de Mall. Dat wordt met de DATUM bepaald en niet met een vinkje "actief" dat
   iemand moet omzetten -- een vinkje dat niemand omzet is hoe een winteractie
   in juli op de voorpagina blijft staan. Wie een periode zoekt (van/tot) ziet
   ook wat in die periode valt en niet alleen wat vandaag geldt. */

const SOORTEN = ['collectie', 'bundel', 'evenement', 'seizoen'];
const MAX_REGELS = 12;
const MAX_PER_ZAAK = 20;

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const schoonTekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

/* Valt deze collectie binnen de gevraagde tijd? Zonder periode is dat
   "vandaag". Een collectie zonder datums geldt altijd. */
function inTijd(c, vandaag, periode) {
  if (!c.van && !c.tot) return true;
  const van = periode && periode.van ? periode.van : vandaag;
  const tot = periode && periode.tot ? periode.tot : vandaag;
  if (c.tot && c.tot < van) return false;   // voorbij
  if (c.van && c.van > tot) return false;   // nog niet aan de beurt
  return true;
}

module.exports = (ctx) => {
  const { db, save, crypto } = ctx;
  const vandaagVan = () => new Date().toISOString().slice(0, 10);

  function bak() {
    if (!Array.isArray(db.data.mallCollecties)) db.data.mallCollecties = [];
    return db.data.mallCollecties;
  }

  /* Een collectie uitwerken tegen het LEVENDE aanbod. Alles wat er hier uit
     komt is dus waar op dit moment, of het zegt dat het dat niet is. */
  function werkUit(c, levend) {
    const regels = c.regels.map(id => {
      const a = levend.get(id);
      return a ? { aanbodId: id, aanbod: a, weg: false }
        : { aanbodId: id, aanbod: null, weg: true, reden: 'Dit onderdeel staat niet meer in de Mall.' };
    });
    const kwijt = regels.filter(r => r.weg);
    const compleet = kwijt.length === 0;

    /* De prijsvergelijking, alleen voor een bundel EN alleen als hij compleet
       is. Een onderdeel zonder prijs (een dienst op offerte) maakt de optelsom
       even onmogelijk als een ontbrekend onderdeel -- ook dan geen vergelijk. */
    let prijs = null;
    if (c.soort === 'bundel' && compleet && c.bundelPrijs > 0) {
      const bedragen = regels.map(r => (r.aanbod.prijs ? r.aanbod.prijs.bedrag : null));
      if (bedragen.every(b => b != null)) {
        const los = Math.round(bedragen.reduce((s, b) => s + b, 0) * 100) / 100;
        prijs = {
          los, bundel: c.bundelPrijs,
          verschil: Math.round((los - c.bundelPrijs) * 100) / 100,
          valuta: 'EUR',
          uitleg: 'De losse prijs is opgeteld uit het aanbod van vandaag; hij staat nergens vast.'
        };
      } else {
        prijs = { los: null, bundel: c.bundelPrijs, verschil: null, valuta: 'EUR',
          uitleg: 'Een van de onderdelen heeft geen vaste prijs, dus er valt niets te vergelijken.' };
      }
    }

    return {
      id: c.id, soort: c.soort, titel: c.titel, uitleg: c.uitleg,
      plek: c.plek, van: c.van, tot: c.tot, tijd: c.tijd || null,
      door: c.door, doorNaam: c.doorNaam,
      regels, aantal: regels.length,
      compleet,
      ontbreekt: kwijt.length,
      /* Deze regel is het hele punt van dit bestand: een onvolledige bundel
         zegt dat hij onvolledig is en toont GEEN prijsvergelijk. */
      waarschuwing: compleet ? null
        : (c.soort === 'bundel'
          ? 'Deze bundel mist ' + kwijt.length + ' onderdeel' + (kwijt.length === 1 ? '' : 'en') + '. Er staat daarom geen prijs bij; vraag de aanbieder wat er nog wel kan.'
          : 'Van deze ' + c.soort + ' ' + (kwijt.length === 1 ? 'is een onderdeel' : 'zijn ' + kwijt.length + ' onderdelen') + ' niet meer beschikbaar.'),
      prijs,
      bundelPrijs: c.soort === 'bundel' ? c.bundelPrijs : null
    };
  }

  /* Wat er te zien is. Filtert op plek, soort en tijd -- met de datum, niet met
     een vinkje dat iemand moet omzetten. */
  function collecties(opt = {}) {
    const levend = new Map(ctx.aanbodAlles().aanbod.map(a => [a.id, a]));
    const vandaag = vandaagVan();
    const periode = (isDatum(opt.van) || isDatum(opt.tot))
      ? { van: isDatum(opt.van) ? opt.van : null, tot: isDatum(opt.tot) ? opt.tot : null } : null;
    const plekSlug = opt.plek ? ctx.plek.slugVan(opt.plek) : null;

    let rijen = bak().filter(c => inTijd(c, vandaag, periode));
    if (opt.soort && SOORTEN.includes(opt.soort)) rijen = rijen.filter(c => c.soort === opt.soort);
    if (plekSlug) rijen = rijen.filter(c => !c.plek || ctx.plek.slugVan(c.plek) === plekSlug);

    const uit = rijen.map(c => werkUit(c, levend))
      .sort((a, b) => (a.van || '9999').localeCompare(b.van || '9999') || a.titel.localeCompare(b.titel));
    return {
      ok: true, collecties: uit, aantal: uit.length,
      soorten: SOORTEN, periode, vandaag,
      /* Hoeveel er BUITEN de tijd vielen. Zonder dit getal ziet "er is deze
         maand niets" er precies zo uit als "er is nooit iets". */
      buitenTijd: bak().length - rijen.length
    };
  }

  function toon(id) {
    const c = bak().find(x => x.id === String(id || ''));
    if (!c) return { status: 404, error: 'Deze collectie bestaat niet.' };
    const levend = new Map(ctx.aanbodAlles().aanbod.map(a => [a.id, a]));
    const d = werkUit(c, levend);
    return { ok: true, collectie: d,
      geldig: inTijd(c, vandaagVan(), null),
      opmerking: 'Elk onderdeel gaat naar de partij die het levert, met zijn eigen bevestiging. RTG rekent hier niets af.' };
  }

  const vanZaak = (code) => ({ ok: true,
    collecties: bak().filter(c => c.door === code).map(c => toon(c.id).collectie) });

  const api = { collecties, toon, vanZaak, SOORTEN, MAX_REGELS };
  // samenstellen en verwijderen staan in ./collecties-beheer.js
  Object.assign(api, require('./collecties-beheer')(ctx, { bak, toon, SOORTEN, MAX_REGELS, MAX_PER_ZAAK, isDatum, schoonTekst }));
  ctx.collecties = api;
  return { mallCollecties: api };
};

module.exports.SOORTEN = SOORTEN;
module.exports.inTijd = inTijd;
module.exports.MAX_REGELS = MAX_REGELS;
