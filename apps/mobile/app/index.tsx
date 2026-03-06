import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export default function Index() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const role = user?.role;
  if (role === 'PATIENT') return <Redirect href="/(patient)/" />;
  if (role === 'PHLEBOTOMIST') return <Redirect href="/(phlebotomist)/" />;
  if (role === 'DOCTOR') return <Redirect href="/(doctor)/" />;

  // Staff roles — web app only
  return <Redirect href="/staff-notice" />;
}
