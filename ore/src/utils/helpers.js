export function formatAddress(addr) {
  return addr.substring(0, 12) + '...' + addr.substring(addr.length - 8);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function filterDataByTimeRange(data, timeFilter) {
  if (!data.length || timeFilter === 'all') return data;
  
  const now = new Date();
  const cutoffTime = new Date();
  
  switch (timeFilter) {
    case '1d':
      cutoffTime.setDate(now.getDate() - 1);
      break;
    case '3d':
      cutoffTime.setDate(now.getDate() - 3);
      break;
    case '1w':
      cutoffTime.setDate(now.getDate() - 7);
      break;
    default:
      break;
  }
  
  return data.filter(item => {
    if (!item.rawDate) return true;
    return item.rawDate >= cutoffTime;
  });
}

export function getVisibleData(historyData, zoomDomain, timeFilter) {
  const filteredData = filterDataByTimeRange(historyData, timeFilter);
  const startIdx = Math.floor((zoomDomain.start / 100) * filteredData.length);
  const endIdx = Math.ceil((zoomDomain.end / 100) * filteredData.length);
  return filteredData.slice(startIdx, endIdx);
}
