/* Zet de gedeelde stijlkern in elk artboard. De .dc.html-bestanden moeten
   zelfstandig zijn, dus de kern wordt INGEZET en niet ingelezen -- maar hij
   staat op een plek, zodat zes artboards niet uit elkaar lopen. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const stijl = readFileSync(new URL('./_stijl.css', import.meta.url), 'utf8');
const delen = readdirSync(new URL('./delen/', import.meta.url)).filter((f) => f.endsWith('.part.html'));

for (const deel of delen) {
  const naam = deel.replace(/\.part\.html$/, '');
  const bron = readFileSync(new URL('./delen/' + deel, import.meta.url), 'utf8');
  if (!bron.includes('<!--STIJL-->')) throw new Error(deel + ' mist de stijlmarkering');
  writeFileSync(new URL('./' + naam + '.dc.html', import.meta.url), bron.replace('<!--STIJL-->', stijl));
  console.log('geschreven: ' + naam + '.dc.html');
}
