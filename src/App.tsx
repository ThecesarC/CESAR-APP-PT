/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Toaster } from 'sonner';
import { GlobalStateProvider } from './contexts/GlobalStateContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sections from './pages/Sections';
import SectionDetail from './pages/SectionDetail';
import Admin from './pages/Admin';
import Evidence from './pages/Evidence';
import Layout from './components/Layout';
import ThemeProvider from './components/ThemeProvider';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }

      if (firebaseUser) {
        // Restriction: Only allow specific admins for Google sign-in
        const ALLOWED_ADMINS = ['hugocesarlemuscortes@gmail.com', 'bunkerhrv@gmail.com'];
        const isGoogleProvider = firebaseUser.providerData.some(p => p.providerId === 'google.com');
        const isAdminEmail = ALLOWED_ADMINS.includes(firebaseUser.email || '');

        if (isGoogleProvider && !isAdminEmail) {
          console.error(`Access denied for ${firebaseUser.email}: Google login is restricted to admin only.`);
          signOut(auth).then(() => {
            setLoading(false);
            setUser(null);
            setUserData(null);
          });
          return;
        }

        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time role updates
        unsubUser = onSnapshot(userRef, async (snap) => {
          try {
            if (snap.exists()) {
              setUserData(snap.data());
            } else {
              const initialData = {
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                role: firebaseUser.email === 'hugocesarlemuscortes@gmail.com' ? 'admin' : 'user'
              };
              await setDoc(userRef, initialData);
              setUserData(initialData);
            }
            setUser(firebaseUser);
          } catch (error) {
            console.error("Error syncing user data:", error);
            setUser(firebaseUser); // Still allow login even if Firestore sync fails
          } finally {
            setLoading(false);
          }
        }, (error) => {
          console.error("User snapshot error:", error);
          setUser(firebaseUser);
          setLoading(false);
        });
      } else {
        if (unsubUser) {
          unsubUser();
          unsubUser = null;
        }
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  const isAdmin = userData?.role === 'admin' || 
    user?.email === 'hugocesarlemuscortes@gmail.com' || 
    user?.email === 'bunkerhrv@gmail.com';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <GlobalStateProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login />} 
          />
          
          <Route 
            path="/" 
            element={
              user ? (
                <Layout user={user} isAdmin={isAdmin}>
                  <Dashboard user={user} isAdmin={isAdmin} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          <Route 
            path="/sections" 
            element={
              user ? (
                <Layout user={user} isAdmin={isAdmin}>
                  <Sections />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          <Route 
            path="/sections/:sectionId" 
            element={
              user ? (
                <Layout user={user} isAdmin={isAdmin}>
                  <SectionDetail />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          <Route 
            path="/admin" 
            element={
              user && isAdmin ? (
                <Layout user={user} isAdmin={isAdmin}>
                  <Admin />
                </Layout>
              ) : (
                <Navigate to="/" />
              )
            } 
          />

          <Route 
            path="/evidence" 
            element={
              user ? (
                <Layout user={user} isAdmin={isAdmin}>
                  <Evidence />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
    </GlobalStateProvider>
  );
}
