const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─── DEVICE DETECTION ──────────────────────────────────────────────────────
function getDeviceType() {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

// Particle limits based on device
const PARTICLE_LIMITS = {
  desktop: { hearts: 6, sparkles: 4, petals: 3, floatingPhotos: 2 },
  tablet: { hearts: 3, sparkles: 2, petals: 2, floatingPhotos: 1 },
  mobile: { hearts: 2, sparkles: 1, petals: 1, floatingPhotos: 0 }
};

const getParticleLimits = () => PARTICLE_LIMITS[getDeviceType()];

// ─── OPTIMIZED PARTICLE POOL SYSTEM ───────────────────────────────────────
class ParticlePool {
  constructor(className, initialSize = 50) {
    this.className = className;
    this.available = [];
    this.active = new Set();
    this.maxSize = initialSize;
    this.timeouts = new Map();
    
    // Pre-allocate particles with hidden state
    for (let i = 0; i < initialSize; i++) {
      const el = document.createElement("div");
      el.className = className;
      el.style.display = 'none';
      document.body.appendChild(el);
      this.available.push(el);
    }
  }

  acquire() {
    let el;
    if (this.available.length > 0) {
      el = this.available.pop();
    } else {
      el = document.createElement("div");
      el.className = this.className;
      document.body.appendChild(el);
    }
    el.style.display = '';
    this.active.add(el);
    return el;
  }

  release(el) {
    if (this.active.has(el)) {
      this.active.delete(el);
      // Clear timeout if exists
      const timeoutId = this.timeouts.get(el);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeouts.delete(el);
      }
      // Reset styles and hide instead of removing
      el.style.display = 'none';
      el.style.animation = '';
      this.available.push(el);
    }
  }

  clear() {
    this.active.forEach(el => {
      const timeoutId = this.timeouts.get(el);
      if (timeoutId) clearTimeout(timeoutId);
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this.timeouts.clear();
    this.active.clear();
  }

  scheduleRelease(el, lifetime) {
    const timeoutId = setTimeout(() => {
      this.release(el);
    }, lifetime);
    this.timeouts.set(el, timeoutId);
  }

  getActiveCount() {
    return this.active.size;
  }
}

// Global particle pools - use device-aware sizing
const createParticlePools = () => ({
  'p-heart-float': new ParticlePool('p-heart-float', 20),
  'p-petal': new ParticlePool('p-petal', 15),
  'p-sparkle': new ParticlePool('p-sparkle', 30),
  'p-red-heart': new ParticlePool('p-red-heart', 20),
  'p-floating-heart-photo': new ParticlePool('p-floating-heart-photo', 6),
});

const particlePools = createParticlePools();

// Optimized particle spawning with pooling
function spawnEl(cls, styles, lifetime = 10000) {
  const pool = particlePools[cls];
  if (!pool) {
    console.warn(`No pool for class ${cls}`);
    return;
  }

  const el = pool.acquire();
  Object.assign(el.style, styles);
  pool.scheduleRelease(el, lifetime);
}

// Throttled event handler for aurora mouse tracking
function createThrottledMouseTracker(callback, delay = 16) {
  let lastCall = 0;
  let pending = false;

  return function(e) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      callback(e);
    } else if (!pending) {
      pending = true;
      requestAnimationFrame(() => {
        callback(e);
        pending = false;
      });
    }
  };
}

// ─── UNIFIED ANIMATION LOOP ───────────────────────────────────────────────
class UnifiedAnimationLoop {
  constructor() {
    this.tasks = new Map();
    this.running = false;
    this.rafId = null;
    this.startTime = 0;
  }

  addTask(id, callback, interval) {
    this.tasks.set(id, { callback, interval, lastCall: 0 });
    this.ensureRunning();
  }

  removeTask(id) {
    this.tasks.delete(id);
    if (this.tasks.size === 0) {
      this.stop();
    }
  }

  ensureRunning() {
    if (!this.running) {
      this.running = true;
      this.startTime = performance.now();
      this.tick();
    }
  }

