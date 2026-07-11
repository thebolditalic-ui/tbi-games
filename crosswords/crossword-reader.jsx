/*  The Bold Italic — Crossword reader (self-mounting, inline)
    Loads the current puzzle from Supabase (falls back to bundled), renders a compact
    interactive board in #xw-app, and portals the clue list into #xw-clues-below (beneath
    the ad). Runs on global React/ReactDOM + in-browser Babel — no build step. */

const { useState, useEffect, useMemo, useCallback } = React;

/* ---------------- Supabase (read-only, anon) ---------------- */
const SB_URL = "https://scawgrjcjgcmvsimvash.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYXdncmpjamdjbXZzaW12YXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NzAxMDIsImV4cCI6MjA4ODM0NjEwMn0.lmks8ntJPZ0giQEpuH3tSSBllzmOj20oUrb96kBIdh0";

/* ---------------- Bundled fallback puzzles (newest first) ---------------- */
const BUNDLED = [
  {
    slug: "hump-day-2", title: "Hump Day Crossword", subtitle: "San Francisco Edition",
    number: 2, date: "2026-07-01", size: 9,
    grid: ["GAMER#FOR","ALIVE#LIE","PENINSULA","###DOCKED","CAVE#REDS","ALONSO###","COITTOWER","HUD#AGILE","EDS#BEGIN"],
    clues: {
      "1A":"A GDC attendee, or someone glued to an arcade in the Metreon","6A":"In favor of, as a raucous vote at the Board of Supervisors","9A":"How the Castro feels on the last Sunday in June","10A":"\"The city's flat,\" for one (try biking up Filbert Street)","11A":"The tech-thick strip running south toward San Jose, with the city at its tip","13A":"Tied up at the Embarcadero, as the Larkspur ferry","14A":"Give in, or what the waves carved into the cliffs below the Sutro Baths","17A":"Sips from a Napa tasting flight, casually","18A":"Alicia ___, the Cuban ballet legend long honored by SF Ballet","20A":"Telegraph Hill spire funded by Lillie Hitchcock Coit's bequest","24A":"Fed. dept. behind much of the city's affordable-housing money","25A":"Nimble, or the sprint-based method ruling SoMa's software shops","26A":"Newsroom chiefs at the Chronicle, for short","27A":"Start, as the Bay to Breakers gun downtown","1D":"Clothing giant founded on Ocean Avenue in 1969","2D":"Anchor Steam, for one","3D":"Tiny stretch of time, on a Muni arrival sign: Abbr.","4D":"Plain to see, like the fog pouring over Twin Peaks","5D":"\"Biggest Little City,\" a quick hop east over the Sierra","6D":"Whale's tail, glimpsed on a Farallones boat trip","7D":"Well-___ (smooth-running, like a restored cable car's gears)","8D":"Peruses, as the zines at City Lights","12D":"Miser at A.C.T.'s annual \"A Christmas Carol\"","14D":"Hidden hoard, or a stash spot on a Lands End geocaching hunt","15D":"How a poet delivers at a Mission open mic","16D":"Cancels, as a parking ticket you contest at City Hall","19D":"Take a ___ at it, like a first-timer on the Dolores Park slackline","21D":"A drag queen's crowning glory at Oasis","22D":"Yale grad who decamped to SF for a startup","23D":"Kylo ___ (Lucasfilm is just across the bridge)",
    },
  },
  {
    slug: "hump-day-1", title: "Hump Day Crossword", subtitle: "San Francisco Edition",
    number: 1, date: "2026-06-24", size: 9,
    grid: ["PATHS#ART","ISAAC#ROE","CHINATOWN","###DRAMAS","ABEL#BANE","SOLEIL###","SOURDOUGH","END#LINER","SEE#EDITS"],
    clues: {
      "1A":"Crosstown Trail segments that lace the city hill to shore","6A":"What fills the de Young and the Legion of Honor","9A":"Sci-fi's Asimov, born an ocean away but shelved in every SF bookstore","10A":"Ikura, at a Japantown sushi counter","11A":"North America's oldest, entered through the Dragon Gate on Grant","13A":"What A.C.T. and the Magic Theatre stage","14A":"Norwegian math whiz with a prize in his name (not the Cain kind)","17A":"Ruin, or Batman's back-breaking foe","18A":"Cirque du ___, whose big top pitches near the bay","20A":"Boudin's been pulling it from wharf ovens since 1849","24A":"Lands ___, where the Sutro Baths met the sea","25A":"Cunard crosser, or the liner notes in a vinyl sleeve","26A":"Take in, as the view from Twin Peaks","27A":"Blue-pencil fixes from a Chronicle desk","1D":"Camera-roll keeper, casually","2D":"Forehead smudge on Ash Wednesday at the Mission's old basilica","3D":"___ chi, the dawn ritual in Portsmouth Square","4D":"Comic Chelsea, or a celebrity's on-tour minder","5D":"Mark left after the '06 quake, maybe","6D":"What pulls you into a Mission roastery","7D":"Atkinson of \"Mr. Bean,\" or Marin's Mount ___","8D":"Keyed up, like a Giants crowd in the ninth","12D":"Format the Examiner once printed in","14D":"Mule trains, or stubborn sorts","15D":"Trailblazing Daniel, or crooner Pat","16D":"Give the slip to, as fog dodging the East Bay","19D":"Sitting unused, like a cable car on the turntable overnight","21D":"Spiky-shelled treat on an omakase menu","22D":"Wrangle, as a permit from City Hall","23D":"Shift lengths at a SoMa startup: Abbr.",
    },
  },
  {
    slug: "the-mini-1", title: "The Mini", subtitle: "San Francisco Edition",
    number: 1, date: "2026-06-17", size: 5,
    grid: ["MAD##","ACRES","PRIDE","SEVEN","##END"],
    clues: {
      "1A":"Steaming, like a rider who just watched the J Church pull away","4A":"Golden Gate Park sprawls across more than 1,000 of them","7A":"Late-June celebration that floods Market Street with rainbow flags","8A":"Roughly the Richter reading of the 1989 Loma Prieta quake","9A":"Lands ___, the cliffside lookout above the ruined Sutro Baths","1D":"Phone apps for surviving the city's maze of one-way streets","2D":"Football-field-ish unit of land","3D":"JFK ___, the Golden Gate Park road that's now mostly car-free","5D":"Garden paradise of Genesis","6D":"Fire off, as a text",
    },
  },
];

