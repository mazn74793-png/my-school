import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth, storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { uploadToCloudinary } from "../lib/cloudinary";
import { Project, ProjectType, SiteSettings, EducationLevel } from "../types";
import { Plus, Trash2, Video, Image as ImageIcon, Book, LogOut, Loader2, Save, Globe, Eye, Trophy, Facebook, HelpCircle, ArrowRight, Upload, CheckCircle2, ShieldCheck, Cloud } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const DEFAULT_ABOUT_IMAGE = "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=800";

export const AdminDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"works" | "settings" | "help">("works");
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const formatPreviewUrl = (url: string, width: number = 800) => {
    if (!url) return "";

    // Cloudinary Optimization
    if (url.includes('cloudinary.com')) {
      if (url.includes('/image/upload/')) {
          return url.replace('/upload/', `/upload/f_auto,q_auto:eco,w_${width},c_limit/`);
      }
      if (url.includes('/video/upload/')) {
          return url.replace('/upload/', '/upload/f_auto,q_auto:eco,vc_auto,vs_40/').replace(/\.[^/.]+$/, ".jpg");
      }
    }
    if (url.includes('drive.google.com')) {
        let id = "";
        if (url.includes('/file/d/')) id = url.split('/file/d/')[1].split('/')[0];
        else if (url.includes('id=')) id = url.split('id=')[1].split('&')[0];
        if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let id = "";
        if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  };

  // Helper to convert file to Base64 and compress if it's an image
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Basic check for size (Firestore limit is 1MB total for doc)
        if (result.length > 800000) {
          toast.error("الملف كبير جداً. يرجى اختيار صورة أصغر أو استخدام رابط خارجي.");
          reject("Too large");
        } else {
          resolve(result);
        }
      };
      reader.onerror = error => reject(error);
    });
  };
  
  const handleFileUpload = async (file: File, callback: (url: string) => void): Promise<string> => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
        const url = await uploadToCloudinary(file, (progress) => {
            setUploadProgress(progress);
        });
        callback(url);
        toast.success("تم رفع الملف بنجاح!");
        setIsUploading(false);
        setUploadProgress(0);
        return url;
    } catch (error: any) {
        toast.error(`فشل الرفع: ${error.message}`);
        setIsUploading(false);
        setUploadProgress(0);
        throw error;
    }
  };

  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    type: "project" as ProjectType,
    level: "secondary" as EducationLevel,
    mediaUrl: "",
    techStack: ""
  });

  const [isAdminConfirmed, setIsAdminConfirmed] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>("Checking...");

  const [settings, setSettings] = useState<SiteSettings>({
    schoolName: "مدرسة محمد أنور السادات",
    logoUrl: "",
    heroTitle: "Academic Prestige",
    heroSubtitle: "Prestige.",
    heroDescription: "منصة عرض الأعمال الرسمية لمدرسة محمد أنور السادات.",
    aboutTitle: "رؤيتنا التعليمية",
    aboutDescription: "نحن في مدرسة محمد أنور السادات نبذل قصارى جهدنا لتحويل التحديات إلى فرص والطلاب إلى قادة.",
    directorName: "أ. عوني الهواري",
    aboutImageUrl: DEFAULT_ABOUT_IMAGE
  });

  useEffect(() => {
    // Check Admin rights
    const checkAdmin = async () => {
        if (!auth.currentUser) return;
        const userEmail = auth.currentUser.email?.toLowerCase();
        try {
            // Register as admin if email matches
            if (userEmail === "motaem23y@gmail.com" || userEmail === "motaem23@gmail.com" || userEmail === "mazn74793@gmail.com") {
                await setDoc(doc(db, "admins", auth.currentUser.uid), {
                    email: auth.currentUser.email,
                    registeredAt: serverTimestamp()
                }, { merge: true });
                setIsAdminConfirmed(true);
            } else {
                const adminSnap = await getDoc(doc(db, "admins", auth.currentUser.uid));
                if (adminSnap.exists()) setIsAdminConfirmed(true);
            }
        } catch (e) {
            console.log("Admin check fallback:", e);
            if (userEmail === "motaem23y@gmail.com" || userEmail === "motaem23@gmail.com" || userEmail === "mazn74793@gmail.com") {
                setIsAdminConfirmed(true);
            }
        }
    };
    checkAdmin();

    // Fetch Projects
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribeWorks = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(data);
    });

    // Fetch Settings
    const fetchSettings = async () => {
        try {
            // Check API Health
            fetch("/api/health")
              .then(res => res.json())
              .then(data => setHealthStatus(data.status === "ok" ? "متصل" : "غير متصل"))
              .catch(() => setHealthStatus("غير متصل"));

            const docRef = doc(db, "settings", "global");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as SiteSettings);
            }
            setLoading(false);
        } catch (e) {
            setLoading(false);
        }
    };

    fetchSettings();
    return () => unsubscribeWorks();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const loadingId = toast.loading("جاري النشر...");
    try {
      await addDoc(collection(db, "projects"), {
        ...newProject,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewProject({ title: "", description: "", type: "project", level: "secondary", mediaUrl: "", techStack: "" });
      setIsAdding(false);
      toast.success("تم الإضافة بنجاح!", { id: loadingId });
    } catch (error: any) {
      toast.error(`فشل في الإضافة: ${error.message}`, { id: loadingId });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      const loadingId = toast.loading("جاري الحفظ...");
      try {
          await setDoc(doc(db, "settings", "global"), settings);
          toast.success("تم حفظ الإعدادات!", { id: loadingId });
      } catch (error: any) {
          toast.error(`فشل في حفظ الإعدادات: ${error.message}`, { id: loadingId });
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من الحذف؟")) {
      const loadingId = toast.loading("جاري الحذف...");
      try {
        await deleteDoc(doc(db, "projects", id));
        toast.success("تم الحذف بنجاح", { id: loadingId });
      } catch (error: any) {
        toast.error(`فشل في الحذف: ${error.message}`, { id: loadingId });
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-brand-paper"><Loader2 className="animate-spin text-brand-gold" /></div>;

  return (
    <div className="min-h-screen bg-brand-paper px-4 md:px-8 pt-24 pb-20 text-brand-navy">
      <Toaster position="bottom-right" />
      
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex bg-white p-1 rounded-2xl border border-black/10 shadow-sm w-full md:w-auto overflow-x-auto">
                        {[
                            { id: "works", label: "الأعمال", icon: Book },
                            { id: "settings", label: "الإعدادات", icon: Globe },
                            { id: "help", label: "الدعم والتعليمات", icon: HelpCircle }
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === tab.id ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                        <div className="hidden lg:flex items-center px-4 border-l border-black/5">
                            <div className={`w-2 h-2 rounded-full mr-2 ${healthStatus === 'متصل' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[10px] font-mono font-bold text-brand-navy/40 uppercase tracking-tighter">System: {healthStatus === 'متصل' ? 'Live' : 'Offline'}</span>
                        </div>
                    </div>
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-bold transition-all hover:bg-red-100 w-full md:w-auto"
          >
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>

        {activeTab === "works" ? (
            <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <button onClick={() => { setNewProject({ ...newProject, type: 'image' }); setIsAdding(true); }} className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-center group">
                        <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <ImageIcon size={20} />
                        </div>
                        <p className="font-bold text-xs">إضافة صورة</p>
                    </button>
                    <button onClick={() => { setNewProject({ ...newProject, type: 'video' }); setIsAdding(true); }} className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-center group">
                        <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <Video size={20} />
                        </div>
                        <p className="font-bold text-xs">إضافة فيديو</p>
                    </button>
                    <button onClick={() => { setNewProject({ ...newProject, type: 'project' }); setIsAdding(true); }} className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-center group">
                        <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <Book size={20} />
                        </div>
                        <p className="font-bold text-xs">إضافة مشروع</p>
                    </button>
                    <div className="bg-brand-gold/10 p-4 rounded-3xl border border-brand-gold/20 shadow-sm text-center">
                        <p className="text-brand-gold font-black text-2xl italic">{projects.length}</p>
                        <p className="font-bold text-[10px] text-brand-gold uppercase tracking-wider">إجمالي الأعمال</p>
                    </div>
                </div>

                {isAdding && (
                <form onSubmit={handleAdd} className="card-luxury p-6 md:p-10 mb-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between border-b border-black/5 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-gold text-white rounded-xl flex items-center justify-center shadow-lg">
                                <Plus size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-display font-black italic">نشر عمل جديد</h2>
                                <p className="text-[10px] text-brand-navy/40">سيتم الظهور في المعرض المباشر</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setIsAdding(false)} className="text-xs text-brand-navy/40 hover:text-brand-navy font-bold underline">إلغاء</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">العنوان</label>
                                <input 
                                    placeholder="اكتب العنوان هنا..." 
                                    className="w-full bg-brand-paper border border-black/5 rounded-2xl py-3 px-4 focus:border-brand-gold outline-none text-right font-bold"
                                    value={newProject.title}
                                    onChange={e => setNewProject({...newProject, title: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">النوع</label>
                                    <select 
                                        className="w-full bg-brand-paper border border-black/5 rounded-2xl py-3 px-4 focus:border-brand-gold outline-none font-bold text-xs"
                                        value={newProject.type}
                                        onChange={e => setNewProject({...newProject, type: e.target.value as ProjectType})}
                                    >
                                        <option value="project">مشروع</option>
                                        <option value="image">صورة</option>
                                        <option value="video">فيديو</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">المرحلة</label>
                                    <select 
                                        className="w-full bg-brand-paper border border-black/5 rounded-2xl py-3 px-4 focus:border-brand-gold outline-none font-bold text-xs text-right"
                                        value={newProject.level}
                                        onChange={e => setNewProject({...newProject, level: e.target.value as EducationLevel})}
                                    >
                                        <option value="secondary">ثانوي</option>
                                        <option value="preparatory">إعدادي</option>
                                        <option value="primary">ابتدائي</option>
                                        <option value="all">كل المدرسة</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط المحتوى (رابط فيديو أو ارفع صورة)</label>
                                <div className="flex gap-2">
                                    <input 
                                        placeholder="رابط مباشر أو ارفع ملفاً..."
                                        className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-3 px-4 focus:border-brand-gold outline-none font-mono text-xs text-right"
                                        value={newProject.mediaUrl}
                                        onChange={e => setNewProject({...newProject, mediaUrl: e.target.value})}
                                    />
                                    <label className="cursor-pointer bg-brand-navy text-white px-4 rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all disabled:opacity-50">
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept={newProject.type === 'video' ? 'video/*' : newProject.type === 'image' ? 'image/*' : '*/*'}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    await handleFileUpload(file, (url) => {
                                                        setNewProject(p => ({ ...p, mediaUrl: url }));
                                                    });
                                                }
                                            }}
                                        />
                                        {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    </label>
                                </div>
                                <p className="text-[9px] text-brand-gold font-bold italic mt-1">تلميح: الصور يتم حفظها مجاناً في النظام، الفيديوهات يفضل وضع رابط من Google Drive.</p>
                                {isUploading && <div className="w-full bg-black/5 h-1 rounded-full overflow-hidden mt-2"><motion.div animate={{ width: `${uploadProgress}%` }} className="h-full bg-brand-gold" /></div>}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">المعاينة</label>
                            <div className="rounded-2xl overflow-hidden aspect-video bg-brand-navy/5 border border-black/5 flex items-center justify-center">
                                {newProject.mediaUrl ? (
                                    newProject.type === 'video' ? (
                                        (newProject.mediaUrl.includes('drive.google.com') || newProject.mediaUrl.includes('youtube.com') || newProject.mediaUrl.includes('youtu.be')) ? (
                                            <iframe src={formatPreviewUrl(newProject.mediaUrl)} className="w-full h-full border-none" allowFullScreen />
                                        ) : (
                                            <video src={newProject.mediaUrl} className="w-full h-full object-cover" controls muted />
                                        )
                                    ) : (
                                        <img src={newProject.mediaUrl} className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="text-center text-brand-navy/20">
                                        <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-[10px] font-bold">بانتظار الرابط...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">التفاصيل / القصة</label>
                        <textarea 
                            placeholder="اوصف هذا الإنجاز..." 
                            className="w-full bg-brand-paper border border-black/5 rounded-2xl p-4 focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-32"
                            value={newProject.description}
                            onChange={e => setNewProject({...newProject, description: e.target.value})}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full py-4 bg-brand-navy text-white font-black text-lg rounded-2xl hover:bg-brand-gold shadow-xl transition-all">
                        حفظ ونشر العمل
                    </button>
                </form>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-mono font-bold text-brand-navy/30 uppercase tracking-[0.2em]">Archived Entries</span>
                        <h2 className="text-xl font-display font-black italic">الأعمال الحالية</h2>
                    </div>
                    
                    <div className="bg-white border-t border-x border-black/10 rounded-t-3xl overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,150px,100px,60px] bg-black/5 border-b border-black/10 p-4 text-[10px] font-mono font-bold uppercase tracking-widest text-brand-navy/40 text-right">
                            <div className="pr-10">Entry Title</div>
                            <div>Educational Level</div>
                            <div>Type</div>
                            <div className="text-center">Action</div>
                        </div>
                        {projects.length === 0 ? (
                            <div className="p-12 text-center text-brand-navy/20 italic text-sm border-b border-black/10">لا توجد أعمال منشورة حالياً</div>
                        ) : (
                            <div className="divide-y divide-black/10">
                                {projects.map(p => (
                                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-[1fr,150px,100px,60px] items-center p-4 hover:bg-brand-gold/5 transition-colors group">
                                        <div className="flex items-center gap-4 min-w-0 pr-2">
                                            <div className="w-8 h-8 bg-brand-navy/5 rounded-lg flex items-center justify-center text-brand-navy shrink-0 group-hover:bg-brand-gold group-hover:text-white transition-all">
                                                {p.type === 'video' ? <Video size={14} /> : p.type === 'image' ? <ImageIcon size={14} /> : <Book size={14} />}
                                            </div>
                                            <h3 className="font-bold text-sm truncate">{p.title}</h3>
                                        </div>
                                        <div className="text-[10px] font-bold text-brand-navy/60 text-right md:text-right px-2">
                                            {p.level === 'secondary' ? 'المرحلة الثانوية' : p.level === 'preparatory' ? 'المرحلة الإعدادية' : 'المرحلة الابتدائية'}
                                        </div>
                                        <div className="text-[10px] font-mono font-bold text-brand-gold uppercase px-2">
                                            {p.type}
                                        </div>
                                        <div className="flex justify-center">
                                            <button 
                                                onClick={() => p.id && handleDelete(p.id)} 
                                                className="p-2 text-brand-navy/10 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="حذف"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-black/5 border border-black/10 p-3 rounded-b-3xl text-center">
                        <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-brand-navy/40">End of Records — Sadat Secondary Archive</p>
                    </div>
                </div>
            </>
        ) : activeTab === "settings" ? (
            <form onSubmit={handleSaveSettings} className="card-luxury p-8 space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center gap-4 border-b border-black/5 pb-4">
                    <Globe className="text-brand-gold" size={20} />
                    <h2 className="text-xl font-display font-black italic">إعدادات الموقع</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">اسم المدرسة</label>
                        <input className="input-field py-3 px-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right font-bold" value={settings.schoolName} onChange={e => setSettings({...settings, schoolName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط الشعار</label>
                        <div className="flex gap-2">
                            <input className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none font-mono text-xs" value={settings.logoUrl} onChange={e => setSettings({...settings, logoUrl: e.target.value})} />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center"><input type="file" accept="image/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, logoUrl: url })))} /><Upload size={18} /></label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">عنوان الهيرو (كبير)</label>
                        <input className="input-field py-3 px-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right font-bold" value={settings.heroTitle} onChange={e => setSettings({...settings, heroTitle: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">عنوان الهيرو (ذهبي)</label>
                        <input className="input-field py-3 px-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right font-bold" value={settings.heroSubtitle} onChange={e => setSettings({...settings, heroSubtitle: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">وصف الهيرو</label>
                    <textarea className="input-field p-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-20" value={settings.heroDescription} onChange={e => setSettings({...settings, heroDescription: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-black/5 pt-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">عنوان "عن المدرسة"</label>
                        <input className="input-field py-3 px-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right font-bold" value={settings.aboutTitle} onChange={e => setSettings({...settings, aboutTitle: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط صورة "عن المدرسة"</label>
                        <div className="flex gap-2">
                            <input className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none font-mono text-xs text-right" value={settings.aboutImageUrl} onChange={e => setSettings({...settings, aboutImageUrl: e.target.value})} />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center"><input type="file" accept="image/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, aboutImageUrl: url })))} /><Upload size={18} /></label>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">وصف الرؤية</label>
                    <textarea className="input-field p-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-24" value={settings.aboutDescription} onChange={e => setSettings({...settings, aboutDescription: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-black/5 pt-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">اسم المدير</label>
                        <input className="input-field py-3 px-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right font-bold" value={settings.directorName} onChange={e => setSettings({...settings, directorName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط فيديو المدير (Drive/Youtube/Upload)</label>
                        <div className="flex gap-2">
                            <input className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/10 rounded-2xl focus:border-brand-gold outline-none font-mono text-[10px]" value={settings.directorVideoUrl} onChange={e => setSettings({...settings, directorVideoUrl: e.target.value})} />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center"><input type="file" accept="video/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, directorVideoUrl: url })))} /><Upload size={18} /></label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط صورة المدير (تظهر في الهيرو)</label>
                        <div className="flex gap-2">
                            <input className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none font-mono text-xs" value={settings.directorPhotoUrl} onChange={e => setSettings({...settings, directorPhotoUrl: e.target.value})} />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center"><input type="file" accept="image/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, directorPhotoUrl: url })))} /><Upload size={18} /></label>
                        </div>
                    </div>
                </div>

                <button type="submit" className="w-full py-4 bg-brand-gold text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl hover:brightness-110 transition-all">
                    حفظ الإعدادات
                </button>
            </form>
        ) : (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
                <div className="card-luxury p-10 bg-brand-navy border-none text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 blur-[100px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 blur-3xl rounded-full" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                             <div className="w-12 h-12 bg-brand-gold text-brand-navy rounded-2xl flex items-center justify-center shadow-2xl">
                                <HelpCircle size={24} />
                             </div>
                             <div>
                                <h2 className="text-3xl font-display font-black italic">دليل النظام التقني</h2>
                                <p className="text-[10px] uppercase font-mono tracking-[0.3em] text-brand-gold">Sadat Secondary Admin Documentation</p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
                             <div className="space-y-4">
                                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors">
                                    <h3 className="text-brand-gold font-bold mb-2 flex items-center justify-end gap-2 text-sm italic">
                                        نظام التخزين (Cloudinary) <Cloud size={16} />
                                    </h3>
                                    <p className="text-xs text-white/60 leading-relaxed italic">
                                        يتم رفع كافة الصور والفيديوهات الآن على خوادم <b>Cloudinary</b>. هذا يضمن:
                                        <br/>• سرعة فائقة في التحميل (CDN).
                                        <br/>• ضغط تلقائي للحفاظ على الجودة وتقليل الحجم.
                                        <br/>• دعم الفيديوهات الطويلة دون استهلاك مساحة قاعدة البيانات.
                                    </p>
                                </div>
                                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors text-[10px] font-mono text-white/40">
                                    <p className="uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Technical Stats</p>
                                    <p>Database: Firestore Production</p>
                                    <p>Storage proxy: Cloudinary API v1.1</p>
                                    <p>Encryption: SSL/TLS 1.3</p>
                                </div>
                             </div>

                             <div className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className="text-brand-gold font-bold text-xs">خطوات رفع فيديو:</h4>
                                    <ul className="text-xs text-white/70 space-y-3 list-inside text-right">
                                        <li className="flex gap-3 justify-end items-start italic"><span>اختار "إضافة فيديو" من القائمة الرئيسية.</span> <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-navy flex items-center justify-center font-bold text-[10px] shrink-0">1</span></li>
                                        <li className="flex gap-3 justify-end items-start italic"><span>اضغط على أيقونة الرفع (السهم) واختار الفيديو من جهازك.</span> <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-navy flex items-center justify-center font-bold text-[10px] shrink-0">2</span></li>
                                        <li className="flex gap-3 justify-end items-start italic"><span>انتظر حتى يكتمل شريط التحميل (يتم المعالجة سحابياً).</span> <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-navy flex items-center justify-center font-bold text-[10px] shrink-0">3</span></li>
                                        <li className="flex gap-3 justify-end items-start italic"><span>اكتب عنوان الإنجاز ثم اضغط "حفظ ونشر".</span> <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-navy flex items-center justify-center font-bold text-[10px] shrink-0">4</span></li>
                                    </ul>
                                </div>
                                <div className="p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-2xl">
                                    <p className="text-[10px] text-brand-gold font-black italic text-center">ملاحظة: يمكنك أيضاً وضع روابط يوتيوب مباشرة في خانة الرابط وسيتعرف عليها النظام فوراً.</p>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