  tick = () => {
    const now = performance.now();
    let hasActiveTasks = false;

    for (const [, task] of this.tasks) {
      const elapsed = now - task.lastCall;
      if (elapsed >= task.interval) {
        task.callback();
        task.lastCall = now;
      }
      hasActiveTasks = true;
    }

    if (hasActiveTasks) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
    }
  };

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
  }

  clear() {
    this.tasks.clear();
    this.stop();
  }
}

const animationLoop = new UnifiedAnimationLoop();
let taskCounter = 0;

function useParticles(configs) {
  const taskIdsRef = useRef([]);

  useEffect(() => {
    const taskIds = [];
    configs.forEach(({ create, ms }) => {
      const taskId = `particle_${taskCounter++}`;
      animationLoop.addTask(taskId, create, ms);
      taskIds.push(taskId);
    });
    taskIdsRef.current = taskIds;

    return () => {
      taskIds.forEach(id => animationLoop.removeTask(id));
    };
  }, []);
}

// ─── AURORA BACKGROUND COMPONENT (OPTIMIZED) ──────────────────────────────
const Aurora = React.memo(function Aurora({ theme = "main" }) {
  const auroraRef = useRef(null);
  const throttledMouseRef = useRef(null);

  useEffect(() => {
    if (!auroraRef.current) return;

    throttledMouseRef.current = createThrottledMouseTracker((e) => {
      if (!auroraRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      auroraRef.current.style.setProperty("--mouse-x", x * 15 + "px");
      auroraRef.current.style.setProperty("--mouse-y", y * 15 + "px");
    }, 32);

    window.addEventListener("mousemove", throttledMouseRef.current);
    return () => {
      if (throttledMouseRef.current) {
        window.removeEventListener("mousemove", throttledMouseRef.current);
      }
    };
  }, []);

  return (
    <div className={`aurora-bg aurora-${theme}`} ref={auroraRef}>
      <div className="aurora-layer aurora-base"></div>
      <div className="aurora-layer aurora-wave-1"></div>
      <div className="aurora-layer aurora-wave-2"></div>
      <div className="aurora-layer aurora-wave-3"></div>
      <div className="aurora-glow"></div>
    </div>
  );
});

// ─── INDEX PAGE ───────────────────────────────────────────────────────────────
const IndexPage = React.memo(function IndexPage({ onNavigate }) {
  const limits = useMemo(() => getParticleLimits(), []);
  const heartCountRef = useRef(0);
  const petalCountRef = useRef(0);
  const sparkleCountRef = useRef(0);

  const particleConfigs = useMemo(() => [
    {
      ms: 800,
      create: () => {
        if (heartCountRef.current >= limits.hearts) return;
        heartCountRef.current++;
        spawnEl("p-heart-float", { left: Math.random()*100+"vw", bottom: "-50px", animationDuration: (6+Math.random()*4)+"s" }, 11000);
      }
    },
    {
      ms: 600,
      create: () => {
        if (petalCountRef.current >= limits.petals) return;
        petalCountRef.current++;
        spawnEl("p-petal", { left: Math.random()*100+"vw", top: "-20px", animationDuration: (8+Math.random()*4)+"s" }, 13000);
      }
    },
    {
      ms: 400,
      create: () => {
        if (sparkleCountRef.current >= limits.sparkles) return;
        sparkleCountRef.current++;
        spawnEl("p-sparkle", { top: Math.random()*100+"vh", left: Math.random()*100+"vw" }, 3500);
      }
    },
  ], [limits]);

  useParticles(particleConfigs);

  const handleClick = useCallback(() => onNavigate("main", "mi vida Hadil"), [onNavigate]);

  return (
    <div className="ix-page">
      <Aurora theme="index" />
      <div className="ix-box">
        <span className="ix-heart">💝</span>
        <h1 className="ix-title">Algo Especial Te Espera...</h1>
        <p className="ix-sub">Un mensaje hecho con todo el amor del mundo, para mi vida Hadil</p>
        <button className="ix-btn" onClick={handleClick}>
          <span className="ix-btn-txt">✨ Desbloquear la Magia ✨</span>
        </button>
      </div>
    </div>
  );
});


// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const QUOTES = [
  "Eres el postre perfecto para una cena romántica 🍮",
  "Tengo los ojos llenos de ganas de verte 👀",
  "I could stare at you all day and still feel like I haven't had enough 👀❤️",
  "You have the kind of smile that could bring me to my knees ✨",
  "Just hearing your voice sends a shiver down my spine 🦋",
  "I don't know what's more intoxicating — your perfume or the way you look at me 💋",
  "You're not just my princess, you're the center of my universe 🌌❤️",
];
const WHY_YOU_REASONS = [
  "Porque tu sourire me rend folle every morning.",
  "Tu façon de parler me fait voyager dans un rêve doux.",
  "Eres la canción que mi corazón quiere escuchar siempre.",
  "Ta voix est mon café du matin, cálida y sempre réconfortante.",
  "Je t'aime porque tu fais de mes días ordinarios algo magnifique.",
  "Chaque regard de toi me fait sentir que je suis à casa.",
  "Eres mi raison de sourire même sin motivo.",
  "Tu rire es la meilleure musique de ma vie.",
  "Je veux estar contigo dans chaque petit moment.",
  "Parce que tes yeux brillent comme les étoiles la nuit.",
  "Your abraço is the warmest place de la tierra.",
  "Eres mi rêve éveillé, mi bella inspiración.",
];
const DAILY_COMPLIMENTS = [
  "Tu belleza es tan real que me deja sin palabras♡",
  "Mon amour, tu brillo interior est puro fuego.",
  "You are la mezcla perfecta de fuerza, charme y ternura.",
  "Tes gestes sont pequeños pero llenos de magia.",
  "Eres la razón por la que cada día se siente special.",
  "Your smile fait fondre even the coldest morning.",
  "Je t'admire por como transformas la vida en algo hermoso.",
  "Tu presencia hace que everything feels más brillante.",
  "Eres mon miracle diario, mi inspiración constante.",
  "Your cœur is as beautiful as the dreams you share.",
];
const THEMES = ["", "dark", "romantic", "purple"];

