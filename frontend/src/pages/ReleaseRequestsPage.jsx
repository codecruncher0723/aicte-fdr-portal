import React, { useState, useMemo } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { FDR_STATUSES, exportToCSV } from '../data/mockData';

export default function ReleaseRequestsPage({ fdrs, onUpdateFdrStatus }) {
  const { currentRole, currentUser } = useRole();
  const isInstitution = currentRole === ROLES.INSTITUTION_OFFICER;
  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY;
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER;

  // Active status filter tab
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isUploadVoucherModalOpen, setIsUploadVoucherModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [voucherFile, setVoucherFile] = useState(null);
  const [voucherRef, setVoucherRef] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  // New Request Form State
  const [newRequestFdr, setNewRequestFdr] = useState('');
  const [newRequestReason, setNewRequestReason] = useState('Closure of Academic Programme');
  const [newRequestNotes, setNewRequestNotes] = useState('');

  // Initial release requests combined from mock
  const [releaseRequests, setReleaseRequests] = useState([
    {
      id: 'rel_01',
      fdrId: 'fdr_10',
      fdrNumber: 'FDR-UBI-994411',
      institutionName: 'Amity Technical Campus',
      aictePid: '1-99881233',
      bank: 'Union Bank of India',
      amount: 10000000,
      amountFormatted: '₹1,00,00,000',
      requestType: 'Program Discontinuation',
      submittedDate: '2024-10-18',
      status: FDR_STATUSES.RELEASE_APPROVED,
      councilOrderRef: 'AICTE/FIN/REL/2024/918',
      approvalDate: '2024-11-05',
      confirmationVoucher: null,
      notes: 'Council Committee Order 918 ratified. Awaiting bank release confirmation voucher from institution.'
    },
    {
      id: 'rel_02',
      fdrId: 'fdr_08',
      fdrNumber: 'FDR-SBI-772091',
      institutionName: 'Vellore Educational Foundation',
      aictePid: '1-66554411',
      bank: 'State Bank of India',
      amount: 6000000,
      amountFormatted: '₹60,00,000',
      requestType: 'Excess Collateral Refund',
      submittedDate: '2024-11-02',
      status: FDR_STATUSES.RELEASE_REQUESTED,
      councilOrderRef: null,
      approvalDate: null,
      confirmationVoucher: null,
      notes: 'Autonomous status granted. Request submitted under Regulation 14(C) for surplus deposit return.'
    },
    {
      id: 'rel_03',
      fdrId: 'fdr_04',
      fdrNumber: 'FDR-CAN-551982',
      institutionName: 'K.R. College of Engineering',
      aictePid: '1-44556677',
      bank: 'Canara Bank',
      amount: 5000000,
      amountFormatted: '₹50,00,000',
      requestType: 'Surplus Reserve Release',
      submittedDate: '2024-09-14',
      status: FDR_STATUSES.RELEASED_REFUNDED,
      councilOrderRef: 'AICTE/FIN/REL/2024/842',
      approvalDate: '2024-10-01',
      confirmationVoucher: 'CANARA_REFUND_ADV_88192.pdf',
      notes: 'Released and refunded. Bank UTR transaction verified and ledger account closed.'
    }
  ]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return releaseRequests.filter(req => {
      // Role scope: Institution only sees own requests
      if (isInstitution && req.institutionName !== "St. Xavier's Engineering College" && req.institutionName !== 'Amity Technical Campus') {
        // Allow demonstration view
      }

      const matchesSearch =
        !searchTerm ||
        req.fdrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.institutionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.bank.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'requested') return req.status === FDR_STATUSES.RELEASE_REQUESTED;
      if (activeTab === 'approved') return req.status === FDR_STATUSES.RELEASE_APPROVED;
      if (activeTab === 'completed') return req.status === FDR_STATUSES.RELEASED_REFUNDED;

      return true;
    });
  }, [releaseRequests, searchTerm, activeTab, isInstitution]);

  // Actions
  const handleApproveRelease = (reqId) => {
    setReleaseRequests(prev =>
      prev.map(r => {
        if (r.id === reqId) {
          return {
            ...r,
            status: FDR_STATUSES.RELEASE_APPROVED,
            councilOrderRef: `AICTE/FIN/REL/2024/${Math.floor(1000 + Math.random() * 9000)}`,
            approvalDate: new Date().toISOString().split('T')[0],
            notes: 'Council executive approval granted. Awaiting bank release confirmation voucher.'
          };
        }
        return r;
      })
    );
    showNotice('Release Request APPROVED by Approving Authority. Case is now awaiting Bank Release Confirmation.');
  };

  const handleOpenVoucherModal = (req) => {
    setSelectedRequest(req);
    setIsUploadVoucherModalOpen(true);
  };

  const handleConfirmReleaseWithVoucher = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setReleaseRequests(prev =>
      prev.map(r => {
        if (r.id === selectedRequest.id) {
          return {
            ...r,
            status: FDR_STATUSES.RELEASED_REFUNDED,
            confirmationVoucher: voucherFile || 'BANK_RELEASE_CREDIT_ADVICE.pdf',
            confirmationRef: voucherRef || 'UTR-SBIN-2024-998122',
            notes: 'Official Bank Credit Advice and UTR verified. Security deposit formally marked RELEASED/REFUNDED.'
          };
        }
        return r;
      })
    );

    setIsUploadVoucherModalOpen(false);
    setSelectedRequest(null);
    showNotice('Release / Refund Confirmed! Status moved to RELEASED/REFUNDED and custody lien closed.');
  };

  const handleCreateReleaseRequest = (e) => {
    e.preventDefault();
    const newReq = {
      id: `rel_${Date.now()}`,
      fdrId: 'fdr_03',
      fdrNumber: newRequestFdr || 'FDR-BOB-910283',
      institutionName: "St. Xavier's Engineering College",
      aictePid: '1-10928374',
      bank: 'Bank of Baroda',
      amount: 5000000,
      amountFormatted: '₹50,00,000',
      requestType: newRequestReason,
      submittedDate: new Date().toISOString().split('T')[0],
      status: FDR_STATUSES.RELEASE_REQUESTED,
      councilOrderRef: null,
      approvalDate: null,
      confirmationVoucher: null,
      notes: newRequestNotes || 'Statutory 8-year mandatory custody term concluded without regulatory penalties.'
    };

    setReleaseRequests(prev => [newReq, ...prev]);
    setIsSubmitModalOpen(false);
    showNotice('Release Request submitted successfully. Queued for WRO Desk review.');
  };

  const showNotice = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleExportCSV = () => {
    exportToCSV('AICTE_FDR_Release_Requests.csv', releaseRequests);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">lock_open</span>
            <span>Financial Securities Release & Refund Protocol</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              FDR Release & Refund Requests
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              Statutory Two-Phase Workflow
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Council Approval is recorded as <strong className="text-teal-800">Release Approved</strong>; deposit is marked <strong className="text-emerald-700">Released/Refunded</strong> only upon bank confirmation voucher upload.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-4 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>Initiate Release Request</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">STATUS 200 OK</span>
        </div>
      )}

      {/* Workflow Rule Explainer Alert */}
      <div className="p-4 rounded-xl bg-teal-50 border border-teal-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-teal-950">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-teal-700 text-[20px] shrink-0 mt-0.5">verified_user</span>
          <div>
            <strong className="block font-semibold">Regulatory Clause 14(B) Two-Tier Safeguard:</strong>
            <span>
              1. <strong>Approval Phase:</strong> Approving Authority issues Council Release Sanction (Status: <code>RELEASE_APPROVED</code>).<br />
              2. <strong>Settlement Phase:</strong> Authorized Officer or Institution uploads bank disbursement credit voucher & UTR (Status: <code>RELEASED_REFUNDED</code>).
            </span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            All Requests ({releaseRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('requested')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'requested'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            Under Review ({releaseRequests.filter(r => r.status === FDR_STATUSES.RELEASE_REQUESTED).length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'approved'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            Awaiting Bank Voucher ({releaseRequests.filter(r => r.status === FDR_STATUSES.RELEASE_APPROVED).length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'completed'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            Fully Released ({releaseRequests.filter(r => r.status === FDR_STATUSES.RELEASED_REFUNDED).length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search FDR, Bank or Trust..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Release Requests Table / Cards */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/40 text-secondary uppercase font-label-sm text-[11px] tracking-wider">
                <th className="py-3 px-4 font-semibold">FDR / Request Ref</th>
                <th className="py-3 px-4 font-semibold">Institution & Trust</th>
                <th className="py-3 px-4 font-semibold">Issuing Bank</th>
                <th className="py-3 px-4 font-semibold">Principal Amount</th>
                <th className="py-3 px-4 font-semibold">Grounds for Release</th>
                <th className="py-3 px-4 font-semibold">Workflow Status</th>
                <th className="py-3 px-4 font-semibold text-right">Statutory Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {filteredRequests.map((req) => {
                const isApproved = req.status === FDR_STATUSES.RELEASE_APPROVED;
                const isCompleted = req.status === FDR_STATUSES.RELEASED_REFUNDED;
                const isPending = req.status === FDR_STATUSES.RELEASE_REQUESTED;

                return (
                  <tr key={req.id} className="hover:bg-surface-container-low/50 transition-colors">
                    {/* FDR / Request Ref */}
                    <td className="py-3.5 px-4 font-data-mono font-semibold text-on-surface">
                      <div className="flex flex-col">
                        <span className="text-primary font-bold">{req.fdrNumber}</span>
                        <span className="text-[11px] text-secondary font-normal">ID: {req.id}</span>
                      </div>
                    </td>

                    {/* Institution */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{req.institutionName}</span>
                        <span className="text-[11px] text-secondary font-data-mono">PID: {req.aictePid}</span>
                      </div>
                    </td>

                    {/* Bank */}
                    <td className="py-3.5 px-4 text-secondary">
                      {req.bank}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 font-data-mono font-bold text-on-surface">
                      {req.amountFormatted}
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 text-secondary">
                      <div className="flex flex-col">
                        <span className="text-on-surface font-medium">{req.requestType}</span>
                        <span className="text-[11px] text-secondary">Req Date: {req.submittedDate}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {isApproved && (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            <span>Release Approved</span>
                          </span>
                          <span className="text-[10px] text-secondary">Awaiting Voucher</span>
                        </div>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>Released/Refunded</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          <span>Review Pending</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isPending && (isApprover || !isInstitution) && (
                          <button
                            onClick={() => handleApproveRelease(req.id)}
                            className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                            <span>Approve Release</span>
                          </button>
                        )}

                        {isApproved && (
                          <button
                            onClick={() => handleOpenVoucherModal(req)}
                            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            <span>Upload Voucher</span>
                          </button>
                        )}

                        {isCompleted && (
                          <button
                            onClick={() => alert(`Release Voucher Ref: ${req.confirmationVoucher || 'UTR-882190'}\nOrder: ${req.councilOrderRef}`)}
                            className="px-2.5 py-1.5 rounded-xl border border-surface-container bg-surface-container-low text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[15px] text-teal-700">receipt_long</span>
                            <span>View Advice</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Upload Release Confirmation Voucher */}
      {isUploadVoucherModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Confirm Release & Upload Voucher
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-data-mono font-semibold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadVoucherModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmReleaseWithVoucher} className="p-6 space-y-4">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-900">
                Council Order Ref: <strong>{selectedRequest.councilOrderRef || 'AICTE/FIN/REL/2024/918'}</strong>. To finalize closure, upload the bank payment credit advice or UTR acknowledgment.
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Bank UTR / Transaction Reference Number <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={voucherRef}
                  onChange={(e) => setVoucherRef(e.target.value)}
                  placeholder="e.g., UTR-SBIN-2024-8849102"
                  required
                  className="w-full text-xs font-data-mono rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Upload Bank Credit Advice / Voucher Document (PDF) <span className="text-error">*</span>
                </label>
                <div className="border-2 border-dashed border-surface-container-high rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
                  <span className="material-symbols-outlined text-[28px] text-primary mb-1">upload_file</span>
                  <p className="text-xs font-semibold text-on-surface">
                    {voucherFile ? voucherFile : 'Select scanned bank confirmation voucher'}
                  </p>
                  <label className="mt-2 inline-block cursor-pointer px-3 py-1.5 bg-surface-container-high text-on-surface text-xs font-semibold rounded-lg hover:bg-surface-container-highest transition-colors">
                    Browse File
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setVoucherFile(e.target.files[0].name);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadVoucherModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Confirm Settlement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Initiate Release Request */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">lock_open</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Submit FDR Release / Refund Request
                  </h2>
                  <p className="text-xs text-secondary">
                    Clause 14(C) Security Deposit Redemption
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateReleaseRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Select Pledged FDR for Release <span className="text-error">*</span>
                </label>
                <select
                  value={newRequestFdr}
                  onChange={(e) => setNewRequestFdr(e.target.value)}
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="FDR-BOB-910283">FDR-BOB-910283 — ₹50,00,000 (Bank of Baroda)</option>
                  <option value="FDR-SBI-440192">FDR-SBI-440192 — ₹75,00,000 (State Bank of India)</option>
                  <option value="FDR-PNB-883921">FDR-PNB-883921 — ₹1,00,00,000 (Punjab National Bank)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Grounds for Release <span className="text-error">*</span>
                </label>
                <select
                  value={newRequestReason}
                  onChange={(e) => setNewRequestReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Closure of Academic Programme">Closure of Academic Programme</option>
                  <option value="Expiry of Statutory 8-Year Term">Expiry of Statutory 8-Year Term</option>
                  <option value="Transition to Autonomous Status">Transition to Autonomous Status</option>
                  <option value="Surplus Collateral Rationalization">Surplus Collateral Rationalization</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Justification & Trust Resolution Reference
                </label>
                <textarea
                  rows={3}
                  value={newRequestNotes}
                  onChange={(e) => setNewRequestNotes(e.target.value)}
                  placeholder="Detail governing council resolution, student no-dues clearance..."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest p-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
