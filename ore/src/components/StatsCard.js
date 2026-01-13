import React from 'react';

export default function StatsCard({ stats }) {
  if (!stats) return null;

  return (
    <div id="stats-container">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">📊 Total Value</div>
          <div className="stat-value">${stats.totalValue?.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🌐 Total SOL</div>
          <div className="stat-value">{stats.totalSol?.toFixed(4)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💎 Total ORE</div>
          <div className="stat-value">{stats.totalOre?.toFixed(4)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">👛 Wallets</div>
          <div className="stat-value">{stats.walletCount}</div>
        </div>
      </div>
    </div>
  );
}
