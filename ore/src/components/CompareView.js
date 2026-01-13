import React from 'react';

export default function CompareView({ previousSnapshot, currentResults, currentTimestamp }) {
  if (!previousSnapshot) {
    return (
      <div className="snapshot-card">
        <div className="snapshot-header">
          <div className="snapshot-title">Snapshot Delta (Previous JSON vs Latest)</div>
          <div className="snapshot-meta">No snapshot loaded</div>
        </div>
        <div className="snapshot-grid">
          <div className="snapshot-empty">Load a previous JSON to see per-wallet changes.</div>
        </div>
      </div>
    );
  }

  if (!currentResults) {
    return (
      <div className="snapshot-card">
        <div className="snapshot-header">
          <div className="snapshot-title">Snapshot Delta (Previous JSON vs Latest)</div>
          <div className="snapshot-meta">Comparing snapshot from {previousSnapshot.generatedAt} to latest ({currentTimestamp || '...'})</div>
        </div>
        <div className="snapshot-grid">
          <div className="snapshot-empty">Waiting for latest data to finish loading.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="snapshot-card">
      <div className="snapshot-header">
        <div className="snapshot-title">Snapshot Delta (Previous JSON vs Latest)</div>
        <div className="snapshot-meta">Comparing snapshot from {previousSnapshot.generatedAt} to latest ({currentTimestamp || '...'})</div>
      </div>
      <div className="snapshot-grid">
        {Object.entries(currentResults).map(([key, curr]) => {
          const prev = previousSnapshot.wallets[key];
          if (!prev) {
            return (
              <div className="snapshot-row" key={key}>
                <div className="snapshot-name">{key.toUpperCase()}</div>
                <div className="snapshot-empty">No previous data for this wallet.</div>
              </div>
            );
          }
          const prevPriceNum = typeof prev.price === 'number' ? prev.price : Number(prev.price || 0);
          const diff = curr.price - prevPriceNum;
          const percent = prevPriceNum === 0 ? 0 : ((diff / prevPriceNum) * 100);
          const up = diff >= 0;
          const chipClass = up ? 'up' : 'down';
          const arrow = up ? '▲' : '▼';
          const isTotal = key === 'total';
          return (
            <div className={`snapshot-row ${isTotal ? 'total' : ''}`} key={key}>
              <div className="snapshot-row-header">
                <div className="snapshot-name">{key.toUpperCase()}</div>
                <div className={`snapshot-chip ${chipClass}`}>
                  <span>{arrow}</span>
                  <span>{percent.toFixed(2)}%</span>
                  <span className="amount">(${diff.toFixed(2)})</span>
                </div>
              </div>
              <div className="snapshot-metrics">
                <div className="metric"><span className="label">Prev</span><span className="value">${prevPriceNum.toFixed(2)}</span></div>
                <div className="metric"><span className="label">Now</span><span className="value">${curr.price.toFixed(2)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
