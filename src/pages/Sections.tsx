import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Search, ChevronRight, LayoutGrid } from 'lucide-react';

export default function Sections() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'sections'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSections(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error fetching sections:", error);
    });
    return () => unsubscribe();
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
          <h2 className="text-2xl font-bold text-neutral-900">Catálogo de Secciones</h2>
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
        {filteredSections.map((section) => (
          <Link
            key={section.id}
            to={`/sections/${section.id}`}
            className="group bg-white p-6 rounded-2xl border border-neutral-200 hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between"
          >
            <div>
              <h3 className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{section.name}</h3>
              <p className="text-xs text-neutral-500 mt-1">Ver archivos disponibles</p>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-lg">No se encontraron secciones que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
}
