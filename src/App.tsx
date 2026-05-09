import { motion, AnimatePresence } from "motion/react";
import { GraduationCap, Github, Linkedin, Mail, Settings, LogIn, PlayCircle, ExternalLink, Menu, X, ArrowUpRight, Trophy, Search, Filter, Trash2, Book, Image as ImageIcon, Video } from "lucide-react";
import { useState, useEffect } from "react";
import { SKILLS, ACHIEVEMENTS } from "./data";
import { db, auth, signIn } from "./lib/firebase";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { Project, SiteSettings, EducationLevel } from "./types";
import { AdminDashboard } from "./components/AdminDashboard";
import { LoginModal } from "./components/LoginModal";
import { onAuthStateChanged } from "firebase/auth";

const DEFAULT_LOGO = "https://cdn.builder.io/api/v1/image/assets%2F4gcjufmuw5uzyaszz2aqra%2F765029423795%2F7195b09088ab47ee9ea10034a7499645";

const formatMediaUrl = (url: string) => {
  if (!url) return "";
  
  // Cloudinary Optimization (if it's a Cloudinary URL)
  if (url.includes('cloudinary.com')) {
    if (url.includes('/image/upload/')) {
        return url.replace('/upload/', '/upload/f_auto,q_auto,w_1200/');
    }
  }

  // Google Drive Link Processing
  if (url.includes('drive.google.com')) {
    let id = "";
    if (url.includes('/file/d/')) {
        id = url.split('/file/d/')[1].split('/')[0];
    } else if (url.includes('id=')) {
        id = url.split('id=')[1].split('&')[0];
    }
    
    if (id) {
        return `https://drive.google.com/file/d/${id}/preview`;
    }
  }
  
  // YouTube Link Processing
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = "";
      if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
      else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
      
      if (id) return `https://www.youtube.com/embed/${id}`;
  }

  return url;
};

