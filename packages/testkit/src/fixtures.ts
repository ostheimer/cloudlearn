export const sampleOcrTextDe = `Die Photosynthese beschreibt den Prozess, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln.`;

export const sampleOcrTextEn = `Photosynthesis is the process by which plants convert light energy into chemical energy.`;

export function createRequestId(seed: string): string {
  return `req_${seed}_${Date.now()}`;
}
