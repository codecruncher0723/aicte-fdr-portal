import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { FDR_STATUSES, exportToCSV } from '../data/mockData';

export default function MasterRegistry({ fdrs, onSelectFdr, onOpenSubmitModal }) {
  const { setActiveRoute, setSelectedFdrRef, searchQuery, setSearchQuery } = useRole();

  const [regionFilter, setRegionFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('amount_desc');
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  // Active filter count and removal
  const activeFilters = useMemo(() => {
    const list = [];
    if (regionFilter !== 'all') list.push({ key: 'region', label: `Region: ${regionFilter.toUpperCase()}` });
    if (bankFilter !== 'all') list.push({ key: 'bank', label: `Bank: ${bankFilter.toUpperCase()}` });
    if (statusFilter !== 'all') list.push({ key: 'status', label: `Status: ${statusFilter}` });
    if (searchQuery) list.push({ key: 'search', label: `Search: "${searchQuery}"` });
    return list;
  }, [regionFilter, bankFilter, statusFilter, searchQuery]);

  const removeFilter = (key) => {
    if (key === 'region') setRegionFilter('all');
    if (key === 'bank') setBankFilter('all');
    if (key === 'status') setStatusFilter('all');
    if (key === 'search') setSearchQuery('');
  };

  const resetAllFilters = () => {
    setRegionFilter('all');
    setBankFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Filtered & Sorted Records
  const filteredFdrs = useMemo(() => {
    return fdrs
      .filter(fdr => {
        const matchesSearch =
          !searchQuery ||
          fdr.fdrNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          fdr.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          fdr.aictePid.toLowerCase().includes(searchQuery.toLowerCase()) ||
          fdr.bank.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRegion = regionFilter === 'all' || fdr.region === regionFilter;
        const matchesBank = bankFilter === 'all' || fdr.bankCode === bankFilter;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && fdr.status === FDR_STATUSES.ACTIVE) ||
          (statusFilter === 'pending' && (fdr.status === FDR_STATUSES.SUBMITTED || fdr.status === FDR_STATUSES.UNDER_VERIFICATION)) ||
          (statusFilter === 'scrutiny' && fdr.status === FDR_STATUSES.CORRECTION_REQUIRED) ||
          (statusFilter === 'renewal' && (fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED)) ||
          (statusFilter === 'release' && (fdr.status === FDR_STATUSES.RELEASE_REQUESTED || fdr.status === FDR_STATUSES.RELEASE_APPROVED));

        return matchesSearch && matchesRegion && matchesBank && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'amount_desc') return b.amount - a.amount;
        if (sortBy === 'amount_asc') return a.amount - b.amount;
        if (sortBy === 'maturity_asc') return new Date(a.maturityDate) - new Date(b.maturityDate);
        if (sortBy === 'name_asc') return a.institutionName.localeCompare(b.institutionName);
        return 0;
      });
  }, [fdrs, searchQuery, regionFilter, bankFilter, statusFilter, sortBy]);

  // Pagination calculation
  const totalRecords = filteredFdrs.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const paginatedFdrs = filteredFdrs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedFdrs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedFdrs.map(f => f.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleExportCSV = () => {
    const exportRows = filteredFdrs.map(f => ({
      'FDR Number': f.fdrNumber,
      'Institution Name': f.institutionName,
      'AICTE PID': f.aictePid,
      'Region': f.regionLabel,
      'Bank': f.bank,
      'Branch': f.branch,
      'IFSC': f.ifsc,
      'Deposit Amount (INR)': f.amount,
      'Issue Date': f.issueDate,
      'Maturity Date': f.maturityDate,
      'Interest Rate': f.interestRate,
      'Status': f.status,
      'Lien Mandate': f.lienStatus
    }));
    exportToCSV('aicte_fdr_master_registry.csv', exportRows);
  };

  const handleView = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
    setActiveRoute('verification_audit');
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 font-label-sm text-xs text-secondary">
          <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setActiveRoute('dashboard')}>
            Central Regulatory Financial Custody Division
          </span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-medium">Institutional Security Deposits</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-semibold">FDR Registry</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="font-headline-xl text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              FDR Master Statutory Registry
            </h1>
            <p className="font-body-md text-xs text-secondary mt-0.5">
              Official repository of all Fixed Deposit Receipts pledged to AICTE under statutory tripartite lien mandates.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-xs shadow-sm border border-surface-container-high hover:bg-surface-container transition-colors font-semibold"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px] text-secondary">file_download</span>
              <span>Export Registry</span>
              <span className="text-[10px] text-secondary bg-surface-container px-1 py-0.2 rounded font-mono font-semibold">
                CSV
              </span>
            </button>
            <button
              onClick={onOpenSubmitModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-md text-xs shadow-sm hover:bg-primary-container transition-colors font-semibold"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              <span>Add Pledged FDR</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-[11px] text-secondary uppercase tracking-wider font-semibold block">
                Total Registered FDRs
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-on-surface">14,820</span>
                <span className="font-label-sm text-xs text-primary font-medium">Instruments</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center border border-surface-container">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="mt-4 pt-2 flex items-center justify-between text-secondary font-label-sm text-xs border-t border-surface-container-low">
            <span>Total Pledged Collateral</span>
            <span className="font-data-mono font-bold text-on-surface">₹4,128.50 Cr</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-[11px] text-secondary uppercase tracking-wider font-semibold block">
                Active Tripartite Liens
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-on-surface">12,945</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  87.4% Met
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center border border-surface-container">
              <span className="material-symbols-outlined text-[20px]">gavel</span>
            </div>
          </div>
          <div className="mt-4 pt-2 flex items-center justify-between text-secondary font-label-sm text-xs border-t border-surface-container-low">
            <span>Legal Mandate Status</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Statutory Compliant
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-[11px] text-secondary uppercase tracking-wider font-semibold block">
                Lien Endorsement Queue
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-on-surface">164</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-fixed text-on-tertiary-fixed">
                  Immediate Action
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-tertiary flex items-center justify-center border border-surface-container">
              <span className="material-symbols-outlined text-[20px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-4 pt-2 flex items-center justify-between text-secondary font-label-sm text-xs border-t border-surface-container-low">
            <span>Awaiting Joint Attestation</span>
            <span className="font-data-mono font-semibold text-tertiary">14 High Risk</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-[11px] text-secondary uppercase tracking-wider font-semibold block">
                Maturing in Q3 (Current)
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-on-surface">418</span>
                <span className="font-label-sm text-xs text-error font-semibold">Instruments</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-secondary flex items-center justify-center border border-surface-container">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
            </div>
          </div>
          <div className="mt-4 pt-2 flex items-center justify-between text-secondary font-label-sm text-xs border-t border-surface-container-low">
            <span>Expiring Collateral Vol</span>
            <span className="font-data-mono font-bold text-on-surface">₹142.80 Cr</span>
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Console Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 lg:p-5 border border-surface-container shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by FDR number, institution, or bank..."
              className="w-full h-9 pl-9 pr-14 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-container rounded font-data-mono text-[10px] text-secondary">
              <span>⌘K</span>
            </div>
          </div>

          {/* Region Filter */}
          <div className="lg:col-span-2">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full h-9 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
            >
              <option value="all">All AICTE Regions</option>
              <option value="wro">Western (WRO)</option>
              <option value="nwro">North-West (NWRO)</option>
              <option value="sro">Southern (SRO)</option>
              <option value="cro">Central (CRO)</option>
              <option value="ero">Eastern (ERO)</option>
              <option value="nro">Northern (NRO)</option>
            </select>
          </div>

          {/* Bank Filter */}
          <div className="lg:col-span-2">
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="w-full h-9 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
            >
              <option value="all">All Pledged Banks</option>
              <option value="sbi">State Bank of India</option>
              <option value="pnb">Punjab National Bank</option>
              <option value="bob">Bank of Baroda</option>
              <option value="canara">Canara Bank</option>
              <option value="union">Union Bank of India</option>
              <option value="hdfc">HDFC Bank Ltd</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
            >
              <option value="all">Verification Status (All)</option>
              <option value="active">Active & Lien Endorsed</option>
              <option value="pending">Bank Confirmation Pending</option>
              <option value="scrutiny">Correction Required / Scrutiny</option>
              <option value="renewal">Renewal Overdue / Maturing</option>
              <option value="release">Release / Refund Authorized</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Bar with Active Filter Chips & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-surface-container-low text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-label-sm text-[11px] text-secondary font-semibold mr-1">Active Filters:</span>
            {activeFilters.length === 0 ? (
              <span className="text-[11px] text-secondary italic">None (Displaying all records)</span>
            ) : (
              activeFilters.map(filter => (
                <span
                  key={filter.key}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-semibold"
                >
                  <span>{filter.label}</span>
                  <button onClick={() => removeFilter(filter.key)} className="hover:text-error ml-0.5">
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </span>
              ))
            )}
            {activeFilters.length > 0 && (
              <button
                onClick={resetAllFilters}
                className="font-label-sm text-primary hover:underline ml-2 font-semibold text-[11px]"
                type="button"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            <div className="flex items-center gap-1 text-secondary text-xs">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-semibold text-on-surface focus:outline-none cursor-pointer"
              >
                <option value="amount_desc">Highest Amount (₹)</option>
                <option value="amount_asc">Lowest Amount (₹)</option>
                <option value="maturity_asc">Upcoming Maturity</option>
                <option value="name_asc">Institution Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Registry Table Card */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1100px] text-xs">
            <thead>
              <tr className="bg-surface-container-low h-10 text-secondary font-label-sm text-[11px] tracking-wider uppercase border-b border-surface-container font-bold">
                <th className="py-2.5 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={paginatedFdrs.length > 0 && selectedIds.length === paginatedFdrs.length}
                    onChange={toggleSelectAll}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3">FDR & Tripartite Ref</th>
                <th className="py-2.5 px-3">Institution & AICTE PID</th>
                <th className="py-2.5 px-3">Pledged Bank & Branch</th>
                <th className="py-2.5 px-3 text-right">Pledged Amount</th>
                <th className="py-2.5 px-3">Issue Date</th>
                <th className="py-2.5 px-3">Maturity Date</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 pr-4 pl-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-on-surface">
              {paginatedFdrs.map((fdr) => {
                const isSelected = selectedIds.includes(fdr.id);
                return (
                  <tr
                    key={fdr.id}
                    className={`hover:bg-surface-container-low/60 transition-colors ${
                      isSelected ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(fdr.id)}
                        className="rounded accent-primary w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 font-label-md text-xs text-primary font-bold">
                        <span>{fdr.fdrNumber}</span>
                      </div>
                      <div className="font-data-mono text-[11px] text-secondary mt-0.5">
                        Tripartite: <span className="text-on-surface font-semibold">{fdr.tripartiteRef.split(' / ')[0]}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-semibold text-on-surface truncate" title={fdr.institutionName}>
                        {fdr.institutionName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-secondary mt-0.5">
                        <span className="font-data-mono bg-surface-container px-1 py-0.2 rounded text-[10px] font-medium">
                          PID: {fdr.aictePid}
                        </span>
                        <span>•</span>
                        <span className="truncate">{fdr.city}, {fdr.state}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-on-surface">{fdr.bank}</div>
                      <div className="font-data-mono text-[11px] text-secondary mt-0.5">
                        {fdr.branch.split(',')[0]} <span className="text-outline">({fdr.ifsc})</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-headline-sm text-[13px] text-on-surface font-bold font-data-mono">
                        {fdr.amountFormatted}
                      </div>
                      <div className="font-data-mono text-[10px] text-secondary">{fdr.interestRate}</div>
                    </td>
                    <td className="py-3 px-3 font-data-mono text-[11px] text-secondary">
                      {fdr.issueDate}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-data-mono text-[11px] text-on-surface font-bold">{fdr.maturityDate}</div>
                      <div className="font-label-sm text-[10px] text-primary mt-0.5">{fdr.tenureYears}-Yr Security</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-[10px] font-bold ${
                          fdr.status === FDR_STATUSES.ACTIVE
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : fdr.status === FDR_STATUSES.CORRECTION_REQUIRED
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : fdr.status === FDR_STATUSES.RELEASE_APPROVED
                            ? 'bg-sky-50 text-sky-800 border border-sky-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {fdr.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 pl-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleView(fdr)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary transition-colors text-xs font-bold"
                          type="button"
                          title="Inspect Tripartite Cross-Audit"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Comprehensive Pagination Controls */}
        <div className="px-4 lg:px-6 py-3 bg-surface-container-lowest flex flex-col md:flex-row items-center justify-between gap-3 border-t border-surface-container text-xs text-secondary">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-on-surface font-semibold">{paginatedFdrs.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}–{Math.min(currentPage * rowsPerPage, totalRecords)}</strong> of <strong className="text-on-surface font-semibold">{totalRecords}</strong> records
            </span>
            <span className="h-4 w-px bg-surface-container"></span>
            <div className="flex items-center gap-1.5">
              <label htmlFor="rowsPerPage" className="font-label-sm">Rows:</label>
              <select
                id="rowsPerPage"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-surface-container-low text-on-surface rounded-lg border border-surface-container px-2 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg border border-surface-container text-secondary hover:bg-surface-container disabled:opacity-40 transition-colors font-medium"
            >
              <span className="material-symbols-outlined text-[15px]">chevron_left</span>
              <span>Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                  currentPage === page
                    ? 'bg-primary text-on-primary'
                    : 'hover:bg-surface-container text-on-surface border border-surface-container'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg border border-surface-container text-secondary hover:bg-surface-container disabled:opacity-40 transition-colors font-medium"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Regulation Strip */}
      <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">security_update_good</span>
          </div>
          <div>
            <span className="font-label-md text-on-surface font-bold block">Statutory Auto-Rollover Regulation</span>
            <span className="text-secondary">
              Under AICTE Approval Process Handbook (APH), non-renewed collateral automatically triggers an electronic lien encashment notice to the designated nodal bank at 15 days pre-maturity.
            </span>
          </div>
        </div>
        <button
          onClick={() => setActiveRoute('help_manuals')}
          className="font-label-md text-primary hover:underline font-bold flex items-center gap-0.5 shrink-0"
        >
          <span>Tripartite Guidelines</span>
          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
        </button>
      </div>
    </div>
  );
}
