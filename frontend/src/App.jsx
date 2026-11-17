import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AuditTrailProvider } from './context/AuditTrailContext';
import { DoctorSessionProvider } from './context/DoctorSessionContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingState from './components/LoadingState';
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import PatientOverview from './pages/patient/PatientOverview';
import PatientRecords from './pages/patient/PatientRecords';
import PatientUpload from './pages/patient/PatientUpload';
import PatientAccess from './pages/patient/PatientAccess';
import DoctorsDirectory from './pages/patient/DoctorsDirectory';
import DoctorOverview from './pages/doctor/DoctorOverview';
import DoctorLookupPage from './pages/doctor/DoctorLookupPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';
import Profile from './pages/Profile';
import './styles/global.css';

/**
 * RootRedirect - Redirects authenticated users to their home portal
 * (/patient or /doctor; admin notice behavior preserved), otherwise redirects to /login.
 */
function RootRedirect() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return (
      <div
        className="route-loading-container"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingState message="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'doctor') {
    return <Navigate to="/doctor" replace />;
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/patient" replace />;
}

/**
 * App - Root component with complete modular route table.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AuditTrailProvider>
              <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Patient routes (guarded by patient role) */}
            <Route
              path="/patient"
              element={
                <ProtectedRoute requiredRole="patient">
                  <PatientOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/records"
              element={
                <ProtectedRoute requiredRole="patient">
                  <PatientRecords />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/upload"
              element={
                <ProtectedRoute requiredRole="patient">
                  <PatientUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/doctors"
              element={
                <ProtectedRoute requiredRole="patient">
                  <DoctorsDirectory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/access"
              element={
                <ProtectedRoute requiredRole="patient">
                  <PatientAccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/profile"
              element={
                <ProtectedRoute requiredRole="patient">
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Doctor routes (guarded by doctor role; session history lifted across all doctor pages) */}
            <Route
              element={
                <ProtectedRoute requiredRole="doctor">
                  <DoctorSessionProvider>
                    <Outlet />
                  </DoctorSessionProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/doctor" element={<DoctorOverview />} />
              <Route path="/doctor/lookup" element={<DoctorLookupPage />} />
              <Route path="/doctor/doctors" element={<DoctorsDirectory />} />
              <Route path="/doctor/profile" element={<Profile />} />
            </Route>

            {/* Administrator routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            {/* key= makes React remount the page per route, so filters reset between views */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers key="all" view="all" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/doctors"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers key="doctor" view="doctor" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/patients"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers key="patient" view="patient" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAudit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuditTrailProvider>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
  </ErrorBoundary>
);
}
