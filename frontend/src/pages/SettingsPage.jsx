import React, { useState } from 'react';
import { useRole } from '../context/RoleContext';

export default function SettingsPage() {
  const { currentUser } = useRole();

  const [savedFeedback, setSavedFeedback] = useState(false);
  const [formData, setFormData] = useState({
    ugDepositThreshold: '10000000',
    pgDepositThreshold: '7500000',
    diplomaDepositThreshold: '5000000',
    managementDepositThreshold: '3500000',
    preMaturityHorizon1: '30',
    preMaturityHorizon2: '60',
    preMaturityHorizon3: '90',
    autoSmsDispatch: true,
    autoEmailDispatch: true,
    autoFinacleProbeDays: '30',
    dscProvider: 'eMudhra Class 3 Organization DSC',
    requireCouncilResolutionForRelease: true
  });

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
            <span className="material-symbols-outlined text-[16px]">settings</span>
            <span>Governance & Regulatory System Administration</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Regulatory Settings & APH Governance
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              Admin Configuration Console
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Maintain Approval Process Handbook (APH) deposit thresholds, automated notice dispatch schedules, and RBAC matrix.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-4 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold self-start lg:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">save</span>
          <span>Save Governance Parameters</span>
        </button>
      </div>

      {/* Success Notification */}
      {savedFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span><strong>Parameters Updated:</strong> Statutory APH thresholds and automated notification rules saved to regulatory registry.</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">SAVED</span>
        </div>
      )}

      {/* Settings Sections */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: APH Clause 14(B) Collateral Thresholds */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
            <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
            <h2 className="text-sm font-bold text-on-surface">APH Clause 14(B) Mandatory Deposit Norms</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-secondary font-semibold mb-1">
                Undergraduate Engineering (B.Tech) Minimum Collateral (₹)
              </label>
              <input
                type="number"
                value={formData.ugDepositThreshold}
                onChange={(e) => setFormData({ ...formData, ugDepositThreshold: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-secondary mt-0.5 block">Standard: ₹1,00,00,000 (₹1 Crore) joint tripartite deposit</span>
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Postgraduate Technology (M.Tech) Minimum Collateral (₹)
              </label>
              <input
                type="number"
                value={formData.pgDepositThreshold}
                onChange={(e) => setFormData({ ...formData, pgDepositThreshold: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-secondary mt-0.5 block">Standard: ₹75,00,000 (₹75 Lakhs)</span>
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Management Programmes (MBA / PGDM) Minimum Collateral (₹)
              </label>
              <input
                type="number"
                value={formData.managementDepositThreshold}
                onChange={(e) => setFormData({ ...formData, managementDepositThreshold: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-secondary mt-0.5 block">Standard: ₹35,00,000 (₹35 Lakhs)</span>
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                Polytechnic & Diploma Programmes (₹)
              </label>
              <input
                type="number"
                value={formData.diplomaDepositThreshold}
                onChange={(e) => setFormData({ ...formData, diplomaDepositThreshold: e.target.value })}
                className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-secondary mt-0.5 block">Standard: ₹50,00,000 (₹50 Lakhs)</span>
            </div>
          </div>
        </div>

        {/* Section 2: Surveillance Horizons & Automated Daemon */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
            <span className="material-symbols-outlined text-teal-700 text-[20px]">event_repeat</span>
            <h2 className="text-sm font-bold text-on-surface">Maturity Horizons & Statutory Automation</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-secondary font-semibold mb-1">Tier-1 Alert (Days)</label>
                <input
                  type="number"
                  value={formData.preMaturityHorizon3}
                  onChange={(e) => setFormData({ ...formData, preMaturityHorizon3: e.target.value })}
                  className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-secondary font-semibold mb-1">Tier-2 Alert (Days)</label>
                <input
                  type="number"
                  value={formData.preMaturityHorizon2}
                  onChange={(e) => setFormData({ ...formData, preMaturityHorizon2: e.target.value })}
                  className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
                />
              </div>
              <div>
                <label className="block text-secondary font-semibold mb-1">Critical Form D-3</label>
                <input
                  type="number"
                  value={formData.preMaturityHorizon1}
                  onChange={(e) => setFormData({ ...formData, preMaturityHorizon1: e.target.value })}
                  className="w-full font-data-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface"
                />
              </div>
            </div>

            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container space-y-3">
              <span className="font-bold text-on-surface uppercase tracking-wider text-[11px] block">
                Automated Statutory Notice Dispatch
              </span>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Dispatch automated NIC-SMS alerts to Trust Secretary & Bank Manager</span>
                <input
                  type="checkbox"
                  checked={formData.autoSmsDispatch}
                  onChange={(e) => setFormData({ ...formData, autoSmsDispatch: e.target.checked })}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Dispatch Form D-3 PDF legal notice via registered official email</span>
                <input
                  type="checkbox"
                  checked={formData.autoEmailDispatch}
                  onChange={(e) => setFormData({ ...formData, autoEmailDispatch: e.target.checked })}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            </div>

            <div>
              <label className="block text-secondary font-semibold mb-1">
                SFMS / Core Banking Active Lien Probe Interval (Days)
              </label>
              <select
                value={formData.autoFinacleProbeDays}
                onChange={(e) => setFormData({ ...formData, autoFinacleProbeDays: e.target.value })}
                className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-on-surface"
              >
                <option value="15">Every 15 Days (High Frequency)</option>
                <option value="30">Every 30 Days (Standard Recommended)</option>
                <option value="60">Every 60 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: RBAC Roles & Entitlement Matrix */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
              <h2 className="text-sm font-bold text-on-surface">Role-Based Access Control (RBAC) Entitlement Matrix</h2>
            </div>
            <span className="text-xs text-secondary font-medium">4 Active Hackathon Personas Configured</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low/40 text-secondary uppercase font-label-sm text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">User Role</th>
                  <th className="py-2.5 px-3 font-semibold">View Registry</th>
                  <th className="py-2.5 px-3 font-semibold">Submit New FDR</th>
                  <th className="py-2.5 px-3 font-semibold">Perform Scrutiny / Flags</th>
                  <th className="py-2.5 px-3 font-semibold">Approve Release</th>
                  <th className="py-2.5 px-3 font-semibold">Confirm Bank Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                <tr className="hover:bg-surface-container-low/50">
                  <td className="py-2.5 px-3 font-bold text-on-surface">AICTE Admin</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Full National</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Yes</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Oversee</td>
                  <td className="py-2.5 px-3 text-secondary">Council Level</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Yes</td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="py-2.5 px-3 font-bold text-on-surface">Institution Officer</td>
                  <td className="py-2.5 px-3 text-teal-800 font-bold">✓ Own Trust Only</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Yes</td>
                  <td className="py-2.5 px-3 text-rose-700 font-medium">✗ Resubmit Only</td>
                  <td className="py-2.5 px-3 text-rose-700 font-medium">✗ Restricted</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Upload Voucher</td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="py-2.5 px-3 font-bold text-on-surface">Verification Officer</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Regional WRO</td>
                  <td className="py-2.5 px-3 text-rose-700 font-medium">✗ Restricted</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Form L-1 & Telemetry</td>
                  <td className="py-2.5 px-3 text-secondary">Recommend Only</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Verify Voucher</td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="py-2.5 px-3 font-bold text-on-surface">Approving Authority</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Full Council</td>
                  <td className="py-2.5 px-3 text-rose-700 font-medium">✗ Restricted</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Ratify Scrutiny</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Final Sign-off (Order)</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ Audit Ratification</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </form>
    </div>
  );
}
