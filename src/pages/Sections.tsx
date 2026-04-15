import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, isQuotaError } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Search, ChevronRight, LayoutGrid, CheckCircle2, XCircle } from 'lucide-react';
import { FALLBACK_SECTIONS } from '../constants/sections';

export default function Sections() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sections, setSections] = useState<any[]>(FALLBACK_SECTIONS);
  const [assignedSectionIds, setAssignedSectionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Listen to sections
    const qSections = query(collection(db, 'sections'), orderBy('order', 'asc'));
    const unsubSections = onSnapshot(qSections, (snap) => {
      if (!snap.empty) {
        setSections(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, (error) => {
      if (!isQuotaError(error)) {
        console.error("Error fetching sections:", error);
      }
    });

    // Listen to registrations to know which sections are assigned
    const unsubRegs = onSnapshot(collection(db, 'registrations'), (snap) => {
      const assignedIds = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.sectionId) {
          assignedIds.add(data.sectionId);
        }
      });
      setAssignedSectionIds(assignedIds);
    }, (error) => {
      if (!isQuotaError(error)) {
        console.error("Error fetching registrations for status:", error);
      }
    });

    return () => {
      unsubSections();
      unsubRegs();
    };
  }, []);

  const filteredSections = sections.filter(section => 
    String(section.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <LayoutGrid className="text-indigo-600 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Catálogo de Secciones</h2>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase">Asignada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase">Pendiente</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar sección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSections.map((section) => {
          const isAssigned = assignedSectionIds.has(section.id);
          return (
            <Link
              key={section.id}
              to={`/sections/${section.id}`}
              className={`group p-6 rounded-2xl border transition-all flex items-center justify-between bg-white ${
                isAssigned 
                  ? 'border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-50' 
                  : 'border-red-100 hover:border-red-300 hover:shadow-red-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isAssigned ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {isAssigned ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className={`font-bold transition-colors ${isAssigned ? 'text-emerald-900 group-hover:text-emerald-600' : 'text-red-900 group-hover:text-red-600'}`}>
                    {section.name}
                  </h3>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isAssigned ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isAssigned ? 'Asignada' : 'Sin Responsable'}
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 transition-all ${isAssigned ? 'text-emerald-300 group-hover:text-emerald-500' : 'text-red-200 group-hover:text-red-400'} group-hover:translate-x-1`} />
            </Link>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg">No se encontraron secciones que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
}
