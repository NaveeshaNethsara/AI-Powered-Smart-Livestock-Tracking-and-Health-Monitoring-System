// AlertsTab.jsx — FR-F34 to FR-F41
// All alert types and alert history
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Bell, Filter, Thermometer, Activity, MapPin, Volume2, Eye } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const ALERT_ICONS = {
  high_temp: Thermometer, low_temp: Thermometer, no_movement: Activity,
  geofence_violation: MapPin, distress: Volume2, injury: Eye,
  abnormal_activity: Activity, default: AlertTriangle
};

const ALERT_FR = {
  high_temp: 'FR-F34', low_temp: 'FR-F35', abnormal_activity: 'FR-F36',
  no_movement: 'FR-F37', geofence_violation: 'FR-F38',
  injury: 'FR-F39', distress: 'FR-F40'
};

export default function AlertsTab({ alerts }) {
  const [filter, setFilter]   = useState('all'); // all, unread, critical, warning
  const [typeFilter, setTypeFilter] = useState('all');

  const markRead = async (alertId) => {
    await updateDoc(doc(db, 'alerts', alertId), { isRead: true });
  };

  const markResolved = async (alertId) => {
    await updateDoc(doc(db, 'alerts', alertId), {
      isRead: true, isResolved: true, resolvedAt: Timestamp.now()
    });
  };

  const filtered = alerts.filter(a => {
    const matchSeverity = filter === 'all' ? true
      : filter === 'unread' ? !a.isRead
      : a.severity === filter;
    const matchType = typeFilter === 'all' ? true : a.alertType === typeFilter;
    return matchSeverity && matchType;
  });

  const unreadCount   = alerts.filter(a => !a.isRead).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  const fmtTime = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const severityColor = (s) => s === 'critical' ? 'var(--danger)' : 'var(--warning)';
  const severityBg    = (s) => s === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Summary KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Alerts', value: alerts.length, color: '#fff' },
          { label: 'Unread (FR-F41)', value: unreadCount, color: unreadCount > 0 ? 'var(--warning)' : 'var(--primary)' },
          { label: 'Critical', value: criticalCount, color: criticalCount > 0 ? 'var(--danger)' : 'var(--primary)' },
          { label: 'Resolved', value: alerts.filter(a => a.isResolved).length, color: 'var(--primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="map-card-wrapper" style={{ padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="filter-dropdown-wrapper" style={{ flex: 'none' }}>
          <Filter size={13} className="filter-ico" />
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Alerts</option>
            <option value="unread">Unread Only</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
          </select>
        </div>
        <div className="filter-dropdown-wrapper" style={{ flex: 'none' }}>
          <Bell size={13} className="filter-ico" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="high_temp">High Temp (FR-F34)</option>
            <option value="low_temp">Low Temp (FR-F35)</option>
            <option value="abnormal_activity">Abnormal Activity (FR-F36)</option>
            <option value="no_movement">No Movement (FR-F37)</option>
            <option value="geofence_violation">Geofence (FR-F38)</option>
            <option value="injury">Injury (FR-F39)</option>
            <option value="distress">Distress (FR-F40)</option>
          </select>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          Showing {filtered.length} of {alerts.length} alerts (FR-F41)
        </span>
      </div>

      {/* Alert List — FR-F34 to FR-F41 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 && (
          <div className="map-card-wrapper" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={24} color="var(--primary)" style={{ margin: '0 auto 0.75rem' }} />
            No alerts match your current filters. All clear!
          </div>
        )}
        {filtered.map(alert => {
          const Icon = ALERT_ICONS[alert.alertType] || ALERT_ICONS.default;
          const frId = ALERT_FR[alert.alertType] || 'FR-F34';
          return (
            <div
              key={alert.docId}
              style={{
                background: alert.isResolved ? 'rgba(255,255,255,0.01)' : severityBg(alert.severity),
                border: `1px solid ${alert.isResolved ? 'var(--border-glass)' : alert.severity === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                opacity: alert.isResolved ? 0.55 : 1
              }}
            >
              {/* Icon */}
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${severityColor(alert.severity)}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={alert.isResolved ? 'var(--text-muted)' : severityColor(alert.severity)} />
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-dark)', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>{frId}</span>
                  <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.6rem', borderRadius: '20px', fontWeight: 600, color: alert.isResolved ? 'var(--primary)' : severityColor(alert.severity), background: alert.isResolved ? 'rgba(16,185,129,0.08)' : `${severityColor(alert.severity)}15` }}>
                    {alert.isResolved ? 'RESOLVED' : alert.severity?.toUpperCase()}
                  </span>
                  {!alert.isRead && !alert.isResolved && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }}></span>
                  )}
                </div>
                <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{alert.title}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 0.5rem 0' }}>{alert.message}</p>
                {alert.sensorValue > 0 && (
                  <p style={{ color: 'var(--text-dark)', fontSize: '0.72rem', margin: 0 }}>
                    Triggered value: <strong style={{ color: '#fff' }}>{alert.sensorValue}</strong> — Threshold: <strong style={{ color: '#fff' }}>{alert.threshold}</strong>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0, alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dark)' }}>{fmtTime(alert.triggeredAt)}</span>
                {!alert.isResolved && (
                  <>
                    {!alert.isRead && (
                      <button className="btn-logout" onClick={() => markRead(alert.docId)}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.68rem', borderColor: 'rgba(255,255,255,0.1)' }}>
                        Mark Read
                      </button>
                    )}
                    <button className="btn-logout" onClick={() => markResolved(alert.docId)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.68rem', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--primary)' }}>
                      <CheckCircle2 size={11} /> Resolve
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