const C = {
  paper:"#f6f1e7", paper2:"#efe8d8", ink:"#15110d", block:"#1d1812",
  line:"#cdbfa6", blue:"#1d5c8f", blueSoft:"#dbe8f3", sky:"#a6cae6",
  fog:"#eef2f5", fogEdge:"#cdd8df", good:"#2c7a4b", bad:"#c2392b",
};
const KEYS = ["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];

function computeModel(rows, size) {
  const isB = (r,c) => rows[r][c] === "#";
  const numbers = {}; let n = 0;
  for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
    if (isB(r,c)) continue;
    const sA = (c===0 || isB(r,c-1)) && c+1<size && !isB(r,c+1);
    const sD = (r===0 || isB(r-1,c)) && r+1<size && !isB(r+1,c);
    if (sA || sD) numbers[`${r},${c}`] = ++n;
  }
  const across=[], down=[];
  for (let r=0;r<size;r++){ let c=0; while(c<size){ if(isB(r,c)){c++;continue;} const cells=[]; while(c<size && !isB(r,c)){cells.push([r,c]);c++;} if(cells.length>=2) across.push({num:numbers[`${cells[0][0]},${cells[0][1]}`],dir:"A",cells}); } }
  for (let c=0;c<size;c++){ let r=0; while(r<size){ if(isB(r,c)){r++;continue;} const cells=[]; while(r<size && !isB(r,c)){cells.push([r,c]);r++;} if(cells.length>=2) down.push({num:numbers[`${cells[0][0]},${cells[0][1]}`],dir:"D",cells}); } }
  const cellEntry = {};
  across.forEach((e,i)=>e.cells.forEach(([r,c])=>{(cellEntry[`${r},${c}`] ||= {}).A=i;}));
  down.forEach((e,i)=>e.cells.forEach(([r,c])=>{(cellEntry[`${r},${c}`] ||= {}).D=i;}));
  return { numbers, across, down, cellEntry, isB };
}

