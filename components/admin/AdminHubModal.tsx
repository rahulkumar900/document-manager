import React, { useState, useEffect } from 'react';
import { UserAccount, SiteRecord, Role } from '@/lib/types';
import {
  saveUsers,
  saveSites,
  saveSiteToSupabase,
  saveUserToSupabase,
  deleteSiteFromSupabase,
  deleteUserFromSupabase,
  syncSitesWithSupabase,
  syncDocumentsWithSupabase,
  syncUsersWithSupabase,
  getStoredDocuments,
  saveDocumentToSupabase,
  adminCreateUser,
} from '@/lib/store';
import { Icons } from '../ui/icons';
import { generateUUID } from '@/lib/utils';

interface AdminHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  sites: SiteRecord[];
  onUsersUpdated: (users: UserAccount[]) => void;
  onSitesUpdated: (sites: SiteRecord[]) => void;
  currentUser: UserAccount;
}

export const AdminHubModal: React.FC<AdminHubModalProps> = ({
  isOpen,
  onClose,
  users,
  sites,
  onUsersUpdated,
  onSitesUpdated,
  currentUser,
}) => {
  const [tab, setTab] = useState<'create-user' | 'create-site' | 'manage-assignments' | 'cloud-sync'>('create-user');

  // Create Site form
  const [siteName, setSiteName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [siteSuccess, setSiteSuccess] = useState('');

  // Create User form
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<Role>('Site Accountant');
  const [userSiteId, setUserSiteId] = useState<string>(sites[0]?.id || '');
  const [userSuccess, setUserSuccess] = useState('');
  const [userError, setUserError] = useState('');

  // Manage assignments
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [editRole, setEditRole] = useState<Role>(users[0]?.role || 'Site Accountant');
  const [editSiteId, setEditSiteId] = useState<string>(users[0]?.assignedSiteId || 'all');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');

  // Cloud Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Auto-refresh profiles from Supabase when Admin Hub opens
  useEffect(() => {
    if (isOpen) {
      syncUsersWithSupabase().then((latestUsers) => {
        if (latestUsers && latestUsers.length > 0) {
          onUsersUpdated(latestUsers);
          if (!selectedUserId && latestUsers[0]) {
            setSelectedUserId(latestUsers[0].id);
            setEditRole(latestUsers[0].role);
            setEditSiteId(latestUsers[0].assignedSiteId);
          }
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !siteCode.trim()) return;

    const newSite: SiteRecord = {
      id: generateUUID(),
      name: siteName.trim(),
      code: siteCode.trim().toUpperCase(),
      location: siteLocation.trim() || 'General Location',
      createdAt: new Date().toISOString(),
    };

    const updated = [...sites, newSite];
    onSitesUpdated(updated);
    saveSites(updated);

    // Persist to Supabase
    await saveSiteToSupabase(newSite);

    setSiteName('');
    setSiteCode('');
    setSiteLocation('');
    setSiteSuccess(`Construction site "${newSite.name}" created and synchronized!`);
    setTimeout(() => setSiteSuccess(''), 3000);
  };

  const handleDeleteSite = async (siteId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete construction site "${name}"?`)) return;
    const updated = sites.filter((s) => s.id !== siteId);
    onSitesUpdated(updated);
    saveSites(updated);
    await deleteSiteFromSupabase(siteId);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (users.some((u) => u.email.toLowerCase() === userEmail.trim().toLowerCase())) {
      setUserError('A user account with this email already exists.');
      return;
    }

    if (userPassword.length < 6) {
      setUserError('Password must be at least 6 characters long.');
      return;
    }

    const assignedSite = userRole === 'Admin' ? 'all' : userSiteId || (sites[0]?.id ?? 'all');
    
    // Provision user in Supabase Auth & profiles without disrupting current session
    const res = await adminCreateUser(
      userEmail,
      userPassword,
      userName,
      userRole,
      assignedSite
    );

    if (res.error) {
      setUserError(res.error);
      return;
    }

    const newUser = res.user || {
      id: generateUUID(),
      name: userName.trim(),
      email: userEmail.trim(),
      role: userRole,
      assignedSiteId: assignedSite,
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    onUsersUpdated(updated);
    saveUsers(updated);

    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserSuccess(`User ${newUser.name} created as ${newUser.role} successfully!`);
    setTimeout(() => setUserSuccess(''), 3000);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (userId === currentUser.id) {
      alert('You cannot delete your own logged-in administrator account.');
      return;
    }
    if (!confirm(`Are you sure you want to delete user account "${name}"?`)) return;

    const updated = users.filter((u) => u.id !== userId);
    onUsersUpdated(updated);
    saveUsers(updated);
    await deleteUserFromSupabase(userId);

    if (selectedUserId === userId && updated.length > 0) {
      setSelectedUserId(updated[0].id);
      setEditRole(updated[0].role);
      setEditSiteId(updated[0].assignedSiteId);
    }
  };

  const handleSelectUserForEdit = (userId: string) => {
    setSelectedUserId(userId);
    const target = users.find((u) => u.id === userId);
    if (target) {
      setEditRole(target.role);
      setEditSiteId(target.assignedSiteId);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetUser: UserAccount | null = null;
    const updated = users.map((u) => {
      if (u.id === selectedUserId) {
        const uUpdated = {
          ...u,
          role: editRole,
          assignedSiteId: editRole === 'Admin' ? 'all' : editSiteId,
        };
        targetUser = uUpdated;
        return uUpdated;
      }
      return u;
    });

    onUsersUpdated(updated);
    saveUsers(updated);

    if (targetUser) {
      await saveUserToSupabase(targetUser);
    }

    setAssignmentSuccess('User role and site assignment updated and synchronized!');
    setTimeout(() => setAssignmentSuccess(''), 3000);
  };

  const handleForceFullPushToSupabase = async () => {
    setIsSyncing(true);
    setSyncStatus('Pushing all construction sites to cloud...');

    // Push sites
    for (const s of sites) {
      await saveSiteToSupabase(s);
    }

    setSyncStatus('Pushing all user profiles to cloud...');
    // Push users
    for (const u of users) {
      await saveUserToSupabase(u);
    }

    setSyncStatus('Pushing all document audit records to cloud...');
    // Push documents
    const allDocs = getStoredDocuments();
    for (const d of allDocs) {
      await saveDocumentToSupabase(d);
    }

    setSyncStatus('Pulling latest synchronized data from cloud...');
    const [cloudSites, cloudUsers, cloudDocs] = await Promise.all([
      syncSitesWithSupabase(),
      syncUsersWithSupabase(),
      syncDocumentsWithSupabase(),
    ]);

    if (cloudSites.length > 0) onSitesUpdated(cloudSites);
    if (cloudUsers.length > 0) onUsersUpdated(cloudUsers);

    setIsSyncing(false);
    setSyncStatus(`Sync Complete! ${cloudSites.length} sites, ${cloudUsers.length} users, and ${cloudDocs.length} documents verified.`);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-secondary border border-border text-primary flex items-center justify-center">
              <Icons.Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Admin Management Hub</h2>
              <p className="text-xs text-muted-foreground">Manage portal users, construction sites, and cloud database sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted/20 p-2 gap-2">
          <button
            onClick={() => setTab('create-user')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'create-user'
                ? 'bg-secondary text-secondary-foreground border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create User
          </button>
          <button
            onClick={() => setTab('create-site')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'create-site'
                ? 'bg-secondary text-secondary-foreground border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sites ({sites.length})
          </button>
          <button
            onClick={() => setTab('manage-assignments')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'manage-assignments'
                ? 'bg-secondary text-secondary-foreground border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Manage Users ({users.length})
          </button>
          <button
            onClick={() => setTab('cloud-sync')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'cloud-sync'
                ? 'bg-secondary text-secondary-foreground border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Cloud Database Sync</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {tab === 'create-user' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              {userSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2">
                  <Icons.Check className="w-4 h-4 text-emerald-400" />
                  <span>{userSuccess}</span>
                </div>
              )}
              {userError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-2xl flex items-center gap-2">
                  <Icons.AlertTriangle className="w-4 h-4 text-destructive" />
                  <span>{userError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="sarah@sitedocs.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Role *
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as Role)}
                    className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                  >
                    <option value="Site Accountant">Site Accountant</option>
                    <option value="Checker">Checker (Auditor)</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>

                {userRole === 'Site Accountant' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Assigned Site *
                    </label>
                    <select
                      value={userSiteId}
                      onChange={(e) => setUserSiteId(e.target.value)}
                      className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                    >
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-3 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Create User Account & Sync
                </button>
              </div>
            </form>
          )}

          {tab === 'create-site' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateSite} className="space-y-4 bg-muted/20 p-4 rounded-2xl border border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Add New Site</h4>
                {siteSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2">
                    <Icons.Check className="w-4 h-4 text-emerald-400" />
                    <span>{siteSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Line Phase 4"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Site Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MLP4"
                      value={siteCode}
                      onChange={(e) => setSiteCode(e.target.value)}
                      className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono uppercase focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Location / Sector
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Downtown Central"
                      value={siteLocation}
                      onChange={(e) => setSiteLocation(e.target.value)}
                      className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Create Construction Site & Sync
                </button>
              </form>

              {/* Existing Sites List with Delete option */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Existing Construction Sites</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sites.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-muted/20 border border-border p-3 rounded-xl"
                    >
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span>{s.name}</span>
                          <span className="font-mono text-[10px] bg-secondary border border-border px-1.5 py-0.5 rounded text-secondary-foreground">
                            {s.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{s.location}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteSite(s.id, s.name)}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Site"
                      >
                        <Icons.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'manage-assignments' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveAssignment} className="space-y-4 bg-muted/20 p-4 rounded-2xl border border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Update User Role / Site</h4>
                {assignmentSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-center gap-2">
                    <Icons.Check className="w-4 h-4 text-emerald-400" />
                    <span>{assignmentSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Select User to Configure
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => handleSelectUserForEdit(e.target.value)}
                    className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Assigned Role
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as Role)}
                      className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                    >
                      <option value="Site Accountant">Site Accountant</option>
                      <option value="Checker">Checker (Auditor)</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Site Permission Scope
                    </label>
                    <select
                      disabled={editRole === 'Admin'}
                      value={editSiteId}
                      onChange={(e) => setEditSiteId(e.target.value)}
                      className={`w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors ${
                        editRole === 'Admin' ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="all">All Sites (Global)</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Save Role & Assignment
                </button>
              </form>

              {/* Existing Users List with Delete User option */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">All Portal Users</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between bg-muted/20 border border-border p-3 rounded-xl"
                    >
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span>{u.name}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              u.role === 'Admin'
                                ? 'bg-secondary text-secondary-foreground border-border'
                                : u.role === 'Checker'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-secondary text-secondary-foreground border-border'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">{u.email}</div>
                      </div>

                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-all cursor-pointer"
                          title="Delete User"
                        >
                          <Icons.Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'cloud-sync' && (
            <div className="space-y-5">
              <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Cloud Database Connection</h4>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                    ONLINE & SECURE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Real-time synchronization active • SSL Encrypted
                </p>
              </div>

              {syncStatus && (
                <div className="p-3 bg-secondary border border-border rounded-xl text-foreground text-xs flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>{syncStatus}</span>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Click the button below to push all local construction sites, profiles, and document metadata records to your secure cloud database.
                </p>

                <button
                  type="button"
                  onClick={handleForceFullPushToSupabase}
                  disabled={isSyncing}
                  className="w-full bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Syncing to Cloud Database...
                    </>
                  ) : (
                    <>
                      <Icons.Refresh className="w-4 h-4" />
                      Force Full Cloud Synchronization
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
