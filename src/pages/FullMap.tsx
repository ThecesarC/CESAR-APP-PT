import React, { useEffect, useState } from 'react';
import { TerritorialMap } from '../components/TerritorialMap';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';

export default function FullMap() {
  const [registrations, setRegistrations] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRegistrations(data);
    });
    return () => unsubscribe();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-white z-[9999] flex flex-col h-[100dvh] w-screen overflow-hidden"
    >
      <div className="flex-1 min-h-0">
        <TerritorialMap registrations={registrations} isAdminView={false} />
      </div>
    </motion.div>
  );
}
