import React, { useState } from 'react';

export default function ProfileTrustPage() {
  const [profile, setProfile] = useState({
    institutionName: "St. Xavier's Engineering College",
    aictePid: '1-10928374',
    establishedYear: '2011',
    accreditationGrade: 'Grade A Regulatory Standing',
    sponsoringTrust: "St. Xavier's Technical Education Society",
    trustRegNumber: 'MAH/PUN/F-10294/1998',
    trusteeName: 'Dr. Anand Deshmukh',
    trusteeDesignation: 'Trust Secretary & Authorized Signatory',
    officialEmail: 'principal@sxec.edu.in',
    contactPhone: '+91-20-2567-9100',
    campusAddress: 'Plot 44, Knowledge City, Shivajinagar, Pune 411005',
    region: 'Western Regional Office (WRO), Pune / Mumbai',
    pfmsVendorCode: 'PFMS-MH-2018-88192',
    primaryBank: 'Punjab National Bank, FC Road Branch, Pune',
    ifscCode: 'PUNB0012900',
    jointAccountClause: 'Clause 14(B) Mandate Active'
  });

  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3500);
  };

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
              {profile.institutionName}
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium font-data-mono">
              PID: {profile.aictePid}
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Registered Sponsoring Trust details, designated bank mandates, and authorized administrative signatories.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-4 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold self-start lg:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">save</span>
          <span>Save Changes</span>
        </button>
      </div>

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
              <label className="block text-secondary font-semibold mb-1">Registered Sponsoring Trust</label>
              <input
                type="text"
                value={profile.sponsoringTrust}
                onChange={(e) => setProfile({ ...profile, sponsoringTrust: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Trust Registration Number</label>
              <input
                type="text"
                value={profile.trustRegNumber}
                onChange={(e) => setProfile({ ...profile, trustRegNumber: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Authorized Trust Signatory</label>
              <input
                type="text"
                value={profile.trusteeName}
                onChange={(e) => setProfile({ ...profile, trusteeName: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Signatory Title</label>
              <input
                type="text"
                value={profile.trusteeDesignation}
                onChange={(e) => setProfile({ ...profile, trusteeDesignation: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Registered Campus Address</label>
              <textarea
                rows={2}
                value={profile.campusAddress}
                onChange={(e) => setProfile({ ...profile, campusAddress: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low p-3 text-on-surface"
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
              <label className="block text-secondary font-semibold mb-1">Primary Scheduled Bank Branch</label>
              <input
                type="text"
                value={profile.primaryBank}
                onChange={(e) => setProfile({ ...profile, primaryBank: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Branch IFSC Code</label>
              <input
                type="text"
                value={profile.ifscCode}
                onChange={(e) => setProfile({ ...profile, ifscCode: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Public Financial Management System (PFMS) Vendor ID</label>
              <input
                type="text"
                value={profile.pfmsVendorCode}
                onChange={(e) => setProfile({ ...profile, pfmsVendorCode: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Official Nodal Email Address</label>
              <input
                type="email"
                value={profile.officialEmail}
                onChange={(e) => setProfile({ ...profile, officialEmail: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">Telephone Contact Number</label>
              <input
                type="text"
                value={profile.contactPhone}
                onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
                className="w-full rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
