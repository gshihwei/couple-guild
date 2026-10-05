import { loadState } from './state.js';
import { TownGame } from './game.js';
import { initUI } from './ui.js';

const state = loadState();
const canvas=document.getElementById('game');
let ui;
const callbacks={
  openPet:(id)=>window.dispatchEvent(new CustomEvent('cg:openPet',{detail:id})),
  notify:(m)=>ui?.notify(m),
  refresh:()=>ui?.refresh(),
};
const game=new TownGame(canvas,state,callbacks);
ui=initUI(state,game);

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
