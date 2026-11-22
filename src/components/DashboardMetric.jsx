import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function DashboardMetric({ icon: Icon, label, value, note, color, onClick }) {
  const content = (
    <>
      <span className="dashboard-metric-icon" style={{ background: `${color}14`, color }}>
        <Icon size={20} />
      </span>
      <span className="dashboard-metric-copy">
        <span className="dashboard-metric-label">{label}</span>
        <strong className="dashboard-metric-value">{value}</strong>
        <span className="dashboard-metric-note">{note}</span>
      </span>
      {onClick && <ArrowRight className="dashboard-metric-arrow" size={16} />}
    </>
  );
  const className = `dashboard-metric${onClick ? ' is-actionable' : ''}`;

  return onClick
    ? <button type="button" className={className} onClick={onClick}>{content}</button>
    : <div className={className}>{content}</div>;
}
