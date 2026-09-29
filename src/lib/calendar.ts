// Calendar helpers: an .ics event (attached to emails, downloadable on the order page) and a Google Calendar link.

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds content lines at 73 characters as RFC 5545 requires (continuation lines start with a space). */
function fold(line: string) {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) { parts.push(rest.slice(0, 73)); rest = rest.slice(73); }
  parts.push(rest);
  return parts.join('\r\n ');
}

export type CalendarEvent = {uid: string; start: Date; end: Date; title: string; description: string; url: string};

export function icsEvent(event: CalendarEvent, now = new Date()) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jewish Horse//Orders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.start)}`, `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(event.description)}`, `URL:${event.url}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarLink(event: Omit<CalendarEvent, 'uid'>) {
  const params = new URLSearchParams({action: 'TEMPLATE', text: event.title, dates: `${stamp(event.start)}/${stamp(event.end)}`, details: `${event.description}\n${event.url}`});
  return `https://calendar.google.com/calendar/render?${params}`;
}
