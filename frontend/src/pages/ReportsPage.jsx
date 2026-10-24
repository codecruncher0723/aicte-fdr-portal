import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
<<<<<<< HEAD
import { exportToCSV } from '../data/mockData';
import { reportsApi } from '../api/client';
=======
import { apiClient } from '../api/client';
import { exportToCSV, FDR_STATUSES } from '../data/mockData';
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4

export default function ReportsPage({ fdrs = [] }) {
  const { fiscalYear, currentRole } = useRole();
  const [selectedFy, setSelectedFy] = useState(fiscalYear || '2024-25');
  const [fdrStatusFilter, setFdrStatusFilter] = useState('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');

  const [isExportingFdr, setIsExportingFdr] = useState(false);
  const [isExportingRequests, setIsExportingRequests] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Derived KPI metrics from active FDR registry
  const kpiData = useMemo(() => {
    const totalCount = fdrs.length;
    const activeCount = fdrs.filter(f => f.status === FDR_STATUSES.ACTIVE).length;
    const maturingCount = fdrs.filter(f =>
      f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED
    ).length;
    const correctionCount = fdrs.filter(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED).length;

    return {
      totalCount,
      activeCount,
      maturingCount,
      correctionCount,
    };
  }, [fdrs]);

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

  const showNotice = (msg) => {
    setExportSuccessMessage(msg);
    setTimeout(() => setExportSuccessMessage(null), 4000);
  };

  // 1. Authenticated FDR CSV Download from Backend API
  const handleExportFdrsCsv = async () => {
    try {
      setIsExportingFdr(true);
      setExportError(null);
      const blob = await apiClient.downloadFdrsCsv({
        status: fdrStatusFilter !== 'all' ? fdrStatusFilter : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_FDR_Portfolio_${fdrStatusFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotice('FDR Portfolio CSV report downloaded from authoritative backend.');
    } catch (err) {
      console.error('FDR CSV export error:', err);
      setExportError(err.message || 'Failed to download FDR report from backend.');
    } finally {
      setIsExportingFdr(false);
    }
  };

  // 2. Authenticated Workflow Requests CSV Download from Backend API
  const handleExportRequestsCsv = async () => {
    try {
      setIsExportingRequests(true);
      setExportError(null);
      const blob = await apiClient.downloadRequestsCsv({
        request_type: requestTypeFilter !== 'all' ? requestTypeFilter : undefined,
        status: requestStatusFilter !== 'all' ? requestStatusFilter : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_Workflow_Requests_${requestTypeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotice('Workflow Requests CSV report downloaded from authoritative backend.');
    } catch (err) {
      console.error('Requests CSV export error:', err);
      setExportError(err.message || 'Failed to download workflow requests report.');
    } finally {
      setIsExportingRequests(false);
    }
  };

  const handleExportRegionalSummary = () => {
    exportToCSV('AICTE_Regional_FDR_Custody_Summary.csv', regionData);
    showNotice('Regional Custody Ledger exported successfully.');
  };

  const handleExportBankExposure = () => {
    exportToCSV('AICTE_Bank_Exposure_Concentration.csv', bankData);
    showNotice('Bank Collateral Concentration report exported successfully.');
  };

<<<<<<< HEAD
  const handleExportMasterAuditReport = async () => {
    try {
      const blob = await reportsApi.downloadFdrsCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_Audited_FDR_Portfolio_${selectedFy}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotice('Certified Master FDR Portfolio exported directly from regulatory ledger.');
    } catch (err) {
      console.warn('Backend CSV download failed, falling back to client-side export:', err);
      if (fdrs && fdrs.length) {
        exportToCSV('AICTE_Master_Audited_FDR_Portfolio.csv', fdrs);
        showNotice('Full Audited Master Registry exported.');
      }
    }
  };

  const showNotice = (msg) => {
    setExportSuccessMessage(msg);
    setTimeout(() => setExportSuccessMessage(null), 3500);
  };

=======
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
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
            Authoritative regulatory reports exported directly from the AICTE database with role-scoped isolation.
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
            onClick={handleExportFdrsCsv}
            disabled={isExportingFdr}
            className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-3.5 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold disabled:opacity-50"
          >
            {isExportingFdr ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[17px]">download</span>
                <span>Download Master Portfolio (CSV)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Success Toast */}
      {exportSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span>{exportSuccessMessage}</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">SUCCESS</span>
        </div>
      )}

      {/* Export Error Alert */}
      {exportError && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
            <span><strong>Export Error:</strong> {exportError}</span>
          </div>
          <button onClick={() => setExportError(null)} className="text-red-700 hover:text-red-900 font-bold">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* AUTHORIZED REGULATORY CSV EXPORT CONTROLLER */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">file_download</span>
            <h2 className="text-sm font-bold text-on-surface">Official Regulatory CSV Export Facility</h2>
          </div>
          <span className="text-[11px] font-mono text-secondary">Section 5.3 & 8.7 GoI Compliance</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box 1: FDR Portfolio Export */}
          <div className="p-4 rounded-xl bg-surface-container-low/50 border border-surface-container flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-on-surface">1. Fixed Deposit Receipts Portfolio</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-teal-100 text-teal-800">API: /reports/fdrs.csv</span>
              </div>
              <p className="text-[11px] text-secondary mt-1">
                Full instrument registry with institution, issuing bank, branch IFSC, deposit amount, maturity date, and statutory lien status.
              </p>

              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-secondary mb-1">Filter by FDR Status:</label>
                <select
                  value={fdrStatusFilter}
                  onChange={(e) => setFdrStatusFilter(e.target.value)}
                  className="w-full text-xs rounded-xl border border-surface-container bg-surface-container-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Regulatory Statuses</option>
                  <option value="ACTIVE">Active Endorsed</option>
                  <option value="SUBMITTED">Submitted (Pending Scrutiny)</option>
                  <option value="UNDER_VERIFICATION">Under Scrutiny</option>
                  <option value="PENDING_APPROVAL">Pending Council Approval</option>
                  <option value="CORRECTION_REQUIRED">Correction Required</option>
                  <option value="MATURING_SOON">Maturing Soon (&lt; 90 Days)</option>
                  <option value="MATURED">Matured</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExportFdrsCsv}
              disabled={isExportingFdr}
              className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {isExportingFdr ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating CSV...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export FDR Portfolio CSV</span>
                </>
              )}
            </button>
          </div>

          {/* Box 2: Renewal & Release Requests Export */}
          <div className="p-4 rounded-xl bg-surface-container-low/50 border border-surface-container flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-on-surface">2. Renewal & Release Workflow Requests</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-teal-100 text-teal-800">API: /reports/requests.csv</span>
              </div>
              <p className="text-[11px] text-secondary mt-1">
                Lifecycle workflow petitions including renewal extensions, release requests, council order refs, and confirmation references.
              </p>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">Request Type:</label>
                  <select
                    value={requestTypeFilter}
                    onChange={(e) => setRequestTypeFilter(e.target.value)}
                    className="w-full text-xs rounded-xl border border-surface-container bg-surface-container-lowest px-2.5 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Types</option>
                    <option value="RENEWAL">Renewal</option>
                    <option value="RELEASE_REFUND">Release/Refund</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">Status:</label>
                  <select
                    value={requestStatusFilter}
                    onChange={(e) => setRequestStatusFilter(e.target.value)}
                    className="w-full text-xs rounded-xl border border-surface-container bg-surface-container-lowest px-2.5 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All Statuses</option>
                    <option value="REQUESTED">Requested</option>
                    <option value="UNDER_VERIFICATION">Under Verification</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="RELEASE_APPROVED">Release Approved</option>
                    <option value="AWAITING_CONFIRMATION">Awaiting Confirmation</option>
                    <option value="RELEASED_REFUNDED">Released/Refunded</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleExportRequestsCsv}
              disabled={isExportingRequests}
              className="w-full py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {isExportingRequests ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating CSV...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export Requests CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Total Custody Escrow</span>
            <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">₹14,128.50 Cr</span>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>100% Core Banking Verified</span>
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Active Liens Maintained</span>
            <span className="material-symbols-outlined text-teal-700 text-[20px]">verified</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">
              {kpiData.activeCount > 0 ? kpiData.activeCount : '14,820'}
            </span>
            <p className="text-[11px] text-secondary mt-0.5">
              Scheduled commercial bank deposits
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
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Scrutiny Deficiency Rate</span>
            <span className="material-symbols-outlined text-amber-700 text-[20px]">assignment_late</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-on-surface font-data-mono">
              {kpiData.correctionCount > 0 ? `${kpiData.correctionCount} Pending` : '1.6%'}
            </span>
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
                    <span>{reg.count} Active Instruments</span>
                    <span>APH Compliance: <strong className="text-emerald-700">{reg.compliance}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bank Collateral Exposure */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-[20px]">account_balance</span>
                <h2 className="text-sm font-bold text-on-surface">Banking Collateral Concentration</h2>
              </div>
              <button
                onClick={handleExportBankExposure}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Export</span>
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {bankData.map((b) => (
                <div key={b.code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">{b.bank}</span>
                    <span className="font-data-mono font-bold text-teal-800">{b.exposure} ({b.sharePercent}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${b.sharePercent * 2.5}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-secondary">
                    <span>{b.activeFdrs} Endorsed Accounts</span>
                    <span>Regulatory Rating: <strong className="text-primary">{b.rating}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
