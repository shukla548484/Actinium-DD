/** E.164-style phone: +{dialCode}{10-digit local number}. */
export const PHONE_E164_REGEX = /^\+\d{1,4}\d{10}$/;

export function formatPhoneE164(dialCode: string, localNumber: string): string {
  return `+${dialCode}${localNumber}`;
}

export function parseStoredPhone(stored: string | null | undefined): {
  dialCode: string;
  localNumber: string;
} {
  if (!stored) return { dialCode: "91", localNumber: "" };

  const e164 = stored.match(/^\+(\d{1,4})(\d{10})$/);
  if (e164) {
    return { dialCode: e164[1], localNumber: e164[2] };
  }

  const digits = stored.replace(/\D/g, "");
  if (digits.length === 10) {
    return { dialCode: "91", localNumber: digits };
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return { dialCode: "91", localNumber: digits.slice(2) };
  }

  return { dialCode: "91", localNumber: digits.slice(-10) };
}

export function isValidLocalPhoneNumber(value: string): boolean {
  return /^\d{10}$/.test(value);
}

export function isValidEmployeePhone(value: string | null | undefined): boolean {
  if (!value) return false;
  return PHONE_E164_REGEX.test(value);
}
