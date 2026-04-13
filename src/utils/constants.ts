export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export const LOAD_PRESETS = {
  flat: {
    label: 'Flat (uniform)',
    generate: (base: number) => Array(24).fill(base || 500),
  },
  dayPeak: {
    label: 'Day peak',
    generate: (base: number) => {
      const b = base || 500;
      return Array.from({ length: 24 }, (_, h) => {
        if (h >= 8 && h <= 18) return Math.round(b * (0.8 + 0.4 * Math.sin(((h - 8) / 10) * Math.PI)));
        return Math.round(b * 0.3);
      });
    },
  },
  nightPeak: {
    label: 'Night peak',
    generate: (base: number) => {
      const b = base || 500;
      return Array.from({ length: 24 }, (_, h) => {
        if (h >= 18 || h <= 6) return Math.round(b * (0.7 + 0.3 * Math.random()));
        return Math.round(b * 0.25);
      });
    },
  },
} as const;

export type PresetKey = keyof typeof LOAD_PRESETS;