function Btn({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ flex:1, padding:"10px 8px", borderRadius:10, cursor:"pointer",
        fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13, letterSpacing:".02em",
        transition:"transform .08s, background .15s", border:`1.5px solid ${C.ink}`, background:"transparent", color:C.ink }}
      onMouseDown={(e)=>e.currentTarget.style.transform="translateY(1px)"}
      onMouseUp={(e)=>e.currentTarget.style.transform="none"}
      onMouseLeave={(e)=>e.currentTarget.style.transform="none"}>{children}</button>
  );
}
function KbKey({ label, onClick, wide }) {
  return (
    <button onClick={onClick}
      style={{ flex: wide?"1.4":"1", maxWidth: wide?54:36, height:44, borderRadius:7,
        border:`1px solid ${C.line}`, background:"#fffdf8", cursor:"pointer",
        fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize: wide?16:15, color:C.ink,
        transition:"transform .06s, background .12s" }}
      onMouseDown={(e)=>{e.currentTarget.style.transform="translateY(1px)";e.currentTarget.style.background=C.sky;}}
      onMouseUp={(e)=>{e.currentTarget.style.transform="none";e.currentTarget.style.background="#fffdf8";}}
      onMouseLeave={(e)=>{e.currentTarget.style.transform="none";e.currentTarget.style.background="#fffdf8";}}>{label}</button>
  );
}

