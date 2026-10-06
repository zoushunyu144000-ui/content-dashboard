// Client-safe branding. Only NEXT_PUBLIC_* values belong here.
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Content Intelligence',
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, ''),
};
