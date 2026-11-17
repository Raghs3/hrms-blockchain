import Layout from '../../components/Layout';
import UploadRecordForm from '../../components/UploadRecordForm';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * PatientUpload - /patient/upload
 * Inline upload page allowing patients to securely encrypt and register records.
 */
export default function PatientUpload() {
  useDocumentTitle('Upload Record');

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Upload Healthcare Record</h1>
          <p className="page-description">
            Encrypt and pin a medical record (PDF, image, Word or text file, up to 10 MB) to IPFS with smart contract registration.
          </p>
        </div>
      </div>

      <UploadRecordForm />
    </Layout>
  );
}

