import React, { useState, useMemo, useEffect } from 'react';
import { useRole } from '../context/RoleContext';
import { exportToCSV } from '../data/mockData';
import { institutionsApi } from '../api/client';

export default function InstitutionsPage({ fdrs }) {
  const { setActiveRoute, setSearchQuery } = useRole();

  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [selectedInst, setSelectedInst] = useState(null);

  const initialInstitutions = [
    {
      id: 'inst_01',
      name: "St. Xavier's Engineering College",
      aictePid: '1-10928374',
      region: 'wro',
      regionLabel: 'Western (WRO)',
      city: 'Pune',
      state: 'Maharashtra',
      address: 'Plot 44, Knowledge City, Shivajinagar, Pune 411005',
      sponsoringTrust: "St. Xavier's Technical Education Society",
      trustRegNumber: 'MAH/PUN/F-10294/1998',
      contactEmail: 'principal@sxec.edu.in',
      contactPhone: '+91-20-2567-9100',
      establishedYear: 2011,
      grade: 'Grade A',
      fdrCount: 3,
      totalCollateral: 22500000,
      totalCollateralFormatted: '₹2.25 Cr',
      complianceStatus: '1 Discrepancy Flagged',
      complianceTag: 'warning'
    },
    {
      id: 'inst_02',
      name: 'Amity Technical Campus',
      aictePid: '1-99881233',
      region: 'nro',
      regionLabel: 'Northern (NRO)',
      city: 'Noida',
      state: 'Uttar Pradesh',
      address: 'Sector 125, Expressway, Noida 201313',
      sponsoringTrust: 'Ritnand Balved Education Foundation',
      trustRegNumber: 'UP/GBN/RBEF-1994',
      contactEmail: 'registrar@amitytech.edu',
      contactPhone: '+91-120-439-2000',
      establishedYear: 2005,
      grade: 'Grade A+',
      fdrCount: 4,
      totalCollateral: 35000000,
      totalCollateralFormatted: '₹3.50 Cr',
      complianceStatus: '100% Compliant',
      complianceTag: 'success'
    },
    {
      id: 'inst_03',
      name: 'Vellore Educational Foundation',
      aictePid: '1-66554411',
      region: 'sro',
      regionLabel: 'Southern (SRO)',
      city: 'Vellore',
      state: 'Tamil Nadu',
      address: 'Katpadi Road, Vellore 632014',
      sponsoringTrust: 'North Arcot Educational Trust',
      trustRegNumber: 'TN/VEL/NAET-1984',
      contactEmail: 'director@vef.ac.in',
      contactPhone: '+91-416-220-2100',
      establishedYear: 1984,
      grade: 'Grade A',
      fdrCount: 2,
      totalCollateral: 15000000,
      totalCollateralFormatted: '₹1.50 Cr',
      complianceStatus: '1 Matured Overdue',
      complianceTag: 'error'
    },
    {
      id: 'inst_04',
      name: 'K.R. College of Engineering',
      aictePid: '1-44556677',
      region: 'sro',
      regionLabel: 'Southern (SRO)',
      city: 'Madurai',
      state: 'Tamil Nadu',
      address: 'NH-7 Bypass, Madurai 625008',
      sponsoringTrust: 'K.R. Educational Trust',
      trustRegNumber: 'TN/MDU/KRET-2002',
      contactEmail: 'dean@krce.ac.in',
      contactPhone: '+91-452-248-1120',
      establishedYear: 2002,
      grade: 'Grade A',
      fdrCount: 3,
      totalCollateral: 18000000,
      totalCollateralFormatted: '₹1.80 Cr',
      complianceStatus: '100% Compliant',
      complianceTag: 'success'
    },
    {
      id: 'inst_05',
      name: 'Aryabhatta Polytechnic Institute',
      aictePid: '1-77229014',
      region: 'nwro',
      regionLabel: 'North-Western (NWRO)',
      city: 'Rohtak',
      state: 'Haryana',
      address: 'Delhi Road, Sector 3, Rohtak 124001',
      sponsoringTrust: 'Aryabhatta Shiksha Sansthan',
      trustRegNumber: 'HAR/RTK/ASS-2018',
      contactEmail: 'admin@aryabhattapoly.org',
      contactPhone: '+91-1262-281-002',
      establishedYear: 2018,
      grade: 'Grade B+',
      fdrCount: 2,
      totalCollateral: 10000000,
      totalCollateralFormatted: '₹1.00 Cr',
      complianceStatus: 'Under Scrutiny',
      complianceTag: 'warning'
    },
    {
      id: 'inst_06',
      name: 'Modern Institute of Management Studies',
      aictePid: '1-23098811',
      region: 'cro',
      regionLabel: 'Central (CRO)',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      address: 'Hoshangabad Road, Bhopal 462026',
      sponsoringTrust: 'Modern Society for Higher Education',
      trustRegNumber: 'MP/BPL/MSHE-2014',
      contactEmail: 'director@mmsbhopal.edu.in',
      contactPhone: '+91-755-409-2211',
      establishedYear: 2014,
      grade: 'Grade A',
      fdrCount: 1,
      totalCollateral: 3500000,
      totalCollateralFormatted: '₹35 Lakhs',
      complianceStatus: 'Pending Council Sign-off',
      complianceTag: 'warning'
    },
    {
      id: 'inst_07',
      name: 'Heritage Institute of Technology',
      aictePid: '1-41092288',
      region: 'ero',
      regionLabel: 'Eastern (ERO)',
      city: 'Kolkata',
      state: 'West Bengal',
      address: 'Chowbaga Road, Anandapur, Kolkata 700107',
      sponsoringTrust: 'Heritage Technical Foundation',
      trustRegNumber: 'WB/KOL/HTF-2001',
      contactEmail: 'principal@heritageit.edu',
      contactPhone: '+91-33-2443-0454',
      establishedYear: 2001,
      grade: 'Grade A Regulatory',
      fdrCount: 5,
      totalCollateral: 45000000,
      totalCollateralFormatted: '₹4.50 Cr',
      complianceStatus: '100% Compliant',
      complianceTag: 'success'
    }
  ];

  const [institutions, setInstitutions] = useState(initialInstitutions);

  useEffect(() => {
    let isMounted = true;
    async function fetchInstitutions() {
      try {
        const liveList = await institutionsApi.list();
        if (isMounted && Array.isArray(liveList) && liveList.length > 0) {
          const mapped = liveList.map((inst, idx) => {
            const fallback = initialInstitutions.find(x => x.aictePid === inst.aicte_pid) || initialInstitutions[idx % initialInstitutions.length];
            return {
              ...fallback,
              id: inst.id || fallback.id,
              name: inst.name || fallback.name,
              aictePid: inst.aicte_pid || fallback.aictePid,
              region: (inst.region || fallback.region || 'wro').toLowerCase(),
              regionLabel: inst.region ? `${inst.region} Region` : fallback.regionLabel,
              city: inst.city || fallback.city,
              state: inst.state || fallback.state,
              sponsoringTrust: inst.sponsoring_trust || fallback.sponsoringTrust,
              complianceStatus: inst.status === 'ACTIVE' ? '100% Compliant' : (fallback.complianceStatus || 'Active'),
              complianceTag: inst.status === 'ACTIVE' ? 'success' : (fallback.complianceTag || 'success')
            };
          });
          setInstitutions(mapped);
        }
      } catch (err) {
        console.warn('Backend institutions list failed, using fixture set:', err);
      }
    }
    fetchInstitutions();
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return institutions.filter(inst => {
      const matchesSearch =
        !searchTerm ||
        inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.aictePid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.sponsoringTrust.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (regionFilter !== 'all' && inst.region !== regionFilter) return false;

      if (complianceFilter === 'compliant' && inst.complianceTag !== 'success') return false;
      if (complianceFilter === 'scrutiny' && inst.complianceTag !== 'warning') return false;
      if (complianceFilter === 'overdue' && inst.complianceTag !== 'error') return false;

      return true;
    });
  }, [initialInstitutions, searchTerm, regionFilter, complianceFilter]);

  const handleViewFdrs = (inst) => {
    setSearchQuery(inst.name);
    setActiveRoute('registry');
  };

  const handleExportCSV = () => {
    exportToCSV('AICTE_Technical_Institutions_Directory.csv', initialInstitutions);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">domain</span>
            <span>Technical Institutions Regulatory Directory</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Approved Institutions Directory
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              National Roster
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Browse and monitor permanent ID (PID) records, sponsoring trust details, and statutory security deposit standings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-surface-container-low rounded-xl p-1 border border-surface-container">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-secondary hover:text-on-surface'}`}
              title="Card Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-secondary hover:text-on-surface'}`}
              title="List Table View"
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Export Roster (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Institution Name, AICTE PID, City..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Regional Jurisdictions</option>
            <option value="wro">Western (WRO)</option>
            <option value="sro">Southern (SRO)</option>
            <option value="nro">Northern (NRO)</option>
            <option value="ero">Eastern (ERO)</option>
            <option value="nwro">North-Western (NWRO)</option>
            <option value="cro">Central (CRO)</option>
          </select>

          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Compliance Statuses</option>
            <option value="compliant">100% Compliant</option>
            <option value="scrutiny">Discrepancy / Scrutiny</option>
            <option value="overdue">Matured Overdue</option>
          </select>

          {(searchTerm || regionFilter !== 'all' || complianceFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setRegionFilter('all');
                setComplianceFilter('all');
              }}
              className="text-xs text-secondary hover:text-on-surface px-2 py-1 font-semibold"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((inst) => (
            <div
              key={inst.id}
              className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      {inst.regionLabel}
                    </span>
                    <h3 className="font-bold text-sm text-on-surface mt-0.5 line-clamp-1">
                      {inst.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant font-data-mono shrink-0">
                    {inst.grade}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-secondary">
                  <div className="flex items-center justify-between">
                    <span>AICTE PID:</span>
                    <span className="font-data-mono font-semibold text-on-surface">{inst.aictePid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Location:</span>
                    <span className="text-on-surface">{inst.city}, {inst.state}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sponsoring Trust:</span>
                    <span className="text-on-surface truncate max-w-[170px]" title={inst.sponsoringTrust}>
                      {inst.sponsoringTrust}
                    </span>
                  </div>
                </div>

                {/* Collateral Bar */}
                <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-secondary font-semibold block">
                      Total Pledged Collateral
                    </span>
                    <span className="font-data-mono font-bold text-sm text-primary">
                      {inst.totalCollateralFormatted}
                    </span>
                  </div>
                  <span className="text-xs text-secondary font-medium font-data-mono">
                    {inst.fdrCount} FDRs
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedInst(inst)}
                  className="px-3 py-1.5 rounded-xl border border-surface-container bg-surface-container-low text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">info</span>
                  <span>Trust Details</span>
                </button>

                <button
                  onClick={() => handleViewFdrs(inst)}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">account_balance</span>
                  <span>View FDRs</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low/40 text-secondary uppercase font-label-sm text-[11px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">AICTE PID</th>
                  <th className="py-3 px-4 font-semibold">Institution Name</th>
                  <th className="py-3 px-4 font-semibold">Region & City</th>
                  <th className="py-3 px-4 font-semibold">Sponsoring Trust</th>
                  <th className="py-3 px-4 font-semibold">Pledged Collateral</th>
                  <th className="py-3 px-4 font-semibold">Standing</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map((inst) => (
                  <tr key={inst.id} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-4 font-data-mono font-bold text-primary">
                      {inst.aictePid}
                    </td>
                    <td className="py-3 px-4 font-semibold text-on-surface">
                      {inst.name}
                    </td>
                    <td className="py-3 px-4 text-secondary">
                      {inst.regionLabel} • {inst.city}
                    </td>
                    <td className="py-3 px-4 text-secondary truncate max-w-xs">
                      {inst.sponsoringTrust}
                    </td>
                    <td className="py-3 px-4 font-data-mono font-bold text-on-surface">
                      {inst.totalCollateralFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        inst.complianceTag === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : inst.complianceTag === 'warning'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        <span>{inst.complianceStatus}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInst(inst)}
                          className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                          title="View Trust Details"
                        >
                          <span className="material-symbols-outlined text-[17px]">info</span>
                        </button>
                        <button
                          onClick={() => handleViewFdrs(inst)}
                          className="px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-semibold hover:bg-teal-100 transition-colors"
                        >
                          FDRs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Institution Details Drawer / Modal */}
      {selectedInst && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  {selectedInst.name}
                </h2>
                <p className="text-xs text-secondary font-data-mono">
                  Permanent AICTE PID: {selectedInst.aictePid}
                </p>
              </div>
              <button
                onClick={() => setSelectedInst(null)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3.5 rounded-xl border border-surface-container">
                <div>
                  <span className="text-secondary block">Accreditation Grade</span>
                  <span className="font-bold text-on-surface">{selectedInst.grade}</span>
                </div>
                <div>
                  <span className="text-secondary block">Established Year</span>
                  <span className="font-bold text-on-surface">{selectedInst.establishedYear}</span>
                </div>
                <div>
                  <span className="text-secondary block">Total FDR Collateral</span>
                  <span className="font-bold text-primary font-data-mono">{selectedInst.totalCollateralFormatted}</span>
                </div>
                <div>
                  <span className="text-secondary block">Active Certificates</span>
                  <span className="font-bold text-on-surface font-data-mono">{selectedInst.fdrCount} Pledged</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[11px] block">
                  Trust & Regulatory Registration
                </span>
                <div className="p-3 bg-surface-container-low/50 rounded-xl border border-surface-container space-y-1.5">
                  <p><strong>Sponsoring Trust:</strong> {selectedInst.sponsoringTrust}</p>
                  <p><strong>Registration Number:</strong> <span className="font-data-mono">{selectedInst.trustRegNumber}</span></p>
                  <p><strong>Registered Address:</strong> {selectedInst.address}</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[11px] block">
                  Designated Officer Contact
                </span>
                <div className="p-3 bg-surface-container-low/50 rounded-xl border border-surface-container space-y-1.5">
                  <p><strong>Official Email:</strong> {selectedInst.contactEmail}</p>
                  <p><strong>Desk Telephone:</strong> {selectedInst.contactPhone}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedInst(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const inst = selectedInst;
                    setSelectedInst(null);
                    handleViewFdrs(inst);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs"
                >
                  Inspect FDR Portfolio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
