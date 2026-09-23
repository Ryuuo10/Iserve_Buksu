import { Navigate } from 'react-router-dom';

const AdminManage = () => (
  <Navigate
    to="/admin"
    replace
    state={{ activeTab: 'admin-manage' }}
  />
);

export default AdminManage;
