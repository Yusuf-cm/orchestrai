import { describe, expect, it } from 'vitest';
import { mapScribeLanguage, ttsModelsFor } from '../services/voice/elevenlabs';

describe('ElevenLabs language routing', () => {
  it('treats Scribe Swahili codes as Kiswahili', () => {
    expect(mapScribeLanguage('swa')).toBe('sw');
    expect(mapScribeLanguage('sw')).toBe('sw');
    expect(mapScribeLanguage('SWA')).toBe('sw');
  });

  it('defaults unknown codes to English', () => {
    expect(mapScribeLanguage('eng')).toBe('en');
    expect(mapScribeLanguage(undefined)).toBe('en');
  });

  it('uses v3 for Kiswahili and a low-latency model for English', () => {
    expect(ttsModelsFor('sw')[0]).toBe('eleven_v3');
    expect(ttsModelsFor('en')[0]).toBe('eleven_flash_v2_5');
  });
});
