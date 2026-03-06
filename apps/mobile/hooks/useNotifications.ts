import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '../lib/notifications';
import { useAuthStore } from '../store/authStore';

export function useNotifications() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const listenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications();

    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
        const type = data.type as string | undefined;
        const role = user?.role;

        if (role === 'PATIENT') {
          if (type === 'REPORT_READY' || type === 'CRITICAL_VALUE') {
            router.push('/(patient)/reports');
          } else if (
            type === 'SAMPLE_COLLECTED' ||
            type === 'ORDER_CONFIRMED' ||
            type === 'PHLEBO_EN_ROUTE' ||
            type === 'APPOINTMENT_REMINDER'
          ) {
            router.push('/(patient)/track');
          }
        } else if (role === 'PHLEBOTOMIST') {
          if (type === 'NEW_ASSIGNMENT') {
            router.push('/(phlebotomist)/');
          }
        }
      },
    );

    return () => {
      if (listenerRef.current) {
        Notifications.removeNotificationSubscription(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [isAuthenticated, user?.role]);
}
