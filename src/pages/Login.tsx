import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';

export default function Login() {
  const [loginOrder, setLoginOrder] = useState(['icon', 'title', 'description', 'button', 'footer']);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists() && d.data().loginOrder) {
        setLoginOrder(d.data().loginOrder);
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Sesión iniciada correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-10 text-center flex flex-col items-center">
        {loginOrder.map((item) => (
          <React.Fragment key={item}>
            {item === 'icon' && (
              <div className="inline-flex p-4 bg-indigo-50 rounded-2xl mb-6">
                <ShieldCheck className="w-10 h-10 text-indigo-600" />
              </div>
            )}
            
            {item === 'title' && (
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Bienvenido</h1>
            )}

            {item === 'description' && (
              <p className="text-neutral-500 mb-10">Inicia sesión para acceder al panel del Gestor Territorial HERV.</p>
            )}
            
            {item === 'button' && (
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-semibold py-4 px-6 rounded-2xl transition-all shadow-sm active:scale-[0.98]"
              >
                <LogIn className="w-5 h-5" />
                Continuar con Google
              </button>
            )}
            
            {item === 'footer' && (
              <div className="mt-10 pt-8 border-t border-neutral-100 w-full">
                <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">BY HCESAR</p>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
