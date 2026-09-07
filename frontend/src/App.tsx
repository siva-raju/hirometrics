import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/layout/AppLayout';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterApplicantPage from './pages/auth/RegisterApplicantPage';
import RegisterEmployerPage from './pages/auth/RegisterEmployerPage';
import ActivatePage from './pages/auth/ActivatePage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import AcceptTermsPage from './pages/auth/AcceptTermsPage';

// Applicant pages
import ApplicantDashboard from './pages/applicant/ApplicantDashboard';
import ApplicantWizard from './pages/applicant/Wizard';
import ApplicantProfile from './pages/applicant/Profile';
import CandidateInbox from './pages/applicant/CandidateInbox';
import CandidateSent from './pages/applicant/CandidateSent';
import NotificationsPage from './pages/shared/NotificationsPage';

// Employer pages
import EmployerDashboard from './pages/employer/EmployerDashboard';
import EmployerInbox from './pages/employer/EmployerInbox';
import ManageUsers from './pages/employer/ManageUsers';
import ResumePage from './pages/applicant/ResumePage';
import EmployerFolders from './pages/employer/Folders';
import FolderDetailPage from './pages/employer/FolderDetail';
import EmployerSearch from './pages/employer/Search';
import EmployerArchive from './pages/employer/Archive';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ActiveRequests from './pages/admin/ActiveRequests';
import ArchivedRequests from './pages/admin/ArchivedRequests';
import AdminOrgs from './pages/admin/Organizations';
import AdminNotifications from './pages/admin/Notifications';
import HMUsers from './pages/admin/HMUsers';
import UserManagement from './pages/admin/UserManagement';

// Shared
import VerifiedProfileView from './pages/shared/VerifiedProfileView';
import ApplyViaLinkPage from './pages/shared/ApplyViaLinkPage';

function ProtectedRoute({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRouter() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'applicant') return <Navigate to="/applicant/dashboard" replace />;
  if (['customer_admin', 'customer_manager'].includes(user.role)) return <Navigate to="/employer/dashboard" replace />;
  if (user.role.startsWith('hm_')) return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

const APPLICANT = ['applicant'];
const EMPLOYER = ['customer_admin', 'customer_manager'];
const HM = ['hm_super_admin', 'hm_admin', 'hm_manager', 'hm_supervisor', 'hm_analyst', 'hm_qa'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/applicant" element={<RegisterApplicantPage />} />
        <Route path="/register/employer" element={<RegisterEmployerPage />} />
        <Route path="/activate/:code" element={<ActivatePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/apply/:token" element={<ApplyViaLinkPage />} />
        <Route path="/verified/:token" element={<VerifiedProfileView />} />
        <Route path="/apply/:token" element={<ApplyViaLinkPage />} />

        {/* T&C acceptance */}
        <Route path="/accept-terms" element={
          <ProtectedRoute><AcceptTermsPage /></ProtectedRoute>
        } />

        {/* Root redirect */}
        <Route path="/" element={<ProtectedRoute><RoleRouter /></ProtectedRoute>} />

        {/* Applicant routes */}
        <Route path="/applicant" element={<ProtectedRoute allowedRoles={APPLICANT}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<ApplicantDashboard />} />
          <Route path="wizard" element={<ApplicantWizard />} />
          <Route path="profile" element={<ApplicantProfile />} />
          <Route path="inbox" element={<CandidateInbox />} />
          <Route path="sent" element={<CandidateSent />} />
          <Route path="resume" element={<ResumePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Employer routes */}
        <Route path="/employer" element={<ProtectedRoute allowedRoles={EMPLOYER}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<EmployerDashboard />} />
          <Route path="inbox" element={<EmployerInbox />} />
          <Route path="folders" element={<EmployerFolders />} />
          <Route path="folders/:folderId" element={<FolderDetailPage />} />
          <Route path="search" element={<EmployerSearch />} />
          <Route path="archive" element={<EmployerArchive />} />
          <Route path="manage-users" element={<ManageUsers />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* HM Admin routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={HM}><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="active-requests" element={<ActiveRequests />} />
          <Route path="archived-requests" element={<ArchivedRequests />} />
          <Route path="organizations" element={<AdminOrgs />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="hm-users" element={<HMUsers />} />
          <Route path="users" element={<UserManagement />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
