export function normalizePhoneToE164(value: string | null | undefined): string | null {
  if (!value) return null;
  const phone = value.trim().replace(/[\s().-]/g, "");

  if (/^0\d{9}$/.test(phone) && isVietnameseMobileNumber(phone)) {
    return `+84${phone.slice(1)}`;
  }

  if (/^\+84\d{9}$/.test(phone)) {
    const vietnameseNumber = `0${phone.slice(3)}`;
    return isVietnameseMobileNumber(vietnameseNumber) ? phone : null;
  }

  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function isBookingProfileComplete(
  phone: string | null | undefined,
  emailConfirmedAt: string | null | undefined,
  pendingEmail: string | null | undefined,
): boolean {
  return Boolean(normalizePhoneToE164(phone) && emailConfirmedAt && !pendingEmail);
}

function isVietnameseMobileNumber(phone: string): boolean {
  const prefix = phone.slice(0, 3);
  const thirdDigit = phone[2];
  if (!thirdDigit) return false;

  const validThirdDigits: Record<string, string> = {
    "03": "23456789",
    "05": "2689",
    "07": "06789",
    "08": "12345689",
    "09": "012346789",
  };

  return validThirdDigits[prefix.slice(0, 2)]?.includes(thirdDigit) ?? false;
}
