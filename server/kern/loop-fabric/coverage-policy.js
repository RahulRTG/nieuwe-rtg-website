'use strict';

const CLASSIFICATIONS=Object.freeze([
  'LOOP_CAPABLE','PARTIALLY_LOOP_CAPABLE','NOT_YET_LOOP_CAPABLE','NO_LEARNING_VALUE',
  'PROHIBITED_FROM_LEARNING','HUMAN_REVIEW_REQUIRED'
]);

const DOMAINS=Object.freeze([
  ['loop-fabric',/^loop-fabric$/],['workos',/^(bedrijf|command-|dom-werk|ov-werk|ov-kantoor|kantoorpakket|ondernemersos|zaakregie|office$|staff$)/],
  ['travelos',/^(bk-reizen|bk-verblijf|bk-reiswijzer|dom-reisbureau|avondos|arrival|instantreality)$/],
  ['livingos',/^(dom-thuis|dom-residentie|dom-home|vastgoed|verzorging)$/],
  ['foundationos',/^(foundation|werk-rtf|dom-rtf|rugdekking|levenos)/],
  ['libraryos',/^(dom-library|dom-boeken|ov-krant)$/],
  ['academy',/^(leerhuis|dom-les|dom-leerstof|dom-onderwijs|ov-bijles|rtf-leerpaspoort)$/],
  ['talent',/^(carriereledger|dom-metier|dom-vak|member-werk|werving|supplier-apply|vakbewijs)$/],
  ['hospitality',/^(gastos|supplier-haccp|supplier-pos|supplier-rooms|supplier-salon|bk-eten)$/],
  ['mobility',/^(mobiliteit|ov$|flits|onderweg|bk-ritten|bk-bezorgen|verhuur|charter|dom-move|dom-nav|dom-lucht|supplier-ride)$/],
  ['commerce',/^(commerce|bestellen|retail|groothandel|dom-mall|dom-verkoop|dom-facturen|supplier-finance|dom-appstore.*|ov-suppliers)$/],
  ['living-world',/^(experience-platform|wereld|dom-plaats|ov-stad)$/],
  ['world-network',/^(connect|socialewereld|zakelijk|dom-genootschap)$/],
  ['living-lab',/^(dom-lab|dom-livinglab)/],['saloon',/^(salon|kern-waardering)$/],
  ['community-events',/^(social|rtf-contacten|ontmoetingen|vonk|supplier-events|bk-tickets|tickets|fs-.*|dom-agenda|dom-meet)$/],
  ['communication',/^(member-dm|member-snaps|member-connect|connectionos|kern-berichten|kern-comm|kern-meldingen|service-bel|ondertiteling|rtf-samen|ov-mail-binnen)$/],
  ['service-support',/^(service|stuur|dom-foutmelder)$/],['files-documents',/^(dom-bestanden|dom-notities|dom-asset|ov-media|kern-memo|dom-site|dom-eigendomein)$/],
  ['identity-organizations',/^(member$|supplier$|tenant|tg-.*|dom-rtgid|dom-onboarding|dom-veiligheid|dom-kmar|dom-beschermdeur|verificatie|paspoort|webauthn|eigenaarherstel)$/],
  ['pay',/^(betalen|wbw|geldwereld|dom-rekening|dom-bank.*|dom-wallet|dom-pay.*|dom-partner.*|dom-kosten|gld-.*)$/],
  ['governance',/^(democratie.*|rtgone|dom-samen|dom-overheid|dom-gemeente|vertegenwoordiging|contracten)$/],
  ['edge-ai',/^(kern-rahul|ov-aandacht|dom-bank-advies|ghost|oog|knelpunt)$/],
  ['health-care',/^(dom-care|ov-zorgprofiel|medicijnen|noodkaart)$/],
  ['personal-life',/^(rechterhand|privekantoor|life|doelen|dagmetingen|gemoed|gewoonten|gedachten|training|tijdlijn|voeding|neiging|rust|kern-locatie|ov-spar)$/],
  ['media-culture',/^(podium|theater|mediaos|clips|dom-muziek|dom-galerij|dom-sport|dom-fluister|spellen)$/],
  ['foundationos',/^(opvangwijzer|office-school)$/],
  ['physical-commerce',/^(dom-doos)$/],
  ['platform',/.*/]
]);

