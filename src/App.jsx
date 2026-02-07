import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as Tone from "tone";
/* eslint-disable no-unused-vars */

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════
const CONDITIONS = ["catatonia", "depression", "paranoid", "mania", "healthy"];
const COND_TR = { catatonia:"Katatoni", depression:"Depresyon", paranoid:"Paranoid", mania:"Mani", healthy:"Sağlıklı" };
const COND_CLR = { catatonia:"#00f5d4", depression:"#457b9d", paranoid:"#e63946", mania:"#ffbe0b", healthy:"#06d6a0" };
const COND_DESC = {
  catatonia: "Minimal hareket, rijid pattern, düşük entropi",
  depression: "Yavaş, sönümlü salınım, aşağı bakış eğilimi",
  paranoid: "Hızlı tarama, düzensiz sakkad, yüksek vijilans",
  mania: "Hiperkinetik, geniş aralık, maksimum entropi",
  healthy: "Dengeli dinamik, düzenli sakkadik ritim"
};

const PROFILES = {
  catatonia:  { eyeAmp:.12, eyeFreq:.25, mouthAmp:.04, browAmp:.06, chaos:.08, vel:.15, notes:["C3","D3","E3"], tempo:40, noteLen:"4n" },
  depression: { eyeAmp:.22, eyeFreq:.45, mouthAmp:.10, browAmp:.13, chaos:.20, vel:.35, notes:["D3","F3","A3","C4"], tempo:55, noteLen:"4n" },
  paranoid:   { eyeAmp:.55, eyeFreq:1.6, mouthAmp:.30, browAmp:.40, chaos:.65, vel:1.1, notes:["E4","G4","Bb4","C5","Eb5"], tempo:140, noteLen:"16n" },
  mania:      { eyeAmp:.75, eyeFreq:2.0, mouthAmp:.45, browAmp:.50, chaos:.80, vel:1.5, notes:["C4","E4","G4","B4","D5","F#5"], tempo:170, noteLen:"16n" },
  healthy:    { eyeAmp:.35, eyeFreq:.90, mouthAmp:.18, browAmp:.22, chaos:.30, vel:.65, notes:["C4","E4","G4","A4","C5"], tempo:90, noteLen:"8n" },
};

const VIZ_TYPES = [
  { id:"lissajous", label:"Lissajous", icon:"∞" },
  { id:"attractor", label:"Attractor", icon:"◎" },
  { id:"torus", label:"Torus Knot", icon:"⊛" },
];

// ═══════════════════════════════════════════════════════════
//  AUDIO ENGINE (Tone.js)
// ═══════════════════════════════════════════════════════════
class AudioEngine {
  constructor() {
    this.initialized = false;
    this.playing = false;
    this.synths = {};
    this.loops = {};
    this.currentCondition = null;
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();

    // Reverb + delay for atmosphere
    this.reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination();
    this.delay = new Tone.FeedbackDelay("8n", 0.15).connect(this.reverb);
    this.delay.wet.value = 0.2;

    // 5 instruments matching landmark mapping
    this.synths = {
      violin: new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, modulationIndex: 2,
        envelope: { attack: 0.15, decay: 0.3, sustain: 0.6, release: 0.8 },
        volume: -8
      }).connect(this.reverb),

