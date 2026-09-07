/**
 * HiroMetrics brand constants
 * Colors extracted directly from the official HM logo
 */

export const HM_COLORS = {
  blue:   "#0078d2",   // H letter — primary UI blue
  cyan:   "#5ab4d2",   // corner accent — light blue
  green:  "#78b41e",   // corner accent — green
  amber:  "#f0b400",   // corner accent — yellow/amber
  orange: "#f0963c",   // corner accent — orange
  gray:   "#5a5a5a",   // pill background — dark gray
} as const;

export const HM_LOGO = {
  full:        "/brand/hm-logo-transparent.png",
  size32:      "/brand/hm-logo-32.png",
  size64:      "/brand/hm-logo-64.png",
  size128:     "/brand/hm-logo-128.png",
  size256:     "/brand/hm-logo-256.png",
  light:       "/brand/hm-logo-light.png",
  dark:        "/brand/hm-logo-dark.png",
  favicon:     "/brand/favicon.png",
} as const;

export const HM_EMAIL = {
  noreply:  "no-reply@hirometrics.com",
  support:  "support@hirometrics.com",
  footer:   "Replies to this message are undeliverable. Please do not reply.",
  signoff:  "HiroMetrics Team",
} as const;

export const HM_APP = {
  name:     "HiroMetrics",
  tagline:  "Trusted credential verification",
  website:  "https://hirometrics.com",
} as const;