function MainPage({ name, onNavigate }) {
  const [themeIdx, setThemeIdx] = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const audioRef = useRef(null);

  const particleConfigs = useMemo(() => [
    { ms: 300, create: () => spawnEl("p-red-heart", { left: Math.random()*100+"vw", bottom: "-30px", animationDuration: (2+Math.random()*3)+"s" }, 6000) },
    { ms: 200, create: () => spawnEl("p-sparkle",   { top: Math.random()*100+"vh",  left: Math.random()*100+"vw" }, 4500) },
  ], []);

  useParticles(particleConfigs);

  // Optimized mouse heart trail with pooled elements
  useEffect(() => {
    const pool = [];
    const N = 15;
    let idx = 0;
    
    for (let i = 0; i < N; i++) {
      const h = document.createElement("div");
      h.className = "p-cursor-heart";
      h.style.display = 'none';
      document.body.appendChild(h);
      pool.push(h);
    }

    let lastX = 0, lastY = 0;
    let moveQueued = false;

    const onMove = (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      
      if (!moveQueued) {
        moveQueued = true;
        requestAnimationFrame(() => {
          const h = pool[idx];
          idx = (idx + 1) % N;
          h.style.left = (lastX - 6) + "px";
          h.style.top = (lastY - 6) + "px";
          h.style.display = '';
          h.style.animation = "none";
          void h.offsetWidth;
          h.style.animation = "growAndFade .7s ease-out forwards";
          moveQueued = false;
        });
      }
    };

    document.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("mousemove", onMove);
      pool.forEach(h => h.remove());
    };
  }, []);

  const cycleTheme  = useCallback(() => setThemeIdx(i => (i + 1) % THEMES.length), []);
  const toggleMusic = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
    setPlaying(!playing);
  }, [playing]);

  return (
    <div className={`mn-page ${THEMES[themeIdx]}`}>
      <Aurora theme="main" />
      <audio ref={audioRef} src="music/music.mp3" loop />

      <button className="mn-music" onClick={toggleMusic} title="Toggle Music">
        {playing ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        )}
      </button>

      <div className="mn-nav">
        <button className="mn-navbtn" onClick={() => onNavigate("reasons")}>💕 Why I Love You</button>
        <button className="mn-navbtn" onClick={() => onNavigate("memories")}>📸 Our Memories</button>
        <button className="mn-navbtn" onClick={() => onNavigate("howlucky")}>🍀 How Lucky I Am</button>
        <button className="mn-navbtn" onClick={() => onNavigate("whyyou")}>💌 Why You</button>
        <button className="mn-navbtn" onClick={() => onNavigate("countdown")}>🎂 The Day the World Got Better</button>
        <button className="mn-navbtn" onClick={() => onNavigate("index")}>🏠 Home</button>
        <button className="mn-navbtn" onClick={cycleTheme}>🎨 Change Theme</button>
      </div>

      <h1 className="mn-title">I Love You, {name || "❤️"} ❤️</h1>
      <p className="mn-quote">{quote}</p>

      <footer className="mn-footer">
        <div className="mn-footer-inner">
          <div className="mn-madeby">Crafted with ❤️ by</div>
          <strong>Feras (Hadil's Husband)</strong>
        </div>
      </footer>
    </div>
  );
}

