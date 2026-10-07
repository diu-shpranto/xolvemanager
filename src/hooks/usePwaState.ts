import { useSyncExternalStore } from 'react';
import { getPwaState, subscribeToPwaState } from '../services/pwaService';

export const usePwaState = () =>
  useSyncExternalStore(subscribeToPwaState, getPwaState, getPwaState);
