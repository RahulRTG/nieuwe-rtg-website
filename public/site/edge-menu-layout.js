/* Owner-preserving menu composition. Only presentation wrappers are owned here;
   native service nodes and their text always remain authoritative. */
(function(w,d){'use strict';
 w.RTGPublicEdgeLayout=function(o){
  var pages=o.pages,flow=o.flow,gallery=o.gallery,art=o.art,sheet=o.sheet;
  var discoverArt=o.discoverArt,discoverService=o.discoverService,artPlace=o.artPlace,desktopFolio=o.desktopFolio;
  var leaves=[],wrappers=[],owners=[],summaries=[],captionSplit=null;
  var atomic='a,button,summary,p,h1,h2,h3,h4,small,form,fieldset,label,dl,img,input,textarea,select,.ds-issue-controls';
  function restorePages(){
   if(captionSplit){
    var split=captionSplit,children=Array.from(split.node.childNodes);
    // Restore only our untouched fragments. A native textContent render wins.
    if(children.length===split.spans.length&&children.every(function(child,i){return child===split.spans[i];})&&split.node.textContent===split.text)split.node.replaceChildren.apply(split.node,split.original);
    else split.spans.forEach(function(span){if(span.parentNode===split.node)span.replaceWith.apply(span,Array.from(span.childNodes));});
    captionSplit=null;
   }
   if(gallery)gallery.classList.remove('ds-edge-gallery-paged');
   wrappers.forEach(function(leaf){if(leaf.isConnected)leaf.replaceWith.apply(leaf,Array.from(leaf.childNodes));});
   owners.forEach(function(owner){owner.classList.remove('ds-edge-owner','ds-edge-details');});
   summaries.forEach(function(summary){summary.classList.remove('ds-edge-leaf','ds-edge-summary-leaf');});
   wrappers=[];owners=[];summaries=[];leaves=[];
  }
  function visible(node){return !node.hidden&&w.getComputedStyle(node).display!=='none';}
  function own(node){
   node.classList.add('ds-edge-owner');owners.push(node);
   // Native openPanel forces display:block. Its original root remains visible
   // here through the DS owner contract, and native closePanel still owns it.
   if(node.matches('.experience-panel,.pp-menu-panel')&&node.style.getPropertyValue('display')==='block')node.style.removeProperty('display');
  }
  function newLeaf(owner,before,artwork){
   var leaf=d.createElement('div');leaf.className='ds-edge-leaf'+(artwork?' ds-edge-art-leaf':'');
   owner.insertBefore(leaf,before||null);wrappers.push(leaf);leaves.push(leaf);return leaf;
  }
  function packGallery(){
   var leaf=newLeaf(flow,gallery,true);leaf.append(gallery);
   if(leaf.scrollHeight<=pages.clientHeight+1)return;
   var caption=gallery.querySelector('figcaption'),paragraph=caption&&caption.querySelector('p');
   if(!paragraph||!paragraph.textContent)return;
   leaf.before(gallery);leaf.remove();wrappers=wrappers.filter(function(item){return item!==leaf;});leaves=leaves.filter(function(item){return item!==leaf;});
   gallery.classList.add('ds-edge-gallery-paged');own(gallery);own(caption);own(paragraph);
   var imageLeaf=newLeaf(gallery,art,true);imageLeaf.append(art);
   var text=paragraph.textContent,original=Array.from(paragraph.childNodes),spans=[],tokens=text.match(/\S+\s*|\s+/g)||[],current=null;
   paragraph.replaceChildren();captionSplit={node:paragraph,original:original,spans:spans,text:text};
   function fragment(){var span=d.createElement('span');span.className='ds-edge-leaf ds-edge-caption-leaf';paragraph.append(span);spans.push(span);leaves.push(span);return span;}
   tokens.forEach(function(token){
    if(!current)current=fragment();
    var previousText=current.textContent;current.textContent=previousText+token;
    if(current.scrollHeight<=pages.clientHeight+1)return;
    if(previousText){current.textContent=previousText;current=fragment();current.textContent=token;}
    if(current.scrollHeight<=pages.clientHeight+1)return;
    // An unusually long unbroken word can also continue on the next leaf.
    current.textContent='';Array.from(token).forEach(function(character){
     var before=current.textContent;current.textContent=before+character;
     if(before&&current.scrollHeight>pages.clientHeight+1){current.textContent=before;current=fragment();current.textContent=character;}
    });
   });
  }
  function pack(owner){
   if(!visible(owner))return;
   if(owner.matches(atomic)){var single=newLeaf(owner.parentNode,owner,false);single.append(owner);return;}
   own(owner);var leaf=null;
   Array.from(owner.children).forEach(function(node){
    if(!visible(node))return;
    if(node.tagName==='DETAILS'){
     leaf=null;own(node);node.classList.add('ds-edge-details');
     var summary=Array.from(node.children).find(function(child){return child.tagName==='SUMMARY';});
     if(summary){summary.classList.add('ds-edge-leaf','ds-edge-summary-leaf');summaries.push(summary);leaves.push(summary);}
     if(node.open)Array.from(node.children).forEach(function(child){if(child!==summary)pack(child);});
     return;
    }
    var artwork=node===gallery||(node.matches('.ds-discover-art')&&!desktopFolio());
    if(!artwork&&node.children.length&&!node.matches(atomic)){leaf=null;pack(node);return;}
    if(artwork){leaf=newLeaf(owner,node,true);leaf.append(node);leaf=null;return;}
    if(!leaf)leaf=newLeaf(owner,node,false);
    leaf.append(node);
    if(leaf.children.length>1&&leaf.scrollHeight>pages.clientHeight+1){var nextLeaf=newLeaf(owner,leaf.nextSibling,false);nextLeaf.append(node);leaf=nextLeaf;}
   });
  }
  function bookmark(leaf){
   if(!captionSplit||!captionSplit.spans.includes(leaf))return null;
   var offset=0;captionSplit.spans.some(function(span){if(span===leaf)return true;offset+=span.textContent.length;return false;});
   return {node:captionSplit.node,offset:offset};
  }
  function locate(mark){
   if(!mark||!mark.node.isConnected)return null;
   var target=mark.node.closest('.ds-edge-leaf');
   if(captionSplit&&captionSplit.node===mark.node){
    var start=0;target=captionSplit.spans.find(function(span){var end=start+span.textContent.length,contains=mark.offset>=start&&mark.offset<end;start=end;return contains;})||captionSplit.spans[captionSplit.spans.length-1];
   }
   return target;
  }
  function render(){
    restorePages();
    // On desktop the sheet's painted left page already supplies the artwork.
    // Keep the ORIGINAL art link in its original panel as a service caption;
    // phone layouts restore its image leaf. No duplicated links or handlers.
    if(artPlace){
     if(desktopFolio()){if(discoverArt.parentNode!==discoverService)discoverService.prepend(discoverArt);}
     else if(discoverArt.previousSibling!==artPlace)artPlace.after(discoverArt);
    }
    if(sheet.hidden)return leaves;
    if(pages.clientWidth<1||pages.clientHeight<1)return leaves;
    Array.from(flow.children).forEach(function(owner){
     if(!visible(owner))return;
     if(owner===gallery)packGallery();else pack(owner);
    });
    if(!leaves.length)newLeaf(flow,null,false);
    leaves=Array.from(pages.querySelectorAll('.ds-edge-leaf'));
    leaves.forEach(function(leaf){if(leaf.scrollHeight>pages.clientHeight+1)leaf.dataset.edgePageOverflow='true';else delete leaf.dataset.edgePageOverflow;});
   return leaves;
  }
  return {render:render,bookmark:bookmark,locate:locate};
 };
})(window,document);