function WhyYouPage({ onNavigate }) {
  const [dailyCompliment, setDailyCompliment] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('dailyCompliment') || 'null') : null;
    if (stored && stored.date === today) {
      setDailyCompliment(stored.text);
      return;
    }
    const next = DAILY_COMPLIMENTS[Math.floor(Math.random() * DAILY_COMPLIMENTS.length)];
    setDailyCompliment(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dailyCompliment', JSON.stringify({ date: today, text: next }));
    }
  }, []);

  return (
    <div className="mn-page">
      <Aurora theme="whyyou" />
      <button className="mn-back" onClick={() => onNavigate('main')}>← Back</button>
      <div className="mn-container mn-page-content">
        <h1 className="mn-title">Why You</h1>
        <p className="mn-quote">Un pequeño tributo en español, français y English.</p>

        <div className="mn-widgets">
          <div className="mn-compliment-card">
            <div className="mn-card-label">Daily Compliment Generator</div>
            <p className="mn-compliment-text">{dailyCompliment || 'Un nuevo compliment arriving soon...'}</p>
          </div>

          <div className="mn-scroll-box">
            <div className="mn-scroll-title">Why You</div>
            <div className="mn-scroll-frame">
              <div className="mn-scroll-track">
                {WHY_YOU_REASONS.concat(WHY_YOU_REASONS).map((reason, i) => (
                  <div key={i} className="mn-scroll-item">{reason}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MEMORIES PAGE ────────────────────────────────────────────────────────────
// HOW TO ADD YOUR OWN MEDIA:
//   • photo: drop an image in the pictures/ folder, then set photo to its path,
//            e.g. photo: "pictures/first-date.jpg"  (empty "" → just shows the emoji)
//   • video: drop an .mp4 in the videos/ folder, then set video to its path,
//            e.g. video: "videos/first-date.mp4"    (empty "" → no video button)
//   • realDate: replace the /* EDIT */ placeholder with the real date.
const MEMORIES = [
  { icon: "💫", title: "First Meeting",        date: "The Beginning of Forever",     realDate: "May 20, 2025"  /* EDIT */, photo: "", video: "",                       text: "The moment our eyes first met, I knew something magical was about to begin. That spark, that connection — it was destiny bringing us together." },
  { icon: "💝", title: "First Date",           date: "A Night to Remember",           realDate: "July 14, 2025" /* EDIT */, photo: "first_date.jpg", video: "./videos/first_date_video.mp4", text: "Nervous butterflies, endless conversations, and that perfect smile. Time stood still as we discovered how perfectly our souls aligned." },
  { icon: "🎭", title: "Adventures Together",  date: "Making Memories",               realDate: "May 12, 2026"      /* EDIT */, photo: "adventures_together.jpg", video: "./videos/adventures_together.mp4",                       text: "From spontaneous trips to quiet evenings, every adventure with you is perfect. You turn ordinary moments into extraordinary memories." },
  { icon: "💖", title: "Today and Always",     date: "Our Forever Continues",         realDate: "May 5, 2026 - ∞"   /* EDIT */, photo: "today_and_always.jpg", video: "./videos/today_and_always_video.mp4",                        text: "Every day with you is a new memory to cherish. I can't wait to create countless more beautiful moments together. You are my forever." },
];

function MemoryCard({ m, onOpen }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = m.photo && !imgFailed;
  return (
    <div className="memory">
      <div className={`mem-icon ${showPhoto ? "clickable" : ""}`}
           onClick={showPhoto ? () => onOpen({ type: "photo", src: m.photo }) : undefined}>
        {showPhoto
          ? <img className="mem-photo" src={m.photo} alt={m.title} onError={() => setImgFailed(true)} />
          : m.icon}
      </div>
      <div className="mem-card">
        {m.realDate && <span className="mem-card-realdate">{m.realDate}</span>}
        <h3 className="mem-card-title">{m.title}</h3>
        <p className="mem-card-date">{m.date}</p>
        <p className="mem-card-text">{m.text}</p>
        {m.video && (
          <button className="mem-video-btn" onClick={() => onOpen({ type: "video", src: m.video })}>
            <span className="mem-video-play">▶</span>
            <span className="mem-video-label">Watch video</span>
          </button>
        )}
      </div>
    </div>
  );
}

function MemoriesPage({ onNavigate }) {
  const [modal, setModal] = useState(null); // { type:"photo"|"video", src } | null
  
  const particleConfigs = useMemo(() => [
    { ms: 900, create: () => spawnEl("p-sparkle", { left: Math.random()*100+"%", top: Math.random()*100+"%" }, 4500) },
  ], []);
  
  useParticles(particleConfigs);
  return (
    <div className="me-page">
      <Aurora theme="memories" />
      <button className="me-back" onClick={() => onNavigate("main")}>← Back</button>
      <div className="me-wrap">
        <div className="me-head">
          <h1 className="me-title">Our Beautiful Memories</h1>
          <p className="me-sub">Every moment with you is a memory worth treasuring 💕</p>
        </div>
        <div className="timeline">
          {MEMORIES.map((m, i) => (
            <MemoryCard key={i} m={m} onOpen={setModal} />
          ))}
        </div>
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="popup popup-media" onClick={e => e.stopPropagation()}>
            <button className="popup-x" onClick={() => setModal(null)}>×</button>
            {modal.type === "photo"
              ? <img className="popup-img" src={modal.src} alt="" />
              : <video className="popup-video" src={modal.src} controls autoPlay playsInline />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HOW LUCKY I AM PAGE ──────────────────────────────────────────────────────
// 8 portrait images that, revealed one click at a time, spell out a love sentence.
// To change them, drop ordered images in pictures/howluckyiam/ and edit this list.
const HOWLUCKY = [
  "pictures/howluckyiam/1.jpeg",
  "pictures/howluckyiam/2.jpeg",
  "pictures/howluckyiam/3.jpeg",
  "pictures/howluckyiam/4.jpeg",
  "pictures/howluckyiam/5.jpeg",
  "pictures/howluckyiam/6.jpeg",
  "pictures/howluckyiam/7.jpeg",
  "pictures/howluckyiam/8.jpeg",
];
const HOWLUCKY_SENTENCE =
  "1 Dünya, 7 Kıta, 5 Okyanus, 195 Ülke, 8 Milyar İnsan… ve bir şekilde seni bulacak kadar şanslıydım 💕";

function HowLuckyPage({ onNavigate }) {
  const [step, setStep] = useState(0);   // index of the image currently shown
  const [done, setDone] = useState(false);

  const particleConfigs = useMemo(() => [
    { ms: 700, create: () => spawnEl("p-heart-float", { left: Math.random()*100+"vw", bottom: "-50px", animationDuration: (7+Math.random()*4)+"s" }, 13000) },
  ], []);

  useParticles(particleConfigs);

  const advance = useCallback(() => {
    if (done) return;
    if (step < HOWLUCKY.length - 1) setStep(step + 1);
    else setDone(true);
  }, [done, step]);

  const restart = useCallback((e) => { e.stopPropagation(); setStep(0); setDone(false); }, []);
  const back    = useCallback((e) => { e.stopPropagation(); onNavigate("main"); }, [onNavigate]);

  if (done) {
    return (
      <div className="hl-page hl-finale-page">
        <Aurora theme="howlucky" />
        <button className="hl-back" onClick={back}>← Back</button>
        <div className="hl-finale">
          <h1 className="hl-title">How Lucky I Am 🍀</h1>
          <div className="hl-strip">
            {HOWLUCKY.map((src, i) => (
              <img key={i} className="hl-strip-img" src={src} alt={"Memory " + (i + 1)} />
            ))}
          </div>
          <p className="hl-sentence">{HOWLUCKY_SENTENCE}</p>
          <button className="hl-restart" onClick={restart}>↺ Replay</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hl-page hl-reveal" onClick={advance}>
      <Aurora theme="howlucky" />
      <button className="hl-back" onClick={back}>← Back</button>
      <h1 className="hl-title">How Lucky I Am 🍀</h1>
      <div className="hl-stage">
        <img key={step} className="hl-img" src={HOWLUCKY[step]} alt={"Reveal " + (step + 1)} />
      </div>
      <p className="hl-hint">{step < HOWLUCKY.length - 1 ? "tap to continue 💞" : "tap to see it all together 💞"}</p>
      <div className="hl-dots">
        {HOWLUCKY.map((_, i) => (
          <span key={i} className={`hl-dot ${i <= step ? "active" : ""}`} />
        ))}
      </div>
    </div>
  );
}

// ─── COUNTDOWN PAGE ───────────────────────────────────────────────────────────
function CountdownPage({ onNavigate }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      // August 21, 2026 at 3:30pm local time
      // 3:30 PM = 15:30 in 24-hour format
      const targetDate = new Date(2026, 7, 21, 15, 30, 0);
      const now = new Date();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Optimize floating heart photos using unified animation loop
  const particleConfigs = useMemo(() => [
    {
      ms: 1200,
      create: () => {
        const limits = getParticleLimits();
        if (limits.floatingPhotos === 0) return;
        
        const side = Math.random() < 0.5 ? "left" : "right";
        const left = side === "left"
          ? Math.random() * 18 + "vw"
          : 82 + Math.random() * 18 + "vw";
        
        const heartContainer = document.createElement("div");
        heartContainer.className = "p-floating-heart-photo";
        heartContainer.style.left = left;
        heartContainer.style.bottom = "-60px";
        heartContainer.style.animationDuration = (8 + Math.random() * 5) + "s";
        
        const img = document.createElement("img");
        img.src = "pictures/The Day the World Got Better.jpg";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        
        heartContainer.appendChild(img);
        document.body.appendChild(heartContainer);
        
        const lifetime = (8 + Math.random() * 5) * 1000 + 500;
        setTimeout(() => {
          if (heartContainer.parentNode) {
            heartContainer.parentNode.removeChild(heartContainer);
          }
        }, lifetime);
      }
    }
  ], []);

  useParticles(particleConfigs);

  return (
    <div className="cd-page">
      <Aurora theme="countdown" />
      <button className="cd-back" onClick={() => onNavigate("main")}>← Back</button>
      <div className="cd-container">
        <h1 className="cd-title">The Day the World Got Better 🎂✨</h1>
        <p className="cd-subtitle">Countdown to your birthday 💕</p>
        
        <div className="cd-timer">
          <div className="cd-unit">
            <div className="cd-value">{String(timeLeft.days).padStart(2, '0')}</div>
            <div className="cd-label">Days</div>
          </div>
          <div className="cd-separator">:</div>
          <div className="cd-unit">
            <div className="cd-value">{String(timeLeft.hours).padStart(2, '0')}</div>
            <div className="cd-label">Hours</div>
          </div>
          <div className="cd-separator">:</div>
          <div className="cd-unit">
            <div className="cd-value">{String(timeLeft.minutes).padStart(2, '0')}</div>
            <div className="cd-label">Minutes</div>
          </div>
          <div className="cd-separator">:</div>
          <div className="cd-unit">
            <div className="cd-value">{String(timeLeft.seconds).padStart(2, '0')}</div>
            <div className="cd-label">Seconds</div>
          </div>
        </div>

        <p className="cd-message">Every moment brings us closer to celebrating you 💖</p>
      </div>
    </div>
  );
}

// ─── REASONS PAGE ─────────────────────────────────────────────────────────────
const REASONS = [
  { icon: "🧲", title: "Energía Magnética",  text: "Hay algo en tu energía que me atrae por completo. Simplemente no me canso de estar cerca de ti." },
  { icon: "🤤", title: "Aroma Embriagador",  text: "Hueles de una forma absolutamente adictiva. Tu aroma se queda en mi mente mucho después de que te has ido." },
  { icon: "🔥", title: "Mente Seductora",    text: "La forma en que funciona tu mente es peligrosamente atractiva. Tu inteligencia y tu ingenio me encienden por completo." },
  { icon: "👄", title: "Esa Sonrisa Perfecta", text: "Tu sonrisa acaba conmigo de la mejor manera posible. Estoy absolutamente obsesionado con tus hermosos dientes y con cómo tu risa me da ganas de atraerte directo hacia mí." },
  { icon: "👗", title: "Detalles Íntimos",   text: "Esa miradita tuya me derrite por completo. No tienes ni la menor idea de lo que provocas en mí." },
  { icon: "❤️‍🔥", title: "Pasión Pura",        text: "Verte tan apasionada y llena de fuego es, sin lugar a dudas, una de las cosas más sexys que he visto en mi vida." }
];

function ReasonsPage({ onNavigate }) {
  const particleConfigs = useMemo(() => [
    { ms: 2000, create: () => spawnEl("p-heart-float", { left: Math.random()*100+"%", bottom: "-50px", animationDuration: (8+Math.random()*4)+"s" }, 14000) },
  ], []);
  
  useParticles(particleConfigs);
  useEffect(() => {
    for (let i = 0; i < 12; i++)
      setTimeout(() => spawnEl("p-heart-float", { left: Math.random()*100+"%", bottom: "-50px", animationDuration: (8+Math.random()*4)+"s" }, 14000), i * 150);
  }, []);
  return (
    <div className="re-page">
      <Aurora theme="reasons" />
      <button className="re-back" onClick={() => onNavigate("main")}>← Back</button>
      <div className="re-wrap">
        <div className="re-head">
          <h1 className="re-title">Reasons Why I Love You</h1>
          <p className="re-sub">Every moment with you is a treasure 💖</p>
        </div>
        <div className="reasons-grid">
          {REASONS.map((r, i) => (
            <div key={i} className="reason-card">
              <span className="re-icon">{r.icon}</span>
              <h3 className="re-card-title">{r.title}</h3>
              <p className="re-card-text">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState("index");
  const [name, setName] = useState("");

  const navigate = (pg, nm) => {
    document.querySelectorAll(".p-heart-float,.p-petal,.p-sparkle,.p-red-heart,.p-cursor-heart").forEach(e => e.remove());
    if (nm !== undefined) setName(nm);
    setPage(pg);
    window.scrollTo(0, 0);
  };

  return (
    <div>
      {page === "index"      && <IndexPage      onNavigate={navigate} />}
      {page === "main"       && <MainPage       name={name} onNavigate={navigate} />}
      {page === "memories"   && <MemoriesPage   name={name} onNavigate={navigate} />}
      {page === "howlucky"   && <HowLuckyPage   onNavigate={navigate} />}
      {page === "reasons"    && <ReasonsPage    name={name} onNavigate={navigate} />}
      {page === "whyyou"     && <WhyYouPage    onNavigate={navigate} />}
      {page === "countdown"  && <CountdownPage  onNavigate={navigate} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
