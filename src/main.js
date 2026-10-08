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

// Mobile movement: no on-screen joystick.
// Long-press the world, then drag in the direction you want to walk.
// Desktop remains WASD / arrow keys through TownGame's keyboard handler.
let touchPointer=null;
let touchStart={x:0,y:0};
let touchActive=false;
let touchTimer=null;

function touchVector(e){
  const dx=e.clientX-touchStart.x;
  const dy=e.clientY-touchStart.y;
  const len=Math.hypot(dx,dy);
  if(len<10) return {x:0,y:0};
  const x=Math.max(-1,Math.min(1,dx/Math.max(32,len)));
  const y=Math.max(-1,Math.min(1,dy/Math.max(32,len)));
  if(Math.abs(dx)>=Math.abs(dy)) return {x:Math.sign(dx),y:0};
  return {x:0,y:Math.sign(dy)};
}

function endTouch(){
  if(touchTimer){clearTimeout(touchTimer);touchTimer=null;}
  touchPointer=null;
  touchActive=false;
  game.setJoystick(0,0);
}

canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch') return;
  touchPointer=e.pointerId;
  touchStart={x:e.clientX,y:e.clientY};
  touchActive=false;
  canvas.setPointerCapture?.(e.pointerId);
  touchTimer=setTimeout(()=>{
    touchActive=true;
    const v=touchVector(e);
    if(v.x===0 && v.y===0){
      const r=canvas.getBoundingClientRect();
      const dx=e.clientX-(r.left+r.width/2);
      const dy=e.clientY-(r.top+r.height/2);
      if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>35) game.setJoystick(Math.sign(dx),0);
      else if(Math.abs(dy)>35) game.setJoystick(0,Math.sign(dy));
      else game.setJoystick(0,Math.sign(dy));
    }else game.setJoystick(v.x,v.y);
  },140);
},{passive:true});

canvas.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch'||e.pointerId!==touchPointer||!touchActive) return;
  const v=touchVector(e);
  game.setJoystick(v.x,v.y);
},{passive:true});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===touchPointer) endTouch();},{passive:true});
canvas.addEventListener('pointercancel',e=>{if(e.pointerId===touchPointer) endTouch();},{passive:true});

// PWA install prompt
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredInstall=e; document.getElementById('installTip').style.display='block';});
document.getElementById('installBtn').onclick=async()=>{ if(!deferredInstall)return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null; document.getElementById('installTip').style.display='none'; };
window.addEventListener('appinstalled',()=>document.getElementById('installTip').style.display='none');
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));
