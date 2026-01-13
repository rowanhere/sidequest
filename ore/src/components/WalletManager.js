import React, { useState } from 'react';

export default function WalletManager({ addresses, onAddressesChange, onClose }) {
  const [newAddress, setNewAddress] = useState('');
  const [newIndex, setNewIndex] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editAddress, setEditAddress] = useState('');
  const [editIndex, setEditIndex] = useState('');

  const handleAdd = () => {
    if (!newAddress.trim() || !newIndex.trim()) {
      alert('Please fill both address and index fields');
      return;
    }

    const exists = addresses.some(a => a.index === newIndex.trim() || a.address === newAddress.trim());
    if (exists) {
      alert('Address or index already exists');
      return;
    }

    onAddressesChange([...addresses, { address: newAddress.trim(), index: newIndex.trim() }]);
    setNewAddress('');
    setNewIndex('');
  };

  const handleDelete = (index) => {
    if (window.confirm(`Delete wallet "${index}"?`)) {
      onAddressesChange(addresses.filter(a => a.index !== index));
    }
  };

  const startEdit = (item) => {
    setEditingId(item.index);
    setEditAddress(item.address);
    setEditIndex(item.index);
  };

  const saveEdit = (oldIndex) => {
    if (!editAddress.trim() || !editIndex.trim()) {
      alert('Please fill both address and index fields');
      return;
    }

    const exists = addresses.some(a => 
      a.index !== oldIndex && (a.index === editIndex.trim() || a.address === editAddress.trim())
    );
    if (exists) {
      alert('Address or index already exists');
      return;
    }

    onAddressesChange(addresses.map(a => 
      a.index === oldIndex ? { address: editAddress.trim(), index: editIndex.trim() } : a
    ));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAddress('');
    setEditIndex('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ margin: 0, color: '#00d4ff', fontSize: '24px' }}>🔑 Manage Wallets</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '5px 10px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Add New Wallet */}
        <div style={{
          backgroundColor: 'rgba(0, 212, 255, 0.05)',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '25px',
          border: '1px solid rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#00d4ff', fontSize: '16px' }}>➕ Add New Wallet</h3>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Wallet Address"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="Index (e.g., ore1, wallet1)"
              value={newIndex}
              onChange={(e) => setNewIndex(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                backgroundColor: '#0f172a',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>
          <button
            onClick={handleAdd}
            style={{
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            Add Wallet
          </button>
        </div>

        {/* Wallet List */}
        <div>
          <h3 style={{ margin: '0 0 15px 0', color: '#00d4ff', fontSize: '16px' }}>
            📋 Wallets ({addresses.length})
          </h3>
          {addresses.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
              No wallets added yet. Add your first wallet above.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {addresses.map((item) => (
                <div key={item.index} style={{
                  backgroundColor: '#0f172a',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 212, 255, 0.2)'
                }}>
                  {editingId === item.index ? (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        style={{
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          backgroundColor: '#1a1a2e',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                      <input
                        type="text"
                        value={editIndex}
                        onChange={(e) => setEditIndex(e.target.value)}
                        style={{
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          backgroundColor: '#1a1a2e',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => saveEdit(item.index)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#10b981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#64748b',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#00d4ff', fontWeight: 'bold', fontSize: '14px' }}>
                          {item.index.toUpperCase()}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => startEdit(item)}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#3b82f6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.index)}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ 
                        color: '#94a3b8', 
                        fontSize: '12px',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace'
                      }}>
                        {item.address}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
