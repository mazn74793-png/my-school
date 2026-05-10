import { motion, AnimatePresence } from "motion/react";
import { GraduationCap, Github, Linkedin, Mail, Settings, LogIn, PlayCircle, ExternalLink, Menu, X, ArrowUpRight, Trophy, Search, Filter, Trash2, Book, Image as ImageIcon, Video, Play, Loader2, ArrowRight, Bell, ChevronLeft, ChevronRight, Info, AlertTriangle, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { SKILLS, ACHIEVEMENTS } from "./data";
import { db, auth, signIn } from "./lib/firebase";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { Project, SiteSettings, EducationLevel, Announcement } from "./types";
import { AdminDashboard } from "./components/AdminDashboard";
import { LoginModal } from "./components/LoginModal";
import { onAuthStateChanged } from "firebase/auth";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Silence transient transport errors that are handled automatically by SDK
  if (errorMessage.includes('transport errored') || errorMessage.includes('WebChannelConnection')) {
    console.warn(`[Firestore Status] Path ${path}: Transient network reconnection in progress.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};


const DEFAULT_LOGO = "https://cdn.builder.io/api/v1/image/assets%2F4gcjufmuw5uzyaszz2aqra%2F765029423795%2F7195b09088ab47ee9ea10034a7499645";

const formatMediaUrl = (url: string, width: number = 1200, quality: string = 'auto') => {
  if (!url) return "";
  
  // Cloudinary Optimization (if it's a Cloudinary URL)
  if (url.includes('cloudinary.com')) {
    if (url.includes('/image/upload/')) {
        // Aggressive optimization: f_auto, q_auto:eco, w_WIDTH, c_fill, dpr_auto
        return url.replace('/upload/', `/upload/f_auto,q_${quality === 'eco' ? 'auto:eco' : 'auto'},w_${width},c_limit,dpr_auto/`);
    }
    if (url.includes('/video/upload/')) {
        return url.replace('/upload/', '/upload/f_auto,q_auto,vc_auto,vs_40/');
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

const getMediaPreview = (url: string) => {
  if (!url) return "";

  // YouTube Thumbnail
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = "";
      if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
      else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
      if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }

  // Cloudinary Video Thumbnail
  if (url.includes('cloudinary.com') && url.includes('/video/upload/')) {
      return url.replace('/video/upload/', '/video/upload/f_auto,q_auto:eco,w_600,so_auto/').replace(/\.[^/.]+$/, ".jpg");
  }

  return formatMediaUrl(url, 600, 'eco');
};

const ProjectCard = ({ project, index, onClick }: { project: Project, index: number, onClick: () => void, key?: any }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: (index % 6) * 0.05, duration: 0.5 }}
        onClick={onClick}
        className="break-inside-avoid mb-6 md:mb-8 group cursor-pointer bg-white/50 backdrop-blur-sm rounded-3xl md:rounded-[2.5rem] overflow-hidden border border-black/5 shadow-sm hover:shadow-[0_32px_64px_-16px_rgba(197,160,89,0.15)] transition-all duration-700"
    >
        <div className="relative overflow-hidden bg-brand-navy/5">
            {project.type === 'video' ? (
                <div className="relative aspect-video md:aspect-[4/5]">
                  <img 
                    src={getMediaPreview(project.mediaUrl)} 
                    className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                  />
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="animate-spin text-brand-gold/20" size={24} />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-2xl group-hover:bg-brand-gold group-hover:scale-110 transition-all">
                        <Play size={24} fill="currentColor" />
                     </div>
                  </div>
                </div>
            ) : (
                <div className="relative">
                  <img 
                      src={getMediaPreview(project.mediaUrl)} 
                      alt={project.title}
                      loading="lazy"
                      decoding="async"
                      onLoad={() => setImageLoaded(true)}
                      className={`w-full h-auto object-cover transition-all duration-1000 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center min-h-[200px]">
                        <Loader2 className="animate-spin text-brand-gold/20" size={24} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 top-0 bg-brand-navy/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
            )}
        </div>
        
        <div className="p-5 md:p-8 text-right">
            <div className="flex items-center justify-end gap-3 mb-2">
                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] bg-brand-gold/10 text-brand-gold px-2 md:px-3 py-1 rounded-full shrink-0">{project.level}</span>
                <h3 className="font-display font-black italic text-brand-navy text-sm md:text-lg leading-tight group-hover:text-brand-gold transition-colors line-clamp-1">{project.title}</h3>
            </div>
            <p className="text-[9px] md:text-[10px] text-brand-navy/40 leading-relaxed font-black italic mb-3 line-clamp-2">{project.description}</p>
            <div className="flex items-center justify-end gap-2 text-[7px] md:text-[8px] font-black uppercase tracking-widest text-brand-gold group-hover:gap-4 transition-all">
                مشاهدة التفاصيل <ArrowRight size={10} className="md:w-3 md:h-3" />
            </div>
        </div>
    </motion.div>
  );
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
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-white flex items-center justify-center p-1 border border-black/5 shadow-sm shrink-0 transition-transform hover:scale-105 duration-500">
            <img 
              src={formatMediaUrl(settings.logoUrl || DEFAULT_LOGO, 200)} 
              alt="Logo" 
              className="w-full h-full object-contain" 
              fetchPriority="high" 
            />
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
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-brand-navy" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-black/5 overflow-hidden"
          >
            <div className="px-6 py-8 flex flex-col gap-6 text-right">
              <button 
                onClick={() => {
                  setMobileMenu(false);
                  setTimeout(() => {
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 300);
                }}
                className="text-2xl font-display font-black italic text-brand-navy hover:text-brand-gold transition-all text-right"
              >
                {settings.aboutTitle}
              </button>
              <button 
                onClick={() => {
                  setMobileMenu(false);
                  setTimeout(() => {
                    document.getElementById('works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 300);
                }}
                className="text-2xl font-display font-black italic text-brand-navy hover:text-brand-gold transition-all text-right"
              >
                معرض الأعمال
              </button>
              <button 
                onClick={() => {
                  setMobileMenu(false);
                  setTimeout(() => {
                    document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 300);
                }}
                className="text-2xl font-display font-black italic text-brand-navy hover:text-brand-gold transition-all text-right"
              >
                المهارات
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
    {/* Background Decorative Elements Removed for Clarity */}
    
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
          className="text-[14vw] md:text-[10vw] font-display italic font-black text-brand-navy mb-8 leading-[0.85] tracking-[-0.04em] uppercase"
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
              className="flex items-center gap-4 px-8 py-6 bg-white border-2 border-brand-gold/20 text-brand-navy rounded-[2rem] font-bold hover:border-brand-gold transition-all shadow-xl hover:shadow-brand-gold/10 group"
            >
              <div className="relative shrink-0">
                <div className="relative w-12 h-12 rounded-full bg-brand-gold flex items-center justify-center text-brand-navy shadow-lg transition-transform group-hover:scale-110">
                  <Play size={20} fill="currentColor" className="ml-0.5" />
                </div>
              </div>
              <div className="text-right border-r-2 border-black/5 pr-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-gold font-black uppercase tracking-[0.2em] leading-none mb-1">كلمة القائد</span>
                  <span className="text-xl font-display italic font-black leading-tight text-brand-navy">{settings.directorName}</span>
                  <span className="text-[8px] text-brand-navy/40 font-mono uppercase tracking-widest mt-1">Director & Leader</span>
                </div>
              </div>
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
            whileHover={{ 
              scale: 1.02,
              rotateZ: -1,
              transition: { duration: 0.4 }
            }}
            animate={{ 
              scale: [1, 1.03, 1],
              rotateY: [0, 5, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full p-4 border-[12px] border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-full bg-white flex items-center justify-center overflow-hidden relative"
          >
            <img 
              src={settings.directorPhotoUrl ? formatMediaUrl(settings.directorPhotoUrl, 1000) : (settings.directorVideoUrl ? getMediaPreview(settings.directorVideoUrl) : formatMediaUrl(settings.logoUrl || DEFAULT_LOGO, 1000))} 
              alt="Director" 
              fetchPriority="high"
              className={`w-full h-full ${settings.directorPhotoUrl || settings.directorVideoUrl ? 'object-cover' : 'object-contain'}`}
            />
          </motion.div>
          
          {/* Removed background blobs for clarity */}
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-brand-gold/5 rounded-full blur-[120px] pointer-events-none" />
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSiteReady, setIsSiteReady] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDirectorVideoOpen, setIsDirectorVideoOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<EducationLevel | "all">("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<SiteSettings>({
    schoolName: "مدرسة محمد أنور السادات",
    logoUrl: DEFAULT_LOGO,
    heroTitle: "Academic Excellence",
    heroSubtitle: "Excellence.",
    heroDescription: "منصة عرض الأعمال الرسمية لمدرسة محمد أنور السادات الثانوية.",
    aboutTitle: "رؤيتنا التعليمية",
    aboutDescription: "نحن في مدرسة محمد أنور السادات نبذل قصارى جهدنا لتحويل التحديات إلى فرص والطلاب إلى قادة.",
    directorName: "أ. عوني الهواري",
    directorVideoUrl: "",
    aboutImageUrl: "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=100&w=1200",
    directorPhotoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=800"
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
      if (!isSiteReady) {
        // Reduced timeout for snappier performance as requested
        setTimeout(() => setIsSiteReady(true), 800);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "projects");
    });

    // Fetch Settings
    const unsubscribeSettings = onSnapshot(doc(db, "settings", "global"), (docSnapshot) => {
        if (docSnapshot.exists()) {
            setSettings(prev => ({ ...prev, ...docSnapshot.data() } as SiteSettings));
        }
        setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "settings/global");
    });

    // Fetch Announcements
    const aq = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsubscribeAnnouncements = onSnapshot(aq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "announcements");
    });

    return () => { 
        unsubscribeAuth(); 
        unsubscribeData(); 
        unsubscribeSettings();
        unsubscribeAnnouncements();
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
      <AnimatePresence mode="wait">
        {!isSiteReady && (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
            transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
            className="fixed inset-0 z-[1000] bg-brand-navy flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Background Decorative Elements */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute w-[800px] h-[800px] rounded-full bg-brand-gold blur-[150px] -top-1/4 -right-1/4"
            />
            
            <div className="relative z-10 flex flex-col items-center gap-12 max-w-4xl px-6">
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                  className="h-[1px] bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent mx-auto"
                />
                
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    scale: [1, 1.08, 1],
                    filter: [
                      "drop-shadow(0 0 0px rgba(197,160,89,0))",
                      "drop-shadow(0 0 15px rgba(197,160,89,0.5))",
                      "drop-shadow(0 0 0px rgba(197,160,89,0))"
                    ]
                  }}
                  transition={{ 
                    opacity: { duration: 1, delay: 0.8 },
                    y: { duration: 1, delay: 0.8 },
                    scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                    filter: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="text-white font-display text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter italic leading-none drop-shadow-2xl"
                >
                  {settings.schoolName}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ duration: 1, delay: 1.5 }}
                  className="text-brand-gold font-mono text-[10px] md:text-sm uppercase tracking-[0.8em] font-black"
                >
                  Official Academic Showcase
                </motion.p>
                
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                  className="h-[1px] bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent mx-auto"
                />
              </div>
            </div>

            {/* Loading Indicator */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
               <div className="w-32 h-[1px] bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-brand-gold"
                  />
               </div>
               <span className="text-white/20 font-mono text-[7px] uppercase tracking-[0.3em] font-black">Fast Loading Experience</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar onAdminClick={() => { !user ? setIsLoginModalOpen(true) : setIsAdminView(true); }} user={user} settings={settings} />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.3 }}
      >
        <Hero settings={settings} onPlayVideo={() => setIsDirectorVideoOpen(true)} />
      </motion.div>

      {/* Announcements Bar */}
      <AnimatePresence>
        {isSiteReady && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative z-20 mt-4 md:mt-8 mb-20 px-4 md:px-6"
          >
             <div className="max-w-7xl mx-auto">
                <div className="bg-brand-navy p-1.5 rounded-[2.5rem] md:rounded-full border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row items-center">
                   <button 
                      onClick={() => setIsAnnouncementsModalOpen(true)}
                      className="bg-brand-gold px-10 py-5 flex items-center justify-center gap-3 shrink-0 rounded-[2.2rem] md:rounded-full hover:scale-105 transition-all active:scale-95 group shadow-lg shadow-brand-gold/10"
                   >
                      <Bell size={24} className="text-brand-navy animate-bounce group-hover:animate-none" />
                      <span className="font-display font-black italic text-brand-navy text-xl whitespace-nowrap">إعلانات هامة</span>
                      <ChevronLeft size={20} className="text-brand-navy/60 group-hover:translate-x-[-4px] transition-transform" />
                   </button>
                   
                    <div className="w-full flex-1 px-10 py-5 overflow-hidden relative flex items-center">
                      {announcements.length > 0 ? (
                        <div className="flex animate-marquee whitespace-nowrap gap-20 group hover:[animation-play-state:paused] cursor-pointer" onClick={() => setIsAnnouncementsModalOpen(true)}>
                           {[...announcements, ...announcements].map((ann, i) => (
                              <div key={`${ann.id || 'ann'}-${i}`} className="flex items-center gap-5">
                                 <div className={`w-3 h-3 rounded-full shrink-0 ${ann.type === 'urgent' ? 'bg-red-500 animate-pulse ring-4 ring-red-500/20' : ann.type === 'event' ? 'bg-brand-gold' : 'bg-white/20'}`} />
                                 <div className="flex items-center gap-3">
                                    {ann.imageUrl && (
                                        <div 
                                          className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shrink-0 cursor-zoom-in"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setFullScreenImageUrl(ann.imageUrl || null);
                                          }}
                                        >
                                            <img src={ann.imageUrl} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <span className="text-brand-gold font-black italic text-lg opacity-80 decoration-brand-gold/30 underline-offset-4">[{ann.title}]</span>
                                    <span className="text-white font-bold italic text-base md:text-lg tracking-tight uppercase">
                                       {ann.content}
                                    </span>
                                 </div>
                                 <div className="h-4 w-[1px] bg-white/10 mx-5" />
                              </div>
                           ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-white/40 font-black italic text-base animate-pulse">
                           <div className="w-2 h-2 rounded-full bg-white/20" />
                           بانتظار الإعلانات الجديدة اليوم...
                        </div>
                      )}
                    </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Announcements Modal All List */}
      <AnimatePresence>
        {isAnnouncementsModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-brand-navy/95 backdrop-blur-xl flex items-center justify-center p-6"
            onClick={() => setIsAnnouncementsModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-brand-paper w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-[3rem] shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-black/5 flex items-center justify-between">
                 <button onClick={() => setIsAnnouncementsModalOpen(false)} className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center hover:bg-brand-gold hover:text-white transition-all"><X size={20}/></button>
                 <div className="text-right">
                    <h3 className="text-2xl font-display font-black italic text-brand-navy">كافة الإعلانات</h3>
                    <p className="text-xs text-brand-gold font-black tracking-widest text-right">OFFICIAL SCHOOL DECREES</p>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                 {announcements.map((ann) => (
                    <div key={ann.id} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-right flex flex-col md:flex-row-reverse gap-4">
                       <div className="flex-1">
                          <div className="flex items-center justify-end gap-3 mb-2">
                             <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${ann.type === 'urgent' ? 'bg-red-500 text-white' : ann.type === 'event' ? 'bg-brand-gold text-white' : 'bg-brand-navy text-brand-gold'}`}>{ann.type}</span>
                             <h4 className="font-black italic text-brand-navy">{ann.title}</h4>
                          </div>
                          <p className="text-sm text-brand-navy/60 italic leading-relaxed">{ann.content}</p>
                       </div>
                       {ann.imageUrl && (
                          <div 
                            className="w-full md:w-32 h-32 md:h-24 rounded-2xl overflow-hidden border border-black/5 self-center cursor-zoom-in"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFullScreenImageUrl(ann.imageUrl || null);
                            }}
                          >
                             <img src={ann.imageUrl} className="w-full h-full object-cover" />
                          </div>
                       )}
                    </div>
                 ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      {/* Fullscreen Image Preview Modal */}
      <AnimatePresence>
        {fullScreenImageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            onClick={() => setFullScreenImageUrl(null)}
          >
            <motion.button 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute top-6 right-6 z-[1010] w-14 h-14 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all border border-white/10"
              onClick={() => setFullScreenImageUrl(null)}
            >
              <X size={28} />
            </motion.button>
            
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-full max-h-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
               <img 
                 src={fullScreenImageUrl} 
                 className="max-w-full max-h-screen object-contain rounded-xl shadow-2xl" 
                 alt="Fullscreen Preview"
               />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Modal Detail View (Immersive) */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-3xl flex items-center justify-center p-0 md:p-12"
            onClick={() => setSelectedProject(null)}
          >
            <motion.button 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute top-6 left-6 z-[210] w-14 h-14 bg-brand-navy/10 hover:bg-brand-gold hover:text-white text-brand-navy rounded-full flex items-center justify-center transition-all shadow-2xl group border border-black/5"
              onClick={() => setSelectedProject(null)}
            >
              <X size={28} className="group-hover:rotate-90 transition-transform duration-500" />
            </motion.button>

            <div className="relative w-full h-full md:max-w-7xl md:h-[85vh] flex flex-col md:flex-row gap-0 md:gap-8 bg-brand-paper md:bg-white md:p-4 md:rounded-[3rem] md:border md:border-black/5 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Media Container */}
                <div className="flex-1 min-h-0 bg-brand-navy/5 flex items-center justify-center relative">
                    {selectedProject.type === 'video' ? (
                        selectedProject.mediaUrl.includes('youtube.com') || selectedProject.mediaUrl.includes('youtu.be') ? (
                          <iframe 
                            src={selectedProject.mediaUrl.includes('watch?v=') 
                              ? selectedProject.mediaUrl.replace('watch?v=', 'embed/') 
                              : (selectedProject.mediaUrl.includes('youtu.be') ? `https://www.youtube.com/embed/${selectedProject.mediaUrl.split('/').pop()}` : selectedProject.mediaUrl)
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
                            className="w-full h-full object-contain" 
                            controls 
                            autoPlay
                          />
                        )
                    ) : (
                        <img 
                          src={formatMediaUrl(selectedProject.mediaUrl, 2000)} 
                          className="w-full h-full object-contain"
                          alt={selectedProject.title}
                        />
                    )}
                </div>

                {/* Info Container */}
                <div className="w-full md:w-96 flex flex-col justify-end text-right p-6 md:p-8 bg-white md:bg-transparent">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="bg-brand-paper/50 md:bg-white/80 backdrop-blur-md p-8 rounded-[2rem] border border-black/5"
                    >
                        <div className="flex items-center justify-end gap-2 mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-brand-navy text-white px-4 py-1.5 rounded-full shadow-lg border border-white/10">{selectedProject.level}</span>
                        </div>
                        <h3 className="text-3xl md:text-4xl font-display font-black italic text-brand-navy mb-6 leading-tight">{selectedProject.title}</h3>
                        <div className="w-12 h-1 bg-brand-gold/50 mb-6 ml-auto" />
                        <p className="text-sm md:text-base text-brand-navy/70 leading-relaxed font-black italic mb-8 overflow-y-auto max-h-[30vh] no-scrollbar">
                           {selectedProject.description}
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                           {(selectedProject.techStack || 'Academic Achievement').split(',').map((tag, i) => (
                             <span key={i} className="text-[9px] text-brand-navy border border-brand-navy/10 px-2 py-1 rounded-md uppercase font-black tracking-widest bg-brand-navy/5">
                               {tag.trim()}
                             </span>
                           ))}
                        </div>
                    </motion.div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Section */}
      <motion.section 
        id="about" 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="py-32 px-6 max-w-7xl mx-auto border-t border-black/5 scroll-mt-24"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="lg:col-span-5 relative"
          >
            <div className="tilted-card card-luxury aspect-[3/4] overflow-hidden rounded-3xl shadow-2xl">
              <img 
                src={formatMediaUrl(settings.aboutImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=800", 1000)} 
                alt="Education" 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover hover:scale-105 transition-all duration-1000"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 bg-brand-navy p-10 rounded-3xl text-white shadow-2xl">
               <Trophy size={40} className="text-brand-gold mb-4" />
               <p className="text-3xl font-display font-black italic">Rank #1</p>
               <p className="text-xs uppercase tracking-widest text-white/50">Top Secondary School</p>
            </div>
            {/* Decorative dots or elements */}
            <motion.div 
              animate={{ 
                y: [0, -15, 0],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -left-10 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl -z-10" 
            />
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
      </motion.section>

      {/* Works Gallery */}
      <motion.section 
        id="works" 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1 }}
        className="py-32 px-6 max-w-7xl mx-auto scroll-mt-24"
      >
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex flex-col lg:flex-row items-end justify-between mb-16 gap-8 text-right md:text-right"
        >
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
        </motion.div>

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
          <div className="columns-2 lg:columns-3 gap-4 md:gap-8 min-h-[400px]">
              {filteredProjects.map((project, index) => (
                  <ProjectCard 
                    key={project.id || `project-${index}`} 
                    project={project} 
                    index={index} 
                    onClick={() => setSelectedProject(project)} 
                  />
              ))}
          </div>
        )}

        {!loading && filteredProjects.length === 0 && (
          <div className="py-40 text-center">
            <p className="text-brand-navy/30 italic text-2xl">لا توجد مشاريع تطابق بحثك حالياً...</p>
          </div>
        )}
      </motion.section>
      
      {/* Skills Section */}
      <motion.section 
        id="skills" 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="py-32 px-6 max-w-7xl mx-auto border-t border-black/5 scroll-mt-24"
      >
        <div className="text-right mb-16">
          <span className="text-[10px] font-mono text-brand-gold uppercase tracking-[0.4em] mb-2 block">Expertise</span>
          <h2 className="text-5xl md:text-7xl font-display font-black italic text-brand-navy">مهاراتنا البرمجية</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {SKILLS.map((skillGroup, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm hover:border-brand-gold transition-colors text-right"
            >
              <div className="w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center text-brand-navy mb-6 ml-auto">
                <Settings size={24} />
              </div>
              <h3 className="text-xl font-display font-black italic text-brand-navy mb-4">{skillGroup.category === 'Frontend' ? 'واجهة المستخدم' : skillGroup.category === 'Backend' ? 'الخلفية البرمجية' : 'أدوات وعلوم'}</h3>
              <div className="flex flex-wrap justify-end gap-2">
                {skillGroup.items.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-brand-paper text-brand-navy/60 rounded-full text-[10px] font-black uppercase tracking-widest">{item}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-black/5 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
           <div className="flex items-center gap-4 md:gap-6 shrink-0">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden bg-white flex items-center justify-center p-2 shadow-lg shrink-0 transition-transform hover:scale-105 duration-500">
                <img 
                  src={formatMediaUrl(settings.logoUrl || DEFAULT_LOGO, 400)} 
                  alt="Final Logo" 
                  loading="lazy" 
                  className="w-full h-full object-contain" 
                />
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
             Official Presence <span 
              onClick={() => { !user ? setIsLoginModalOpen(true) : setIsAdminView(true); }}
              className="cursor-pointer hover:text-brand-gold transition-colors inline-block"
             >©</span> {new Date().getFullYear()} Sadat Secondary
           </p>
        </div>
      </footer>
    </div>
  );
};


export default App;