const Navbar = ({ onAdminClick, user, settings }: { onAdminClick: () => void, user: any, settings: SiteSettings }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? "bg-white/80 backdrop-blur-xl py-3 shadow-sm border-b border-black/5" : "bg-transparent py-6"}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-white flex items-center justify-center p-0.5 border border-black/5 shadow-sm shrink-0">
            <img src={settings.logoUrl || DEFAULT_LOGO} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col min-w-0 text-right">
            <motion.span 
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="font-bold text-sm md:text-lg tracking-tighter text-brand-navy truncate whitespace-nowrap"
            >
              {settings.schoolName}
            </motion.span>
            <span className="text-[8px] md:text-[10px] text-brand-gold uppercase tracking-[0.1em] md:tracking-[0.2em] font-mono leading-none">Portfolio</span>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-10 text-sm font-medium">
          {["حول", "الأعمال", "المهارات"].map((item, i) => (
            <a key={i} href={i === 0 ? "#about" : i === 1 ? "#works" : "#skills"} className="text-brand-navy/60 hover:text-brand-navy transition-colors relative group">
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-brand-gold transition-all group-hover:w-full" />
            </a>
          ))}
          <button 
            onClick={onAdminClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-navy text-white rounded-full hover:bg-brand-gold transition-all shadow-lg active:scale-95"
          >
            {user ? <Settings size={16} /> : <LogIn size={16} />}
            {user ? "لوحة التحكم" : "دخول المعلم"}
          </button>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-brand-navy" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-black/5 overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col gap-6 text-right font-medium">
              <a href="#about" onClick={() => setMobileMenu(false)}>{settings.aboutTitle}</a>
              <a href="#works" onClick={() => setMobileMenu(false)}>معرض الأعمال</a>
              <button 
                onClick={() => { onAdminClick(); setMobileMenu(false); }}
                className="w-full py-4 bg-brand-navy text-white rounded-xl"
              >
                {user ? "لوحة التحكم" : "دخول"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = ({ settings, onPlayVideo }: { settings: SiteSettings, onPlayVideo?: () => void }) => (
  <section className="relative min-h-screen flex items-center pt-32 px-6 overflow-hidden bg-brand-paper">
    <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: "circOut" }}
        className="text-right lg:text-left order-2 lg:order-1"
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-[10px] font-bold text-brand-gold mb-8 italic"
        >
          <GraduationCap size={16} />
          مدرسة التميز والإبداع
        </motion.div>
        <motion.h1 
          className="text-[18vw] md:text-[14vw] lg:text-[10vw] font-display italic font-black text-brand-navy mb-8 leading-[0.82] tracking-[-0.04em] uppercase"
        >
          <motion.span 
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="block"
          >
            {settings.heroTitle}
          </motion.span>
          <motion.span 
            initial={{ opacity: 0, x: 100 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-brand-gold block text-right lg:text-left"
          >
            {settings.heroSubtitle}
          </motion.span>
        </motion.h1>
        <p className="text-lg md:text-xl text-brand-navy/60 max-w-lg mb-10 leading-relaxed font-serif italic">
          {settings.heroDescription}
        </p>
        <div className="flex flex-wrap gap-4 items-center justify-end lg:justify-start">
          <a href="#works" className="group flex items-center gap-3 px-10 py-5 bg-brand-navy text-white rounded-full font-bold hover:bg-brand-gold transition-all shadow-xl hover:shadow-brand-gold/20">
            استعرض الأعمال
            <ArrowUpRight className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
          
          {settings.directorVideoUrl && (
            <button 
              onClick={onPlayVideo}
              className="flex items-center gap-3 px-6 py-5 bg-white border border-black/5 text-brand-navy rounded-full font-bold hover:border-brand-gold transition-all shadow-sm group"
            >
              <div className="w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-white transition-colors">
                <PlayCircle size={20} />
              </div>
              كلمة المدير
            </button>
          )}
        </div>
      </motion.div>
      
      <div className="relative flex flex-col items-center order-1 lg:order-2">
        <motion.div 
           initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
           animate={{ opacity: 1, scale: 1, rotate: 0 }}
           transition={{ duration: 1.5, type: "spring", bounce: 0.4 }}
           className="relative z-10 w-full aspect-square max-w-[500px]"
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.03, 1],
              rotateY: [0, 5, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full p-4 border-[12px] border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-full bg-white flex items-center justify-center overflow-hidden"
          >
            <img 
              src={settings.logoUrl || DEFAULT_LOGO} 
              alt="School Logo" 
              className="w-full h-full object-contain scale-110"
            />
          </motion.div>
          
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-gold/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-brand-navy/5 rounded-full blur-3xl animate-pulse" />
        </motion.div>
        <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="mt-8 text-center"
        >
          <p className="text-brand-gold font-mono text-[10px] uppercase tracking-[0.4em] mb-1">Director</p>
          <p className="font-display italic font-black text-2xl text-brand-navy">{settings.directorName}</p>
        </motion.div>
      </div>
    </div>
  </section>
);

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSiteReady, setIsSiteReady] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDirectorVideoOpen, setIsDirectorVideoOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<EducationLevel | "all">("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<SiteSettings>({
    schoolName: "مدرسة محمد أنور السادات",
    logoUrl: DEFAULT_LOGO,
    heroTitle: "Academic Prestige",
    heroSubtitle: "Prestige.",
    heroDescription: "منصة عرض الأعمال الرسمية لمدرسة محمد أنور السادات الثانوية.",
    aboutTitle: "رؤيتنا التعليمية",
    aboutDescription: "نحن في مدرسة محمد أنور السادات نبذل قصارى جهدنا لتحويل التحديات إلى فرص والطلاب إلى قادة.",
    directorName: "أ. عوني الهواري",
    aboutImageUrl: "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=100&w=1200"
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setIsLoginModalOpen(false);
    });
    
    // Fetch Data
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(data);
    }, (error) => {
      console.error("Projects Fetch Error:", error);
      // Optional: toast error
    });

    // Fetch Settings
    const unsubscribeSettings = onSnapshot(doc(db, "settings", "global"), (docSnapshot) => {
        if (docSnapshot.exists()) {
            setSettings(docSnapshot.data() as SiteSettings);
        }
        setLoading(false);
    }, (error) => {
      console.error("Settings Fetch Error:", error);
    });

    return () => { 
        unsubscribeAuth(); 
        unsubscribeData(); 
        unsubscribeSettings();
    };
  }, []);

  const filteredProjects = projects.filter(p => {
    const matchesLevel = filterLevel === "all" || p.level === filterLevel || p.level === "all";
    const title = p.title || "";
    const description = p.description || "";
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  if (isAdminView && user) {
    return (
      <div className="bg-brand-paper min-h-screen">
        <Navbar onAdminClick={() => setIsAdminView(false)} user={user} settings={settings} />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-10"
        >
          <AdminDashboard />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-brand-paper selection:bg-brand-gold selection:text-white overflow-x-hidden">
      <Navbar onAdminClick={() => { !user ? setIsLoginModalOpen(true) : setIsAdminView(true); }} user={user} settings={settings} />
      
      <Hero settings={settings} onPlayVideo={() => setIsDirectorVideoOpen(true)} />

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      {/* Director Video Modal */}
      <AnimatePresence>
        {isDirectorVideoOpen && settings.directorVideoUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setIsDirectorVideoOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="modal-content relative max-w-4xl p-0 overflow-hidden bg-black aspect-video rounded-3xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsDirectorVideoOpen(false)}
                className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-brand-gold transition-all"
              >
                <X size={20} />
              </button>
              {settings.directorVideoUrl && (
                settings.directorVideoUrl.includes('youtube.com') || settings.directorVideoUrl.includes('youtu.be') ? (
                  <iframe 
                    src={settings.directorVideoUrl.includes('watch?v=') 
                      ? settings.directorVideoUrl.replace('watch?v=', 'embed/') 
                      : settings.directorVideoUrl.replace('youtu.be/', 'youtube.com/embed/')
                    }
                    className="w-full h-full border-none"
                    allowFullScreen
                  />
                ) : (
                  <video 
                    src={settings.directorVideoUrl} 
                    controls 
                    autoPlay 
                    playsInline
                    preload="auto"
                    className="w-full h-full"
                  />
                )
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detail View */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedProject(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="modal-content"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedProject(null)}
                className="absolute top-6 right-6 z-20 w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-white hover:text-brand-navy transition-all"
              >
                <X size={24} />
              </button>
              
              <div className="w-full md:w-1/2 h-[300px] md:h-auto relative bg-brand-navy/5">
                {selectedProject.type === 'video' ? (
                  selectedProject.mediaUrl.includes('youtube.com') || selectedProject.mediaUrl.includes('youtu.be') ? (
                    <iframe 
                      src={selectedProject.mediaUrl.includes('watch?v=') 
                        ? selectedProject.mediaUrl.replace('watch?v=', 'embed/') 
                        : selectedProject.mediaUrl.replace('youtu.be/', 'youtube.com/embed/')
                      }
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : selectedProject.mediaUrl.includes('drive.google.com') ? (
                    <iframe 
                      src={formatMediaUrl(selectedProject.mediaUrl)}
                      className="w-full h-full border-none"
                      allow="autoplay"
                      allowFullScreen
                    />
                  ) : (
                    <video 
                      src={selectedProject.mediaUrl} 
                      className="w-full h-full object-contain bg-black" 
                      controls 
                      autoPlay
                    />
                  )
                ) : (
                  <img 
                    src={selectedProject.mediaUrl} 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as any).src = "https://placehold.co/800x600?text=Image+Link+Broken"; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/50 to-transparent pointer-events-none" />
              </div>
              
              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center text-right">
                <div className="flex items-center justify-end gap-3 mb-6">
                  <span className="text-[10px] font-mono py-1.5 px-3 bg-brand-gold text-white rounded-full uppercase tracking-widest">{selectedProject.level}</span>
                  <span className="text-[10px] font-mono py-1.5 px-3 bg-brand-navy/5 text-brand-navy/40 rounded-full uppercase tracking-widest">{selectedProject.type}</span>
                </div>
                <h2 className="text-4xl font-display font-black italic text-brand-navy mb-6">{selectedProject.title}</h2>
                <div className="w-16 h-1 bg-brand-gold mb-8 ml-auto" />
                <p className="text-lg text-brand-navy/70 leading-relaxed font-serif mb-8 whitespace-pre-wrap">
                  {selectedProject.description}
                </p>
                {selectedProject.techStack && (
                  <div className="p-4 border border-black/5 rounded-2xl bg-black/5 italic text-xs text-brand-navy/40">
                    كلمات مفتاحية: {selectedProject.techStack}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Section */}
      <section id="about" className="py-32 px-6 max-w-7xl mx-auto border-t border-black/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="lg:col-span-5 relative"
          >
            <div className="tilted-card card-luxury aspect-[3/4] overflow-hidden rounded-3xl shadow-2xl">
              <img 
                src={settings.aboutImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=800"} 
                alt="Education" 
                className="w-full h-full object-cover hover:scale-105 transition-all duration-1000"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 bg-brand-navy p-10 rounded-3xl text-white shadow-2xl">
               <Trophy size={40} className="text-brand-gold mb-4" />
               <p className="text-3xl font-display font-black italic">Rank #1</p>
               <p className="text-xs uppercase tracking-widest text-white/50">Top Secondary School</p>
            </div>
            {/* Decorative dots or elements */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl -z-10" />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-7 flex flex-col items-end"
          >
            <span className="text-[10px] font-mono text-brand-gold uppercase tracking-[0.4em] mb-4">Values & Vision</span>
            <h2 className="text-6xl font-display font-black italic text-brand-navy mb-8 text-right">{settings.aboutTitle}</h2>
            <p className="text-2xl text-brand-navy/70 leading-relaxed text-right font-serif">
              {settings.aboutDescription}
            </p>
            <div className="mt-12 flex gap-12 w-full justify-end border-t border-black/5 pt-8">
               <div className="text-right">
                 <p className="text-4xl font-display font-black italic text-brand-navy">1500+</p>
                 <p className="text-xs text-brand-navy/40 uppercase font-mono tracking-widest">Students</p>
               </div>
               <div className="text-right">
                 <p className="text-4xl font-display font-black italic text-brand-navy">50+</p>
                 <p className="text-xs text-brand-navy/40 uppercase font-mono tracking-widest">STEM Projects</p>
               </div>
               <div className="text-right">
                 <p className="text-4xl font-display font-black italic text-brand-navy">100%</p>
                 <p className="text-xs text-brand-navy/40 uppercase font-mono tracking-widest">Commitment</p>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Works Gallery */}
      <section id="works" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-end justify-between mb-16 gap-8 text-right md:text-right">
          <div className="w-full lg:w-auto">
             <span className="text-[10px] font-mono text-brand-gold uppercase tracking-[0.4em] mb-2 block">Curation</span>
             <h2 className="text-5xl md:text-7xl font-display font-black italic text-brand-navy">أبرز الإنجازات</h2>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="relative w-full md:w-80 group">
              <input 
                type="text"
                placeholder="ابحث عن مشروع..."
                className="w-full bg-white border border-black/5 rounded-2xl py-4 px-6 pr-12 text-sm focus:border-brand-gold outline-none transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy/20 group-focus-within:text-brand-gold transition-colors" size={20} />
            </div>

            <div className="flex flex-wrap justify-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-black/5">
              {[
                  { id: "all", label: "الكل" },
                  { id: "secondary", label: "ثانوي" },
                  { id: "preparatory", label: "إعدادي" },
                  { id: "primary", label: "ابتدائي" }
              ].map(lvl => (
                  <button 
                      key={lvl.id}
                      onClick={() => setFilterLevel(lvl.id as any)}
                      className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${filterLevel === lvl.id ? 'bg-brand-navy text-white shadow-md' : 'hover:bg-brand-gold/10 text-brand-navy/60'}`}
                  >
                      {lvl.label}
                  </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-40">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="text-brand-gold" size={40} />
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {filteredProjects.map((project, index) => (
                  <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1, duration: 0.6, ease: "circOut" }}
                      onClick={() => setSelectedProject(project)}
                      className={`group cursor-pointer bg-white rounded-[2rem] overflow-hidden border border-black/5 shadow-sm hover:shadow-[0_32px_64px_-16px_rgba(197,160,89,0.2)] transition-all duration-700 ${index % 3 === 1 ? 'lg:translate-y-12' : ''}`}
                  >
                      <div className="aspect-[4/5] overflow-hidden relative">
                           {project.type === 'video' && project.mediaUrl.includes('cloudinary.com') ? (
                               <video 
                                 src={project.mediaUrl} 
                                 className="w-full h-full object-cover" 
                                 muted 
                                 loop 
                                 playsInline
                                 onMouseOver={e => (e.target as HTMLVideoElement).play()}
                                 onMouseOut={e => {
                                     (e.target as HTMLVideoElement).pause();
                                     (e.target as HTMLVideoElement).currentTime = 0;
                                 }}
                               />
                           ) : (
                               <img 
                                   src={project.mediaUrl} 
                                   alt={project.title}
                                   loading="lazy"
                                   decoding="async"
                                   className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                               />
                           )}
                           
                           {/* Overlays */}
                           <div className="absolute inset-0 bg-brand-navy/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 backdrop-blur-[2px]" />
                           
                           <div className="absolute inset-0 flex flex-col justify-end p-8 text-right opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                               <div className="flex items-center justify-end gap-2 mb-4">
                                   <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] bg-brand-gold text-white px-3 py-1 rounded-full shadow-lg">{project.level}</span>
                                   <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] bg-white/20 text-white backdrop-blur-md px-3 py-1 rounded-full">{project.type}</span>
                               </div>
                               <h3 className="text-white text-3xl font-display font-black italic mb-3 leading-tight tracking-tight">{project.title || "بدون عنوان"}</h3>
                               <p className="text-white/70 text-xs line-clamp-3 leading-relaxed font-serif italic mb-6">{project.description}</p>
                               <div className="flex items-center justify-end gap-2 text-brand-gold text-[10px] font-black uppercase tracking-widest">
                                   View Project <ArrowUpRight size={14} />
                               </div>
                           </div>
                           
                           {project.type === 'video' && (
                               <div className="absolute top-6 right-6 w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white ring-1 ring-white/20 group-hover:bg-brand-gold group-hover:ring-brand-gold transition-all duration-500">
                                   <Video size={18} />
                               </div>
                           )}
                           
                           {/* Decorative number */}
                           <div className="absolute top-6 left-6 text-white/5 font-display text-4xl font-black italic pointer-events-none group-hover:text-white/20 transition-colors">
                            {index + 1 < 10 ? `0${index + 1}` : index + 1}
                           </div>
                      </div>
                  </motion.div>
              ))}
          </div>
        )}

        {!loading && filteredProjects.length === 0 && (
          <div className="py-40 text-center">
            <p className="text-brand-navy/30 italic text-2xl">لا توجد مشاريع تطابق بحثك حالياً...</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-black/5 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
           <div className="flex items-center gap-4 md:gap-6 shrink-0">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-white flex items-center justify-center p-1 border border-black/5 shadow-sm shrink-0">
                <img src={settings.logoUrl || DEFAULT_LOGO} alt="Final Logo" className="w-full h-full object-contain" />
              </div>
              <div className="text-right min-w-0">
                <motion.p 
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 6, repeat: Infinity }}
                  className="font-bold text-sm md:text-base text-brand-navy whitespace-nowrap truncate"
                >
                  {settings.schoolName}
                </motion.p>
                <p className="text-[10px] text-brand-gold font-mono uppercase tracking-widest">Built with Passion</p>
              </div>
           </div>
           <div className="flex gap-4">
              {[Github, Linkedin, Mail].map((Icon, i) => (
                <div key={i} className="w-12 h-12 rounded-full border border-black/5 flex items-center justify-center hover:bg-brand-navy hover:text-white transition-all cursor-pointer shadow-sm">
                  <Icon size={18} />
                </div>
              ))}
           </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-black/5 text-center">
           <p className="text-[10px] font-mono text-brand-navy/30 uppercase tracking-[0.5em]">
             Official Presence © {new Date().getFullYear()} Sadat Secondary
           </p>
        </div>
      </footer>
    </div>
  );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => <Settings className={className} size={size || 24} />;

export default App;

