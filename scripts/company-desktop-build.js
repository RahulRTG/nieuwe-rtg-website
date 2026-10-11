/* Rebuild the separate company website from its captured content and the same
   canonical presentation assets as the application. No second theme copy. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const arg=name=>{const i=process.argv.indexOf('--'+name);return i<0?'':process.argv[i+1];};
const source=arg('source'),output=arg('output'),config=arg('config');
if(!source||!output||!config)throw new Error('Required: --source captured-company-content --config recovered-worker-config --output build-directory');
const src=path.resolve(source),out=path.resolve(output);
if(src===out||out===root||src.startsWith(out+path.sep))throw new Error('Use a separate build directory.');
const styles=['public/site/start/start-base.css','public/shared/rtg-heritage.css','public/shared/rtg-world-home.css','public/shared/rtg-world-desktop.css','public/shared/rtg-edge-system.css','public/shared/rtg-adaptive-edge.css','public/site/platform-shell.css','public/site/platform-company.css'];
const scripts=['public/site/platform-data.js','public/site/platform-stories.js','public/site/platform-company-data.js','public/site/platform-app-data.js','public/shared/i18n.js','public/shared/rtg-edge-icons.js','public/shared/rtg-adaptive-edge-core.js','public/shared/rtg-adaptive-edge-input.js','public/shared/rtg-adaptive-edge-controls.js','public/shared/rtg-adaptive-edge-services.js','public/shared/rtg-adaptive-edge.js','public/site/platform-elements.js','public/site/platform-widgets.js','public/site/platform-company-widget-copy.js','public/site/platform-company-widgets.js','public/site/platform-controller.js','public/site/platform-shell.js','public/site/platform-edge.js','public/site/platform-company.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),shared=[],copied=new Set();
fs.mkdirSync(out,{recursive:true});
function write(rel,data){const file=path.join(out,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
for(const rel of fs.readdirSync(src,{recursive:true})){
 const file=path.join(src,rel);if(!fs.statSync(file).isFile())continue;
 if(/^(?:site|styles)\.css$|^(?:language|script|site)\.js$|snapshot-manifest\.json$/.test(rel))continue;
 write(rel,fs.readFileSync(file));
}
function copy(rel){
 rel=path.normalize(rel);if(copied.has(rel))return;copied.add(rel);
 const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))throw new Error('Missing canonical asset: '+rel);
 const data=fs.readFileSync(file);write(rel,data);shared.push({file:rel,sha256:hash(data)});
 if(rel.endsWith('.css'))for(const match of data.toString().matchAll(/url\(['"]?([^)'"\s]+)/g)){
  const url=match[1];if(/^(?:https?:|data:|#)/.test(url))continue;
  copy(path.join(path.dirname(rel),url.split('?')[0]));
 }
}
[...styles,...scripts,'public/shared/bestand-upload.js','public/shared/interface/world-desktop-copy.js','public/shared/interface/personal-images.js','public/shared/interface/personal-image-editor.js','public/shared/interface/world-presentation.js','public/shared/interface/public-presentation.js'].forEach(copy);
for(const folder of ['public/images/platform','public/images/world-homes','public/images/editorial','public/fonts','public/shared/taalschil']){
 for(const rel of fs.readdirSync(path.join(root,folder)))if(!rel.endsWith('.css')&&fs.statSync(path.join(root,folder,rel)).isFile())copy(path.join(folder,rel));
}
for(const rel of fs.readdirSync(path.join(root,'public/shared')))if(/taal.*\.json$/.test(rel))copy('public/shared/'+rel);
const assets='<meta name="rtg-asset-base" content="/public"><meta name="rtg-api-base" content="https://app.rahultravelgroup.com"><meta name="rtg-app-base" content="https://app.rahultravelgroup.com/">'+styles.map(s=>'<link rel="stylesheet" href="/'+s+'">').join('')+scripts.map(s=>'<script src="/'+s+'" defer></script>').join('');
write('404.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | RTG</title></head><body><main><h1>Page not found</h1><p>This address is no longer available.</p><p><a href="/">Go to RTG</a></p></main></body></html>');
const pages=[];
for(const rel of fs.readdirSync(out,{recursive:true}).filter(f=>f.endsWith('.html')&&!f.startsWith('public/'))){
 let html=fs.readFileSync(path.join(out,rel),'utf8');
 html=require('./lib/script-bronnen')(html,src=>/(?:^|\/)(?:language|script|site)\.js(?:[?#]|$)/.test(src));
 html=html.replace(/<link\b[^>]+href="[^"]*\b(?:site|styles)\.css[^"]*"[^>]*>/g,'');
 html=html.replace(/(src|href|srcset)="\.\//g,'$1="/');
 html=html.replace('<body','<body class="rtg-stijl" data-rtg-skin="heritage" data-rtg-world="living" data-rtg-layout="standard" data-public-platform="company" data-company-page="'+(rel==='index.html'?'home':rel)+'"');
 html=html.replace('</head>',assets+'</head>');write(rel,html);pages.push(rel);
}
const previous=JSON.parse(fs.readFileSync(path.join(config,'current-version.json'),'utf8'));
const settings=previous.resources.script_runtime.assets;
write('_headers',settings.raw_headers);write('_redirects',settings.raw_redirects);
write('.assetsignore','DESKTOP-PROVENANCE.json\nsnapshot-manifest.json\nSTORYLINE-PROVENANCE.json\n');
write('DESKTOP-PROVENANCE.json',JSON.stringify({standard:'shared-warm-desktop-mobile-v2',builtAt:new Date().toISOString(),previousVersion:previous.id,pages,shared},null,2)+'\n');
console.log(pages.length+' company pages use '+shared.length+' canonical shared assets: '+out);
