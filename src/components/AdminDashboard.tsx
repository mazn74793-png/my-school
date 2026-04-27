import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { Project, ProjectType, SiteSettings, EducationLevel } from "../types";
import { Plus, Trash2, Video, Image as ImageIcon, Book, LogOut, Loader2, Save, Globe, Eye, Trophy, Facebook, HelpCircle, ArrowRight, Upload, CheckCircle2, ShieldCheck } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const DEFAULT_ABOUT_IMAGE = "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=800";

export const AdminDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"works" | "settings" | "help">("works");
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const handleFileUpload = async (file: File, callback: (url: string) => void): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      console.log("Starting Cloudinary Upload via Server:", file.name);
      
      setIsUploading(true);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append("file", file);

      try {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success && response.url) {
                callback(response.url);
                resolve(response.url);
              } else {
                const msg = response.message || "فشل الرفع";
                toast.error(msg);
                reject(msg);
              }
            } catch (e) {
              toast.error("استجابة غير صالحة من السيرفر");
              reject("Invalid JSON");
            }
          } else {
            let errorMsg = "حدث خطأ في السيرفر";
            try {
              const res = JSON.parse(xhr.responseText);
              errorMsg = res.message || errorMsg;
            } catch(e) {}
            toast.error(errorMsg);
            reject(errorMsg);
          }
          setIsUploading(false);
          setUploadProgress(0);
        };

        xhr.onerror = () => {
          toast.error("فشل الاتصال بالسيرفر");
          reject("Network error");
          setIsUploading(false);
          setUploadProgress(0);
        };

        xhr.open("POST", "/api/upload");
        xhr.send(formData);

      } catch (error: any) {
        toast.error("حدث خطأ غير متوقع");
        setIsUploading(false);
        setUploadProgress(0);
        reject(error);
      }
    });
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
          <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm w-full md:w-auto overflow-x-auto">
                <button 
                    onClick={() => setActiveTab("works")}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'works' ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                >
                    الأعمال
                </button>
                <button 
                    onClick={() => setActiveTab("settings")}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'settings' ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                >
                    الإعدادات
                </button>
                <button 
                    onClick={() => setActiveTab("help")}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'help' ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                >
                    الدعم الفني
                </button>
                <div className="hidden lg:flex items-center px-4 border-l border-black/5">
                  <div className={`w-2 h-2 rounded-full mr-2 ${healthStatus === 'متصل' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-black text-brand-navy/40">Cloudinary: {healthStatus}</span>
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
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">المحتوى الذكي (Auto-Upload)</label>
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
                                {isUploading && <div className="w-full bg-black/5 h-1 rounded-full overflow-hidden mt-2"><motion.div animate={{ width: `${uploadProgress}%` }} className="h-full bg-brand-gold" /></div>}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">المعاينة</label>
                            <div className="rounded-2xl overflow-hidden aspect-video bg-brand-navy/5 border border-black/5 flex items-center justify-center">
                                {newProject.mediaUrl ? (
                                    newProject.type === 'video' ? (
                                        <video src={newProject.mediaUrl} className="w-full h-full object-cover" controls muted />
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
                    <h2 className="text-xl font-display font-black italic mb-4">الأعمال الحالية</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projects.map(p => (
                            <div key={p.id} className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center justify-between group hover:border-brand-gold transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-brand-navy/5 rounded-xl flex items-center justify-center text-brand-navy shrink-0 group-hover:bg-brand-gold/10 transition-colors">
                                        {p.type === 'video' ? <Video size={20} /> : p.type === 'image' ? <ImageIcon size={20} /> : <Book size={20} />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-sm truncate">{p.title}</h3>
                                        <p className="text-[8px] text-brand-navy/30 font-bold uppercase tracking-widest">{p.level === 'secondary' ? 'ثانوي' : p.level === 'preparatory' ? 'إعدادي' : 'ابتدائي'}</p>
                                    </div>
                                </div>
                                <button onClick={() => p.id && handleDelete(p.id)} className="p-2 text-brand-navy/10 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                            </div>
                        ))}
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
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center"><input type="file" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, logoUrl: url })))} /><Upload size={18} /></label>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">عن المدرسة (الرؤية)</label>
                    <textarea className="input-field p-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-32" value={settings.aboutDescription} onChange={e => setSettings({...settings, aboutDescription: e.target.value})} />
                </div>

                <button type="submit" className="w-full py-4 bg-brand-gold text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl hover:brightness-110 transition-all">
                    حفظ الإعدادات
                </button>
            </form>
        ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="card-luxury p-8 bg-brand-navy border-none text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 blur-3xl rounded-full" />
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
                        <ShieldCheck className="text-brand-gold" size={24} />
                        <h2 className="text-xl font-display font-black italic">نظام الرفع الاحترافي المزدوج</h2>
                    </div>
                    <div className="space-y-6 relative z-10 text-right">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-sm font-bold text-brand-gold mb-2 flex items-center gap-2 justify-end">تجاوز قيود Firebase <CheckCircle2 size={16} /></p>
                            <p className="text-xs text-white/70 leading-relaxed italic">
                                لقد قمت بتفعيل نظام رفع <b>Cloudflare R2</b>. هذا النظام يغنيك عن دفع مبالغ لـ Firebase مقابل المساحة. 
                                <br />الرفع الآن يتم من خلال السيرفر مباشرة لضمان أمان الروابط واستمراريتها.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <p className="text-xs font-bold text-brand-gold mb-2">الدعم الفني</p>
                                <p className="text-[10px] text-white/50 leading-relaxed">إذا واجهت أي مشكلة في الرفع، تأكد أنك قمت بإضافة مفاتيح R2 في إعدادات Vercel. النظام مصمم ليدعم حتى 50MB للملف الواحد.</p>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                <p className="text-xs font-bold text-brand-gold mb-2">تأمين البيانات</p>
                                <p className="text-[10px] text-white/50 leading-relaxed">جميع ملفاتك محفوظة في Cloudflare ومشفرة. الروابط التي تحصل عليها هي روابط عامة (Public CDN) لتكون سريعة جداً عند الفتح.</p>
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
