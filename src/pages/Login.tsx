import { signInWithPopup, signInWithEmailAndPassword, signOut } from '../firebase';
import { auth, googleProvider } from '../firebase';
import { LogIn, User, Lock, Mail, ChevronRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGlobalState } from '../contexts/GlobalStateContext';

export default function Login() {
  const { settings } = useGlobalState();
  // 1. Initial default order
  const defaultOrder = ['icon', 'title', 'description', 'form', 'google', 'footer'];
  const [loginOrder, setLoginOrder] = useState(defaultOrder);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // 2. Sync with settings cleanly
  useEffect(() => {
    if (!settings) return;

    let order = settings.loginOrder && Array.isArray(settings.loginOrder) 
      ? settings.loginOrder 
      : defaultOrder;

    // Migration + Cleaning
    let processed = order
      .map((item: string) => {
        if (item === 'button' || item === 'google_button') return 'google';
        return item;
      })
      .filter((item: string, index: number, self: string[]) => 
        item && typeof item === 'string' && self.indexOf(item) === index
      );
    
    // Safety: Must have core functional components
    // If they were pushed to the end by missing in settings, we re-insert them in a logical position
    if (!processed.includes('form') || !processed.includes('google')) {
      // Remove them if they were accidentally at the bottom for some reason
      processed = processed.filter(i => i !== 'form' && i !== 'google');
      
      // Find the best insertion point (after description or title)
      let insertIdx = processed.indexOf('description');
      if (insertIdx === -1) insertIdx = processed.indexOf('title');
      if (insertIdx === -1) insertIdx = processed.indexOf('icon');
      
      // Insert right after the header elements
      processed.splice(insertIdx + 1, 0, 'form', 'google');
    }

    // Final safety: Ensure footer is always last if present
    if (processed.includes('footer')) {
      processed = processed.filter(i => i !== 'footer');
      processed.push('footer');
    }

    // Only update if actually different to prevent flickering
    if (JSON.stringify(processed) !== JSON.stringify(loginOrder)) {
      setLoginOrder(processed);
    }
  }, [settings, loginOrder]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setSetupError(null);
      const result = await signInWithPopup(auth, googleProvider);
      
      // Secondary check in component - EXPLICIT ADMIN MAIL
      const ADMIN_MAIL = 'hugocesarlemuscortes@gmail.com';
      const OTHER_ADMINS = ['bunkerhrv@gmail.com'];
      
      if (result.user.email?.toLowerCase() !== ADMIN_MAIL && !OTHER_ADMINS.includes(result.user.email?.toLowerCase() || '')) {
        toast.error('Acceso denegado. Este correo no tiene permisos de Administrador.');
        await signOut(auth);
        return;
      }
      
      toast.success('Bienvenido, Hugo César');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        setSetupError('google');
        toast.error('Configuración requerida: Google Auth desactivado.');
      } else {
        toast.error('Error al iniciar sesión con Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setSetupError(null);
      // If user provided a username instead of email, we append our internal domain
      const identifier = email.includes('@') ? email : `${email}@app.local`;
      await signInWithEmailAndPassword(auth, identifier, password);
      toast.success('Sesión iniciada correctamente');
    } catch (error: any) {
      console.error("Login attempt failed:", {
        code: error.code,
        message: error.message,
        identifier: email.includes('@') ? email : `${email}@app.local`
      });

      if (error.code === 'auth/operation-not-allowed') {
        setSetupError('email');
        toast.error('Configuración requerida: Email/Password desactivado.');
      } else if (
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential'
      ) {
        toast.error('Usuario o contraseña incorrectos');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Formato de usuario inválido');
      } else {
        toast.error(`Error: ${error.message || 'Ocurrió un error al iniciar sesión'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50" />

      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-neutral-100 p-8 md:p-12 relative z-10">
        {setupError && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-3xl"
          >
            <div className="flex items-center gap-3 mb-3 text-amber-700">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-black uppercase tracking-widest text-xs">Acción Requerida en Firebase</h3>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed mb-4">
              El método de inicio de sesión {setupError === 'google' ? 'con Google' : 'con Email/Password'} no está habilitado en tu consola.
            </p>
            <div className="space-y-2">
              <a 
                href={`https://console.firebase.google.com/project/gen-lang-client-0108077873/authentication/providers`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm"
              >
                Abrir Consola de Firebase
              </a>
              <p className="text-[9px] text-amber-600 font-bold text-center italic">
                Habilita el proveedor y recarga esta página.
              </p>
            </div>
          </motion.div>
        )}

        {loginOrder.map((item) => (
          <React.Fragment key={item}>
            {item === 'icon' && (
              <div className="mb-8 w-full flex justify-center">
                <div className="p-1 bg-white rounded-2xl shadow-sm border border-neutral-100">
                  <img 
                    src={settings?.logoUrl || "https://i.postimg.cc/wB2pwRgz/LOGO-ACTUAL-HUGO.jpg"} 
                    alt="Logo" 
                    className="h-24 md:h-28 w-auto object-contain rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}
            
            {item === 'title' && (
              <div className="text-center mb-2">
                <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Panel de Acceso</h1>
              </div>
            )}

            {item === 'description' && (
              <p className="text-neutral-500 text-center mb-8 text-sm leading-relaxed">
                Ingresa tus credenciales autorizadas para acceder a la <span className="font-semibold text-neutral-800 uppercase tracking-tighter">APP ELECCIONES 2027 HERV</span>.
              </p>
            )}

            {item === 'form' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest ml-1">Acceso de Personal</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="text"
                        className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-neutral-900 placeholder:text-neutral-400"
                        placeholder="nombre_usuario"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="password"
                        className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-neutral-900 placeholder:text-neutral-400"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {loading ? 'Validando...' : (
                      <>
                        Acceso de Equipo
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
            
            {item === 'google' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mb-6"
              >
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-100"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-neutral-400 uppercase tracking-[0.2em] font-black scale-90">O Acceso Central</span>
                </div>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="mt-6 w-full flex items-center justify-center gap-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold py-4 px-6 rounded-2xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-indigo-50/0 group-hover:bg-indigo-50/10 transition-colors" />
                  <ShieldCheck className="w-5 h-5 text-indigo-600 relative z-10" />
                  <span className="relative z-10">Google Administrador</span>
                </button>
              </motion.div>
            )}
            
            {item === 'footer' && (
              <div className="mt-8 pt-8 border-t border-neutral-100 w-full text-center">
                <p className="text-xs text-neutral-400 mb-3 font-medium">¿Problemas para acceder? Contacta a soporte</p>
                <a 
                  href="https://wa.me/524434008893?text=Hola,%20tengo%20problemas%20con%20mi%20acceso..." 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-black hover:text-indigo-600 transition-colors group"
                >
                  <span className="w-6 h-[1px] bg-neutral-200 group-hover:bg-indigo-200 transition-colors" />
                  BY HERV
                  <span className="w-6 h-[1px] bg-neutral-200 group-hover:bg-indigo-200 transition-colors" />
                </a>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
