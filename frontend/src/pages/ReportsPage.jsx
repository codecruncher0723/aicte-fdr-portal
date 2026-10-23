import React, { useState } from 'react';
import { useRole } from '../context/RoleContext';
import { exportToCSV } from '../data/mockData';

export default function ReportsPage({ fdrs }) {
  const { fiscalYear } = useRole();
  const [selectedFy, setSelectedFy] = useState(fiscalYear || '2024-25');
  const [selectedReportType, setSelectedReportType] = useState('all');
  const [exportSuccessMessage, setExportSuccessMessage] = useState(null);

  const regionData = [
    { name: 'Western Regional Office (WRO)', code: 'WRO', count: 4820, value: 482000000, valueFormatted: '₹48.20 Cr', share: 32.5, compliance: '98.8%' },
    { name: 'Southern Regional Office (SRO)', code: 'SRO', count: 3680, value: 368000000, valueFormatted: '₹36.80 Cr', share: 24.8, compliance: '97.9%' },
    { name: 'Northern Regional Office (NRO)', code: 'NRO', count: 2910, value: 291000000, valueFormatted: '₹29.10 Cr', share: 19.6, compliance: '96.5%' },
    { name: 'Eastern Regional Office (ERO)', code: 'ERO', count: 1840, value: 184000000, valueFormatted: '₹18.40 Cr', share: 12.4, compliance: '99.1%' },
    { name: 'North-Western Regional Office (NWRO)', code: 'NWRO', count: 1120, value: 112000000, valueFormatted: '₹11.20 Cr', share: 7.5, compliance: '95.8%' },
    { name: 'Central Regional Office (CRO)', code: 'CRO', count: 450, value: 45000000, valueFormatted: '₹4.50 Cr', share: 3.2, compliance: '98.0%' }
  ];

  const bankData = [
    { bank: 'State Bank of India', code: 'SBI', activeFdrs: 5120, exposure: '₹51.20 Cr', sharePercent: 34.5, rating: 'Scheduled Tier-1' },
    { bank: 'Punjab National Bank', code: 'PNB', activeFdrs: 4150, exposure: '₹41.50 Cr', sharePercent: 27.9, rating: 'Scheduled Tier-1' },
    { bank: 'Canara Bank', code: 'CAN', activeFdrs: 2680, exposure: '₹26.80 Cr', sharePercent: 18.0, rating: 'Scheduled Tier-1' },
    { bank: 'Bank of Baroda', code: 'BOB', activeFdrs: 1780, exposure: '₹17.80 Cr', sharePercent: 12.0, rating: 'Scheduled Tier-1' },
    { bank: 'Union Bank of India', code: 'UBI', activeFdrs: 1090, exposure: '₹10.90 Cr', sharePercent: 7.6, rating: 'Scheduled Tier-1' }
  ];

  const handleExportRegionalSummary = () => {
    exportToCSV('AICTE_Regional_FDR_Custody_Summary.csv', regionData);
    showNotice('Regional Custody Ledger exported successfully.');
  };

  const handleExportBankExposure = () => {
    exportToCSV('AICTE_Bank_Exposure_Concentration.csv', bankData);
    showNotice('Bank Collateral Concentration report exported successfully.');
  };

  const handleExportMasterAuditReport = () => {
    if (fdrs && fdrs.length) {
      exportToCSV('AICTE_Master_Audited_FDR_Portfolio.csv', fdrs);
      showNotice('Full Audited Master Registry exported.');
    }
  };

  const showNotice = (msg) => {
    setExportSuccessMessage(msg);
    setTimeout(() => setExportSuccessMessage(null), 3500);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span>Statutory Financial Intelligence & Analytics Division</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Statutory Custody & Compliance Reports
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              FY {selectedFy}
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Audited aggregate statistics across 14,820 technical institution security deposits and regional jurisdictions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={selectedFy}
            onChange={(e) => setSelectedFy(e.target.value)}
            className="text-xs rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="2024-25">FY 2024-25 (Current)</option>
            <option value="2023-24">FY 2023-24</option>
            <option value="2022-23">FY 2022-23</option>
          </select>

          <button
            onClick={handleExportMasterAuditReport}
            className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-3.5 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Download Annual Dossier (CSV)</span>
          </button>
        </div>
      </div>

      {/* Export Toast */}
      {exportSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span>{exportSuccessMessage}</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">SUCCESS</span>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Total Custody Escrow</span>
            <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">₹148.50 Cr</span>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+6.2% from FY 2023-24</span>
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Active Liens Maintained</span>
            <span className="material-symbols-outlined text-teal-700 text-[20px]">verified</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">14,820</span>
            <p className="text-[11px] text-secondary mt-0.5">
              100% scheduled commercial banks
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Statutory Rollover Rate</span>
            <span className="material-symbols-outlined text-emerald-700 text-[20px]">autorenew</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">98.4%</span>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              Clause 14(B) compliant
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Deficiency / Scrutiny Rate</span>
            <span className="material-symbols-outlined text-amber-700 text-[20px]">assignment_late</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">1.6%</span>
            <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
              Under regional correction
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Regional Breakdown & Bank Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Distribution */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">public</span>
                <h2 className="text-sm font-bold text-on-surface">Regional Jurisdiction Breakdown</h2>
              </div>
              <button
                onClick={handleExportRegionalSummary}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Export</span>
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {regionData.map((reg) => (
                <div key={reg.code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">{reg.name}</span>
                    <span className="font-data-mono font-bold text-primary">{reg.valueFormatted} ({reg.share}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full transition-all duration-500"
                      style={{ width: `${reg.share * 2.5}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-secondary">
                    <span>{reg.count.toLocaleString()} Active Deposits</span>
                    <span className="text-emerald-700 font-medium">{reg.compliance} Compliant</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bank Exposure Analysis */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-[20px]">account_balance</span>
                <h2 className="text-sm font-bold text-on-surface">Scheduled Bank Collateral Exposure</h2>
              </div>
              <button
                onClick={handleExportBankExposure}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Export</span>
              </button>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-surface-container bg-surface-container-low/40 text-secondary uppercase font-label-sm text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 font-semibold">Bank Name</th>
                    <th className="py-2.5 px-3 font-semibold">Total Escrow</th>
                    <th className="py-2.5 px-3 font-semibold">Share (%)</th>
                    <th className="py-2.5 px-3 font-semibold">Active Liens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {bankData.map((b) => (
                    <tr key={b.code} className="hover:bg-surface-container-low/50">
                      <td className="py-3 px-3 font-semibold text-on-surface">
                        <div className="flex flex-col">
                          <span>{b.bank}</span>
                          <span className="text-[10px] text-secondary">{b.rating}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-data-mono font-bold text-primary">
                        {b.exposure}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-data-mono font-semibold text-on-surface">{b.sharePercent}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-surface-container overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${b.sharePercent * 2.5}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-data-mono text-secondary">
                        {b.activeFdrs.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 p-3 bg-surface-container-low rounded-xl border border-surface-container text-xs text-secondary flex items-center justify-between">
            <span>Finacle & SFMS automated lien ping integration active</span>
            <span className="font-bold text-teal-800">5 / 5 Gateways Synced</span>
          </div>
        </div>
      </div>

      {/* Statutory Export Center */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">folder_zip</span>
            <h2 className="text-sm font-bold text-on-surface">Official Statutory Data Export Center</h2>
          </div>
          <span className="text-xs text-secondary">Signed cryptographic hash included with every batch</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-surface-container bg-surface-container-low/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                <span>Master Registry Export</span>
              </div>
              <p className="text-[11px] text-secondary mt-1">
                Raw CSV dump of all active, maturing, and released FDR records with tripartite identifiers and lien status.
              </p>
            </div>
            <button
              onClick={handleExportMasterAuditReport}
              className="mt-3 w-full py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-container transition-colors shadow-xs"
            >
              Export CSV Ledger
            </button>
          </div>

          <div className="p-4 rounded-xl border border-surface-container bg-surface-container-low/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-teal-800 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">event_repeat</span>
                <span>Maturity Horizon Surveillance</span>
              </div>
              <p className="text-[11px] text-secondary mt-1">
                Categorized 30, 60, and 90-day upcoming maturities with statutory rollover notice dispatch history.
              </p>
            </div>
            <button
              onClick={() => {
                exportToCSV('AICTE_Maturity_Surveillance_Ledger.csv', fdrs.filter(f => f.status.includes('Maturing') || f.status.includes('Matured')));
                showNotice('Maturity Horizon surveillance exported.');
              }}
              className="mt-3 w-full py-2 bg-surface-container-lowest border border-surface-container text-on-surface text-xs font-semibold rounded-xl hover:bg-surface-container transition-colors shadow-xs"
            >
              Export Maturity List
            </button>
          </div>

          <div className="p-4 rounded-xl border border-surface-container bg-surface-container-low/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                <span>Statutory Compliance Certificate</span>
              </div>
              <p className="text-[11px] text-secondary mt-1">
                Official AICTE Financial Custody & Lien Certificate signed by Council Member Secretary for FY {selectedFy}.
              </p>
            </div>
            <button
              onClick={() => alert(`Generating Official AICTE Council Statutory Custody Summary PDF for FY ${selectedFy}...`)}
              className="mt-3 w-full py-2 bg-surface-container-lowest border border-surface-container text-on-surface text-xs font-semibold rounded-xl hover:bg-surface-container transition-colors shadow-xs"
            >
              Generate PDF Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
