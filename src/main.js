import { loadState } from './state.js';
import { TownGame } from './game.js';
import { initUI } from './ui.js';
import { initMultiplayer } from './mp-ui.js';

const state = loadState();

// Landscape-first: try the native Screen Orientation API when supported.
// Browsers may reject this outside an installed PWA/fullscreen; the CSS portrait fallback
// still presents the game as a rotated landscape surface without blocking the player.
async function lockLandscape(){
  try{
    if(screen.orientation?.lock) await screen.orientation.lock('landscape');
  }catch(_){}
}
lockLandscape();
window.addEventListener('pointerdown',lockLandscape,{once:true,passive:true});
window.addEventListener('touchstart',lockLandscape,{once:true,passive:true});

const canvas=document.getElementById('game');
let ui;
const callbacks={
  openPet:(id)=>window.dispatchEvent(new CustomEvent('cg:openPet',{detail:id})),
  openTasks:(source='menu')=>ui?.openPanel('tasks',source),
  openShop:()=>ui?.openPanel('shop'),
  notify:(m)=>ui?.notify(m),
  refresh:()=>ui?.refresh(),
};
const game=new TownGame(canvas,state,callbacks);
ui=initUI(state,game);
const multiplayer=initMultiplayer(state,game,ui);
ui.setMultiplayer?.(multiplayer);

function updateWorldHud(){
  const target=game.interactionTarget;
  const hud=document.getElementById('interactionHud');
  if(hud){
    if(target){
      const active=(state.tasks||[]).filter(t=>t.status==='accepted').length;
      const open=(state.tasks||[]).filter(t=>t.status==='open').length;
      const label=target.type==='board'
        ? (active ? `E　${target.label} · 回報 ${active} 件` : open ? `E　${target.label} · ${open} 件新委託` : `E　${target.label}`)
        : `E　${target.label}`;
      hud.textContent=label;
      hud.classList.add('show');
    }else{
      hud.classList.remove('show');
    }
  }
  const dot=document.querySelector('.connection-dot');
  const stateEl=document.getElementById('connectionState');
  const connected=!!multiplayer?.mp?.connected;
  if(dot) dot.classList.toggle('online',connected);
  if(stateEl) stateEl.innerHTML=`<span class=\"connection-dot${connected?' online':''}\"></span>${connected?'線上同步':'本機冒險'}`;
  const onlineText=document.getElementById('onlineStatusText'); if(onlineText) onlineText.textContent=connected?'線上同步':'本機冒險'; const onlineCount=document.getElementById('onlineCount'); if(onlineCount) onlineCount.textContent=String(Object.values(state.remotePlayers||{}).filter(p=>p?.remote).length+1);
}
setInterval(updateWorldHud,250);
let lastSentX=null,lastSentY=null,lastSentAt=0;
setInterval(async()=>{
  const mp=multiplayer?.mp;
  if(!mp?.connected||!mp.guildId)return;
  const x=Math.round(state.player.x),y=Math.round(state.player.y),now=Date.now();
  if(x===lastSentX&&y===lastSentY&&now-lastSentAt<2000)return;
  try{
    await mp.trackPlayer(state.player);
    lastSentX=x; lastSentY=y; lastSentAt=now;
  }catch(e){
    ui?.notify?.('⚠️ 玩家位置同步失敗：'+(e?.message||e));
  }
},500);

// Touch joystick
const joystick=document.getElementById('joystick');
const stick=document.getElementById('stick');
let joyPointer=null;
function updateJoy(e){
  const r=joystick.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; const dx=e.clientX-cx, dy=e.clientY-cy; const max=31; const len=Math.hypot(dx,dy)||1; const scale=Math.min(1,max/len); const x=dx*scale,y=dy*scale; stick.style.transform=`translate(${x}px,${y}px)`; game.setJoystick(x/max,y/max);
}
joystick.addEventListener('pointerdown',e=>{joyPointer=e.pointerId; joystick.setPointerCapture(e.pointerId); updateJoy(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer) updateJoy(e);});
const clearJoy=()=>{joyPointer=null;stick.style.transform='translate(0,0)';game.setJoystick(0,0);};
joystick.addEventListener('pointerup',clearJoy); joystick.addEventListener('pointercancel',clearJoy);

// PWA install prompt
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredInstall=e; document.getElementById('installTip').style.display='block';});
document.getElementById('installBtn').onclick=async()=>{ if(!deferredInstall)return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null; document.getElementById('installTip').style.display='none'; };
window.addEventListener('appinstalled',()=>document.getElementById('installTip').style.display='none');
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));
