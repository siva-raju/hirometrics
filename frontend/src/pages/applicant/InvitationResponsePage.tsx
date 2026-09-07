import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';
import { useState } from 'react';

export default function InvitationResponsePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [done, setDone] = useState('');

  const respond = useMutation({
    mutationFn: (response: string) => applicantApi.respondInvitation(id!, response),
    onSuccess: (_, response) => setDone(response)
  });

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center max-w-md">
        <div className="text-5xl mb-4">{done === 'accepted' ? '✅' : '❌'}</div>
        <h2 className="text-xl font-bold mb-2">Invitation {done}</h2>
        <p className="text-gray-600 text-sm">{done === 'accepted' ? 'Your profile has been shared with the employer.' : 'You have declined this invitation.'}</p>
        <button onClick={() => navigate('/applicant/dashboard')} className="mt-4 px-6 py-2 text-white rounded-lg text-sm" style={{ background: '#0078d2' }}>Back to dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center max-w-md">
        <h2 className="text-xl font-bold mb-4">Respond to invitation</h2>
        <p className="text-gray-600 text-sm mb-6">Do you want to share your HiroMetrics profile with this employer?</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => respond.mutate('accepted')} disabled={respond.isPending}
            className="px-6 py-2 text-white rounded-lg text-sm" style={{ background: '#78b41e' }}>Accept</button>
          <button onClick={() => respond.mutate('rejected')} disabled={respond.isPending}
            className="px-6 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Decline</button>
        </div>
      </div>
    </div>
  );
}
