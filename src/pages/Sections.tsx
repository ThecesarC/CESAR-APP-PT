import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../contexts/GlobalStateContext';
import { Search, ChevronRight, LayoutGrid, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Sections() {
  const [searchTerm, setSearchTerm] = useState('');
  const { sections, registrations, userProfile } = useGlobalState();

  // Filter sections based on user profile assignedSections
  const mySections = sections.filter(s => 
    (userProfile?.assignedSections || []).includes(s.id)
  );

  const filteredSections = mySections.filter(section => 
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <LayoutGrid className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Mis Secciones Asignadas</h2>
            <p className="text-neutral-500 text-sm">Gestiona y visualiza el avance de tus territorios.</p>
          </div>
        </div>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por número de sección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-neutral-200 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all outline-none bg-white font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSections.map((section) => {
          const sectionRegs = registrations.filter(r => r.sectionId === section.id);
          const totalCasillas = section.casillas?.length || 1;
          const registeredCasillas = sectionRegs.length;
          const progressPercent = Math.min(Math.round((registeredCasillas / totalCasillas) * 100), 100);
          
          const colorClasses = getProgressColor(progressPercent);
          const bgClass = getProgressBg(progressPercent);
          const icon = getProgressIcon(progressPercent);

          return (
            <motion.div
              layout
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link
                to={`/sections/${section.id}`}
                className="group block bg-white rounded-[2.5rem] p-6 border border-neutral-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 rounded-3xl border transition-all ${colorClasses}`}>
                    {icon}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Avance</span>
                    <span className={`text-2xl font-black ${colorClasses.split(' ')[0]}`}>{progressPercent}%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">
                      Sección {section.name}
                    </h3>
                    <p className="text-neutral-500 text-sm line-clamp-1">{section.description || 'Sin descripción detallada'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-neutral-500">
                      <span>Casillas Cubiertas</span>
                      <span className="text-neutral-900">{registeredCasillas} / {totalCasillas}</span>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${bgClass} shadow-sm`}
                      />
                    </div>
                  </div>

                  {/* Casilla Status Grid */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(section.casillas || ['Único']).map((c: string) => {
                      const isC = sectionRegs.some(r => r.casilla === c);
                      const regData = sectionRegs.find(r => r.casilla === c);
                      return (
                        <div 
                          key={c} 
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border-2 transition-all group/casilla relative ${
                            isC 
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                              : 'bg-red-50 border-red-100 text-red-500 opacity-60'
                          }`}
                        >
                          {c}
                          {isC && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-900 text-white text-[10px] rounded-xl opacity-0 group-hover/casilla:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-10">
                              <p className="font-black text-white">{regData?.personName}</p>
                              <p className="font-bold text-neutral-400">{regData?.phoneNumber}</p>
                              <div className="w-2 h-2 bg-neutral-900 absolute -bottom-1 left-1/2 -translate-x-1/2 rotate-45" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-neutral-50">
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
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                      Ver Detalles
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {mySections.length === 0 && (
        <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-neutral-200">
          <div className="bg-neutral-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutGrid className="text-neutral-300 w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 mb-2">No tienes secciones asignadas</h3>
          <p className="text-neutral-500 max-w-sm mx-auto">Contacta al administrador para que te asigne territorios y puedas comenzar con el registro.</p>
        </div>
      )}

      {mySections.length > 0 && filteredSections.length === 0 && (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg">No se encontraron secciones que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
}
