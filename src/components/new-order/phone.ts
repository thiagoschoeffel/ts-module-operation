export function formatBrazilianPhone(value: string | number) {
  let digits = String(value).replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
  digits = digits.slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  const areaCode = digits.slice(0, 2)
  const localNumber = digits.slice(2)
  if (localNumber.length <= 4) return `(${areaCode}) ${localNumber}`
  if (digits.length <= 10) return `(${areaCode}) ${localNumber.slice(0, 4)}-${localNumber.slice(4)}`
  return `(${areaCode}) ${localNumber.slice(0, 5)}-${localNumber.slice(5)}`
}