/* ======================= PLAYER ======================= */
function Player({ puzzle }) {
  const { size, grid: SOL, clues: CLUES } = puzzle;
  const LS_KEY = "xw_" + puzzle.slug;
  const isBlack = (r,c) => SOL[r][c] === "#";
  const M = useMemo(() => computeModel(SOL, size), [SOL, size]);
  const firstWhite = useMemo(() => { for (let r=0;r<size;r++) for (let c=0;c<size;c++) if (SOL[r][c]!=="#") return [r,c]; return [0,0]; }, [SOL,size]);

  const blankGrid = () => SOL.map((row)=>row.split("").map((ch)=>(ch==="#"?"#":"")));
  const [grid, setGrid] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY)||"null"); if (s && Array.isArray(s) && s.length===size) return s; } catch(e){}
    return blankGrid();
  });
  const [sel, setSel] = useState(firstWhite);
  const [dir, setDir] = useState("A");
  const [wrong, setWrong] = useState({});
  const [solved, setSolved] = useState(false);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(grid)); } catch(e){} }, [grid, LS_KEY]);
  useEffect(() => { if (!running || solved) return; const id=setInterval(()=>setSecs((s)=>s+1),1000); return ()=>clearInterval(id); }, [running, solved]);
  const startTimer = () => setRunning((r)=>r||true);

  const activeEntry = useMemo(() => {
    const ce = M.cellEntry[`${sel[0]},${sel[1]}`]; if (!ce) return null;
    if (dir==="A" && ce.A!=null) return M.across[ce.A];
    if (dir==="D" && ce.D!=null) return M.down[ce.D];
    return ce.A!=null ? M.across[ce.A] : ce.D!=null ? M.down[ce.D] : null;
  }, [sel, dir, M]);
  const activeKey = activeEntry ? `${activeEntry.num}${activeEntry.dir}` : null;
  const activeCells = useMemo(() => new Set((activeEntry?activeEntry.cells:[]).map(([r,c])=>`${r},${c}`)), [activeEntry]);

  const checkSolved = useCallback((g) => { for (let r=0;r<size;r++) for (let c=0;c<size;c++) if (!isBlack(r,c) && g[r][c]!==SOL[r][c]) return false; return true; }, [SOL,size]);
  const selectCell = (r,c) => { if (isBlack(r,c)) return; startTimer(); if (r===sel[0]&&c===sel[1]) { const ce=M.cellEntry[`${r},${c}`]; if (ce&&ce.A!=null&&ce.D!=null) setDir((d)=>d==="A"?"D":"A"); } else setSel([r,c]); };
  const advance = useCallback((r,c,d)=>{ const ce=M.cellEntry[`${r},${c}`]; if(!ce)return; const entry=d==="A"?M.across[ce.A]:M.down[ce.D]; if(!entry)return; const idx=entry.cells.findIndex(([rr,cc])=>rr===r&&cc===c); if(idx<entry.cells.length-1) setSel(entry.cells[idx+1]); }, [M]);
  const typeLetter = useCallback((ch)=>{ if(solved)return; startTimer(); const [r,c]=sel; if(isBlack(r,c))return; setWrong((w)=>{if(!w[`${r},${c}`])return w;const n={...w};delete n[`${r},${c}`];return n;}); const ng=grid.map((row)=>row.slice()); ng[r][c]=ch; setGrid(ng); if(checkSolved(ng)){setSolved(true);setRunning(false);} advance(r,c,dir); }, [sel,dir,solved,grid,advance,checkSolved]);
  const backspace = useCallback(()=>{ if(solved)return; const [r,c]=sel; if(grid[r][c]){const ng=grid.map((row)=>row.slice());ng[r][c]="";setGrid(ng);} else { const ce=M.cellEntry[`${r},${c}`]; const entry=dir==="A"?M.across[ce.A]:M.down[ce.D]; if(entry){const idx=entry.cells.findIndex(([rr,cc])=>rr===r&&cc===c); if(idx>0){const [pr,pc]=entry.cells[idx-1]; setSel([pr,pc]); const ng=grid.map((row)=>row.slice()); ng[pr][pc]=""; setGrid(ng);}}} }, [sel,dir,solved,grid,M]);
  const move = useCallback((dr,dc)=>{ const want=dr!==0?"D":"A"; if(dir!==want){setDir(want);return;} let [r,c]=sel; for(let s=0;s<size;s++){r+=dr;c+=dc; if(r<0||c<0||r>=size||c>=size)return; if(!isBlack(r,c)){setSel([r,c]);return;}} }, [sel,dir,size]);

  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey||e.ctrlKey||e.altKey) return;
      const t=e.target.tagName; if (t==="INPUT"||t==="TEXTAREA"||t==="SELECT") return;
      const k=e.key;
      if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); typeLetter(k.toUpperCase()); }
      else if (k==="Backspace") { e.preventDefault(); backspace(); }
      else if (k==="ArrowUp") { e.preventDefault(); move(-1,0); }
      else if (k==="ArrowDown") { e.preventDefault(); move(1,0); }
      else if (k==="ArrowLeft") { e.preventDefault(); move(0,-1); }
      else if (k==="ArrowRight") { e.preventDefault(); move(0,1); }
      else if (k===" "||k==="Tab") { e.preventDefault(); setDir((d)=>d==="A"?"D":"A"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [typeLetter, backspace, move]);

  const goEntry = (delta) => { const list=dir==="A"?M.across:M.down; const idx=list.findIndex((e)=>e===activeEntry); const next=list[(idx+delta+list.length)%list.length]; if (next){setSel(next.cells[0]);startTimer();} };
  const doCheck = () => { const w={}; for(let r=0;r<size;r++)for(let c=0;c<size;c++) if(!isBlack(r,c)&&grid[r][c]&&grid[r][c]!==SOL[r][c]) w[`${r},${c}`]=true; setWrong(w); setTimeout(()=>setWrong({}),2500); };
  const doReveal = () => { setGrid(SOL.map((row)=>row.split("").map((ch)=>(ch==="#"?"#":ch)))); setWrong({}); setSolved(true); setRunning(false); setRevealed(true); };
  const doReset = () => { setGrid(blankGrid()); setWrong({}); setSolved(false); setRevealed(false); setSecs(0); setRunning(false); setSel(firstWhite); setDir("A"); try{localStorage.removeItem(LS_KEY);}catch(e){} };
  const mmss = `${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;

  const clueList = (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"0 2px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        {[["Across", M.across],["Down", M.down]].map(([title,list])=>(
          <div key={title}>
            <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11, letterSpacing:".22em", textTransform:"uppercase", color:C.blue, borderBottom:`1.5px solid ${C.ink}`, paddingBottom:5, marginBottom:7 }}>{title}</div>
            {list.map((e)=>{ const k=`${e.num}${e.dir}`; const active=activeKey===k; return (
              <div key={k} onClick={()=>{setSel(e.cells[0]);setDir(e.dir);startTimer();}} style={{ display:"flex", gap:7, padding:"5px 6px", borderRadius:7, cursor:"pointer", marginBottom:2, background: active?C.blueSoft:"transparent", fontFamily:"'DM Sans', sans-serif", fontSize:13, lineHeight:1.35 }}>
                <b style={{ minWidth:16, color:C.ink }}>{e.num}</b><span style={{ opacity:.9 }}>{CLUES[k]}</span>
              </div>
            ); })}
          </div>
        ))}
      </div>
      <div style={{ marginTop:18, fontFamily:"'DM Sans', sans-serif", fontSize:11, opacity:.55, textAlign:"center" }}>
        A San Francisco crossword from The Bold Italic. Progress saves on this device.
      </div>
    </div>
  );
  const cluesHost = typeof document !== "undefined" ? document.getElementById("xw-clues-below") : null;

  return (
    <div style={{ width:"100%" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      {/* compact masthead */}
      <div style={{ borderBottom:`2px solid ${C.ink}`, paddingBottom:7, marginBottom:11 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9.5, letterSpacing:".28em", textTransform:"uppercase", color:C.blue }}>The Bold Italic</div>
          <span style={{ fontFamily:"'DM Sans', monospace", fontVariantNumeric:"tabular-nums", fontSize:13, fontWeight:600, opacity:.7 }}>{mmss}</span>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:9, flexWrap:"wrap" }}>
          <h1 style={{ fontFamily:"'Fraunces', serif", fontWeight:700, fontSize:22, margin:"1px 0 0", lineHeight:1.05, letterSpacing:"-.01em" }}>{puzzle.title}</h1>
          <span style={{ fontFamily:"'Fraunces', serif", fontStyle:"italic", fontSize:12, opacity:.72 }}>
            {[puzzle.number?`No. ${puzzle.number}`:null, `${size}×${size}`].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      {/* clue bar */}
      <div style={{ display:"flex", alignItems:"stretch", gap:8, marginBottom:11, background:C.fog, border:`1.5px solid ${C.fogEdge}`, borderRadius:12, overflow:"hidden" }}>
        <button onClick={()=>goEntry(-1)} aria-label="previous" style={{ width:38, border:"none", background:"transparent", cursor:"pointer", fontSize:18, color:C.ink }}>‹</button>
        <div style={{ flex:1, padding:"8px 2px", minHeight:42, display:"flex", alignItems:"center" }}>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:14.5, lineHeight:1.3 }}>
            <b style={{ color:C.blue }}>{activeEntry?`${activeEntry.num}${activeEntry.dir}`:""}</b>&nbsp;&nbsp;{activeKey?CLUES[activeKey]:""}
          </span>
        </div>
        <button onClick={()=>goEntry(1)} aria-label="next" style={{ width:38, border:"none", background:"transparent", cursor:"pointer", fontSize:18, color:C.ink }}>›</button>
      </div>

      {/* grid */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${size}, 1fr)`, gap:0, border:`2.5px solid ${C.ink}`, background:C.ink, borderRadius:4, boxShadow:"0 10px 30px rgba(30,20,10,.16)", marginBottom:12 }}>
        {grid.map((row,r)=>row.map((val,c)=>{
          const key=`${r},${c}`;
          if (isBlack(r,c)) return <div key={key} style={{ aspectRatio:"1 / 1", background:C.block }} />;
          const num=M.numbers[key]; const isSel=sel[0]===r&&sel[1]===c; const inWord=activeCells.has(key); const isWrong=wrong[key];
          let bg="#fffdf8"; if(inWord)bg=C.blueSoft; if(isSel)bg=C.sky;
          return (
            <div key={key} onClick={()=>selectCell(r,c)} style={{ position:"relative", aspectRatio:"1 / 1", background:bg, borderRight: c<size-1 && !isBlack(r,c+1) ? `1px solid ${C.line}` : "none", borderBottom: r<size-1 && !isBlack(r+1,c) ? `1px solid ${C.line}` : "none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", userSelect:"none", transition:"background .1s" }}>
              {num && <span style={{ position:"absolute", top:1, left:2.5, fontSize:"min(2.4vw, 10px)", fontWeight:700, fontFamily:"'DM Sans', sans-serif", color:C.ink, opacity:.6, lineHeight:1 }}>{num}</span>}
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:"min(6.6vw, 26px)", color: isWrong?C.bad: revealed?C.good : C.ink, marginTop:2 }}>{val}</span>
              {isSel && <span style={{ position:"absolute", inset:0, border:`2px solid ${C.blue}`, borderRadius:1, pointerEvents:"none" }} />}
            </div>
          );
        }))}
      </div>

      {solved && <div style={{ marginBottom:12, padding:"11px 14px", borderRadius:12, textAlign:"center", background:C.blue, color:"#fff", fontFamily:"'Fraunces', serif", fontSize:17, fontWeight:700 }}>{revealed?"Revealed — the grid's all yours":`Solved in ${mmss}. Foggy no more.`}</div>}

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <Btn onClick={doCheck}>Check</Btn><Btn onClick={doReveal}>Reveal</Btn><Btn onClick={doReset}>Reset</Btn>
      </div>

      {/* on-screen keyboard */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {KEYS.map((rowStr,i)=>(
          <div key={i} style={{ display:"flex", gap:5, justifyContent:"center" }}>
            {i===2 && <KbKey wide label="⌫" onClick={backspace} />}
            {rowStr.split("").map((ch)=><KbKey key={ch} label={ch} onClick={()=>typeLetter(ch)} />)}
            {i===2 && <KbKey wide label="↹" onClick={()=>setDir((d)=>d==="A"?"D":"A")} />}
          </div>
        ))}
      </div>

      {/* clue list is rendered beneath the ad, via a portal (falls back to inline if the host is missing) */}
      {cluesHost ? ReactDOM.createPortal(clueList, cluesHost) : <div style={{ marginTop:18 }}>{clueList}</div>}
    </div>
  );
}