      cello: new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2, oscillator: { type: "triangle" },
        envelope: { attack: 0.2, decay: 0.4, sustain: 0.7, release: 1.0 },
        volume: -10
      }).connect(this.reverb),

      trumpet: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth", partialCount: 8 },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.4 },
        volume: -12
      }).connect(this.delay),

      flute: new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.1, decay: 0.1, sustain: 0.8, release: 0.6 },
        volume: -14
      }).connect(this.reverb),

      oboe: new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.5, modulationIndex: 4,
        envelope: { attack: 0.08, decay: 0.15, sustain: 0.5, release: 0.5 },
        volume: -13
      }).connect(this.delay),
    };

    this.initialized = true;
  }

  playCondition(condition) {
    if (!this.initialized) return;
    this.stopAll();
    this.currentCondition = condition;

    const p = PROFILES[condition];
    Tone.getTransport().bpm.value = p.tempo;

    const synthNames = ["violin", "cello", "trumpet", "flute", "oboe"];
    const octaveOffsets = [0, -12, 0, 12, 0]; // semitone offset per instrument

    synthNames.forEach((name, idx) => {
      let noteIdx = 0;
      const transposeNote = (note, semitones) => {
        const freq = Tone.Frequency(note).toFrequency();
        return Tone.Frequency(freq * Math.pow(2, semitones / 12)).toNote();
      };

      this.loops[name] = new Tone.Loop((time) => {
        const notes = p.notes;
        // Each instrument picks notes differently for polyphony
        const pickIdx = (noteIdx + idx * 2) % notes.length;
        const note = transposeNote(notes[pickIdx], octaveOffsets[idx]);

        // Chaos affects velocity variation
        const velBase = 0.3 + p.chaos * 0.4;
        const velRand = Math.random() * p.chaos * 0.3;
        const velocity = Math.min(1, velBase + velRand);

        // Duration varies with chaos
        const durMult = 1 + (Math.random() - 0.5) * p.chaos;
        const dur = Tone.Time(p.noteLen).toSeconds() * durMult;

        try {
          this.synths[name].triggerAttackRelease(note, dur, time, velocity);
        } catch(e) {}

        noteIdx++;
      }, p.noteLen).start(idx * 0.1); // Stagger start times
    });

    Tone.getTransport().start();
    this.playing = true;
  }

  stopAll() {
    Object.values(this.loops).forEach(l => { try { l.stop(); l.dispose(); } catch(e){} });
    this.loops = {};
    Object.values(this.synths).forEach(s => { try { s.releaseAll(); } catch(e){} });
    Tone.getTransport().stop();
    this.playing = false;
  }

  toggle(condition) {
    if (this.playing && this.currentCondition === condition) {
      this.stopAll();
      return false;
    }
    this.playCondition(condition);
    return true;
  }

  dispose() {
    this.stopAll();
    Object.values(this.synths).forEach(s => { try { s.dispose(); } catch(e){} });
    try { this.reverb?.dispose(); this.delay?.dispose(); } catch(e){}
    this.initialized = false;
  }
}

// ═══════════════════════════════════════════════════════════
//  3D GENERATORS + RENDERER
// ═══════════════════════════════════════════════════════════
function genLissajous(t, p, n=350) {
  const d = [];
  for (let i=0; i<n; i++) {
    const s = (i/n)*Math.PI*4 + t*p.vel;
    d.push({
      x: Math.sin(s*p.eyeFreq + p.chaos*Math.sin(s*3.7)) * p.eyeAmp,
      y: Math.sin(s*p.eyeFreq*1.618 + p.chaos*Math.cos(s*2.3)) * p.browAmp,
      z: Math.cos(s*p.mouthAmp*5 + p.chaos*Math.sin(s*1.9)) * 0.5,
      s: i/n
    });
  }
  return d;
}

function genAttractor(t, p, n=500) {
  const d=[]; let x=.1,y=0,z=0;
  const dt=.005, sig=10*p.chaos+5, rho=28*p.eyeAmp+10, bet=(8/3)*p.vel+1;
  for(let i=0;i<n;i++){
    const dx=sig*(y-x), dy=x*(rho-z)-y, dz=x*y-bet*z;
    x+=dx*dt; y+=dy*dt; z+=dz*dt;
    d.push({x:x*.02*p.eyeAmp, y:y*.02*p.browAmp, z:z*.015*p.mouthAmp, s:i/n});
  }
  return d;
}

function genTorus(t, p, n=400) {
  const d=[], pp=Math.round(2+p.chaos*3), q=Math.round(3+p.eyeFreq*2);
  for(let i=0;i<n;i++){
    const phi=(i/n)*Math.PI*2+t*p.vel*.3;
    const r=.5+.2*Math.cos(q*phi);
    d.push({
      x:r*Math.cos(pp*phi)*p.eyeAmp, y:r*Math.sin(pp*phi)*p.browAmp,
      z:.2*Math.sin(q*phi)*p.mouthAmp*3, s:i/n
    });
  }
  return d;
}

