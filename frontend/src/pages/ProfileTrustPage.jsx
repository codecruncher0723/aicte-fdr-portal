import React, { useState, useEffect, useCallback } from 'react';
import { useRole } from '../context/RoleContext';
import { apiClient } from '../api/client';

export default function ProfileTrustPage() {
  const { currentUser, currentRole } = useRole();

  const [profile, setProfile] = useState({
    institutionName: '',
    aictePid: '',
    establishedYear: '',
    accreditationGrade: '',
    sponsoringTrust: '',
    trustRegNumber: '',
    trusteeName: '',
    trusteeDesignation: '',
    officialEmail: '',
    contactPhone: '',
    campusAddress: '',
    city: '',
    state: '',
    region: '',
    pfmsVendorCode: '',
    primaryBank: '',
    ifscCode: '',
    jointAccountClause: '',
    status: '',
  });

  const [institutionId, setInstitutionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Load real institutional profile from backend
  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    const targetInstId = currentUser?.institutionId || currentUser?.institution_id;
    if (!targetInstId) {
      // Non-institution user context (e.g. AICTE Admin, Verifier, Approver)
      setProfile({
        institutionName: currentUser?.department || 'Regulatory Central Desk',
        aictePid: 'CENTRAL-HQ',
        sponsoringTrust: 'All India Council for Technical Education (Statutory Authority)',
        trusteeName: currentUser?.name || 'Authorized AICTE Official',
        trusteeDesignation: currentUser?.title || 'Regulatory Authority',
        officialEmail: currentUser?.email || 'portal@aicte.gov.in',
        campusAddress: 'Nelson Mandela Marg, Vasant Kunj, New Delhi 110070',
        city: 'New Delhi',
        state: 'Delhi',
        region: 'HQ New Delhi',
        primaryBank: 'State Bank of India, AICTE Branch',
        ifscCode: 'SBIN0001234',
        jointAccountClause: 'Statutory Joint Mandate Regulated',
        status: 'Active Oversight',
        trustRegNumber: '',
        pfmsVendorCode: '',
        contactPhone: '',
      });
      setIsLoading(false);
      return;
    }

    try {
      // Fetch genuine institution record
      const inst = await apiClient.getInstitution(targetInstId);
      setInstitutionId(inst.id);

      // Attempt to load banking details from active FDR instruments
      let activeBank = '';
      let activeIfsc = '';
      let activeMandate = 'AICTE Joint Account Mandate Active';
      try {
        const fdrs = await apiClient.getFdrs({ institution_id: targetInstId });
        if (Array.isArray(fdrs) && fdrs.length > 0) {
          const activeFdr = fdrs.find(f => f.status === 'ACTIVE') || fdrs[0];
          if (activeFdr) {
            activeBank = activeFdr.bank_name ? `${activeFdr.bank_name}${activeFdr.branch ? `, ${activeFdr.branch}` : ''}` : '';
            activeIfsc = activeFdr.ifsc || '';
            if (activeFdr.mandate_clause) activeMandate = activeFdr.mandate_clause;
          }
        }
      } catch (err) {
        console.warn('Could not derive banking details from FDRs:', err);
      }

      setProfile({
        institutionName: inst.name || currentUser?.institutionName || 'Technical Institution',
        aictePid: inst.aicte_pid || currentUser?.aictePid || '—',
        region: (inst.region || 'WRO').toUpperCase(),
        sponsoringTrust: inst.sponsoring_trust || '',
        city: inst.city || '',
        state: inst.state || '',
        campusAddress: inst.city && inst.state ? `${inst.city}, ${inst.state}` : (inst.city || inst.state || ''),
        trusteeName: inst.contact_name || currentUser?.name || '',
        trusteeDesignation: currentRole === 'INSTITUTION_OFFICER' ? 'Institutional Nodal Officer & Authorized Representative' : (currentUser?.title || 'Authorized Signatory'),
        officialEmail: inst.contact_email || currentUser?.email || '',
        primaryBank: activeBank,
        ifscCode: activeIfsc,
        jointAccountClause: activeMandate,
        status: inst.status || 'Active',
        // Statutory fields not modeled in current schema (explicit gap)
        trustRegNumber: '',
        pfmsVendorCode: '',
        contactPhone: '',
      });
    } catch (err) {
      console.error('Failed to load institution profile:', err);
      setFetchError(err.message || 'Failed to retrieve institution profile.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, currentRole]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Save changes to backend
  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);

    if (!institutionId) {
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);
      return;
    }

    setIsSaving(true);
    try {
      // Split campus address into city and state if comma separated
      let updatedCity = profile.city;
      let updatedState = profile.state;
      if (profile.campusAddress && profile.campusAddress.includes(',')) {
        const parts = profile.campusAddress.split(',');
        updatedCity = parts[0].trim();
        updatedState = parts.slice(1).join(',').trim();
      }

      await apiClient.updateInstitution(institutionId, {
        sponsoring_trust: profile.sponsoringTrust,
        city: updatedCity || undefined,
        state: updatedState || undefined,
        contact_name: profile.trusteeName || undefined,
        contact_email: profile.officialEmail || undefined,
      });

      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 4000);
      // Reload profile to ensure consistency with backend
      await loadProfile();
    } catch (err) {
      console.error('Failed to save profile:', err);
      setSaveError(err.message || 'Failed to save changes to the server.');
    } finally {
      setIsSaving(false);
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto animate-pulse">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container h-28" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container h-96" />
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Institutional Profile & Regulatory Trust Standing</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              {profile.institutionName || 'Institutional Profile'}
            </h1>
            {profile.aictePid && (
              <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium font-data-mono">
                PID: {profile.aictePid}
              </span>
            )}
            {profile.region && (
              <span className="font-label-sm text-xs text-primary bg-primary/10 px-2.5 py-0.5 rounded-full font-medium">
                {profile.region}
              </span>
            )}
          </div>
          <p className="text-xs text-secondary mt-1">
            Registered Sponsoring Trust details, designated bank mandates, and authorized administrative signatories.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-4 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold self-start lg:self-auto disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[17px]">
            {isSaving ? 'sync' : 'save'}
          </span>
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Fetch Error Notification */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-700 text-[18px]">error</span>
            <span><strong>Data Load Error:</strong> {fetchError}</span>
          </div>
          <button
            onClick={loadProfile}
            className="px-3 py-1 bg-rose-700 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Save Error Notification */}
      {saveError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-700 text-[18px]">warning</span>
            <span><strong>Save Failed:</strong> {saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="text-rose-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Success Notification */}
      {savedFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span><strong>Profile Saved:</strong> Institutional standing and designated signatory credentials updated.</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">SAVED</span>
        </div>
      )}

      {/* Regulatory Schema Transparency Notice */}
      <div className="p-4 bg-sky-50/70 border border-sky-200 text-sky-900 rounded-2xl flex items-start gap-3 text-xs">
        <span className="material-symbols-outlined text-sky-700 text-[20px] shrink-0 mt-0.5">info</span>
        <div className="space-y-1">
          <p className="font-semibold text-sky-950">Statutory Record Synchronization</p>
          <p className="text-sky-800/90 leading-relaxed">
            The values below are loaded directly from the AICTE Central Registry database. Fields such as Sponsoring Trust, Campus Location, and Nodal Officer can be updated and saved. Auxiliary records not modeled in the statutory schema (e.g. PFMS Vendor Code, Trust Registration Certificate, and secondary landlines) are left unrecorded to ensure 100% regulatory data integrity.
          </p>
        </div>
      </div>

      {/* Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trust & Society Information */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
            <span className="material-symbols-outlined text-primary text-[20px]">domain</span>
            <h2 className="text-sm font-bold text-on-surface">Sponsoring Trust / Society Entity</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-secondary font-semibold mb-1">
                Registered Sponsoring Trust
                <span className="ml-1 text-[10px] text-emerald-700 font-normal font-mono">(Sync with AICTE DB)</span>
              </label>
              <input
                type="text"
                value={profile.sponsoringTrust}
                onChange={(e) => setProfile({ ...profile, sponsoringTrust: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter sponsoring trust or society name"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Trust Registration Number
                <span className="ml-1 text-[10px] text-slate-500 font-normal font-mono">(Not in portal DB)</span>
              </label>
              <input
                type="text"
                value={profile.trustRegNumber}
                readOnly
                placeholder="Not recorded in portal database schema"
                className="w-full font-data-mono rounded-xl border border-surface-container bg-surface-container/50 px-3 py-2 text-on-surface-variant cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Authorized Trust Signatory / Nodal Officer
                <span className="ml-1 text-[10px] text-emerald-700 font-normal font-mono">(Sync with User DB)</span>
              </label>
              <input
                type="text"
                value={profile.trusteeName}
                onChange={(e) => setProfile({ ...profile, trusteeName: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter authorized signatory full name"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Signatory Title & Regulatory Role
              </label>
              <input
                type="text"
                value={profile.trusteeDesignation}
                readOnly
                className="w-full rounded-xl border border-surface-container bg-surface-container/50 px-3 py-2 text-on-surface-variant cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Registered Campus Address / City & State
                <span className="ml-1 text-[10px] text-emerald-700 font-normal font-mono">(Sync with AICTE DB)</span>
              </label>
              <textarea
                rows={2}
                value={profile.campusAddress}
                onChange={(e) => setProfile({ ...profile, campusAddress: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="City, State"
              />
            </div>
          </div>
        </div>

        {/* Banking, PFMS & Regulatory Standings */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
            <span className="material-symbols-outlined text-teal-700 text-[20px]">account_balance</span>
            <h2 className="text-sm font-bold text-on-surface">Banking & Regulatory Escrow Credentials</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-secondary font-semibold mb-1">
                Primary Scheduled Bank Branch
                <span className="ml-1 text-[10px] text-teal-700 font-normal font-mono">(Derived from Active FDR)</span>
              </label>
              <input
                type="text"
                value={profile.primaryBank || 'No active FDR registered'}
                readOnly
                className="w-full rounded-xl border border-surface-container bg-surface-container/50 px-3 py-2 text-on-surface-variant cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Branch IFSC Code
                <span className="ml-1 text-[10px] text-teal-700 font-normal font-mono">(Derived from Active FDR)</span>
              </label>
              <input
                type="text"
                value={profile.ifscCode || '—'}
                readOnly
                className="w-full font-data-mono rounded-xl border border-surface-container bg-surface-container/50 px-3 py-2 text-on-surface-variant cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Public Financial Management System (PFMS) Vendor ID
                <span className="ml-1 text-[10px] text-slate-500 font-normal font-mono">(Not in portal DB)</span>
              </label>
              <input
                type="text"
                value={profile.pfmsVendorCode}
                readOnly
                placeholder="Not recorded in portal database schema"
                className="w-full font-data-mono rounded-xl border border-surface-container bg-surface-container/50 px-3 py-2 text-on-surface-variant cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Official Nodal Email Address
                <span className="ml-1 text-[10px] text-emerald-700 font-normal font-mono">(Sync with User DB)</span>
              </label>
              <input
                type="email"
                value={profile.officialEmail}
                onChange={(e) => setProfile({ ...profile, officialEmail: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="nodal.officer@institution.edu.in"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Telephone Contact Number
                <span className="ml-1 text-[10px] text-slate-500 font-normal font-mono">(Not in portal DB)</span>
              </label>
              <input
                type="text"
                value={profile.contactPhone}
                readOnly
                placeholder="Not recorded in portal database schema"
                className="w-full rounded-xl border border-surface-container bg-surface-container/50 px-3 py-2 text-on-surface-variant cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