/* ======================= APP (loader; current puzzle or ?p=slug) ======================= */
function App() {
  const [puzzles, setPuzzles] = useState(BUNDLED);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let done=false;
    fetch(`${SB_URL}/rest/v1/crosswords?select=slug,title,subtitle,number,puzzle_date,size,grid,clues&published=eq.true&order=puzzle_date.desc,number.desc`, { headers:{ apikey:SB_ANON, Authorization:"Bearer "+SB_ANON } })
      .then((r)=>r.ok?r.json():null)
      .then((rows)=>{
        if (done) return;
        if (Array.isArray(rows) && rows.length) {
          const norm = rows.map((x)=>({ slug:x.slug, title:x.title, subtitle:x.subtitle, number:x.number, date:x.puzzle_date, size:x.size||(x.grid&&x.grid.length), grid:x.grid, clues:x.clues })).filter((p)=>Array.isArray(p.grid)&&p.grid.length&&p.clues);
          if (norm.length) setPuzzles(norm);
        }
      })
      .catch(()=>{});
    return ()=>{ done=true; };
  }, []);

  // honor a ?p=slug deep-link (Play links from the admin)
  useEffect(() => {
    let slug=null; try { slug=new URLSearchParams(window.location.search).get("p"); } catch(e){}
    if (slug) { const i=puzzles.findIndex((x)=>x.slug===slug); if (i>=0) setIdx(i); }
  }, [puzzles]);

  const puzzle = puzzles[idx] || puzzles[0];
  return <Player key={puzzle.slug || idx} puzzle={puzzle} />;
}

ReactDOM.createRoot(document.getElementById("xw-app")).render(<App />);
