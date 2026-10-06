export function vttToPlainText(vtt: string): string {
  const lines = vtt
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line === 'WEBVTT' || line.startsWith('WEBVTT ')) return false;
      if (line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) return false;
      if (line.includes('-->')) return false;
      if (/^\d+$/.test(line)) return false;
      return true;
    })
    .map((line) => line.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  const unique: string[] = [];
  for (const line of lines) {
    if (unique[unique.length - 1] !== line) unique.push(line);
  }
  return unique.join(' ').replace(/\s+/g, ' ').trim();
}
