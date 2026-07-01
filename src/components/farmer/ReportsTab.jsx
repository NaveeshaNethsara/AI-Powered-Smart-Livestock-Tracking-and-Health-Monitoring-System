// ReportsTab.jsx — FR-F42 to FR-F46
// Daily, weekly, monthly reports, health trends, PDF export
import React, { useState, useMemo } from 'react';
import { FileText, Download, TrendingUp, Calendar, BarChart2, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function ReportsTab({ animals, alerts, latestReadings, latestAI }) {

  const [reportType, setReportType]   = useState('daily');   // daily, weekly, monthly
  const [generating, setGenerating]   = useState(false);
  const [generated, setGenerated]     = useState(false);

  // ── Aggregate data for report ──────────────────────────────
  const reportData = useMemo(() => {
    const now = new Date();
    const dayMs   = 86400000;
    const cutoffs = { daily: dayMs, weekly: 7 * dayMs, monthly: 30 * dayMs };
    const cutoff  = now.getTime() - cutoffs[reportType];

    const relevantAlerts = alerts.filter(a => {
      const ts = a.triggeredAt?.toDate ? a.triggeredAt.toDate() : new Date(a.triggeredAt);
      return ts.getTime() >= cutoff;
    });

    const avgTemp = animals.length > 0
      ? (animals.reduce((acc, a) => acc + (latestReadings[a.docId]?.bodyTemperature || 0), 0) / animals.length).toFixed(1)
      : 0;

    const avgScore = animals.length > 0
      ? Math.round(animals.reduce((acc, a) => acc + (latestAI[a.docId]?.healthScore || a.currentHealthScore || 0), 0) / animals.length)
      : 0;

    const healthyCount  = animals.filter(a => a.healthStatus === 'healthy').length;
    const atRiskCount   = animals.filter(a => a.healthStatus === 'at_risk').length;
    const criticalCount = animals.filter(a => a.healthStatus === 'critical').length;

    const alertsByType = relevantAlerts.reduce((acc, a) => {
      acc[a.alertType] = (acc[a.alertType] || 0) + 1;
      return acc;
    }, {});

    return { avgTemp, avgScore, healthyCount, atRiskCount, criticalCount, relevantAlerts, alertsByType, totalAlerts: relevantAlerts.length };
  }, [reportType, animals, alerts, latestReadings, latestAI]);

  // ── FR-F46: Generate & Export PDF ────────────────────────
  const exportPDF = () => {
    setGenerating(true);
    const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const now   = new Date().toLocaleString();
    const title = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Health Report`;

    // Header block
    pdf.setFillColor(6, 9, 19);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setTextColor(16, 185, 129);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('LIVETRACK AI', 15, 18);
    pdf.setFontSize(12);
    pdf.setTextColor(180, 180, 200);
    pdf.text('AI-Powered Smart Livestock Tracking & Health Monitoring', 15, 27);
    pdf.setFontSize(9);
    pdf.text(`Generated: ${now}`, 15, 35);

    // Title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 15, 55);

    // Divider
    pdf.setDrawColor(16, 185, 129);
    pdf.setLineWidth(0.5);
    pdf.line(15, 59, 195, 59);

    // Summary section
    pdf.setFontSize(12);
    pdf.setTextColor(16, 185, 129);
    pdf.text('HERD SUMMARY', 15, 70);
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 80);

    const summaryRows = [
      ['Total Animals Monitored', animals.length.toString()],
      ['Average Body Temperature', `${reportData.avgTemp} °C`],
      ['Average AI Health Score', `${reportData.avgScore} / 100`],
      ['Healthy Animals', reportData.healthyCount.toString()],
      ['At-Risk Animals', reportData.atRiskCount.toString()],
      ['Critical Animals', reportData.criticalCount.toString()],
      [`Total Alerts (${reportType})`, reportData.totalAlerts.toString()],
    ];

    let y = 78;
    summaryRows.forEach(([label, value], i) => {
      pdf.setFillColor(i % 2 === 0 ? 245 : 252, i % 2 === 0 ? 245 : 252, i % 2 === 0 ? 252 : 245);
      pdf.rect(15, y - 4, 180, 8, 'F');
      pdf.setTextColor(40, 40, 60);
      pdf.text(label, 18, y);
      pdf.setFont('helvetica', 'bold');
      pdf.text(value, 160, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      y += 9;
    });

    // Animals section
    y += 8;
    pdf.setFontSize(12);
    pdf.setTextColor(16, 185, 129);
    pdf.text('INDIVIDUAL ANIMAL STATUS', 15, y);
    y += 8;
    pdf.setFontSize(9);

    // Table header
    pdf.setFillColor(16, 185, 129);
    pdf.rect(15, y - 4, 180, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    ['Name', 'Tag', 'Species', 'Temp (°C)', 'HR (BPM)', 'Health', 'Score'].forEach((h, i) => {
      pdf.text(h, [15, 40, 70, 105, 130, 152, 178][i], y);
    });
    y += 8;
    pdf.setFont('helvetica', 'normal');

    animals.forEach((a, i) => {
      if (y > 270) { pdf.addPage(); y = 20; }
      const r = latestReadings[a.docId] || {};
      const ai = latestAI[a.docId] || {};
      pdf.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 255 : 255);
      pdf.rect(15, y - 4, 180, 8, 'F');
      pdf.setTextColor(30, 30, 50);
      const row = [
        (a.name || '').slice(0, 10),
        a.tagNumber || '—',
        (a.species || '').slice(0, 8),
        r.bodyTemperature?.toString() || '—',
        r.heartRate?.toString() || '—',
        (a.healthStatus || '').replace('_', ' '),
        `${ai.healthScore || a.currentHealthScore || 0}/100`
      ];
      row.forEach((v, j) => pdf.text(v, [15, 40, 70, 105, 130, 152, 178][j], y));
      y += 9;
    });

    // Alerts section
    if (reportData.relevantAlerts.length > 0) {
      y += 8;
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFontSize(12);
      pdf.setTextColor(16, 185, 129);
      pdf.text(`ALERTS IN PERIOD (${reportData.totalAlerts} total)`, 15, y);
      y += 8;
      pdf.setFontSize(9);
      reportData.relevantAlerts.slice(0, 15).forEach((al, i) => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFillColor(i % 2 === 0 ? 248 : 255, 248, 255);
        pdf.rect(15, y - 4, 180, 8, 'F');
        pdf.setTextColor(al.severity === 'critical' ? 200 : 30, 30, 50);
        const alertTitle = (al.title || '').slice(0, 55);
        pdf.text(alertTitle, 18, y);
        pdf.setTextColor(120, 120, 140);
        pdf.text(al.severity?.toUpperCase() || '', 190, y, { align: 'right' });
        y += 9;
      });
    }

    // Footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 170);
      pdf.text(`LiveTrack AI — Confidential Report — Page ${i} of ${pageCount}`, 15, 290);
    }

    pdf.save(`LiveTrack_${title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    setGenerating(false);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  const periods = [
    { value: 'daily', label: 'Daily Report', desc: 'Last 24 hours', fr: 'FR-F42' },
    { value: 'weekly', label: 'Weekly Report', desc: 'Last 7 days', fr: 'FR-F43' },
    { value: 'monthly', label: 'Monthly Report', desc: 'Last 30 days', fr: 'FR-F44' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Period selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {periods.map(p => (
          <div
            key={p.value}
            className="map-card-wrapper"
            style={{ padding: '1.25rem', cursor: 'pointer', borderColor: reportType === p.value ? 'var(--primary)' : 'var(--border-glass)', background: reportType === p.value ? 'rgba(16,185,129,0.05)' : 'transparent' }}
            onClick={() => setReportType(p.value)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className={`metric-icon ${reportType === p.value ? 'bg-emerald' : ''}`} style={{ width: '36px', height: '36px', opacity: reportType === p.value ? 1 : 0.5 }}>
                <Calendar size={18} color="var(--primary)" />
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{p.fr}</span>
                <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{p.label}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>{p.desc}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FR-F45: Health Trend Report summary */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
        <h4 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="var(--primary)" /> FR-F45 Health Trend Report — {reportType.charAt(0).toUpperCase() + reportType.slice(1)}
        </h4>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Avg. Temperature', value: `${reportData.avgTemp}°C`, sub: 'Normal: 38.5–39.5', color: parseFloat(reportData.avgTemp) > 39.8 ? 'var(--danger)' : 'var(--primary)' },
            { label: 'Avg. Health Score', value: `${reportData.avgScore}%`, sub: 'Across all animals', color: reportData.avgScore > 75 ? 'var(--primary)' : 'var(--warning)' },
            { label: 'Alerts Triggered', value: reportData.totalAlerts, sub: `In ${reportType} period`, color: reportData.totalAlerts > 3 ? 'var(--danger)' : 'var(--primary)' },
            { label: 'Healthy Animals', value: `${reportData.healthyCount}/${animals.length}`, sub: 'Currently healthy', color: 'var(--primary)' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>{label}</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>{value}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dark)', display: 'block', marginTop: '0.2rem' }}>{sub}</span>
            </div>
          ))}
        </div>

        {/* Per-animal health scores */}
        <h5 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '1rem' }}>
          <BarChart2 size={14} color="var(--secondary)" style={{ marginRight: '0.4rem' }} />Individual Animal Health Scores
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {animals.map(a => {
            const score = latestAI[a.docId]?.healthScore ?? a.currentHealthScore ?? 0;
            const color = score > 80 ? 'var(--primary)' : score > 60 ? 'var(--warning)' : 'var(--danger)';
            return (
              <div key={a.docId} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 50px', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{a.name}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{a.tagNumber}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)`, borderRadius: '4px', transition: '0.5s' }} />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color, textAlign: 'right' }}>{score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert Breakdown */}
      {Object.keys(reportData.alertsByType).length > 0 && (
        <div className="map-card-wrapper" style={{ padding: '1.5rem' }}>
          <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1rem' }}>Alert Breakdown by Type</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(reportData.alertsByType).map(([type, count]) => (
              <div key={type} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{type.replace(/_/g, ' ').toUpperCase()}</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FR-F46: Export PDF Button */}
      <div className="map-card-wrapper" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h5 style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: 0 }}>FR-F46 Export Report as PDF</h5>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.3rem 0 0 0' }}>
            Generate a professional {reportType} PDF report with all animal vitals, health scores, and alerts.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={exportPDF}
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px', justifyContent: 'center' }}
        >
          {generated
            ? <><CheckCircle2 size={16} /> Downloaded!</>
            : generating
            ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderTopColor: '#060913' }}></span> Generating...</>
            : <><Download size={16} /> Export PDF</>
          }
        </button>
      </div>
    </div>
  );
}
