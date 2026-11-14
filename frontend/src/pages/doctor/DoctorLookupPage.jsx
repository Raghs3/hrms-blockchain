import Layout from '../../components/Layout';
import RecordLookup from '../../components/RecordLookup';
import { useDoctorSession } from '../../context/DoctorSessionContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * DoctorLookupPage - /doctor/lookup
 * Dedicated page for verifying on-chain record access permissions,
 * decrypting verified medical content, and reusing session lookups.
 */
export default function DoctorLookupPage() {
  useDocumentTitle('Record Lookup');
  const sessionHistory = useDoctorSession();

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Record Lookup & Verification</h1>
          <p className="page-description">
            Verify smart contract permissions and securely view patient-authorized healthcare records.
          </p>
        </div>
      </div>

      <RecordLookup sessionHistory={sessionHistory} />
    </Layout>
  );
}

