import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { axiosInstance } from '../../services/authService';
import { useSocket } from '../../context/SocketContext';

const CriticalCaseAlerts = ({ onViewCase, onCountChange }) => {
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const refreshVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const { data } = await axiosInstance.get('/notifications/critical-alerts');
      if (version !== refreshVersion.current || !data.success) return;
      setAlerts(data.notifications || []);
      onCountChange(data.criticalCount || 0);
      setError('');
    } catch {
      // Polling retries missed alerts when the connection returns.
    }
  }, [onCountChange]);

  useEffect(() => {
    const requestVersion = refreshVersion;
    refresh();
    const interval = setInterval(refresh, 30000);
    const onNotification = (notification) => {
      if (notification?.title === 'Critical Grievance Alert') refresh();
    };
    socket?.on('connect', refresh);
    socket?.on('new_notification', onNotification);
    socket?.on('grievance_updated', refresh);
    socket?.on('critical_alert_acknowledged', refresh);
    window.addEventListener('online', refresh);
    return () => {
      ++requestVersion.current;
      clearInterval(interval);
      socket?.off('connect', refresh);
      socket?.off('new_notification', onNotification);
      socket?.off('grievance_updated', refresh);
      socket?.off('critical_alert_acknowledged', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [refresh, socket]);

  const cases = Array.from(new Map(alerts.map((alert) => [String(alert.relatedGrievance._id), alert])).values());

  const acknowledge = async (grievanceId) => {
    if (savingId) return;
    const ids = alerts.filter((alert) => String(alert.relatedGrievance._id) === grievanceId).map((alert) => alert._id);
    setSavingId(grievanceId);
    setError('');
    try {
      // A case can have older duplicate alerts; acknowledge all of its IDs.
      for (let index = 0; index < ids.length; index += 100) {
        await axiosInstance.put('/notifications/critical-alerts/acknowledge', { notificationIds: ids.slice(index, index + 100) });
      }
      ++refreshVersion.current;
      setAlerts((current) => current.filter((alert) => !ids.includes(alert._id)));
      refresh();
    } catch {
      setError('Acknowledgment failed. Please try again.');
    } finally {
      setSavingId('');
    }
  };

  if (!cases.length) return null;

  return createPortal(
    <section
      role="region"
      aria-label="Critical case alerts"
      className="fixed bottom-4 right-4 z-[10010] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-lg border border-red-300 bg-white shadow-2xl"
    >
      <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-left" aria-live="assertive" aria-atomic="true">
        <h2 className="text-lg font-bold text-red-800">{cases.length === 1 ? 'Critical Case Alert' : `${cases.length} Critical Cases Need Attention`}</h2>
      </div>
      <div className="overflow-y-auto divide-y divide-gray-200">
        {cases.map((alert) => {
          const id = String(alert.relatedGrievance._id);
          return (
            <div key={id} className="px-4 py-4 text-left">
              <p className="break-words text-sm font-bold text-gray-900">{alert.relatedGrievance.referenceNumber || 'Critical case'}</p>
              <p className="mt-1 text-sm text-gray-600">{alert.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onViewCase(id)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">View Case</button>
                <button type="button" disabled={!!savingId} onClick={() => acknowledge(id)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {savingId === id ? 'Acknowledging...' : 'Acknowledge'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="border-t border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>}
    </section>, document.body
  );
};

export default CriticalCaseAlerts;
