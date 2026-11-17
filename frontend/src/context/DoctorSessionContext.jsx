import { createContext, useContext } from 'react';
import useSessionHistory from '../hooks/useSessionHistory';

const DoctorSessionContext = createContext(null);

/**
 * DoctorSessionProvider - Lifts doctor session history state to route level,
 * allowing history, counts, and lookups to survive navigation between
 * /doctor, /doctor/lookup, and /doctor/profile.
 */
export function DoctorSessionProvider({ children }) {
  const session = useSessionHistory();
  return (
    <DoctorSessionContext.Provider value={session}>
      {children}
    </DoctorSessionContext.Provider>
  );
}

export function useDoctorSession() {
  const context = useContext(DoctorSessionContext);
  if (!context) {
    throw new Error('useDoctorSession must be used within DoctorSessionProvider');
  }
  return context;
}

export default DoctorSessionContext;