function proj(x,y,z,rx,ry,sc,cx,cy){
  const cy_=Math.cos(ry),sy=Math.sin(ry),cx_=Math.cos(rx),sx=Math.sin(rx);
  const x1=x*cy_-z*sy, z1=x*sy+z*cy_, y1=y*cx_-z1*sx, z2=y*sx+z1*cx_;
  const p=2.5/(2.5+z2);
  return{px:cx+x1*sc*p, py:cy+y1*sc*p, depth:z2, p};
}

function drawViz(ctx, w, h, time, condition, vizType, rx, ry, pulse) {
  const p = PROFILES[condition];
  const clr = COND_CLR[condition];
  const cx=w/2, cy=h/2, sc=Math.min(w,h)*.34;

  // Background with subtle pulse when music plays
  const bgBright = pulse ? 0.06 : 0.02;
  ctx.fillStyle = `rgb(${Math.round(bgBright*255)},${Math.round(bgBright*200)},${Math.round(bgBright*255+8)})`;
  ctx.fillRect(0,0,w,h);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = .5;
  for(let i=-4;i<=4;i++){
    const gx=cx+(i/4)*sc*.7;
    ctx.beginPath(); ctx.moveTo(gx,cy-sc*.7); ctx.lineTo(gx,cy+sc*.7); ctx.stroke();
    const gy=cy+(i/4)*sc*.7;
    ctx.beginPath(); ctx.moveTo(cx-sc*.7,gy); ctx.lineTo(cx+sc*.7,gy); ctx.stroke();
  }

  const gen = {lissajous:genLissajous, attractor:genAttractor, torus:genTorus};
  const data = (gen[vizType]||genLissajous)(time, p);

  const pts = data.map((pt,i) => ({...proj(pt.x,pt.y,pt.z,rx,ry,sc,cx,cy), s:pt.s, i}));
  pts.sort((a,b) => a.depth-b.depth);

  const r1=parseInt(clr.slice(1,3),16), g1=parseInt(clr.slice(3,5),16), b1=parseInt(clr.slice(5,7),16);

  // Lines
  ctx.lineWidth = 1.5;
  for(let i=1;i<pts.length;i++){
    const p0=pts[i-1], p1=pts[i];
    if(Math.abs(p0.i-p1.i)>2) continue;
    const a = (.12+p1.p*.35) * (pulse ? 1+Math.sin(time*8)*.15 : 1);
    ctx.strokeStyle = `rgba(${r1},${g1},${b1},${a})`;
    ctx.beginPath(); ctx.moveTo(p0.px,p0.py); ctx.lineTo(p1.px,p1.py); ctx.stroke();
  }

  // Points with glow
  for(const pt of pts){
    const a = .25+pt.p*.5;
    const sz = (1+pt.p*2.5) * (pulse ? 1+Math.sin(time*10+pt.s*20)*.2 : 1);
    // Glow
    const grd = ctx.createRadialGradient(pt.px,pt.py,0,pt.px,pt.py,sz*3);
    grd.addColorStop(0, `rgba(${r1},${g1},${b1},${a*.6})`);
    grd.addColorStop(1, `rgba(${r1},${g1},${b1},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(pt.px,pt.py,sz*3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(${r1},${g1},${b1},${a})`;
    ctx.beginPath(); ctx.arc(pt.px,pt.py,sz,0,Math.PI*2); ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════
//  MINI CANVAS COMPONENT
// ═══════════════════════════════════════════════════════════
function MiniViz({condition, vizType, time, w, h, rx, ry, active, onClick, pulse}) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if(!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio||1;
    c.width=w*dpr; c.height=h*dpr; ctx.scale(dpr,dpr);
    drawViz(ctx, w, h, time, condition, vizType, rx, ry, pulse && active);
    if(active){
      ctx.strokeStyle = COND_CLR[condition]+"55"; ctx.lineWidth=2;
      ctx.strokeRect(1,1,w-2,h-2);
    }
    // Label
    ctx.font = `${active?12:10}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = active ? COND_CLR[condition] : "rgba(255,255,255,0.35)";
    ctx.fillText(COND_TR[condition], 8, h-8);
  }, [condition,vizType,time,w,h,rx,ry,active,pulse]);

  return <canvas ref={ref} style={{width:w,height:h,cursor:"pointer",borderRadius:6}} onClick={onClick}/>;
}

// ═══════════════════════════════════════════════════════════
//  METRIC BAR
// ═══════════════════════════════════════════════════════════
function MBar({label, value, max, color}) {
  return (
    <div style={{marginBottom:5}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,0.4)",fontFamily:"inherit",marginBottom:1}}>
        <span>{label}</span><span>{value.toFixed(2)}</span>
      </div>
      <div style={{height:3,background:"rgba(255,255,255,0.05)",borderRadius:2}}>
        <div style={{height:"100%",width:`${Math.min(100,(value/max)*100)}%`,background:color,borderRadius:2,transition:"width .4s"}}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function PsychDashboard() {
  const [cond, setCond] = useState("healthy");
  const [viz, setViz] = useState("lissajous");
  const [playing, setPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [view, setView] = useState("grid");
  const [tick, setTick] = useState(0);
  const timeRef = useRef(0);
  const rotRef = useRef({x:.3, y:0});
  const dragRef = useRef({on:false, lx:0, ly:0});
  const engineRef = useRef(null);

  // Animation loop
  useEffect(() => {
    let raf;
    const loop = () => {
      timeRef.current += 0.008;
      rotRef.current.y += 0.002;
      setTick(t=>t+1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Audio engine lifecycle
  useEffect(() => {
    engineRef.current = new AudioEngine();
    return () => { engineRef.current?.dispose(); };
  }, []);

  const toggleAudio = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (!eng.initialized) {
      await eng.init();
      setAudioReady(true);
    }
    const nowPlaying = eng.toggle(cond);
    setPlaying(nowPlaying);
  }, [cond]);

  // When condition changes while playing, switch audio
  useEffect(() => {
    if (playing && engineRef.current?.initialized) {
      engineRef.current.playCondition(cond);
    }
  }, [cond]);

  const p = PROFILES[cond];
  const clr = COND_CLR[cond];

  // Mouse drag
  const md = useCallback(e => { dragRef.current={on:true,lx:e.clientX,ly:e.clientY}; }, []);
  const mm = useCallback(e => {
    if(!dragRef.current.on) return;
    rotRef.current.y += (e.clientX-dragRef.current.lx)*.005;
    rotRef.current.x += (e.clientY-dragRef.current.ly)*.005;
    dragRef.current.lx=e.clientX; dragRef.current.ly=e.clientY;
  }, []);
  const mu = useCallback(() => { dragRef.current.on=false; }, []);

  const instMap = [
    {lm:"Sol Göz", inst:"Violin", icon:"🎻", desc:"FM Synth, harmonic"},
    {lm:"Sağ Göz", inst:"Cello", icon:"🎻", desc:"AM Synth, triangle"},
    {lm:"Ağız", inst:"Trumpet", icon:"🎺", desc:"Sawtooth, bright"},
    {lm:"Sol Kaş", inst:"Flute", icon:"🪈", desc:"Sine, pure"},
    {lm:"Sağ Kaş", inst:"Oboe", icon:"🎵", desc:"FM Synth, reedy"},
  ];

  return (
    <div style={{width:"100%",height:"100vh",background:"#030306",color:"#fff",
      fontFamily:"'JetBrains Mono','Fira Code',monospace",display:"flex",flexDirection:"column",
      overflow:"hidden",userSelect:"none"}}>

      {/* ═══ HEADER ═══ */}
      <div style={{padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:3}}>PSYCHIATRIC SONIFICATION SYSTEM</div>
          <div style={{fontSize:16,fontWeight:300,marginTop:1}}>
            Facial Dynamics <span style={{color:clr,fontWeight:600}}>3D Manifold</span>
            {playing && <span style={{fontSize:9,color:"#06d6a0",marginLeft:10,animation:"pulse 1s infinite"}}>● PLAYING</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {VIZ_TYPES.map(v => (
            <button key={v.id} onClick={()=>setViz(v.id)} style={{
              background:viz===v.id?"rgba(255,255,255,0.08)":"transparent",
              border:`1px solid ${viz===v.id?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.04)"}`,
              color:viz===v.id?"#fff":"rgba(255,255,255,0.35)",padding:"4px 10px",
              borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"inherit"
            }}>
              <span style={{marginRight:4}}>{v.icon}</span>{v.label}
            </button>
          ))}
          <div style={{width:1,height:20,background:"rgba(255,255,255,0.08)",margin:"0 4px"}}/>
          {["grid","single","compare"].map(v => (
            <button key={v} onClick={()=>setView(v)} style={{
              background:view===v?"rgba(255,255,255,0.08)":"transparent",
              border:`1px solid ${view===v?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.04)"}`,
              color:view===v?"#fff":"rgba(255,255,255,0.35)",padding:"4px 10px",
              borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"inherit"
            }}>
              {v==="grid"?"Grid":v==="single"?"Focus":"Compare"}
            </button>
          ))}
          <div style={{width:1,height:20,background:"rgba(255,255,255,0.08)",margin:"0 4px"}}/>
          {/* AUDIO BUTTON */}
          <button onClick={toggleAudio} style={{
            background: playing ? `${clr}22` : "rgba(255,255,255,0.05)",
            border: `1px solid ${playing ? clr+"66" : "rgba(255,255,255,0.08)"}`,
            color: playing ? clr : "rgba(255,255,255,0.5)",
            padding: "4px 14px", borderRadius: 20, cursor: "pointer",
            fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
            transition: "all .3s"
          }}>
            {playing ? "🔊 Durdur" : "🔇 Müzik Başlat"}
          </button>
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div style={{flex:1,display:"flex",minHeight:0}}>

        {/* ─── LEFT SIDEBAR ─── */}
        <div style={{width:185,borderRight:"1px solid rgba(255,255,255,0.06)",
          padding:12,display:"flex",flexDirection:"column",gap:4,flexShrink:0,overflowY:"auto"}}>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:4}}>PSİKİYATRİK VAKA</div>
          {CONDITIONS.map(c => (
            <button key={c} onClick={()=>setCond(c)} style={{
              background:c===cond?COND_CLR[c]+"11":"transparent",
              border:`1px solid ${c===cond?COND_CLR[c]+"44":"rgba(255,255,255,0.03)"}`,
              color:c===cond?COND_CLR[c]:"rgba(255,255,255,0.35)",
              padding:"8px 10px",borderRadius:5,cursor:"pointer",textAlign:"left",fontFamily:"inherit"
            }}>
              <div style={{fontSize:12,fontWeight:c===cond?600:400}}>{COND_TR[c]}</div>
              <div style={{fontSize:7,opacity:.5,marginTop:2}}>
                {PROFILES[c].tempo} BPM · {PROFILES[c].notes.length} nota
              </div>
            </button>
          ))}

          {/* Instrument Map */}
          <div style={{marginTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:6}}>LANDMARK → SES</div>
            {instMap.map((im,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:8,
                color:"rgba(255,255,255,0.35)",marginBottom:4,padding:"3px 4px",borderRadius:3,
                background: playing ? `rgba(255,255,255,${.02+Math.sin(timeRef.current*3+i)*.015})` : "transparent"
              }}>
                <span style={{fontSize:12}}>{im.icon}</span>
                <div>
                  <div>{im.lm} → <span style={{color:"rgba(255,255,255,0.55)"}}>{im.inst}</span></div>
                  <div style={{fontSize:7,opacity:.5}}>{im.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics */}
          <div style={{marginTop:"auto",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:6}}>METRİKLER</div>
            <MBar label="Göz Amplitüd" value={p.eyeAmp} max={1} color={clr}/>
            <MBar label="Göz Frekans" value={p.eyeFreq} max={3} color={clr}/>
            <MBar label="Ağız Aktivite" value={p.mouthAmp} max={.6} color={clr}/>
            <MBar label="Kaş Hareket" value={p.browAmp} max={.6} color={clr}/>
            <MBar label="Kaos İndeksi" value={p.chaos} max={1} color={clr}/>
            <MBar label="Tempo" value={p.tempo} max={200} color={clr}/>
          </div>
        </div>

        {/* ─── CENTER ─── */}
        <div style={{flex:1,position:"relative"}} onMouseDown={md} onMouseMove={mm} onMouseUp={mu} onMouseLeave={mu}>

          {view === "grid" ? (
            <div style={{width:"100%",height:"100%",display:"grid",
              gridTemplateColumns:"repeat(3,1fr)",gridTemplateRows:"repeat(2,1fr)",gap:4,padding:8}}>
              {CONDITIONS.map((c,i) => (
                <div key={c} style={{
                  position:"relative", borderRadius:6, overflow:"hidden",
                  gridColumn: i===4 ? "2/3" : undefined
                }}>
                  <MiniViz condition={c} vizType={viz} time={timeRef.current}
                    w={320} h={240} rx={rotRef.current.x} ry={rotRef.current.y}
                    active={c===cond} onClick={()=>setCond(c)} pulse={playing}/>
                </div>
              ))}
            </div>
          ) : view === "single" ? (
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"grab"}}>
              <MiniViz condition={cond} vizType={viz} time={timeRef.current}
                w={650} h={500} rx={rotRef.current.x} ry={rotRef.current.y}
                active={true} onClick={()=>{}} pulse={playing}/>
            </div>
          ) : (
            <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",padding:10,gap:6}}>
              <div style={{display:"flex",gap:4,flex:1}}>
                {CONDITIONS.map(c => (
                  <div key={c} style={{flex:1,borderRadius:4,overflow:"hidden"}}>
                    <MiniViz condition={c} vizType={viz} time={timeRef.current}
                      w={200} h={280} rx={rotRef.current.x} ry={rotRef.current.y}
                      active={c===cond} onClick={()=>setCond(c)} pulse={playing}/>
                  </div>
                ))}
              </div>
              {/* Comparison bars */}
              <div style={{padding:10,background:"rgba(255,255,255,0.015)",borderRadius:6,
                border:"1px solid rgba(255,255,255,0.04)",display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                {[
                  {k:"eyeAmp",l:"GÖZ AMP",m:1},{k:"eyeFreq",l:"GÖZ FRQ",m:3},
                  {k:"mouthAmp",l:"AĞIZ",m:.6},{k:"browAmp",l:"KAŞ",m:.6},
                  {k:"chaos",l:"KAOS",m:1},{k:"vel",l:"HIZ",m:2}
                ].map(({k,l,m}) => (
                  <div key={k}>
                    <div style={{fontSize:7,color:"rgba(255,255,255,0.3)",marginBottom:3,letterSpacing:1}}>{l}</div>
                    <div style={{display:"flex",gap:2,alignItems:"flex-end",height:24}}>
                      {CONDITIONS.map(c => (
                        <div key={c} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                          <div style={{width:"100%",height:`${Math.max(3,(PROFILES[c][k]/m)*24)}px`,
                            background:`linear-gradient(to top,${COND_CLR[c]},${COND_CLR[c]}33)`,borderRadius:1}}/>
                          <div style={{fontSize:5,color:"rgba(255,255,255,0.2)",marginTop:1}}>
                            {COND_TR[c].slice(0,3)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info overlay */}
          <div style={{position:"absolute",bottom:12,left:12,
            background:"rgba(0,0,0,0.65)",backdropFilter:"blur(8px)",
            border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"8px 14px",maxWidth:320}}>
            <div style={{fontSize:13,fontWeight:600,color:clr}}>{COND_TR[cond]}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>{COND_DESC[cond]}</div>
            {playing && (
              <div style={{fontSize:8,color:"#06d6a0",marginTop:4}}>
                ♪ {p.tempo} BPM · {p.notes.join(", ")} · {p.noteLen}
              </div>
            )}
          </div>

          {/* Audio status */}
          {playing && (
            <div style={{position:"absolute",top:12,right:12,display:"flex",gap:4}}>
              {instMap.map((im,i) => (
                <div key={i} style={{
                  background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:4,padding:"4px 6px",fontSize:8,color:"rgba(255,255,255,0.5)",
                  display:"flex",alignItems:"center",gap:3,
                  opacity: .6+Math.sin(timeRef.current*4+i*1.2)*.4
                }}>
                  <span style={{fontSize:10}}>{im.icon}</span>{im.inst}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── RIGHT SIDEBAR ─── */}
        <div style={{width:190,borderLeft:"1px solid rgba(255,255,255,0.06)",
          padding:12,overflowY:"auto",flexShrink:0}}>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:8}}>CROSS-CONDITION</div>
          {CONDITIONS.map(c => {
            const pr = PROFILES[c];
            return (
              <div key={c} onClick={()=>setCond(c)} style={{
                marginBottom:8,padding:"6px 8px",cursor:"pointer",
                background:c===cond?"rgba(255,255,255,0.03)":"transparent",
                borderRadius:4,border:`1px solid ${c===cond?COND_CLR[c]+"33":"transparent"}`,
                transition:"all .2s"
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:COND_CLR[c],fontWeight:600}}>{COND_TR[c]}</span>
                  <span style={{fontSize:7,color:"rgba(255,255,255,0.3)"}}>{pr.tempo}bpm</span>
                </div>
                <div style={{display:"flex",gap:2,height:18,alignItems:"flex-end",marginTop:3}}>
                  {[pr.eyeAmp,pr.eyeFreq/3,pr.mouthAmp*1.7,pr.browAmp*1.7,pr.chaos,pr.vel/2].map((v,i) => (
                    <div key={i} style={{flex:1,height:`${Math.max(4,v*100)}%`,
                      background:`linear-gradient(to top,${COND_CLR[c]},${COND_CLR[c]}33)`,borderRadius:1}}/>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Music theory */}
          <div style={{marginTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:6}}>MÜZİK TEORİSİ</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",lineHeight:1.8}}>
              <div><span style={{color:"#00f5d4"}}>Kat</span> C3-E3 · 40bpm · Minimal</div>
              <div><span style={{color:"#457b9d"}}>Dep</span> D3-C4 · 55bpm · Melankolik</div>
              <div><span style={{color:"#e63946"}}>Par</span> E4-Eb5 · 140bpm · Gergin</div>
              <div><span style={{color:"#ffbe0b"}}>Man</span> C4-F#5 · 170bpm · Hiperaktif</div>
              <div><span style={{color:"#06d6a0"}}>Sağ</span> C4-C5 · 90bpm · Dengeli</div>
            </div>
          </div>

          <div style={{marginTop:"auto",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:7,color:"rgba(255,255,255,0.15)",lineHeight:1.6}}>
              <div>Tone.js Audio Synthesis</div>
              <div>MediaPipe 468 landmarks</div>
              <div>Mouse drag → 3D rotate</div>
              <div style={{marginTop:4}}>© TenkaiAI Research</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{padding:"6px 20px",borderTop:"1px solid rgba(255,255,255,0.06)",
        display:"flex",justifyContent:"space-between",fontSize:8,color:"rgba(255,255,255,0.2)",flexShrink:0}}>
        <span>
          {viz==="lissajous"?"Lissajous: göz frekansı × kaş amplitüdü × kaos modülasyonu":
           viz==="attractor"?"Lorenz: σ=kaos indeksi, ρ=göz amplitüdü, β=hız":
           "Torus: p=kaos, q=göz frekansı → düğüm kompleksitesi"}
        </span>
        <span>{playing ? `♪ ${COND_TR[cond]} · ${p.tempo} BPM · 5 enstrüman aktif` : "🔇 Müzik başlatmak için butona tıklayın"}</span>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  );
}
