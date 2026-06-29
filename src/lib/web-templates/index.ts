// Independent web-design template catalog.
// This file is the single source of truth for the AI's starter library —
// it is consumed by src/lib/agents.ts but can also be imported anywhere
// in the app (e.g. to render a visual gallery on the frontend later).
// Add / edit templates here, NOT inside the system prompt.

export interface WebTemplate {
  id: string;
  name: string;
  niche: string;
  vibe: string;
  fonts: string;
  palette: string;
  hero: string;
  sections: string[];
  motion: string[];
  threeD?: string;
}

export const WEB_TEMPLATES: WebTemplate[] = [
  {
    id: "restaurant-cinematic",
    name: "Restaurant / Café / Bar",
    niche: "restaurant",
    vibe: "Dark cinematic, food-photography hero",
    fonts: "Fraunces + Inter",
    palette: "Charcoal + Ember (#1a1a1a / #e85d3a)",
    hero: "GSAP pinned hero with SplitText reveal over slow-zoom food photo",
    sections: ["menu horizontal-pin scroll", "reservation form", "opening hours w/ current-day highlight", "chef story zigzag", "Maps iframe", "Instagram bento"],
    motion: ["pinned-hero-scrub", "split-text", "lenis-smooth", "marquee"],
  },
  {
    id: "saas-linear",
    name: "SaaS Product Landing",
    niche: "saas",
    vibe: "Linear / Vercel tier, animated mesh gradient",
    fonts: "Geist + Inter Tight",
    palette: "Midnight Indigo (#0a0a1a / #4f46e5)",
    hero: "CSS @property mesh-gradient animation + oversized clamp() headline",
    sections: ["product-tour tabs", "integrations logo grid", "pricing monthly/yearly toggle", "stat counters", "command-palette ⌘K", "changelog"],
    motion: ["mesh-gradient", "magnetic-buttons", "tilt-cards", "counter-on-view"],
  },
  {
    id: "portfolio-editorial",
    name: "Portfolio (photographer / designer)",
    niche: "portfolio",
    vibe: "Editorial masonry, grain overlay",
    fonts: "Instrument Serif + Geist",
    palette: "Paper & Ink (#f5f3ee / #0d0d0d)",
    hero: "Full-bleed image + grain overlay + custom cursor",
    sections: ["masonry grid hover-zoom", "lightbox modal", "split-screen about", "services accordion", "contact form w/ honeypot"],
    motion: ["lenis-smooth", "custom-cursor", "clip-path-reveal", "grain-overlay"],
  },
  {
    id: "fitness-brutalist",
    name: "Fitness / Gym",
    niche: "fitness",
    vibe: "Brutalist bold, oversized type",
    fonts: "Archivo Black + Hind",
    palette: "Brutalist Pop (#0a0a0a / #ff5722 / #ffeb3b)",
    hero: "Skewed marquee 'STRONGER FASTER HARDER' + video loop",
    sections: ["scroll counters", "class schedule horizontal cards", "trainer bento", "pricing 3-tier", "free trial CTA"],
    motion: ["marquee-skew", "counter-on-view", "horizontal-pin"],
  },
  {
    id: "wedding-soft",
    name: "Wedding / Event",
    niche: "wedding",
    vibe: "Romantic serif, soft palette",
    fonts: "Cormorant + Karla",
    palette: "Blush & Lavender (#f8e8ee / #c9a0dc)",
    hero: "Serif drop-caps + soft photo + countdown timer",
    sections: ["story timeline", "gallery lightbox", "RSVP form", "countdown", "guestbook", "Event JSON-LD"],
    motion: ["reveal-on-enter", "lenis-smooth"],
  },
  {
    id: "ecom-shop",
    name: "Ecommerce / Shop",
    niche: "ecommerce",
    vibe: "Card grid, sale ribbons",
    fonts: "Bricolage Grotesque + Inter",
    palette: "Cloud White (#fafbfc / #3b82f6)",
    hero: "Promo strip + category bento",
    sections: ["product grid hover-swap", "sale badges", "sticky mobile add-to-cart", "trust badges", "Swiper reviews", "newsletter"],
    motion: ["hover-image-swap", "swiper", "magnetic-buttons"],
  },
  {
    id: "lawfirm-trust",
    name: "Law / Finance / Consulting",
    niche: "law",
    vibe: "Navy trust, magazine layout",
    fonts: "Libre Baskerville + IBM Plex",
    palette: "Navy Trust (#0f1b3d / #e8edf3)",
    hero: "Magazine cover hero, partner portrait",
    sections: ["partner bios", "case studies grid", "practice areas tabs", "FAQ accordion", "consultation form", "LegalService JSON-LD"],
    motion: ["reveal-on-enter", "lenis-smooth"],
  },
  {
    id: "musician-aurora",
    name: "Artist / Musician",
    niche: "music",
    vibe: "Aurora, glass, Three.js hero",
    fonts: "Bebas Neue + Barlow",
    palette: "Glass Aurora (#1a1a2e / #4ade80 / #a78bfa)",
    hero: "Three.js icosahedron + audio-reactive background",
    sections: ["tour dates list", "discography w/ <audio>", "video embed", "merch strip", "social marquee"],
    motion: ["three-icosahedron", "vanta-waves", "marquee"],
    threeD: "three.js shader sphere reacting to mouse",
  },
  // ===== Pro / 3D / modern additions =====
  {
    id: "agency-3d-spline",
    name: "Creative Agency (3D Spline)",
    niche: "agency",
    vibe: "Active-Theory-tier 3D hero, dark cinematic",
    fonts: "PP Editorial New + Söhne (use Fraunces + Inter as Google-Fonts fallback)",
    palette: "Noir & Gold (#0d0d0d / #c9a84c)",
    hero: "Spline scene embed (<spline-viewer url='https://prod.spline.design/<id>/scene.splinecode'>) — fall back to Three.js icosahedron if Spline blocked",
    sections: ["case-study horizontal pin scroll", "huge skewed marquee", "team bento with portrait masks", "awards strip", "process numbered timeline", "contact CTA editorial"],
    motion: ["spline-hero", "pinned-hero-scrub", "custom-cursor", "magnetic-buttons", "split-text", "grain-overlay"],
    threeD: "Spline viewer via <script type='module' src='https://unpkg.com/@splinetool/viewer/build/spline-viewer.js'>",
  },
  {
    id: "webgl-shader-hero",
    name: "WebGL Shader Hero (tech / AI startup)",
    niche: "ai-startup",
    vibe: "Vercel/Linear + custom fragment shader background",
    fonts: "Geist + Geist Mono",
    palette: "Midnight Indigo + Neon Mint accents",
    hero: "Full-viewport <canvas> running a GLSL fragment shader (flowing gradient noise) via Three.js ShaderMaterial. Mouse uniforms drive distortion.",
    sections: ["feature bento with animated SVG icons", "code block with typed.js typewriter", "integrations logo orbit", "pricing crossfade toggle", "API playground tabs", "footer with command palette"],
    motion: ["shader-noise", "typed-typewriter", "counter-on-view", "magnetic-buttons"],
    threeD: "Three.js ShaderMaterial fragment shader (simplex noise + time uniform)",
  },
  {
    id: "three-product-config",
    name: "3D Product Configurator (DTC / luxury)",
    niche: "product",
    vibe: "Apple-tier product page with rotatable 3D model",
    fonts: "Inter Tight + Fraunces",
    palette: "Paper & Ink",
    hero: "Three.js + GLTFLoader rotating product model with OrbitControls, color-variant swatches re-tint material at runtime",
    sections: ["specs grid with animated SVG line-draw", "scroll-scrubbed exploded-view sequence (ScrollTrigger drives model rotation/position)", "materials gallery", "comparison table", "reviews Swiper", "buy CTA sticky bar"],
    motion: ["scroll-scrub-3d", "orbit-controls", "split-text"],
    threeD: "Three.js + GLTFLoader (https://unpkg.com/three@0.160/examples/jsm/loaders/GLTFLoader.js)",
  },
  {
    id: "vanta-saas-darkmode",
    name: "Crypto / Fintech (Vanta backgrounds)",
    niche: "fintech",
    vibe: "Dark cinematic + animated Vanta NET / HALO background",
    fonts: "Space Grotesk + IBM Plex Mono",
    palette: "Midnight Indigo + Emerald Prestige",
    hero: "Vanta.NET hero behind a glass card with live stats and KPI tickers",
    sections: ["price ticker marquee", "feature glass cards w/ tilt", "security trust row", "tokenomics donut chart", "roadmap timeline", "FAQ"],
    motion: ["vanta-net", "tilt-cards", "counter-on-view", "marquee"],
    threeD: "Vanta.NET (CDN: cdn.jsdelivr.net/npm/vanta/dist/vanta.net.min.js + three@0.134)",
  },
  {
    id: "tsparticles-launch",
    name: "Product Launch / Waitlist",
    niche: "launch",
    vibe: "Single-screen + ambient particles, single email field",
    fonts: "Instrument Serif + Geist",
    palette: "Vapor Chrome",
    hero: "tsParticles ambient links + huge serif headline + waitlist email input with success animation",
    sections: ["why-now editorial paragraph", "founder note signature", "press marquee", "FAQ collapsible"],
    motion: ["tsparticles", "split-text", "magnetic-buttons"],
  },
  {
    id: "horizontal-portfolio",
    name: "Horizontal-Scroll Portfolio",
    niche: "portfolio",
    vibe: "Locomotive-style horizontal pin scroll for case studies",
    fonts: "Migra (Bricolage Grotesque fallback) + Inter",
    palette: "Paper & Ink",
    hero: "Vertical hero → snaps into horizontal pinned scroll of 6 case cards with parallax images",
    sections: ["horizontal pinned cards", "about split", "services accordion", "process timeline", "contact form"],
    motion: ["horizontal-pin", "lenis-smooth", "clip-path-reveal", "custom-cursor"],
  },
  {
    id: "real-estate-luxury",
    name: "Real Estate / Luxury Villa",
    niche: "real-estate",
    vibe: "Editorial luxury, full-bleed cinema-grade imagery",
    fonts: "Cormorant + Karla",
    palette: "Warm Sand + Noir Gold accents",
    hero: "Cinemagraph (looped video) + serif drop-cap pricing on overlay",
    sections: ["property gallery lightbox", "floor-plan tabs (SVG)", "neighborhood map", "amenities bento", "schedule-viewing form", "RealEstateListing JSON-LD"],
    motion: ["lenis-smooth", "reveal-on-enter", "tilt-cards"],
  },
  {
    id: "events-conference",
    name: "Conference / Festival",
    niche: "event",
    vibe: "Bold poster typography + speaker grid",
    fonts: "Bebas Neue + Barlow",
    palette: "Sunset Blaze",
    hero: "Poster-grade huge type, date countdown, ticket CTA",
    sections: ["countdown timer", "speakers masonry portraits", "schedule tabs (day 1/2/3)", "venue map", "sponsor tiers", "FAQ", "ticket pricing"],
    motion: ["countdown", "marquee", "reveal-on-enter"],
  },
];

