import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
    if (error.response?.status === 403 && error.response?.headers['x-tc-update-required']) {
      window.location.href = '/accept-terms';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  loginApplicant:   (email: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: email, password })),
  registerApplicant:(d: any) => api.post('/auth/register/applicant', d),  // d may include invite_token
  registerEmployer: (d: any) => api.post('/auth/register/employer', d),
  activate:         (code: string) => api.post(`/auth/activate/${code}`),
  forgotPassword:   (email: string) => api.post('/auth/forgot-password', { email }),
  changePassword:   (d: any) => api.post('/auth/change-password', d),
  acceptTerms:      (tc_version_id: string) => api.post('/auth/accept-tc', { tc_version_id }),
  getCurrentTerms:  () => api.get('/auth/terms/current'),
  getMe:            () => api.get('/users/me'),
};

export const applicantApi = {
  getProfile:         () => api.get('/applicants/me'),
  addAuthHistory:       (payload: any) => api.post('/applicants/me/auth-history', payload),
  updateDemographics: (d: any) => api.patch('/applicants/me/demographics', d),
  saveAddress:        (d: any) => api.post('/applicants/me/address', d),
  addWorkHistory:     (d: any) => api.post('/applicants/me/work-history', d),
  updateWorkHistory:  (id: string, d: any) => api.patch(`/applicants/me/work-history/${id}`, d),
  deleteWorkHistory:  (id: string) => api.delete(`/applicants/me/work-history/${id}`),
  addEmpRef:          (workId: string, d: any) => api.post(`/applicants/me/work-history/${workId}/reference`, d),
  addClientEngagement:(workId: string, d: any) => api.patch(`/applicants/me/work-history/${workId}/client-engagements`, d),
  addEducation:       (d: any) => api.post('/applicants/me/education', d),
  updateEducation:    (id: string, d: any) => api.patch(`/applicants/me/education/${id}`, d),
  deleteEducation:    (id: string) => api.delete(`/applicants/me/education/${id}`),
  addCertification:   (d: any) => api.post('/applicants/me/certifications', d),
  updateCertification:(id: string, d: any) => api.patch(`/applicants/me/certifications/${id}`, d),
  deleteCertification:(id: string) => api.delete(`/applicants/me/certifications/${id}`),
  addReference:       (d: any) => api.post('/applicants/me/references', d),
  updateReference:    (id: string, d: any) => api.patch(`/applicants/me/references/${id}`, d),
  deleteReference:    (id: string) => api.delete(`/applicants/me/references/${id}`),
  addAward:           (d: any) => api.post('/applicants/me/awards', d),
  uploadResume:       (fileOrFd: File | FormData, description?: string) => {
    const fd = fileOrFd instanceof FormData ? fileOrFd : (() => { const f = new FormData(); f.append('file', fileOrFd); if (description) f.append('description', description); return f; })();
    return api.post('/applicants/me/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  updateWizardStep:   (step: number) => api.patch('/applicants/me/wizard-step', { step }),
  profileAction:      (action: string, step?: number) => api.post('/applicants/me/profile-action', { action, wizard_step: step }),
  uploadPhoto:        (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/applicants/me/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  applyViaLink:       (token: string, d: any) => api.post(`/applicants/apply/${token}`, d),
  getMyInvitations:   () => api.get('/invitations/my-invitations'),
  respondToInvitation:(id: string, d: any) => api.post(`/invitations/${id}/respond`, d),
  getMyResponses:     () => api.get('/invitations/my-responses'),
  getMyJobLinks:      () => api.get('/invitations/my-job-links'),
  claimJobLink:       (token: string) => api.post('/invitations/job-links/claim', { link_token: token }),
  applyViaJobLinkInbox: (itemId: string, d: any) => api.post(`/invitations/job-links/${itemId}/apply`, d),
  removeJobLink:      (id: string) => api.delete(`/invitations/job-links/${id}`),
  getHmProcessingCount: () => api.get('/invitations/my-hm-processing-count'),
  getMyResumes:     () => api.get('/applicants/me/resumes'),
  activateResume:   (id: string) => api.patch(`/applicants/me/resume/activate/${id}`),
  createFolderFromLink: (itemId: string, folderName: string) => api.post(`/invitations/job-links/${itemId}/create-folder`, { folder_name: folderName }),
  attachResumeToJobLink: (itemId: string, resumeId: string | null) => api.patch(`/invitations/job-links/${itemId}/attach-resume`, { resume_id: resumeId }),
  getShareLinks:      () => api.get('/share/my-links'),
  generateShareLink:  (d: any) => api.post('/share/generate', d),
  deactivateLink:     (id: string) => api.patch(`/share/deactivate/${id}`),
  getInvitations:     () => api.get('/invitations/my-invitations'),
  respondInvitation:  (id: string, response: string) => api.post(`/invitations/${id}/respond`, { response }),
  requestCorrection:  (d: any) => api.post('/applicants/me/correction-requests', d),
  getCorrections:     () => api.get('/applicants/me/correction-requests'),
  createVendorRequest:(d: any) => api.post('/applications/vendor-request', d),
};

export const employerApi = {
  getDashboard:       () => api.get('/employers/dashboard'),
  inviteCandidate:    (d: any) => api.post('/employers/invite-candidate', d),
  listSentInvitations:() => api.get('/employers/my-invitations'),
  getFolders:         (includeArchived = false) =>
    api.get('/folders/', { params: { include_archived: includeArchived } }),
  createFolder:       (d: any) => api.post('/folders/', d),
  updateFolder:       (id: string, d: any) => api.patch(`/folders/${id}`, d),
  deleteFolder:       (id: string) => api.delete(`/folders/${id}`),
  archiveFolder:      (id: string) => api.post(`/folders/${id}/archive`),
  restoreFolder:      (id: string) => api.post(`/folders/${id}/restore`),
  reassignFolder:     (id: string, newOwnerId: string) => api.post(`/folders/${id}/reassign`, { new_owner_id: newOwnerId }),
  createAppLink:      (folderId: string, d: any) => api.post(`/folders/${folderId}/application-links`, d),
  getAppLinks:        (folderId: string) => api.get(`/folders/${folderId}/application-links`),
  getFolderApps:      (folderId: string, status?: string) =>
    api.get(`/applications/folder/${folderId}`, { params: { status } }),
  updateAppStatus:    (appId: string, d: any) => api.patch(`/applications/${appId}/status`, d),
  updateNotes:        (appId: string, notes: string) => api.patch(`/applications/${appId}/notes`, { internal_notes: notes }),
  toggleFlag:         (appId: string) => api.patch(`/applications/${appId}/flag`),
  moveToFolder:       (appId: string, folderId: string) => api.patch(`/applications/${appId}/move`, null, { params: { folder_id: folderId } }),
  submitUp:               (appId: string, d: any) => api.post(`/applications/${appId}/submit-up`, d),
  getGenealogy:           (appId: string) => api.get(`/applications/${appId}/genealogy`),
  getSubmitUpTargets:     (folderId: string) => api.get(`/applications/folder/${folderId}/submit-up-targets`),
  inviteToApply:      (d: any) => api.post('/invitations/invite-to-apply', d),
};

export const notifApi = {
  list:        (params?: any) => api.get('/notifications/', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
  delete:      (id: string) => api.delete(`/notifications/${id}`),
  create:      (d: any) => api.post('/notifications/', d),
};

export const shareApi = {
  view: (token: string) => api.get(`/share/public/${token}`),
};

export const adminApi = {
  // HM Review Lifecycle
  getActiveRequests:          () => api.get('/hm/active-requests'),
  getArchivedRequests:        () => api.get('/hm/archived-requests'),
  updateReviewStatus:         (id: string, status: string) => api.patch(`/hm/requests/${id}/status`, { status }),
  uploadDiscrepancyReport:    (id: string, file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post(`/hm/requests/${id}/upload-report`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  updateReviewDisposition:    (id: string, d: any) => api.patch(`/hm/requests/${id}/disposition`, d),
  sendToRecipient:            (id: string) => api.post(`/hm/requests/${id}/send`),
  reactivateRequest:          (id: string) => api.post(`/hm/requests/${id}/reactivate`),
  // Org management
  createOrg:          (d: any) => api.post('/admin/organizations', d),
  listOrgs:           () => api.get('/admin/organizations'),
  updateOrg:          (id: string, d: any) => api.patch(`/admin/organizations/${id}`, d),
  resetAdminPassword: (orgId: string) => api.post(`/admin/organizations/${orgId}/reset-admin-password`),
  // All users management
  listAllUsers:       (params?: any) => api.get('/admin/users', { params }),
  resetUserPassword:  (userId: string) => api.post(`/admin/users/${userId}/reset-password`),
  updateUserStatus:   (userId: string, status: string) => api.patch(`/admin/users/${userId}/status`, { status }),
  unlockProfile:      (userId: string, reason: string) => api.post('/applicants/admin/unlock-profile', { user_id: userId, reason }),
  // HM staff
  listHMUsers:        () => api.get('/admin/hm-users'),
  createHMUser:       (d: any) => api.post('/admin/hm-users', d),
};

export default api;
