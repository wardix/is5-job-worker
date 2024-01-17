export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '')
  return digitsOnly.startsWith('0')
    ? '62' + digitsOnly.substring(1)
    : digitsOnly
}
