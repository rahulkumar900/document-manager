import React, { useState, useEffect } from 'react';
import { UserAccount, SiteRecord } from '@/lib/types';
import { updateUserProfile, updateUserPassword } from '@/lib/store';
import { Icons } from '../ui/icons';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  sites: SiteRecord[];
  onProfileUpdated: (updatedUser: UserAccount) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  sites,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [assignedSiteId, setAssignedSiteId] = useState(currentUser.assignedSiteId || 'all');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Security / Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name);
      setAssignedSiteId(currentUser.assignedSiteId || 'all');
      setProfileSuccessMsg(null);
      setProfileErrorMsg(null);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccessMsg(null);
      setPasswordErrorMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileErrorMsg('Please enter your full name.');
      return;
    }

    setIsSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    const res = await updateUserProfile(currentUser.id, {
      name: name.trim(),
      assignedSiteId: currentUser.role === 'Admin' ? assignedSiteId : currentUser.assignedSiteId,
    });

    setIsSavingProfile(false);

    if (res.user) {
      setProfileSuccessMsg('Profile updated successfully!');
      onProfileUpdated(res.user);
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } else {
      setProfileErrorMsg(res.error || 'Failed to update profile.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    const res = await updateUserPassword(newPassword);
    setIsUpdatingPassword(false);

    if (res.success) {
      setPasswordSuccessMsg('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(null), 4000);
    } else {
      setPasswordErrorMsg(res.error || 'Failed to update password.');
    }
  };

  const assignedSiteObj = sites.find((s) => s.id === currentUser.assignedSiteId);
  const userInitials = (currentUser.name || 'User')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-base font-bold shadow-md">
              {userInitials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Account Profile & Settings</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    currentUser.role === 'Admin'
                      ? 'bg-secondary text-secondary-foreground border-border'
                      : currentUser.role === 'Checker'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-secondary text-secondary-foreground border-border'
                  }`}
                >
                  {currentUser.role}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-secondary transition-all cursor-pointer"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Section 1: Personal Details */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Icons.User className="w-4 h-4 text-primary" />
                <span>Personal Information</span>
              </span>
              {profileSuccessMsg && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <Icons.Check className="w-3.5 h-3.5" />
                  {profileSuccessMsg}
                </span>
              )}
            </div>

            {profileErrorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                {profileErrorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Full Display Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none transition-colors"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Assigned Site Scope
                </label>
                {currentUser.role === 'Admin' ? (
                  <select
                    value={assignedSiteId}
                    onChange={(e) => setAssignedSiteId(e.target.value)}
                    className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors"
                  >
                    <option value="all">All Sites (Global Admin)</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={
                      currentUser.assignedSiteId === 'all'
                        ? 'All Construction Sites'
                        : assignedSiteObj
                        ? `${assignedSiteObj.name} (${assignedSiteObj.code})`
                        : 'Unassigned'
                    }
                    className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-xs py-2.5 px-5 rounded-xl transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                {isSavingProfile ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Icons.Check className="w-4 h-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Section 2: Account Security / Change Password */}
          <form onSubmit={handleUpdatePassword} className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Icons.Key className="w-4 h-4 text-primary" />
                <span>Security & Password</span>
              </span>
              {passwordSuccessMsg && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <Icons.Check className="w-3.5 h-3.5" />
                  {passwordSuccessMsg}
                </span>
              )}
            </div>

            {passwordErrorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                {passwordErrorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-background border border-input focus:border-ring focus:ring-1 focus:ring-ring rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isUpdatingPassword || !newPassword}
                className="bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-secondary-foreground font-bold text-xs py-2.5 px-5 rounded-xl transition-all border border-border cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                {isUpdatingPassword ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-secondary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-card border-t border-border flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-secondary-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
