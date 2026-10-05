import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

interface VaultMember {
  username: string;
  email: string;
  isAdmin: boolean;
  isApproved: boolean;
  isCurrentUser: boolean;
  enabled: boolean;
  status: string;
}

interface VaultVideo {
  videoId: string;
  title: string;
  genre: string;
  releaseYear: string;
  description: string;
  tags: string[];
  familyId: string;
}

const VaultAdmin = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<VaultMember[]>([]);
  const [videos, setVideos] = useState<VaultVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VaultVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [memberResponse, videoResponse] = await Promise.all([
        api.get<VaultMember[]>('vault/members'),
        api.get<VaultVideo[]>('catalog?adminView=true')
      ]);
      setMembers(memberResponse.data);
      setVideos(videoResponse.data.filter(video => video.familyId === userProfile.familyId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load family vault data.');
    }
  }, [userProfile.familyId]);

  useEffect(() => {
    if (!userProfile.isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    void refresh();
  }, [navigate, refresh, userProfile.isAdmin]);

  const performMemberAction = async (username: string, action: 'approve' | 'promote' | 'demote' | 'ban' | 'reject') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`vault/members/${action}`, { username });
      setNotice(
        action === 'approve' ? 'Member approved.' :
          action === 'promote' ? 'Member promoted to administrator.' :
            action === 'demote' ? 'Administrator privileges removed.' :
            action === 'reject' ? 'Membership request rejected.' : 'Member access disabled.'
      );
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Unable to ${action} member.`);
    } finally {
      setBusy(false);
    }
  };

  const saveVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedVideo) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.put(`vault/videos/${encodeURIComponent(selectedVideo.videoId)}`, {
        title: String(form.get('title') || ''),
        genre: String(form.get('genre') || ''),
        releaseYear: String(form.get('releaseYear') || ''),
        description: String(form.get('description') || ''),
        tags: String(form.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean)
      });
      setNotice('Video metadata updated.');
      setSelectedVideo(null);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update video metadata.');
    } finally {
      setBusy(false);
    }
  };

  const deleteVideo = async (video: VaultVideo) => {
    if (!window.confirm(`Move "${video.title}" to the vault trash?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.delete(`catalog/${encodeURIComponent(video.videoId)}/${encodeURIComponent(userProfile.familyId || '')}`);
      setNotice('Video moved to trash.');
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete video.');
    } finally {
      setBusy(false);
    }
  };

  if (!userProfile.isAdmin) return null;

  return (
    <main className="min-h-screen bg-heritage-black px-5 pb-16 pt-28 text-heritage-parchment lg:px-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-heritage-gold">Family Vault Governance</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Vault Administration</h1>
            <p className="mt-2 text-sm text-heritage-400">Vault: {userProfile.familyId}</p>
          </div>
          <button onClick={() => void refresh()} disabled={busy} className="rounded-xl border border-heritage-gold/40 px-4 py-2 text-xs font-black uppercase text-heritage-gold disabled:opacity-50">
            Refresh
          </button>
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</p>}

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase">Member Roster & Access Requests</h2>
          {members.length === 0 && <p className="text-sm text-heritage-400">No family members found.</p>}
          <div className="grid gap-3">
            {members.map(member => (
              <article key={member.username} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-heritage-800 bg-heritage-900/70 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold">{member.email || member.username}</p>
                  <p className="mt-1 text-xs text-heritage-400">
                    {member.isAdmin ? 'Administrator' : member.isApproved ? 'Approved member' : 'Approval pending'} · {member.enabled ? member.status : 'Disabled'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!member.isCurrentUser && !member.isApproved && member.enabled && (
                    <button disabled={busy} onClick={() => void performMemberAction(member.username, 'approve')} className="rounded-lg bg-heritage-gold px-3 py-2 text-xs font-black text-heritage-black disabled:opacity-50">Approve</button>
                  )}
                  {!member.isCurrentUser && !member.isApproved && member.enabled && (
                    <button disabled={busy} onClick={() => void performMemberAction(member.username, 'reject')} className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">Reject request</button>
                  )}
                  {!member.isCurrentUser && !member.isAdmin && member.isApproved && member.enabled && (
                    <button disabled={busy} onClick={() => void performMemberAction(member.username, 'promote')} className="rounded-lg border border-heritage-gold/50 px-3 py-2 text-xs font-black text-heritage-gold disabled:opacity-50">Promote</button>
                  )}
                  {!member.isCurrentUser && member.isAdmin && member.enabled && (
                    <button disabled={busy} onClick={() => void performMemberAction(member.username, 'demote')} className="rounded-lg border border-heritage-gold/50 px-3 py-2 text-xs font-black text-heritage-gold disabled:opacity-50">Demote</button>
                  )}
                  {!member.isCurrentUser && (member.isApproved || member.isAdmin) && member.enabled && (
                    <button disabled={busy} onClick={() => void performMemberAction(member.username, 'ban')} className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">Ban</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase">Video Management</h2>
          <div className="grid gap-3">
            {videos.map(video => (
              <article key={video.videoId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-heritage-800 bg-heritage-900/70 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold">{video.title}</p>
                  <p className="mt-1 text-xs text-heritage-400">{video.genre} · {video.releaseYear}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedVideo(video)} className="rounded-lg border border-heritage-gold/50 px-3 py-2 text-xs font-black text-heritage-gold">Edit metadata</button>
                  <button disabled={busy} onClick={() => void deleteVideo(video)} className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={saveVideo} className="w-full max-w-xl space-y-4 rounded-3xl border border-heritage-gold/30 bg-heritage-900 p-6">
            <h2 className="text-xl font-black uppercase">Edit video metadata</h2>
            <input name="title" defaultValue={selectedVideo.title} required aria-label="Title" className="w-full rounded-xl border border-heritage-800 bg-heritage-black p-3 text-sm" />
            <input name="genre" defaultValue={selectedVideo.genre} required aria-label="Genre" className="w-full rounded-xl border border-heritage-800 bg-heritage-black p-3 text-sm" />
            <input name="releaseYear" defaultValue={selectedVideo.releaseYear} required aria-label="Release year" className="w-full rounded-xl border border-heritage-800 bg-heritage-black p-3 text-sm" />
            <textarea name="description" defaultValue={selectedVideo.description} aria-label="Description" rows={4} className="w-full rounded-xl border border-heritage-800 bg-heritage-black p-3 text-sm" />
            <input name="tags" defaultValue={selectedVideo.tags.join(', ')} aria-label="Tags, comma separated" className="w-full rounded-xl border border-heritage-800 bg-heritage-black p-3 text-sm" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedVideo(null)} className="rounded-xl border border-heritage-800 px-4 py-3 text-xs font-black uppercase">Cancel</button>
              <button disabled={busy} type="submit" className="rounded-xl bg-heritage-gold px-4 py-3 text-xs font-black uppercase text-heritage-black disabled:opacity-50">Save metadata</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default VaultAdmin;
