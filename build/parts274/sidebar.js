/* Right-opening navigation flyouts; original destination controls keep their handlers. */
(() => {
  'use strict';
  const sections=[['departments','Teams','<circle cx="8" cy="7" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M22 20v-2a6 6 0 0 0-4-5.65"/>'],['org','Organization','<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="2" y="16" width="7" height="6" rx="1"/><rect x="15" y="16" width="7" height="6" rx="1"/><path d="M12 8v4M5.5 16v-4h13v4"/>'],['tools','Other tools','<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>']];
  let open=null,bar=null,observer=null,scheduled=false;
  const groupOf=key=>bar.querySelector(`:scope > .tab-group[data-w42g="${key}"]`);
  const setPosition=(group,key,value)=>{if(group.style.getPropertyValue(key)!==value)group.style.setProperty(key,value);};
  function position(group){
    const heading=group.querySelector(':scope > .tab-group-h');
    const panel=group.querySelector(':scope > .tab-group-p');
    const nav=bar.closest('nav');
    if(!heading||!panel||panel.hidden||!nav)return;
    const anchor=heading.getBoundingClientRect();
    const left=innerWidth<=900?12:Math.round(nav.getBoundingClientRect().right+8);
    const width=Math.min(292,innerWidth-left-16);
    setPosition(group,'--nav-flyout-left',left+'px');
    setPosition(group,'--nav-flyout-width',Math.max(200,width)+'px');
    const height=panel.getBoundingClientRect().height;
    const top=Math.max(16,Math.min(anchor.top,innerHeight-height-16));
    setPosition(group,'--nav-flyout-top',Math.round(top)+'px');
  }
  function close(restoreFocus=false){
    const previous=open;open=null;sync();
    if(restoreFocus&&previous)groupOf(previous)?.querySelector(':scope > .tab-group-h')?.focus({preventScroll:true});
  }
  function sync(){
    scheduled=false;
    if(!bar)return;
    bar.dataset.uiNavigation='true';
    if(observer)observer.disconnect();
    const active=bar.querySelector('.tab.active');
    const currentGroup=active?.closest('.tab-group')?.getAttribute('data-w42g');
    for(const[key,label,icon]of sections){
      const group=groupOf(key);if(!group)continue;
      const heading=group.querySelector(':scope > .tab-group-h');
      const panel=group.querySelector(':scope > .tab-group-p');
      if(!heading||!panel)continue;
      group.dataset.navSection=key;
      const count=[...panel.children].filter(item=>[...item.querySelectorAll('.tab'),...(item.matches('.tab')?[item]:[])].some(tab=>tab.style.display!=='none'&&getComputedStyle(tab).display!=='none')).length;
      group.hidden=count===0;
      const signature=label+':'+count;
      if(heading.dataset.navSignature!==signature||!heading.querySelector('.nav-section-title')){
        heading.innerHTML=`<span class="nav-section-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icon}</svg></span><span class="nav-section-title">${label}</span><span class="nav-section-count" data-count="${count}" aria-hidden="true"></span><svg class="nav-section-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>`;
        heading.dataset.navSignature=signature;
      }
      heading.type='button';heading.id='nav-section-'+key;panel.id='nav-panel-'+key;
      let flyoutHead=group.querySelector(':scope > .nav-flyout-head');
      if(!flyoutHead){
        flyoutHead=document.createElement('div');flyoutHead.className='nav-flyout-head';
        flyoutHead.innerHTML=`<strong id="nav-flyout-title-${key}">${label}</strong><button type="button" data-nav-flyout-close="${key}" aria-label="Close ${label} menu"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg></button>`;
        group.appendChild(flyoutHead);
      }
      heading.setAttribute('aria-label',label);
      heading.setAttribute('aria-controls',panel.id);
      heading.setAttribute('aria-expanded',String(open===key));
      heading.dataset.current=String(currentGroup===key);
      panel.hidden=open!==key;
      flyoutHead.hidden=open!==key;
      panel.setAttribute('role','group');panel.setAttribute('aria-labelledby','nav-flyout-title-'+key);
      for(const row of panel.querySelectorAll('.w42d')){
        const main=row.querySelector(':scope > .tab');
        const direct=!!main&&main.style.display!=='none';
        row.classList.toggle('nav-team-direct',direct);
        const sub=row.querySelector(':scope > .w42sub');
        if(sub){sub.hidden=direct;sub.inert=direct;}
      }
      if(open===key)position(group);
    }
    observer.observe(bar,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  }
  function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(sync);}}
  function bind(){
    const next=document.getElementById('tabBar');if(!next)return;
    if(bar!==next){bar=next;if(observer)observer.disconnect();observer=new MutationObserver(queue);bar.closest('nav')?.addEventListener('scroll',queue,{passive:true});}
    sync();
  }
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-nav-flyout-close]')){event.preventDefault();event.stopImmediatePropagation();close(true);return;}
    const heading=event.target.closest?.('#tabBar .tab-group[data-nav-section] > .tab-group-h');
    if(!heading){
      if(open&&event.target.closest?.('#tabBar .tab, #tabBar .tab-group-p a[href]'))setTimeout(()=>close(),0);
      return;
    }
    event.preventDefault();event.stopImmediatePropagation();
    const key=heading.parentElement.dataset.navSection;
    open=open===key?null:key;sync();
  },true);
  document.addEventListener('pointerdown',event=>{if(open&&!groupOf(open)?.contains(event.target))close();},true);
  document.addEventListener('keydown',event=>{
    if(open&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);return;}
    const heading=event.target.closest?.('#tabBar .tab-group[data-nav-section] > .tab-group-h');
    if(heading&&event.key==='ArrowRight'){
      event.preventDefault();open=heading.parentElement.dataset.navSection;sync();
      const panel=groupOf(open).querySelector(':scope > .tab-group-p');
      [...panel.querySelectorAll('.tab')].find(t=>t.getClientRects().length&&getComputedStyle(t).display!=='none')?.focus();
    }
    if(open&&event.key==='ArrowLeft'&&groupOf(open)?.contains(event.target)){event.preventDefault();close(true);}
  },true);
  document.addEventListener('focusin',event=>{if(open&&!groupOf(open)?.contains(event.target))close();});
  window.addEventListener('hashchange',()=>close());
  window.addEventListener('resize',queue);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
