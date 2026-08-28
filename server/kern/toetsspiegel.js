/* RTG School: de Assessment Fingerprint -- de toets krijgt zelf een uitslag.

   Na afname krijgt niet alleen de leerling een uitslag maar ook de toets. Per
   leerdoel: hoeveel er goed ging, of het onderscheid maakt tussen wie de stof
   beheerst en wie niet, en of er een reden is om aan de vraagstelling te
   twijfelen. Zo wordt een toetsbank elk jaar aantoonbaar beter in plaats van
   elk jaar ouder.

   DE ONDERGRENS, en die is niet onderhandelbaar. Onder de vijf gemaakte
   toetsen zegt de spiegel niets. Niet omdat het statistisch zwak zou zijn --
   dat ook -- maar omdat "de p-waarde van deze toets" bij een klas van een de
   uitslag van dat ene kind IS, met een ander etiket erop. Een getal over de
   toets dat feitelijk over een kind gaat, is een omweg om de regel te breken
   dat een kind geen score buiten het potje krijgt.

   DE SPIEGEL GAAT OVER DE TOETS, NIET OVER DE LEERLINGEN. Er komt geen
   leerlingsleutel en geen naam uit; alles is geteld over de groep. Dat de
   berekening onderweg per leerling kijkt (dat moet, voor het onderscheid) is
   iets anders dan het naar buiten laten komen.

   WAT ER NIET IN STAAT. Er wordt geen p-waarde per VRAAG gegeven, en dat is
   geen omissie: elke leerling krijgt hier verse opgaven uit een generator, dus
   "vraag 3" is bij ieder kind een andere vraag. Een p-waarde per vraag zou een
   getal zijn dat nergens over gaat. Per leerdoel kan het wel, want dat is bij
   iedereen hetzelfde leerdoel. */
const MINIMUM = 5;

const rond = (x) => Math.round(x * 100) / 100;

/* Het onderscheidend vermogen, ruw maar eerlijk: doen de leerlingen die het op
   de HELE toets goed deden, het op dit leerdoel ook beter? Zo niet, dan meet
   deze vraagreeks iets anders dan de rest -- of niets. */
function onderscheid(werken, doel, perDoelVragen) {
  const rijen = werken.map(w => ({ totaal: w.goed / Math.max(1, w.vragen.length),
    doel: ((w.perDoel || {})[doel] || 0) / Math.max(1, perDoelVragen) }));
  if (rijen.length < MINIMUM) return null;
  const gesorteerd = rijen.slice().sort((a, b) => b.totaal - a.totaal);
  const helft = Math.floor(gesorteerd.length / 2) || 1;
  const boven = gesorteerd.slice(0, helft).reduce((s, r) => s + r.doel, 0) / helft;
  const onder = gesorteerd.slice(-helft).reduce((s, r) => s + r.doel, 0) / helft;
  return rond(boven - onder);
}

function spiegel(toets, werken, doelen) {
  const gemaakt = werken.filter(w => w && w.klaar);
  if (gemaakt.length < MINIMUM)
    return { ok: true, genoeg: false, gemaakt: gemaakt.length, minimum: MINIMUM,
      uitleg: 'Deze toets is ' + gemaakt.length + ' keer gemaakt. Onder de ' + MINIMUM +
        ' zegt een spiegel niets over de toets: bij zo weinig leerlingen is het getal in feite de uitslag van die kinderen zelf, en dat is geen eigenschap van de toets.' };

  const perDoel = (toets.doelen || []).map(doel => {
    const p = rond(gemaakt.reduce((s, w) => s + (((w.perDoel || {})[doel] || 0) / Math.max(1, toets.perDoel)), 0) / gemaakt.length);
    const ond = onderscheid(gemaakt, doel, toets.perDoel);
    const let_op = [];
    if (p <= 0.2) let_op.push({ soort: 'te-moeilijk', wat: 'Bijna niemand had dit goed.',
      wat_nu: 'Is de stof nog niet behandeld, of struikelt iedereen over dezelfde formulering? Kijk eerst naar de vraag.' });
    if (p >= 0.95) let_op.push({ soort: 'te-makkelijk', wat: 'Vrijwel iedereen had dit goed.',
      wat_nu: 'Dat mag; het meet alleen weinig. Bewaar het als opwarmer of vervang het.' });
    if (ond !== null && ond <= 0.05 && p > 0.2 && p < 0.95)
      let_op.push({ soort: 'dubbelzinnig', wat: 'Wie de rest van de toets goed maakte, deed het hier niet beter.',
        wat_nu: 'Dat wijst eerder op de vraagstelling dan op de stof: mogelijk is er meer dan een lezing van de vraag.' });
    return { doel, naam: (doelen[doel] || {}).naam || doel, vak: (doelen[doel] || {}).vak || null,
      goedDeel: p, onderscheid: ond, let_op };
  });

  return { ok: true, genoeg: true, gemaakt: gemaakt.length, perDoel,
    uitleg: 'Dit gaat over de toets en niet over de leerlingen: alles is geteld over de groep. Een p-waarde per vraag staat er niet, want elke leerling kreeg verse opgaven -- "vraag 3" is bij ieder kind een andere vraag.' };
}

module.exports = { spiegel, onderscheid, MINIMUM };
