import React, { useState } from "react";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { X, Lock, Mail, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("تم تسجيل الدخول بنجاح");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error("خطأ في تسجيل الدخول. تأكد من البريد وكلمة السر.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-navy/90 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-brand-paper w-full max-w-md p-8 rounded-[40px] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-all text-brand-navy/20 hover:text-brand-navy"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-gold/10 text-brand-gold rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-display font-black italic text-brand-navy">دخول لوحة التحكم</h2>
              <p className="text-xs text-brand-navy/40 mt-1 uppercase tracking-widest">Admin Authentication</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-right">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 pr-2">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/20" size={18} />
                  <input
                    type="email"
                    required
                    className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 pl-12 pr-4 focus:border-brand-gold outline-none"
                    placeholder="admin@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-navy/40 pr-2">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/20" size={18} />
                  <input
                    type="password"
                    required
                    className="w-full bg-brand-paper border border-black/5 rounded-2xl py-4 pl-12 pr-4 focus:border-brand-gold outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-brand-navy text-white rounded-2xl font-bold shadow-lg shadow-brand-navy/20 hover:bg-brand-gold hover:shadow-brand-gold/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "تسجيل الدخول"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
