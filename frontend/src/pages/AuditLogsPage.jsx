import React, { useState, useMemo } from 'react';
import { exportToCSV, AUDIT_LOGS } from '../data/mockData';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([
    ...AUDIT_LOGS,
    {
      id: 'log_06',
      timestamp: 'Today 12:10 PM',
      actor: 'Dr. Anand Deshmukh (SXEC Pune)',
      role: 'Institution Officer',
      action: 'FDR Document Upload',
      target: 'FDR-PNB-883921',
      details: 'Form L-1 bank mandate letter attached with Branch Manager physical endorsement stamp.',
      hash: 'sha256:7b1029e8...33d1'
    },
    {
      id: 'log_07',
      timestamp: '10 Nov 2024 16:45',
      actor: 'Prof. Rajive Kumar (Member Secretary)',
      role: 'Approving Authority',
      action: 'Executive Renewal Sanction',
      target: 'FDR-SBI-440192',
      details: 'Tripartite rollover approved for additional 3-year term per Regulation 14(B).',
      hash: 'sha256:1a84f32c...99a0'
    },
    {
      id: 'log_08',
      timestamp: '09 Nov 2024 11:20',
      actor: 'System Daemon (Finacle API)',
      role: 'System',
      action: 'Automated SFMS Lien Probe',
      target: 'FDR-BOB-910283',
      details: 'Periodic 90-day bank core banking lien confirmation poll returned STATUS_LIEN_HOLD.',
      hash: 'sha256:f49b21a8...44b2'
    }
  ]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [isLiveActive, setIsLiveActive] = useState(true);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        !search ||
        log.target.toLowerCase().includes(search.toLowerCase()) ||
        log.actor.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (roleFilter !== 'all' && log.role !== roleFilter) return false;

      if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;

      return true;
    });
  }, [logs, search, roleFilter, actionFilter]);

  const handleExportCSV = () => {
    exportToCSV('AICTE_Regulatory_Audit_Trail.csv', logs);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">policy</span>
            <span>Statutory Compliance & Forensic Audit Trail</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Tamper-Evident Regulatory Audit Logs
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              SHA-256 Ledger
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Every submission, scrutiny remark, executive approval, and lien query is cryptographically signed and stored immutably.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container text-xs">
            <span className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-emerald-500 animate-pulse' : 'bg-secondary'}`}></span>
            <span className="text-secondary font-medium">Live Stream:</span>
            <button
              onClick={() => setIsLiveActive(!isLiveActive)}
              className="text-primary font-bold hover:underline"
            >
              {isLiveActive ? 'Active' : 'Paused'}
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-3.5 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Export Audit Trail (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search FDR Ref, Officer, Action, or Hash..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Actor Roles</option>
            <option value="AICTE Admin">AICTE Admin</option>
            <option value="Verification Officer">Verification Officer</option>
            <option value="Institution Officer">Institution Officer</option>
            <option value="Approving Authority">Approving Authority</option>
            <option value="System">System Daemon</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Action Types</option>
            <option value="Lien">Lien Encashment & Probe</option>
            <option value="Discrepancy">Discrepancy & Scrutiny</option>
            <option value="Correction">Correction Resubmission</option>
            <option value="Release">Release Authorization</option>
            <option value="Notice">Statutory Demand Notice</option>
          </select>

          {(search || roleFilter !== 'all' || actionFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setRoleFilter('all');
                setActionFilter('all');
              }}
              className="text-xs text-secondary hover:text-on-surface px-2 py-1 font-semibold"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/40 text-secondary uppercase font-label-sm text-[11px] tracking-wider">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Actor & Role</th>
                <th className="py-3 px-4 font-semibold">Regulatory Action</th>
                <th className="py-3 px-4 font-semibold">Target FDR</th>
                <th className="py-3 px-4 font-semibold">Forensic Details</th>
                <th className="py-3 px-4 font-semibold">Cryptographic Hash</th>
                <th className="py-3 px-4 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {filteredLogs.map((log) => {
                return (
                  <tr key={log.id} className="hover:bg-surface-container-low/50 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-data-mono text-secondary whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{log.actor}</span>
                        <span className="text-[10px] text-primary font-medium">{log.role}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface-container text-on-surface text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                        <span>{log.action}</span>
                      </span>
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-4 font-data-mono font-bold text-primary">
                      {log.target}
                    </td>

                    {/* Details */}
                    <td className="py-3.5 px-4 text-secondary max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>

                    {/* Hash */}
                    <td className="py-3.5 px-4 font-data-mono text-[11px] text-teal-800 font-semibold">
                      {log.hash}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                        title="View Raw Forensic Block"
                      >
                        <span className="material-symbols-outlined text-[17px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">policy</span>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Immutable Audit Block
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-900 font-data-mono flex items-center justify-between">
                <span>Block ID: {selectedLog.id}</span>
                <span className="text-[11px] font-bold text-teal-700">VERIFIED VALID</span>
              </div>

              <div className="space-y-2 bg-surface-container-low p-4 rounded-xl border border-surface-container">
                <p><strong>Actor:</strong> {selectedLog.actor}</p>
                <p><strong>Role:</strong> {selectedLog.role}</p>
                <p><strong>Action:</strong> {selectedLog.action}</p>
                <p><strong>Target Ref:</strong> <span className="font-data-mono text-primary font-bold">{selectedLog.target}</span></p>
                <p><strong>Timestamp:</strong> {selectedLog.timestamp}</p>
                <p className="mt-2 text-secondary leading-relaxed"><strong>Forensic Payload:</strong> {selectedLog.details}</p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block mb-1">
                  SHA-256 Merkle Leaf Hash
                </span>
                <div className="p-2.5 rounded-xl bg-surface-container font-data-mono text-[11px] text-on-surface break-all">
                  {selectedLog.hash}99a0f44bc82d091e77
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
