import React, { useRef, useState } from 'react';
import { formatAddress, copyToClipboard } from '../utils/helpers';

export default function WalletCard({ walletKey, item, customData, onUpdateCustomData, enabled = true, onToggleEnabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const addrShort = formatAddress(item.address);
  const addressRef = useRef(null);

  const handleCopyAddress = async () => {
    const ok = await copyToClipboard(item.address);
    if (!ok || !addressRef.current) return;

    const el = addressRef.current;
    el.textContent = '✓ Copied!';
    el.style.color = '#10b981';

    setTimeout(() => {
      if (!addressRef.current) return;
      el.textContent = addrShort;
      el.style.color = '';
    }, 1500);
  };

  const handleFieldChange = (field, value) => {
    onUpdateCustomData(walletKey, field, value);
  };

  return (
    <div className="card" data-card-key={walletKey} style={enabled ? undefined : { opacity: 0.55 }}>
      <div className="card-header-row">
        <div className="card-label">{walletKey.toUpperCase()}</div>
        <button
          className={`toggle ${enabled ? 'on' : 'off'}`}
          onClick={() => onToggleEnabled && onToggleEnabled(walletKey, !enabled)}
          title={enabled ? 'Disable this miner' : 'Enable this miner'}
        >
          <span className="toggle-knob"></span>
          <span className="toggle-text">{enabled ? 'Active' : 'Disabled'}</span>
        </button>
      </div>
      <div
        ref={addressRef}
        className="card-address"
        style={{ cursor: 'pointer' }}
        onClick={handleCopyAddress}
        title="Click to copy"
      >
        {addrShort}
      </div>

      <div className="card-row">
        <div className="card-column">
          <div className="card-data-label">SOL</div>
          <div className="card-data-value">
            {item.sol === '-' ? '-' : item.sol.toFixed(4)}
          </div>
        </div>
        <div className="card-column">
          <div className="card-data-label">ORE</div>
          <div className="card-data-value">
            {item.ore === '-' ? '-' : item.ore.toFixed(4)}
          </div>
        </div>
        <div className="card-column">
          <div className="card-data-label">PRICE ($)</div>
          <div className="card-data-value price-value">
            ${item.price.toFixed(2)}
          </div>
        </div>
      </div>

        <div className="tags-container">
          {customData.deploymentType ||
          customData.evPercent ||
          customData.totalSol ||
          customData.noOfTiles ||
          customData.timeframe ? (
            <>
              {customData.deploymentType && (
                <div className="tag">
                  <span className="tag-label">Type:</span>
                  <span className="tag-value">{customData.deploymentType}</span>
                </div>
              )}
              {customData.evPercent && (
                <div className="tag">
                  <span className="tag-label">EV:</span>
                  <span className="tag-value">{customData.evPercent}</span>
                </div>
              )}
              {customData.timeframe && (
                <div className="tag">
                  <span className="tag-label">Timeframe:</span>
                  <span className="tag-value">{customData.timeframe}</span>
                </div>
              )}
              {customData.totalSol && (
                <div className="tag">
                  <span className="tag-label">Total SOL:</span>
                  <span className="tag-value">{customData.totalSol}</span>
                </div>
              )}
              {customData.noOfTiles && (
                <div className="tag">
                  <span className="tag-label">Tiles:</span>
                  <span className="tag-value">{customData.noOfTiles}</span>
                </div>
              )}
            </>
          ) : (
            <div className="tag">
              <span className="tag-value" style={{ color: '#64748b' }}>
                No data - click Edit to add
              </span>
            </div>
          )}
        </div>

      {isEditing && (
        <div className="editable-fields">
          <div className="editable-field">
            <div className="editable-label">Deployment Type</div>
            <input
              className="editable-input"
              value={customData.deploymentType}
              placeholder="e.g., Cloud"
              onChange={(e) => handleFieldChange('deploymentType', e.target.value)}
            />
          </div>

          <div className="editable-field">
            <div className="editable-label">EV %</div>
            <input
              className="editable-input"
              value={customData.evPercent}
              placeholder="e.g., 15%"
              onChange={(e) => handleFieldChange('evPercent', e.target.value)}
            />
          </div>

          <div className="editable-field">
            <div className="editable-label">Timeframe</div>
            <input
              className="editable-input"
              value={customData.timeframe}
              placeholder="e.g., 5"
              onChange={(e) => handleFieldChange('timeframe', e.target.value)}
            />
          </div>

          <div className="editable-field">
            <div className="editable-label">Total SOL</div>
            <input
              className="editable-input"
              value={customData.totalSol}
              placeholder="e.g., 5.5"
              onChange={(e) => handleFieldChange('totalSol', e.target.value)}
            />
          </div>

          <div className="editable-field">
            <div className="editable-label">No of Tiles</div>
            <input
              className="editable-input"
              value={customData.noOfTiles}
              placeholder="e.g., 10"
              onChange={(e) => handleFieldChange('noOfTiles', e.target.value)}
            />
          </div>
        </div>
      )}

      <button
        className="edit-button"
        onClick={() => setIsEditing(!isEditing)}
        title="Edit card details"
        style={
          isEditing
            ? { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }
            : undefined
        }
      >
        {isEditing ? '✓' : '✏️'}
      </button>
    </div>
  );
}
