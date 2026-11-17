import Layout from '../../components/Layout';
import AuditTrail from '../../components/AuditTrail';
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
      <AuditTrail title="All activity" />
    </Layout>
  );
}
