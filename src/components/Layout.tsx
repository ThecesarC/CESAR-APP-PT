import React from 'react';
import { LogOut, LayoutDashboard, List, FileText, Shield, Heart, Star, Zap, Target, Rocket, Box, Activity, Palette, Menu, X, LifeBuoy } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  isAdmin?: boolean;
}

const ICON_MAP: Record<string, any> = {
  Shield, Heart, Star, Zap, Target, Rocket, Box, Activity, LayoutGrid: List, Palette
};

export default function Layout({ children, user, isAdmin }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [appIcon, setAppIcon] = React.useState('Shield');
  const [logoUrl, setLogoUrl] = React.useState('https://i.postimg.cc/wB2pwRgz/LOGO-ACTUAL-HUGO.jpg');
  const [sidebarOrder, setSidebarOrder] = React.useState(['dashboard', 'sections', 'admin']);
  const [headerLayout, setHeaderLayout] = React.useState(['logo', 'title', 'user']);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [registrationCount, setRegistrationCount] = React.useState(0);
  const TOTAL_SECTIONS = 188;

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const unsubRegistrations = onSnapshot(collection(db, 'registrations'), (snapshot) => {
      setRegistrationCount(snapshot.size);
    }, (error) => {
      console.error("Registrations count error:", error);
    });

    return () => unsubRegistrations();
  }, []);

  const progressPercentage = Math.min((registrationCount / TOTAL_SECTIONS) * 100, 100).toFixed(2);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists()) {
        const data = d.data();
        if (data.appIcon) setAppIcon(data.appIcon);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
        if (data.sidebarOrder) setSidebarOrder(data.sidebarOrder);
        if (data.headerLayout) setHeaderLayout(data.headerLayout);
      }
    }, (error) => {
      console.error("Layout settings error:", error);
    });
    return () => unsub();
  }, []);

  const AppIcon = ICON_MAP[appIcon] || Shield;

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Wait to show the goodbye message
      await new Promise(resolve => setTimeout(resolve, 1500));
      await signOut(auth);
      // Manual fallback redirect for environments like Netlify
      window.location.href = '/login';
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Error al cerrar sesión");
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { name: 'Panel de Registro', path: '/', icon: LayoutDashboard },
    { name: 'Secciones', path: '/sections', icon: List },
  ];

  if (isAdmin) {
    navItems.push({ name: 'Administración', path: '/admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <AnimatePresence>
        {isLoggingOut && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-red-600 flex flex-col items-center justify-center text-white"
          >
            <motion.div
              animate={{ 
                rotate: [0, 20, -20, 20, 0],
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 0.6,
                ease: "easeInOut"
              }}
              className="mb-6 text-8xl"
            >
              👋🏻
            </motion.div>
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl font-bold tracking-tight"
            >
              ¡Adiós!
            </motion.h2>
            <p className="text-red-100 mt-2">Cerrando sesión de forma segura...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-white border-b border-neutral-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-neutral-500 hover:bg-neutral-50 rounded-xl md:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 md:gap-6">
            {headerLayout.map(item => (
              <React.Fragment key={item}>
                {item === 'logo' && (
                  logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className="h-7 md:h-8 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-1.5 md:p-2 rounded-lg text-white shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>
                      <AppIcon className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                  )
                )}
                {item === 'title' && (
                  <h1 className="text-lg md:text-xl font-bold text-neutral-900 tracking-tight truncate max-w-[150px] md:max-w-none">
                    SISTEMA TERRITORIAL HUGO RANGEL
                  </h1>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {headerLayout.includes('user') && (
            <div className="text-right hidden lg:block">
              <p className="text-sm font-medium text-neutral-900">{user?.displayName || user?.email}</p>
              <p className="text-xs text-neutral-500">Sesión activa</p>
            </div>
          )}
          <a 
            href={`https://wa.me/524434008893?text=${encodeURIComponent('Hola Hugo César, necesito ayuda...')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
            title="Soporte"
          >
            <LifeBuoy className="w-5 h-5" />
          </a>
          <button 
            onClick={handleLogout}
            className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-[60] md:hidden flex flex-col p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className="h-8 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-2 rounded-lg text-white shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>
                      <AppIcon className="w-5 h-5" />
                    </div>
                  )}
                  <span className="font-bold text-neutral-900">Menú</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded-xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Avance de Secciones</span>
                  <span className="text-sm font-black text-red-700">{progressPercentage}%</span>
                </div>
                <div className="w-full h-2.5 bg-red-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    className="h-full bg-red-600 rounded-full"
                  />
                </div>
                <p className="text-[10px] text-red-500 mt-2 font-medium">
                  {registrationCount} de {TOTAL_SECTIONS} responsables registrados
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {sidebarOrder.map((itemKey) => {
                  const item = navItems.find(n => {
                    if (itemKey === 'dashboard') return n.path === '/';
                    if (itemKey === 'sections') return n.path === '/sections';
                    if (itemKey === 'admin') return n.path === '/admin';
                    return false;
                  });
                  
                  if (!item) return null;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all ${
                        location.pathname === item.path
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
                <a 
                  href={`https://wa.me/524434008893?text=${encodeURIComponent('Hola Hugo César, necesito ayuda...')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-4 rounded-2xl transition-all text-neutral-600 hover:bg-neutral-50"
                >
                  <LifeBuoy className="w-5 h-5" />
                  Soporte
                </a>
              </div>

              <div className="mt-auto pt-6 border-t border-neutral-100">
                <div className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {user?.email?.[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate">{user?.displayName || user?.email}</p>
                    <p className="text-xs text-neutral-500 truncate">{isAdmin ? 'Administrador' : 'Usuario'}</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-1">
        <aside className="w-64 bg-white border-r border-neutral-200 hidden md:flex flex-col p-4 gap-2">
          <div className="mb-4 p-4 bg-red-50 rounded-2xl border border-red-100">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Avance Total</span>
              <span className="text-xs font-black text-red-600">{progressPercentage}%</span>
            </div>
            <div className="w-full h-2 bg-red-200 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                className="h-full bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.3)]"
              />
            </div>
            <p className="text-[9px] text-red-400 mt-2 font-medium text-center">
              {registrationCount} de {TOTAL_SECTIONS} secciones cubiertas
            </p>
          </div>

          {sidebarOrder.map((itemKey) => {
            const item = navItems.find(n => {
              if (itemKey === 'dashboard') return n.path === '/';
              if (itemKey === 'sections') return n.path === '/sections';
              if (itemKey === 'admin') return n.path === '/admin';
              return false;
            });
            
            if (!item) return null;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  location.pathname === item.path
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </aside>

        <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
