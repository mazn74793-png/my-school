import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth, storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";

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
  
  if (errorMessage.includes('transport errored') || errorMessage.includes('WebChannelConnection')) {
    console.warn(`[Admin Status] Path ${path}: Transient network reconnection.`);
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
import { uploadToCloudinary } from "../lib/cloudinary";
import { Project, ProjectType, SiteSettings, EducationLevel, Announcement } from "../types";
import { Plus, Trash2, Video, Image as ImageIcon, Book, LogOut, Loader2, Save, Globe, Eye, Trophy, Facebook, HelpCircle, ArrowRight, Upload, CheckCircle2, ShieldCheck, Cloud, Smartphone, Edit2, Bell } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const DEFAULT_ABOUT_IMAGE = "https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=800";

export const AdminDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"works" | "announcements" | "settings" | "help">("works");
  
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
    // Increased limit to 500MB for luxury experience, with a warning for mobile users
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        toast.error("الملف ضخم جداً (أكثر من 500 ميجابايت). يرجى ضغطه أولاً.");
        throw new Error("File too large");
    }

    // Try to keep the screen awake for large uploads
    let wakeLock: any = null;
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await (navigator as any).wakeLock.request('screen');
        }
    } catch (e) {}

    if (file.size > 50 * 1024 * 1024) {
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <Cloud className="h-10 w-10 text-brand-gold" />
                        </div>
                        <div className="mr-3 flex-1 text-right">
                            <p className="text-sm font-black text-brand-navy">تنبيه: حجم الملف كبير</p>
                            <p className="mt-1 text-xs text-brand-navy/60 font-bold italic">
                                أنت ترفع ملفاً بحجم {(file.size / (1024 * 1024)).toFixed(1)}MB. تأكد من استقرار الإنترنت لديك.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex border-l border-gray-200">
                    <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-brand-navy hover:text-brand-gold focus:outline-none">
                        حسناً
                    </button>
                </div>
            </div>
        ), { duration: 6000 });
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
        const url = await uploadToCloudinary(file, (progress) => {
            setUploadProgress(Math.round(progress));
        });
        callback(url);
        toast.success("تم الرفع بنجاح سحابياً!");
        setIsUploading(false);
        setUploadProgress(0);
        if (wakeLock) await wakeLock.release();
        return url;
    } catch (error: any) {
        if (wakeLock) await wakeLock.release();
        console.error("Upload Failure Details:", error);
        
        let errorMsg = error.message || "خطأ مجهول أثناء الرفع";
        
        // Add helpful hints for mobile users
        if (errorMsg.toLowerCase().includes("network") || errorMsg.toLowerCase().includes("timeout") || errorMsg.toLowerCase().includes("request failed")) {
            errorMsg = "حدث انقطاع في الشبكة (Network Interruption). يرجى التأكد من استقرار الإنترنت وعدم غلق المتصفح أو تطبيق الرفع.";
        }
        
        toast.error(`فشل الرفع: ${errorMsg}`, { duration: 10000 });
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

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    imageUrl: "",
    type: "info" as "info" | "urgent" | "event"
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
    directorVideoUrl: "",
    directorPhotoUrl: "",
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
                    registeredAt: serverTimestamp(),
                    lastActive: serverTimestamp()
                }, { merge: true });
                setIsAdminConfirmed(true);
            } else {
                const adminSnap = await getDoc(doc(db, "admins", auth.currentUser.uid));
                if (adminSnap.exists()) {
                    setIsAdminConfirmed(true);
                    await setDoc(doc(db, "admins", auth.currentUser.uid), {
                        lastActive: serverTimestamp()
                    }, { merge: true });
                }
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "projects");
    });

    // Fetch Announcements
    const aq = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsubscribeAnnouncements = onSnapshot(aq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "announcements");
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
                const data = docSnap.data();
                setSettings(prev => ({
                    ...prev,
                    ...data,
                    // Ensure strings for all controlled inputs to avoid uncontrolled warning
                    schoolName: data.schoolName || prev.schoolName,
                    logoUrl: data.logoUrl || prev.logoUrl,
                    heroTitle: data.heroTitle || prev.heroTitle,
                    heroSubtitle: data.heroSubtitle || prev.heroSubtitle,
                    heroDescription: data.heroDescription || prev.heroDescription,
                    aboutTitle: data.aboutTitle || prev.aboutTitle,
                    aboutDescription: data.aboutDescription || prev.aboutDescription,
                    directorName: data.directorName || prev.directorName,
                    directorVideoUrl: data.directorVideoUrl || prev.directorVideoUrl || "",
                    directorPhotoUrl: data.directorPhotoUrl || prev.directorPhotoUrl || "",
                    aboutImageUrl: data.aboutImageUrl || prev.aboutImageUrl,
                } as SiteSettings));
            }
            setLoading(false);
        } catch (e) {
            setLoading(false);
        }
    };

    fetchSettings();
    return () => {
        unsubscribeWorks();
        unsubscribeAnnouncements();
    };
  }, []);

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const loadingId = toast.loading(isEditingAnnouncement ? "جاري تحديث الإعلان..." : "جاري نشر الإعلان...");
    const path = isEditingAnnouncement ? `announcements/${editingAnnouncementId}` : "announcements";
    try {
      if (isEditingAnnouncement && editingAnnouncementId) {
        await setDoc(doc(db, "announcements", editingAnnouncementId), {
          ...newAnnouncement,
          updatedAt: serverTimestamp()
        }, { merge: true });
        toast.success("تم تحديث الإعلان بنجاح!", { id: loadingId });
      } else {
        await addDoc(collection(db, "announcements"), {
          ...newAnnouncement,
          createdAt: serverTimestamp()
        });
        toast.success("تم نشر الإعلان بنجاح!", { id: loadingId });
      }
      setNewAnnouncement({ title: "", content: "", imageUrl: "", type: "info" });
      setIsAddingAnnouncement(false);
      setIsEditingAnnouncement(false);
      setEditingAnnouncementId(null);
    } catch (error: any) {
      handleFirestoreError(error, isEditingAnnouncement ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleEditAnnouncement = (ann: Announcement) => {
    setNewAnnouncement({
      title: ann.title,
      content: ann.content,
      imageUrl: ann.imageUrl || "",
      type: ann.type
    });
    setEditingAnnouncementId(ann.id || null);
    setIsEditingAnnouncement(true);
    setIsAddingAnnouncement(true);
    // Smooth scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الإعلان؟")) {
      const loadingId = toast.loading("جاري الحذف...");
      const path = `announcements/${id}`;
      try {
        await deleteDoc(doc(db, "announcements", id));
        toast.success("تم حذف الإعلان", { id: loadingId });
      } catch (error: any) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const loadingId = toast.loading("جاري النشر...");
    const path = "projects";
    try {
      await addDoc(collection(db, path), {
        ...newProject,
        authorId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewProject({ title: "", description: "", type: "project", level: "secondary", mediaUrl: "", techStack: "" });
      setIsAdding(false);
      toast.success("تم الإضافة بنجاح!", { id: loadingId });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleEdit = (project: Project) => {
    setNewProject({
      title: project.title,
      description: project.description,
      type: project.type,
      level: project.level,
      mediaUrl: project.mediaUrl,
      techStack: project.techStack || ""
    });
    setEditingId(project.id || null);
    setIsEditing(true);
    // Smooth scroll to top to see the form
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !editingId) return;

    const loadingId = toast.loading("جاري تحديث العمل...");
    const path = `projects/${editingId}`;
    try {
      await setDoc(doc(db, "projects", editingId), {
        ...newProject,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setNewProject({ title: "", description: "", type: "project", level: "secondary", mediaUrl: "", techStack: "" });
      setIsEditing(false);
      setEditingId(null);
      toast.success("تم التحديث بنجاح!", { id: loadingId });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      const loadingId = toast.loading("جاري الحفظ...");
      const path = "settings/global";
      try {
          await setDoc(doc(db, "settings", "global"), settings);
          toast.success("تم حفظ الإعدادات!", { id: loadingId });
      } catch (error: any) {
          handleFirestoreError(error, OperationType.UPDATE, path);
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من الحذف؟")) {
      const loadingId = toast.loading("جاري الحذف...");
      const path = `projects/${id}`;
      try {
        await deleteDoc(doc(db, "projects", id));
        toast.success("تم الحذف بنجاح", { id: loadingId });
      } catch (error: any) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-brand-paper"><Loader2 className="animate-spin text-brand-gold" /></div>;

  return (
    <div className="min-h-screen bg-brand-paper px-4 md:px-8 pt-24 pb-20 text-brand-navy">
      <Toaster position="bottom-right" />
      
      <div className="max-w-5xl mx-auto px-1 md:px-0">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex bg-white p-1.5 rounded-[2rem] border border-black/10 shadow-sm w-full md:w-auto overflow-x-auto scrollbar-hide no-scrollbar">
                        {[
                            { id: "works", label: "الأعمال", icon: Book },
                            { id: "announcements", label: "الإعلانات", icon: Bell },
                            { id: "settings", label: "الإعدادات", icon: Globe },
                            { id: "help", label: "الدليل الرسمي", icon: HelpCircle }
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 md:px-8 py-3 rounded-2xl font-black transition-all text-sm whitespace-nowrap ${activeTab === tab.id ? 'bg-brand-navy text-white shadow-[0_10px_30px_rgba(30,41,59,0.3)] scale-105 z-10' : 'text-brand-navy/60 hover:bg-black/5'}`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                        <div className="hidden lg:flex items-center px-6 border-l border-black/5">
                            <div className={`w-2.5 h-2.5 rounded-full mr-3 ${healthStatus === 'متصل' ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                            <span className="text-[10px] font-mono font-black text-brand-navy/40 uppercase tracking-widest">Core: {healthStatus === 'متصل' ? 'Live' : 'Syncing'}</span>
                        </div>
                    </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => auth.signOut()}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black transition-all hover:bg-red-600 hover:text-white w-full md:w-auto shadow-sm"
          >
            <LogOut size={18} /> تسجيل الخروج
          </motion.button>
        </div>

        {activeTab === "works" ? (
            <>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                >
                    <button onClick={() => { setNewProject({ ...newProject, type: 'image' }); setIsAdding(true); }} className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-xl hover:border-brand-gold transition-all text-center group relative overflow-hidden active:scale-95">
                        <motion.div whileHover={{ scale: 1.1 }} className="w-10 h-10 md:w-12 md:h-12 bg-brand-navy/5 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <ImageIcon size={20} className="md:w-6 md:h-6" />
                        </motion.div>
                        <p className="font-black text-[10px] md:text-sm uppercase italic tracking-tighter">New Image</p>
                        <p className="text-[8px] md:text-[10px] text-brand-navy/40 font-bold">إضافة صورة</p>
                    </button>
                    <button onClick={() => { setNewProject({ ...newProject, type: 'video' }); setIsAdding(true); }} className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-xl hover:border-brand-gold transition-all text-center group relative overflow-hidden active:scale-95">
                        <motion.div whileHover={{ scale: 1.1 }} className="w-10 h-10 md:w-12 md:h-12 bg-brand-navy/5 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <Video size={20} className="md:w-6 md:h-6" />
                        </motion.div>
                        <p className="font-black text-[10px] md:text-sm uppercase italic tracking-tighter">New Video</p>
                        <p className="text-[8px] md:text-[10px] text-brand-navy/40 font-bold">إضافة فيديو</p>
                    </button>
                    <button onClick={() => { setNewProject({ ...newProject, type: 'project' }); setIsAdding(true); }} className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-xl hover:border-brand-gold transition-all text-center group relative overflow-hidden active:scale-95">
                        <motion.div whileHover={{ scale: 1.1 }} className="w-10 h-10 md:w-12 md:h-12 bg-brand-navy/5 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <Book size={20} className="md:w-6 md:h-6" />
                        </motion.div>
                        <p className="font-black text-[10px] md:text-sm uppercase italic tracking-tighter">New Entry</p>
                        <p className="text-[8px] md:text-[10px] text-brand-navy/40 font-bold">إضافة مشروع</p>
                    </button>
                    <div className="bg-brand-navy p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-2xl text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/10 blur-2xl rounded-full" />
                        <p className="text-brand-gold font-black text-2xl md:text-4xl italic mb-1 relative z-10">{projects.length}</p>
                        <p className="font-black text-[8px] md:text-[10px] text-white uppercase tracking-[0.1em] md:tracking-[0.2em] relative z-10">Total Assets</p>
                    </div>
                </motion.div>

                {(isAdding || isEditing) && (
                <motion.form 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onSubmit={isEditing ? handleUpdate : handleAdd} 
                    className={`card-luxury p-6 md:p-10 mb-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 ring-2 ${isEditing ? 'ring-brand-gold' : 'ring-brand-navy/10'} ring-offset-4 ring-offset-brand-paper`}
                >
                    <div className="flex items-center justify-between border-b border-black/5 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-gold text-white rounded-xl flex items-center justify-center shadow-lg">
                                {isEditing ? <Edit2 size={20} /> : <Plus size={20} />}
                            </div>
                            <div>
                                <h2 className="text-lg font-display font-black italic">{isEditing ? 'تعديل العمل الحالي' : 'نشر عمل جديد'}</h2>
                                <p className="text-[10px] text-brand-navy/40">{isEditing ? 'تعديل البيانات المنشورة بالفعل' : 'سيتم الظهور في المعرض المباشر'}</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => { setIsAdding(false); setIsEditing(false); setEditingId(null); }} className="text-xs text-brand-navy/40 hover:text-brand-navy font-bold underline">إلغاء</button>
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
                                        className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none font-mono text-xs text-right shadow-inner"
                                        value={newProject.mediaUrl}
                                        onChange={e => setNewProject({...newProject, mediaUrl: e.target.value})}
                                    />
                                    <label className="cursor-pointer bg-brand-navy text-white w-14 h-14 md:w-auto md:px-6 rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all shadow-lg active:scale-95 disabled:opacity-50">
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
                                        {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
                                    </label>
                                </div>
                                <p className="text-[10px] text-brand-gold font-black italic mt-2 flex items-center justify-end gap-1">
                                    <ShieldCheck size={12} />
                                    نظام الحماية والأرشفة الفائق Cloudinary (Limit: 500MB)
                                </p>
                                {isUploading && (
                                    <div className="mt-4 space-y-2">
                                        <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden shadow-inner">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${uploadProgress}%` }} 
                                                className="h-full bg-gradient-to-r from-brand-gold to-brand-navy transition-all duration-300" 
                                            />
                                        </div>
                                        <p className="text-[10px] font-black text-brand-navy/60 text-left italic uppercase tracking-widest">
                                            Uploading: {uploadProgress}% Completed
                                        </p>
                                    </div>
                                )}
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
                        {isEditing ? 'تحديث البيانات ونشرها' : 'حفظ ونشر العمل'}
                    </button>
                </motion.form>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-mono font-bold text-brand-navy/30 uppercase tracking-[0.2em]">Archived Entries</span>
                        <h2 className="text-xl font-display font-black italic">الأعمال الحالية</h2>
                    </div>
                    
                    <div className="bg-white border-t border-x border-black/10 rounded-t-[2.5rem] overflow-hidden shadow-sm">
                        <div className="hidden md:grid grid-cols-[1fr,150px,100px,60px] bg-brand-navy p-5 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">
                            <div className="pr-10 text-brand-gold">Entry Content</div>
                            <div>Structure</div>
                            <div>Format</div>
                            <div className="text-center">Manage</div>
                        </div>
                        {projects.length === 0 ? (
                            <div className="p-16 text-center text-brand-navy/20 italic text-sm border-b border-black/10 bg-brand-paper/30">لا توجد أعمال منشورة حالياً في الأرشيف</div>
                        ) : (
                            <div className="divide-y divide-black/5 bg-white">
                                {projects.map(p => (
                                    <div key={p.id} className="flex flex-col md:grid md:grid-cols-[1fr,150px,100px,60px] md:items-center p-6 md:p-5 hover:bg-brand-gold/5 transition-all group relative">
                                        <div className="flex items-center gap-5 min-w-0 pr-2 mb-6 md:mb-0">
                                            <div className="w-14 h-14 md:w-10 md:h-10 bg-brand-navy/5 rounded-[1.25rem] md:rounded-xl flex items-center justify-center text-brand-navy shrink-0 group-hover:bg-brand-navy group-hover:text-white transition-all shadow-inner">
                                                {p.type === 'video' ? <Video size={20} /> : p.type === 'image' ? <ImageIcon size={20} /> : <Book size={20} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-base md:text-sm truncate leading-tight mb-1">{p.title}</h3>
                                                <p className="md:hidden text-[10px] text-brand-navy/40 font-bold uppercase tracking-widest">{p.type} • {p.level}</p>
                                            </div>
                                        </div>
                                <div className="hidden md:block text-[10px] font-black text-brand-navy/40 text-right px-2 italic uppercase tracking-widest">
                                            {p.level === 'secondary' ? 'Secondary' : p.level === 'preparatory' ? 'Preparatory' : p.level === 'primary' ? 'Primary' : 'General'}
                                        </div>
                                        <div className="hidden md:block text-[10px] font-black text-brand-gold uppercase px-2 tracking-widest">
                                            {p.type}
                                        </div>
                                        <div className="flex md:block justify-end pt-4 md:pt-0 border-t md:border-none border-black/5 gap-2">
                                            <button 
                                                onClick={() => handleEdit(p)} 
                                                className="w-full md:w-10 md:h-10 py-4 md:py-0 bg-brand-gold/10 md:bg-transparent text-brand-gold hover:text-white hover:bg-brand-gold rounded-[1.25rem] md:rounded-xl transition-all flex items-center justify-center gap-3 md:gap-0 shadow-sm md:shadow-none font-black md:font-normal mb-2 md:mb-0"
                                                title="تعديل هذا العمل"
                                            >
                                                <Edit2 size={20} className="md:w-5" />
                                                <span className="md:hidden">تعديل البيانات</span>
                                            </button>
                                            <button 
                                                onClick={() => p.id && handleDelete(p.id)} 
                                                className="w-full md:w-10 md:h-10 py-4 md:py-0 bg-red-50 md:bg-transparent text-red-500 hover:text-white hover:bg-red-600 rounded-[1.25rem] md:rounded-xl transition-all flex items-center justify-center gap-3 md:gap-0 shadow-sm md:shadow-none font-black md:font-normal"
                                                title="إزالة هذا العمل نهائياً"
                                            >
                                                <Trash2 size={20} className="md:w-5" />
                                                <span className="md:hidden">إلغاء هذا النشر</span>
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
        ) : activeTab === "announcements" ? (
             <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-navy text-white rounded-2xl flex items-center justify-center shadow-lg">
                            <Bell size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-black italic">نظام الإعلانات والقرارات</h2>
                            <p className="text-xs text-brand-navy/40 font-bold">Announcements & School Decrees</p>
                        </div>
                    </div>
                    {!isAddingAnnouncement && (
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsAddingAnnouncement(true)}
                            className="bg-brand-navy text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-brand-gold transition-all"
                        >
                            إضافة إعلان جديد
                        </motion.button>
                    )}
                </div>

                {isAddingAnnouncement && (
                    <motion.form 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onSubmit={handleAddAnnouncement}
                        className={`card-luxury p-8 space-y-6 ring-2 ${isEditingAnnouncement ? 'ring-brand-gold' : 'ring-brand-navy/10'} ring-offset-4 ring-offset-brand-paper`}
                    >
                         <div className="flex justify-between items-center border-b border-black/5 pb-6">
                            <h3 className="font-display font-black italic text-brand-navy text-xl">
                                {isEditingAnnouncement ? 'تعديل القرار أو الإعلان' : 'نشر قرار أو إعلان'}
                            </h3>
                            <button type="button" onClick={() => { setIsAddingAnnouncement(false); setIsEditingAnnouncement(false); setEditingAnnouncementId(null); }} className="text-brand-navy/40 underline font-black text-xs">إلغاء</button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">عنوان الإعلان</label>
                                 <input 
                                    className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold"
                                    value={newAnnouncement.title}
                                    onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                                    placeholder="مثلاً: تنويه بخصوص إجازة..."
                                    required
                                 />
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">نوع الإعلان</label>
                                 <select 
                                    className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold"
                                    value={newAnnouncement.type}
                                    onChange={e => setNewAnnouncement({...newAnnouncement, type: e.target.value as any})}
                                 >
                                     <option value="info">إعلام عام</option>
                                     <option value="urgent">عاجل / هام</option>
                                     <option value="event">فعالية قادمة</option>
                                 </select>
                             </div>
                         </div>
                         <div className="space-y-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">صورة الإعلان (اختياري)</label>
                                 <div className="flex gap-3">
                                     <div className="w-16 h-16 md:w-20 md:h-20 bg-white border border-black/5 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                         {newAnnouncement.imageUrl ? (
                                             <img src={newAnnouncement.imageUrl} className="w-full h-full object-cover" />
                                         ) : (
                                             <ImageIcon className="text-black/10" size={24} />
                                         )}
                                     </div>
                                     <div className="flex-1 space-y-2">
                                         <div className="flex gap-2">
                                             <input 
                                                className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none font-mono text-[10px] shadow-inner"
                                                value={newAnnouncement.imageUrl || ""}
                                                onChange={e => setNewAnnouncement({...newAnnouncement, imageUrl: e.target.value})}
                                                placeholder="رابط الصورة أو ارفع واحدة..."
                                             />
                                             <label className="cursor-pointer w-14 h-14 bg-brand-navy text-white rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all shadow-lg active:scale-95 shrink-0">
                                                 <input 
                                                     type="file" 
                                                     accept="image/*" 
                                                     className="hidden" 
                                                     onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setNewAnnouncement(prev => ({ ...prev, imageUrl: url })))} 
                                                 />
                                                 <Upload size={20} />
                                             </label>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">نص الإعلان</label>
                                 <textarea 
                                    className="w-full bg-brand-paper border border-black/5 rounded-3xl p-6 focus:border-brand-gold outline-none text-right text-sm h-34"
                                    value={newAnnouncement.content}
                                    onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                                    placeholder="اكتب تفاصيل الإعلان هنا..."
                                    required
                                 />
                             </div>
                         </div>
                         <button type="submit" className="w-full py-4 bg-brand-navy text-white font-black rounded-2xl shadow-xl hover:bg-brand-gold transition-all">
                             {isEditingAnnouncement ? 'تحديث الإعلان الآن' : 'حفظ ونشر الإعلان الآن'}
                         </button>
                    </motion.form>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {announcements.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-[2.5rem] border border-black/5 italic text-brand-navy/20">لا توجد إعلانات منشورة</div>
                    ) : (
                        announcements.map(ann => (
                            <div key={ann.id} className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm group hover:border-brand-gold transition-all flex justify-between items-center gap-6">
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditAnnouncement(ann)} className="w-12 h-12 bg-brand-gold/10 text-brand-gold rounded-2xl flex items-center justify-center hover:bg-brand-gold hover:text-white transition-all">
                                        <Edit2 size={20} />
                                    </button>
                                    <button onClick={() => ann.id && handleDeleteAnnouncement(ann.id)} className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                                <div className="text-right flex-1 bg-brand-paper/50 p-4 rounded-[2rem] flex items-center gap-4 justify-end">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-end gap-3 mb-2">
                                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${ann.type === 'urgent' ? 'bg-red-500 text-white' : ann.type === 'event' ? 'bg-brand-gold text-white' : 'bg-brand-navy text-brand-gold'}`}>{ann.type}</span>
                                            <h3 className="font-black italic text-brand-navy">{ann.title}</h3>
                                        </div>
                                        <p className="text-xs text-brand-navy/60 italic leading-relaxed">{ann.content}</p>
                                    </div>
                                    {ann.imageUrl && (
                                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-black/5 shrink-0">
                                            <img src={ann.imageUrl} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                                <div className="w-14 h-14 bg-brand-navy/5 rounded-[1.5rem] flex items-center justify-center text-brand-navy">
                                    <Bell size={24} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
             </div>
        ) : activeTab === "settings" ? (
            <motion.form 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleSaveSettings} 
                className="card-luxury p-8 md:p-12 space-y-10 animate-in fade-in duration-500"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-gold text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-gold/20">
                            <Globe size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-display font-black italic">إعدادات الموقع</h2>
                            <p className="text-xs text-brand-navy/40 font-bold">General School Configuration</p>
                        </div>
                    </div>
                    <button id="save-settings-btn" type="submit" className="px-8 py-3 bg-brand-navy text-white font-black rounded-2xl shadow-xl hover:bg-brand-gold transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Save size={18} /> حفظ التغييرات
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold border-r-2 border-brand-gold pr-3">Identity & Branding</h3>
                        
                        <div className="space-y-2">
                            <label htmlFor="school-name-input" className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">اسم المؤسسة</label>
                            <input id="school-name-input" className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold shadow-inner" value={settings.schoolName || ""} onChange={e => setSettings({...settings, schoolName: e.target.value})} />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="logo-url-input" className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">رابط الشعار الرسمي</label>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-black/5 bg-white flex items-center justify-center p-2 shadow-inner shrink-0 overflow-hidden">
                                    {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain" /> : <ImageIcon className="text-black/10" />}
                                </div>
                                <div className="flex-1 w-full space-y-2">
                                    <div className="flex gap-3">
                                        <input id="logo-url-input" className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none font-mono text-xs shadow-inner" value={settings.logoUrl || ""} onChange={e => setSettings({...settings, logoUrl: e.target.value})} />
                                        <label className="cursor-pointer w-14 h-14 bg-brand-navy text-white rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all shadow-lg shadow-brand-navy/10"><input id="logo-upload-input" type="file" accept="image/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, logoUrl: url })))} /><Upload size={20} /></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold border-r-2 border-brand-gold pr-3">Hero Section (Main Page)</h3>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="hero-title-input" className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">العنوان الرئيسي</label>
                                <input id="hero-title-input" className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold shadow-inner" value={settings.heroTitle || ""} onChange={e => setSettings({...settings, heroTitle: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="hero-subtitle-input" className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">العنوان الفرعي (تميز)</label>
                                <input id="hero-subtitle-input" className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold shadow-inner" value={settings.heroSubtitle || ""} onChange={e => setSettings({...settings, heroSubtitle: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">وصف الهيرو الترحيبي</label>
                    <textarea className="w-full bg-brand-paper border border-black/5 rounded-3xl p-6 focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-32 shadow-inner" value={settings.heroDescription || ""} onChange={e => setSettings({...settings, heroDescription: e.target.value})} />
                </div>

                <div className="bg-brand-gold/5 rounded-[2.5rem] p-8 border border-brand-gold/10 space-y-8">
                     <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold border-r-2 border-brand-gold pr-3">About & Leadership</h3>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">عنوان الرؤية</label>
                            <input className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold shadow-inner" value={settings.aboutTitle || ""} onChange={e => setSettings({...settings, aboutTitle: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">صورة الرؤية</label>
                            <div className="space-y-3">
                                <div className="aspect-video w-full rounded-2xl border border-black/5 bg-white overflow-hidden flex items-center justify-center shadow-inner group relative">
                                    {settings.aboutImageUrl ? (
                                        <img src={settings.aboutImageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                                    ) : (
                                        <div className="text-center">
                                            <ImageIcon size={32} className="mx-auto mb-2 text-black/10" />
                                            <p className="text-[10px] font-bold text-black/20 italic">لا توجد صورة حالياً</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <input className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none font-mono text-xs shadow-inner" value={settings.aboutImageUrl || ""} onChange={e => setSettings({...settings, aboutImageUrl: e.target.value})} />
                                    <label className="cursor-pointer w-14 h-14 bg-brand-navy text-white rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all shadow-lg shadow-brand-navy/10"><input type="file" accept="image/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, aboutImageUrl: url })))} /><Upload size={20} /></label>
                                </div>
                            </div>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">نص الرؤية والرسالة</label>
                            <textarea className="w-full bg-brand-paper border border-black/5 rounded-3xl p-6 focus:border-brand-gold outline-none text-right text-sm leading-relaxed h-32 shadow-inner" value={settings.aboutDescription || ""} onChange={e => setSettings({...settings, aboutDescription: e.target.value})} />
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-brand-gold/10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">اسم المدير الموقر</label>
                            <input className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none text-right font-bold shadow-inner" value={settings.directorName || ""} onChange={e => setSettings({...settings, directorName: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">فيديو الكلمة الافتتاحية</label>
                            <div className="space-y-3">
                                <div className="aspect-video w-full rounded-2xl border border-black/5 bg-white overflow-hidden flex items-center justify-center shadow-inner bg-brand-navy/5">
                                    {settings.directorVideoUrl ? (
                                        (settings.directorVideoUrl.includes('drive.google.com') || settings.directorVideoUrl.includes('youtube.com') || settings.directorVideoUrl.includes('youtu.be')) ? (
                                            <iframe src={formatPreviewUrl(settings.directorVideoUrl)} className="w-full h-full border-none" allowFullScreen />
                                        ) : (
                                            <video src={settings.directorVideoUrl} className="w-full h-full object-cover" controls muted />
                                        )
                                    ) : (
                                        <div className="text-center">
                                            <Video size={32} className="mx-auto mb-2 text-black/10" />
                                            <p className="text-[10px] font-bold text-black/20 italic">لا يوجد فيديو حالياً</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <input className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none font-mono text-[10px] shadow-inner" value={settings.directorVideoUrl || ""} onChange={e => setSettings({...settings, directorVideoUrl: e.target.value})} />
                                    <label className="cursor-pointer w-14 h-14 bg-brand-navy text-white rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all shadow-lg shadow-brand-navy/10"><input type="file" accept="video/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, directorVideoUrl: url })))} /><Upload size={20} /></label>
                                </div>
                            </div>
                        </div>
                    <div className="space-y-2">
                        <label htmlFor="director-photo-input" className="text-[10px] font-black uppercase tracking-widest text-brand-navy/30 pr-2">صورة القائد (Main View)</label>
                        <div className="space-y-3 text-center">
                            <div className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full border-4 border-white bg-white overflow-hidden shadow-xl flex items-center justify-center">
                                {settings.directorPhotoUrl ? (
                                    <img src={settings.directorPhotoUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-black/5">
                                        <ImageIcon size={32} className="text-black/10" />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <input id="director-photo-input" className="flex-1 bg-brand-paper border border-black/5 rounded-2xl py-4 px-6 focus:border-brand-gold outline-none font-mono text-xs shadow-inner" value={settings.directorPhotoUrl || ""} onChange={e => setSettings({...settings, directorPhotoUrl: e.target.value})} />
                                <label className="cursor-pointer w-14 h-14 bg-brand-navy text-white rounded-2xl flex items-center justify-center hover:bg-brand-gold transition-all shadow-lg shadow-brand-navy/10"><input id="director-photo-upload" type="file" accept="image/*" className="hidden" onChange={async e => e.target.files?.[0] && await handleFileUpload(e.target.files[0], (url) => setSettings(s => ({ ...s, directorPhotoUrl: url })))} /><Upload size={20} /></label>
                            </div>
                        </div>
                    </div>
                     </div>
                </div>
            </motion.form>
        ) : (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
                <div className="card-luxury p-10 bg-brand-navy border-none text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/10 blur-[120px] rounded-full group-hover:bg-brand-gold/20 transition-all duration-1000" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 blur-3xl rounded-full" />
                    
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                            <div className="flex items-center gap-4">
                                <motion.div 
                                    whileHover={{ rotate: 15 }}
                                    className="w-14 h-14 bg-brand-gold text-brand-navy rounded-[1.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(197,160,89,0.3)]"
                                >
                                    <HelpCircle size={32} />
                                </motion.div>
                                <div>
                                    <h2 className="text-4xl font-display font-black italic">دليل النظام المتطور</h2>
                                    <p className="text-[10px] uppercase font-mono tracking-[0.4em] text-brand-gold font-bold">Sadat Secondary Advanced Infrastructure</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-right">
                                    <p className="text-[8px] text-white/40 uppercase font-bold">Status</p>
                                    <p className="text-[10px] text-green-400 font-bold flex items-center gap-2">Operational <ShieldCheck size={10} /></p>
                                </div>
                                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-right">
                                    <p className="text-[8px] text-white/40 uppercase font-bold">Version</p>
                                    <p className="text-[10px] text-brand-gold font-bold">v3.4.1 Platinum</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-right">
                             <div className="space-y-6">
                                <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all duration-500 hover:border-brand-gold/30">
                                    <h3 className="text-brand-gold font-black mb-4 flex items-center justify-end gap-3 text-lg italic">
                                        محرك الوسائط (Infinite Storage) <Cloud size={20} />
                                    </h3>
                                    <div className="space-y-4 text-xs text-white/60 leading-relaxed italic">
                                        <p>تم دمج خوارزميات Cloudinary لتحسين تجربة المستخدم:</p>
                                        <ul className="space-y-2">
                                            <li className="flex items-center justify-end gap-2 text-white/80">تنسيق تلقائي للصور (WebP/AVIF) <CheckCircle2 size={12} className="text-green-500" /></li>
                                            <li className="flex items-center justify-end gap-2 text-white/80">ضغط الفيديو الذكي دون فقدان الجودة <CheckCircle2 size={12} className="text-green-500" /></li>
                                            <li className="flex items-center justify-end gap-2 text-white/80">توليد تلقائي لصور المعاينة المصغرة <CheckCircle2 size={12} className="text-green-500" /></li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="p-8 bg-black/20 border border-white/5 rounded-[2.5rem] text-[11px] font-mono text-white/40 space-y-2">
                                    <p className="uppercase tracking-[0.3em] mb-4 border-b border-white/5 pb-2 text-brand-gold/50">Core System Architecture</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><span className="text-white/20">DB:</span> NoSQL Realtime</div>
                                        <div><span className="text-white/20">SSR:</span> Edge Enabled</div>
                                        <div><span className="text-white/20">HMR:</span> Hybrid Production</div>
                                        <div><span className="text-white/20">SEC:</span> SSL/AES-256</div>
                                    </div>
                                </div>
                             </div>

                             <div className="space-y-8">
                                <div className="space-y-4">
                                    <h4 className="text-brand-gold font-black text-sm uppercase tracking-widest border-r-4 border-brand-gold pr-3">Guide: Publishing Work</h4>
                                    <div className="space-y-4">
                                        {[
                                            { t: "التخطيط", d: "اختار نوع المحتوى (صورة/فيديو/مشروع) من اللوحة الرئيسية." },
                                            { t: "الرفع السحابي", d: "استخدم زر الرفع للأصول المحلية أو ضع رابطاً خارجياً." },
                                            { t: "المعالجة", d: "انتظر شريط التحميل؛ يقوم النظام بضغط الملفات تلقائياً." },
                                            { t: "الأرشفة", d: "اكتب الوصف المناسب ثم اضغط حفظ ليظهر فورياً للعامة." }
                                        ].map((step, i) => (
                                            <div key={i} className="flex gap-4 justify-end items-start group/step">
                                                <div className="text-right">
                                                    <h5 className="text-white font-bold text-xs group-hover/step:text-brand-gold transition-colors">{step.t}</h5>
                                                    <p className="text-[10px] text-white/40 italic">{step.d}</p>
                                                </div>
                                                <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-brand-gold flex items-center justify-center font-bold text-xs shrink-0 group-hover/step:bg-brand-gold group-hover/step:text-brand-navy transition-all">{i+1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-8 bg-brand-gold/10 border border-brand-gold/20 rounded-[2.5rem]">
                                    <h4 className="text-brand-navy font-black text-xs mb-2 flex items-center justify-end gap-2 text-right">نصيحة تقنية للموبايل <Smartphone size={14} /></h4>
                                    <p className="text-[10px] text-brand-navy/60 font-black italic text-right leading-relaxed mb-4">إذا واجهت "فشل في الرفع" من الهاتف، تأكد من استقرار الإنترنت وعدم غلق الشاشة أثناء التحميل. النظام الآن يستخدم Long Polling لضمان أقصى درجات الثبات.</p>
                                    <motion.div 
                                        whileHover={{ scale: 1.02 }}
                                        className="p-4 bg-brand-gold text-brand-navy rounded-2xl shadow-lg flex items-center justify-between gap-4 cursor-help"
                                    >
                                        <HelpCircle size={16} />
                                        <p className="text-[9px] font-black italic text-center leading-tight">للدعم الفني المباشر تواصل مع إدارة البرمجة عبر الواتساب.</p>
                                    </motion.div>
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
