import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { attacksAPI, aiAPI } from '../services/api';
import SeverityBadge from '../components/ui/SeverityBadge';
import styles from './ForensicsPage.module.css';

function Field({ label, value, mono }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={`${styles.fieldValue} ${mono ? styles.mono : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

export default function ForensicsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [attack, setAttack]   = useState(null);
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const [atk, forensics] = await Promise.all([
          attacksAPI.getById(id).catch(() => null),
          attacksAPI.getForensics(id).catch(() => null),
        ]);
        setAttack({ ...(atk ?? {}), ...(forensics ?? {}) });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const generateReport = async () => {
    setAiLoading(true);
    try {
      const r = await aiAPI.report(id, 'technical');
      setReport(r);
    } catch (e) {
      setReport({ error: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  if (!id) return (
    <div className={styles.noId}>
      <p>No attack ID provided. Navigate here from the Threats page.</p>
      <button className={styles.backBtn} onClick={() => navigate('/app/threats')}>← Back to Threats</button>
    </div>
  );

  if (loading) return (
    <div className={styles.loading}>
      {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonBlock} />)}
    </div>
  );

  if (error) return (
    <div className={styles.errorState}>
      <p>⚠ Failed to load forensics: {error}</p>
      <button className={styles.backBtn} onClick={() => navigate('/app/threats')}>← Back to Threats</button>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Nav */}
      <button className={styles.backBtn} onClick={() => navigate('/app/threats')}>← Back to Threats</button>

      {/* Attack Header */}
      <div className={styles.attackHeader}>
        <div>
          <h1 className={styles.attackType}>{attack?.type ?? attack?.attackType ?? 'Unknown Attack'}</h1>
          <p className={styles.attackId}>ID: <span className={styles.mono}>{id}</span></p>
        </div>
        <SeverityBadge level={attack?.severity ?? 'high'} />
      </div>

      <div className={styles.grid}>
        {/* Network Info */}
        <Section title="Network Context">
          <Field label="Source IP"     value={attack?.sourceIP ?? attack?.src_ip} mono />
          <Field label="Destination IP" value={attack?.destIP ?? attack?.dst_ip} mono />
          <Field label="Source Port"   value={attack?.srcPort ?? attack?.src_port} mono />
          <Field label="Dest Port"     value={attack?.destPort ?? attack?.dst_port} mono />
          <Field label="Protocol"      value={attack?.protocol} />
          <Field label="Country"       value={attack?.country ?? attack?.geoCountry} />
        </Section>

        {/* Detection Info */}
        <Section title="Detection">
          <Field label="Confidence"    value={attack?.confidence != null ? `${(attack.confidence * 100).toFixed(1)}%` : null} />
          <Field label="Model"         value={attack?.model ?? attack?.detectionModel} />
          <Field label="Rule"          value={attack?.matchedRule ?? attack?.rule} mono />
          <Field label="Detected At"   value={attack?.timestamp ? new Date(attack.timestamp).toLocaleString() : null} />
          <Field label="Action Taken"  value={attack?.action ?? attack?.actionTaken} />
          <Field label="Resolved"      value={attack?.resolved != null ? (attack.resolved ? 'Yes' : 'No') : null} />
        </Section>

        {/* Payload */}
        {(attack?.payload ?? attack?.rawPayload) && (
          <Section title="Raw Payload">
            <pre className={styles.payload}>{JSON.stringify(attack?.payload ?? attack?.rawPayload, null, 2)}</pre>
          </Section>
        )}

        {/* Features */}
        {attack?.features && (
          <Section title="ML Features">
            <pre className={styles.payload}>{JSON.stringify(attack.features, null, 2)}</pre>
          </Section>
        )}

        {/* AI Report */}
        <Section title="AI Forensic Report">
          {!report ? (
            <div className={styles.reportPlaceholder}>
              <p>Generate a Gemini AI-powered technical report for this attack.</p>
              <button className={styles.genBtn} onClick={generateReport} disabled={aiLoading}>
                {aiLoading ? 'Generating…' : 'Generate Report'}
              </button>
            </div>
          ) : report.error ? (
            <p className={styles.reportError}>⚠ {report.error}</p>
          ) : (
            <div className={styles.reportContent}>
              <pre>{typeof report === 'string' ? report : JSON.stringify(report, null, 2)}</pre>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
