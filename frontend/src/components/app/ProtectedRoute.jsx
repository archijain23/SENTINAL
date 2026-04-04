// AUTH TEMPORARILY BYPASSED — re-enable before production
// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  // TODO: uncomment below block to re-enable login guard
  // const { isAuthenticated } = useAuth();
  // const location = useLocation();
  // if (!isAuthenticated) {
  //   return <Navigate to="/login" state={{ from: location }} replace />;
  // }
  return children;
}