// Animation / 3D recipe cards the AI can combine.
export const MOTION_RECIPES = [
  "Pinned hero scrub — gsap.to(hero, { scale: 1.2, scrollTrigger: { trigger: hero, start: 'top top', end: '+=100%', scrub: true, pin: true } })",
  "SplitText stagger — new SplitText(h1,{type:'chars'}); gsap.from(chars,{yPercent:100,stagger:.04,ease:'expo.out',duration:1})",
  "Lenis smooth scroll — const l=new Lenis(); gsap.ticker.add(t=>l.raf(t*1000))",
  "Magnetic button — onmousemove translate by 30%; on leave gsap.to back to 0",
  "Custom cursor — dot + outline, mix-blend-mode:difference, scale on link hover, disabled on coarse pointer",
  "Infinite marquee — duplicate track; gsap.to(track,{xPercent:-50,duration:20,repeat:-1,ease:'none'})",
  "Counter on view — countUp.js inside ScrollTrigger.create({trigger,onEnter:()=>c.start()})",
  "Tilt cards — VanillaTilt.init(els,{max:8,glare:true,'max-glare':.2})",
  "Aurora blob — absolute div filter:blur(80px); gsap wandering x/y",
  "Grain overlay — fixed inset-0 pointer-events-none SVG noise, opacity 5%",
  "Reveal on enter — gsap.from('.reveal',{y:40,opacity:0,stagger:.06,scrollTrigger:{trigger:el,start:'top 80%'}})",
  "Horizontal pin scroll — gsap.to(track,{xPercent:-100*(n-1),scrollTrigger:{trigger,pin:true,scrub:1,end:()=>'+='+track.offsetWidth}})",
  "Mesh gradient — animate @property --x,--y custom props; radial-gradients on body::before",
  "Typed.js typewriter — new Typed('#h',{strings:[...],typeSpeed:50,backSpeed:30,loop:true})",
  "Three.js icosahedron — IcosahedronGeometry + MeshNormalMaterial; rotate in rAF",
  "Three.js fragment shader — ShaderMaterial with uTime + uMouse uniforms, simplex noise GLSL",
  "Spline viewer — <spline-viewer url='https://prod.spline.design/<id>/scene.splinecode'></spline-viewer> with @splinetool/viewer ES module",
  "Vanta.NET — VANTA.NET({el:'#hero', color:0x4f46e5, backgroundColor:0x0a0a1a, points:12, maxDistance:22})",
  "tsParticles links — tsParticles.load('p',{particles:{number:{value:60},links:{enable:true,distance:140}}})",
  "GLTFLoader product — new GLTFLoader().load(url,gltf=>scene.add(gltf.scene)); OrbitControls(camera,renderer.domElement)",
  "Scroll-scrub 3D — gsap.to(mesh.rotation,{y:Math.PI*2, scrollTrigger:{scrub:true, trigger:section, pin:true}})",
  "Countdown timer — setInterval diff to target Date; update DOM with leading-zero days/hours/min/sec",
  "Lottie animation — lottie.loadAnimation({container, renderer:'svg', path:'<json url>'})",
];

