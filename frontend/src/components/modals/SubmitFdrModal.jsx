import React, { useState } from 'react';
import { FDR_STATUSES } from '../../data/mockData';

export default function SubmitFdrModal({ isOpen, onClose, onSubmitSuccess }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    institutionName: "St. Xavier's Engineering College",
    aictePid: '1-10928374',
    region: 'wro',
    programme: 'UG Engineering',
    bank: 'Punjab National Bank',
    bankCode: 'pnb',
    branch: 'FC Road Branch, Pune',
    ifsc: 'PUNB0012900',
    fdrNumber: '',
    certNumber: '',
    amount: '',
    interestRate: '7.25% p.a.',
    tenureYears: '5',
    issueDate: '2024-11-20',
    maturityDate: '2029-11-20',
    mandateClause: 'Exclusive Statutory Lien under Reg 14(B)',
    jointAccountHolder: 'AICTE Member Secretary & St. Xavier Trust',
    fileName: null
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateStep1 = () => {
    const errs = {};
    if (!formData.fdrNumber.trim()) errs.fdrNumber = 'FDR Number is required';
    if (!formData.certNumber.trim()) errs.certNumber = 'Certificate Number is required';
    if (!formData.amount || Number(formData.amount) <= 0) errs.amount = 'Valid Deposit Amount is required';
    if (!formData.branch.trim()) errs.branch = 'Bank Branch is required';
    if (!formData.ifsc.trim()) errs.ifsc = 'IFSC Code is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!formData.issueDate) errs.issueDate = 'Issue Date required';
    if (!formData.maturityDate) errs.maturityDate = 'Maturity Date required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const newFdr = {
        id: `fdr_${Date.now()}`,
        fdrNumber: formData.fdrNumber.toUpperCase(),
        certNumber: formData.certNumber.toUpperCase(),
        tripartiteRef: `TPR-2024-${Math.floor(100 + Math.random() * 900)} / AICTE-WRO-1092`,
        institutionId: 'inst_01',
        institutionName: formData.institutionName,
        aictePid: formData.aictePid,
        region: formData.region,
        regionLabel: 'Western (WRO)',
        city: 'Pune',
        state: 'Maharashtra',
        sponsoringTrust: "St. Xavier's Technical Education Society",
        programme: formData.programme,
        courseDetails: 'New Program Approval • 4-Year B.Tech',
        bank: formData.bank,
        bankCode: formData.bankCode,
        branch: formData.branch,
        ifsc: formData.ifsc,
        solId: '1290',
        amount: Number(formData.amount),
        amountFormatted: `₹${(Number(formData.amount) / 100000).toLocaleString('en-IN')} Lakhs`,
        amountWords: 'Statutory Deposit under Reg 14(B)',
        interestRate: formData.interestRate,
        issueDate: formData.issueDate,
        maturityDate: formData.maturityDate,
        tenureYears: Number(formData.tenureYears),
        status: FDR_STATUSES.SUBMITTED,
        lienStatus: 'Lien Endorsed - Awaiting Scrutiny',
        mandateClause: formData.mandateClause,
        ocrConfidence: 'Simulated 99.4%',
        discrepancyNote: null,
        statutoryMinimum: Number(formData.amount),
        statutoryMetPercent: 100,
        autoRollover: true,
        lastAuditDate: new Date().toISOString().split('T')[0],
        notes: 'Submitted via Institutional FDR Portal. Ready for WRO Desk Scrutiny.'
      };

      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        if (onSubmitSuccess) onSubmitSuccess(newFdr);
        setIsSuccess(false);
        setStep(1);
        onClose();
      }, 1500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">account_balance</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-base font-bold text-on-surface">
                Statutory FDR Registration & Submission
              </h2>
              <p className="text-xs text-secondary">
                Clause 14(B) Security Deposit • Form D-1 Joint Tripartite Mandate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="px-6 py-3 bg-surface-container-low/20 border-b border-surface-container flex items-center justify-between text-xs">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary font-bold' : 'text-secondary'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}>
              1
            </span>
            <span>Bank & Deposit</span>
          </div>
          <span className="text-surface-container-highest">───</span>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary font-bold' : 'text-secondary'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}>
              2
            </span>
            <span>AICTE Mandate & Tenure</span>
          </div>
          <span className="text-surface-container-highest">───</span>
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary font-bold' : 'text-secondary'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}>
              3
            </span>
            <span>Documents & Submit</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <h3 className="font-headline-md text-lg font-bold text-on-surface">
                FDR Successfully Submitted!
              </h3>
              <p className="text-xs text-secondary max-w-sm mt-1">
                FDR <strong className="text-on-surface">{formData.fdrNumber}</strong> has been registered with status <strong className="text-teal-700">SUBMITTED</strong>. The record is now queued for WRO Verification Officer scrutiny.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* STEP 1: Bank & Deposit Details */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Issuing Scheduled Bank <span className="text-error">*</span>
                      </label>
                      <select
                        value={formData.bank}
                        onChange={(e) => {
                          const b = e.target.value;
                          let code = 'pnb';
                          if (b.includes('State Bank')) code = 'sbi';
                          if (b.includes('Baroda')) code = 'bob';
                          if (b.includes('Canara')) code = 'canara';
                          if (b.includes('Union')) code = 'ubi';
                          handleChange('bank', b);
                          handleChange('bankCode', code);
                        }}
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Punjab National Bank">Punjab National Bank</option>
                        <option value="State Bank of India">State Bank of India</option>
                        <option value="Bank of Baroda">Bank of Baroda</option>
                        <option value="Canara Bank">Canara Bank</option>
                        <option value="Union Bank of India">Union Bank of India</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Bank Branch Location <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.branch}
                        onChange={(e) => handleChange('branch', e.target.value)}
                        placeholder="e.g., FC Road Branch, Pune"
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {errors.branch && <span className="text-[11px] text-error">{errors.branch}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Bank IFSC Code <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ifsc}
                        onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase())}
                        placeholder="e.g., PUNB0012900"
                        className="w-full text-xs font-data-mono rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {errors.ifsc && <span className="text-[11px] text-error">{errors.ifsc}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        FDR / Term Deposit Number <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.fdrNumber}
                        onChange={(e) => handleChange('fdrNumber', e.target.value)}
                        placeholder="e.g., FDR-PNB-998822"
                        className="w-full text-xs font-data-mono rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {errors.fdrNumber && <span className="text-[11px] text-error">{errors.fdrNumber}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Certificate Folio Number <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.certNumber}
                        onChange={(e) => handleChange('certNumber', e.target.value)}
                        placeholder="e.g., PNB-TR-2024/991"
                        className="w-full text-xs font-data-mono rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {errors.certNumber && <span className="text-[11px] text-error">{errors.certNumber}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Deposit Principal Amount (₹) <span className="text-error">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => handleChange('amount', e.target.value)}
                        placeholder="e.g., 10000000 for ₹1 Crore"
                        className="w-full text-xs font-data-mono rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {errors.amount && <span className="text-[11px] text-error">{errors.amount}</span>}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">info</span>
                    <span>
                      Per APH Clause 14(B), the fixed deposit must be created in a Scheduled Commercial Bank in the joint names of the Sponsoring Trust and AICTE Member Secretary.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 2: AICTE Mandate & Tenure */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Academic Programme Attached
                      </label>
                      <select
                        value={formData.programme}
                        onChange={(e) => handleChange('programme', e.target.value)}
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="UG Engineering">UG Engineering (B.Tech / B.E.)</option>
                        <option value="PG Tech - AI">PG Technology (M.Tech)</option>
                        <option value="MCA & Computer Apps">MCA & Computer Applications</option>
                        <option value="Management (MBA)">Management (MBA)</option>
                        <option value="Pharmacy (B.Pharm)">Pharmacy (B.Pharm)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Tenure Duration (Years)
                      </label>
                      <select
                        value={formData.tenureYears}
                        onChange={(e) => handleChange('tenureYears', e.target.value)}
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="3">3 Years</option>
                        <option value="5">5 Years (Standard UG)</option>
                        <option value="8">8 Years (Initial Approval)</option>
                        <option value="10">10 Years</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Deposit Issue Date
                      </label>
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => handleChange('issueDate', e.target.value)}
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Deposit Maturity Date
                      </label>
                      <input
                        type="date"
                        value={formData.maturityDate}
                        onChange={(e) => handleChange('maturityDate', e.target.value)}
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Applicable Interest Rate
                      </label>
                      <input
                        type="text"
                        value={formData.interestRate}
                        onChange={(e) => handleChange('interestRate', e.target.value)}
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Joint Account Title
                      </label>
                      <input
                        type="text"
                        value={formData.jointAccountHolder}
                        readOnly
                        className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2.5 text-secondary cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container text-xs text-secondary">
                    <p className="font-semibold text-on-surface mb-1">Statutory Mandate Clause 14(B):</p>
                    <p className="italic">
                      "Under regulatory guidelines, the fixed deposit receipt cannot be encashed, pledged, or closed prematurely without the prior written consent and counter-signature of the Member Secretary, AICTE."
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: Documents & Submit */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-surface-container-high rounded-2xl p-6 text-center hover:border-primary/50 transition-colors bg-surface-container-low/30">
                    <span className="material-symbols-outlined text-[36px] text-primary mb-2">upload_file</span>
                    <h4 className="text-xs font-bold text-on-surface">Upload High-Resolution Scanned FDR Bond</h4>
                    <p className="text-[11px] text-secondary mt-1">
                      PDF, JPG or PNG up to 10MB • Auto-OCR cross-audit will parse serials and seals
                    </p>
                    <div className="mt-3 flex justify-center">
                      <label className="cursor-pointer px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-container transition-colors shadow-xs">
                        Browse Certificate File
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleChange('fileName', e.target.files[0].name);
                            }
                          }}
                        />
                      </label>
                    </div>
                    {formData.fileName && (
                      <div className="mt-2 text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Attached: {formData.fileName}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 text-xs text-secondary cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded text-primary focus:ring-primary" />
                      <span>I certify that this FDR has been executed in the joint name of AICTE and Sponsoring Trust per Form D-1.</span>
                    </label>
                    <label className="flex items-start gap-2.5 text-xs text-secondary cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 rounded text-primary focus:ring-primary" />
                      <span>Bank manager's official seal and signature have been physically endorsed per Form L-1.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-surface-container flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(s => s - 1)}
                    className="px-4 py-2 rounded-xl border border-surface-container bg-surface-container-lowest text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Back
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">send</span>
                          <span>Submit for Scrutiny</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
