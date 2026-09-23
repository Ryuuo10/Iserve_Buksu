import React from 'react';

const PendingVerification = () => (
  <div style={{ textAlign: 'center', marginTop: '4rem' }}>
    <h2>Your account is pending verification</h2>
    <p>
      Your office account has been created but is not yet verified by the superadmin.<br/>
      Please wait for approval. You will receive an email once your account is verified or rejected.
    </p>
  </div>
);

export default PendingVerification;
