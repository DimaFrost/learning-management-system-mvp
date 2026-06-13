import { useState } from 'react';
import { initialCadenceSettings } from '../data/seed';

export function useCadenceSettings() {
  const [cadenceSettings, setCadenceSettings] = useState(initialCadenceSettings);
  return { cadenceSettings, setCadenceSettings };
}