const PROHIBITED=new Set(['gedachten','member-dm','dom-notities','rtf-samen','noodkaart']);
const NO_VALUE=new Set(['kern-state','kern-live','kern-klok','kern-gids','ov-media','dom-asset','ov-browser','kern-taal']);
const HUMAN=new Set([
  'dagmetingen','gemoed','medicijnen','ov-zorgprofiel','dom-care','opvangwijzer','dom-beschermdeur',
  'tg-inlog','tg-pin','tg-sso','tg-gegevens','tg-aanmeld','dom-rtgid','paspoort','verificatie','webauthn',
  'vonk','ontmoetingen','dom-kmar','dom-veiligheid','foundation','foundation-school','rugdekking',
  'dom-rekening','dom-bank-inzicht','dom-bank-vastelasten','dom-bank-spaardoel','dom-bank-rekening-open',
  'dom-bank-storten','dom-bank-sepa','dom-bank-incasso','dom-bank-passen','dom-bank-krediet','dom-bank-zakelijk',
  'dom-wallet','dom-pay-wallet','dom-pay-tegoed','dom-pay-tegoed-zaak','dom-pay-terug','dom-pay-vooraf',
  'dom-partner-uitbetaling','gld-munt','gld-rekening','gld-splitsen','gld-aitegoed','betalen'
]);
const PROVEN=new Set(['loop-fabric']);
const PARTIAL=new Set(['bedrijf','leerhuis','experience-platform','dom-livinglab','dom-library']);

function domainFor(capability) {
  for (const [domain,matcher] of DOMAINS) if (matcher.test(capability.id)) return domain;
  return 'platform';
}

function sensitivityFor(id,domain) {
  if (PROHIBITED.has(id)) return 'private-content';
  if (HUMAN.has(id)) return ['pay','identity-organizations'].includes(domain)?'regulated':'special-category-or-vulnerable';
  if (['communication','personal-life'].includes(domain)) return 'personal';
  if (['foundationos','talent'].includes(domain)) return 'high-impact';
  return ['workos','hospitality','commerce','mobility'].includes(domain)?'internal-or-transactional':'ordinary';
}

function memoryFor(status,domain) {
  if (status==='PROHIBITED_FROM_LEARNING') return {classes:[],retention:'NO_ARTIFACT',promotion:'FORBIDDEN'};
  if (status==='NO_LEARNING_VALUE') return {classes:[],retention:'NOT_APPLICABLE',promotion:'NOT_APPLICABLE'};
  const classes=domain==='livingos'?['DOMAIN_ASSET']:domain==='living-world'?['DOMAIN_ASSET','COMMONS']:
    domain==='personal-life'?['PERSONAL']:['ORGANIZATIONAL'];
  return {classes,retention:status==='HUMAN_REVIEW_REQUIRED'?'UNDECIDED_BLOCKS_LEARNING':'SOURCE_OWNED_EXPLICIT',
    promotion:'SEPARATE_ELIGIBILITY_REQUIRED'};
}

function classify(capability,evidence) {
  const domain=domainFor(capability),id=capability.id;
  let status,reason;
  if (PROHIBITED.has(id)) { status='PROHIBITED_FROM_LEARNING'; reason='De primaire flow bevat bewust private inhoud; alleen afzonderlijke, inhoudsvrije technische incidenten mogen later apart worden beoordeeld.'; }
  else if (NO_VALUE.has(id)) { status='NO_LEARNING_VALUE'; reason='Deze capability is een read model, transport- of presentatielaag en bezit geen semantische leeruitkomst.'; }
  else if (HUMAN.has(id)) { status='HUMAN_REVIEW_REQUIRED'; reason='De flow raakt gereguleerde, hoog-impact- of bijzondere persoonsgegevens; code kan de vereiste rechtsgrond niet vaststellen.'; }
  else if (PROVEN.has(id)) { status='LOOP_CAPABLE'; reason='De gedeelde Fabric-contracten, delivery, privacy lifecycle en recall zijn door gerichte tests bewezen.'; }
  else if (PARTIAL.has(id)) { status='PARTIALLY_LOOP_CAPABLE'; reason='Minstens één semantische flow is bewezen, maar de capability als geheel heeft nog geen expliciete deelnamekeuze per mutatiepunt.'; }
  else if (!evidence.mutationRoutes && !evidence.signals.length) { status='NO_LEARNING_VALUE'; reason='Er is in de actuele handlers geen semantisch mutatie- of uitkomstsignaal aangetroffen; bij nieuwe state verandert deze keuze.'; }
  else { status='NOT_YET_LOOP_CAPABLE'; reason='Er bestaan betekenisvolle mutaties of uitkomsten, maar geen bewezen eligibility → change → recall-contract voor deze capability.'; }
  const sensitivity=sensitivityFor(id,domain),memory=memoryFor(status,domain);
  return {domain,status,reason,sensitivity,memory};
}

module.exports={CLASSIFICATIONS,domainFor,classify};
