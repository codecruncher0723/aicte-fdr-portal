import React, { useState } from 'react';
import { STATUTORY_TEMPLATES } from '../data/mockData';

export default function HelpManualsPage() {
  const [downloadNotice, setDownloadNotice] = useState(null);

  const handleDownloadTemplate = (tmpl) => {
    setDownloadNotice(`Simulating download of ${tmpl.code} (${tmpl.title})...`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const faqs = [
    {
      q: 'Why does AICTE mandate FDRs in joint name rather than sole custody?',
      a: 'Per APH Regulation 14(B), fixed deposits serve as statutory security deposits to ensure financial viability and student welfare. Joint name with Member Secretary / Regional Officer prevents unauthorized liquidation without council consent.'
    },
    {
      q: 'What is the required wording for the bank mandate letter (Form L-1)?',
      a: 'The branch manager must explicitly certify that the deposit has an irrevocable AICTE lien, auto-rollover is enabled, and no loan, overdraft, or lien release can occur without written council authorization.'
    },
    {
      q: 'How does the renewal workflow function when an FDR approaches maturity?',
      a: 'At 90, 60, and 30 days before maturity, automated demand notices (Form D-3) are dispatched. The institution officer must submit the renewed term deposit receipt, which is then verified by the WRO desk and ratified by the Approving Authority.'
    },
    {
      q: 'What is the difference between "Release Approved" and "Released/Refunded"?',
      a: 'Approval is an executive decision by the Council granting permission to release. The FDR only moves to "Released/Refunded" after the bank confirmation voucher / UTR credit advice has been uploaded and verified.'
    }
  ];

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>Approval Process Handbook (APH) Statutory Repository</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              APH Guidelines & Official Form Templates
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              Statutory Chapter 14(B)
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Official legal documentation, bank mandate templates, and procedural workflows for Technical Education Security Deposits.
          </p>
        </div>

        <button
          onClick={() => handleDownloadTemplate({ code: 'APH_Complete_2024_25.pdf', title: 'Complete Approval Process Handbook' })}
          className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-4 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold self-start lg:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">download</span>
          <span>Download Complete APH 2024-25</span>
        </button>
      </div>

      {/* Download Alert */}
      {downloadNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">download_done</span>
            <span>{downloadNotice}</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">DOWNLOADING</span>
        </div>
      )}

      {/* Statutory Templates Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">
            Official AICTE Prescribed Formats & Templates
          </h2>
          <span className="text-xs text-secondary">Click to download statutory formats</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUTORY_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200 font-data-mono">
                    {tmpl.code}
                  </span>
                  <span className="text-[11px] text-secondary font-medium font-data-mono">
                    {tmpl.fileType} • {tmpl.size}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-on-surface mt-3">
                  {tmpl.title}
                </h3>
                <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <button
                onClick={() => handleDownloadTemplate(tmpl)}
                className="mt-4 w-full py-2 bg-surface-container-low border border-surface-container text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Download Template</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle & Policy Summary Card */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
          <span className="material-symbols-outlined text-primary text-[22px]">account_tree</span>
          <h2 className="text-sm font-bold text-on-surface">Standard FDR Regulatory Lifecycle Workflow</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container">
            <span className="font-bold text-primary block mb-1">1. Joint Execution</span>
            <p className="text-secondary leading-relaxed">
              Institution executes FDR at Scheduled Commercial Bank in joint name of Trust & AICTE Regional Officer under Clause 14(B).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container">
            <span className="font-bold text-primary block mb-1">2. WRO Desk Scrutiny</span>
            <p className="text-secondary leading-relaxed">
              Verification Officer performs 3-way telemetry cross-audit (Institution Entry vs OCR parse vs Finacle API). Discrepancies returned for Form L-1 correction.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container">
            <span className="font-bold text-primary block mb-1">3. Council Endorsement</span>
            <p className="text-secondary leading-relaxed">
              Approving Authority reviews verified dossier and ratifies statutory lien, moving FDR into active custody tracking.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container">
            <span className="font-bold text-primary block mb-1">4. Rollover or Release</span>
            <p className="text-secondary leading-relaxed">
              Auto-rollover triggered at maturity or release authorized after academic programme closure and confirmation voucher upload.
            </p>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
          <span className="material-symbols-outlined text-teal-700 text-[20px]">help</span>
          <h2 className="text-sm font-bold text-on-surface">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-surface-container-low/50 border border-surface-container text-xs">
              <strong className="block font-semibold text-on-surface mb-1">{faq.q}</strong>
              <p className="text-secondary leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
