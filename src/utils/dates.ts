export const fmtTimestamp = (d: Date) => {
  return d.toLocaleString('pl-PL', {
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  });
};

export const fmtDate = (d: Date) => {
  return d.toLocaleDateString('pl-PL', {
    month: 'short', 
    day: 'numeric'
  });
};

export const fmtISO = (d: Date) => {
  return d.toISOString().split('T')[0];
};
