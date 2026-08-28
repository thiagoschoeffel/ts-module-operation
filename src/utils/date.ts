export function formatLongDate(date = new Date()) {
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(date)

  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
}
