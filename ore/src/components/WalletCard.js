import React, { useRef, useState } from 'react';
import { formatAddress, copyToClipboard } from '../utils/helpers';

export default function WalletCard({ walletKey, item, customData, onUpdateCustomData, enabled = true, onToggleEnabled }) {
  const [isEditing, setIsEditing] = useState(false);
  const addrShort = formatAddress(item.address);
  const addressRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const [savedPrice, setSavedPrice] = useState(() => {
    const s = localStorage.getItem(`price_${walletKey}`);
    return s ? parseFloat(s) : null;
  });
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [showSavedOverlay, setShowSavedOverlay] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [pendingPrice, setPendingPrice] = useState(null);

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

  const handlePriceClick = () => {
    if (clickTimeoutRef.current) {
      // double click
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;

      const s = localStorage.getItem(`price_${walletKey}`);
      if (s) {
        setSavedPrice(parseFloat(s));
      }
      setShowSavedOverlay(true);
      setTimeout(() => setShowSavedOverlay(false), 3000);
    } else {
      // possible single click - wait to confirm not a double
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        // single click: prepare to save current price, but confirm overwrite if exists
        const price = item.price;
        const existing = localStorage.getItem(`price_${walletKey}`);
        if (existing !== null) {
          setPendingPrice(price);
          setShowOverrideConfirm(true);
        } else {
          localStorage.setItem(`price_${walletKey}`, price.toString());
          setSavedPrice(price);
          setSaveConfirm(true);
          setTimeout(() => setSaveConfirm(false), 1500);
        }
      }, 250);
    }
  };

  const confirmOverride = () => {
    if (pendingPrice === null) return;
    localStorage.setItem(`price_${walletKey}`, pendingPrice.toString());
    setSavedPrice(pendingPrice);
    setShowOverrideConfirm(false);
    setPendingPrice(null);
    setSaveConfirm(true);
    setTimeout(() => setSaveConfirm(false), 1500);
  };

  const cancelOverride = () => {
    setShowOverrideConfirm(false);
    setPendingPrice(null);
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
          <div
            className="card-data-value price-value"
            onClick={handlePriceClick}
            style={{ cursor: 'pointer', position: 'relative' }}
            title="Single click = save price, Double-click = show saved price"
          >
            ${item.price.toFixed(2)}

            {saveConfirm && (
              <div style={{
                position: 'absolute',
                top: -28,
                right: 8,
                background: '#10b981',
                color: 'white',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700
              }}>
                Saved
              </div>
            )}

            {showOverrideConfirm && (
              <div style={{
                position: 'absolute',
                top: -64,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#111827',
                color: 'white',
                padding: '8px 10px',
                borderRadius: 8,
                boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              }}>
                <div style={{ fontSize: 13 }}>
                  Override saved price?
                </div>
                <button onClick={(e) => { e.stopPropagation(); confirmOverride(); }} style={{ background: '#ef4444', color: 'white', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Override</button>
                <button onClick={(e) => { e.stopPropagation(); cancelOverride(); }} style={{ background: '#374151', color: 'white', border: 0, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              </div>
            )}

            {showSavedOverlay && (
              <div style={{
                position: 'absolute',
                top: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(90deg,#0ea5a4,#06b6d4)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: 10,
                boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
                fontWeight: 700
              }}>
                {savedPrice !== null ? `$${savedPrice.toFixed(2)}` : 'No saved price'}
              </div>
            )}
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
