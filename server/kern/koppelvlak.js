/* RTG School: de Integration Fabric -- adapters eromheen, canoniek model binnen.

   Grens 12 uit SCHOOL.md: geen enkele externe standaard dicteert ons
   domeinmodel. Edu-V, Entree, Edu-API en OSO krijgen een adapter; andersom is
   permanente schade, want dan draagt onze administratie voorgoed de vorm van
   een koppelvlak dat over vijf jaar anders is.

   Deze module doet twee dingen en geen derde:

     naarBuiten -- ons model vertalen naar de velden van een standaard;
     naarBinnen -- velden van buiten terugbrengen tot ons model.

   TWEE HARDE REGELS.

   1. WAT WIJ NIET KENNEN, KOMT ER NIET IN. Een veld van buiten dat niet op de
      kaart staat, wordt GEWEIGERD en gemeld -- niet meegenomen "voor later".
      Zo groeit ons model niet stilletjes mee met wat een leverancier stuurt.
   2. WAT EEN STANDAARD NIET KAN, STAAT ERBIJ. Elke kaart draagt een lijst
      `kanNiet`. Dat is de zin die het verschil maakt tussen eerlijk in de code
      en oneerlijk in een verkooppraatje: wie deze adapter gebruikt, hoort van
      tevoren te weten wat er onderweg verdwijnt.

   WAT DIT NIET IS. Er wordt hier niets verstuurd en niets opgehaald; er is geen
   verbinding met Edu-V of Entree. Dit is de VERTALING, en die is los te
   toetsen. Zolang er geen echte koppeling staat, hoort er ook niet te worden
   gedaan alsof -- dat is precies wat er tot nu toe over deze paragraaf in
   SCHOOL.md stond. */
const STANDAARDEN = {
  eduv: {
    naam: 'Edu-V',
    heen: { naam: 'volledigeNaam', geboren: 'geboortedatum', opleiding: 'opleidingCode', klasCode: 'groepCode' },
    kanNiet: ['de overstapgeschiedenis van een leerling', 'de reden van een plaatsing',
      'het onderscheid tussen een aanmelding en een inschrijving'] },
  entree: {
    naam: 'Entree Federatie',
    heen: { naam: 'displayName', geboren: null, opleiding: 'eduPersonAffiliation', klasCode: 'eduPersonOrgUnit' },
    kanNiet: ['een geboortedatum (dit is een inlogfederatie en geen administratie)',
      'inhoudelijke onderwijsgegevens zoals opleiding of voortgang',
      'documenten en bewijsstukken van een leerling'] },
  eduapi: {
    naam: 'Edu-API',
    heen: { naam: 'person.displayName', geboren: 'person.dateOfBirth', opleiding: 'program.code', klasCode: 'group.code' },
    kanNiet: ['zorg- en ondersteuningsgegevens (met opzet buiten de standaard)',
      'onze leerdoelenstructuur met voorkennis en bewijs; die kent Edu-API niet'] },
  oso: {
    naam: 'OSO (overstapdossier)',
    heen: { naam: 'naam', geboren: 'geboortedatum', opleiding: 'onderwijssoort', klasCode: 'groep',
      herkomst: 'vorigeSchool', overstappen: 'overstaphistorie' },
    kanNiet: ['leerdoelen en bewijs van beheersing zoals wij die kennen',
      'de reden waarom een gegeven wel of niet is meegestuurd'] }
};

/* Ons model naar buiten. Velden die de standaard niet kent, gaan niet mee en
   worden GEMELD -- stil weglaten is hoe gegevens onderweg verdwijnen zonder
   dat iemand het merkt. */
function naarBuiten(canoniek, standaard) {
  const s = STANDAARDEN[String(standaard || '')];
  if (!s) return { status: 400, error: 'Deze standaard kennen we niet. Bekend: ' + Object.keys(STANDAARDEN).join(', ') + '.' };
  const uit = {}, weg = [];
  for (const [veld, waarde] of Object.entries(canoniek || {})) {
    const naam = Object.prototype.hasOwnProperty.call(s.heen, veld) ? s.heen[veld] : undefined;
    if (naam) uit[naam] = waarde;
    else weg.push({ veld, waarom: naam === null
      ? 'De standaard heeft hier geen veld voor.'
      : 'Dit gegeven kent ' + s.naam + ' niet.' });
  }
  return { ok: true, standaard, naam: s.naam, velden: uit, weggelaten: weg, kanNiet: s.kanNiet,
    uitleg: 'Wat ' + s.naam + ' niet kan dragen, staat hierboven. Een koppeling die dat verzwijgt, laat de ontvanger denken dat hij alles heeft.' };
}

/* Van buiten naar binnen. Alles wat niet op de kaart staat wordt geweigerd en
   gemeld; ons model groeit niet mee met wat een leverancier stuurt. */
function naarBinnen(extern, standaard) {
  const s = STANDAARDEN[String(standaard || '')];
  if (!s) return { status: 400, error: 'Deze standaard kennen we niet. Bekend: ' + Object.keys(STANDAARDEN).join(', ') + '.' };
  const terug = {};
  for (const [veld, naam] of Object.entries(s.heen)) if (naam) terug[naam] = veld;
  const uit = {}, geweigerd = [];
  for (const [naam, waarde] of Object.entries(extern || {})) {
    if (terug[naam]) uit[terug[naam]] = waarde;
    else geweigerd.push({ veld: naam, waarom: 'Dit veld staat niet op onze kaart en wordt niet overgenomen.' });
  }
  return { ok: true, standaard, naam: s.naam, velden: uit, geweigerd,
    uitleg: 'Geweigerde velden zijn niet bewaard "voor later": ons model volgt geen koppelvlak. Hoort een veld er wel bij, dan komt het op de kaart en niet in een uitzondering.' };
}

module.exports = { naarBuiten, naarBinnen, STANDAARDEN };
