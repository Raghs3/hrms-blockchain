import Layout from '../../components/Layout';
import AuditTrail from '../../components/AuditTrail';
import AccessReceipts from '../../components/AccessReceipts';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * AdminAudit - /admin/audit
 * The full history of uploads and access changes across every patient and doctor.
 */
export default function AdminAudit() {
  useDocumentTitle('Activity History');

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Activity History</h1>
          <p className="page-description">
            Everything that has happened to patient records: who uploaded what, and who was given or lost access.
          </p>
        </div>
      </div>
      <AccessReceipts
        viewer="admin"
        title="Who opened records"
        description="Every time anyone opens a record, a receipt is written to the blockchain first. This is the read-side of the audit trail."
        maxItems={10}
      />
      <div style={{ marginTop: '24px' }}>
        <AuditTrail title="All activity" />
      </div>
    </Layout>
  );
}
