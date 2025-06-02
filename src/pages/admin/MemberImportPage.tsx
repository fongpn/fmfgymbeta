import React from 'react';
import { MembershipCsvImport } from '../../components/admin/MembershipCsvImport';

const MemberImportPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <MembershipCsvImport />
    </div>
  );
};

export default MemberImportPage; 