export const CDN_3D = [
  "Three.js r160 — https://unpkg.com/three@0.160.0/build/three.min.js",
  "Three.js OrbitControls — https://unpkg.com/three@0.160/examples/jsm/controls/OrbitControls.js (use as module)",
  "Three.js GLTFLoader — https://unpkg.com/three@0.160/examples/jsm/loaders/GLTFLoader.js",
  "Spline viewer — https://unpkg.com/@splinetool/viewer/build/spline-viewer.js (ES module)",
  "Vanta NET / WAVES / FOG / HALO / BIRDS — https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.<effect>.min.js (needs three@0.134)",
  "tsParticles — https://cdn.jsdelivr.net/npm/tsparticles@3/tsparticles.bundle.min.js",
  "Lottie web — https://unpkg.com/lottie-web@5/build/player/lottie.min.js",
  "Vanilla-Tilt — https://cdn.jsdelivr.net/npm/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js",
];

export function renderTemplateCatalog(): string {
  const tpls = WEB_TEMPLATES.map((t, i) =>
    `${i + 1}. ${t.name.toUpperCase()} (${t.niche}) — ${t.vibe}. Fonts: ${t.fonts}. Palette: ${t.palette}. Hero: ${t.hero}. Sections: ${t.sections.join(", ")}. Motion: ${t.motion.join(", ")}.${t.threeD ? ` 3D: ${t.threeD}.` : ""}`,
  ).join("\n\n");
  const recipes = MOTION_RECIPES.map((r) => `- ${r}`).join("\n");
  const cdns = CDN_3D.map((c) => `- ${c}`).join("\n");
  return `TEMPLATE LIBRARY (${WEB_TEMPLATES.length} starters — pick the closest match, then adapt copy + palette to the brief):\n\n${tpls}\n\nANIMATION / 3D RECIPE CARDS (combine 2–4 per build):\n${recipes}\n\nAPPROVED 3D / WEBGL CDNs:\n${cdns}\n\nALWAYS wrap motion in if (!matchMedia("(prefers-reduced-motion: reduce)").matches) { ... } and provide a static fallback.`;
}
