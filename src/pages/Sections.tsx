import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { Search, ChevronRight, LayoutGrid, AlertCircle, Clock, CheckCircle2, FileText, User as UserIcon, Filter, Users, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sections() {
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const { sections, registrations, userProfile, users } = useGlobalState();
  const isAdmin = userProfile?.role === 'admin';

  // Determine which sections to show
  let displaySections = [];
  let userTotalProgress = 0;
  let userTotalCasillas = 0;
  let userRegisteredCasillas = 0;
  let selectedUserData = null;

  if (isAdmin) {
    if (userFilter === 'all') {
      displaySections = sections;
    } else {
      selectedUserData = users.find(u => u.id === userFilter);
      const assignedIds = selectedUserData?.assignedSections || [];
      displaySections = sections.filter(s => assignedIds.includes(s.id));

      displaySections.forEach(section => {
        const sectionRegs = registrations.filter(r => r.sectionId === section.id);
        const totalCasillas = section.casillas?.length || 1;
        const uniqueRegistered = new Set(sectionRegs.map(r => r.casilla)).size;
        
        userTotalCasillas += totalCasillas;
        userRegisteredCasillas += uniqueRegistered;
      });
      
      userTotalProgress = userTotalCasillas > 0 
        ? parseFloat(((userRegisteredCasillas / userTotalCasillas) * 100).toFixed(2))
        : 0;
    }
  } else {
    displaySections = sections.filter(s => 
      (userProfile?.assignedSections || []).includes(s.id)
    );
  }

  const filteredSections = displaySections.filter(section => 
    String(section.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProgressColor = (percent: number) => {
    if (percent <= 30) return 'text-red-600 bg-red-50 border-red-100 dark:border-red-900/30';
    if (percent <= 60) return 'text-amber-600 bg-amber-50 border-amber-100 dark:border-amber-900/30';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:border-emerald-900/30';
  };

  const getProgressBg = (percent: number) => {
    if (percent <= 30) return 'bg-red-600';
    if (percent <= 60) return 'bg-amber-500';
    return 'bg-emerald-600';
  };

  const getProgressIcon = (percent: number) => {
    if (percent <= 30) return <AlertCircle className="w-5 h-5" />;
    if (percent <= 60) return <Clock className="w-5 h-5" />;
    return <CheckCircle2 className="w-5 h-5" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <LayoutGrid className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">
              {isAdmin ? 'Catálogo General de Secciones' : 'Mis Secciones Asignadas'}
            </h2>
            <p className="text-neutral-500 text-sm">
              {isAdmin 
                ? 'Monitorea el avance de todos los coordinadores y sus territorios.' 
                : 'Gestiona y visualiza el avance de tus territorios.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {isAdmin && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none bg-white font-bold text-xs uppercase tracking-widest appearance-none cursor-pointer"
              >
                <option value="all">TODOS LOS COORDINADORES</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName?.toUpperCase() || u.email?.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar sección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-200 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none bg-white font-medium shadow-sm"
            />
          </div>
        </div>
      </div>

      {isAdmin && userFilter === 'all' && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-700">{sections.length} Secciones Totales</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">
              {sections.filter(s => {
                const sRegs = registrations.filter(r => r.sectionId === s.id);
                return sRegs.length >= (s.casillas?.length || 1);
              }).length} Completas
            </span>
          </div>
        </div>
      )}

      {isAdmin && userFilter !== 'all' && selectedUserData && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-neutral-100 rounded-[2.5rem] p-8 shadow-sm overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <UserIcon className="w-32 h-32 text-indigo-600" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Resumen de Avance General</p>
              <h3 className="text-3xl font-black text-neutral-900 leading-tight">
                {selectedUserData.displayName || selectedUserData.email}
              </h3>
              <div className="flex items-center gap-4 text-neutral-500 font-bold text-xs uppercase tracking-widest">
                <span className="flex items-center gap-1">
                   <LayoutGrid className="w-4 h-4" />
                   {selectedUserData.assignedSections?.length || 0} Secciones Asignadas
                </span>
                <span className="flex items-center gap-1">
                   <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                   {userRegisteredCasillas} / {userTotalCasillas} Casillas Cubiertas
                </span>
              </div>
            </div>

            <div className="flex-1 max-w-md w-full space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest italic">Porcentaje de cumplimiento</span>
                <span className={`text-4xl font-black ${getProgressColor(userTotalProgress).split(' ')[0]}`}>
                  {userTotalProgress.toFixed(2)}%
                </span>
              </div>
              <div className="relative w-full h-4 bg-neutral-100 rounded-full overflow-hidden p-1 border border-neutral-50 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${userTotalProgress}%` }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                  className={`h-full rounded-full ${getProgressBg(userTotalProgress)} shadow-[0_0_15px_rgba(79,70,229,0.4)] relative`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredSections.map((section) => {
            const sectionRegs = registrations.filter(r => r.sectionId === section.id);
            const totalCasillas = section.casillas?.length || 1;
            
            // Use unique casilla logic for accurate percentages
            const uniqueRegistered = new Set(sectionRegs.map(r => r.casilla)).size;
            const progressPercent = Math.min(
              parseFloat(((uniqueRegistered / totalCasillas) * 100).toFixed(2)), 
              100
            );
            
            const colorClasses = getProgressColor(progressPercent);
            const bgClass = getProgressBg(progressPercent);
            const icon = getProgressIcon(progressPercent);

            // Find assigned users for this section (Admin only)
            const assignedUsers = isAdmin 
              ? users.filter(u => (u.assignedSections || []).includes(section.id))
              : [];

            return (
              <motion.div
                layout
                key={section.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  to={`/sections/${section.id}`}
                  className="group block bg-white rounded-[2.5rem] p-6 border border-neutral-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                >
                  {isAdmin && assignedUsers.length > 0 && (
                    <div className="absolute top-0 right-0 p-3">
                      <div className="flex -space-x-2">
                        {assignedUsers.slice(0, 2).map((u, i) => (
                          <div 
                            key={u.id} 
                            className="w-6 h-6 rounded-full border-2 border-white bg-indigo-500 text-[8px] font-black text-white flex items-center justify-center uppercase"
                            title={`Asignado a: ${u.displayName || u.email}`}
                          >
                            {u.displayName?.[0] || 'U'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-3xl border transition-all ${colorClasses}`}>
                      {icon}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Avance</span>
                      <span className={`text-2xl font-black ${colorClasses.split(' ')[0]}`}>{progressPercent.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                        Sección {section.name}
                        {section.files && section.files.length > 0 && (
                          <FileText className="w-4 h-4 text-indigo-400" />
                        )}
                      </h3>
                      {isAdmin && assignedUsers.length > 0 && (
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1 mb-2 flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          {assignedUsers.map(u => u.displayName || u.email).join(', ')}
                        </p>
                      )}
                      <p className="text-neutral-500 text-sm line-clamp-1">{section.description || 'Sin descripción detallada'}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        <span>Casillas Cubiertas</span>
                        <span className="text-neutral-900 font-black">{uniqueRegistered} / {totalCasillas}</span>
                      </div>
                      <div className="relative w-full h-3 bg-neutral-100 rounded-full overflow-hidden p-0.5 border border-neutral-50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${bgClass} shadow-sm group-hover:shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all`}
                        />
                      </div>
                    </div>

                    {/* Casilla Status Grid - More visible for Admin */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Estado por Casilla</p>
                      <div className="flex flex-wrap gap-2">
                        {(section.casillas || ['Único']).map((c: string, idx: number) => {
                          const regData = sectionRegs.find(r => r.casilla === c);
                          const isC = !!regData;
                          return (
                            <div 
                              key={`${section.id}-${c}-${idx}`} 
                              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border-2 transition-all group/casilla relative flex items-center gap-2 ${
                                isC 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                                  : 'bg-red-50 border-red-200 text-red-500 opacity-60'
                              }`}
                            >
                              {c}
                              {isC && (
                                <>
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-3 bg-neutral-900 border border-white/10 text-white rounded-2xl opacity-0 group-hover/casilla:opacity-100 transition-all scale-95 group-hover/casilla:scale-100 whitespace-nowrap pointer-events-none shadow-2xl z-20">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Responsable de Casilla</p>
                                    <p className="text-sm font-black text-white mb-1">{regData?.personName}</p>
                                    <div className="flex items-center gap-3">
                                      <p className="text-xs font-bold text-neutral-400 flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {regData?.phoneNumber}
                                      </p>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      <p className="text-[8px] font-black text-neutral-500 uppercase">Registrado por: {regData?.responsibleEmail}</p>
                                    </div>
                                    <div className="w-3 h-3 bg-neutral-900 border-r border-b border-white/10 absolute -bottom-1.5 left-1/2 -translate-x-1/2 rotate-45" />
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-neutral-100">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {sectionRegs.slice(0, 3).map((reg, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                              {reg.personName?.[0] || 'U'}
                            </div>
                          ))}
                          {sectionRegs.length > 3 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                              +{sectionRegs.length - 3}
                            </div>
                          )}
                        </div>
                        {sectionRegs.length > 0 && (
                          <span className="text-[10px] font-bold text-neutral-500">{sectionRegs.length} capturas</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-indigo-600 group-hover:translate-x-1 transition-transform">
                        Detalles
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-neutral-200">
          <div className="bg-neutral-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutGrid className="text-neutral-300 w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 mb-2">
            {isAdmin ? 'No hay secciones que coincidan' : 'No tienes secciones asignadas'}
          </h3>
          <p className="text-neutral-500 max-w-sm mx-auto">
            {isAdmin 
              ? 'Intenta cambiar el filtro de coordinador o el término de búsqueda.' 
              : 'Contacta al administrador para que te asigne territorios y puedas comenzar con el registro.'}
          </p>
        </div>
      )}
    </div>
  );
}
