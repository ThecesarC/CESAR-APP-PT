import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy,
  getCountFromServer,
  getDocs
} from 'firebase/firestore';

interface GlobalState {
  settings: any;
  sections: any[];
  registrations: any[];
  users: any[];
  userProfile: any;
  registrationCount: number;
  totalCasillasCount: number;
  loading: boolean;
  refreshCount: () => Promise<void>;
}

const GlobalStateContext = createContext<GlobalState | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [totalCasillasCount, setTotalCasillasCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setCurrentUid(user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  const refreshCount = async () => {
    try {
      const coll = collection(db, 'registrations');
      const snapshot = await getCountFromServer(coll);
      setRegistrationCount(snapshot.data().count);
      
      const sectionsColl = collection(db, 'sections');
      const sectionsSnap = await getDocs(sectionsColl);
      let total = 0;
      sectionsSnap.forEach(doc => {
        const data = doc.data();
        total += (data.casillas?.length || 1);
      });
      setTotalCasillasCount(total);
    } catch (e) {
      console.error("Error refreshing count:", e);
    }
  };

  useEffect(() => {
    // 1. Settings Listener (Public read in rules)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (d) => {
      if (d.exists()) {
        setSettings(d.data());
      }
    }, (error) => {
      console.error("Settings listener error:", error);
    });

    if (!isAuthenticated || !currentUid) {
      setSections([]);
      setRegistrations([]);
      setUsers([]);
      setUserProfile(null);
      setLoading(false);
      setTotalCasillasCount(0);
      return () => unsubSettings();
    }

    // 1.5 User Profile Listener
    const unsubProfile = onSnapshot(doc(db, 'users', currentUid), (snap) => {
      setUserProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    // 2. Sections Listener
    const qSections = query(collection(db, 'sections'), orderBy('order', 'asc'));
    const unsubSections = onSnapshot(qSections, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSections(docs);
      const total = docs.reduce((acc, s: any) => acc + (s.casillas?.length || 1), 0);
      setTotalCasillasCount(total);
    }, (error) => {
      console.error("Sections listener error:", error);
    });

    // 3. Registrations Listener
    const qRegs = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubRegs = onSnapshot(qRegs, (snap) => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRegistrationCount(snap.size);
      setLoading(false);
    }, (error) => {
      console.error("Registrations listener error:", error);
      setLoading(false);
    });

    // 4. Users Listener (for global stats)
    let unsubUsers = () => {};
    // Note: We check userProfile role in a separate effect or just fetch if logged in
    // Since firestore rules restrict listing to admins, we attempt it and handle error
    unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      // If permission denied, standard user is list restricted
      console.log("Users list restricted (standard user)");
    });

    return () => {
      unsubSettings();
      unsubProfile();
      unsubUsers();
      unsubSections();
      unsubRegs();
    };
  }, [isAuthenticated, currentUid]);

  return (
    <GlobalStateContext.Provider value={{ 
      settings, 
      sections, 
      registrations, 
      users,
      userProfile,
      registrationCount, 
      totalCasillasCount,
      loading,
      refreshCount
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
}
