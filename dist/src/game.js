import { addJournal, addPetEvent, gainRewards, saveState } from './state.js';
import { getCoat, getPersonality } from './cats.js';

const W = 1280, H = 720;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export class TownGame {
  constructor(canvas, state, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.cb = callbacks;
    this.keys = new Set();
    this.joy = {x:0,y:0};
    this.time = 0;
    this.catReactions = new Map();
    this.catImages = { fly: new Image(), hu: new Image() };
    this.catImages.fly.src = '/assets/fly.png';
    this.catImages.hu.src = '/assets/hu.png';
    this.lastPetBrain = 0;
    this.lastSave = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Keyboard input: listen at document level and use KeyboardEvent.code.
    // This is more reliable across keyboard layouts than relying on e.key alone.
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    const keyDown = e => {
      const code = e.code || '';
      const key = (e.key || '').toLowerCase();
      const movement = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
      if (movement.has(code)) {
        this.keys.add(code);
        this.keys.add(key);
        e.preventDefault();
      }
      if (key === ' ' || code === 'Space') e.preventDefault();
    };
    const keyUp = e => {
      const code = e.code || '';
      const key = (e.key || '').toLowerCase();
      this.keys.delete(code);
      this.keys.delete(key);
    };
    document.addEventListener('keydown', keyDown, {capture:true});
    document.addEventListener('keyup', keyUp, {capture:true});
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('pointerdown', () => this.canvas.focus());
    this.bindPointer();
    requestAnimationFrame(t=>this.loop(t));
  }

  resize(){
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width*dpr);
    this.canvas.height = Math.round(rect.height*dpr);
    this.scaleX = this.canvas.width/W;
    this.scaleY = this.canvas.height/H;
  }

  bindPointer(){
    const getWorld = e => {
      const r = this.canvas.getBoundingClientRect();
      return {x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H};
    };
    this.canvas.addEventListener('pointerdown', e=>{
      const p=getWorld(e);
      for (const cat of Object.values(this.state.cats)) {
        if (Math.hypot(cat.x-p.x,cat.y-p.y)<42) { this.cb.openPet(cat.id); return; }
      }
    });
  }

  setJoystick(x,y){ this.joy.x=clamp(x,-1,1); this.joy.y=clamp(y,-1,1); }

  loop(ts){
    const dt=Math.min(0.04,(ts-(this._last||ts))/1000); this._last=ts; this.time=ts;
    this.update(dt); this.draw();
    requestAnimationFrame(t=>this.loop(t));
  }

  update(dt){
    const p=this.state.player;
    let x=0,y=0;
    if(this.keys.has('KeyW') || this.keys.has('w') || this.keys.has('ArrowUp') || this.keys.has('arrowup')) y-=1;
    if(this.keys.has('KeyS') || this.keys.has('s') || this.keys.has('ArrowDown') || this.keys.has('arrowdown')) y+=1;
    if(this.keys.has('KeyA') || this.keys.has('a') || this.keys.has('ArrowLeft') || this.keys.has('arrowleft')) x-=1;
    if(this.keys.has('KeyD') || this.keys.has('d') || this.keys.has('ArrowRight') || this.keys.has('arrowright')) x+=1;
    if(!x&&!y){x=this.joy.x;y=this.joy.y;}
    const len=Math.hypot(x,y)||1;
    p.x=clamp(p.x+x/len*130*dt,90,W-90);
    p.y=clamp(p.y+y/len*130*dt,150,H-150);

    // Partner wanders in a small ring around the plaza.
    const q=this.state.partner;
    const a=this.time/5000;
    q.x=755+Math.cos(a)*100; q.y=430+Math.sin(a*1.35)*70;

    // Pet brain: cats choose between wandering and approaching either person.
    if(this.time-this.lastPetBrain>2300){ this.lastPetBrain=this.time; this.decideCat(); }
    for(const cat of Object.values(this.state.cats)) this.updateCat(cat,dt);

    if(this.time-this.lastSave>3000){ this.lastSave=this.time; saveState(this.state); }
  }

  decideCat(){
    const choices=[this.state.player,this.state.partner];
    for(const cat of Object.values(this.state.cats)){
      const personality=getPersonality(cat);
      const r=Math.random();
      if(cat.energy<18){ cat.state='sleep'; cat.target=null; continue; }
      if(cat.hunger>75 && Math.random()<personality.hunger){ cat.state='hungry'; cat.target=choices[Math.random()<.5?0:1]; continue; }
      const approachChance=personality.approach;
      if(r<approachChance){ cat.target=choices[Math.random()<.55?0:1]; cat.state='follow'; }
      else if(r<approachChance + personality.wander){ cat.target=null; cat.state='wander'; }
      else { cat.target=null; cat.state='idle'; }
    }
  }

  updateCat(cat,dt){
    const speed=cat.state==='sleep'?0:cat.state==='follow'||cat.state==='hungry'?58:34;
    if(cat.state==='follow'||cat.state==='hungry'){
      const target=cat.target;
      if(target){
        const dx=target.x-cat.x,dy=target.y-cat.y,d=Math.hypot(dx,dy);
        if(d>58){ cat.x+=dx/d*speed*dt; cat.y+=dy/d*speed*dt; }
        else if(Math.random()<0.0025){
          const name=cat.name;
          if(cat.state==='hungry') this.cb.notify(`${name}：喵～ 想吃飯了。`);
          else this.cb.notify(`${name}跑到你身邊撒嬌。`);
          addPetEvent(this.state, `${name}跑去找人撒嬌。`);
        }
      }
    } else if(cat.state==='wander') {
      cat.x+=Math.cos(this.time/1700+cat.id.length)*speed*0.35*dt;
      cat.y+=Math.sin(this.time/2100+cat.id.length*2)*speed*0.35*dt;
    }
    cat.x=clamp(cat.x,100,W-100); cat.y=clamp(cat.y,190,H-150);
    cat.hunger=clamp(cat.hunger+dt*0.25,0,100);
    cat.energy=clamp(cat.energy+(cat.state==='sleep'?dt*2:-dt*0.15),10,100);
  }

  interactPet(id,action){
    const cat=this.state.cats[id]; if(!cat) return;
    const near=Math.min(dist(cat,this.state.player),dist(cat,this.state.partner))<100;
    if(!near){ this.cb.notify(`${cat.name}跑太遠了，靠近一點再互動。`); return; }
    if(action==='feed'){
      if(this.state.food<=0){ this.cb.notify('貓罐頭吃完啦，先去商店補貨。'); return; }
      this.state.food-=1; cat.hunger=clamp(cat.hunger-40,0,100); cat.energy=clamp(cat.energy+8,0,100); cat.state='idle';
      addPetEvent(this.state, `${cat.name}吃飽了，開始舔毛。`);
      addJournal(this.state,'🍖',`${cat.name}吃飯`,`你餵了${cat.name}一份罐頭。`);
      this.cb.notify(`${cat.name}：呼嚕呼嚕…… 🍖`);
    }
    if(action==='play'){
      cat.energy=clamp(cat.energy-10,0,100); cat.hunger=clamp(cat.hunger+8,0,100); cat.state='wander';
      if(Math.random()<0.1){ addPetEvent(this.state, `${cat.name}玩到一半突然不玩了。`); this.cb.notify(`${cat.name}突然走掉了 XD`); }
      else { addPetEvent(this.state, `${cat.name}今天玩得很開心。`); addJournal(this.state,'🎾',`${cat.name}玩耍`,`陪${cat.name}玩了一下。`); this.cb.notify(`${cat.name}開心地追著玩具跑！`); }
    }
    if(action==='pet'){
      const bite=Math.random()<getPersonality(cat).bite;
      if(bite){
        cat.mood='今天不想被摸'; addPetEvent(this.state, `🦷 ${cat.name}突然咬了一口 XD`); addJournal(this.state,'🦷',`${cat.name}咬人`,`剛剛明明還在呼嚕，結果突然咬了一口。`); this.cb.notify(`🦷 ${cat.name}：「喀。」突然咬了一口 XD`); }
      else { cat.mood='正在呼嚕'; addPetEvent(this.state, `${cat.name}被摸得很開心。`); this.cb.notify(`${cat.name}：呼嚕呼嚕 ❤️`); }
    }
    saveState(this.state); this.cb.refresh();
  }

  draw(){
    const c=this.ctx; c.setTransform(this.scaleX,0,0,this.scaleY,0,0); c.clearRect(0,0,W,H);
    this.drawWorld(c);
    this.drawCharacter(c,this.state.partner,true);
    this.drawCharacter(c,this.state.player,false);
    for(const cat of Object.values(this.state.cats)) this.drawCat(c,cat);
  }

  drawWorld(c){
    c.fillStyle='#bcd4bd'; c.fillRect(0,0,W,H);
    // layered grass tiles
    for(let y=140;y<H;y+=40) for(let x=0;x<W;x+=40){ c.fillStyle=((x/40+y/40)%2?'#b8d0b7':'#c2d9bf'); c.fillRect(x,y,40,40); }
    // river
    c.fillStyle='#96c4c2'; c.fillRect(0,150,W,70); c.fillStyle='#a8d2cf'; for(let x=0;x<W;x+=36) c.fillRect(x,180,22,3);
    // main plaza
    c.fillStyle='#e6d8bb'; c.beginPath(); c.ellipse(660,430,430,235,0,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(113,95,61,.28)'; c.lineWidth=4; c.stroke();
    // paths
    c.fillStyle='#d9c9a8'; c.fillRect(610,215,100,215); c.fillRect(220,385,900,90);
    // buildings
    this.drawHouse(c,160,95,285,135,'公會之家','#7a8fb1');
    this.drawHouse(c,850,90,265,130,'雜貨商店','#ce9e63');
    this.drawBoard(c,500,185);
    // garden plots
    this.drawPlot(c,480,80,280,78); this.drawPlot(c,1120,270,100,130);
    // lamps / benches / trees
    for(const [x,y] of [[90,270],[1160,250],[230,575],[1020,570]]) this.drawLamp(c,x,y);
    for(const [x,y] of [[180,505],[1080,490]]) this.drawBench(c,x,y);
    for(const [x,y,s] of [[60,100,1.1],[1140,110,.9],[80,620,.85],[1200,620,1.15],[350,250,.65],[945,500,.6]]) this.drawTree(c,x,y,s);
    // plaza fountain
    c.fillStyle='#aac0bb'; c.beginPath(); c.arc(660,430,48,0,Math.PI*2); c.fill(); c.strokeStyle='#879f98'; c.stroke();
    c.fillStyle='#84b3b1'; c.beginPath(); c.arc(660,430,35,0,Math.PI*2); c.fill();
    c.fillStyle='#fff0c2'; c.beginPath(); c.arc(660,430,7,0,Math.PI*2); c.fill();
    // title board label
    c.fillStyle='#5c5a4b'; c.font='700 16px ui-rounded, system-ui'; c.textAlign='center'; c.fillText('星光旅團中央廣場',660,115);
  }

  drawHouse(c,x,y,w,h,label,roof){
    c.fillStyle='#f5ecd8'; c.fillRect(x,y,w,h); c.fillStyle=roof; c.beginPath(); c.moveTo(x-12,y); c.lineTo(x+w/2,y-72); c.lineTo(x+w+12,y); c.closePath(); c.fill();
    c.fillStyle='#8d6e5a'; c.fillRect(x+w/2-24,y+70,48,60); c.fillStyle='#9fc8c5'; c.fillRect(x+28,y+45,48,38); c.fillRect(x+w-76,y+45,48,38);
    c.fillStyle='#5f6b62'; c.font='700 13px ui-rounded,system-ui'; c.textAlign='center'; c.fillText(label,x+w/2,y+h+22);
  }

  drawBoard(c,x,y){
    c.fillStyle='#7a5639'; c.fillRect(x,y,190,76); c.fillStyle='#c39b67'; c.fillRect(x+12,y+10,166,52); c.strokeStyle='#6b4b32'; c.strokeRect(x+12,y+10,166,52); c.fillStyle='#fff1cb'; c.font='700 15px ui-rounded,system-ui'; c.textAlign='center'; c.fillText('📜 公會委託板',x+95,y+42); c.fillStyle='#6b4b32'; c.fillRect(x+95,y+76,8,45);
  }

  drawPlot(c,x,y,w,h){ c.fillStyle='#7f9d73'; c.fillRect(x,y,w,h); for(let yy=y+8;yy<y+h-4;yy+=24){ for(let xx=x+8;xx<x+w-8;xx+=30){ c.fillStyle=['#6f8d62','#809b66','#8fa66d'][(xx/30+yy/24)%3|0]; c.fillRect(xx,yy,16,10); } } }
  drawLamp(c,x,y){ c.fillStyle='#655641'; c.fillRect(x-4,y-55,8,55); c.fillStyle='#fff0c9'; c.beginPath(); c.arc(x,y-65,15,0,Math.PI*2); c.fill(); c.fillStyle='#836d4f'; c.beginPath(); c.arc(x,y-65,6,0,Math.PI*2); c.fill(); }
  drawBench(c,x,y){ c.fillStyle='#8d6d4d'; c.fillRect(x,y,72,10); c.fillRect(x,y+22,72,8); c.fillRect(x+5,y+29,7,20); c.fillRect(x+60,y+29,7,20); }
  drawTree(c,x,y,s){ c.fillStyle='#6e523d'; c.fillRect(x-7*s,y+24*s,14*s,34*s); c.fillStyle='#7da16f'; for(const [dx,dy,r] of [[0,0,34],[28,6,28],[-26,8,28],[6,26,26]]){ c.beginPath(); c.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2); c.fill(); } }

  drawCharacter(c,ch,isPartner){
    const bob=Math.sin(this.time/260 + (isPartner?1:0))*1.2;
    c.save(); c.translate(ch.x,ch.y+bob); c.fillStyle='rgba(46,61,50,.18)'; c.beginPath(); c.ellipse(0,20,18,7,0,0,Math.PI*2); c.fill();
    c.fillStyle=ch.shirt; c.fillRect(-12,-2,24,25); c.fillStyle=ch.skin; c.beginPath(); c.arc(0,-14,12,0,Math.PI*2); c.fill(); c.fillStyle='#4b3b36'; c.beginPath(); c.arc(-2,-20,11,Math.PI,Math.PI*2); c.fill(); c.fillStyle='#f6eedf'; c.fillRect(-9,14,7,12); c.fillRect(2,14,7,12); c.restore();
    c.fillStyle='#2f4138'; c.font='700 11px ui-rounded,system-ui'; c.textAlign='center'; c.fillText(ch.name,ch.x,ch.y-33);
  }

  drawCat(c,cat){
    const coat=getCoat(cat);
    const bob=cat.state==='sleep'?0:Math.sin(this.time/190 + cat.x)*1.7;
    const near=Math.min(dist(cat,this.state.player),dist(cat,this.state.partner))<90;
    const sprite=cat.coat==='custom' ? this.catImages[cat.id] : null;
    c.save(); c.translate(cat.x,cat.y+bob);
    c.fillStyle='rgba(47,56,45,.16)'; c.beginPath(); c.ellipse(0,18,20,7,0,0,Math.PI*2); c.fill();
    if(sprite && sprite.complete && sprite.naturalWidth){
      const targetH=88;
      const ratio=sprite.naturalWidth/sprite.naturalHeight;
      const targetW=targetH*ratio;
      c.drawImage(sprite,-targetW/2,-targetH+18,targetW,targetH);
    } else {
      const isBlack=cat.coat==='black';
      c.strokeStyle=coat.tail; c.lineWidth=5; c.lineCap='round'; c.beginPath(); c.moveTo(13,4); c.quadraticCurveTo(30,-8,22,-22); c.stroke();
      c.fillStyle=coat.base; c.beginPath(); c.roundRect(-17,-10,34,30,12); c.fill();
      c.beginPath(); c.moveTo(-14,-8); c.lineTo(-9,-27); c.lineTo(0,-11); c.fill(); c.beginPath(); c.moveTo(14,-8); c.lineTo(9,-27); c.lineTo(0,-11); c.fill();
      if(cat.coat!=='custom'){ c.fillStyle=coat.dark; c.beginPath(); c.arc(-7,-5,8,0,Math.PI*2); c.fill(); c.fillStyle=coat.patch; c.beginPath(); c.arc(9,4,7,0,Math.PI*2); c.fill(); }
      if(isBlack){ c.fillStyle=coat.patch; c.beginPath(); c.ellipse(-7,-4,8,6,0,0,Math.PI*2); c.fill(); c.fillStyle='#f1f0e8'; c.beginPath(); c.ellipse(7,3,7,5,0,0,Math.PI*2); c.fill(); }
      c.fillStyle='#2d342f'; c.beginPath(); c.arc(-7,0,2.4,0,Math.PI*2); c.arc(7,0,2.4,0,Math.PI*2); c.fill(); c.fillStyle='#c98888'; c.beginPath(); c.arc(0,7,3,0,Math.PI*2); c.fill();
      c.strokeStyle='#776f63'; c.lineWidth=1; c.beginPath(); c.moveTo(-3,7); c.lineTo(-18,4); c.moveTo(3,7); c.lineTo(18,4); c.stroke();
    }
    c.restore();
    c.fillStyle='#514d45'; c.font='800 10px ui-rounded,system-ui'; c.textAlign='center'; c.fillText(cat.name,cat.x,cat.y-48);
    if(near && Math.floor(this.time/800)%2===0){ c.fillStyle='#ffcad2'; c.font='18px system-ui'; c.fillText('♥',cat.x+30,cat.y-30); }
    if(cat.state==='hungry'){ c.fillStyle='#fff1c6'; c.font='16px system-ui'; c.fillText('🍖',cat.x,cat.y-62); }
    if(cat.state==='sleep'){ c.fillStyle='#fff1c6'; c.font='13px system-ui'; c.fillText('Zzz',cat.x+24,cat.y-34); }
  }}
