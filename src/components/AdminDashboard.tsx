import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth, storage } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Project, ProjectType, SiteSettings, EducationLevel } from "../types";
import { Plus, Trash2, Video, Image as ImageIcon, Book, LogOut, Loader2, Save, Globe, Eye, Trophy, Facebook, HelpCircle, ArrowRight, Upload, CheckCircle2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const DEFAULT_ABOUT_IMAGE = "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=800";

export const AdminDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"works" | "settings" | "help">("works");
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const handleFileUpload = (file: File, callback: (url: string) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log("Starting upload for file:", file.name, "size:", file.size);
      
      if (!auth.currentUser) {
        toast.error("يجب تسجيل الدخول أولاً");
        reject("Not authenticated");
        return;
      }

      if (!storage) {
        toast.error("Firebase Storage is not initialized");
        reject("Storage not found");
        return;
      }
      
      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Use a simpler path first to see if it helps
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, `uploads/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            console.log("Upload progress:", progress, "%");
            setUploadProgress(progress);
          },
          (error) => {
            console.error("Firebase Upload Error Detail:", error);
            let msg = "فشل الرفع";
            if (error.code === 'storage/unauthorized') msg = "غير مصرح لك بالرفع. راجع قواعد Firebase Storage.";
            else if (error.code === 'storage/quota-exceeded') msg = "تم تجاوز حصة التخزين المجانية.";
            
            toast.error(`${msg}: ${error.message}`);
            setIsUploading(false);
            reject(error);
          },
          async () => {
            try {
              console.log("Upload complete, getting download URL...");
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log("Download URL obtained:", downloadURL);
              callback(downloadURL);
              setIsUploading(false);
              setUploadProgress(0);
              resolve(downloadURL);
            } catch (err) {
              console.error("Error getting download URL:", err);
              toast.error("فشل في الحصول على رابط الملف بعد الرفع");
              setIsUploading(false);
              reject(err);
            }
          }
        );
      } catch (error) {
        console.error("Storage ref error:", error);
        toast.error("حدث خطأ تقني في تهيئة الرفع");
        setIsUploading(false);
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

  useEffect(() => {
    // Check Admin rights
    const checkAdmin = async () => {
        if (!auth.currentUser) return;
        try {
            await getDoc(doc(db, "settings", "test_admin_rights"));
            setIsAdminConfirmed(true);
        } catch (e) {
            console.log("Admin rights check:", e);
            // We don't toast error here, just for UI status
        }
    };
    checkAdmin();

    // Fetch Projects
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribeWorks = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(data);
    }, (err) => {
        console.error("Admin Projects Snapshot Error:", err);
        toast.error("خطأ في تحديث قائمة الأعمال");
    });

    // Fetch Settings
    const fetchSettings = async () => {
        try {
            const docRef = doc(db, "settings", "global");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as SiteSettings);
            }
            setLoading(false);
        } catch (e) {
            console.error("Settings fetch error:", e);
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
      const docRef = await addDoc(collection(db, "projects"), {
        ...newProject,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      console.log("Project added with ID:", docRef.id);
      setNewProject({ title: "", description: "", type: "project", level: "secondary", mediaUrl: "", techStack: "" });
      setIsAdding(false);
      toast.success("تم الإضافة بنجاح!", { id: loadingId });
    } catch (error: any) {
      console.error("Add Project Error:", error);
      toast.error(`فشل في الإضافة: ${error.message}`, { id: loadingId });
      handleFirestoreError(error, OperationType.CREATE, "projects");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      const loadingId = toast.loading("جاري الحفظ...");
      try {
          await setDoc(doc(db, "settings", "global"), settings);
          toast.success("تم حفظ الإعدادات!", { id: loadingId });
      } catch (error: any) {
          console.error("Save Settings Error:", error);
          toast.error(`فشل في حفظ الإعدادات: ${error.message}`, { id: loadingId });
          handleFirestoreError(error, OperationType.WRITE, "settings/global");
      }
  };

  const handleDelete = async (id: string) => {
    console.log("Attempting to delete document:", id);
    if (confirm("هل أنت متأكد من الحذف النهائي لهذا العمل؟")) {
      const loadingId = toast.loading("جاري الحذف...");
      try {
        await deleteDoc(doc(db, "projects", id));
        console.log("Delete successful for id:", id);
        toast.success("تم الحذف بنجاح", { id: loadingId });
      } catch (error: any) {
        console.error("Delete Error Detail:", error);
        toast.error(`فشل في الحذف: ${error.message}`, { id: loadingId });
        handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      }
    }
  };

  const handleForceRepair = async () => {
    if (confirm("سيقوم هذا بمحاولة إعادة تحديث البيانات من السيرفر وحل مشاكل العرض. هل أنت متأكد؟")) {
        setLoading(true);
        // We just need to re-trigger the fetchSettings, the onSnapshot for projects is already active
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setSettings(docSnap.data() as SiteSettings);
        }
        setLoading(false);
        toast.success("تم تحديث البيانات");
    }
  };

  const quickSwitchType = (type: ProjectType) => {
    setNewProject({ ...newProject, type });
    setIsAdding(true);
    // Smooth scroll to form
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-brand-paper"><Loader2 className="animate-spin text-brand-gold" /></div>;

  return (
    <div className="min-h-screen bg-brand-paper px-4 md:px-8 pt-24 pb-20 text-brand-navy">
      <Toaster position="bottom-right" />
      
      {/* Upload Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-[1000] bg-brand-navy/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <div className="w-24 h-24 bg-brand-gold/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Upload size={40} className="text-brand-gold" />
              </div>
              <h2 className="text-2xl font-display font-black italic text-white mb-2">جاري الرفع الآن...</h2>
              <p className="text-white/40 text-sm italic">يرجى عدم إغلاق الصفحة حتى اكتمال العملية</p>
            </div>
            
            <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 mb-4">
              <div 
                className="absolute top-0 right-0 h-full bg-brand-gold transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-white/60 font-mono text-xs">
              <span>{uploadProgress}%</span>
              <span>جاري التحميل</span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm w-full md:w-auto">
                <button 
                    onClick={() => setActiveTab("works")}
                    className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl font-bold transition-all text-xs md:text-sm ${activeTab === 'works' ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                >
                    الأعمال
                </button>
                <button 
                    onClick={() => setActiveTab("settings")}
                    className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl font-bold transition-all text-xs md:text-sm ${activeTab === 'settings' ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                >
                    الإعدادات
                </button>
                <button 
                    onClick={() => setActiveTab("help")}
                    className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl font-bold transition-all text-xs md:text-sm ${activeTab === 'help' ? 'bg-brand-navy text-white shadow-lg' : 'text-brand-navy/60 hover:bg-black/5'}`}
                >
                    مساعدة
                </button>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-2xl md:rounded-full font-bold transition-all hover:bg-red-100 w-full md:w-auto"
          >
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>

        {/* Action Center - Mobile Focused */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <button onClick={() => quickSwitchType('image')} className="bg-white p-4 md:p-6 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-center group">
                <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                    <ImageIcon size={20} />
                </div>
                <p className="font-bold text-xs">إضافة صورة</p>
            </button>
            <button onClick={() => quickSwitchType('video')} className="bg-white p-4 md:p-6 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-center group">
                <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                    <Video size={20} />
                </div>
                <p className="font-bold text-xs">إضافة فيديو</p>
            </button>
            <button onClick={() => quickSwitchType('project')} className="bg-white p-4 md:p-6 rounded-3xl border border-black/5 shadow-sm hover:border-brand-gold transition-all text-center group">
                <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                    <Book size={20} />
                </div>
                <p className="font-bold text-xs">إضافة مشروع</p>
            </button>
            <div className="bg-brand-gold/10 p-4 md:p-6 rounded-3xl border border-brand-gold/20 shadow-sm text-center">
                <p className="text-brand-gold font-black text-2xl font-display italic">{projects.length}</p>
                <p className="font-bold text-[10px] text-brand-gold uppercase tracking-wider">إجمالي الأعمال</p>
            </div>
        </div>

        {activeTab === "works" ? (
            <>
                {isAdding && (
                <form onSubmit={handleAdd} className="card-luxury p-6 md:p-10 mb-8 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between border-b border-black/5 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-gold text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-gold/20">
                                <Plus size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-display font-black italic">إضافة {newProject.type === 'video' ? 'فيديو' : newProject.type === 'image' ? 'صورة' : 'مشروع'}</h2>
                                <p className="text-[10px] text-brand-navy/40">يرجى ملء البيانات التالية بدقة</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setIsAdding(false)} className="text-xs text-brand-navy/40 hover:text-brand-navy font-bold underline">إلغاء</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-4 md:space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">العنوان</label>
                                <input 
                                    placeholder="اكتب عنواناً جذاباً..." 
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
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط الصورة أو الفيديو</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            placeholder="انسخ الرابط أو ارفع ملفاً..."
                                            className="w-full bg-brand-paper border border-black/5 rounded-2xl py-3 px-4 focus:border-brand-gold outline-none font-mono text-xs"
                                            value={newProject.mediaUrl}
                                            onChange={e => setNewProject({...newProject, mediaUrl: e.target.value})}
                                            required
                                        />
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/10" size={14} />
                                    </div>
                                    <label className="shrink-0 cursor-pointer w-12 h-12 bg-brand-navy/5 hover:bg-brand-gold/10 border border-black/5 rounded-2xl flex items-center justify-center text-brand-navy transition-all relative">
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept={newProject.type === 'video' ? 'video/*' : 'image/*'}
                                            disabled={isUploading}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const loadingId = toast.loading("جاري الرفع...");
                                                    try {
                                                        await handleFileUpload(file, (url) => {
                                                            setNewProject(p => ({ ...p, mediaUrl: url }));
                                                        });
                                                        toast.success("تم الرفع بنجاح!", { id: loadingId });
                                                    } catch (error) {
                                                        toast.error("فشل الرفع", { id: loadingId });
                                                    }
                                                }
                                            }}
                                        />
                                        {isUploading ? (
                                            <div className="flex flex-col items-center">
                                                <Loader2 size={16} className="animate-spin text-brand-gold" />
                                                <span className="text-[8px] mt-1 font-bold">{uploadProgress}%</span>
                                            </div>
                                        ) : (
                                            <Upload size={18} />
                                        )}
                                    </label>
                                </div>
                                <p className="text-[8px] text-brand-navy/40 px-2 italic">يمكنك رفع الصور والفيديوهات مباشرة من هاتفك</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">المعاينة</label>
                            <div className="rounded-2xl overflow-hidden aspect-video bg-brand-navy/5 border border-black/5 flex items-center justify-center relative shadow-inner">
                                {newProject.mediaUrl ? (
                                    <img 
                                        src={newProject.mediaUrl} 
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as any).src = "https://placehold.co/800x450?text=Check+URL"; }}
                                    />
                                ) : (
                                    <div className="text-center text-brand-navy/20">
                                        <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-[10px] font-bold">بانتظار الرابط...</p>
                                    </div>
                                )}
                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-brand-gold text-white text-[8px] rounded-full font-mono uppercase tracking-[0.2em] shadow-lg">Preview</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">التفاصيل أو القصة</label>
                        <textarea 
                            placeholder="اوصف هذا العمل أو الإنجاز بالتفصيل..." 
                            className="w-full bg-brand-paper border border-black/5 rounded-2xl p-4 md:p-6 focus:border-brand-gold outline-none text-right text-sm md:text-base leading-relaxed h-32 md:h-40"
                            value={newProject.description}
                            onChange={e => setNewProject({...newProject, description: e.target.value})}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full py-4 md:py-6 bg-brand-navy text-white font-black text-lg md:text-xl rounded-2xl md:rounded-3xl hover:bg-brand-gold shadow-xl hover:shadow-brand-gold/30 transition-all active:scale-[0.98]">
                        حفظ ونشر الآن
                    </button>
                </form>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg md:text-xl font-display font-black italic">الأعمال المنشورة</h2>
                        <div className="flex items-center gap-2">
                             {isAdminConfirmed && <span className="text-[8px] bg-green-500/10 text-green-600 px-2 py-1 rounded font-bold">Admin Verified</span>}
                             <span className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-black/5">{projects.length} عمل</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 font-sans">
                        {projects.map(p => (
                            <div key={p.id} className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center justify-between group hover:border-brand-gold transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-brand-navy/5 rounded-xl flex items-center justify-center text-brand-navy shrink-0 group-hover:bg-brand-gold/10 group-hover:text-brand-gold transition-colors">
                                        {p.type === 'video' ? <Video size={20} /> : p.type === 'image' ? <ImageIcon size={20} /> : <Book size={20} />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-sm truncate">{p.title || "بدون عنوان (Untitled)"}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[8px] text-brand-gold font-black uppercase tracking-widest">{p.type === 'video' ? 'فيديو' : p.type === 'image' ? 'صورة' : 'مشروع'}</span>
                                            <span className="text-[8px] text-brand-navy/30 font-bold">• {p.level === 'secondary' ? 'ثانوي' : p.level === 'preparatory' ? 'إعدادي' : 'ابتدائي'}</span>
                                        </div>
                                        {/* Show ID for debugging */}
                                        <p className="text-[6px] text-brand-navy/20 font-mono mt-1 uppercase">ID: {p.id}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => p.id && handleDelete(p.id)}
                                    className="p-2.5 text-brand-navy/10 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {projects.length === 0 && (
                            <div className="col-span-full py-16 text-center text-brand-navy/20 italic border-2 border-dashed border-black/5 rounded-3xl">
                                <Plus size={32} className="mx-auto mb-2 opacity-20" />
                                <p>لم يتم نشر أي أعمال بعد</p>
                            </div>
                        )}
                    </div>
                </div>
            </>
        ) : activeTab === "settings" ? (
            <form onSubmit={handleSaveSettings} className="card-luxury p-6 md:p-10 space-y-6 md:space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-4 mb-2 border-b border-black/5 pb-4">
                   <Globe className="text-brand-gold" size={20} />
                   <h2 className="text-lg md:text-xl font-display font-black italic">إعدادات واجهة الموقع</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">اسم المؤسسة</label>
                        <input className="input-field py-3 px-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right font-bold" value={settings.schoolName} onChange={e => setSettings({...settings, schoolName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط الشعار (URL)</label>
                        <div className="flex gap-2">
                            <input className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none font-mono text-xs" value={settings.logoUrl} onChange={e => setSettings({...settings, logoUrl: e.target.value})} />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 border border-black/5 rounded-2xl flex items-center justify-center text-brand-navy">
                                <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, logoUrl: url })))} />
                                <Upload size={18} />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">فيديو المدير (ترحيب)</label>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none font-mono text-xs" 
                                value={settings.directorVideoUrl || ""} 
                                onChange={e => setSettings({...settings, directorVideoUrl: e.target.value})} 
                                placeholder="رابط فيديو ترحيبي..." 
                            />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 border border-black/5 rounded-2xl flex items-center justify-center text-brand-navy hover:bg-brand-gold hover:text-white transition-colors relative">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="video/*" 
                                    disabled={isUploading}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const loadingId = toast.loading("جاري بدأ الرفع...");
                                            try {
                                                await handleFileUpload(file, (url) => {
                                                    setSettings(s => ({ ...s, directorVideoUrl: url }));
                                                });
                                                toast.success("تم رفع الفيديو بنجاح!", { id: loadingId });
                                            } catch (error) {
                                                toast.error("فشل رفع الفيديو", { id: loadingId });
                                            }
                                        }
                                    }} 
                                />
                                {isUploading ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="animate-spin" size={18} />
                                        <span className="text-[8px] mt-1 font-bold">{uploadProgress}%</span>
                                    </div>
                                ) : (
                                    <Video size={18} />
                                )}
                            </label>
                        </div>
                        {isUploading && (
                            <div className="w-full bg-black/5 h-1.5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                    className="h-full bg-brand-gold"
                                />
                            </div>
                        )}
                        {settings.directorVideoUrl && (
                            <div className="mt-4 aspect-video rounded-3xl overflow-hidden border border-black/5 bg-black shadow-lg">
                                <video 
                                    src={settings.directorVideoUrl} 
                                    className="w-full h-full object-cover" 
                                    controls 
                                    playsInline
                                    preload="metadata"
                                    key={settings.directorVideoUrl}
                                />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط صورة الرؤية</label>
                        <div className="flex gap-2">
                            <input className="flex-1 input-field py-3 px-4 bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none font-mono text-xs" value={settings.aboutImageUrl} onChange={e => setSettings({...settings, aboutImageUrl: e.target.value})} />
                            <label className="cursor-pointer w-12 h-12 bg-brand-navy/5 border border-black/5 rounded-2xl flex items-center justify-center text-brand-navy">
                                <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, aboutImageUrl: url })))} />
                                <Upload size={18} />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">وصف "حول المدرسة"</label>
                    <textarea className="input-field p-4 w-full bg-brand-paper border border-black/5 rounded-2xl focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-32" value={settings.aboutDescription} onChange={e => setSettings({...settings, aboutDescription: e.target.value})} />
                </div>

                <button type="submit" className="w-full py-4 bg-brand-gold text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-gold/30 hover:brightness-110 active:scale-95 transition-all">
                    حفظ كافة التغييرات
                </button>
            </form>
        ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="card-luxury p-6 md:p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                        <Facebook className="text-brand-navy" size={24} />
                        <h2 className="text-xl font-display font-black italic">كيفية النقل من فيسبوك؟</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold text-sm shrink-0">1</div>
                            <p className="text-sm leading-relaxed">افتح الصورة أو الفيديو على فيسبوك، ثم اضغط على زر الخيارات (النقاط الثلاث) واختر <b>"نسخ الرابط"</b>.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold text-sm shrink-0">2</div>
                            <p className="text-sm leading-relaxed">إذا كان الرابط لا يظهر كصورة مباشرة، يفضل رفع الصورة على موقع مثل postimages.org ونسخ <b>الرابط المباشر (Direct Link)</b>.</p>
                        </div>
                        <div className="p-4 bg-brand-navy/5 rounded-2xl border border-black/5">
                            <p className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-2"><HelpCircle size={14} /> ملاحظة هامة لجودة الصور:</p>
                            <p className="text-[10px] text-brand-navy/60 leading-relaxed italic">روابط فيسبوك قد تنتهي صلاحيتها بعد فترة. يفضل دائماً رفع الصور الأصلية من هاتفك مباشرة لضمان بقائها للأبد على الموقع.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card-luxury p-6 bg-brand-navy border-none text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/10 blur-3xl rounded-full" />
                        <Trophy className="text-brand-gold mb-4" size={24} />
                        <h3 className="font-display font-black italic mb-2">إحصائيات الإنجاز</h3>
                        <p className="text-xs text-white/60 leading-relaxed mb-4">لقد قمت بنشر {projects.length} عملاً فنياً وعلمياً حتى الآن. استمر في التميز!</p>
                        <button onClick={() => setActiveTab('works')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-gold">
                            إضافة المزيد <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="card-luxury p-6 border-brand-gold/20 flex flex-col justify-center">
                        <ImageIcon className="text-brand-gold mb-4" size={24} />
                        <h3 className="font-display font-black italic text-brand-navy mb-2">أفضل الممارسات</h3>
                        <p className="text-xs text-brand-navy/50 leading-relaxed">استخدم صوراً بدقة عالية (HD) وحاول أن تبقي الوصف مختصراً ومحيطاً بتفاصيل الإبداع.</p>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
